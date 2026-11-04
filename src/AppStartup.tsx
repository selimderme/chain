import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import MainApp from './MainApp';
import { warmNeonBackdrop } from './backdropAsset';

export default function AppStartup() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    warmNeonBackdrop().catch(() => undefined).then(() => {
      if (mounted) setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  return ready ? <MainApp/> : <View accessibilityRole="progressbar" accessibilityLabel="Uygulama hazırlanıyor" style={{flex:1,backgroundColor:'#030C27',alignItems:'center',justifyContent:'center'}}>
    <ActivityIndicator color="#70D9FF"/>
  </View>;
}
