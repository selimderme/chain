import React, { useState } from 'react';
import { View, Text, Image, Modal, Pressable, ActivityIndicator, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';
import { prepareProfilePhoto } from './profilePhotoStorage';
import { TabTheme } from './constants';
import { GlassMaterial, GlowFill } from './AuroraGlass';

export function PowerIcon({color, size = 20}: {color: string; size?: number}) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round"><Path d="M12 2v10M5.6 5.6a9 9 0 1 0 12.8 0" /></Svg>;
}

export default function ProfilePhoto({uri, initials, theme: t, english, onChange}: {
  uri?: string; initials: string; theme: TabTheme; english: boolean; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [previous, setPrevious] = useState('');
  const tr = (a: string, b: string) => english ? b : a;
  const choose = async () => {
    setError('');
    let pickedUri: string | undefined;
    try {
      const result = await DocumentPicker.getDocumentAsync({type: 'image/*', multiple: false, copyToCacheDirectory: true});
      if (result.canceled || !result.assets?.[0]) return;
      pickedUri = result.assets[0].uri;
      setBusy(true);
      const photoUri = await prepareProfilePhoto(result.assets[0].uri);
      onChange(photoUri); setPrevious(''); setOpen(false);
    } catch {
      setError(tr('Fotoğraf açılamadı. Başka bir görsel seçmeyi dene.', 'Unable to open this photo. Try another image.'));
    } finally {
      if (Platform.OS === 'web' && pickedUri?.startsWith('blob:')) URL.revokeObjectURL(pickedUri);
      setBusy(false);
    }
  };
  const action = (label: string, fn: () => void, danger = false) => <Pressable accessibilityRole="button" onPress={fn} disabled={busy}
    style={{padding: 15, borderWidth: 1, borderColor: danger ? '#EF7893' : '#79B8F76B', backgroundColor: t.isDark ? '#0B3A794A' : '#DCEEFF', borderRadius: 14, alignItems:'center'}}>
    <Text style={{color: danger ? '#EF7893' : t.isDark ? '#E7F7FF' : '#175391', fontWeight:'600'}}>{label}</Text></Pressable>;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={tr('Profil fotoğrafını yönet', 'Manage profile photo')} onPress={() => {setOpen(true); setError('');}}
      style={{width: 82, height: 82, borderRadius: 41, backgroundColor: t.isDark ? '#0A397E' : '#DBECFF', borderColor: '#8AD8FF', borderWidth: 1.5, shadowColor:'#008EFF',shadowOpacity:.3,shadowRadius:14,shadowOffset:{width:0,height:0},alignItems:'center', justifyContent:'center', marginBottom: 12}}>
      <GlassMaterial accent="#008EFF" radius={41} light={!t.isDark}/>
      {!uri&&<GlowFill color="#008EFF" radius={41}/>}
      <View pointerEvents="none" style={{position:'relative',zIndex:1}}>
        {uri ? <Image source={{uri}} accessibilityLabel={tr('Profil fotoğrafı', 'Profile photo')} style={{width:78, height:78, borderRadius:39}} /> : initials ?
          <Text style={{fontSize:27, fontWeight:'800', color:t.isDark?'#F4FBFF':'#175391'}}>{initials}</Text> :
          <Svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={t.isDark?'#F4FBFF':'#175391'} strokeWidth={1.6}><Circle cx={12} cy={8} r={4}/><Path d="M4 22v-2a8 8 0 0 1 16 0v2"/></Svg>}
      </View>
      <View pointerEvents="none" style={{position:'absolute',zIndex:2, right:-3, bottom:0, backgroundColor:t.isDark?'#0B3472':'#E2F1FF', borderColor:'#8AD8FF9C', borderWidth:1, padding:5, borderRadius:14}}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={t.isDark?'#D7F4FF':'#175391'} strokeWidth={1.8}><Path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><Circle cx={12} cy={13} r={4}/></Svg>
      </View>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={{flex:1, justifyContent:'center', alignItems:'center', padding:24}}>
        <Pressable accessibilityLabel={tr('Fotoğraf menüsünü kapat', 'Close photo menu')} onPress={() => !busy && setOpen(false)} style={{position:'absolute',inset:0,backgroundColor:'#00000080'}} />
        <View accessibilityViewIsModal style={{width:'100%',maxWidth:380,padding:22,gap:12,borderRadius:24,backgroundColor:t.isDark?'#0A1E44E8':'#F2F8FF',borderWidth:1,borderColor:'#7EC9FF80',overflow:'hidden'}}>
          <GlassMaterial accent="#008EFF" radius={24} light={!t.isDark}/>
          <Text style={{color:t.text,fontSize:20,fontWeight:'700',marginBottom:6}}>{tr('Profil fotoğrafı', 'Profile photo')}</Text>
          {busy ? <ActivityIndicator color="#4ACBFF" accessibilityLabel={tr('Fotoğraf hazırlanıyor', 'Preparing photo')} /> : action(uri ? tr('Fotoğrafı değiştir', 'Change photo') : tr('Fotoğraf ekle', 'Add photo'), choose)}
          {!!uri && action(tr('Fotoğrafı sil', 'Remove photo'), () => {setPrevious(uri); onChange('');}, true)}
          {!!previous && !uri && action(tr('Silmeyi geri al', 'Undo removal'), () => {onChange(previous); setPrevious('');})}
          {!!error && <Text accessibilityLiveRegion="polite" style={{color:'#EF526B'}}>{error}</Text>}
          {action(tr('Kapat', 'Close'), () => setOpen(false))}
        </View>
      </View>
    </Modal>
  </>;
}
