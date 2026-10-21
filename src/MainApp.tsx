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
  GoalType,
  Habit,
  HabitGoal,
  MARKS,
  MARK_COLORS,
  MarkType,
  Subtask,
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
  pad,
  parseKey,
  uid,
} from './utils';
import { loadAppState, saveAppState, seedState } from './storage';

function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function formatTimerReadable(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0 && s > 0) return `${m} dk ${s} sn`;
  if (m > 0) return `${m} dk`;
  return `${s} sn`;
}

function getQuickSteps(goal: HabitGoal): number[] {
  const t = goal.target || 10;
  if (goal.type === 'reps') {
    if (t <= 15) return [1, 2, 5];
    if (t <= 50) return [1, 5, 10, 15];
    return [5, 10, 20, 25];
  }
  if (t <= 15) return [1, 2, 5];
  if (t <= 100) return [5, 10, 25, 50];
  if (t <= 500) return [10, 25, 50, 100];
  if (t <= 1500) return [50, 100, 250, 500];
  return [100, 200, 250, 500];
}

function getProfileInitials(firstName?: string, lastName?: string): string {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (f && l) {
    return (f[0] + l[0]).toLocaleUpperCase('tr-TR');
  }
  const parts = (f || l).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('tr-TR');
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  }
  return '';
}

