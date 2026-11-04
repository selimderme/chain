import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { AppDataState, TabTheme } from './constants';
import { preferences } from './profileModel';

type Props={state:AppDataState;theme:TabTheme;onSectionChange:(section:'stats'|'settings')=>void};
export default function ProfileHub({state,theme:t,onSectionChange}:Props) {
  const en=preferences(state).language==='en';
  const row=(key:'stats'|'settings')=><Pressable accessibilityRole="button" accessibilityLabel={key==='stats'?(en?'Statistics':'İstatistikler'):(en?'Settings':'Ayarlar')}
    onPress={()=>onSectionChange(key)} style={[s.row,{backgroundColor:t.surface,borderColor:t.cardBorderColor}]}>
    <Text style={{color:t.text,fontSize:16,fontWeight:'700'}}>{key==='stats'?(en?'Statistics':'İstatistikler'):(en?'Settings':'Ayarlar')}</Text>
    <Text style={{color:t.accent,fontSize:22}}>›</Text>
  </Pressable>;
  return <View style={{gap:14}}>{row('stats')}{row('settings')}</View>;
}
const s=StyleSheet.create({row:{width:'100%',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingHorizontal:20,paddingVertical:18,borderRadius:20,borderWidth:1}});
