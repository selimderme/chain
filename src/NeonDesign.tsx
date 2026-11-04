import React, { useId } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { TabId } from './constants';
import { NEON_BACKDROP_IMAGE } from './backdropAsset';

interface AccentProps { color?: string; isDark?: boolean; }

/** A symmetric vector avoids platform-specific font baseline offsets. */
export const PlusIcon = React.memo(function PlusIcon({ color, size = 24 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" accessible={false} pointerEvents="none"><Path d="M12 5v14M5 12h14" /></Svg>;
});

/** Vector artwork stays crisp on both native screens and the web. */
export const NeonBackdrop = React.memo(function NeonBackdrop({ isDark = true }: AccentProps) {
  const id = useId().replace(/:/g, '');
  if(isDark)return <View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:'#030C27',overflow:'hidden'}]}>
    {/* Deep navy with the reference's soft cyan ribbon and blue light at the edges. */}
    <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMin slice">
      <Defs>
        <LinearGradient id={id+'-dbase'} x1="0" y1="0" x2="0.35" y2="1"><Stop offset="0" stopColor="#030C27"/><Stop offset="0.2" stopColor="#041B4B"/><Stop offset="0.45" stopColor="#030B22"/><Stop offset="0.75" stopColor="#07102D"/><Stop offset="1" stopColor="#061434"/></LinearGradient>
        <RadialGradient id={id+'-ribbon'}><Stop offset="0" stopColor="#0068F3" stopOpacity=".8"/><Stop offset=".55" stopColor="#0951CA" stopOpacity=".3"/><Stop offset="1" stopColor="#0951CA" stopOpacity="0"/></RadialGradient>
        <RadialGradient id={id+'-core'}><Stop offset="0" stopColor="#00BEF0" stopOpacity=".72"/><Stop offset=".45" stopColor="#008BD9" stopOpacity=".3"/><Stop offset="1" stopColor="#008BD9" stopOpacity="0"/></RadialGradient>
        <RadialGradient id={id+'-side'}><Stop offset="0" stopColor="#0058D8" stopOpacity=".6"/><Stop offset="1" stopColor="#0058D8" stopOpacity="0"/></RadialGradient>
        <RadialGradient id={id+'-dviolet'}><Stop offset="0" stopColor="#163AC8" stopOpacity=".38"/><Stop offset="1" stopColor="#163AC8" stopOpacity="0"/></RadialGradient>
        <RadialGradient id={id+'-deep'}><Stop offset="0" stopColor="#020A24" stopOpacity=".55"/><Stop offset="1" stopColor="#020A24" stopOpacity="0"/></RadialGradient>
      </Defs>
      <Rect width="390" height="844" fill={'url(#'+id+'-dbase)'}/>
      <Ellipse cx="350" cy="150" rx="150" ry="120" fill={'url(#'+id+'-deep)'}/>
      <Ellipse cx="136" cy="70" rx="210" ry="70" transform="rotate(58 136 70)" fill={'url(#'+id+'-ribbon)'}/>
      <Ellipse cx="152" cy="96" rx="120" ry="24" transform="rotate(66 152 96)" fill={'url(#'+id+'-core)'}/>
      <Ellipse cx="17" cy="65" rx="130" ry="80" transform="rotate(30 17 65)" fill={'url(#'+id+'-side)'}/>
      <Ellipse cx="-10" cy="330" rx="150" ry="190" fill={'url(#'+id+'-side)'}/>
      <Ellipse cx="60" cy="640" rx="210" ry="170" fill={'url(#'+id+'-side)'} opacity=".55"/>
      <Ellipse cx="340" cy="720" rx="260" ry="210" fill={'url(#'+id+'-dviolet)'}/>
      <Ellipse cx="420" cy="460" rx="120" ry="200" fill={'url(#'+id+'-deep)'}/>
    </Svg>
    <Image source={NEON_BACKDROP_IMAGE} defaultSource={NEON_BACKDROP_IMAGE} fadeDuration={0} resizeMode="cover" style={[StyleSheet.absoluteFill,{width:'100%',height:'100%',opacity:.2}]}/>
  </View>;
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%" viewBox="0 0 440 900" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={id+'-base'} x1="0" y1="0" x2="0.8" y2="1"><Stop offset="0" stopColor={isDark?'#071943':'#EFF4FF'}/><Stop offset="0.5" stopColor={isDark?'#080F29':'#F6F7FF'}/><Stop offset="1" stopColor={isDark?'#171B48':'#E7F1FF'}/></LinearGradient>
        <RadialGradient id={id+'-blue'}><Stop offset="0" stopColor="#367DFF" stopOpacity={isDark ? .72 : .15}/><Stop offset="1" stopColor="#367DFF" stopOpacity="0"/></RadialGradient>
        <RadialGradient id={id+'-violet'}><Stop offset="0" stopColor="#8B5CF6" stopOpacity={isDark ? .44 : .13}/><Stop offset="1" stopColor="#8B5CF6" stopOpacity="0"/></RadialGradient>
        <LinearGradient id={id+'-beam'} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#48CBFF" stopOpacity="0"/><Stop offset="0.5" stopColor="#48CBFF" stopOpacity={isDark?.10:.04}/><Stop offset="1" stopColor="#48CBFF" stopOpacity="0"/></LinearGradient>
      </Defs>
      <Rect width="440" height="900" fill={'url(#'+id+'-base)'}/>
      <Circle cx="15" cy="80" r="220" fill={'url(#'+id+'-blue)'}/>
      <Circle cx="145" cy="160" r="130" fill={'url(#'+id+'-blue)'}/>
      <Circle cx="465" cy="650" r="360" fill={'url(#'+id+'-violet)'}/>
    </Svg>
  </View>;
});