function formatNowTimestamp(): string {
  const now = new Date();
  return `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

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

  // Ekle / Düzenle Modal Durumu (Container'a basılı tutunca açılır)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitName, setHabitName] = useState('');
  const [habitDetail, setHabitDetail] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('none');
  const [timerMin, setTimerMin] = useState('2');
  const [timerSec, setTimerSec] = useState('0');
  const [goalTargetStr, setGoalTargetStr] = useState('');
  const [goalUnit, setGoalUnit] = useState('');
  const [editorSubtasks, setEditorSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sayaç / Miktar / Tekrar Arayüzü Durumu (Container'a dokununca açılır)
  const [actionHabitId, setActionHabitId] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [customAmountStr, setCustomAmountStr] = useState('');

  // Profil Sayfası Durumu
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileSavedBanner, setProfileSavedBanner] = useState(false);

  // Hero emoji animasyonu
  const heroAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAppState().then((initial) => {
      setState(initial);
      setProfileFirstName(initial.profile?.firstName || '');
      setProfileLastName(initial.profile?.lastName || '');
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

  const getProgress = (habitId: string, dateStr: string): number => {
    return state.progress?.[habitId]?.[dateStr] || 0;
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

  const setProgressAndAutoMark = (
    habit: Habit,
    dateStr: string,
    newVal: number
  ) => {
    const clamped = Math.max(0, Math.round(newVal * 100) / 100);
    const target = habit.goal?.target || 0;
    updateAndSave((prev) => {
      const nextProgress = { ...(prev.progress || {}) };
      const habitProg = { ...(nextProgress[habit.id] || {}) };
      if (clamped > 0) {
        habitProg[dateStr] = clamped;
        nextProgress[habit.id] = habitProg;
      } else {
        delete habitProg[dateStr];
        if (Object.keys(habitProg).length === 0) {
          delete nextProgress[habit.id];
        } else {
          nextProgress[habit.id] = habitProg;
        }
      }

      const nextMarks = { ...prev.marks };
      const habitMarks = { ...(nextMarks[habit.id] || {}) };
      if (target > 0) {
        if (clamped >= target) {
          habitMarks[dateStr] = 'g';
          nextMarks[habit.id] = habitMarks;
        } else if (clamped > 0) {
          habitMarks[dateStr] = 'b';
          nextMarks[habit.id] = habitMarks;
        } else {
          delete habitMarks[dateStr];
          if (Object.keys(habitMarks).length === 0) {
            delete nextMarks[habit.id];
          } else {
            nextMarks[habit.id] = habitMarks;
          }
        }
      }
      return { ...prev, progress: nextProgress, marks: nextMarks };
    });
  };

  const actionHabit = useMemo(
    () => state.habits.find((h) => h.id === actionHabitId) || null,
    [state.habits, actionHabitId]
  );

  // Sayaç geri sayım döngüsü
  useEffect(() => {
    if (!timerRunning || !actionHabit || actionHabit.goal?.type !== 'timer') {
      return;
    }
    const targetSec = actionHabit.goal.target || 0;
    const interval = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          ).catch(() => {});
          setProgressAndAutoMark(actionHabit, today.key, targetSec);
          return 0;
        }
        const nextRem = prev - 1;
        const elapsed = Math.max(0, targetSec - nextRem);
        setProgressAndAutoMark(actionHabit, today.key, elapsed);
        return nextRem;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, actionHabit, today.key]);

  const handleCardPress = (habit: Habit) => {
    if (!habit.goal || habit.goal.type === 'none' || habit.goal.target <= 0) {
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setTimerRunning(false);
    setCustomAmountStr('');
    if (habit.goal.type === 'timer') {
      const targetSec = habit.goal.target;
      const doneSec = getProgress(habit.id, today.key);
      const initialRem =
        doneSec > 0 && doneSec < targetSec ? targetSec - doneSec : targetSec;
      setTimerRemaining(initialRem);
    }
    setActionHabitId(habit.id);
  };

  const closeActionModal = () => {
    setTimerRunning(false);
    setActionHabitId(null);
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
    Haptics.selectionAsync().catch(() => {});
    if (profileOpen) {
      setProfileOpen(false);
    }
    if (tabId === state.tab) return;
    setReorderMode(false);
    updateAndSave((prev) => ({ ...prev, tab: tabId }));
  };

  const handleToggleProfile = () => {
    Haptics.selectionAsync().catch(() => {});
    setProfileSavedBanner(false);
    if (!profileOpen) {
      setProfileFirstName(state.profile?.firstName || '');
      setProfileLastName(state.profile?.lastName || '');
      setReorderMode(false);
    }
    setProfileOpen((prev) => !prev);
  };

  const handleSaveProfile = () => {
    const first = profileFirstName.trim();
    const last = profileLastName.trim();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    setProfileFirstName(first);
    setProfileLastName(last);
    updateAndSave((prev) => ({
      ...prev,
      profile: {
        ...(prev.profile || { firstName: '', lastName: '' }),
        firstName: first,
        lastName: last,
      },
    }));
    setProfileSavedBanner(true);
    setTimeout(() => {
      setProfileSavedBanner(false);
    }, 3000);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setEditingHabit(habit);
    setHabitName(habit ? habit.name : '');
    setHabitDetail(habit ? habit.detail : '');
    const g = habit?.goal;
    if (g && g.type !== 'none' && g.target > 0) {
      setGoalType(g.type);
      if (g.type === 'timer') {
        setTimerMin(String(Math.floor(g.target / 60)));
        setTimerSec(String(g.target % 60));
        setGoalTargetStr('');
        setGoalUnit('');
      } else {
        setGoalTargetStr(String(g.target));
        setGoalUnit(g.unit || (g.type === 'reps' ? 'tekrar' : ''));
        setTimerMin('2');
        setTimerSec('0');
      }
    } else {
      setGoalType('none');
      setTimerMin('2');
      setTimerSec('0');
      setGoalTargetStr('');
      setGoalUnit('');
    }
    setEditorSubtasks(habit?.subtasks ? [...habit.subtasks] : []);
    setNewSubtaskTitle('');
    setConfirmDelete(false);
    setEditorOpen(true);
  };

  const syncSubtasksIfEditing = (nextList: Subtask[]) => {
    setEditorSubtasks(nextList);
    if (editingHabit) {
      updateAndSave((prev) => ({
        ...prev,
        habits: prev.habits.map((h) =>
          h.id === editingHabit.id ? { ...h, subtasks: nextList } : h
        ),
      }));
    }
  };

  const handleAddSubtask = () => {
    const t = newSubtaskTitle.trim();
    if (!t) return;
    Haptics.selectionAsync().catch(() => {});
    const nextList = [...editorSubtasks, { id: uid(), title: t, done: false }];
    syncSubtasksIfEditing(nextList);
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (subId: string) => {
    Haptics.selectionAsync().catch(() => {});
    const nextList = editorSubtasks.map((s) =>
      s.id === subId ? { ...s, done: !s.done } : s
    );
    syncSubtasksIfEditing(nextList);
  };

  const handleRemoveSubtask = (subId: string) => {
    Haptics.selectionAsync().catch(() => {});
    const nextList = editorSubtasks.filter((s) => s.id !== subId);
    syncSubtasksIfEditing(nextList);
  };

  const saveEditor = () => {
    const trimmedName = habitName.trim();
    const trimmedDetail = habitDetail.trim();
    if (!trimmedName) {
      Alert.alert('Uyarı', 'Lütfen bir madde adı girin.');
      return;
    }

    let finalGoal: HabitGoal | undefined = undefined;
    if (goalType === 'timer') {
      const m = Math.max(0, parseInt(timerMin || '0', 10) || 0);
      const s = Math.max(0, parseInt(timerSec || '0', 10) || 0);
      const totalSec = m * 60 + s;
      if (totalSec <= 0) {
        Alert.alert('Uyarı', 'Lütfen geçerli bir sayaç süresi girin.');
        return;
      }
      finalGoal = { type: 'timer', target: totalSec, unit: 'sn' };
    } else if (goalType === 'reps') {
      const val = parseFloat(goalTargetStr.replace(',', '.')) || 0;
      if (val <= 0) {
        Alert.alert('Uyarı', 'Lütfen geçerli bir tekrar sayısı girin.');
        return;
      }
      finalGoal = {
        type: 'reps',
        target: Math.round(val),
        unit: 'tekrar',
      };
    } else if (goalType === 'amount') {
      const val = parseFloat(goalTargetStr.replace(',', '.')) || 0;
      if (val <= 0) {
        Alert.alert('Uyarı', 'Lütfen geçerli bir hedef miktar girin.');
        return;
      }
      finalGoal = {
        type: 'amount',
        target: val,
        unit: goalUnit.trim() || 'birim',
      };
    }

    // Eğer yeni bir alt başlık yazılıp "+ Ekle"ye basılmadıysa onu da dahil et
    const pendingSub = newSubtaskTitle.trim();
    const finalSubtasks = pendingSub
      ? [...editorSubtasks, { id: uid(), title: pendingSub, done: false }]
      : editorSubtasks;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    updateAndSave((prev) => {
      if (editingHabit) {
        return {
          ...prev,
          habits: prev.habits.map((h) =>
            h.id === editingHabit.id
              ? {
                  ...h,
                  name: trimmedName,
                  detail: trimmedDetail,
                  goal: finalGoal,
                  subtasks: finalSubtasks,
                }
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
            goal: finalGoal,
            subtasks: finalSubtasks,
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
      const nextProg = { ...(prev.progress || {}) };
      delete nextMarks[deleteId];
      delete nextProg[deleteId];
      return {
        ...prev,
        habits: prev.habits.filter((h) => h.id !== deleteId),
        marks: nextMarks,
        progress: nextProg,
      };
    });
    setEditorOpen(false);
  };

  // Yedekle (iOS/Android Share Sheet & Web İndirme)
  const handleExport = async () => {
    try {
      const nowStamp = formatNowTimestamp();
      const exportState: AppDataState = {
        ...state,
        profile: {
          firstName: state.profile?.firstName || '',
          lastName: state.profile?.lastName || '',
          ...state.profile,
          lastBackupAt: nowStamp,
        },
      };
      updateAndSave((prev) => ({
        ...prev,
        profile: {
          firstName: prev.profile?.firstName || '',
          lastName: prev.profile?.lastName || '',
          ...prev.profile,
          lastBackupAt: nowStamp,
        },
      }));

      const fileName = `gunluk-plan-${keyOf(new Date())}.json`;
      const jsonStr = JSON.stringify(exportState, null, 2);
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
        const nowStamp = formatNowTimestamp();
        const restoredFirstName =
          typeof parsed.profile?.firstName === 'string'
            ? parsed.profile.firstName
            : state.profile?.firstName || '';
        const restoredLastName =
          typeof parsed.profile?.lastName === 'string'
            ? parsed.profile.lastName
            : state.profile?.lastName || '';
        setProfileFirstName(restoredFirstName);
        setProfileLastName(restoredLastName);
        updateAndSave((prev) => ({
          v: 1,
          habits: parsed.habits,
          marks: parsed.marks,
          progress:
            parsed.progress && typeof parsed.progress === 'object'
              ? parsed.progress
              : {},
          tab: TABS.some((t) => t.id === parsed.tab)
            ? parsed.tab
            : TABS[0].id,
          profile: {
            firstName: restoredFirstName,
            lastName: restoredLastName,
            lastBackupAt:
              parsed.profile?.lastBackupAt || prev.profile?.lastBackupAt,
            lastRestoreAt: nowStamp,
          },
        }));
        Alert.alert('Başarılı', 'Yedek verileri başarıyla geri yüklendi.');
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
  const userInitials = getProfileInitials(
    state.profile?.firstName,
    state.profile?.lastName
  );
  const userFullName = [state.profile?.firstName, state.profile?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const allDoneToday = state.habits.filter(
    (h) => getMark(h.id, today.key) === 'g'
  ).length;
  const totalMarkedDays = Object.values(state.marks).reduce(
    (acc, m) => acc + Object.keys(m || {}).length,
    0
  );
  const maxBestStreak = state.habits.reduce(
    (max, h) =>
      Math.max(max, calculateStreaks(state.marks[h.id], today.key).best),
    0
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.bg }]}
    >
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      {/* Üst Başlık & Profil Dairesi */}
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
        <View style={styles.topbarLeft}>
          {profileOpen ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setProfileOpen(false);
              }}
              style={styles.backToHomeBtn}
              activeOpacity={0.75}
            >
              <Text style={[styles.backToHomeArrow, { color: theme.accent }]}>
                ‹
              </Text>
              <Text style={[styles.appTitle, { color: theme.text }]}>
                Profil
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.appTitle, { color: theme.muted }]}>
              Günlük Plan
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleToggleProfile}
          activeOpacity={0.8}
          accessibilityLabel="Profil sayfasını aç"
          style={[
            styles.profileCircleBtn,
            {
              backgroundColor: profileOpen
                ? theme.accent
                : theme.isDark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.07)',
              borderColor: theme.accent,
            },
          ]}
        >
          {userInitials ? (
            <Text
              style={[
                styles.profileCircleInitials,
                {
                  color: profileOpen ? theme.accentInk : theme.text,
                },
              ]}
            >
              {userInitials}
            </Text>
          ) : (
            <Text style={styles.profileCircleEmoji}>👤</Text>
          )}
        </TouchableOpacity>
      </View>

      {profileOpen ? (
        /* Profil Sayfası */
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={styles.mainContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Profil Özet Kartı */}
            <View
              style={[
                styles.card,
                styles.profileHeaderCard,
                {
                  backgroundColor: theme.surface,
                  borderRadius: theme.radius,
                  borderColor: theme.cardBorderColor,
                  borderWidth: theme.cardBorderWidth,
                },
              ]}
            >
              <View
                style={[
                  styles.profileBigAvatar,
                  {
                    backgroundColor: theme.accent,
                  },
                ]}
              >
                {userInitials ? (
                  <Text
                    style={[
                      styles.profileBigInitials,
                      { color: theme.accentInk },
                    ]}
                  >
                    {userInitials}
                  </Text>
                ) : (
                  <Text style={styles.profileBigEmoji}>👤</Text>
                )}
              </View>

              <Text
                style={[
                  styles.profileDisplayName,
                  {
                    color: theme.text,
                    fontStyle: theme.headItalic ? 'italic' : 'normal',
                  },
                ]}
              >
                {userFullName || 'Misafir Kullanıcı'}
              </Text>
              <Text style={[styles.profileSubtitle, { color: theme.muted }]}>
                {userFullName
                  ? 'Günlük Plan Profili'
                  : 'Aşağıdan adınızı ve soyadınızı kaydedebilirsiniz'}
              </Text>

              <View style={styles.profileStatsRow}>
                <View
                  style={[
                    styles.profileStatBox,
                    {
                      backgroundColor: theme.isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.035)',
                    },
                  ]}
                >
                  <Text
                    style={[styles.profileStatVal, { color: theme.text }]}
                  >
                    {state.habits.length}
                  </Text>
                  <Text
                    style={[styles.profileStatLbl, { color: theme.muted }]}
                  >
                    Toplam Madde
                  </Text>
                </View>

                <View
                  style={[
                    styles.profileStatBox,
                    {
                      backgroundColor: theme.isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.035)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.profileStatVal,
                      { color: MARK_COLORS.green },
                    ]}
                  >
                    {allDoneToday}/{state.habits.length}
                  </Text>
                  <Text
                    style={[styles.profileStatLbl, { color: theme.muted }]}
                  >
                    Bugün Tamam
                  </Text>
                </View>

                <View
                  style={[
                    styles.profileStatBox,
                    {
                      backgroundColor: theme.isDark
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(0,0,0,0.035)',
                    },
                  ]}
                >
                  <Text
                    style={[styles.profileStatVal, { color: theme.text }]}
                  >
                    {maxBestStreak} gün
                  </Text>
                  <Text
                    style={[styles.profileStatLbl, { color: theme.muted }]}
                  >
                    En Uzun Zincir
                  </Text>
                </View>
              </View>
            </View>

            {/* Ad Soyad Girme ve Kaydetme Kartı */}
            <View
              style={[
                styles.card,
                styles.profileSectionCard,
                {
                  backgroundColor: theme.surface,
                  borderRadius: theme.radius,
                  borderColor: theme.cardBorderColor,
                  borderWidth: theme.cardBorderWidth,
                },
              ]}
            >
              <Text
                style={[
                  styles.profileSectionTitle,
                  {
                    color: theme.text,
                    fontStyle: theme.headItalic ? 'italic' : 'normal',
                  },
                ]}
              >
                👤 Kişisel Bilgiler
              </Text>

              <Text style={[styles.inputLabel, { color: theme.text }]}>Ad</Text>
              <TextInput
                value={profileFirstName}
                onChangeText={setProfileFirstName}
                maxLength={40}
                placeholder="Adınızı girin"
                placeholderTextColor={theme.muted}
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
                Soyad
              </Text>
              <TextInput
                value={profileLastName}
                onChangeText={setProfileLastName}
                maxLength={40}
                placeholder="Soyadınızı girin"
                placeholderTextColor={theme.muted}
                onSubmitEditing={handleSaveProfile}
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

              <TouchableOpacity
                onPress={handleSaveProfile}
                activeOpacity={0.82}
                style={[
                  styles.primaryBtn,
                  styles.profileFullBtn,
                  { backgroundColor: theme.accent },
                ]}
              >
                <Text
                  style={[
                    styles.primaryBtnText,
                    { color: theme.accentInk, fontSize: 15 },
                  ]}
                >
                  ✓ Bilgileri Kaydet
                </Text>
              </TouchableOpacity>

              {profileSavedBanner && (
                <View
                  style={[
                    styles.profileSavedToast,
                    {
                      backgroundColor: 'rgba(34, 197, 94, 0.15)',
                      borderColor: MARK_COLORS.green,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.profileSavedToastText,
                      { color: MARK_COLORS.green },
                    ]}
                  >
                    ✓ Ad ve soyad bilgileriniz başarıyla kaydedildi.
                  </Text>
                </View>
              )}
            </View>

            {/* Yedekle / Yedekten Yükle Bilgileri ve İşlemleri Kartı */}
            <View
              style={[
                styles.card,
                styles.profileSectionCard,
                {
                  backgroundColor: theme.surface,
                  borderRadius: theme.radius,
                  borderColor: theme.cardBorderColor,
                  borderWidth: theme.cardBorderWidth,
                },
              ]}
            >
              <Text
                style={[
                  styles.profileSectionTitle,
                  {
                    color: theme.text,
                    fontStyle: theme.headItalic ? 'italic' : 'normal',
                  },
                ]}
              >
                💾 Yedekleme ve Geri Yükleme
              </Text>
              <Text
                style={[styles.profileSectionDesc, { color: theme.muted }]}
              >
                Tüm alışkanlıklarınız, zincirleriniz, sayaç/miktar kayıtlarınız
                ve profil bilgileriniz cihazınızda saklanır. Veri kaybını
                önlemek veya başka bir cihaza geçmek için verilerinizi
                yedekleyebilir ve istediğiniz zaman yedekten geri
                yükleyebilirsiniz.
              </Text>

              <View
                style={[
                  styles.backupInfoBox,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                    borderColor: theme.isDark
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(0,0,0,0.09)',
                  },
                ]}
              >
                <View style={styles.backupInfoRow}>
                  <Text
                    style={[styles.backupInfoLabel, { color: theme.muted }]}
                  >
                    Kayıtlı Alışkanlık:
                  </Text>
                  <Text style={[styles.backupInfoVal, { color: theme.text }]}>
                    {state.habits.length} madde ({TABS.length} kategori)
                  </Text>
                </View>
                <View style={styles.backupInfoRow}>
                  <Text
                    style={[styles.backupInfoLabel, { color: theme.muted }]}
                  >
                    Toplam İşaretlenen Gün:
                  </Text>
                  <Text style={[styles.backupInfoVal, { color: theme.text }]}>
                    {totalMarkedDays} kayıt
                  </Text>
                </View>
                <View style={styles.backupInfoRow}>
                  <Text
                    style={[styles.backupInfoLabel, { color: theme.muted }]}
                  >
                    Son Yedekleme:
                  </Text>
                  <Text style={[styles.backupInfoVal, { color: theme.text }]}>
                    {state.profile?.lastBackupAt || 'Henüz yedek alınmadı'}
                  </Text>
                </View>
                <View style={styles.backupInfoRow}>
                  <Text
                    style={[styles.backupInfoLabel, { color: theme.muted }]}
                  >
                    Son Geri Yükleme:
                  </Text>
                  <Text style={[styles.backupInfoVal, { color: theme.text }]}>
                    {state.profile?.lastRestoreAt ||
                      'Henüz geri yükleme yapılmadı'}
                  </Text>
                </View>
              </View>

              <View style={styles.profileBackupBtns}>
                <TouchableOpacity
                  onPress={handleExport}
                  activeOpacity={0.82}
                  style={[
                    styles.primaryBtn,
                    styles.profileFullBtn,
                    { backgroundColor: theme.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.primaryBtnText,
                      { color: theme.accentInk, fontSize: 15 },
                    ]}
                  >
                    📥 Yedekle (Dışa Aktar)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleImport}
                  activeOpacity={0.82}
                  style={[
                    styles.ghostBtn,
                    styles.profileFullBtn,
                    {
                      borderColor: theme.accent,
                      backgroundColor: theme.isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.02)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.ghostBtnText,
                      { color: theme.text, fontSize: 15 },
                    ]}
                  >
                    📤 Yedekten Yükle (Geri Yükle)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        /* Ana İçerik */
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
              const todayProg = getProgress(h.id, today.key);
              const hasActiveGoal =
                !!h.goal && h.goal.type !== 'none' && h.goal.target > 0;

              let goalBadgeText = '';
              if (hasActiveGoal && h.goal) {
                if (h.goal.type === 'timer') {
                  goalBadgeText =
                    todayProg > 0 && todayProg < h.goal.target
                      ? `⏱️ ${formatDuration(todayProg)} / ${formatTimerReadable(h.goal.target)}`
                      : `⏱️ ${formatTimerReadable(h.goal.target)}`;
                } else if (h.goal.type === 'reps') {
                  goalBadgeText = `🔁 ${todayProg}/${h.goal.target} tekrar`;
                } else if (h.goal.type === 'amount') {
                  goalBadgeText = `📊 ${todayProg}/${h.goal.target}${h.goal.unit ? ' ' + h.goal.unit : ''}`;
                }
              }

              return (
                <Pressable
                  key={h.id}
                  onPress={() => handleCardPress(h)}
                  onLongPress={() => openEditor(h)}
                  delayLongPress={380}
                  style={({ pressed }) => [
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
                      opacity: pressed ? 0.92 : 1,
                    },
                  ]}
                >
                  {/* Kart Üst Kısmı (Basılı tut: Düzenle · Dokun: Sayaç / Miktar) */}
                  <View style={styles.cardHead}>
                    <Pressable
                      onPress={() => handleCardPress(h)}
                      onLongPress={() => openEditor(h)}
                      delayLongPress={380}
                      style={({ pressed }) => [
                        styles.cardInfo,
                        { opacity: pressed ? 0.78 : 1 },
                      ]}
                    >
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
                        {!!goalBadgeText && (
                          <View
                            style={[
                              styles.goalChip,
                              {
                                backgroundColor: theme.isDark
                                  ? 'rgba(255,255,255,0.1)'
                                  : 'rgba(0,0,0,0.06)',
                                borderColor: theme.accent,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.goalChipText,
                                { color: theme.text },
                              ]}
                            >
                              {goalBadgeText}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Pressable>

                    {/* Bugün Butonu */}
                    <View style={styles.cardActions}>
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
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Alt Bilgi */}
        <View style={styles.footer}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View
                style={[styles.dotSmall, { backgroundColor: MARK_COLORS.green }]}
              />
              <Text style={[styles.legendText, { color: theme.muted }]}>
                Gün: dokun işaretle · basılı tut renk
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.dotSmall, { backgroundColor: theme.accent }]}
              />
              <Text style={[styles.legendText, { color: theme.muted }]}>
                Kart: dokun sayaç/miktar · basılı tut düzenle
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      )}

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
            const selected = !profileOpen && t.id === state.tab;
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

      {/* Madde Ekle / Düzenle Penceresi (Container'a basılı tutunca açılır) */}
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
                  maxHeight: '88%',
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
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
                  placeholder="Örn. Diş fırçalama, Göğüs egzersizi"
                  placeholderTextColor={theme.muted}
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
                  placeholder="Örn. Sabah & akşam, 3×12 tekrar"
                  placeholderTextColor={theme.muted}
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

                {/* Sayaç / Tekrar / Miktar Seçimi */}
                <Text style={[styles.inputLabel, { color: theme.text }]}>
                  Sayaç / Tekrar / Miktar
                </Text>
                <View style={styles.goalTypeRow}>
                  {(
                    [
                      { id: 'none', label: 'Yok' },
                      { id: 'timer', label: '⏱️ Sayaç' },
                      { id: 'reps', label: '🔁 Tekrar' },
                      { id: 'amount', label: '📊 Miktar' },
                    ] as { id: GoalType; label: string }[]
                  ).map((opt) => {
                    const active = goalType === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setGoalType(opt.id);
                        }}
                        style={[
                          styles.goalTypeBtn,
                          {
                            backgroundColor: active
                              ? theme.accent
                              : theme.isDark
                              ? 'rgba(255,255,255,0.06)'
                              : 'rgba(0,0,0,0.05)',
                            borderColor: active
                              ? theme.accent
                              : theme.isDark
                              ? 'rgba(255,255,255,0.16)'
                              : 'rgba(0,0,0,0.12)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.goalTypeBtnText,
                            {
                              color: active ? theme.accentInk : theme.text,
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {goalType === 'timer' && (
                  <View
                    style={[
                      styles.goalConfigBox,
                      {
                        backgroundColor: theme.isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.03)',
                        borderColor: theme.isDark
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(0,0,0,0.1)',
                      },
                    ]}
                  >
                    <View style={styles.inlineInputsRow}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.subInputLabel, { color: theme.muted }]}
                        >
                          Dakika
                        </Text>
                        <TextInput
                          value={timerMin}
                          onChangeText={(v) =>
                            setTimerMin(v.replace(/[^0-9]/g, ''))
                          }
                          keyboardType="number-pad"
                          maxLength={3}
                          placeholder="2"
                          placeholderTextColor={theme.muted}
                          style={[
                            styles.smallInput,
                            {
                              color: theme.text,
                              borderColor: theme.isDark
                                ? 'rgba(255,255,255,0.18)'
                                : 'rgba(0,0,0,0.15)',
                            },
                          ]}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.subInputLabel, { color: theme.muted }]}
                        >
                          Saniye
                        </Text>
                        <TextInput
                          value={timerSec}
                          onChangeText={(v) =>
                            setTimerSec(v.replace(/[^0-9]/g, ''))
                          }
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="0"
                          placeholderTextColor={theme.muted}
                          style={[
                            styles.smallInput,
                            {
                              color: theme.text,
                              borderColor: theme.isDark
                                ? 'rgba(255,255,255,0.18)'
                                : 'rgba(0,0,0,0.15)',
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.presetChipsRow}>
                      {[1, 2, 3, 5, 10, 15, 30].map((m) => (
                        <TouchableOpacity
                          key={m}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setTimerMin(String(m));
                            setTimerSec('0');
                          }}
                          style={[
                            styles.presetChip,
                            {
                              backgroundColor:
                                timerMin === String(m) &&
                                (timerSec === '0' || timerSec === '')
                                  ? theme.accent
                                  : theme.isDark
                                  ? 'rgba(255,255,255,0.08)'
                                  : 'rgba(0,0,0,0.06)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              {
                                color:
                                  timerMin === String(m) &&
                                  (timerSec === '0' || timerSec === '')
                                    ? theme.accentInk
                                    : theme.text,
                              },
                            ]}
                          >
                            {m} dk
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {goalType === 'reps' && (
                  <View
                    style={[
                      styles.goalConfigBox,
                      {
                        backgroundColor: theme.isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.03)',
                        borderColor: theme.isDark
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(0,0,0,0.1)',
                      },
                    ]}
                  >
                    <Text
                      style={[styles.subInputLabel, { color: theme.muted }]}
                    >
                      Hedef Tekrar Sayısı
                    </Text>
                    <TextInput
                      value={goalTargetStr}
                      onChangeText={(v) =>
                        setGoalTargetStr(v.replace(/[^0-9]/g, ''))
                      }
                      keyboardType="number-pad"
                      maxLength={5}
                      placeholder="Örn. 30"
                      placeholderTextColor={theme.muted}
                      style={[
                        styles.smallInput,
                        {
                          color: theme.text,
                          borderColor: theme.isDark
                            ? 'rgba(255,255,255,0.18)'
                            : 'rgba(0,0,0,0.15)',
                        },
                      ]}
                    />
                    <View style={styles.presetChipsRow}>
                      {[10, 15, 20, 30, 50, 100].map((r) => (
                        <TouchableOpacity
                          key={r}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setGoalTargetStr(String(r));
                          }}
                          style={[
                            styles.presetChip,
                            {
                              backgroundColor:
                                goalTargetStr === String(r)
                                  ? theme.accent
                                  : theme.isDark
                                  ? 'rgba(255,255,255,0.08)'
                                  : 'rgba(0,0,0,0.06)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              {
                                color:
                                  goalTargetStr === String(r)
                                    ? theme.accentInk
                                    : theme.text,
                              },
                            ]}
                          >
                            {r} tekrar
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {goalType === 'amount' && (
                  <View
                    style={[
                      styles.goalConfigBox,
                      {
                        backgroundColor: theme.isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.03)',
                        borderColor: theme.isDark
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(0,0,0,0.1)',
                      },
                    ]}
                  >
                    <View style={styles.inlineInputsRow}>
                      <View style={{ flex: 1.2 }}>
                        <Text
                          style={[styles.subInputLabel, { color: theme.muted }]}
                        >
                          Hedef Miktar
                        </Text>
                        <TextInput
                          value={goalTargetStr}
                          onChangeText={(v) =>
                            setGoalTargetStr(v.replace(/[^0-9.,]/g, ''))
                          }
                          keyboardType="numeric"
                          maxLength={7}
                          placeholder="Örn. 2000"
                          placeholderTextColor={theme.muted}
                          style={[
                            styles.smallInput,
                            {
                              color: theme.text,
                              borderColor: theme.isDark
                                ? 'rgba(255,255,255,0.18)'
                                : 'rgba(0,0,0,0.15)',
                            },
                          ]}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.subInputLabel, { color: theme.muted }]}
                        >
                          Birim
                        </Text>
                        <TextInput
                          value={goalUnit}
                          onChangeText={setGoalUnit}
                          maxLength={15}
                          placeholder="ml, g, kcal..."
                          placeholderTextColor={theme.muted}
                          style={[
                            styles.smallInput,
                            {
                              color: theme.text,
                              borderColor: theme.isDark
                                ? 'rgba(255,255,255,0.18)'
                                : 'rgba(0,0,0,0.15)',
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <View style={styles.presetChipsRow}>
                      {[
                        'ml',
                        'L',
                        'g',
                        'kcal',
                        'adım',
                        'bardak',
                        'sayfa',
                        'adet',
                      ].map((u) => (
                        <TouchableOpacity
                          key={u}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setGoalUnit(u);
                          }}
                          style={[
                            styles.presetChip,
                            {
                              backgroundColor:
                                goalUnit === u
                                  ? theme.accent
                                  : theme.isDark
                                  ? 'rgba(255,255,255,0.08)'
                                  : 'rgba(0,0,0,0.06)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              {
                                color:
                                  goalUnit === u ? theme.accentInk : theme.text,
                              },
                            ]}
                          >
                            {u}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Alt Başlıklar (Ana sayfada önizlemesi yok, sadece basılı tutup içine girince görünür) */}
                <Text
                  style={[
                    styles.inputLabel,
                    { color: theme.text, marginTop: 4 },
                  ]}
                >
                  Alt başlıklar{' '}
                  <Text style={{ fontWeight: '400', color: theme.muted }}>
                    ({editorSubtasks.length})
                  </Text>
                </Text>

                {editorSubtasks.length > 0 && (
                  <View style={styles.subtasksList}>
                    {editorSubtasks.map((st) => (
                      <View
                        key={st.id}
                        style={[
                          styles.subtaskItem,
                          {
                            backgroundColor: theme.isDark
                              ? 'rgba(255,255,255,0.05)'
                              : 'rgba(0,0,0,0.035)',
                            borderColor: theme.isDark
                              ? 'rgba(255,255,255,0.12)'
                              : 'rgba(0,0,0,0.09)',
                          },
                        ]}
                      >
                        <TouchableOpacity
                          onPress={() => handleToggleSubtask(st.id)}
                          style={[
                            styles.subtaskCheck,
                            {
                              borderColor: st.done
                                ? MARK_COLORS.green
                                : theme.muted,
                              backgroundColor: st.done
                                ? MARK_COLORS.green
                                : 'transparent',
                            },
                          ]}
                        >
                          {st.done && (
                            <Text style={styles.subtaskCheckIcon}>✓</Text>
                          )}
                        </TouchableOpacity>
                        <Text
                          onPress={() => handleToggleSubtask(st.id)}
                          style={[
                            styles.subtaskTitle,
                            {
                              color: st.done ? theme.muted : theme.text,
                              textDecorationLine: st.done
                                ? 'line-through'
                                : 'none',
                            },
                          ]}
                        >
                          {st.title}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveSubtask(st.id)}
                          style={styles.subtaskRemoveBtn}
                        >
                          <Text style={{ color: theme.muted, fontSize: 14 }}>
                            ✕
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.subtaskAddRow}>
                  <TextInput
                    value={newSubtaskTitle}
                    onChangeText={setNewSubtaskTitle}
                    maxLength={80}
                    placeholder="Alt başlık ekle..."
                    placeholderTextColor={theme.muted}
                    onSubmitEditing={handleAddSubtask}
                    style={[
                      styles.smallInput,
                      {
                        flex: 1,
                        marginBottom: 0,
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
                  <TouchableOpacity
                    onPress={handleAddSubtask}
                    style={[
                      styles.subtaskAddBtn,
                      { backgroundColor: theme.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.primaryBtnText,
                        { color: theme.accentInk },
                      ]}
                    >
                      ＋ Ekle
                    </Text>
                  </TouchableOpacity>
                </View>

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
                      style={[
                        styles.primaryBtnText,
                        { color: theme.accentInk },
                      ]}
                    >
                      Kaydet
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Container'a Dokununca Açılan Sayaç / Miktar / Tekrar Arayüzü */}
      <Modal
        visible={!!actionHabit && !!actionHabit.goal}
        transparent
        animationType="fade"
        onRequestClose={closeActionModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={styles.modalBackdropInner}
            onPress={closeActionModal}
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
              {actionHabit && actionHabit.goal && (
                <>
                  <View style={styles.actionModalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.editorTitle,
                          {
                            color: theme.text,
                            marginBottom: 2,
                            fontStyle: theme.headItalic ? 'italic' : 'normal',
                          },
                        ]}
                      >
                        {actionHabit.name}
                      </Text>
                      {!!actionHabit.detail && (
                        <Text
                          style={[styles.cardDetail, { color: theme.muted }]}
                        >
                          {actionHabit.detail}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        const h = actionHabit;
                        closeActionModal();
                        openEditor(h);
                      }}
                      style={[
                        styles.iconBtn,
                        {
                          backgroundColor: theme.isDark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.05)',
                          borderColor: 'transparent',
                        },
                      ]}
                    >
                      <Text style={{ color: theme.muted, fontSize: 16 }}>
                        ✎
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {actionHabit.goal.type === 'timer' ? (
                    (() => {
                      const targetSec = actionHabit.goal.target || 1;
                      const elapsedSec = Math.max(
                        0,
                        targetSec - timerRemaining
                      );
                      const timerPct = Math.min(
                        100,
                        Math.round((elapsedSec / targetSec) * 100)
                      );
                      const isFinished = timerRemaining <= 0;

                      return (
                        <View style={styles.timerContainer}>
                          <Text
                            style={[
                              styles.timerBigDigits,
                              {
                                color: isFinished
                                  ? MARK_COLORS.green
                                  : theme.text,
                              },
                            ]}
                          >
                            {formatDuration(timerRemaining)}
                          </Text>
                          <Text
                            style={[
                              styles.timerSubStatus,
                              { color: theme.muted },
                            ]}
                          >
                            {isFinished
                              ? '🎉 Süre tamamlandı!'
                              : timerRunning
                              ? 'Sayaç çalışıyor...'
                              : `Hedef süre: ${formatTimerReadable(targetSec)}`}
                          </Text>

                          <View
                            style={[
                              styles.actionProgressBg,
                              {
                                backgroundColor: theme.isDark
                                  ? 'rgba(255,255,255,0.1)'
                                  : 'rgba(0,0,0,0.08)',
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.actionProgressFill,
                                {
                                  width: `${timerPct}%`,
                                  backgroundColor: isFinished
                                    ? MARK_COLORS.green
                                    : theme.accent,
                                },
                              ]}
                            />
                          </View>

                          <View style={styles.presetChipsRow}>
                            {[
                              { label: '-15 sn', delta: -15 },
                              { label: '+15 sn', delta: 15 },
                              { label: '+1 dk', delta: 60 },
                            ].map((adj) => (
                              <TouchableOpacity
                                key={adj.label}
                                onPress={() => {
                                  Haptics.selectionAsync().catch(() => {});
                                  setTimerRemaining((prev) =>
                                    Math.max(0, prev + adj.delta)
                                  );
                                }}
                                style={[
                                  styles.presetChip,
                                  {
                                    backgroundColor: theme.isDark
                                      ? 'rgba(255,255,255,0.08)'
                                      : 'rgba(0,0,0,0.06)',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.presetChipText,
                                    { color: theme.text },
                                  ]}
                                >
                                  {adj.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>

                          <View style={styles.timerControlsRow}>
                            <TouchableOpacity
                              onPress={() => {
                                Haptics.impactAsync(
                                  Haptics.ImpactFeedbackStyle.Medium
                                ).catch(() => {});
                                if (timerRemaining <= 0) {
                                  setTimerRemaining(targetSec);
                                  setTimerRunning(true);
                                } else {
                                  setTimerRunning((r) => !r);
                                }
                              }}
                              style={[
                                styles.primaryBtn,
                                styles.timerMainBtn,
                                { backgroundColor: theme.accent },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.primaryBtnText,
                                  { color: theme.accentInk, fontSize: 15 },
                                ]}
                              >
                                {timerRunning
                                  ? '⏸ Duraklat'
                                  : timerRemaining <= 0
                                  ? '↺ Tekrar Başlat'
                                  : timerRemaining < targetSec
                                  ? '▶ Devam Et'
                                  : '▶ Başlat'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => {
                                Haptics.selectionAsync().catch(() => {});
                                setTimerRunning(false);
                                setTimerRemaining(targetSec);
                                setProgressAndAutoMark(
                                  actionHabit,
                                  today.key,
                                  0
                                );
                              }}
                              style={[
                                styles.ghostBtn,
                                {
                                  borderColor: theme.isDark
                                    ? 'rgba(255,255,255,0.22)'
                                    : 'rgba(0,0,0,0.18)',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.ghostBtnText,
                                  { color: theme.text },
                                ]}
                              >
                                ↺ Sıfırla
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <View style={styles.actionFooterRow}>
                            <TouchableOpacity
                              onPress={() => {
                                Haptics.notificationAsync(
                                  Haptics.NotificationFeedbackType.Success
                                ).catch(() => {});
                                setTimerRunning(false);
                                setTimerRemaining(0);
                                setProgressAndAutoMark(
                                  actionHabit,
                                  today.key,
                                  targetSec
                                );
                                closeActionModal();
                              }}
                              style={[
                                styles.completeGoalBtn,
                                { backgroundColor: MARK_COLORS.green },
                              ]}
                            >
                              <Text style={styles.completeGoalBtnText}>
                                ✓ Tamamlandı İşaretle
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={closeActionModal}
                              style={[
                                styles.ghostBtn,
                                {
                                  borderColor: theme.isDark
                                    ? 'rgba(255,255,255,0.22)'
                                    : 'rgba(0,0,0,0.18)',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.ghostBtnText,
                                  { color: theme.text },
                                ]}
                              >
                                Kapat
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })()
                  ) : (
                    (() => {
                      const targetVal = actionHabit.goal.target || 1;
                      const currentVal = getProgress(actionHabit.id, today.key);
                      const unitText =
                        actionHabit.goal.type === 'reps'
                          ? 'tekrar'
                          : actionHabit.goal.unit || '';
                      const progPct = Math.min(
                        100,
                        Math.round((currentVal / targetVal) * 100)
                      );
                      const steps = getQuickSteps(actionHabit.goal);

                      return (
                        <View style={styles.amountContainer}>
                          <View style={styles.amountHeaderNums}>
                            <Text
                              style={[
                                styles.amountBigValue,
                                {
                                  color:
                                    currentVal >= targetVal
                                      ? MARK_COLORS.green
                                      : theme.text,
                                },
                              ]}
                            >
                              {currentVal}
                            </Text>
                            <Text
                              style={[
                                styles.amountTargetText,
                                { color: theme.muted },
                              ]}
                            >
                              / {targetVal} {unitText} (%{progPct})
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.actionProgressBg,
                              {
                                backgroundColor: theme.isDark
                                  ? 'rgba(255,255,255,0.1)'
                                  : 'rgba(0,0,0,0.08)',
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.actionProgressFill,
                                {
                                  width: `${progPct}%`,
                                  backgroundColor:
                                    currentVal >= targetVal
                                      ? MARK_COLORS.green
                                      : theme.accent,
                                },
                              ]}
                            />
                          </View>

                          <Text
                            style={[
                              styles.subInputLabel,
                              { color: theme.muted, marginTop: 6 },
                            ]}
                          >
                            Hızlı Ekle / Çıkar
                          </Text>
                          <View style={styles.presetChipsRow}>
                            <TouchableOpacity
                              onPress={() => {
                                Haptics.selectionAsync().catch(() => {});
                                setProgressAndAutoMark(
                                  actionHabit,
                                  today.key,
                                  currentVal - steps[0]
                                );
                              }}
                              style={[
                                styles.quickStepBtn,
                                {
                                  backgroundColor: theme.isDark
                                    ? 'rgba(255,255,255,0.07)'
                                    : 'rgba(0,0,0,0.05)',
                                  borderColor: theme.isDark
                                    ? 'rgba(255,255,255,0.15)'
                                    : 'rgba(0,0,0,0.12)',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.quickStepBtnText,
                                  { color: theme.text },
                                ]}
                              >
                                -{steps[0]}
                              </Text>
                            </TouchableOpacity>
                            {steps.map((st) => (
                              <TouchableOpacity
                                key={st}
                                onPress={() => {
                                  Haptics.impactAsync(
                                    Haptics.ImpactFeedbackStyle.Light
                                  ).catch(() => {});
                                  setProgressAndAutoMark(
                                    actionHabit,
                                    today.key,
                                    currentVal + st
                                  );
                                }}
                                style={[
                                  styles.quickStepBtn,
                                  {
                                    backgroundColor: theme.accent,
                                    borderColor: theme.accent,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.quickStepBtnText,
                                    { color: theme.accentInk },
                                  ]}
                                >
                                  +{st} {unitText}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>

                          <Text
                            style={[
                              styles.subInputLabel,
                              { color: theme.muted, marginTop: 6 },
                            ]}
                          >
                            Özel Miktar Ekle
                          </Text>
                          <View style={styles.subtaskAddRow}>
                            <TextInput
                              value={customAmountStr}
                              onChangeText={(v) =>
                                setCustomAmountStr(v.replace(/[^0-9.,]/g, ''))
                              }
                              keyboardType="numeric"
                              maxLength={7}
                              placeholder={`Miktar (${unitText})`}
                              placeholderTextColor={theme.muted}
                              style={[
                                styles.smallInput,
                                {
                                  flex: 1,
                                  marginBottom: 0,
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
                            <TouchableOpacity
                              onPress={() => {
                                const val =
                                  parseFloat(
                                    customAmountStr.replace(',', '.')
                                  ) || 0;
                                if (val <= 0) return;
                                Haptics.impactAsync(
                                  Haptics.ImpactFeedbackStyle.Light
                                ).catch(() => {});
                                setProgressAndAutoMark(
                                  actionHabit,
                                  today.key,
                                  currentVal + val
                                );
                                setCustomAmountStr('');
                              }}
                              style={[
                                styles.subtaskAddBtn,
                                { backgroundColor: theme.accent },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.primaryBtnText,
                                  { color: theme.accentInk },
                                ]}
                              >
                                ＋ Ekle
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <View style={styles.actionFooterRow}>
                            <TouchableOpacity
                              onPress={() => {
                                Haptics.selectionAsync().catch(() => {});
                                setProgressAndAutoMark(
                                  actionHabit,
                                  today.key,
                                  0
                                );
                              }}
                              style={[
                                styles.ghostBtn,
                                {
                                  borderColor: theme.isDark
                                    ? 'rgba(255,255,255,0.22)'
                                    : 'rgba(0,0,0,0.18)',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.ghostBtnText,
                                  { color: theme.text },
                                ]}
                              >
                                ↺ Sıfırla
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => {
                                Haptics.notificationAsync(
                                  Haptics.NotificationFeedbackType.Success
                                ).catch(() => {});
                                setProgressAndAutoMark(
                                  actionHabit,
                                  today.key,
                                  targetVal
                                );
                                closeActionModal();
                              }}
                              style={[
                                styles.completeGoalBtn,
                                { backgroundColor: MARK_COLORS.green },
                              ]}
                            >
                              <Text style={styles.completeGoalBtnText}>
                                ✓ Hedefi Tamamla
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={closeActionModal}
                              style={[
                                styles.ghostBtn,
                                {
                                  borderColor: theme.isDark
                                    ? 'rgba(255,255,255,0.22)'
                                    : 'rgba(0,0,0,0.18)',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.ghostBtnText,
                                  { color: theme.text },
                                ]}
                              >
                                Kapat
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })()
                  )}
                </>
              )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  topbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backToHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    paddingRight: 8,
  },
  backToHomeArrow: {
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '700',
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCircleInitials: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  profileCircleEmoji: {
    fontSize: 16,
  },
  profileHeaderCard: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  profileBigAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  profileBigInitials: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  profileBigEmoji: {
    fontSize: 34,
  },
  profileDisplayName: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileSubtitle: {
    fontSize: 13,
    marginTop: 3,
    textAlign: 'center',
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    width: '100%',
  },
  profileStatBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  profileStatVal: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  profileStatLbl: {
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center',
  },
  profileSectionCard: {
    padding: 16,
    marginBottom: 14,
  },
  profileSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  profileSectionDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  profileFullBtn: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSavedToast: {
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  profileSavedToastText: {
    fontSize: 13,
    fontWeight: '700',
  },
  backupInfoBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 14,
  },
  backupInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backupInfoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  backupInfoVal: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  profileBackupBtns: {
    gap: 10,
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
    marginTop: 12,
  },
  goalChip: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 99,
    borderWidth: 1,
  },
  goalChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  goalTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  goalTypeBtn: {
    flex: 1,
    minWidth: 74,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTypeBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  goalConfigBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  inlineInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  subInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  smallInput: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  presetChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 99,
  },
  presetChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  subtasksList: {
    gap: 6,
    marginBottom: 10,
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  subtaskCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtaskCheckIcon: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  subtaskTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  subtaskRemoveBtn: {
    padding: 4,
  },
  subtaskAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  subtaskAddBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  timerContainer: {
    alignItems: 'center',
    paddingTop: 6,
  },
  timerBigDigits: {
    fontSize: 48,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  timerSubStatus: {
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 12,
  },
  actionProgressBg: {
    width: '100%',
    height: 10,
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 14,
  },
  actionProgressFill: {
    height: '100%',
    borderRadius: 99,
  },
  timerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    width: '100%',
  },
  timerMainBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    width: '100%',
  },
  completeGoalBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeGoalBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
  },
  amountContainer: {
    paddingTop: 4,
  },
  amountHeaderNums: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  amountBigValue: {
    fontSize: 38,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  amountTargetText: {
    fontSize: 16,
    fontWeight: '600',
  },
  quickStepBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  quickStepBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});
