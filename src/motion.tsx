/**
 * motion.tsx — Uygulama genelinde kullanılan, ek bağımlılık gerektirmeyen
 * (yalnızca React Native `Animated` + `LayoutAnimation`) animasyon yardımcıları.
 *
 * Tüm bileşenler iOS "Hareketi Azalt" (Reduce Motion) ayarına saygı duyar.
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

const USE_NATIVE = Platform.OS !== 'web';

// ───────── Hareketi Azalt (Reduce Motion) desteği ─────────
let reduceMotion = false;
try {
  AccessibilityInfo.isReduceMotionEnabled?.()
    .then((v) => {
      reduceMotion = !!v;
    })
    .catch(() => {});
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => {
    reduceMotion = !!v;
  });
} catch {
  // ignore
}
export const isReduceMotion = () => reduceMotion;

/** '#rrggbb' / '#rgb' rengine şeffaflık ekler. Diğer formatları olduğu gibi döndürür. */
export function withAlpha(color: string, alpha: number): string {
  if (!color || color[0] !== '#') return color;
  let hex = color.slice(1);
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (hex.length !== 6) return color;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Bir sonraki render'daki liste ekleme / silme / yer değiştirmeyi yumuşak animasyonla yapar. */
export function animateLayout(kind: 'spring' | 'ease' = 'spring') {
  if (Platform.OS === 'web' || reduceMotion) return;
  try {
    LayoutAnimation.configureNext(
      kind === 'spring'
        ? {
            duration: 340,
            create: { type: 'easeInEaseOut', property: 'opacity' },
            update: { type: 'spring', springDamping: 0.78 },
            delete: { type: 'easeInEaseOut', property: 'opacity' },
          }
        : LayoutAnimation.Presets.easeInEaseOut
    );
  } catch {
    // ignore
  }
}

// ───────── Giriş animasyonu (Fade + yukarı kayma, kademeli) ─────────
interface FadeSlideInProps {
  index?: number;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function FadeSlideIn({
  index = 0,
  delay = 0,
  distance = 6,
  style,
  children,
}: FadeSlideInProps) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      v.setValue(1);
      return;
    }
    const anim = Animated.timing(v, {
      toValue: 1,
      duration: 130,
      delay: delay + Math.min(index, 5) * 14,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE,
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({
            inputRange: [0, 1],
            outputRange: [0.86, 1],
            extrapolate: 'clamp',
          }),
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [Math.min(distance, 6), 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ───────── Basınca yaylı küçülen Pressable ─────────
type PressableScaleProps = PressableProps & {
  scaleTo?: number;
  containerStyle?: StyleProp<ViewStyle>;
};

export function PressableScale({
  scaleTo = 0.97,
  containerStyle,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const s = useRef(new Animated.Value(1)).current;
  const springTo = (val: number) =>
    Animated.spring(s, {
      toValue: val,
      friction: 6,
      tension: 260,
      useNativeDriver: USE_NATIVE,
    }).start();

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale: s }] }]}>
      <Pressable
        {...rest}
        onPressIn={(e) => {
          if (!reduceMotion) springTo(scaleTo);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          springTo(1);
          onPressOut?.(e);
        }}
      />
    </Animated.View>
  );
}

// ───────── Konfeti patlaması ─────────
interface ConfettiBurstProps {
  /** Her artışta yeni bir patlama tetiklenir (0 = kapalı). */
  trigger: number;
  colors: string[];
  count?: number;
  spread?: number;
  size?: number;
  duration?: number;
}

