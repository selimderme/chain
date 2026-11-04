import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { HABIT_EMOJIS, TabTheme } from './constants';
import { InstantButton } from './InstantButton';

interface Props {
  value: string;
  onSelect: (emoji: string) => void;
  theme: Pick<TabTheme, 'text' | 'muted' | 'accent' | 'accentSoft'>;
  labelPrefix?: string;
}

export default function EmojiPicker({ value, onSelect, theme, labelPrefix = 'Emoji' }: Props) {
  const emojiScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const columns = Array.from({ length: Math.ceil(HABIT_EMOJIS.length / 3) }, (_, index) =>
    HABIT_EMOJIS.slice(index * 3, index * 3 + 3));

  return (
    <View style={styles.container}>
      <ScrollView ref={emojiScroll} horizontal showsHorizontalScrollIndicator
        keyboardShouldPersistTaps="handled" contentContainerStyle={styles.emojiContent}
        onContentSizeChange={() => {
          const index = HABIT_EMOJIS.findIndex(option => option.emoji === value);
          emojiScroll.current?.scrollTo({ x: index < 0 ? 0 : Math.max(0, Math.floor(index / 3) * 50 - 16), animated: false });
        }}
      >
        {columns.map((column, index) => (
          <View key={index} style={styles.column}>
            {column.map(option => (
              <InstantButton key={option.emoji} accessibilityLabel={`${labelPrefix}: ${option.label}`}
                accessibilityState={{ selected: value === option.emoji }} onPress={() => onSelect(option.emoji)}
                style={[styles.option, { borderColor: value === option.emoji ? theme.accent : 'transparent', backgroundColor: value === option.emoji ? theme.accentSoft : 'rgba(255,255,255,0.04)' }]}
              ><Text style={styles.emoji}>{option.emoji}</Text></InstantButton>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: 0 },
  emojiContent: { gap: 6, paddingBottom: 8 },
  column: { gap: 6 },
  option: { width: 44, height: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24 },
});
