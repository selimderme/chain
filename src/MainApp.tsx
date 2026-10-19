import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import {
  AppDataState,
  Habit,
  MARKS,
  MARK_COLORS,
  MarkType,
  TABS,
  TabConfig,
  TabId,
} from './constants';
import {
  calculateStreaks,
  dateKey,
  daysInMonth,
  formatDayTR,
  formatMonthTR,
  keyOf,
  parseKey,
  uid,
} from './utils';
import { loadAppState, saveAppState, seedState } from './storage';

interface MenuTarget {
  habitId: string;
  habitName: string;
  dateStr: string;
}

interface HabitWeekScrollProps {
  initialScrollX: number;
  rowViewportWidth: number;
  cellStep: number;
  scrollKey: string;
  children: React.ReactNode;
}

function HabitWeekScroll({
  initialScrollX,
  rowViewportWidth,
  cellStep,
  scrollKey,
  children,
}: HabitWeekScrollProps) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: initialScrollX, y: 0, animated: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [initialScrollX, scrollKey]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      directionalLockEnabled
      decelerationRate="fast"
      snapToInterval={cellStep}
      snapToAlignment="start"
      contentOffset={{ x: initialScrollX, y: 0 }}
      onLayout={() => {
        scrollRef.current?.scrollTo({
          x: initialScrollX,
          y: 0,
          animated: false,
        });
      }}
      style={[styles.chainScroll, { width: rowViewportWidth }]}
      contentContainerStyle={styles.chainRow}
    >
      {children}
    </ScrollView>
  );
}

export default function MainApp() {
  return (
    <SafeAreaProvider>
      <GunlukPlanScreen />
    </SafeAreaProvider>
  );
}

function GunlukPlanScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [state, setState] = useState<AppDataState>(() => seedState());
  const [loaded, setLoaded] = useState(false);

  const [today, setToday] = useState(() => {
    const now = new Date();
    return {
      now,
      key: keyOf(now),
      y: now.getFullYear(),
      m: now.getMonth(),
      d: now.getDate(),
    };
  });

  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });

  const [reorderMode, setReorderMode] = useState(false);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);

  // Ekle / Düzenle Modal Durumu
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitName, setHabitName] = useState('');
  const [habitDetail, setHabitDetail] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Hero emoji animasyonu
  const heroAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAppState().then((initial) => {
      setState(initial);
      setLoaded(true);
    });
  }, []);

  // Gün değişimini takip et (uygulama arka plandan öne geldiğinde)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        const now = new Date();
        const k = keyOf(now);
        setToday((prev) => {
          if (prev.key !== k) {
            setViewMonth({ y: now.getFullYear(), m: now.getMonth() });
          }
          return {
            now,
            key: k,
            y: now.getFullYear(),
            m: now.getMonth(),
            d: now.getDate(),
          };
        });
      }
    });
    return () => sub.remove();
  }, []);

  // Hero emoji sürekli animasyonu
  useEffect(() => {
    heroAnim.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(heroAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(heroAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state.tab, heroAnim]);

  const activeTab: TabConfig = useMemo(
    () => TABS.find((t) => t.id === state.tab) || TABS[0],
    [state.tab]
  );
  const theme = activeTab.theme;

  const updateAndSave = (updater: (prev: AppDataState) => AppDataState) => {
    setState((prev) => {
      const next = updater(prev);
      saveAppState(next);
      return next;
    });
  };

  const getMark = (habitId: string, dateStr: string): MarkType | '' => {
    return state.marks[habitId]?.[dateStr] || '';
  };

  const setMark = (habitId: string, dateStr: string, val: MarkType | '') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    updateAndSave((prev) => {
      const nextMarks = { ...prev.marks };
      const habitMarks = { ...(nextMarks[habitId] || {}) };
      if (val) {
        habitMarks[dateStr] = val;
        nextMarks[habitId] = habitMarks;
      } else {
        delete habitMarks[dateStr];
        if (Object.keys(habitMarks).length === 0) {
          delete nextMarks[habitId];
        } else {
          nextMarks[habitId] = habitMarks;
        }
      }
      return { ...prev, marks: nextMarks };
    });
  };

  const handleCellPress = (habit: Habit, dateStr: string) => {
    const current = getMark(habit.id, dateStr);
    setMark(habit.id, dateStr, current ? '' : 'g');
  };

  const handleCellLongPress = (habit: Habit, dateStr: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setMenuTarget({
      habitId: habit.id,
      habitName: habit.name,
      dateStr,
    });
  };

  const handleSelectTab = (tabId: TabId) => {
    if (tabId === state.tab) return;
    Haptics.selectionAsync().catch(() => {});
    setReorderMode(false);
    updateAndSave((prev) => ({ ...prev, tab: tabId }));
  };

  const changeMonth = (delta: number | 'today') => {
    Haptics.selectionAsync().catch(() => {});
    if (delta === 'today') {
      const now = new Date();
      setViewMonth({ y: now.getFullYear(), m: now.getMonth() });
    } else {
      const d = new Date(viewMonth.y, viewMonth.m + delta, 1);
      setViewMonth({ y: d.getFullYear(), m: d.getMonth() });
    }
  };

  const moveHabit = (habitId: string, direction: -1 | 1) => {
    Haptics.selectionAsync().catch(() => {});
    updateAndSave((prev) => {
      const tabHabits = prev.habits.filter((h) => h.tab === prev.tab);
      const ids = tabHabits.map((h) => h.id);
      const i = ids.indexOf(habitId);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= ids.length) return prev;
      [ids[i], ids[j]] = [ids[j], ids[i]];

      const slots: number[] = [];
      prev.habits.forEach((h, idx) => {
        if (h.tab === prev.tab) slots.push(idx);
      });
      const byId = new Map(prev.habits.map((h) => [h.id, h]));
      const nextHabits = [...prev.habits];
      ids.forEach((id, k) => {
        const item = byId.get(id);
        if (item) nextHabits[slots[k]] = item;
      });
      return { ...prev, habits: nextHabits };
    });
  };

  const openEditor = (habit: Habit | null) => {
    Haptics.selectionAsync().catch(() => {});
    setEditingHabit(habit);
    setHabitName(habit ? habit.name : '');
    setHabitDetail(habit ? habit.detail : '');
    setConfirmDelete(false);
    setEditorOpen(true);
  };

  const saveEditor = () => {
    const trimmedName = habitName.trim();
    const trimmedDetail = habitDetail.trim();
    if (!trimmedName) {
      Alert.alert('Uyarı', 'Lütfen bir madde adı girin.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    updateAndSave((prev) => {
      if (editingHabit) {
        return {
          ...prev,
          habits: prev.habits.map((h) =>
            h.id === editingHabit.id
              ? { ...h, name: trimmedName, detail: trimmedDetail }
              : h
          ),
        };
      }
      return {
        ...prev,
        habits: [
          ...prev.habits,
          {
            id: uid(),
            tab: prev.tab,
            name: trimmedName,
            detail: trimmedDetail,
          },
        ],
      };
    });
    setEditorOpen(false);
  };

  const handleDeleteHabit = () => {
    if (!editingHabit) return;
    if (!confirmDelete) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setConfirmDelete(true);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {}
    );
    const deleteId = editingHabit.id;
    updateAndSave((prev) => {
      const nextMarks = { ...prev.marks };
      delete nextMarks[deleteId];
      return {
        ...prev,
        habits: prev.habits.filter((h) => h.id !== deleteId),
        marks: nextMarks,
      };
    });
    setEditorOpen(false);
  };

  // Yedekle (iOS/Android Share Sheet & Web İndirme)
  const handleExport = async () => {
    try {
      const fileName = `gunluk-plan-${keyOf(new Date())}.json`;
      const jsonStr = JSON.stringify(state, null, 2);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, jsonStr, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Günlük Plan Yedeğini Kaydet',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Bilgi', `Yedek dosyası oluşturuldu: ${fileName}`);
      }
    } catch {
      Alert.alert('Hata', 'Yedek dosyası oluşturulurken bir sorun oluştu.');
    }
  };

  // Geri Yükle (iOS/Android/Web Document Picker)
  const handleImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'public.json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const asset = res.assets[0];
      let content = '';
      if (Platform.OS === 'web') {
        if (asset.file) {
          content = await asset.file.text();
        } else {
          const resp = await fetch(asset.uri);
          content = await resp.text();
        }
      } else {
        content = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed?.habits) || typeof parsed?.marks !== 'object') {
        throw new Error('format');
      }

      const applyRestore = () => {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
        updateAndSave(() => ({
          v: 1,
          habits: parsed.habits,
          marks: parsed.marks,
          tab: TABS.some((t) => t.id === parsed.tab)
            ? parsed.tab
            : TABS[0].id,
        }));
      };

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (
          window.confirm(
            'Mevcut verilerin yerine seçilen yedek yüklensin mi?'
          )
        ) {
          applyRestore();
        }
        return;
      }

      Alert.alert(
        'Yedeği Geri Yükle',
        'Mevcut verilerin yerine seçilen yedek yüklensin mi?',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Yükle',
            style: 'destructive',
            onPress: applyRestore,
          },
        ]
      );
    } catch {
      Alert.alert('Hata', 'Geçersiz yedek dosyası.');
    }
  };

  const tabHabits = useMemo(
    () => state.habits.filter((h) => h.tab === activeTab.id),
    [state.habits, activeTab.id]
  );

  const doneToday = useMemo(
    () => tabHabits.filter((h) => getMark(h.id, today.key) === 'g').length,
    [tabHabits, state.marks, today.key]
  );

  const pct = tabHabits.length
    ? Math.round((doneToday / tabHabits.length) * 100)
    : 0;

  const dim = daysInMonth(viewMonth.y, viewMonth.m);
  const isCurrentMonth =
    viewMonth.y === today.y && viewMonth.m === today.m;

  // Kart içinde tam 7 gün (1 hafta) görünecek şekilde hücre boyutu hesabı
  const leftBorderW = theme.leftAccentBar ? 6 : theme.cardBorderWidth;
  const rightBorderW = theme.cardBorderWidth;
  const cardInnerWidth = Math.max(
    230,
    windowWidth - 28 - 24 - leftBorderW - rightBorderW
  );
  const cellGap = 6;
  const cellSize = Math.floor((cardInnerWidth - cellGap * 6) / 7);
  const rowViewportWidth = cellSize * 7 + cellGap * 6;
  const cellStep = cellSize + cellGap;

  // Bugün hangi günse o günün haftası (Pazartesi..Pazar) başlangıçta görünsün
  const dayOfWeekFromMon = (today.now.getDay() + 6) % 7; // Pazartesi=0 ... Pazar=6
  const mondayOfTodayWeek = today.d - dayOfWeekFromMon;
  const startDay = isCurrentMonth
    ? Math.max(1, Math.min(mondayOfTodayWeek, dim - 6))
    : 1;
  const initialScrollX = (startDay - 1) * cellStep;
  const scrollKey = `${state.tab}-${viewMonth.y}-${viewMonth.m}-${today.key}`;

  // Hero emoji dönüşümü
  const emojiAnimatedStyle = useMemo(() => {
    switch (theme.anim) {
      case 'wobble':
        return {
          transform: [
            {
              rotate: heroAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['-6deg', '8deg'],
              }),
            },
          ],
        };
      case 'pulse':
        return {
          transform: [
            {
              scale: heroAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.14],
              }),
            },
          ],
        };
      case 'floaty':
        return {
          transform: [
            {
              translateY: heroAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -5],
              }),
            },
          ],
        };
      case 'flip':
        return {
          transform: [
            {
              scaleX: heroAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 0.85, 1],
              }),
            },
          ],
        };
      case 'glow':
      default:
        return {
          opacity: heroAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.88, 1],
          }),
          transform: [
            {
              scale: heroAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.97, 1.06],
              }),
            },
          ],
        };
    }
  }, [theme.anim, heroAnim]);

  const getCellRadiusStyle = (size: number) => {
    if (theme.cellArch) {
      return {
        borderTopLeftRadius: size / 2,
        borderTopRightRadius: size / 2,
        borderBottomLeftRadius: 5,
        borderBottomRightRadius: 5,
      };
    }
    return {
      borderRadius: Math.min(theme.cellRadius, size / 2),
    };
  };

  if (!loaded) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.bg },
        ]}
      >
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const daysArray = Array.from({ length: dim }, (_, idx) => idx + 1);
  const currentMenuMark = menuTarget
    ? getMark(menuTarget.habitId, menuTarget.dateStr)
    : '';

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.bg }]}
    >
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      {/* Üst Başlık */}
      <View
        style={[
          styles.topbar,
          {
            backgroundColor: theme.bg,
            borderBottomColor: theme.isDark
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(0,0,0,0.08)',
          },
        ]}
      >
        <Text style={[styles.appTitle, { color: theme.muted }]}>
          Günlük Plan
        </Text>
      </View>

      {/* Ana İçerik */}
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Kartı */}
        <View
          style={[
            styles.hero,
            {
              backgroundColor: theme.accent,
              borderRadius: theme.radius,
            },
          ]}
        >
          <View style={styles.heroTop}>
            <Animated.Text style={[styles.heroEmoji, emojiAnimatedStyle]}>
              {activeTab.emoji}
            </Animated.Text>
            <View style={styles.heroTextWrap}>
              <Text
                style={[
                  styles.heroTitle,
                  {
                    color: theme.accentInk,
                    fontStyle: theme.headItalic ? 'italic' : 'normal',
                  },
                ]}
              >
                {activeTab.name}
              </Text>
              <Text style={[styles.heroMotto, { color: theme.accentInk }]}>
                {activeTab.motto}
              </Text>
            </View>
          </View>

          <View style={styles.progressRow}>
            <Text style={[styles.progressLabel, { color: theme.accentInk }]}>
              Bugün {doneToday}/{tabHabits.length}
            </Text>
            <View
              style={[
                styles.progressBarBg,
                {
                  backgroundColor:
                    theme.accentInk === '#111111'
                      ? 'rgba(0,0,0,0.2)'
                      : 'rgba(255,255,255,0.28)',
                },
              ]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${pct}%`,
                    backgroundColor: theme.accentInk,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: theme.accentInk }]}>
              %{pct}
            </Text>
          </View>
        </View>

        {/* Araç Çubuğu (Ay Seçimi + Sırala + Madde Ekle) */}
        <View style={styles.toolbar}>
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => changeMonth(-1)}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.isDark
                    ? 'rgba(255,255,255,0.18)'
                    : 'rgba(0,0,0,0.15)',
                },
              ]}
              accessibilityLabel="Önceki ay"
            >
              <Text style={[styles.iconBtnText, { color: theme.text }]}>‹</Text>
            </TouchableOpacity>

            <Text
              style={[
                styles.monthTitle,
                {
                  color: theme.text,
                  fontStyle: theme.headItalic ? 'italic' : 'normal',
                },
              ]}
            >
              {formatMonthTR(viewMonth.y, viewMonth.m)}
            </Text>

            <TouchableOpacity
              onPress={() => changeMonth(1)}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.isDark
                    ? 'rgba(255,255,255,0.18)'
                    : 'rgba(0,0,0,0.15)',
                },
              ]}
              accessibilityLabel="Sonraki ay"
            >
              <Text style={[styles.iconBtnText, { color: theme.text }]}>›</Text>
            </TouchableOpacity>
          </View>

          {!isCurrentMonth && (
            <TouchableOpacity
              onPress={() => changeMonth('today')}
              style={[
                styles.pillBtn,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.accent,
                },
              ]}
            >
              <Text style={[styles.pillBtnText, { color: theme.text }]}>
                Bu aya dön
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.toolbarRight}>
            {(tabHabits.length > 1 || reorderMode) && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setReorderMode((v) => !v);
                }}
                style={[
                  reorderMode ? styles.primaryBtn : styles.pillBtn,
                  reorderMode
                    ? { backgroundColor: theme.accent }
                    : {
                        backgroundColor: theme.surface,
                        borderColor: theme.accent,
                      },
                ]}
              >
                <Text
                  style={[
                    styles.pillBtnText,
                    {
                      color: reorderMode ? theme.accentInk : theme.text,
                    },
                  ]}
                >
                  {reorderMode ? '✓ Bitti' : '⇅ Sırala'}
                </Text>
              </TouchableOpacity>
            )}

            {!reorderMode && (
              <TouchableOpacity
                onPress={() => openEditor(null)}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: theme.accent },
                ]}
              >
                <Text
                  style={[styles.primaryBtnText, { color: theme.accentInk }]}
                >
                  ＋ Madde ekle
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Alışkanlık Kartları */}
        {tabHabits.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              {
                borderRadius: theme.radius,
                borderColor: theme.isDark
                  ? 'rgba(255,255,255,0.2)'
                  : 'rgba(0,0,0,0.18)',
              },
            ]}
          >
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              Bu sekmede henüz madde yok. “Madde ekle” ile başla.
            </Text>
          </View>
        ) : (
          <View style={styles.cardsList}>
            {tabHabits.map((h, i) => {
              if (reorderMode) {
                return (
                  <View
                    key={h.id}
                    style={[
                      styles.card,
                      styles.compactCard,
                      {
                        backgroundColor: theme.surface,
                        borderRadius: theme.radius,
                        borderColor: theme.cardBorderColor,
                        borderWidth: theme.cardBorderWidth,
                        borderLeftWidth: theme.leftAccentBar
                          ? 6
                          : theme.cardBorderWidth,
                        borderLeftColor:
                          theme.leftAccentBar || theme.cardBorderColor,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.dragHandleBadge,
                        {
                          backgroundColor: theme.isDark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.06)',
                        },
                      ]}
                    >
                      <Text style={{ color: theme.muted, fontSize: 18 }}>
                        ⠿
                      </Text>
                    </View>
                    <View style={styles.compactInfo}>
                      <Text
                        style={[
                          styles.cardTitle,
                          {
                            color: theme.text,
                            fontStyle: theme.headItalic ? 'italic' : 'normal',
                          },
                        ]}
                      >
                        {h.name}
                      </Text>
                      {!!h.detail && (
                        <Text
                          style={[styles.cardDetail, { color: theme.muted }]}
                        >
                          {h.detail}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      disabled={i === 0}
                      onPress={() => moveHabit(h.id, -1)}
                      style={[
                        styles.iconBtn,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.isDark
                            ? 'rgba(255,255,255,0.18)'
                            : 'rgba(0,0,0,0.15)',
                          opacity: i === 0 ? 0.3 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: theme.text, fontSize: 13 }}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={i === tabHabits.length - 1}
                      onPress={() => moveHabit(h.id, 1)}
                      style={[
                        styles.iconBtn,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.isDark
                            ? 'rgba(255,255,255,0.18)'
                            : 'rgba(0,0,0,0.15)',
                          opacity: i === tabHabits.length - 1 ? 0.3 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: theme.text, fontSize: 13 }}>▼</Text>
                    </TouchableOpacity>
                  </View>
                );
              }

              const { cur, best } = calculateStreaks(
                state.marks[h.id],
                today.key
              );
              let monthDone = 0;
              for (let d = 1; d <= dim; d++) {
                if (getMark(h.id, dateKey(viewMonth.y, viewMonth.m, d)) === 'g') {
                  monthDone++;
                }
              }
              const todayMark = getMark(h.id, today.key);
              const todayMarkObj = todayMark ? MARKS[todayMark] : null;

              return (
                <View
                  key={h.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme.surface,
                      borderRadius: theme.radius,
                      borderColor: theme.cardBorderColor,
                      borderWidth: theme.cardBorderWidth,
                      borderLeftWidth: theme.leftAccentBar
                        ? 6
                        : theme.cardBorderWidth,
                      borderLeftColor:
                        theme.leftAccentBar || theme.cardBorderColor,
                    },
                  ]}
                >
                  {/* Kart Üst Kısmı */}
                  <View style={styles.cardHead}>
                    <View style={styles.cardInfo}>
                      <View style={styles.cardTitleGroup}>
                        <Text
                          style={[
                            styles.cardTitle,
                            {
                              color: theme.text,
                              fontStyle: theme.headItalic ? 'italic' : 'normal',
                            },
                          ]}
                        >
                          {h.name}
                        </Text>
                        {!!h.detail && (
                          <Text
                            style={[styles.cardDetail, { color: theme.muted }]}
                          >
                            {h.detail}
                          </Text>
                        )}
                      </View>
                      <View style={styles.cardStats}>
                        <Text style={[styles.statText, { color: theme.muted }]}>
                          🔗 Zincir:{' '}
                          <Text style={[styles.statBold, { color: theme.text }]}>
                            {cur}
                          </Text>{' '}
                          gün
                        </Text>
                        <Text style={[styles.statText, { color: theme.muted }]}>
                          🏆 En uzun:{' '}
                          <Text style={[styles.statBold, { color: theme.text }]}>
                            {best}
                          </Text>
                        </Text>
                        <Text style={[styles.statText, { color: theme.muted }]}>
                          📅 Bu ay:{' '}
                          <Text style={[styles.statBold, { color: theme.text }]}>
                            {monthDone}/{dim}
                          </Text>
                        </Text>
                      </View>
                    </View>

                    {/* Düzenle & Bugün Butonu */}
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        onPress={() => openEditor(h)}
                        style={styles.editBtn}
                        accessibilityLabel={`${h.name} maddesini düzenle`}
                      >
                        <Text style={{ color: theme.muted, fontSize: 18 }}>
                          ✎
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.todayBtnWrap}>
                        <Pressable
                          onPress={() => handleCellPress(h, today.key)}
                          onLongPress={() => handleCellLongPress(h, today.key)}
                          delayLongPress={380}
                          style={({ pressed }) => [
                            styles.todayBtn,
                            getCellRadiusStyle(46),
                            {
                              backgroundColor: todayMarkObj
                                ? todayMarkObj.color
                                : theme.isDark
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(0,0,0,0.06)',
                              borderColor: todayMarkObj
                                ? 'transparent'
                                : theme.accent,
                              transform: [{ scale: pressed ? 0.92 : 1 }],
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.todayBtnNum,
                              {
                                color: todayMarkObj ? '#ffffff' : theme.text,
                              },
                            ]}
                          >
                            {today.d}
                          </Text>
                          {todayMarkObj && (
                            <Text style={styles.cellCornerSymbol}>
                              {todayMarkObj.symbol}
                            </Text>
                          )}
                        </Pressable>
                        <View
                          pointerEvents="none"
                          style={[
                            styles.todayBadge,
                            { backgroundColor: theme.accent },
                          ]}
                        >
                          <Text
                            allowFontScaling={false}
                            style={[
                              styles.todayBadgeText,
                              { color: theme.accentInk },
                            ]}
                          >
                            BUGÜN
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Aylık Zincir Kutuları (7 Günlük Haftalık Görünüm & Yatay Kaydırma) */}
                  <HabitWeekScroll
                    initialScrollX={initialScrollX}
                    rowViewportWidth={rowViewportWidth}
                    cellStep={cellStep}
                    scrollKey={scrollKey}
                  >
                    {daysArray.map((d) => {
                      const k = dateKey(viewMonth.y, viewMonth.m, d);
                      const mark = getMark(h.id, k);
                      const markObj = mark ? MARKS[mark] : null;
                      const isFuture = k > today.key;
                      const isToday = k === today.key;

                      return (
                        <Pressable
                          key={d}
                          disabled={isFuture}
                          onPress={() => handleCellPress(h, k)}
                          onLongPress={() => handleCellLongPress(h, k)}
                          delayLongPress={380}
                          style={({ pressed }) => [
                            styles.chainCell,
                            getCellRadiusStyle(cellSize),
                            {
                              width: cellSize,
                              height: cellSize,
                              backgroundColor: markObj
                                ? markObj.color
                                : theme.isDark
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(0,0,0,0.06)',
                              borderColor:
                                isToday && !markObj
                                  ? theme.accent
                                  : 'transparent',
                              opacity: isFuture ? 0.32 : 1,
                              transform: [{ scale: pressed ? 0.88 : 1 }],
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chainCellText,
                              {
                                color: markObj ? '#ffffff' : theme.muted,
                              },
                            ]}
                          >
                            {d}
                          </Text>
                          {markObj && (
                            <Text style={styles.cellCornerSymbol}>
                              {markObj.symbol}
                            </Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </HabitWeekScroll>
                </View>
              );
            })}
          </View>
        )}

        {/* Alt Bilgi & Yedekleme */}
        <View style={styles.footer}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View
                style={[styles.dotSmall, { backgroundColor: MARK_COLORS.green }]}
              />
              <Text style={[styles.legendText, { color: theme.muted }]}>
                Dokun: yeşil işaretle / kaldır
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.dotSmall, { backgroundColor: MARK_COLORS.blue }]}
              />
              <Text style={[styles.legendText, { color: theme.muted }]}>
                Basılı tut: renk seç
              </Text>
            </View>
          </View>

          <View style={styles.backupRow}>
            <TouchableOpacity onPress={handleExport} style={styles.linkBtn}>
              <Text style={[styles.linkBtnText, { color: activeTab.color }]}>
                Yedekle
              </Text>
            </TouchableOpacity>
            <Text style={{ color: theme.muted }}> · </Text>
            <TouchableOpacity onPress={handleImport} style={styles.linkBtn}>
              <Text style={[styles.linkBtnText, { color: activeTab.color }]}>
                Geri yükle
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Alt Sekme Çubuğu (Bottom Tab Bar) */}
      <View
        style={[
          styles.bottomTabBar,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.isDark
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(0,0,0,0.09)',
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
        >
          {TABS.map((t) => {
            const hs = state.habits.filter((h) => h.tab === t.id);
            const done = hs.filter(
              (h) => getMark(h.id, today.key) === 'g'
            ).length;
            const selected = t.id === state.tab;
            return (
              <TouchableOpacity
                key={t.id}
                activeOpacity={0.75}
                onPress={() => handleSelectTab(t.id)}
                style={[
                  styles.tabBtn,
                  selected && {
                    borderTopColor: t.color,
                    backgroundColor: theme.isDark
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                <Text style={styles.tabEmoji}>{t.emoji}</Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabName,
                    { color: selected ? theme.text : theme.muted },
                  ]}
                >
                  {t.name}
                </Text>
                <Text
                  style={[
                    styles.tabCount,
                    { color: selected ? theme.text : theme.muted },
                  ]}
                >
                  {done}/{hs.length}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Basılı Tutunca Açılan Renk Menüsü */}
      <Modal
        visible={!!menuTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTarget(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setMenuTarget(null)}
        >
          <Pressable
            style={[
              styles.menuSheet,
              {
                backgroundColor: theme.surface,
                borderColor: theme.isDark
                  ? 'rgba(255,255,255,0.16)'
                  : 'rgba(0,0,0,0.12)',
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {menuTarget && (
              <>
                <Text style={[styles.menuTitle, { color: theme.muted }]}>
                  {formatDayTR(parseKey(menuTarget.dateStr))} ·{' '}
                  {menuTarget.habitName}
                </Text>

                {(['g', 'b', 'r'] as MarkType[]).map((mk) => {
                  const info = MARKS[mk];
                  const isActive = currentMenuMark === mk;
                  return (
                    <TouchableOpacity
                      key={mk}
                      onPress={() => {
                        const target = menuTarget;
                        setMenuTarget(null);
                        setMark(target.habitId, target.dateStr, mk);
                      }}
                      style={[
                        styles.menuOption,
                        isActive && {
                          backgroundColor: theme.isDark
                            ? 'rgba(255,255,255,0.12)'
                            : 'rgba(0,0,0,0.08)',
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.dotMedium,
                          { backgroundColor: info.color },
                        ]}
                      />
                      <Text
                        style={[styles.menuOptionText, { color: theme.text }]}
                      >
                        {info.shortLabel}
                      </Text>
                      <Text
                        style={[styles.menuOptionSub, { color: theme.muted }]}
                      >
                        {info.subLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={() => {
                    const target = menuTarget;
                    setMenuTarget(null);
                    setMark(target.habitId, target.dateStr, '');
                  }}
                  style={[
                    styles.menuOption,
                    currentMenuMark === '' && {
                      backgroundColor: theme.isDark
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.dotMedium,
                      styles.dotClear,
                      { borderColor: theme.muted },
                    ]}
                  />
                  <Text style={[styles.menuOptionText, { color: theme.text }]}>
                    Temizle
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Madde Ekle / Düzenle Penceresi */}
      <Modal
        visible={editorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditorOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={styles.modalBackdropInner}
            onPress={() => setEditorOpen(false)}
          >
            <Pressable
              style={[
                styles.editorCard,
                {
                  backgroundColor: theme.surface,
                  borderRadius: theme.radius,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text
                style={[
                  styles.editorTitle,
                  {
                    color: theme.text,
                    fontStyle: theme.headItalic ? 'italic' : 'normal',
                  },
                ]}
              >
                {editingHabit ? 'Maddeyi düzenle' : 'Yeni madde'}
              </Text>

              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Madde adı
              </Text>
              <TextInput
                value={habitName}
                onChangeText={setHabitName}
                maxLength={60}
                placeholder="Örn. Göğüs egzersizi"
                placeholderTextColor={theme.muted}
                autoFocus
                style={[
                  styles.textInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                    borderColor: theme.isDark
                      ? 'rgba(255,255,255,0.18)'
                      : 'rgba(0,0,0,0.15)',
                  },
                ]}
              />

              <Text style={[styles.inputLabel, { color: theme.text }]}>
                Hedef / not{' '}
                <Text style={{ fontWeight: '400', color: theme.muted }}>
                  (isteğe bağlı)
                </Text>
              </Text>
              <TextInput
                value={habitDetail}
                onChangeText={setHabitDetail}
                maxLength={80}
                placeholder="Örn. 3×12 tekrar, 100 g, 2000 kcal"
                placeholderTextColor={theme.muted}
                onSubmitEditing={saveEditor}
                style={[
                  styles.textInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                    borderColor: theme.isDark
                      ? 'rgba(255,255,255,0.18)'
                      : 'rgba(0,0,0,0.15)',
                  },
                ]}
              />

              <View style={styles.editorActions}>
                {editingHabit && (
                  <TouchableOpacity
                    onPress={handleDeleteHabit}
                    style={[
                      styles.dangerBtn,
                      confirmDelete && styles.dangerBtnConfirm,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dangerBtnText,
                        confirmDelete && { color: '#ffffff' },
                      ]}
                    >
                      {confirmDelete ? 'Emin misin? Sil' : 'Sil'}
                    </Text>
                  </TouchableOpacity>
                )}

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                  onPress={() => setEditorOpen(false)}
                  style={[
                    styles.ghostBtn,
                    {
                      borderColor: theme.isDark
                        ? 'rgba(255,255,255,0.25)'
                        : 'rgba(0,0,0,0.22)',
                    },
                  ]}
                >
                  <Text style={[styles.ghostBtnText, { color: theme.text }]}>
                    Vazgeç
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={saveEditor}
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: theme.accent },
                  ]}
                >
                  <Text
                    style={[styles.primaryBtnText, { color: theme.accentInk }]}
                  >
                    Kaydet
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
  },
  topbar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  bottomTabBar: {
    borderTopWidth: 1,
    paddingTop: 4,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  tabsScroll: {
    flexDirection: 'row',
    gap: 6,
  },
  tabBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 3.5,
    borderTopColor: 'transparent',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    minWidth: 78,
  },
  tabEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabName: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabCount: {
    fontSize: 11,
    opacity: 0.85,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  mainScroll: {
    flex: 1,
  },
  mainContent: {
    padding: 14,
    paddingBottom: 28,
  },
  hero: {
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  heroEmoji: {
    fontSize: 36,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '800',
  },
  heroMotto: {
    fontSize: 13.5,
    fontStyle: 'italic',
    opacity: 0.92,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 99,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 10,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthTitle: {
    minWidth: 128,
    textAlign: 'center',
    fontSize: 15.5,
    fontWeight: '700',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '600',
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  primaryBtn: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  primaryBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  pillBtn: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderWidth: 1.8,
  },
  pillBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  ghostBtn: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1.8,
  },
  ghostBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  dangerBtn: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1.8,
    borderColor: '#dc2626',
  },
  dangerBtnConfirm: {
    backgroundColor: '#dc2626',
  },
  dangerBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#dc2626',
  },
  emptyBox: {
    paddingVertical: 36,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  cardsList: {
    gap: 10,
  },
  card: {
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  dragHandleBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactInfo: {
    flex: 1,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDetail: {
    fontSize: 12.5,
  },
  cardStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  statText: {
    fontSize: 12,
  },
  statBold: {
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtnWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 7,
    minWidth: 56,
  },
  todayBtn: {
    width: 46,
    height: 46,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  todayBadge: {
    position: 'absolute',
    top: 0,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  todayBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  todayBtnNum: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  chainScroll: {
    marginTop: 10,
    alignSelf: 'center',
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  chainCell: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chainCellText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cellCornerSymbol: {
    position: 'absolute',
    right: 2,
    bottom: 0,
    fontSize: 9,
    color: '#ffffff',
    fontWeight: '800',
  },
  footer: {
    marginTop: 22,
    alignItems: 'center',
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotSmall: {
    width: 11,
    height: 11,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 12.5,
  },
  backupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  linkBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  linkBtnText: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdropInner: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  menuSheet: {
    width: 260,
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  menuTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginHorizontal: 8,
    marginVertical: 6,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  dotMedium: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  dotClear: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  menuOptionText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  menuOptionSub: {
    marginLeft: 'auto',
    fontSize: 12.5,
    fontWeight: '500',
  },
  editorCard: {
    width: '100%',
    maxWidth: 400,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  editorTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.8,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 14,
  },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
});
