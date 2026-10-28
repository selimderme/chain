import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TabConfig, TabId, NEON_THEME } from './constants';
import { InstantButton } from './InstantButton';
import { SheetBackdrop } from './SheetBackdrop';
import { SheetPressable, withAlpha } from './motion';

interface Props {
  tab: TabConfig | null;
  habitCount: number;
  canDelete: boolean;
  onClose: () => void;
  onEdit: (id: TabId) => void;
  onDelete: (id: TabId) => void;
}

export default function CategoryActions({ tab, habitCount, canDelete, onClose, onEdit, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => { setConfirming(false); }, [tab?.id]);
  if (!tab) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <SheetBackdrop />
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Sekme menüsünü kapat">
        <SheetPressable onDismiss={onClose} style={[styles.sheet, { borderColor: withAlpha(tab.color, 0.45) }]} onPress={(event) => event.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.identity}><Text style={styles.emoji}>{tab.emoji}</Text><Text style={styles.name}>{tab.name}</Text></View>
            {confirming ? <>
              <Text accessibilityRole="header" style={styles.title}>Bu sekme silinsin mi?</Text>
              <Text style={styles.description}>“{tab.name}” sekmesi, içindeki {habitCount} madde ve bu maddelerin takip kayıtları silinecek. Bu işlem geri alınamaz.</Text>
              <View style={styles.actions}>
                <InstantButton onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Vazgeç</Text></InstantButton>
                <InstantButton onPress={() => onDelete(tab.id)} style={styles.confirm}><Text style={styles.confirmText}>Evet, sekmeyi sil</Text></InstantButton>
              </View>
            </> : <>
              <InstantButton onPress={() => onEdit(tab.id)} style={styles.editOption}><Text style={styles.editText}>Sekmeyi düzenle</Text><Text style={styles.optionDetail}>Ad, emoji ve tema rengi</Text></InstantButton>
              <InstantButton disabled={!canDelete} onPress={() => setConfirming(true)} style={[styles.deleteOption, !canDelete && { opacity: 0.4 }]}>
                <Text style={styles.deleteText}>Sekmeyi sil</Text>
                <Text style={styles.optionDetail}>{habitCount} madde ve takip kayıtları</Text>
              </InstantButton>
              {!canDelete && <Text style={styles.optionDetail}>Son sekmeyi silmeden önce yeni bir sekme ekle.</Text>}
              <InstantButton onPress={onClose} style={[styles.cancel, styles.close]}><Text style={styles.cancelText}>Kapat</Text></InstantButton>
            </>}
          </ScrollView>
        </SheetPressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { padding: 22, backgroundColor: NEON_THEME.surface, borderWidth: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  emoji: { fontSize: 28 },
  name: { color: NEON_THEME.text, fontSize: 21, fontWeight: '800', flex: 1 },
  title: { color: NEON_THEME.text, fontSize: 18, fontWeight: '700', marginBottom: 10 },
  description: { color: NEON_THEME.muted, fontSize: 14, lineHeight: 22, marginBottom: 22 },
  deleteOption: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E5484D50', backgroundColor: '#E5484D12' },
  editOption: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#FFFFFF25', backgroundColor: '#FFFFFF08', marginBottom: 10 },
  editText: { color: NEON_THEME.text, fontSize: 16, fontWeight: '700' },
  deleteText: { color: '#FF8387', fontSize: 16, fontWeight: '700' },
  optionDetail: { color: NEON_THEME.muted, fontSize: 12, marginTop: 5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 },
  cancel: { paddingHorizontal: 18, paddingVertical: 13, borderRadius: 99, borderWidth: 1, borderColor: '#FFFFFF30' },
  cancelText: { color: NEON_THEME.text, fontWeight: '600', textAlign: 'center' },
  close: { marginTop: 14, alignSelf: 'flex-end' },
  confirm: { paddingHorizontal: 18, paddingVertical: 13, borderRadius: 99, backgroundColor: '#D7333C' },
  confirmText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
});