export function ConfettiBurst({
  trigger,
  colors,
  count = 16,
  spread = 90,
  size = 7,
  duration = 950,
}: ConfettiBurstProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(false);

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle =
          (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.7;
        const dist = spread * (0.55 + Math.random() * 0.45);
        const w = size * (0.7 + Math.random() * 0.6);
        const round = Math.random() > 0.6;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          color: colors[i % colors.length],
          rot: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360),
          w,
          h: round ? w : w * 1.6,
          round,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trigger]
  );

  useEffect(() => {
    if (!trigger || reduceMotion) return;
    setActive(true);
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: USE_NATIVE,
    });
    anim.start(({ finished }) => {
      if (finished) setActive(false);
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (!active) return null;

  const gravity = spread * 0.55;
  return (
    <View pointerEvents="none" style={motionStyles.burstLayer}>
      {particles.map((p, i) => (
        <Animated.View
          key={`${trigger}-${i}`}
          style={{
            position: 'absolute',
            width: p.w,
            height: p.h,
            borderRadius: p.round ? p.w / 2 : 1.5,
            backgroundColor: p.color,
            opacity: progress.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [1, 1, 0],
            }),
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, p.dx],
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 0.55, 1],
                  outputRange: [0, p.dy * 0.9, p.dy + gravity],
                }),
              },
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${p.rot}deg`],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 0.15, 1],
                  outputRange: [0.3, 1, 0.6],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

// ───────── İşaretlenince "pop" + dalga halkası (zincir hücresi / Bugün butonu) ─────────
interface MarkPopProps {
  mark: string;
  color?: string | null;
  radiusStyle?: StyleProp<ViewStyle>;
  ringScale?: number;
  /** Yeşil işaretlendiğinde küçük konfeti patlaması */
  burst?: boolean;
  burstColors?: string[];
  children?: React.ReactNode;
}

export function MarkPop({
  mark,
  color,
  radiusStyle,
  ringScale = 1.7,
  burst = false,
  burstColors,
  children,
}: MarkPopProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const prev = useRef(mark);
  const [ringActive, setRingActive] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (prev.current === mark) return;
    const was = prev.current;
    prev.current = mark;
    if (reduceMotion) return;

    if (mark) {
      setRingActive(true);
      scale.setValue(0.76);
      ring.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 200,
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(ring, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE,
        }),
      ]).start(({ finished }) => {
        if (finished) setRingActive(false);
      });
      if (burst && mark === 'g') setBurstKey((k) => k + 1);
    } else if (was) {
      scale.setValue(0.88);
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 210,
        useNativeDriver: USE_NATIVE,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mark]);

  return (
    <View>
      {ringActive && !!color && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            radiusStyle,
            {
              borderWidth: 2.5,
              borderColor: color,
              opacity: ring.interpolate({
                inputRange: [0, 0.08, 1],
                outputRange: [0, 0.85, 0],
              }),
              transform: [
                {
                  scale: ring.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, ringScale],
                  }),
                },
              ],
            },
          ]}
        />
      )}
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
      {burst && burstKey > 0 && (
        <ConfettiBurst
          trigger={burstKey}
          colors={burstColors || ['#22c55e', '#facc15', '#3b82f6', '#ec4899']}
          count={12}
          spread={46}
          size={5}
          duration={750}
        />
      )}
    </View>
  );
}

// ───────── Değer değişince zıplama (sekme emojisi, hero kutlaması) ─────────
interface PopOnChangeProps {
  value: unknown;
  /** false ise değer değişse bile animasyon oynatılmaz */
  when?: boolean;
  scaleTo?: number;
  lift?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function PopOnChange({
  value,
  when = true,
  scaleTo = 1.18,
  lift = 0,
  style,
  children,
}: PopOnChangeProps) {
  const v = useRef(new Animated.Value(0)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!when || reduceMotion) return;
    v.setValue(0);
    Animated.sequence([
      Animated.timing(v, {
        toValue: 1,
        duration: 140,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE,
      }),
      Animated.spring(v, {
        toValue: 0,
        friction: 4,
        tension: 140,
        useNativeDriver: USE_NATIVE,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            {
              scale: v.interpolate({
                inputRange: [0, 1],
                outputRange: [1, scaleTo],
              }),
            },
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -lift],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ───────── Yaylı ilerleme çubuğu + parıltı ─────────
interface AnimatedProgressBarProps {
  pct: number;
  fillColor: string;
  trackStyle?: StyleProp<ViewStyle>;
  shimmerColor?: string;
}

export function AnimatedProgressBar({
  pct,
  fillColor,
  trackStyle,
  shimmerColor,
}: AnimatedProgressBarProps) {
  const w = useRef(new Animated.Value(reduceMotion ? pct : 0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const [trackW, setTrackW] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      w.setValue(pct);
      return;
    }
    const anim = Animated.spring(w, {
      toValue: pct,
      friction: 9,
      tension: 45,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pct]);

  useEffect(() => {
    if (reduceMotion || !shimmerColor || trackW === 0) return;
    shimmer.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.delay(1400),
      ])
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackW, shimmerColor]);

  return (
    <View
      style={trackStyle}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={{
          height: '100%',
          borderRadius: 99,
          overflow: 'hidden',
          backgroundColor: fillColor,
          width: w.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
            extrapolate: 'clamp',
          }),
        }}
      >
        {!!shimmerColor && trackW > 0 && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 46,
              backgroundColor: shimmerColor,
              transform: [
                {
                  translateX: shimmer.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-60, trackW + 10],
                  }),
                },
                { skewX: '-20deg' },
              ],
            }}
          />
        )}
      </Animated.View>
    </View>
  );
}

// ───────── Sayı sayacı (örn. %0 → %80) ─────────
interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  style?: StyleProp<TextStyle>;
}

export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  duration = 650,
  style,
}: AnimatedNumberProps) {
  const anim = useRef(new Animated.Value(reduceMotion ? value : 0)).current;
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => anim.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(value);
      setDisplay(value);
      return;
    }
    const a = Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Text style={style}>
      {prefix}
      {display}
      {suffix}
    </Text>
  );
}

// ───────── Minimal ve Estetik Mikro-İkonlar (Micro-iconography) ─────────
export type MicroIconName =
  | 'flame'
  | 'trophy'
  | 'calendar'
  | 'timer'
  | 'repeat'
  | 'chart'
  | 'gear'
  | 'user'
  | 'sort';

interface MicroIconProps {
  name: MicroIconName;
  color: string;
  size?: number;
}

export function MicroIcon({ name, color, size = 13 }: MicroIconProps) {
  if (name === 'flame') {
    // Minimal modern alev ikonu (katmanlı damla formu)
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.68,
            height: size * 0.82,
            backgroundColor: color,
            borderTopLeftRadius: size * 0.5,
            borderTopRightRadius: size * 0.14,
            borderBottomLeftRadius: size * 0.42,
            borderBottomRightRadius: size * 0.42,
            transform: [{ rotate: '-12deg' }],
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: size * 0.12,
          }}
        >
          <View
            style={{
              width: size * 0.28,
              height: size * 0.34,
              borderRadius: size * 0.2,
              backgroundColor: 'rgba(255,255,255,0.78)',
            }}
          />
        </View>
      </View>
    );
  }

  if (name === 'trophy') {
    // Minimal modern kupa ikonu
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.64,
            height: size * 0.48,
            borderWidth: 1.5,
            borderColor: color,
            borderBottomLeftRadius: size * 0.32,
            borderBottomRightRadius: size * 0.32,
            borderTopLeftRadius: 2,
            borderTopRightRadius: 2,
          }}
        />
        <View
          style={{
            width: 1.5,
            height: size * 0.2,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            width: size * 0.48,
            height: 1.6,
            borderRadius: 1,
            backgroundColor: color,
          }}
        />
      </View>
    );
  }

  if (name === 'calendar') {
    // Minimal modern takvim ikonu
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.82,
            height: size * 0.78,
            borderRadius: 3,
            borderWidth: 1.4,
            borderColor: color,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: size * 0.22,
              backgroundColor: color,
              width: '100%',
            }}
          />
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-evenly',
            }}
          >
            <View
              style={{
                width: 2,
                height: 2,
                borderRadius: 1,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                width: 2,
                height: 2,
                borderRadius: 1,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  if (name === 'timer') {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 1.4,
            height: size * 0.28,
            backgroundColor: color,
            marginBottom: size * 0.08,
          }}
        />
      </View>
    );
  }

  if (name === 'repeat') {
    return (
      <View
        style={{
          width: size,
          height: size * 0.72,
          borderRadius: size * 0.36,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
    );
  }

  if (name === 'chart') {
    return (
      <View
        style={{
          width: size,
          height: size,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 1.8,
          paddingBottom: 1,
        }}
      >
        <View
          style={{
            width: 2.2,
            height: size * 0.38,
            borderRadius: 1,
            backgroundColor: color,
            opacity: 0.65,
          }}
        />
        <View
          style={{
            width: 2.2,
            height: size * 0.62,
            borderRadius: 1,
            backgroundColor: color,
            opacity: 0.85,
          }}
        />
        <View
          style={{
            width: 2.2,
            height: size * 0.86,
            borderRadius: 1,
            backgroundColor: color,
          }}
        />
      </View>
    );
  }

  if (name === 'gear') {
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: size * 0.78,
            height: size * 0.78,
            borderRadius: size * 0.39,
            borderWidth: 1.8,
            borderColor: color,
            borderStyle: 'dashed',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: size * 0.3,
              height: size * 0.3,
              borderRadius: size * 0.15,
              borderWidth: 1.5,
              borderColor: color,
            }}
          />
        </View>
      </View>
    );
  }

  if (name === 'user') {
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.5,
        }}
      >
        <View
          style={{
            width: size * 0.42,
            height: size * 0.42,
            borderRadius: size * 0.21,
            borderWidth: 1.6,
            borderColor: color,
          }}
        />
        <View
          style={{
            width: size * 0.74,
            height: size * 0.32,
            borderTopLeftRadius: size * 0.36,
            borderTopRightRadius: size * 0.36,
            borderWidth: 1.6,
            borderBottomWidth: 0,
            borderColor: color,
          }}
        />
      </View>
    );
  }

  // 'sort'
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2.2,
      }}
    >
      <View
        style={{
          width: size * 0.82,
          height: 1.6,
          borderRadius: 1,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: size * 0.58,
          height: 1.6,
          borderRadius: 1,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: size * 0.36,
          height: 1.6,
          borderRadius: 1,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// ───────── Yumuşak Gradyan Katmanı (Soft Gradient Sheen) ─────────
export function SoftGradientOverlay({
  startColor = 'rgba(255,255,255,0.18)',
  endColor = 'rgba(0,0,0,0.12)',
  borderRadius = 20,
}: {
  startColor?: string;
  endColor?: string;
  borderRadius?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius,
          overflow: 'hidden',
        },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          top: -30,
          left: -20,
          width: '75%',
          height: '85%',
          borderRadius: 999,
          backgroundColor: startColor,
          opacity: 0.55,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -35,
          right: -20,
          width: '70%',
          height: '80%',
          borderRadius: 999,
          backgroundColor: endColor,
          opacity: 0.45,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 12,
          right: 12,
          height: 1,
          backgroundColor: 'rgba(255,255,255,0.28)',
        }}
      />
    </View>
  );
}

// ───────── Zincir simgesi: 3+ gün serisinde nabız atan minimal alev ─────────
interface StreakIconProps {
  streak: number;
  threshold?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function StreakIcon({
  streak,
  threshold = 3,
  color = '#F26B27',
}: StreakIconProps) {
  const v = useRef(new Animated.Value(0)).current;
  const hot = streak >= threshold;

  useEffect(() => {
    if (!hot || reduceMotion) {
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hot]);

  return (
    <Animated.View
      style={{
        transform: [
          {
            scale: v.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 1.18],
            }),
          },
        ],
      }}
    >
      <MicroIcon
        name="flame"
        size={13}
        color={streak > 0 ? color : 'rgba(148,163,184,0.7)'}
      />
    </Animated.View>
  );
}

// ───────── Animasyonlu yuvarlak onay kutusu (Görevler) ─────────
interface AnimatedCheckCircleProps {
  checked: boolean;
  color: string;
  borderColor: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  tickStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

export function AnimatedCheckCircle({
  checked,
  color,
  borderColor,
  onPress,
  style,
  tickStyle,
  accessibilityLabel,
}: AnimatedCheckCircleProps) {
  const v = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      v.setValue(checked ? 1 : 0);
      return;
    }
    Animated.spring(v, {
      toValue: checked ? 1 : 0,
      friction: 5,
      tension: 220,
      useNativeDriver: USE_NATIVE,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);

  const clamped = v.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <PressableScale
      scaleTo={0.82}
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      style={[
        style,
        {
          borderColor: checked ? color : borderColor,
          overflow: 'hidden',
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: color,
            borderRadius: 999,
            opacity: clamped,
            transform: [{ scale: v }],
          },
        ]}
      />
      <Animated.Text
        style={[tickStyle, { opacity: clamped, transform: [{ scale: v }] }]}
      >
        ✓
      </Animated.Text>
    </PressableScale>
  );
}

// ───────── Modal kartı: açılırken yaylı büyüme ─────────
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SheetPressableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
};

export function SheetPressable({ style, ...rest }: SheetPressableProps) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const anim = Animated.spring(v, {
      toValue: 1,
      friction: 7,
      tension: 110,
      useNativeDriver: USE_NATIVE,
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AnimatedPressable
      {...rest}
      style={[
        style,
        {
          opacity: v.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1],
            extrapolate: 'clamp',
          }),
          transform: [
            {
              scale: v.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1],
              }),
            },
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [24, 0],
              }),
            },
          ],
        },
      ]}
    />
  );
}

// ───────── Tema değişince ekran rengi yumuşak geçiş (Anlık, gecikmesiz) ─────────
export function ThemeCrossfade(_props: { color: string }) {
  return null;
}

// ───────── Boş durum için süzülen emoji ─────────
export function FloatingEmoji({
  emoji,
  style,
}: {
  emoji: string;
  style?: StyleProp<TextStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.Text
      style={[
        { fontSize: 40, marginBottom: 8 },
        style,
        {
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -8],
              }),
            },
            {
              rotate: v.interpolate({
                inputRange: [0, 1],
                outputRange: ['-4deg', '4deg'],
              }),
            },
          ],
        },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
}

// ───────── Akışkan 3B Metalik Zincir Halkası + Lazer Enerji Dalgası ─────────
interface ChainLinkProps {
  active: boolean;
  color: string;
  trackColor: string;
  width: number;
  height?: number;
  delay?: number;
  /** Gün sırası (1..31): Lazer dalgasının zincir boyunca soldan sağa sırayla akmasını sağlar */
  stepIndex?: number;
  style?: StyleProp<ViewStyle>;
}

function ChainLinkJustActivated({
  children,
}: {
  children: React.ReactNode;
}) {
  const clasp = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(clasp, {
      toValue: 1,
      friction: 5,
      tension: 220,
      useNativeDriver: USE_NATIVE,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scale = clasp.interpolate({
    inputRange: [0, 1],
    outputRange: [0.65, 1],
  });
  return (
    <Animated.View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        opacity: clasp,
        transform: [{ scale }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export const ChainLink = React.memo(function ChainLink({
  active,
  color,
  trackColor,
  width,
  height = 18,
  style,
}: ChainLinkProps) {
  const hadInactiveRender = useRef(!active);
  if (!active) {
    hadInactiveRender.current = true;
  }

  const isCompact = height < 15;
  const bridgeW = isCompact
    ? Math.max(11, width + 6)
    : Math.max(20, width + 14);
  const bridgeH = isCompact ? Math.max(10, height) : Math.max(18, height);

  if (!active) {
    return (
      <View
        pointerEvents="none"
        style={[
          {
            width,
            height: bridgeH,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 15,
          },
          style,
        ]}
      >
        <View
          style={{
            width: Math.max(3, width - 1),
            height: isCompact ? 2 : 2.5,
            borderRadius: 99,
            backgroundColor: trackColor,
          }}
        />
      </View>
    );
  }

  const isBlue = color === '#3b82f6';
  const ringShadow = isBlue
    ? 'rgba(30, 58, 138, 0.32)'
    : 'rgba(6, 95, 70, 0.32)';
  const ringMain = isBlue ? '#3b82f6' : '#10b981';
  const ringMid = isBlue ? '#60a5fa' : '#34d399';
  const ringHighlight = isBlue ? '#dbeafe' : '#d1fae5';
  const coreGlow = isBlue
    ? 'rgba(59, 130, 246, 0.28)'
    : 'rgba(16, 185, 129, 0.28)';

  const chainContent = (
    <View
      style={{
        width: bridgeW,
        height: bridgeH,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 1) Yumuşak 3B enerji halesi */}
      <View
        style={{
          position: 'absolute',
          width: bridgeW,
          height: isCompact ? 6 : 10,
          borderRadius: 99,
          backgroundColor: coreGlow,
        }}
      />

      {/* 2) Parlak enerji bağlantı kanalı */}
      <View
        style={{
          position: 'absolute',
          width: Math.max(6, bridgeW - (isCompact ? 3 : 5)),
          height: isCompact ? 3 : 4.5,
          borderRadius: 99,
          backgroundColor: ringMain,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: '78%',
            height: isCompact ? 1.1 : 1.6,
            borderRadius: 99,
            backgroundColor: '#ffffff',
            opacity: 0.92,
          }}
        />
      </View>

      {/* 3) Birbirine Geçen 3B Metalik Halkalar (Kusursuz Yuvarlak Köşeli SVG) */}
      <Svg width={bridgeW} height={bridgeH} viewBox="0 0 28 20">
        {/* Sol Halka Gölgesi + Gövdesi + Parlaması */}
        <Rect
          x="2.0"
          y="5.6"
          width="13.8"
          height="9.6"
          rx="4.8"
          stroke={ringShadow}
          strokeWidth="2.8"
          fill="none"
        />
        <Rect
          x="2.0"
          y="4.9"
          width="13.8"
          height="9.6"
          rx="4.8"
          stroke={ringMain}
          strokeWidth="2.5"
          fill="none"
        />
        <Path
          d="M 5.8 5.0 H 11.2 A 4.0 4.0 0 0 1 14.4 7.0"
          stroke={ringHighlight}
          strokeWidth="1.05"
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx="3.4" cy="9.7" r="1.35" fill="#ffffff" />

        {/* Sağ Halka Gölgesi + Gövdesi + Parlaması */}
        <Rect
          x="12.2"
          y="5.6"
          width="13.8"
          height="9.6"
          rx="4.8"
          stroke={ringShadow}
          strokeWidth="2.8"
          fill="none"
        />
        <Rect
          x="12.2"
          y="4.9"
          width="13.8"
          height="9.6"
          rx="4.8"
          stroke={ringMain}
          strokeWidth="2.5"
          fill="none"
        />
        <Path
          d="M 16.6 5.0 H 22.0 A 4.0 4.0 0 0 1 25.2 7.0"
          stroke={ringHighlight}
          strokeWidth="1.05"
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx="24.6" cy="9.7" r="1.35" fill="#ffffff" />

        {/* Üstten Geçen 3B Kesişim Köprüsü (Gerçek Zincir Kenetlenmesi) */}
        <Path
          d="M 10.6 4.9 H 12.2 A 4.7 4.7 0 0 1 15.8 9.6"
          stroke={ringMid}
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M 10.8 5.0 H 12.2 A 4.3 4.3 0 0 1 15.0 7.5"
          stroke="#ffffff"
          strokeWidth="0.95"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );

  return (
    <View
      pointerEvents="none"
      style={[
        {
          width,
          height: bridgeH,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          zIndex: 15,
        },
        style,
      ]}
    >
      {hadInactiveRender.current && !reduceMotion && !isCompact ? (
        <ChainLinkJustActivated>{chainContent}</ChainLinkJustActivated>
      ) : (
        chainContent
      )}
    </View>
  );
});

// ───────── 3B / Parçacıklı Yörünge Kıvılcımlı Zamanlayıcı Halkası (ProgressRing) ─────────
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
let progressRingUidCounter = 0;

interface ProgressRingProps {
  /** 0..100 */
  progress: number;
  size: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  duration?: number;
  /** Çalışırken hafifçe nefes alıyormuş gibi büyüsün ve yörünge kıvılcımları parlasın */
  pulse?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ProgressRing({
  progress,
  size,
  strokeWidth = 12,
  color,
  trackColor,
  duration = 900,
  pulse = false,
  children,
  style,
}: ProgressRingProps) {
  const anim = useRef(new Animated.Value(progress)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  // Dış hale (strokeWidth + 6) ve yörünge kıvılcımının SVG sınırlarında kesilmemesi için iç boşluk
  const outerPad = 8;
  const radius = Math.max(1, (size - strokeWidth) / 2 - outerPad);
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(progress);
      return;
    }
    const a = Animated.timing(anim, {
      toValue: progress,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, duration]);

  useEffect(() => {
    if (!pulse || reduceMotion) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 680,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 680,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse]);

  const dashOffset = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
    extrapolate: 'clamp',
  });

  // Yörünge kuyruklu yıldız kolu (0% -> 0deg, 100% -> 360deg)
  const orbitRotate = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'clamp',
  });

  const orbitVisible = anim.interpolate({
    inputRange: [0, 1, 99.5, 100],
    outputRange: [0, 1, 1, 0.9],
    extrapolate: 'clamp',
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.022],
  });

  const sparkScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.32],
  });

  const sparkTailOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  const tipCenterOffset = size / 2 - radius;

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pulseScale }],
        },
        style,
      ]}
    >
      {/* 3B Derinlikli Çember ve Parlak İlerleme */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ rotate: '-90deg' }] },
        ]}
      >
        <Svg width={size} height={size}>
          {/* Dış hafif 3B enerji halesi */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={withAlpha(color, pulse ? 0.16 : 0.07)}
            strokeWidth={strokeWidth + 6}
            fill="none"
          />
          {/* Ana oluk */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* İlerleme Yay Çizgisi */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset as unknown as number}
          />
        </Svg>
      </View>

      {/* Çemberin Ucunda Dönen 3B Yörünge Kıvılcımı ve Kuyruk Parçacıkları */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            alignItems: 'center',
            opacity: orbitVisible,
            transform: [{ rotate: orbitRotate }],
          },
        ]}
      >
        {/* Ana Yörünge Plazma Çekirdeği (Saat 12 noktasından başlayıp yay ucuyla döner) */}
        <Animated.View
          style={{
            position: 'absolute',
            top: tipCenterOffset - 8,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: withAlpha(color, 0.42),
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: sparkScale }],
          }}
        >
          <View
            style={{
              width: 9,
              height: 9,
              borderRadius: 4.5,
              backgroundColor: '#ffffff',
              borderWidth: 1.8,
              borderColor: color,
            }}
          />
        </Animated.View>

        {/* Yörünge Kuyruk Kıvılcımları (Çember yayı boyunca geriden takip eden 3 kıvılcım) */}
        {pulse && (
          <Animated.View
            style={{
              position: 'absolute',
              top: tipCenterOffset - 3,
              opacity: sparkTailOpacity,
              transform: [{ translateX: -11 }, { translateY: 2 }],
            }}
          >
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: '#fde047',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: -7,
                top: 3,
                width: 3.6,
                height: 3.6,
                borderRadius: 1.8,
                backgroundColor: '#ffffff',
                opacity: 0.85,
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: -13,
                top: 7,
                width: 2.6,
                height: 2.6,
                borderRadius: 1.3,
                backgroundColor: color,
                opacity: 0.7,
              }}
            />
          </Animated.View>
        )}
      </Animated.View>

      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </Animated.View>
  );
}

// ───────── Görev tamamlanırken satırı yumuşakça sağa kaydırıp söndür ─────────
interface TaskRowMotionProps {
  completing: boolean;
  children?: React.ReactNode;
}

export function TaskRowMotion({
  completing,
  children,
}: TaskRowMotionProps) {
  const v = useRef(new Animated.Value(completing ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      v.setValue(completing ? 1 : 0);
      return;
    }
    const anim = Animated.timing(v, {
      toValue: completing ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completing]);

  return (
    <Animated.View
      style={{
        opacity: v.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.52],
        }),
        transform: [
          {
            translateX: v.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 12],
            }),
          },
          {
            scale: v.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.985],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ───────── GitHub tarzı aktivite ısı haritası ─────────
export interface HeatmapDay {
  key: string;
  /** 0..1 arası tamamlanma oranı */
  ratio: number;
  future?: boolean;
  today?: boolean;
}

interface ActivityHeatmapProps {
  weeks: HeatmapDay[][];
  color: string;
  trackColor: string;
  todayColor: string;
  cellGap?: number;
  cellRadius?: number;
  accessibilityLabel?: string;
}

export function ActivityHeatmap({
  weeks,
  color,
  trackColor,
  todayColor,
  cellGap = 4,
  cellRadius = 3,
  accessibilityLabel,
}: ActivityHeatmapProps) {
  return (
    <View
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', gap: cellGap, alignItems: 'stretch' }}
    >
      {weeks.map((week, wi) => (
        <FadeSlideIn
          key={`week-${wi}`}
          index={wi}
          distance={4}
          style={{ flex: 1 }}
        >
          <View style={{ gap: cellGap }}>
            {week.map((day) => {
              const intensity = day.future
                ? 0
                : Math.max(0, Math.min(1, day.ratio));
              return (
                <View
                  key={day.key}
                  style={{
                    width: '100%',
                    aspectRatio: 1,
                    borderRadius: cellRadius,
                    backgroundColor:
                      intensity > 0
                        ? withAlpha(color, 0.22 + intensity * 0.78)
                        : trackColor,
                    borderWidth: day.today ? 1.5 : 0,
                    borderColor: day.today ? todayColor : 'transparent',
                    opacity: day.future ? 0.35 : 1,
                  }}
                />
              );
            })}
          </View>
        </FadeSlideIn>
      ))}
    </View>
  );
}

// ───────── 3B Küresel Sıvı Dolum (Liquid Wave) Animasyonu ─────────
let liquidWaveUidCounter = 0;

const LIQUID_BUBBLES = [
  { leftPct: 0.24, size: 7, startY: 120, endY: 18, phase: 0 },
  { leftPct: 0.42, size: 5.5, startY: 135, endY: 28, phase: 0.25 },
  { leftPct: 0.58, size: 8.5, startY: 140, endY: 14, phase: 0.5 },
  { leftPct: 0.73, size: 6, startY: 125, endY: 24, phase: 0.72 },
  { leftPct: 0.36, size: 4.5, startY: 110, endY: 32, phase: 0.88 },
];

interface LiquidWaveGaugeProps {
  /** 0..100 arası doluluk yüzdesi */
  pct: number;
  currentValue: number;
  targetValue: number;
  unitText?: string;
  habitName?: string;
  accentColor: string;
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  size?: number;
}

export function LiquidWaveGauge({
  pct,
  currentValue,
  targetValue,
  unitText = '',
  habitName = '',
  accentColor,
  isDark,
  textColor,
  mutedColor,
  size = 188,
}: LiquidWaveGaugeProps) {
  const uidRef = useRef(`lw3d-${++liquidWaveUidCounter}`).current;
  const clampedPct = Math.max(0, Math.min(100, pct));

  const levelAnim = useRef(new Animated.Value(clampedPct)).current;
  const waveFront = useRef(new Animated.Value(0)).current;
  const waveBack = useRef(new Animated.Value(0)).current;
  const sloshTilt = useRef(new Animated.Value(0)).current;
  const prevPct = useRef(clampedPct);

  // Su / sıvı temalı alışkanlıklarda okyanus mavisi, tamamlandığında zümrüt yeşili
  const lowerInfo = `${habitName} ${unitText}`.toLocaleLowerCase('tr-TR');
  const isWaterLike =
    lowerInfo.includes('su') ||
    lowerInfo.includes('ml') ||
    lowerInfo.includes('litre') ||
    lowerInfo.includes('süt') ||
    lowerInfo.includes('çay') ||
    lowerInfo.includes('kahve');

  const isComplete = clampedPct >= 100;
  const primaryColor = isComplete
    ? '#10b981'
    : isWaterLike
    ? '#0ea5e9'
    : accentColor;
  const crestColor = isComplete
    ? '#6ee7b7'
    : isWaterLike
    ? '#7dd3fc'
    : '#ffffff';
  const deepColor = isComplete
    ? '#047857'
    : isWaterLike
    ? '#0369a1'
    : withAlpha(accentColor, 0.88);

  // Sıvı seviyesi değiştiğinde yay fiziğiyle yükselir + hafif çalkalanma (slosh) eğimi yapar
  useEffect(() => {
    const changed = prevPct.current !== clampedPct;
    prevPct.current = clampedPct;

    if (reduceMotion) {
      levelAnim.setValue(clampedPct);
      return;
    }

    Animated.spring(levelAnim, {
      toValue: clampedPct,
      friction: 7,
      tension: 52,
      useNativeDriver: USE_NATIVE,
    }).start();

    if (changed) {
      sloshTilt.setValue(0);
      Animated.sequence([
        Animated.timing(sloshTilt, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(sloshTilt, {
          toValue: -0.7,
          duration: 210,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.spring(sloshTilt, {
          toValue: 0,
          friction: 5,
          tension: 90,
          useNativeDriver: USE_NATIVE,
        }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clampedPct]);

  // Sürekli akıcı çift katmanlı 3B dalga hareketi (native UI thread)
  useEffect(() => {
    if (reduceMotion) return;
    waveFront.setValue(0);
    waveBack.setValue(0);

    const frontLoop = Animated.loop(
      Animated.timing(waveFront, {
        toValue: 1,
        duration: 2100,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE,
      })
    );
    const backLoop = Animated.loop(
      Animated.timing(waveBack, {
        toValue: 1,
        duration: 2950,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE,
      })
    );
    frontLoop.start();
    backLoop.start();
    return () => {
      frontLoop.stop();
      backLoop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 0% -> size * 0.94 (en altta), 100% -> -10 (tam dolu)
  const fillTranslateY = levelAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [size * 0.93, -10],
    extrapolate: 'clamp',
  });

  const frontWaveX = waveFront.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -size],
  });

  const backWaveX = waveBack.interpolate({
    inputRange: [0, 1],
    outputRange: [-size, 0],
  });

  const sloshRotate = sloshTilt.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-6deg', '0deg', '6deg'],
  });

  // 2 periyotlu kesintisiz sinüs dalgası yolu (genişlik = size * 2)
  const wavePaths = useMemo(() => {
    const w = size;
    const h = size + 36;
    const amp = 9;
    const y0 = 14;
    const frontD = [
      `M 0 ${y0}`,
      `Q ${w * 0.25} ${y0 - amp}, ${w * 0.5} ${y0}`,
      `T ${w} ${y0}`,
      `Q ${w * 1.25} ${y0 - amp}, ${w * 1.5} ${y0}`,
      `T ${w * 2} ${y0}`,
      `L ${w * 2} ${h}`,
      `L 0 ${h} Z`,
    ].join(' ');

    const backD = [
      `M 0 ${y0 + 3}`,
      `Q ${w * 0.25} ${y0 + 3 + amp * 0.95}, ${w * 0.5} ${y0 + 3}`,
      `T ${w} ${y0 + 3}`,
      `Q ${w * 1.25} ${y0 + 3 + amp * 0.95}, ${w * 1.5} ${y0 + 3}`,
      `T ${w * 2} ${y0 + 3}`,
      `L ${w * 2} ${h}`,
      `L 0 ${h} Z`,
    ].join(' ');

    const crestD = [
      `M 0 ${y0}`,
      `Q ${w * 0.25} ${y0 - amp}, ${w * 0.5} ${y0}`,
      `T ${w} ${y0}`,
      `Q ${w * 1.25} ${y0 - amp}, ${w * 1.5} ${y0}`,
      `T ${w * 2} ${y0}`,
    ].join(' ');

    return { frontD, backD, crestD, totalH: h };
  }, [size]);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignSelf: 'center',
        marginVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Dış 3B Küre Halesi */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size + 10,
          height: size + 10,
          borderRadius: (size + 10) / 2,
          borderWidth: 1.5,
          borderColor: withAlpha(primaryColor, isDark ? 0.28 : 0.22),
          backgroundColor: withAlpha(primaryColor, isDark ? 0.06 : 0.04),
        }}
      />

      {/* 3B Cam Küre Haznesi */}
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: isDark
            ? 'rgba(15, 23, 42, 0.72)'
            : 'rgba(241, 245, 249, 0.85)',
          borderWidth: 2.2,
          borderColor: withAlpha(primaryColor, 0.48),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Yükselen & Çalkalanan Sıvı Katmanı */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: wavePaths.totalH,
            transform: [
              { translateY: fillTranslateY },
              { rotate: sloshRotate },
            ],
          }}
        >
          {/* 1) Arka Derinlik Dalgası */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: size * 2,
              height: wavePaths.totalH,
              opacity: 0.46,
              transform: [{ translateX: backWaveX }],
            }}
          >
            <Svg width={size * 2} height={wavePaths.totalH}>
              <Path d={wavePaths.backD} fill={primaryColor} />
            </Svg>
          </Animated.View>

          {/* 2) Ön 3B Gradyan Sıvı Dalgası + Parlak Köpük Sırtı */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: size * 2,
              height: wavePaths.totalH,
              transform: [{ translateX: frontWaveX }],
            }}
          >
            <Svg width={size * 2} height={wavePaths.totalH}>
              <Defs>
                <LinearGradient
                  id={`${uidRef}-liq`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.92" />
                  <Stop offset="55%" stopColor={primaryColor} stopOpacity="0.98" />
                  <Stop offset="100%" stopColor={deepColor} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Path d={wavePaths.frontD} fill={`url(#${uidRef}-liq)`} />
              <Path
                d={wavePaths.crestD}
                stroke={crestColor}
                strokeWidth="2"
                fill="none"
                opacity="0.78"
              />
            </Svg>
          </Animated.View>

          {/* 3) Sıvı İçinde Yükselen 3B Hava Kabarcıkları */}
          {clampedPct > 8 &&
            LIQUID_BUBBLES.map((b, i) => {
              const bubbleY = waveBack.interpolate({
                inputRange: [0, 1],
                outputRange: [b.startY, b.endY],
              });
              const bubbleOpacity = waveBack.interpolate({
                inputRange: [0, 0.2, 0.85, 1],
                outputRange: [0, 0.65, 0.55, 0],
              });
              return (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: size * b.leftPct,
                    width: b.size,
                    height: b.size,
                    borderRadius: b.size / 2,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.75)',
                    backgroundColor: 'rgba(255,255,255,0.28)',
                    opacity: bubbleOpacity,
                    transform: [{ translateY: bubbleY }],
                  }}
                />
              );
            })}
        </Animated.View>

        {/* 3B Cam Küre Üst Sol Işık Yansıması (Specular Glass Highlight) */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 10,
            left: 18,
            width: size * 0.36,
            height: size * 0.16,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.22)',
            transform: [{ rotate: '-28deg' }],
          }}
        />

        {/* Merkezdeki Okunaklı Değer & Yüzde Göstergesi */}
        <View
          pointerEvents="none"
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 12,
            zIndex: 5,
          }}
        >
          <Text
            style={{
              fontSize: 30,
              fontWeight: '900',
              color: clampedPct > 54 ? '#ffffff' : textColor,
              fontVariant: ['tabular-nums'],
              textShadowColor:
                clampedPct > 54 ? 'rgba(0,0,0,0.38)' : 'transparent',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
            }}
          >
            {currentValue}
          </Text>
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '700',
              color:
                clampedPct > 58 ? 'rgba(255,255,255,0.92)' : mutedColor,
              marginTop: 1,
            }}
          >
            / {targetValue} {unitText}
          </Text>
          <View
            style={{
              marginTop: 6,
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 99,
              backgroundColor:
                clampedPct > 54
                  ? 'rgba(0,0,0,0.24)'
                  : withAlpha(primaryColor, 0.15),
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: clampedPct > 54 ? '#ffffff' : primaryColor,
              }}
            >
              %{clampedPct} {isComplete ? '✓' : ''}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ───────── Tam Ekran 3B Havai Fişek & Kutlama Patlaması (FireworksCelebration) ─────────
