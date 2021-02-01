import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Share from 'react-native-share';
import { useNavigation, useRoute, useTheme } from '@react-navigation/native';
import Clipboard from '@react-native-community/clipboard';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import RNFS from 'react-native-fs';
import * as bitcoin from 'bitcoinjs-lib';

import loc from '../../loc';
import navigationStyle from '../../components/navigationStyle';
import {
  BlueCard,
  BlueCopyToClipboardButton,
  BlueSpacing20,
  BlueText,
  DynamicQRCode,
  SafeBlueArea,
  SecondButton,
} from '../../BlueComponents';
import { BlueStorageContext } from '../../blue_modules/storage-context';
import { isCatalyst, isMacCatalina } from '../../blue_modules/environment';
import Biometric from '../../class/biometrics';
import Notifications from '../../blue_modules/notifications';
const BlueElectrum = require('../../blue_modules/BlueElectrum');
const fs = require('../../blue_modules/fs');

const PsbtSign = () => {
  const { wallets, fetchAndSaveWalletTransactions } = useContext(BlueStorageContext);
  const { colors } = useTheme();
  const route = useRoute();
  const { walletID } = route.params;
  const wallet = useMemo(() => wallets.find(item => item.getID() === walletID), [walletID]); // eslint-disable-line react-hooks/exhaustive-deps
  const { navigate, goBack } = useNavigation();
  const { width, height } = useWindowDimensions();
  const [isLoading, setIsLoading] = useState(false);
  const [psbtHex, setPsbtHex] = useState();
  const [psbtB64, setPsbtB64] = useState();
  const [txHex, setTxHex] = useState();

  const stylesHook = StyleSheet.create({
    root: {
      backgroundColor: colors.elevated,
    },
    rootPadding: {
      backgroundColor: colors.elevated,
    },
    hexWrap: {
      backgroundColor: colors.elevated,
    },
    hexLabel: {
      color: colors.foregroundColor,
    },
    hexInput: {
      borderColor: colors.formBorder,
      backgroundColor: colors.inputBackgroundColor,
      color: colors.foregroundColor,
    },
    hexText: {
      color: colors.foregroundColor,
    },
  });

  useEffect(() => {
    openScanner();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onBarScanned = ret => {
    if (ret && !ret.data) ret = { data: ret };
    let tx;
    let psbt;
    try {
      psbt = bitcoin.Psbt.fromBase64(ret.data);
      tx = wallet.cosignPsbt(psbt).tx;
    } catch (e) {
      Alert.alert(e.message);
    }

    if (tx) {
      setTxHex(tx.toHex());
      setPsbtHex();
      setPsbtB64();
    } else {
      setTxHex();
      setPsbtHex(psbt.toHex());
      setPsbtB64(psbt.toBase64());
    }
  };

  console.info('txHex', txHex);
  console.info('psbtHex', psbtHex);

  const openScanner = () => {
    if (isMacCatalina) {
      fs.showActionSheet().then(data => onBarScanned({ data }));
    } else {
      navigate('ScanQRCodeRoot', {
        screen: 'ScanQRCode',
        params: {
          launchedBy: route.name,
          showFileImportButton: true,
          onBarScanned,
          onDismiss: goBack,
        },
      });
    }
  };

  const handleBroadcast = async () => {
    setIsLoading(true);
    const isBiometricsEnabled = await Biometric.isBiometricUseCapableAndEnabled();

    if (isBiometricsEnabled) {
      if (!(await Biometric.unlockWithBiometrics())) {
        setIsLoading(false);
        return;
      }
    }
    try {
      await BlueElectrum.ping();
      await BlueElectrum.waitTillConnected();
      const result = await wallet.broadcastTx(txHex);
      if (result) {
        setIsLoading(false);
        const txDecoded = bitcoin.Transaction.fromHex(txHex);
        const txid = txDecoded.getId();
        Notifications.majorTomToGroundControl([], [], [txid]);
        // if (memo) {
        //   txMetadata[txid] = { memo };
        // }
        navigate('Success', { amount: undefined });
        await new Promise(resolve => setTimeout(resolve, 3000)); // sleep to make sure network propagates
        fetchAndSaveWalletTransactions(wallet.getID());
      } else {
        ReactNativeHapticFeedback.trigger('notificationError', { ignoreAndroidSystemSettings: false });
        setIsLoading(false);
        Alert.alert(loc.errors.broadcast);
      }
    } catch (error) {
      ReactNativeHapticFeedback.trigger('notificationError', { ignoreAndroidSystemSettings: false });
      setIsLoading(false);
      Alert.alert(error.message);
    }
  };

  const handleOnVerifyPressed = () => {
    Linking.openURL('https://coinb.in/?verify=' + txHex);
  };

  const exportPSBT = async () => {
    const fileName = `${Date.now()}.psbt`;
    if (Platform.OS === 'ios') {
      const filePath = RNFS.TemporaryDirectoryPath + `/${fileName}`;
      await RNFS.writeFile(filePath, psbtB64);
      Share.open({
        url: 'file://' + filePath,
        saveToFiles: isCatalyst,
      })
        .catch(error => {
          console.log(error);
        })
        .finally(() => {
          RNFS.unlink(filePath);
        });
    } else if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE, {
        title: loc.send.permission_storage_title,
        message: loc.send.permission_storage_message,
        buttonNeutral: loc.send.permission_storage_later,
        buttonNegative: loc._.cancel,
        buttonPositive: loc._.ok,
      });

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Storage Permission: Granted');
        const filePath = RNFS.DownloadDirectoryPath + `/${fileName}`;
        try {
          await RNFS.writeFile(filePath, psbtB64);
          Alert.alert(loc.formatString(loc.send.txSaved, { filePath: fileName }));
        } catch (e) {
          console.log(e);
          Alert.alert(e.message);
        }
      } else {
        console.log('Storage Permission: Denied');
        Alert.alert(loc.send.permission_storage_title, loc.send.permission_storage_denied_message, [
          {
            text: loc.send.open_settings,
            onPress: () => {
              Linking.openSettings();
            },
            style: 'default',
          },
          { text: loc._.cancel, onPress: () => {}, style: 'cancel' },
        ]);
      }
    }
  };

  if (isLoading)
    return (
      <View style={[styles.rootPadding, stylesHook.rootPadding]}>
        <ActivityIndicator />
      </View>
    );

  if (txHex)
    return (
      <View style={[styles.rootPadding, stylesHook.rootPadding]}>
        <BlueCard style={[styles.hexWrap, stylesHook.hexWrap]}>
          <BlueText style={[styles.hexLabel, stylesHook.hexLabel]}>{loc.send.create_this_is_hex}</BlueText>
          {/* <TextInput style={[styles.hexInput, stylesHook.hexInput]} height={112} multiline editable value={txHex} /> */}

          <QRCode
            value={txHex}
            logo={require('../../img/qr-code.png')}
            size={height > width ? width - 40 : width / 2}
            logoSize={70}
            color="#000000"
            logoBackgroundColor={colors.brandingColor}
            backgroundColor="#FFFFFF"
            ecl="H"
          />
          <TouchableOpacity style={styles.hexTouch} onPress={() => Clipboard.setString(txHex)}>
            <Text style={[styles.hexText, stylesHook.hexText]}>{loc.send.create_copy}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.hexTouch} onPress={handleOnVerifyPressed}>
            <Text style={[styles.hexText, stylesHook.hexText]}>{loc.send.create_verify}</Text>
          </TouchableOpacity>
          <BlueSpacing20 />
          <SecondButton
            onPress={handleBroadcast}
            title={loc.send.confirm_sendNow}
            testID="PsbtWithHardwareWalletBroadcastTransactionButton"
          />
        </BlueCard>
      </View>
    );

  if (psbtHex)
    return (
      <SafeBlueArea style={[styles.root, stylesHook.root]}>
        <ScrollView centerContent contentContainerStyle={styles.scrollViewContent} testID="PsbtWithHardwareScrollView">
          <View style={styles.container}>
            <BlueCard>
              <BlueText testID="TextHelperForPSBT">{loc.send.psbt_this_is_psbt}</BlueText>
              <BlueSpacing20 />
              <Text testID="PSBTHex" style={styles.hidden}>
                {psbtHex}
              </Text>
              <DynamicQRCode value={psbtHex} capacity={200} />
              <BlueSpacing20 />
              <SecondButton
                testID="PsbtTxScanButton"
                icon={{
                  name: 'qrcode',
                  type: 'font-awesome',
                  color: colors.buttonTextColor,
                }}
                onPress={openScanner}
                title={loc.send.psbt_tx_scan}
              />
              <BlueSpacing20 />
              <BlueSpacing20 />
              <SecondButton
                icon={{
                  name: 'share-alternative',
                  type: 'entypo',
                  color: colors.buttonTextColor,
                }}
                onPress={exportPSBT}
                title={loc.send.psbt_tx_export}
              />
              <BlueSpacing20 />
              <View style={styles.copyToClipboard}>
                <BlueCopyToClipboardButton stringToCopy={psbtB64} displayText={loc.send.psbt_clipboard} />
              </View>
            </BlueCard>
          </View>
        </ScrollView>
      </SafeBlueArea>
    );

  return (
    <View style={[styles.rootPadding, stylesHook.rootPadding]}>
      <ActivityIndicator />
    </View>
  );
};

PsbtSign.navigationOptions = navigationStyle({
  title: loc.send.psbt_sign,
});

export default PsbtSign;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  rootPadding: {
    flex: 1,
    paddingTop: 20,
  },
  // activeQrcode: { borderWidth: 6, borderRadius: 8, borderColor: '#FFFFFF' },
  // scrollViewContent: {
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   flexGrow: 1,
  // },
  hexWrap: {
    alignItems: 'center',
    flex: 1,
  },
  hexLabel: {
    fontWeight: '500',
  },
  hexInput: {
    borderRadius: 4,
    marginTop: 20,
    fontWeight: '500',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 16,
  },
  hexTouch: {
    marginVertical: 24,
  },
  hexText: {
    fontSize: 15,
    fontWeight: '500',
    alignSelf: 'center',
  },
  copyToClipboard: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  hidden: {
    width: 0,
    height: 0,
  },
});
