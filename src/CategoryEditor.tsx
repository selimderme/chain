import { InstantButton as TouchableOpacity } from './InstantButton';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CUSTOM_TAB_COLORS, CustomTab, getAccentInk, NEON_THEME, TabConfig } from './constants';
import EmojiPicker from './EmojiPicker';
import { SheetPressable } from './motion';
import { SheetBackdrop } from './SheetBackdrop';
import { GlassMaterial, GlowFill } from './AuroraGlass';

interface Props {
  visible: boolean;
  existingNames: string[];
  editingTab?: TabConfig | null;
  onCancel: () => void;
  onCreate: (tab: Omit<CustomTab, 'id'>) => void;
}

export default function CategoryEditor({ visible, existingNames, editingTab, onCancel, onCreate }: Props) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📁');
  const [color, setColor] = useState<string>(CUSTOM_TAB_COLORS[0].color);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setName(editingTab?.name || ''); setEmoji(editingTab?.emoji || '📁'); setColor(editingTab?.color || CUSTOM_TAB_COLORS[0].color);
      setEmojiOpen(false); setError('');
    }
  }, [visible, editingTab]);

  const submit = () => {
    const title = name.trim();
    if (!title) { setError('Lütfen bir sekme adı gir.'); return; }
    if (existingNames.some((value) => value.trim().toLocaleLowerCase('tr-TR') === title.toLocaleLowerCase('tr-TR'))) {
      setError('Bu isimde bir sekme zaten var.'); return;
    }
    onCreate({ name: title, emoji, color });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <SheetBackdrop />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="Sekme eklemeyi kapat" />
        <SheetPressable onDismiss={onCancel} style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <GlassMaterial accent="#008EFF" radius={24}/>
          <ScrollView style={{position:'relative',zIndex:1}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{editingTab ? 'Sekmeyi düzenle' : 'Yeni sekme'}</Text>
            <Text style={styles.localNote}>{editingTab ? 'Sekme görünümü bu cihazda saklanır.' : 'Yeni sekmeler ve içindeki maddeler bu cihazda saklanır.'}</Text>
            <Text style={styles.label}>Sekme adı ve emoji</Text>
            <View style={styles.identity}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Sekme emojisi seç" accessibilityState={{ expanded: emojiOpen }} onPress={() => setEmojiOpen((open) => !open)} style={styles.emojiTrigger}>
                <Text style={{ fontSize: 27 }}>{emoji}</Text><Text style={{ color:'#70D9FF', fontSize: 10 }}>▾</Text>
              </TouchableOpacity>
              <TextInput accessibilityLabel="Sekme adı" placeholder="Örn. İş, Hobiler, Finans" placeholderTextColor={NEON_THEME.muted} selectionColor="#70D9FF" maxLength={40} value={name} onChangeText={(value) => { setName(value); setError(''); }} returnKeyType="done" onSubmitEditing={submit} style={styles.input} />
            </View>
            {emojiOpen && (
              <View style={{ marginBottom: 18 }}>
                <EmojiPicker value={emoji} labelPrefix="Sekme emojisi" theme={{ ...NEON_THEME, accent:'#70D9FF', accentSoft:'#008EFF26' }} onSelect={value => { setEmoji(value); setEmojiOpen(false); }} />
              </View>
            )}
            {editingTab && (
              <>
                <Text style={styles.label}>Tema rengi</Text>
                <View style={styles.colorGrid}>
                  {CUSTOM_TAB_COLORS.map((option) => (
                    <TouchableOpacity key={option.color} accessibilityRole="button" accessibilityLabel={`Renk: ${option.label}`} accessibilityState={{ selected: color === option.color }} onPress={() => setColor(option.color)} style={[styles.colorOption, { borderColor: color === option.color ? '#9EE9FF' : 'transparent',backgroundColor:color===option.color?'#1C70C333':'transparent' }]}>
                      <View style={[styles.swatch, { backgroundColor: option.color }]}>
                        {color === option.color && <Text style={{ color: getAccentInk(option.color), fontWeight: '800' }}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <View style={styles.actions}>
              <TouchableOpacity accessibilityRole="button" onPress={onCancel} style={styles.cancel}><Text style={styles.cancelText}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={submit} style={styles.create}><GlowFill color="#008EFF" radius={99}/><Text style={{ color:'#F4FBFF', fontWeight: '700' }}>{editingTab ? 'Değişiklikleri kaydet' : 'Sekme ekle'}</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </SheetPressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: 0, backgroundColor: 'transparent' },
  sheet: { width: '100%', maxWidth: 400, maxHeight: '88%', backgroundColor:'#0A1E44E8', borderWidth: 1,borderColor:'#7EC9FF80', borderRadius: 24, padding: 22 },
  title: { color: NEON_THEME.text, fontSize: 21, fontWeight: '800', marginBottom: 18 },
  localNote: { color: NEON_THEME.muted, fontSize: 12, lineHeight: 17, marginBottom: 16 },
  label: { color: NEON_THEME.text, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  identity: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  emojiTrigger: { width: 58, height: 48, borderWidth: 1,borderColor:'#79CFFF80',backgroundColor:'#0860B82B', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  input: { flex: 1, minWidth: 0, color: NEON_THEME.text, borderWidth: 1,borderColor:'#78C9FF66', borderRadius: 14, backgroundColor:'#0D2C588C', paddingHorizontal: 12, height: 48, fontSize: 15 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  colorOption: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#FFFFFF30', alignItems: 'center', justifyContent: 'center' },
  error: { color: '#FF7A8E', fontSize: 12, marginBottom: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  cancel: { borderWidth: 1, borderColor:'#76B9F76B',backgroundColor:'#0B3A794A', borderRadius: 99, paddingVertical: 12, paddingHorizontal: 17 },
  cancelText: { color: NEON_THEME.text, fontWeight: '600' },
  create: { borderRadius: 99,borderWidth:1,borderColor:'#76D5FFB3',backgroundColor:'#096FE3', paddingVertical: 12, paddingHorizontal: 18,overflow:'hidden' },
});
