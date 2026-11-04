import React, {useId} from 'react';
import {View,Text,StyleSheet} from 'react-native';
import Svg,{Circle,Defs,LinearGradient,Path,Rect,Stop} from 'react-native-svg';
import {Habit,TabTheme} from './constants';
import {GlassMaterial,SoftButton} from './AuroraGlass';

export function auroraHabitColor(habit:Habit,index:number) {
  // The reference uses one cyan light across every card in a category.
  return '#00D9F5';
}
const GEAR='M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58ZM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2Z';
export function AuroraIcon({name,color,size=23}:{name:'home'|'stats'|'calendar'|'discover'|'settings'|'sun';color:string;size?:number}) {
  const id=useId().replace(/:/g,'');
  if(name==='sun')return <Svg width={size*1.18} height={size} viewBox="0 0 28 24" fill="none" strokeLinecap="round" accessible={false}>
    <Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#FFFFFF"/><Stop offset="1" stopColor={color}/></LinearGradient></Defs>
    <Path d="M8.2 16.2a5.8 5.8 0 0 1 11.6 0Z" fill={'url(#'+id+')'}/>
    <Path d="M14 3.2v2.6M6.3 6.4l1.8 1.8M21.7 6.4l-1.8 1.8M2.8 12.6h2.6M22.6 12.6h2.6" stroke={color} strokeWidth={2}/>
    <Path d="M3 18.6h22" stroke="#EAF8FF" strokeWidth={2}/><Path d="M8 21.8h12" stroke={color} strokeWidth={2} strokeOpacity=".8"/>
  </Svg>;
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false}>
    {name==='home'?<Path d="M11.3 3.3a1.1 1.1 0 0 1 1.4 0l7.6 6.3c.3.2.4.5.4.9v9.3c0 .6-.5 1.2-1.2 1.2h-4.3v-5.6a.8.8 0 0 0-.8-.8H9.6a.8.8 0 0 0-.8.8V21H4.5c-.7 0-1.2-.6-1.2-1.2v-9.3c0-.4.1-.7.4-.9Z" fill={color} stroke="none"/>
    :name==='stats'?<><Rect x={3.6} y={12} width={4.2} height={9} rx={1.3} fill={color} stroke="none"/><Rect x={9.9} y={3.5} width={4.2} height={17.5} rx={1.3} fill={color} stroke="none"/><Rect x={16.2} y={8} width={4.2} height={13} rx={1.3} fill={color} stroke="none"/></>
    :name==='discover'?<><Circle cx={12} cy={12} r={9}/><Path d="m15.8 8.2-2.2 5.4-5.4 2.2 2.2-5.4Z" fill={color} fillOpacity={.3}/><Circle cx={12} cy={12} r={1} fill={color} stroke="none"/></>
    :name==='calendar'?<><Rect x={3.5} y={5} width={17} height={15.5} rx={3}/><Path d="M8 3v4m8-4v4M3.5 10h17"/><Rect x={14} y={14} width={3} height={3} rx={.8} fill={color} stroke="none"/></>
    :<Path d={GEAR} fill={color} stroke="none"/>}
  </Svg>;
}

/** Line glyphs of the reference category bar. Returns null for categories that keep their own artwork. */
export function AuroraCategoryGlyph({category,color,size=18}:{category:string;color:string;size?:number}) {
  const glyph=({
    beslenme:<><Path d="M7 3v6.5a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V3M5 3v18"/><Path d="M17 21V3c-2.6 1.4-3.6 4.6-3.6 8.2 0 1.4.9 2.4 2.1 2.4H17"/></>,
    egzersiz:<Path d="M8.5 12h7M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4" strokeWidth={2.2}/>,
    bakim:<><Path d="M19.5 4.5C11 4.2 5 8.6 5 15.4c0 1.6.4 3 1.1 4.1 8.4.4 13.6-5.4 13.4-15Z"/><Path d="M6.1 19.5c2.8-4 6.2-7.2 10.2-9.8"/></>,
    ogrenme:<><Path d="M12 6.5C9.8 5 7 4.5 3.5 4.8v13.4c3.5-.3 6.3.2 8.5 1.8 2.2-1.6 5-2.1 8.5-1.8V4.8C17 4.5 14.2 5 12 6.5Z"/><Path d="M12 6.5V20"/></>,
  } as Record<string,React.ReactNode>)[category];
  if(!glyph)return null;
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" accessible={false} pointerEvents="none">{glyph}</Svg>;
}

