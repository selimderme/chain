import React, { createContext, useContext, useRef } from 'react';
import { BlurTargetView, BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

type BlurTarget = React.ComponentRef<typeof BlurTargetView>;
const BlurTargetContext = createContext<React.RefObject<BlurTarget | null> | undefined>(undefined);

/** Keep one capture target for all sheets, including Android's native blur. */
export function SheetHost({ children }: { children: React.ReactNode }) {
  const target = useRef<BlurTarget>(null);
  return <BlurTargetContext.Provider value={target}><BlurTargetView ref={target} style={styles.host}>{children}</BlurTargetView></BlurTargetContext.Provider>;
}

export function SheetBackdrop() {
  const target = useContext(BlurTargetContext);
  return <BlurView testID="sheet-blur-backdrop" pointerEvents="none" blurTarget={target} blurMethod="dimezisBlurView" intensity={45} tint="dark" style={StyleSheet.absoluteFill} />;
}

const styles = StyleSheet.create({ host: { flex: 1 } });