export const CategoryIcon = React.memo(function CategoryIcon({ category, size = 27, color = '#FFD600' }: { category: TabId; size?: number } & AccentProps) {
  const gradientId = `${useId().replace(/:/g, '')}-icon`;
  const paths: Partial<Record<TabId, React.ReactNode>> = {
    beslenme: <><Path d="M5 15h26c0 9-5 14-13 14S5 24 5 15Z" fill={`url(#${gradientId})`} /><Path d="M8 12c2-5 5-5 8-1m3-2 3-4 4 3m-4 4 4-2 3 3M12 6l2-3 3 3" /></>,
    egzersiz: <><Path d="M12 18h12M8 10v16m4-19v22m12-22v22m4-19v16" strokeWidth="3.5" /><Path d="M4 14v8m28-8v8" strokeWidth="2" /></>,
    bakim: <><Path d="M18 4c-11 10-10 19 0 27C28 23 29 14 18 4Z" /><Path d="M18 13v16M13 20l5 5 5-5M8 15 2 13c0 12 5 18 16 18 11 0 16-6 16-18l-6 2" /></>,
    ogrenme: <><Path d="M18 8C11 3 6 5 3 6v24c5-2 10-1 15 2 5-3 10-4 15-2V6c-3-1-8-3-15 2Z" fill={`url(#${gradientId})`} strokeWidth="1" /><Path d="M18 8v24" stroke="#080908" strokeWidth="1.5" /></>,
    ibadet: <><Path d="M8 30V19h20v11M12 18c-4-7 6-8 6-14 0 6 10 7 6 14M3 30V12m30 18V12M16 30v-7h4v7" /><Path d="M3 8v1m30-1v1" /></>,
    'kotu-aliskanliklar': <><Circle cx="18" cy="18" r="13" /><Path d="m9 9 18 18" strokeWidth="3" /></>,
  };
  return <Svg width={size} height={size} viewBox="0 0 36 36" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><Defs><LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF" /><Stop offset="0.6" stopColor={color} /><Stop offset="1" stopColor={color} stopOpacity="0.75" /></LinearGradient></Defs>{paths[category]}</Svg>;
});

export function habitEmoji(name: string, tab: TabId): string {
  const text = name.toLocaleLowerCase('tr-TR');
  if (text.includes('protein')) return '🍳';
  if (text.includes('vitamin')) return '🍊';
  if (text.includes('kalori')) return '🔥';
  if (text.includes('su') && tab === 'beslenme') return '💧';
  if (text.includes('sebze') || text.includes('meyve')) return '🥗';
  return ({ beslenme: '🥑', egzersiz: '🏋️', bakim: '🌿', ogrenme: '📖', ibadet: '🌙', 'kotu-aliskanliklar': '🛡️' } as Partial<Record<TabId, string>>)[tab] || '🎯';
}

export const HabitEmblem = React.memo(function HabitEmblem({ name, tab, emoji, size = 44, isDark = true }: { name: string; tab: TabId; emoji?: string; size?: number; isDark?: boolean }) {
  return <View style={{ width: size, height: size, borderRadius: size * .3, borderWidth: 1, borderColor: isDark ? '#90B8FF45' : '#CBD7EF', backgroundColor: isDark ? '#6CA6FF18' : '#EDF3FF', alignItems: 'center', justifyContent: 'center', shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: -1 }, shadowOpacity: isDark ? 0.1 : 0, shadowRadius: 5 }}><Text style={{ fontSize: size * 0.61 }}>{emoji || habitEmoji(name, tab)}</Text></View>;
});

export const CardSheen = React.memo(function CardSheen({ color = '#FFD600' }: AccentProps) {
  const id = `${useId().replace(/:/g, '')}-sheen`;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 24, overflow: 'hidden' }]}><Svg width="100%" height="100%"><Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.6"><Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.055" /><Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0" /><Stop offset="0.86" stopColor={color} stopOpacity="0.12" /><Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.015" /></LinearGradient></Defs><Rect width="100%" height="100%" fill={`url(#${id})`} /></Svg></View>;
});

export const AccentSheen = React.memo(function AccentSheen({ color = '#FFD600' }: AccentProps) {
  const id = `${useId().replace(/:/g, '')}-accent`;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 20, overflow: 'hidden' }]}><Svg width="100%" height="100%"><Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.7"><Stop offset="0" stopColor={color} stopOpacity="0.5" /><Stop offset="0.25" stopColor={color} stopOpacity="0.2" /><Stop offset="0.7" stopColor={color} stopOpacity="0" /><Stop offset="1" stopColor={color} stopOpacity="0.17" /></LinearGradient></Defs><Rect width="100%" height="100%" fill={`url(#${id})`} /></Svg></View>;
});