interface FireworkBurstConfig {
  cxPct: number;
  cyPct: number;
  startAt: number;
  endAt: number;
  ringColor: string;
}

const FIREWORK_BURSTS: FireworkBurstConfig[] = [
  { cxPct: 0.5, cyPct: 0.34, startAt: 0.0, endAt: 0.78, ringColor: '#fde047' },
  { cxPct: 0.24, cyPct: 0.26, startAt: 0.14, endAt: 0.9, ringColor: '#38bdf8' },
  { cxPct: 0.76, cyPct: 0.28, startAt: 0.26, endAt: 1.0, ringColor: '#ec4899' },
];

const FIREWORK_RAYS = Array.from({ length: 12 }, (_, i) => {
  const angle = (Math.PI * 2 * i) / 12;
  const isOuter = i % 2 === 0;
  const radius = isOuter ? 96 : 62;
  return {
    dx: Math.cos(angle) * radius,
    dy: Math.sin(angle) * radius,
    size: isOuter ? 7 : 5,
    isOuter,
  };
});

export function FireworksCelebration({
  trigger,
  colors = ['#22c55e', '#facc15', '#38bdf8', '#ec4899', '#a855f7', '#ffffff'],
}: {
  trigger: number;
  colors?: string[];
}) {
  const master = useRef(new Animated.Value(0)).current;
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!trigger || reduceMotion) return;
    setActive(true);
    master.setValue(0);
    const anim = Animated.timing(master, {
      toValue: 1,
      duration: 1450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE,
    });
    anim.start(({ finished }) => {
      if (finished) setActive(false);
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (!active) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { zIndex: 950, elevation: 30, overflow: 'hidden' },
      ]}
    >
      {FIREWORK_BURSTS.map((burst, bIdx) => {
        const midAt = burst.startAt + (burst.endAt - burst.startAt) * 0.35;
        const ringScale = master.interpolate({
          inputRange: [burst.startAt, burst.endAt],
          outputRange: [0.15, 2.3],
          extrapolate: 'clamp',
        });
        const ringOpacity = master.interpolate({
          inputRange: [burst.startAt, midAt, burst.endAt],
          outputRange: [0, 0.85, 0],
          extrapolate: 'clamp',
        });

        return (
          <View
            key={`${trigger}-fw-${bIdx}`}
            style={{
              position: 'absolute',
              left: `${burst.cxPct * 100}%`,
              top: `${burst.cyPct * 100}%`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* 3B Şok Dalgası Halkası */}
            <Animated.View
              style={{
                position: 'absolute',
                width: 56,
                height: 56,
                borderRadius: 28,
                borderWidth: 2,
                borderColor: burst.ringColor,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              }}
            />

            {/* 3B Küresel Işın Parçacıkları */}
            {FIREWORK_RAYS.map((ray, rIdx) => {
              const pColor = colors[(bIdx * 3 + rIdx) % colors.length];
              const tx = master.interpolate({
                inputRange: [burst.startAt, burst.endAt],
                outputRange: [0, ray.dx],
                extrapolate: 'clamp',
              });
              const ty = master.interpolate({
                inputRange: [burst.startAt, midAt, burst.endAt],
                outputRange: [0, ray.dy * 0.72, ray.dy + 28],
                extrapolate: 'clamp',
              });
              const sc = master.interpolate({
                inputRange: [burst.startAt, midAt, burst.endAt],
                outputRange: [0.2, 1.35, 0.25],
                extrapolate: 'clamp',
              });
              const op = master.interpolate({
                inputRange: [
                  burst.startAt,
                  burst.startAt + 0.06,
                  burst.endAt - 0.12,
                  burst.endAt,
                ],
                outputRange: [0, 1, 0.9, 0],
                extrapolate: 'clamp',
              });

              return (
                <Animated.View
                  key={rIdx}
                  style={{
                    position: 'absolute',
                    width: ray.size,
                    height: ray.size,
                    borderRadius: ray.size / 2,
                    backgroundColor: pColor,
                    opacity: op,
                    transform: [
                      { translateX: tx },
                      { translateY: ty },
                      { scale: sc },
                    ],
                  }}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

// ───────── Kategoriye Göre Dinamik 3D Atmosfer (CategoryAtmosphere) ─────────
export type AtmosphereCategory =
  | 'beslenme'
  | 'egzersiz'
  | 'bakim'
  | 'ogrenme'
  | 'ibadet'
  | 'kotu-aliskanliklar'
  | 'gorevler';

interface Particle3DSeed {
  xPct: number;
  yPct: number;
  /** 3B Derinlik katmanı: 0.45 (uzak) .. 1.25 (yakın) */
  zDepth: number;
  size: number;
  driftY: number;
  driftX: number;
  phase: number;
}

const ATMOSPHERE_SEEDS: Particle3DSeed[] = [
  { xPct: 8, yPct: 14, zDepth: 1.18, size: 11, driftY: -54, driftX: 14, phase: 0.0 },
  { xPct: 22, yPct: 32, zDepth: 0.55, size: 6, driftY: -28, driftX: -9, phase: 0.15 },
  { xPct: 78, yPct: 18, zDepth: 0.95, size: 9, driftY: -44, driftX: -15, phase: 0.28 },
  { xPct: 90, yPct: 38, zDepth: 0.5, size: 5.5, driftY: -24, driftX: 8, phase: 0.42 },
  { xPct: 14, yPct: 58, zDepth: 0.85, size: 8.5, driftY: -38, driftX: 12, phase: 0.55 },
  { xPct: 64, yPct: 48, zDepth: 1.22, size: 12, driftY: -58, driftX: -14, phase: 0.68 },
  { xPct: 36, yPct: 72, zDepth: 0.6, size: 6.5, driftY: -30, driftX: 10, phase: 0.8 },
  { xPct: 84, yPct: 68, zDepth: 1.05, size: 10, driftY: -48, driftX: -12, phase: 0.12 },
  { xPct: 48, yPct: 22, zDepth: 0.72, size: 7.5, driftY: -34, driftX: 11, phase: 0.36 },
  { xPct: 28, yPct: 86, zDepth: 1.12, size: 10.5, driftY: -52, driftX: -11, phase: 0.62 },
  { xPct: 72, yPct: 84, zDepth: 0.65, size: 7, driftY: -32, driftX: 9, phase: 0.9 },
  { xPct: 54, yPct: 62, zDepth: 0.48, size: 5.5, driftY: -22, driftX: -7, phase: 0.48 },
];

const CATEGORY_PALETTES: Record<
  AtmosphereCategory,
  {
    colors: string[];
    orb1: string;
    orb2: string;
    shape: 'droplet' | 'spark' | 'bubble' | 'stardust' | 'halo' | 'ember';
  }
> = {
  beslenme: {
    colors: ['#F26B27', '#10b981', '#f59e0b', '#fb923c'],
    orb1: 'rgba(242, 107, 39, 0.10)',
    orb2: 'rgba(16, 185, 129, 0.08)',
    shape: 'droplet',
  },
  egzersiz: {
    colors: ['#C2ED19', '#a3e635', '#38bdf8', '#fde047'],
    orb1: 'rgba(194, 237, 25, 0.11)',
    orb2: 'rgba(56, 189, 248, 0.09)',
    shape: 'spark',
  },
  bakim: {
    colors: ['#E54B8E', '#f472b6', '#fbcfe8', '#c084fc'],
    orb1: 'rgba(229, 75, 142, 0.10)',
    orb2: 'rgba(192, 132, 252, 0.08)',
    shape: 'bubble',
  },
  ogrenme: {
    colors: ['#60a5fa', '#93c5fd', '#c7d2fe', '#a855f7'],
    orb1: 'rgba(59, 114, 235, 0.14)',
    orb2: 'rgba(168, 85, 247, 0.10)',
    shape: 'stardust',
  },
  ibadet: {
    colors: ['#C28E1E', '#f59e0b', '#fde047', '#fef08a'],
    orb1: 'rgba(194, 142, 30, 0.11)',
    orb2: 'rgba(245, 158, 11, 0.08)',
    shape: 'halo',
  },
  'kotu-aliskanliklar': {
    colors: ['#E5484D', '#fb7185', '#fda4af', '#f97316'],
    orb1: 'rgba(229, 72, 77, 0.12)',
    orb2: 'rgba(249, 115, 22, 0.08)',
    shape: 'ember',
  },
  gorevler: {
    colors: ['#E53945', '#f87171', '#fca5a5', '#fb923c'],
    orb1: 'rgba(229, 57, 69, 0.12)',
    orb2: 'rgba(248, 113, 113, 0.07)',
    shape: 'stardust',
  },
};

export const CategoryAtmosphere = React.memo(function CategoryAtmosphere({
  category,
  isDark,
}: {
  category: AtmosphereCategory;
  isDark: boolean;
}) {
  const cycle = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    cycle.setValue(0);
    pulse.setValue(0);

    const cLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cycle, {
          toValue: 1,
          duration: 6400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(cycle, {
          toValue: 0,
          duration: 6400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
      ])
    );

    const pLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
      ])
    );

    cLoop.start();
    pLoop.start();
    return () => {
      cLoop.stop();
      pLoop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const palette = CATEGORY_PALETTES[category] || CATEGORY_PALETTES.beslenme;

  const orbScale = cycle.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.12],
  });

  const orbTranslateY = cycle.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -24],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* 3B Derinlikli Arka Plan Atmosfer Küreleri (Ambient Orbs) */}
      <Animated.View
        style={{
          position: 'absolute',
          top: '8%',
          right: '-12%',
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: palette.orb1,
          transform: [{ scale: orbScale }, { translateY: orbTranslateY }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          bottom: '14%',
          left: '-14%',
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: palette.orb2,
          transform: [{ scale: orbScale }],
        }}
      />

      {/* 3B Paralaks Katmanlı Kategori Partikülleri */}
      {ATMOSPHERE_SEEDS.map((seed, idx) => {
        const pColor = palette.colors[idx % palette.colors.length];
        const baseAlpha = isDark
          ? Math.min(0.72, 0.28 * seed.zDepth)
          : Math.min(0.52, 0.22 * seed.zDepth);

        const ty = cycle.interpolate({
          inputRange: [0, 1],
          outputRange: [
            seed.phase * 14,
            seed.driftY * seed.zDepth,
          ],
        });
        const tx = cycle.interpolate({
          inputRange: [0, 1],
          outputRange: [0, seed.driftX * seed.zDepth],
        });
        const sc = pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [
            idx % 2 === 0 ? 0.82 : 1.16,
            idx % 2 === 0 ? 1.18 : 0.84,
          ],
        });
        const op = pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [
            idx % 2 === 0 ? baseAlpha * 0.55 : baseAlpha,
            idx % 2 === 0 ? baseAlpha : baseAlpha * 0.55,
          ],
        });

        const isSpark = palette.shape === 'spark';
        const isBubble = palette.shape === 'bubble';
        const isStar = palette.shape === 'stardust';
        const isHalo = palette.shape === 'halo';

        return (
          <Animated.View
            key={`${category}-p-${idx}`}
            style={{
              position: 'absolute',
              left: `${seed.xPct}%`,
              top: `${seed.yPct}%`,
              width: isSpark ? seed.size * 0.52 : seed.size,
              height: isSpark ? seed.size * 1.9 : seed.size,
              borderRadius: isStar ? 2.5 : 999,
              backgroundColor: isBubble
                ? withAlpha(pColor, 0.18)
                : pColor,
              borderWidth: isBubble ? 1.3 : isHalo ? 2 : 0,
              borderColor: isBubble
                ? withAlpha(pColor, 0.78)
                : isHalo
                ? withAlpha('#fef08a', 0.65)
                : 'transparent',
              opacity: op,
              transform: [
                { translateX: tx },
                { translateY: ty },
                { scale: sc },
                {
                  rotate: isSpark
                    ? '-22deg'
                    : isStar
                    ? '45deg'
                    : '0deg',
                },
              ],
            }}
          >
            {/* 3B Işık Yansıma Noktası (Baloncuk / Yıldız / Nur Çekirdeği) */}
            {(isBubble || isStar || isHalo) && (
              <View
                style={{
                  position: 'absolute',
                  top: 1.5,
                  left: 1.5,
                  width: Math.max(2, seed.size * 0.28),
                  height: Math.max(2, seed.size * 0.28),
                  borderRadius: 99,
                  backgroundColor: '#ffffff',
                  opacity: 0.85,
                }}
              />
            )}
          </Animated.View>
        );
      })}
    </View>
  );
});

