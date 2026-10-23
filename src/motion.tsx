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
  distance = 16,
  style,
  children,
}: FadeSlideInProps) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      v.setValue(1);
      return;
    }
    const anim = Animated.spring(v, {
      toValue: 1,
      delay: delay + Math.min(index, 8) * 55,
      friction: 8,
      tension: 70,
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
            outputRange: [0, 1],
            extrapolate: 'clamp',
          }),
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
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
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (prev.current === mark) return;
    const was = prev.current;
    prev.current = mark;
    if (reduceMotion) return;

    if (mark) {
      scale.setValue(0.72);
      ring.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          tension: 180,
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(ring, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE,
        }),
      ]).start();
      if (burst && mark === 'g') setBurstKey((k) => k + 1);
    } else if (was) {
      scale.setValue(0.88);
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 200,
        useNativeDriver: USE_NATIVE,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mark]);

  return (
    <View>
      {!!color && (
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
      {burst && (
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

// ───────── Tema değişince ekran rengi yumuşak geçiş ─────────
export function ThemeCrossfade({ color }: { color: string }) {
  const [prevColor, setPrevColor] = useState<string | null>(null);
  const last = useRef(color);
  const v = useRef(new Animated.Value(0)).current;

  // useLayoutEffect: yeni tema ekrana çizilmeden önce eski renk katmanı yerleşir (titreme olmaz)
  useLayoutEffect(() => {
    if (last.current === color) return;
    const old = last.current;
    last.current = color;
    if (reduceMotion) return;
    setPrevColor(old);
    v.setValue(1);
    const anim = Animated.timing(v, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: USE_NATIVE,
    });
    anim.start(({ finished }) => {
      if (finished) setPrevColor(null);
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  if (!prevColor) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: prevColor,
          opacity: v,
          zIndex: 999,
          elevation: 50,
        },
      ]}
    />
  );
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
