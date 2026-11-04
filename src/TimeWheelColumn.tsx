import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { pad } from './utils';

const ITEM_HEIGHT = 42;
const HEIGHT = ITEM_HEIGHT * 3;

interface TimeWheelColumnProps {
  label: string;
  items: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
}

export default function TimeWheelColumn({ label, items, selectedValue, onValueChange }: TimeWheelColumnProps) {
  // Start in the middle copy so both ends have a previous and next value.
  const repeatedItems = useMemo(() => [...items, ...items, ...items], [items]);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const initialOffset = useRef({ x: 0, y: (items.length + Math.max(0, items.indexOf(selectedValue))) * ITEM_HEIGHT });
  const offset = useRef(initialOffset.current.y);
  const scrollY = useRef(new Animated.Value(initialOffset.current.y)).current;
  const animatedItemStyles = useMemo(() => repeatedItems.map((_, index) => {
    const inputRange = [(index - 1) * ITEM_HEIGHT, index * ITEM_HEIGHT, (index + 1) * ITEM_HEIGHT];
    return {
      opacity: scrollY.interpolate({ inputRange, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' }),
      transform: [{ scale: scrollY.interpolate({ inputRange, outputRange: [0.76, 1, 0.76], extrapolate: 'clamp' }) }],
    };
  }), [repeatedItems, scrollY]);
  const animating = useRef(false);
  const userScrolling = useRef(false);
  const touching = useRef(false);
  const lastValue = useRef(selectedValue);
  const onChange = useRef(onValueChange);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  onChange.current = onValueChange;

  const clearSettleTimer = () => {
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = null;
  };
  const valueAtOffset = (y: number) => {
    const index = Math.max(0, Math.min(repeatedItems.length - 1, Math.round(y / ITEM_HEIGHT)));
    return repeatedItems[index];
  };
  const emitValue = (value: number) => {
    if (value === lastValue.current) return;
    lastValue.current = value;
    Haptics.selectionAsync().catch(() => {});
    onChange.current(value);
  };
  const moveToValue = (value: number, animated = false) => {
    const index = items.indexOf(value);
    // Animate to the nearest copy, including 23 → 00 and 59 → 00.
    const candidates = [index, items.length + index, items.length * 2 + index];
    const target = animated
      ? candidates.reduce((best, next) => Math.abs(next * ITEM_HEIGHT - offset.current) < Math.abs(best * ITEM_HEIGHT - offset.current) ? next : best)
      : items.length + index;
    if (!animated) {
      offset.current = target * ITEM_HEIGHT;
      scrollY.setValue(offset.current);
    }
    scrollRef.current?.scrollTo({ y: target * ITEM_HEIGHT, animated });
  };
  const settle = () => {
    clearSettleTimer();
    if (touching.current) return;
    if (animating.current) {
      animating.current = false;
      moveToValue(lastValue.current);
      return;
    }
    if (!userScrolling.current) return;
    const value = valueAtOffset(offset.current);
    userScrolling.current = false;
    emitValue(value);
    // Recenter only after the gesture ends, preserving the visible neighbors.
    moveToValue(value);
  };
  const scheduleSettle = () => {
    clearSettleTimer();
    settleTimer.current = setTimeout(settle, 160);
  };

  useEffect(() => {
    if (selectedValue !== lastValue.current) {
      clearSettleTimer();
      userScrolling.current = false;
      animating.current = false;
      lastValue.current = selectedValue;
      moveToValue(selectedValue);
    }
  }, [selectedValue, items]);
  useEffect(() => clearSettleTimer, []);

  return (
    <View style={styles.column}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.box}>
        <View pointerEvents="none" style={styles.highlight} />
        <Animated.ScrollView
          ref={scrollRef}
          testID={label === 'SAAT' ? 'hour-wheel' : 'minute-wheel'}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          bounces={false}
          decelerationRate={0.99}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentOffset={initialOffset.current}
          onLayout={() => scrollRef.current?.scrollTo({ y: offset.current, animated: false })}
          onTouchStart={() => { clearSettleTimer(); animating.current = false; touching.current = true; userScrolling.current = true; }}
          onTouchEnd={() => { touching.current = false; scheduleSettle(); }}
          onTouchCancel={() => { touching.current = false; scheduleSettle(); }}
          onScrollBeginDrag={() => { clearSettleTimer(); userScrolling.current = true; }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: Platform.OS !== 'web',
            listener: (event: { nativeEvent: { contentOffset: { y: number } } }) => {
              if (!userScrolling.current && !animating.current) return;
              offset.current = event.nativeEvent.contentOffset.y;
              // The selected tap stays authoritative while its animation runs.
              if (animating.current) { scheduleSettle(); return; }
              if (!userScrolling.current) return;
              emitValue(valueAtOffset(offset.current));
              if (!touching.current) scheduleSettle();
            },
          })}
          onScrollEndDrag={() => { touching.current = false; scheduleSettle(); }}
          onMomentumScrollEnd={settle}
          {...(Platform.OS === 'web' ? { onWheel: () => { animating.current = false; userScrolling.current = true; scheduleSettle(); } } : {})}
          contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
          style={[styles.scroll, Platform.OS === 'web' && { scrollSnapType: 'y mandatory' } as ViewStyle]}
        >
          {repeatedItems.map((item, index) => (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`${label === 'SAAT' ? 'Saat' : 'Dakika'} ${pad(item)}`}
              accessibilityState={{ selected: item === selectedValue }}
              onPress={() => {
                clearSettleTimer();
                userScrolling.current = false;
                touching.current = false;
                emitValue(item);
                animating.current = true;
                moveToValue(item, true);
                scheduleSettle();
              }}
              style={[styles.item, Platform.OS === 'web' && { scrollSnapAlign: 'center' } as ViewStyle]}
            >
              <Animated.Text style={[styles.text, animatedItemStyles[index]]}>{pad(item)}</Animated.Text>
            </Pressable>
          ))}
        </Animated.ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: 6 },
  label: { color: '#9DB9E7', fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  box: { width: 96, height: HEIGHT, borderRadius: 14, backgroundColor: '#0D2C588C', borderWidth: 1.5, borderColor: '#78C9FF66', overflow: 'hidden', position: 'relative' },
  highlight: { position: 'absolute', top: ITEM_HEIGHT, left: 6, right: 6, height: ITEM_HEIGHT, borderRadius: 10, backgroundColor: '#008EFF38', borderWidth: 1.5, borderColor: '#6DDFFF' },
  scroll: { width: '100%', height: HEIGHT },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  text: { fontVariant: ['tabular-nums'], color: '#F4F9FF', fontSize: 22, fontWeight: '800' },
});