// ───────── Kaydırarak Aksiyon: Sağa Kaydır (Tamamla) / Sola Kaydır (Sil veya Düzenle) ─────────
export interface SwipeableTaskRowProps {
  onSwipeRight?: () => void;
  onSwipeLeft: () => void;
  onSwipeActiveChange?: (active: boolean) => void;
  onThresholdHaptic?: () => void;
  rightLabel?: string;
  leftLabel?: string;
  leftIcon?: string;
  rightColor?: string;
  leftColor?: string;
  borderRadius?: number;
  disabled?: boolean;
  enableRightSwipe?: boolean;
  /** 'delete' satırı sola kaydırıp yok eder; 'bounce' (ör. Düzenle) yaylanarak geri döner ve aksiyonu açar */
  leftActionMode?: 'delete' | 'bounce';
  ignoreSwipeRef?: React.MutableRefObject<boolean>;
  children: React.ReactNode;
}

const SWIPE_ACTION_THRESHOLD = 72;

export function SwipeableTaskRow({
  onSwipeRight,
  onSwipeLeft,
  onSwipeActiveChange,
  onThresholdHaptic,
  rightLabel = 'Tamamla',
  leftLabel = 'Sil',
  leftIcon = '✕',
  rightColor = '#22c55e',
  leftColor = '#ef4444',
  borderRadius = 16,
  disabled = false,
  enableRightSwipe = true,
  leftActionMode = 'delete',
  ignoreSwipeRef,
  children,
}: SwipeableTaskRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const waveBurst = useRef(new Animated.Value(0)).current;
  const rowScale = useRef(new Animated.Value(1)).current;
  const rowOpacity = useRef(new Animated.Value(1)).current;
  const crossedRef = useRef<'none' | 'right' | 'left'>('none');
  const isAnimatingOutRef = useRef(false);

  const callbacksRef = useRef({
    onSwipeRight,
    onSwipeLeft,
    onSwipeActiveChange,
    onThresholdHaptic,
    disabled,
    enableRightSwipe,
    leftActionMode,
    ignoreSwipeRef,
  });
  callbacksRef.current = {
    onSwipeRight,
    onSwipeLeft,
    onSwipeActiveChange,
    onThresholdHaptic,
    disabled,
    enableRightSwipe,
    leftActionMode,
    ignoreSwipeRef,
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        const cur = callbacksRef.current;
        if (
          cur.disabled ||
          isAnimatingOutRef.current ||
          cur.ignoreSwipeRef?.current
        ) {
          return false;
        }
        if (!cur.enableRightSwipe && gs.dx > 0) {
          return false;
        }
        const absDx = Math.abs(gs.dx);
        const absDy = Math.abs(gs.dy);
        return absDx > 12 && absDx > absDy * 1.4;
      },
      onPanResponderGrant: () => {
        crossedRef.current = 'none';
        callbacksRef.current.onSwipeActiveChange?.(true);
      },
      onPanResponderMove: (_, gs) => {
        if (isAnimatingOutRef.current) return;
        const cur = callbacksRef.current;
        let rawDx = gs.dx;
        if (!cur.enableRightSwipe && rawDx > 0) {
          rawDx = 0;
        }
        const maxDrag = 165;
        const dampedDx =
          Math.abs(rawDx) > maxDrag
            ? Math.sign(rawDx) * (maxDrag + (Math.abs(rawDx) - maxDrag) * 0.28)
            : rawDx;
        translateX.setValue(dampedDx);

        if (
          cur.enableRightSwipe &&
          dampedDx >= SWIPE_ACTION_THRESHOLD &&
          crossedRef.current !== 'right'
        ) {
          crossedRef.current = 'right';
          cur.onThresholdHaptic?.();
        } else if (
          dampedDx <= -SWIPE_ACTION_THRESHOLD &&
          crossedRef.current !== 'left'
        ) {
          crossedRef.current = 'left';
          cur.onThresholdHaptic?.();
        } else if (
          Math.abs(dampedDx) < SWIPE_ACTION_THRESHOLD - 12 &&
          crossedRef.current !== 'none'
        ) {
          crossedRef.current = 'none';
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, gs) => {
        const cur = callbacksRef.current;
        cur.onSwipeActiveChange?.(false);
        if (isAnimatingOutRef.current) return;

        const shouldRight =
          cur.enableRightSwipe &&
          !!cur.onSwipeRight &&
          (gs.dx >= SWIPE_ACTION_THRESHOLD || (gs.dx > 44 && gs.vx > 0.65));
        const shouldLeft =
          gs.dx <= -SWIPE_ACTION_THRESHOLD || (gs.dx < -44 && gs.vx < -0.65);

        if (shouldRight) {
          isAnimatingOutRef.current = true;
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 132,
              stiffness: 260,
              damping: 20,
              mass: 0.7,
              useNativeDriver: USE_NATIVE,
            }),
            Animated.timing(waveBurst, {
              toValue: 1,
              duration: 210,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: USE_NATIVE,
            }),
          ]).start(() => {
            cur.onSwipeRight?.();
            Animated.parallel([
              Animated.spring(translateX, {
                toValue: 0,
                stiffness: 280,
                damping: 24,
                mass: 0.7,
                useNativeDriver: USE_NATIVE,
              }),
              Animated.timing(waveBurst, {
                toValue: 0,
                duration: 160,
                useNativeDriver: USE_NATIVE,
              }),
            ]).start(() => {
              isAnimatingOutRef.current = false;
            });
          });
        } else if (shouldLeft) {
          if (cur.leftActionMode === 'bounce') {
            // Düzenleme modu: yaylanarak yerine döner ve düzenleme penceresini açar
            cur.onSwipeLeft();
            Animated.spring(translateX, {
              toValue: 0,
              stiffness: 310,
              damping: 24,
              mass: 0.65,
              useNativeDriver: USE_NATIVE,
            }).start();
          } else {
            isAnimatingOutRef.current = true;
            Animated.parallel([
              Animated.timing(translateX, {
                toValue: -360,
                duration: 200,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: USE_NATIVE,
              }),
              Animated.timing(rowOpacity, {
                toValue: 0,
                duration: 185,
                easing: Easing.out(Easing.quad),
                useNativeDriver: USE_NATIVE,
              }),
              Animated.timing(rowScale, {
                toValue: 0.91,
                duration: 200,
                useNativeDriver: USE_NATIVE,
              }),
            ]).start(() => {
              cur.onSwipeLeft();
            });
          }
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            stiffness: 300,
            damping: 23,
            mass: 0.68,
            useNativeDriver: USE_NATIVE,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        callbacksRef.current.onSwipeActiveChange?.(false);
        if (!isAnimatingOutRef.current) {
          Animated.spring(translateX, {
            toValue: 0,
            stiffness: 300,
            damping: 23,
            mass: 0.68,
            useNativeDriver: USE_NATIVE,
          }).start();
        }
      },
    })
  ).current;

  const rightBgOpacity = translateX.interpolate({
    inputRange: [0, 10, 55],
    outputRange: [0, 0.85, 1],
    extrapolate: 'clamp',
  });
  const rightWaveScale = translateX.interpolate({
    inputRange: [0, SWIPE_ACTION_THRESHOLD, 180],
    outputRange: [0.18, 1.45, 3.1],
    extrapolate: 'clamp',
  });
  const rightIconScale = translateX.interpolate({
    inputRange: [0, 40, SWIPE_ACTION_THRESHOLD, 130],
    outputRange: [0.45, 0.85, 1.22, 1.08],
    extrapolate: 'clamp',
  });

  const leftBgOpacity = translateX.interpolate({
    inputRange: [-55, -10, 0],
    outputRange: [1, 0.85, 0],
    extrapolate: 'clamp',
  });
  const leftWaveScale = translateX.interpolate({
    inputRange: [-180, -SWIPE_ACTION_THRESHOLD, 0],
    outputRange: [3.1, 1.45, 0.18],
    extrapolate: 'clamp',
  });
  const leftIconScale = translateX.interpolate({
    inputRange: [-130, -SWIPE_ACTION_THRESHOLD, -40, 0],
    outputRange: [1.08, 1.22, 0.85, 0.45],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: 'relative',
        opacity: rowOpacity,
        transform: [{ scale: rowScale }],
      }}
    >
      {/* Arka Plan Aksiyon ve Dalga Katmanı */}
      {!disabled && (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          borderRadius,
          overflow: 'hidden',
        }}
      >
        {enableRightSwipe && (
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: withAlpha(rightColor, 0.24),
              borderColor: withAlpha(rightColor, 0.65),
              borderWidth: 1.5,
              borderRadius,
              opacity: rightBgOpacity,
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: 18,
            }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                left: -34,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: withAlpha(rightColor, 0.48),
                borderWidth: 3,
                borderColor: '#86efac',
                transform: [{ scaleX: rightWaveScale }, { scaleY: rightWaveScale }],
              }}
            />
            <Animated.View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                transform: [{ scale: rightIconScale }],
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: rightColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900' }}>
                  ✓
                </Text>
              </View>
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: '800',
                  letterSpacing: 0.3,
                }}
              >
                {rightLabel}
              </Text>
            </Animated.View>
          </Animated.View>
        )}

        {/* Sola Kaydırma: Sil veya Düzenle Dalgası */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: withAlpha(leftColor, 0.24),
            borderColor: withAlpha(leftColor, 0.65),
            borderWidth: 1.5,
            borderRadius,
            opacity: leftBgOpacity,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 18,
          }}
        >
          <Animated.View
            style={{
              position: 'absolute',
              right: -34,
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: withAlpha(leftColor, 0.48),
              borderWidth: 2.5,
              borderColor: withAlpha('#ffffff', 0.65),
              transform: [{ scaleX: leftWaveScale }, { scaleY: leftWaveScale }],
            }}
          />
          <Animated.View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              transform: [{ scale: leftIconScale }],
            }}
          >
            <Text
              style={{
                color: '#ffffff',
                fontSize: 13,
                fontWeight: '800',
                letterSpacing: 0.3,
              }}
            >
              {leftLabel}
            </Text>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: leftColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '900' }}>
                {leftIcon}
              </Text>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
      )}

      {/* Ön Plan Kartı */}
      <Animated.View style={{ transform: [{ translateX }] }}>
        {children}
        {!disabled && enableRightSwipe && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              borderRadius,
              backgroundColor: withAlpha(rightColor, 0.32),
              borderColor: '#86efac',
              borderWidth: 1.5,
              opacity: waveBurst,
            }}
          />
        )}
      </Animated.View>
    </Animated.View>
  );
}

