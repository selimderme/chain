import React, { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { TabId } from './constants';

interface AccentProps { color?: string; }

/** A symmetric vector avoids platform-specific font baseline offsets. */
export const PlusIcon = React.memo(function PlusIcon({ color, size = 24 }: { color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" accessible={false} pointerEvents="none"><Path d="M12 5v14M5 12h14" /></Svg>;
});

/** Vector artwork stays crisp on both native screens and the web. */
export const NeonBackdrop = React.memo(function NeonBackdrop({ color = '#FFD600' }: AccentProps) {
  const id = useId().replace(/:/g, '');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 440 880" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.48" />
            <Stop offset="0.44" stopColor={color} stopOpacity="0.12" />
            <Stop offset="1" stopColor="#080908" stopOpacity="0" />
          </LinearGradient>
          <RadialGradient id={`${id}-orb`}>
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.5" stopColor={color} />
            <Stop offset="1" stopColor={color} stopOpacity="0.75" />
          </RadialGradient>
        </Defs>
        <Path d="M245 135 C350 8 495 60 472 215 C446 378 206 303 51 486 L-90 649 C104 364 408 431 439 225 C454 128 331 103 245 135Z" fill={`url(#${id}-ribbon)`} stroke={color} strokeOpacity="0.32" strokeWidth="0.6" />
        <Path d="M-72 594 C65 631 128 730 107 916 L-32 924 C50 775 1 738-72 704Z" fill={`url(#${id}-ribbon)`} stroke={color} strokeOpacity="0.5" strokeWidth="0.6" />
        <Path d="M330 920 C352 746 504 728 508 574 L544 731 C466 787 409 827 386 920Z" fill={`url(#${id}-ribbon)`} stroke={color} strokeOpacity="0.65" strokeWidth="0.7" />
        <Circle cx="353" cy="88" r="9" fill={`url(#${id}-orb)`} />
      </Svg>
    </View>
  );
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

export const HabitEmblem = React.memo(function HabitEmblem({ name, tab, emoji, size = 44 }: { name: string; tab: TabId; emoji?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: '#42423C', backgroundColor: '#181A17', alignItems: 'center', justifyContent: 'center', shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: -1 }, shadowOpacity: 0.1, shadowRadius: 5 }}><Text style={{ fontSize: size * 0.61 }}>{emoji || habitEmoji(name, tab)}</Text></View>;
});

export const CardSheen = React.memo(function CardSheen({ color = '#FFD600' }: AccentProps) {
  const id = `${useId().replace(/:/g, '')}-sheen`;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 20, overflow: 'hidden' }]}><Svg width="100%" height="100%"><Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.6"><Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.055" /><Stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0" /><Stop offset="0.86" stopColor={color} stopOpacity="0.12" /><Stop offset="1" stopColor="#FFFFFF" stopOpacity="0.015" /></LinearGradient></Defs><Rect width="100%" height="100%" fill={`url(#${id})`} /></Svg></View>;
});

export const AccentSheen = React.memo(function AccentSheen({ color = '#FFD600' }: AccentProps) {
  const id = `${useId().replace(/:/g, '')}-accent`;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 20, overflow: 'hidden' }]}><Svg width="100%" height="100%"><Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.7"><Stop offset="0" stopColor={color} stopOpacity="0.5" /><Stop offset="0.25" stopColor={color} stopOpacity="0.2" /><Stop offset="0.7" stopColor={color} stopOpacity="0" /><Stop offset="1" stopColor={color} stopOpacity="0.17" /></LinearGradient></Defs><Rect width="100%" height="100%" fill={`url(#${id})`} /></Svg></View>;
});
