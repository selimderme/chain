import React, { forwardRef } from 'react';
import { Platform, Pressable, StyleProp, TouchableOpacity, TouchableOpacityProps, View, ViewStyle } from 'react-native';

/** Immediate visual feedback; activation still waits for a valid release/click. */
type ButtonProps = Omit<TouchableOpacityProps, 'style'> & { style?: StyleProp<ViewStyle> };
export const InstantButton = forwardRef<React.ComponentRef<typeof View>, ButtonProps>(function InstantButton(
  { activeOpacity = 0.7, style, children, ...props }, ref
) {
  if (Platform.OS !== 'web') {
    return <TouchableOpacity ref={ref} delayPressIn={0} delayPressOut={0} activeOpacity={activeOpacity} style={style} {...props}>{children}</TouchableOpacity>;
  }
  return <Pressable ref={ref} accessibilityRole="button" delayPressIn={0} delayPressOut={0} {...props} style={({ pressed }) => [style, pressed && !props.disabled ? { opacity: activeOpacity } : null]}>{children}</Pressable>;
});