// ───────── Fizik Tabanlı Yay (Spring) Efektli Sürükle-Bırak Listesi (SpringDragList) ─────────
export interface SpringDragItemControls {
  /** `⠿` tutamacına eklendiğinde beklemeden anında yaylı sürükleme başlatır */
  handleProps: any;
  /** Kart başlığına eklendiğinde ~170ms basılı tutunca yaylı sürükleme başlatır */
  longPressDragProps: any;
}

export interface SpringDragListProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDragActiveChange?: (active: boolean) => void;
  onLongPressNoDrag?: (item: T) => void;
  onStartHaptic?: () => void;
  onStepHaptic?: () => void;
  gap?: number;
  accentColor?: string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  renderItem: (
    item: T,
    index: number,
    controls: SpringDragItemControls
  ) => React.ReactNode;
}

export function SpringDragList<T>({
  items,
  keyExtractor,
  onReorder,
  onDragActiveChange,
  onLongPressNoDrag,
  onStartHaptic,
  onStepHaptic,
  gap = 14,
  accentColor = '#22c55e',
  borderRadius = 16,
  style,
  renderItem,
}: SpringDragListProps<T>) {
  // Her öğe için Native Driver destekli Animated.Value havuzu (sürükleme başlangıcı ve boyunca 0 React re-render!)
  const translateYMapRef = useRef<Map<string, Animated.Value>>(new Map());
  const liftMapRef = useRef<Map<string, Animated.Value>>(new Map());
  const lastShiftMapRef = useRef<Map<string, number>>(new Map());
  const rowRefsMapRef = useRef<Map<string, View | null>>(new Map());
  const heightsRef = useRef<number[]>([]);
  const pendingResetKeyRef = useRef<string | null>(null);
  const activeDragRef = useRef<{
    fromIdx: number;
    targetIdx: number;
    key: string;
    moved: boolean;
  } | null>(null);

  const latestRef = useRef({
    items,
    keyExtractor,
    onReorder,
    onDragActiveChange,
    onLongPressNoDrag,
    onStartHaptic,
    onStepHaptic,
    gap,
  });
  latestRef.current = {
    items,
    keyExtractor,
    onReorder,
    onDragActiveChange,
    onLongPressNoDrag,
    onStartHaptic,
    onStepHaptic,
    gap,
  };

  const getTranslateY = (key: string) => {
    let val = translateYMapRef.current.get(key);
    if (!val) {
      val = new Animated.Value(0);
      translateYMapRef.current.set(key, val);
    }
    return val;
  };

  const getLift = (key: string) => {
    let val = liftMapRef.current.get(key);
    if (!val) {
      val = new Animated.Value(0);
      liftMapRef.current.set(key, val);
    }
    return val;
  };

  const setRowElevated = (key: string, elevated: boolean) => {
    const node = rowRefsMapRef.current.get(key) as any;
    if (node && typeof node.setNativeProps === 'function') {
      node.setNativeProps({
        style: {
          zIndex: elevated ? 100 : 1,
          elevation: elevated ? 16 : 0,
        },
      });
    }
  };

  // Sıralama sonrası yeni items dizisi commit edildiği anda translateY sıfırlanır (0 kare sıçrama!)
  useLayoutEffect(() => {
    if (!pendingResetKeyRef.current) return;
    const resetKey = pendingResetKeyRef.current;
    pendingResetKeyRef.current = null;
    lastShiftMapRef.current.clear();
    items.forEach((it) => {
      const k = keyExtractor(it);
      getTranslateY(k).setValue(0);
      getLift(k).setValue(0);
    });
    setRowElevated(resetKey, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const updateDragPosition = (fromIdx: number, dy: number) => {
    const cur = latestRef.current;
    const count = cur.items.length;
    if (count <= 1 || !activeDragRef.current) return;

    const activeKey = cur.keyExtractor(cur.items[fromIdx]);
    getTranslateY(activeKey).setValue(dy);

    if (Math.abs(dy) > 6) {
      activeDragRef.current.moved = true;
    }

    const draggedSlotH = (heightsRef.current[fromIdx] || 86) + cur.gap;
    let newTarget = fromIdx;

    if (dy > 0) {
      let acc = 0;
      for (let m = fromIdx + 1; m < count; m++) {
        const mH = (heightsRef.current[m] || 86) + cur.gap;
        if (dy > acc + mH * 0.52) {
          newTarget = m;
          acc += mH;
        } else {
          break;
        }
      }
    } else if (dy < 0) {
      let acc = 0;
      for (let m = fromIdx - 1; m >= 0; m--) {
        const mH = (heightsRef.current[m] || 86) + cur.gap;
        if (-dy > acc + mH * 0.52) {
          newTarget = m;
          acc += mH;
        } else {
          break;
        }
      }
    }

    if (newTarget !== activeDragRef.current.targetIdx) {
      activeDragRef.current.targetIdx = newTarget;
      cur.onStepHaptic?.();

      // Sadece hedef kayma mesafesi değişen komşu kartlara yay (spring) uygula
      for (let k = 0; k < count; k++) {
        if (k === fromIdx) continue;
        const kKey = cur.keyExtractor(cur.items[k]);
        let shift = 0;
        if (fromIdx < newTarget && k > fromIdx && k <= newTarget) {
          shift = -draggedSlotH;
        } else if (fromIdx > newTarget && k >= newTarget && k < fromIdx) {
          shift = draggedSlotH;
        }
        const prevShift = lastShiftMapRef.current.get(kKey) || 0;
        if (prevShift !== shift) {
          lastShiftMapRef.current.set(kKey, shift);
          Animated.spring(getTranslateY(kKey), {
            toValue: shift,
            stiffness: 310,
            damping: 25,
            mass: 0.65,
            restDisplacementThreshold: 0.5,
            restSpeedThreshold: 2,
            useNativeDriver: USE_NATIVE,
          }).start();
        }
      }
    }
  };

  const beginDrag = (idx: number) => {
    const cur = latestRef.current;
    if (idx < 0 || idx >= cur.items.length) return;
    if (activeDragRef.current) return;
    const key = cur.keyExtractor(cur.items[idx]);
    lastShiftMapRef.current.clear();
    activeDragRef.current = {
      fromIdx: idx,
      targetIdx: idx,
      key,
      moved: false,
    };
    setRowElevated(key, true);
    cur.onDragActiveChange?.(true);
    cur.onStartHaptic?.();

    Animated.spring(getLift(key), {
      toValue: 1,
      stiffness: 340,
      damping: 22,
      mass: 0.58,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.1,
      useNativeDriver: USE_NATIVE,
    }).start();
  };

  const finishDrag = (isCancel = false) => {
    const dragState = activeDragRef.current;
    if (!dragState) return;
    activeDragRef.current = null;

    const cur = latestRef.current;
    cur.onDragActiveChange?.(false);

    const { fromIdx, targetIdx, key, moved } = dragState;
    const item = cur.items[fromIdx];

    let finalOffset = 0;
    if (!isCancel && targetIdx !== fromIdx) {
      if (targetIdx > fromIdx) {
        for (let m = fromIdx + 1; m <= targetIdx; m++) {
          finalOffset += (heightsRef.current[m] || 86) + cur.gap;
        }
      } else {
        for (let m = fromIdx - 1; m >= targetIdx; m--) {
          finalOffset -= (heightsRef.current[m] || 86) + cur.gap;
        }
      }
    }

    Animated.parallel([
      Animated.spring(getTranslateY(key), {
        toValue: finalOffset,
        stiffness: 330,
        damping: 26,
        mass: 0.62,
        restDisplacementThreshold: 0.5,
        restSpeedThreshold: 2,
        useNativeDriver: USE_NATIVE,
      }),
      Animated.spring(getLift(key), {
        toValue: 0,
        stiffness: 320,
        damping: 24,
        mass: 0.62,
        restDisplacementThreshold: 0.02,
        restSpeedThreshold: 0.2,
        useNativeDriver: USE_NATIVE,
      }),
    ]).start(() => {
      if (!isCancel && targetIdx !== fromIdx) {
        pendingResetKeyRef.current = key;
        cur.onReorder(fromIdx, targetIdx);
      } else {
        lastShiftMapRef.current.clear();
        cur.items.forEach((it) => {
          const k = cur.keyExtractor(it);
          getTranslateY(k).setValue(0);
          getLift(k).setValue(0);
        });
        setRowElevated(key, false);
        if (!isCancel && !moved && item && cur.onLongPressNoDrag) {
          cur.onLongPressNoDrag(item);
        }
      }
    });
  };

  return (
    <View style={[{ gap }, style]}>
      {items.map((item, idx) => {
        const key = keyExtractor(item);
        const ty = getTranslateY(key);
        const lift = getLift(key);

        return (
          <SpringDragRowWrapper
            key={key}
            itemKey={key}
            index={idx}
            translateY={ty}
            lift={lift}
            accentColor={accentColor}
            borderRadius={borderRadius}
            onRegisterRowRef={(k, node) => {
              rowRefsMapRef.current.set(k, node);
            }}
            onMeasureHeight={(h) => {
              heightsRef.current[idx] = h;
            }}
            onBeginDrag={beginDrag}
            onMoveDrag={updateDragPosition}
            onEndDrag={finishDrag}
            renderContent={(controls) => renderItem(item, idx, controls)}
          />
        );
      })}
    </View>
  );
}

interface SpringDragRowWrapperProps {
  itemKey: string;
  index: number;
  translateY: Animated.Value;
  lift: Animated.Value;
  accentColor: string;
  borderRadius: number;
  onRegisterRowRef: (key: string, node: View | null) => void;
  onMeasureHeight: (h: number) => void;
  onBeginDrag: (idx: number) => void;
  onMoveDrag: (idx: number, dy: number) => void;
  onEndDrag: (isCancel?: boolean) => void;
  renderContent: (controls: SpringDragItemControls) => React.ReactNode;
}

function SpringDragRowWrapper({
  itemKey,
  index,
  translateY,
  lift,
  accentColor,
  borderRadius,
  onRegisterRowRef,
  onMeasureHeight,
  onBeginDrag,
  onMoveDrag,
  onEndDrag,
  renderContent,
}: SpringDragRowWrapperProps) {
  const cbRef = useRef({
    index,
    onBeginDrag,
    onMoveDrag,
    onEndDrag,
  });
  cbRef.current = {
    index,
    onBeginDrag,
    onMoveDrag,
    onEndDrag,
  };

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedByHoldRef = useRef(false);
  const handleActiveRef = useRef(false);
  const startPageRef = useRef({ x: 0, y: 0 });

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearHoldTimer();
  }, []);

  // 1) `⠿` Tutamacı (veya Sırala modu kartı) için 0ms gecikmesiz başlayan PanResponder
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        clearHoldTimer();
        armedByHoldRef.current = false;
        handleActiveRef.current = true;
        return true;
      },
      onStartShouldSetPanResponderCapture: () => {
        clearHoldTimer();
        armedByHoldRef.current = false;
        handleActiveRef.current = true;
        return true;
      },
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        clearHoldTimer();
        armedByHoldRef.current = false;
        handleActiveRef.current = true;
        cbRef.current.onBeginDrag(cbRef.current.index);
      },
      onPanResponderMove: (_, gs) => {
        cbRef.current.onMoveDrag(cbRef.current.index, gs.dy);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => {
        handleActiveRef.current = false;
        cbRef.current.onEndDrag(false);
      },
      onPanResponderTerminate: () => {
        handleActiveRef.current = false;
        cbRef.current.onEndDrag(true);
      },
    })
  ).current;

  // 2) Kart Başlığı / Gövdesi üzerinde ~170ms basılı tutunca devreye giren Yaylı Sürükleme
  const longPressPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: (evt) => {
        if (handleActiveRef.current) return false;
        clearHoldTimer();
        armedByHoldRef.current = false;
        startPageRef.current = {
          x: evt.nativeEvent.pageX,
          y: evt.nativeEvent.pageY,
        };
        holdTimerRef.current = setTimeout(() => {
          holdTimerRef.current = null;
          if (handleActiveRef.current) return;
          armedByHoldRef.current = true;
          cbRef.current.onBeginDrag(cbRef.current.index);
        }, 170);
        return false;
      },
      onMoveShouldSetPanResponder: () =>
        !handleActiveRef.current && armedByHoldRef.current,
      onMoveShouldSetPanResponderCapture: (evt) => {
        if (handleActiveRef.current) {
          clearHoldTimer();
          return false;
        }
        if (armedByHoldRef.current) {
          return true;
        }
        const dx = Math.abs(evt.nativeEvent.pageX - startPageRef.current.x);
        const dy = Math.abs(evt.nativeEvent.pageY - startPageRef.current.y);
        if (dx > 8 || dy > 8) {
          clearHoldTimer();
        }
        return false;
      },
      onPanResponderMove: (_, gs) => {
        if (armedByHoldRef.current && !handleActiveRef.current) {
          cbRef.current.onMoveDrag(cbRef.current.index, gs.dy);
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => {
        clearHoldTimer();
        if (armedByHoldRef.current) {
          armedByHoldRef.current = false;
          cbRef.current.onEndDrag(false);
        }
      },
      onPanResponderTerminate: () => {
        clearHoldTimer();
        if (armedByHoldRef.current) {
          armedByHoldRef.current = false;
          cbRef.current.onEndDrag(true);
        }
      },
    })
  ).current;

  const longPressDragProps = useMemo(
    () => ({
      ...longPressPanResponder.panHandlers,
      onTouchEnd: () => {
        clearHoldTimer();
        if (armedByHoldRef.current && !handleActiveRef.current) {
          armedByHoldRef.current = false;
          cbRef.current.onEndDrag(false);
        }
      },
      onTouchCancel: () => {
        clearHoldTimer();
        if (armedByHoldRef.current && !handleActiveRef.current) {
          armedByHoldRef.current = false;
          cbRef.current.onEndDrag(true);
        }
      },
    }),
    [longPressPanResponder]
  );

  const scale = lift.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.032],
  });

  const haloOpacity = lift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      ref={(node) => onRegisterRowRef(itemKey, node as any)}
      onLayout={(e) => onMeasureHeight(e.nativeEvent.layout.height)}
      style={{
        zIndex: 1,
        elevation: 0,
        transform: [{ translateY }, { scale }],
      }}
    >
      {renderContent({
        handleProps: handlePanResponder.panHandlers,
        longPressDragProps,
      })}
      {/* Sürüklenirken Kart Çevresinde Parlayan 3B Yaylı Vurgu Halkası */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -2,
          bottom: -2,
          left: -2,
          right: -2,
          borderRadius: borderRadius + 2,
          borderWidth: 2,
          borderColor: accentColor,
          backgroundColor: withAlpha(accentColor, 0.06),
          opacity: haloOpacity,
        }}
      />
    </Animated.View>
  );
}

const motionStyles = StyleSheet.create({
  burstLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
});
