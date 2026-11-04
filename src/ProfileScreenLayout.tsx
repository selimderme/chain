import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { TabTheme } from './constants';
import { NeonBackdrop } from './NeonDesign';
import { GlassMaterial, GlowFill } from './AuroraGlass';
import { withAlpha } from './motion';

export default function ProfileScreenLayout({theme:t,title,backLabel,onBack,backdrop=true,children}:{theme:TabTheme;title:string;backLabel?:string;onBack?:()=>void;backdrop?:boolean;children:React.ReactNode}) {
  return <View style={{flex:1,backgroundColor:backdrop?t.bg:'transparent'}}>
    {backdrop&&<NeonBackdrop color={t.accent} isDark={t.isDark}/>}
    <View style={s.header}>
      {onBack ? <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={({pressed})=>[s.back,{backgroundColor:t.accentSoft,borderColor:withAlpha(t.isDark?'#80DFFF':t.accent,.72),shadowColor:'#008EFF',opacity:pressed?.75:1}]}>
        <GlassMaterial accent="#008EFF" radius={23} light={!t.isDark}/>
        {t.isDark&&<GlowFill color="#0077FF" radius={23}/>}
        <View pointerEvents="none" style={{position:'relative',zIndex:1,flexShrink:0}}><Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={t.isDark?'#E6F9FF':t.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="m14 5-7 7 7 7"/></Svg></View>
      </Pressable> : <View style={{width:46,height:46}}/>}
      <Text accessibilityRole="header" style={[s.title,{color:t.text}]}>{title}</Text><View style={{width:46}}/>
    </View>
    {children}
  </View>;
}
const s=StyleSheet.create({header:{width:'100%',maxWidth:728,alignSelf:'center',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingHorizontal:20,paddingTop:18,paddingBottom:18},back:{width:46,height:46,borderRadius:23,borderWidth:1,alignItems:'center',justifyContent:'center',shadowOffset:{width:0,height:0},shadowOpacity:.32,shadowRadius:14},title:{flex:1,textAlign:'center',fontSize:25,fontWeight:'700',letterSpacing:-.6}});
