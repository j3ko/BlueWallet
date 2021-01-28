import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  View,
  TextInput,
  Alert,
  StatusBar,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  Platform,
  Text,
  LayoutAnimation,
  FlatList,
} from 'react-native';
import { Icon } from 'react-native-elements';
import { useFocusEffect, useNavigation, useRoute, useTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import RNFS from 'react-native-fs';
import BigNumber from 'bignumber.js';
import * as bitcoin from 'bitcoinjs-lib';

import loc from '../../loc';
import navigationStyle from '../../components/navigationStyle';
import { BlueStorageContext } from '../../blue_modules/storage-context';
import { isCatalyst, isMacCatalina } from '../../blue_modules/environment';
const fs = require('../../blue_modules/fs');

const PsbtSign = () => {
  const { wallets } = useContext(BlueStorageContext);
  const { colors } = useTheme();
  const route = useRoute();
  const { walletID } = route.params;
  const wallet = useMemo(() => wallets.find(item => item.getID() === walletID), []);
  const { navigate, setParams, goBack, pop } = useNavigation();
  const [psbtHex, setPsbtHex] = useState();

  const stylesHook = StyleSheet.create({
    root: {
      backgroundColor: colors.elevated,
    },
    rootPadding: {
      backgroundColor: colors.elevated,
    },
    // hexWrap: {
    //   backgroundColor: colors.elevated,
    // },
    // hexLabel: {
    //   color: colors.foregroundColor,
    // },
    // hexInput: {
    //   borderColor: colors.formBorder,
    //   backgroundColor: colors.inputBackgroundColor,
    //   color: colors.foregroundColor,
    // },
    // hexText: {
    //   color: colors.foregroundColor,
    // },
  });

  useEffect(() => {
    openScanner();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onBarScanned = ret => {
    if (ret && !ret.data) ret = { data: ret };
    let psbt;
    try {
      psbt = wallet.signPsbt(ret.data).psbt;
    } catch (Err) {
      Alert.alert(Err);
    }
    setPsbtHex(psbt.toHex());
  };

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
        },
      });
    }
  };

  if (!psbtHex)
    return (
      <View style={[styles.rootPadding, stylesHook.rootPadding]}>
        <ActivityIndicator />
      </View>
    );

  return (
    <View>
      <Text>asd</Text>
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
  // hexWrap: {
  //   alignItems: 'center',
  //   flex: 1,
  // },
  // hexLabel: {
  //   fontWeight: '500',
  // },
  // hexInput: {
  //   borderRadius: 4,
  //   marginTop: 20,
  //   fontWeight: '500',
  //   fontSize: 14,
  //   paddingHorizontal: 16,
  //   paddingBottom: 16,
  //   paddingTop: 16,
  // },
  // hexTouch: {
  //   marginVertical: 24,
  // },
  // hexText: {
  //   fontSize: 15,
  //   fontWeight: '500',
  //   alignSelf: 'center',
  // },
  // copyToClipboard: {
  //   justifyContent: 'center',
  //   alignItems: 'center',
  // },
  // hidden: {
  //   width: 0,
  //   height: 0,
  // },
});