/** Bright blue pill of the selected category / segmented tab. */
export function AuroraActivePill({radius=13,from='#008EFF',to='#0044E6'}:{radius?:number;from?:string;to?:string}) {
  const id=useId().replace(/:/g,'');
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{borderRadius:radius,overflow:'hidden'}]}><Svg width="100%" height="100%"><Defs>
    <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor={from}/><Stop offset="1" stopColor={to}/></LinearGradient>
    <LinearGradient id={id+'h'} x1="0%" y1="0%" x2="0%" y2="100%"><Stop offset="0" stopColor="#B6F4FF" stopOpacity=".3"/><Stop offset=".45" stopColor="#FFFFFF" stopOpacity="0"/><Stop offset="1" stopColor="#00D9FF" stopOpacity=".18"/></LinearGradient>
  </Defs><Rect width="100%" height="100%" rx={radius} fill={'url(#'+id+')'}/><Rect width="100%" height="100%" rx={radius} fill={'url(#'+id+'h)'}/></Svg></View>;
}

export function AuroraMoreDots({color='#C9D4EE'}:{color?:string}) {
  return <Svg width={18} height={6} viewBox="0 0 18 6" accessible={false} pointerEvents="none"><Circle cx={3} cy={3} r={1.7} fill={color}/><Circle cx={9} cy={3} r={1.7} fill={color}/><Circle cx={15} cy={3} r={1.7} fill={color}/></Svg>;
}

export function AuroraDock({theme:t,bottom,active,english,onHome,onStats,onDiscover,onSettings}:{theme:TabTheme;bottom:number;active:'home'|'stats'|'discover'|'settings'|null;english:boolean;onHome:()=>void;onStats:()=>void;onDiscover:()=>void;onSettings:()=>void}) {
  const entries=[['home',english?'Today':'Bugün',onHome],['stats',english?'Statistics':'İstatistikler',onStats],['discover',english?'Discover':'Keşfet',onDiscover],['settings',english?'Settings':'Ayarlar',onSettings]] as const;
  return <View style={[s.dock,{bottom:Math.max(10,bottom-14),backgroundColor:t.isDark?'#0C1E4C66':'#F5F9FF70'}]}>
    <GlassMaterial radius={26} accent="#008EFF" light={!t.isDark}/>
    {entries.map(([key,label,action])=>{const on=active===key;return <SoftButton key={key} accessibilityLabel={label} accessibilityState={{selected:on}} onPress={action} style={s.item}>
      <View style={s.icon}>{on&&<View pointerEvents="none" style={s.activeTile}><AuroraActivePill radius={13} from="#245DD4" to="#0B257F"/></View>}<View><AuroraIcon name={key} color={on&&t.isDark?'#FFFFFF':t.isDark?'#86A8E3':t.muted} size={22}/></View></View>
      <Text numberOfLines={1} style={{color:on&&t.isDark?'#FFFFFF':t.isDark?'#95B8E9':t.muted,fontSize:12,lineHeight:15,fontWeight:on?'700':'400',marginTop:4,...on&&t.isDark?{textShadowColor:'#2458FF',textShadowRadius:9,textShadowOffset:{width:0,height:0}}:{}}}>{label}</Text>
    </SoftButton>})}
  </View>;
}
const s=StyleSheet.create({dock:{position:'absolute',zIndex:40,width:'96%',maxWidth:728,alignSelf:'center',height:62,flexDirection:'row',paddingHorizontal:8,paddingVertical:6,borderRadius:26,shadowColor:'#005BFF',shadowOffset:{width:0,height:5},shadowOpacity:.2,shadowRadius:22,elevation:8},item:{flex:1,minWidth:0,borderRadius:16},activeTile:{position:'absolute',top:0,right:0,bottom:0,left:0,borderRadius:13,borderWidth:1,borderColor:'#94BFFF75',shadowColor:'#2666FF',shadowOpacity:.55,shadowRadius:12,shadowOffset:{width:0,height:0}},icon:{width:48,height:29,alignItems:'center',justifyContent:'center'}});
