import { InstantButton as TouchableOpacity } from './InstantButton';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  LogBox,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Notifications from 'expo-notifications';

import {
  AppDataState,
  AuthUser,
  CloudSyncStatus,
  CustomTab,
  deleteTab,
  editTab,
  getStateTabs,
  normalizeDeletedTabs,
  normalizeTabEdits,
  reorderTabs,
  getTabs,
  normalizeCustomTabs,
  preserveLocalTabs,
  GoalType,
  Habit,
  HabitGoal,
  HABIT_EMOJIS,
  MainSection,
  MARKS,
  MARK_COLORS,
  MarkType,
  Subtask,
  TABS,
  TabConfig,
  TabTheme,
  TabId,
  TaskItem,
  TASKS_THEME,
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
  TR_MONTHS,
  TR_WEEKDAYS,
  TR_WEEKDAYS_SHORT,
  uid,
  visibleDayRange,
} from './utils';
import { loadAppState, saveAppState, seedState } from './storage';
import AuthScreen from './AuthScreen';
import CategoryEditor from './CategoryEditor';
import CategoryActions from './CategoryActions';
import { SheetBackdrop, SheetHost } from './SheetBackdrop';
import { useStableCallback } from './useStableCallback';
import { useHabitTimers } from './useHabitTimers';
import { activateLocalAccount, prepareLocalAccount } from './localAccounts';
import { CardSheen, CategoryIcon, AccentSheen, HabitEmblem, habitEmoji, NeonBackdrop, PlusIcon } from './NeonDesign';
import {
  ActivityHeatmap,
  animateLayout,
  AnimatedCheckCircle,
  AnimatedNumber,
  AnimatedProgressBar,
  ChainLink,
  ConfettiBurst,
  FadeSlideIn,
  FireworksCelebration,
  FloatingEmoji,
  LiquidWaveGauge,
  MarkPop,
  MicroIcon,
  MicroIconName,
  PopOnChange,
  PressableScale,
  ProgressRing,
  SheetPressable,
  SpringDragList,
  SpringDragItemControls,
  StreakIcon,
  SwipeableTaskRow,
  TaskRowMotion,
  ThemeCrossfade,
  withAlpha,
} from './motion';
import {
  clearAuthSession,
  fetchStateFromCloud,
  hasPendingCloudSync,
  loadAuthSession,
  syncStateToCloud,
} from './cloudSync';

const TIMER_PRESETS: { label: string; h: number; m: number }[] = [
  { label: '1 dk', h: 0, m: 1 },
  { label: '2 dk', h: 0, m: 2 },
  { label: '3 dk', h: 0, m: 3 },
  { label: '5 dk', h: 0, m: 5 },
  { label: '10 dk', h: 0, m: 10 },
  { label: '30 dk', h: 0, m: 30 },
  { label: '1 saat', h: 1, m: 0 },
  { label: '2 saat', h: 2, m: 0 },
  { label: '3 saat', h: 3, m: 0 },
];

const WHEEL_ITEM_HEIGHT = 42;
const WHEEL_VISIBLE_ITEMS = 3;
const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS;
const HOURS_LIST = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_LIST = Array.from({ length: 60 }, (_, i) => i);

const TASK_NOTIFICATION_CHANNEL_ID = 'gorev-hatirlatici';
const TASK_COMPLETE_COLOR = '#686868';

if (Platform.OS !== 'web') {
  try {
    LogBox.ignoreLogs([
      'expo-notifications: Android Push notifications',
      '`expo-notifications` functionality is not fully supported in Expo Go',
    ]);
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Ignore on environments where native notifications are unavailable
  }
}

function getTaskTriggerDate(dueStr?: string): Date | null {
  if (!dueStr || !dueStr.trim()) return null;
  const s = dueStr.trim();
  const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
  const h = timeMatch ? Math.min(23, Math.max(0, parseInt(timeMatch[1], 10))) : 9;
  const min = timeMatch ? Math.min(59, Math.max(0, parseInt(timeMatch[2], 10))) : 0;

  const now = new Date();
  for (let mIdx = 0; mIdx < TR_MONTHS.length; mIdx++) {
    const mName = TR_MONTHS[mIdx];
    const regex = new RegExp(`(\\d{1,2})\\s+${mName}(?:\\s+(\\d{4}))?`, 'i');
    const match = s.match(regex);
    if (match) {
      const d = Math.max(1, Math.min(31, parseInt(match[1], 10)));
      const y = match[2] ? parseInt(match[2], 10) : now.getFullYear();
      const dt = new Date(y, mIdx, d, h, min, 0, 0);
      if (!isNaN(dt.getTime())) {
        return dt;
      }
    }
  }
  return null;
}

async function ensureNotificationPermissions(promptUser = false): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (window.Notification.permission === 'granted') return true;
      if (promptUser && window.Notification.permission !== 'denied') {
        try {
          const perm = await window.Notification.requestPermission();
          return perm === 'granted';
        } catch {
          return false;
        }
      }
    }
    return false;
  }
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(TASK_NOTIFICATION_CHANNEL_ID, {
        name: 'Görev Bildirimleri',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF0000',
        sound: 'default',
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    if (
      existing.granted ||
      existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
      return true;
    }
    if (promptUser) {
      const requested = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      return (
        requested.granted ||
        requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
      );
    }
    return false;
  } catch {
    return false;
  }
}

async function syncTaskNotifications(tasks: TaskItem[], promptPerm = false): Promise<void> {
  if (Platform.OS === 'web') {
    if (promptPerm) {
      await ensureNotificationPermissions(true);
    }
    return;
  }
  try {
    const hasActiveDatedTasks = tasks.some((t) => !t.done && !!t.dueDate);
    const permitted = await ensureNotificationPermissions(promptPerm || hasActiveDatedTasks);
    if (!permitted) return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (item.identifier.startsWith('task-reminder-')) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }

    const nowMs = Date.now();
    for (const task of tasks) {
      if (task.done || !task.dueDate) continue;
      const triggerDate = getTaskTriggerDate(task.dueDate);
      if (!triggerDate || triggerDate.getTime() <= nowMs) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: `task-reminder-${task.id}`,
        content: {
          title: `🔔 Görev Zamanı: ${task.title}`,
          body: task.detail
            ? `${task.detail} (${task.dueDate})`
            : `📅 ${task.dueDate} için planlanan görevinizin zamanı geldi!`,
          sound: 'default',
          data: { taskId: task.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          ...(Platform.OS === 'android'
            ? { channelId: TASK_NOTIFICATION_CHANNEL_ID }
            : {}),
        },
      });
    }
  } catch {
    // Ignore errors on unsupported devices
  }
}

function formatTaskDueDate(
  y: number,
  m: number,
  d: number,
  hasTime: boolean,
  h: number,
  min: number
): string {
  const datePart = `${d} ${TR_MONTHS[m]} ${y}`;
  if (!hasTime) return datePart;
  return `${datePart} · ${pad(h)}:${pad(min)}`;
}

function parseTaskDueDate(dueStr?: string): {
  y: number;
  m: number;
  d: number;
  hasTime: boolean;
  h: number;
  min: number;
} {
  const now = new Date();
  const def = {
    y: now.getFullYear(),
    m: now.getMonth(),
    d: now.getDate(),
    hasTime: true,
    h: 12,
    min: 0,
  };
  if (!dueStr || !dueStr.trim()) return def;
  const s = dueStr.trim();
  const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
  const hasTime = !!timeMatch;
  const h = timeMatch ? Math.min(23, Math.max(0, parseInt(timeMatch[1], 10))) : 12;
  const min = timeMatch ? Math.min(59, Math.max(0, parseInt(timeMatch[2], 10))) : 0;

  for (let mIdx = 0; mIdx < TR_MONTHS.length; mIdx++) {
    const mName = TR_MONTHS[mIdx];
    const regex = new RegExp(`(\\d{1,2})\\s+${mName}(?:\\s+(\\d{4}))?`, 'i');
    const match = s.match(regex);
    if (match) {
      const d = Math.max(1, Math.min(31, parseInt(match[1], 10)));
      const y = match[2] ? parseInt(match[2], 10) : now.getFullYear();
      return { y, m: mIdx, d, hasTime, h, min };
    }
  }
  return { ...def, hasTime, h, min };
}

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
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} saat`);
  if (m > 0) parts.push(`${m} dk`);
  if (s > 0 && h === 0) parts.push(`${s} sn`);
  return parts.length > 0 ? parts.join(' ') : '0 dk';
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
  dayCount: number;
  cellSize: number;
  initialScrollX: number;
  rowViewportWidth: number;
  cellStep: number;
  scrollKey: string;
  onTouchChange?: (touching: boolean) => void;
  children: (first: number, last: number) => React.ReactNode;
}

function HabitWeekScroll({
  dayCount,
  cellSize,
  initialScrollX,
  rowViewportWidth,
  cellStep,
  scrollKey,
  onTouchChange,
  children,
}: HabitWeekScrollProps) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [offset, setOffset] = useState(initialScrollX);
  const [first, last] = visibleDayRange(dayCount, offset, cellStep, rowViewportWidth);

  useLayoutEffect(() => {
    setOffset(initialScrollX);
    scrollRef.current?.scrollTo({ x: initialScrollX, y: 0, animated: false });
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
      onScroll={(event) => {
        const next = event.nativeEvent.contentOffset.x;
        setOffset((previous) => Math.floor(previous / cellStep) === Math.floor(next / cellStep) ? previous : next);
      }}
      scrollEventThrottle={16}
      contentOffset={{ x: initialScrollX, y: 0 }}
      onTouchStart={() => onTouchChange?.(true)}
      onTouchEnd={() => onTouchChange?.(false)}
      onTouchCancel={() => onTouchChange?.(false)}
      onScrollBeginDrag={() => onTouchChange?.(true)}
      onScrollEndDrag={() => onTouchChange?.(false)}
      onMomentumScrollEnd={() => onTouchChange?.(false)}
      onLayout={() => {
        scrollRef.current?.scrollTo({
          x: initialScrollX,
          y: 0,
          animated: false,
        });
      }}
      style={[
        styles.chainScroll,
        { width: rowViewportWidth + 20, marginHorizontal: -10 },
      ]}
      contentContainerStyle={[
        styles.chainRow,
        { width: dayCount * cellStep - (cellStep - cellSize) + 20, height: cellSize + 24 },
      ]}
    >
      {children(first, last)}
    </ScrollView>
  );
}

interface TimeWheelColumnProps {
  label: string;
  items: number[];
  selectedValue: number;
  onValueChange: (val: number) => void;
  onWheelTouchChange?: (touching: boolean) => void;
}

function TimeWheelColumn({
  label,
  items,
  selectedValue,
  onValueChange,
  onWheelTouchChange,
}: TimeWheelColumnProps) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const isUserScrolling = useRef(false);
  const lastValRef = useRef(selectedValue);

  useEffect(() => {
    lastValRef.current = selectedValue;
    if (!isUserScrolling.current) {
      const idx = Math.max(0, items.indexOf(selectedValue));
      const timer = setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: idx * WHEEL_ITEM_HEIGHT,
          animated: false,
        });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedValue, items]);

  const handleOffset = (offsetY: number) => {
    const rawIdx = Math.round(offsetY / WHEEL_ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(items.length - 1, rawIdx));
    const val = items[clampedIdx];
    if (val !== undefined && val !== lastValRef.current) {
      lastValRef.current = val;
      Haptics.selectionAsync().catch(() => {});
      onValueChange(val);
    }
  };

  return (
    <View style={styles.wheelCol}>
      <Text style={styles.timeStepperLabel}>{label}</Text>
      <View
        style={styles.wheelBox}
        onTouchStart={() => {
          isUserScrolling.current = true;
          onWheelTouchChange?.(true);
        }}
        onTouchEnd={() => {
          onWheelTouchChange?.(false);
        }}
        onTouchCancel={() => {
          isUserScrolling.current = false;
          onWheelTouchChange?.(false);
        }}
      >
        <View pointerEvents="none" style={styles.wheelHighlightBar} />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          bounces={false}
          decelerationRate="fast"
          snapToInterval={WHEEL_ITEM_HEIGHT}
          snapToAlignment="start"
          scrollEventThrottle={16}
          contentOffset={{
            x: 0,
            y: Math.max(0, items.indexOf(selectedValue)) * WHEEL_ITEM_HEIGHT,
          }}
          onLayout={() => {
            const idx = Math.max(0, items.indexOf(selectedValue));
            scrollRef.current?.scrollTo({
              y: idx * WHEEL_ITEM_HEIGHT,
              animated: false,
            });
          }}
          onScrollBeginDrag={() => {
            isUserScrolling.current = true;
            onWheelTouchChange?.(true);
          }}
          onScroll={(e) => {
            handleOffset(e.nativeEvent.contentOffset.y);
          }}
          onScrollEndDrag={(e) => {
            handleOffset(e.nativeEvent.contentOffset.y);
            onWheelTouchChange?.(false);
          }}
          onMomentumScrollEnd={(e) => {
            isUserScrolling.current = false;
            onWheelTouchChange?.(false);
            handleOffset(e.nativeEvent.contentOffset.y);
          }}
          contentContainerStyle={{
            paddingVertical: WHEEL_ITEM_HEIGHT,
          }}
          style={styles.wheelScroll}
        >
          {items.map((item, idx) => {
            const isSelected = item === selectedValue;
            return (
              <Pressable
                key={item}
                onPress={() => {
                  isUserScrolling.current = false;
                  lastValRef.current = item;
                  Haptics.selectionAsync().catch(() => {});
                  onValueChange(item);
                  scrollRef.current?.scrollTo({
                    y: idx * WHEEL_ITEM_HEIGHT,
                    animated: true,
                  });
                }}
                style={styles.wheelItem}
              >
                <Text
                  style={[
                    styles.wheelItemText,
                    isSelected
                      ? styles.wheelItemTextSelected
                      : styles.wheelItemTextDim,
                  ]}
                >
                  {pad(item)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export default function MainApp() {
  return (
    <SafeAreaProvider>
      <SheetHost>
      <GunlukPlanScreen />
      </SheetHost>
    </SafeAreaProvider>
  );
}

function GunlukPlanScreen() {
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
  const [monthlyViewMode, setMonthlyViewMode] = useState(false);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [categoryMenuId, setCategoryMenuId] = useState<TabId | null>(null);
  const [categoryEditId, setCategoryEditId] = useState<TabId | null>(null);
  const [categoryDragging, setCategoryDragging] = useState(false);
  const categoryScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);

  // Ekle / Düzenle Modal Durumu (Container'a basılı tutunca açılır)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [habitName, setHabitName] = useState('');
  const [habitDetail, setHabitDetail] = useState('');
  const [habitEmojiChoice, setHabitEmojiChoice] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>('none');
  const [timerHour, setTimerHour] = useState('0');
  const [timerMin, setTimerMin] = useState('2');
  const [goalTargetStr, setGoalTargetStr] = useState('');
  const [goalUnit, setGoalUnit] = useState('');
  const [editorSubtasks, setEditorSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sayaç / Miktar / Tekrar Arayüzü Durumu (Container'a dokununca açılır)
  const [actionHabitId, setActionHabitId] = useState<string | null>(null);
  const [timerFinishKey, setTimerFinishKey] = useState(0);
  const [customAmountStr, setCustomAmountStr] = useState('');

  // Profil Sayfası Durumu
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileSavedBanner, setProfileSavedBanner] = useState(false);

  // Kimlik Doğrulama (Giriş / Kayıt) & Bulut Yedekleme Durumu
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [authScreenVisible, setAuthScreenVisible] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] =
    useState<CloudSyncStatus>('idle');
  const [cloudNoticeMsg, setCloudNoticeMsg] = useState('');

  // Görevler (Google Görevler benzeri) Durumu
  const [taskFilter, setTaskFilter] = useState<'all' | 'starred'>('all');
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [completedExpanded, setCompletedExpanded] = useState(true);
  const [taskReorderMode, setTaskReorderMode] = useState(false);
  const mainScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const tasksScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const ignoreHabitSwipeRef = useRef(false);
  const setListGestureActive = (active: boolean) => {
    (mainScrollRef.current as any)?.setNativeProps?.({ scrollEnabled: !active });
    (tasksScrollRef.current as any)?.setNativeProps?.({ scrollEnabled: !active });
  };
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetail, setTaskDetail] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskStarred, setTaskStarred] = useState(false);
  const [taskSubtasks, setTaskSubtasks] = useState<Subtask[]>([]);
  const [newTaskSubtaskTitle, setNewTaskSubtaskTitle] = useState('');
  const [confirmTaskDelete, setConfirmTaskDelete] = useState(false);
  // Sekmedeki tüm maddeler bugün tamamlanınca tetiklenen kutlama (konfeti) sayacı
  const [celebrateKey, setCelebrateKey] = useState(0);
  const prevDoneRef = useRef<{ tab: TabId; done: number } | null>(null);

  // Görev Tarih & Saat Seçici Arayüzü Durumu
  const [taskDatePickerOpen, setTaskDatePickerOpen] = useState(false);
  const [pickerViewYear, setPickerViewYear] = useState(() => new Date().getFullYear());
  const [pickerViewMonth, setPickerViewMonth] = useState(() => new Date().getMonth());
  const [pickerSelectedDate, setPickerSelectedDate] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
  });
  const [pickerHasTime, setPickerHasTime] = useState(true);
  const [pickerHour, setPickerHour] = useState(12);
  const [pickerMinute, setPickerMinute] = useState(0);
  const [pickerOuterScrollEnabled, setPickerOuterScrollEnabled] = useState(true);
  const firedWebNotifsRef = useRef<Set<string>>(new Set());
  const skipNextAutoCloudSyncRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AppDataState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const scheduleSaveAppState = (nextState: AppDataState) => {
    stateRef.current = nextState;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      saveAppState(stateRef.current);
    }, 150);
  };

  // Hero emoji animasyonu

  useEffect(() => {
    let mounted = true;
    Promise.all([
      loadAppState(),
      loadAuthSession(),
    ]).then(async ([loadedState, session]) => {
      if (!mounted) return;
      const pendingSync = session.user ? await hasPendingCloudSync(session.user) : false;
      const initial = session.user && session.user.provider !== 'guest'
        ? await prepareLocalAccount(session.user.uid, loadedState, seedState()) : loadedState;
      stateRef.current = initial;
      setState(initial);
      setProfileFirstName(initial.profile?.firstName || '');
      setProfileLastName(initial.profile?.lastName || '');
      setAuthUser(session.user);
      setOnboardingDone(session.hasCompletedOnboarding);
      setLoaded(true);

      if (session.user && session.user.provider !== 'guest') {
        await activateLocalAccount(session.user.uid, initial);
        try {
        if (pendingSync) {
          setCloudSyncStatus('syncing');
          const res = await syncStateToCloud(session.user, initial);
          if (!mounted) return;
          setCloudSyncStatus(res.ok ? 'synced' : 'offline-pending');
        } else {
          setCloudSyncStatus('syncing');
          const cloudState = await fetchStateFromCloud(session.user);
          if (!mounted) return;
          if (
            cloudState &&
            (cloudState.updatedAt || 0) > (initial.updatedAt || 0)
          ) {
            skipNextAutoCloudSyncRef.current = true;
            const restoredLocal = preserveLocalTabs(cloudState, stateRef.current);
            setState(restoredLocal);
            setProfileFirstName(cloudState.profile?.firstName || '');
            setProfileLastName(cloudState.profile?.lastName || '');
            await saveAppState(restoredLocal);
          }
          setCloudSyncStatus(cloudState ? 'synced' : 'idle');
        }
        setCloudReady(true);
        } catch (error) {
          setCloudSyncStatus('error');
          setCloudNoticeMsg(error instanceof Error ? error.message : 'Bulut bağlantısı kurulamadı.');
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Kullanıcı veri değiştirdiğinde önce yerel AsyncStorage'a kaydedilir,
  // ardından Google/Apple/E-posta ile giriş yapılmışsa arka planda otomatik buluta yedeklenir.
  useEffect(() => {
    if (!loaded || !cloudReady || !authUser || authUser.provider === 'guest') return;
    if (skipNextAutoCloudSyncRef.current) {
      skipNextAutoCloudSyncRef.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      setCloudSyncStatus('syncing');
      const res = await syncStateToCloud(authUser, stateRef.current);
      if (res.ok && res.syncedAt) {
        setCloudSyncStatus('synced');
      } else if (res.offline) {
        setCloudSyncStatus('offline-pending');
      } else {
        setCloudSyncStatus('error');
        if (res.error) setCloudNoticeMsg(res.error);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [loaded, cloudReady, authUser, state.updatedAt]);

  // Çevrimdışı iken yapılan değişiklikleri internet geldiğinde otomatik buluta gönder
  useEffect(() => {
    if (!loaded || !cloudReady || !authUser || authUser.provider === 'guest') return;

    const flushPendingIfOnline = async () => {
      const pending = await hasPendingCloudSync(authUser);
      if (!pending && cloudSyncStatus !== 'offline-pending') return;
      setCloudSyncStatus('syncing');
      const res = await syncStateToCloud(authUser, stateRef.current);
      if (res.ok) {
        setCloudSyncStatus('synced');
      } else {
        setCloudSyncStatus('offline-pending');
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', flushPendingIfOnline);
      return () => window.removeEventListener('online', flushPendingIfOnline);
    }

    const interval = setInterval(flushPendingIfOnline, 20000);
    return () => clearInterval(interval);
  }, [loaded, cloudReady, authUser, cloudSyncStatus]);

  // Görev bildirimlerini zamanla (iOS / Android yerel bildirimler)
  useEffect(() => {
    if (!loaded) return;
    syncTaskNotifications(state.tasks || [], false);
  }, [loaded, state.tasks]);

  // Web veya uygulama açıkken zamanı gelen görevleri kontrol et
  useEffect(() => {
    if (!loaded) return;
    const checkDueTasks = () => {
      const nowMs = Date.now();
      for (const task of state.tasks || []) {
        if (task.done || !task.dueDate) continue;
        const trig = getTaskTriggerDate(task.dueDate);
        if (!trig) continue;
        const diff = nowMs - trig.getTime();
        const key = `${task.id}:${task.dueDate}`;
        if (diff >= 0 && diff < 60000 && !firedWebNotifsRef.current.has(key)) {
          firedWebNotifsRef.current.add(key);
          if (
            Platform.OS === 'web' &&
            typeof window !== 'undefined' &&
            'Notification' in window &&
            window.Notification.permission === 'granted'
          ) {
            try {
              new window.Notification(`🔔 Görev Zamanı: ${task.title}`, {
                body: task.detail
                  ? `${task.detail} (${task.dueDate})`
                  : `📅 ${task.dueDate} için planlanan görevinizin zamanı geldi!`,
              });
            } catch {
              // ignore
            }
          }
        }
      }
    };
    checkDueTasks();
    const timer = setInterval(checkDueTasks, 15000);
    return () => clearInterval(timer);
  }, [loaded, state.tasks]);

  // Gün değişimini takip et (uygulama arka plandan öne geldiğinde) ve bekleyen bulut yedeği varsa eşitle
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
        if (cloudReady && authUser && authUser.provider !== 'guest') {
          hasPendingCloudSync(authUser).then(async (pending) => {
            if (pending) {
              setCloudSyncStatus('syncing');
              const res = await syncStateToCloud(authUser, stateRef.current);
              setCloudSyncStatus(res.ok ? 'synced' : 'offline-pending');
            }
          });
        }
      }
    });
    return () => sub.remove();
  }, [authUser, cloudReady]);

  const tabs = useMemo(() => getStateTabs(state), [state.customTabs, state.tabOrder, state.deletedTabs, state.tabEdits]);
  const categoryTabWidth = Math.max(68, Math.min(180, (Math.min(windowWidth, 760) - 54) / 4));
  const categoryScrollX = Math.max(0, (tabs.findIndex((tab) => tab.id === state.tab) + 0.5) * (categoryTabWidth + 4) - Math.min(windowWidth - 32, 728) / 2);
  useEffect(() => {
    categoryScrollRef.current?.scrollTo({ x: categoryScrollX, animated: false });
  }, [categoryScrollX, loaded, state.section, profileOpen]);
  const activeTab: TabConfig = useMemo(
    () => tabs.find((t) => t.id === state.tab) || tabs[0],
    [state.tab, tabs]
  );
  const isTasksMode = state.section === 'gorevler' && !profileOpen;
  const theme = isTasksMode ? TASKS_THEME : activeTab.theme;

  const updateAndSave = (updater: (prev: AppDataState) => AppDataState, sync = true) => {
    setState((prev) => {
      const updated = updater(prev);
      const next: AppDataState = {
        ...updated,
        updatedAt: sync ? Date.now() : prev.updatedAt,
      };
      scheduleSaveAppState(next);
      return next;
    });
  };

  // Giriş / Kayıt tamamlandığında çalışan ana işleyici:
  // Yeni bir cihazda Google/Apple/E-posta ile giriş yapıldığında buluttaki yedeği indirir,
  // eğer bulutta henüz yedek yoksa mevcut yerel verileri buluta yedekler.
  const handleUserAuthenticated = async (user: AuthUser) => {
    setCloudReady(false);
    setAuthUser(user);
    setOnboardingDone(true);
    setAuthScreenVisible(false);
    setCloudNoticeMsg('');

    if (user.provider === 'guest') {
      setCloudSyncStatus('idle');
      return;
    }

    setCloudSyncStatus('syncing');
    const localState = await prepareLocalAccount(user.uid, stateRef.current, seedState());
    // Show only the current account's local data even if cloud setup is incomplete.
    stateRef.current = localState;
    setState(localState);
    await saveAppState(localState);
    await activateLocalAccount(user.uid, localState);
    let cloudBackup: AppDataState | null;
    try { cloudBackup = await fetchStateFromCloud(user); }
    catch (error) {
      setCloudSyncStatus('error');
      setCloudNoticeMsg(error instanceof Error ? error.message : 'Bulut bağlantısı kurulamadı.');
      return;
    }

    if (cloudBackup) {
      skipNextAutoCloudSyncRef.current = true;
      const syncedNow = formatNowTimestamp();
      const restoredState: AppDataState = preserveLocalTabs({
        ...cloudBackup,
        profile: {
          firstName:
            cloudBackup.profile?.firstName ||
            user.firstName ||
            state.profile?.firstName ||
            '',
          lastName:
            cloudBackup.profile?.lastName ||
            user.lastName ||
            state.profile?.lastName ||
            '',
          ...cloudBackup.profile,
          email: user.email,
          authProvider: user.provider,
          lastCloudSyncAt: syncedNow,
          lastRestoreAt: syncedNow,
        },
      }, localState);
      setState(restoredState);
      setProfileFirstName(restoredState.profile?.firstName || '');
      setProfileLastName(restoredState.profile?.lastName || '');
      await saveAppState(restoredState);
      await activateLocalAccount(user.uid, restoredState);
      setCloudSyncStatus('synced');
      setCloudNoticeMsg(
        `✓ ${
          user.email || 'Hesabınız'
        } üzerindeki bulut yedeği telefonunuza otomatik olarak indirildi.`
      );
    } else {
      const syncedNow = formatNowTimestamp();
      const first = localState.profile?.firstName || user.firstName || '';
      const last = localState.profile?.lastName || user.lastName || '';
      setProfileFirstName(first);
      setProfileLastName(last);

      const nextState: AppDataState = {
        ...localState,
        updatedAt: Date.now(),
        profile: {
          ...(localState.profile || { firstName: '', lastName: '' }),
          firstName: first,
          lastName: last,
          email: user.email,
          authProvider: user.provider,
          lastCloudSyncAt: syncedNow,
        },
      };
      skipNextAutoCloudSyncRef.current = true;
      setState(nextState);
      await saveAppState(nextState);
      await activateLocalAccount(user.uid, nextState);
      const res = await syncStateToCloud(user, nextState);
      setCloudSyncStatus(res.ok ? 'synced' : res.offline ? 'offline-pending' : 'error');
      setCloudNoticeMsg(
        res.ok
          ? `✓ Mevcut tüm verileriniz ${
              user.email || 'hesabınıza'
            } başarıyla yedeklendi.`
          : res.error || 'Veriler cihazda saklanıyor; bulut bağlantısı bekleniyor.'
      );
    }
    setCloudReady(true);
  };

  const handleManualCloudBackup = async () => {
    if (!authUser || authUser.provider === 'guest') {
      setAuthScreenVisible(true);
      return;
    }
    if (!cloudReady) { await handleUserAuthenticated(authUser); return; }
    Haptics.selectionAsync().catch(() => {});
    setCloudSyncStatus('syncing');
    setCloudNoticeMsg('');
    const syncedNow = formatNowTimestamp();
    const nextState: AppDataState = {
      ...state,
      updatedAt: Date.now(),
      profile: {
        firstName: state.profile?.firstName || authUser.firstName || '',
        lastName: state.profile?.lastName || authUser.lastName || '',
        ...state.profile,
        email: authUser.email,
        authProvider: authUser.provider,
        lastCloudSyncAt: syncedNow,
      },
    };
    skipNextAutoCloudSyncRef.current = true;
    setState(nextState);
    await saveAppState(nextState);
    const res = await syncStateToCloud(authUser, nextState);
    if (res.ok) {
      setCloudSyncStatus('synced');
      setCloudNoticeMsg('✓ Tüm verileriniz bulut hesabınıza başarıyla yedeklendi.');
    } else {
      setCloudSyncStatus(res.offline ? 'offline-pending' : 'error');
      setCloudNoticeMsg(
        res.error || 'Veriler cihazda saklanıyor; bulut bağlantısı bekleniyor.'
      );
    }
  };

  const handleManualCloudRestore = async () => {
    if (!authUser || authUser.provider === 'guest') return;
    Haptics.selectionAsync().catch(() => {});
    setCloudSyncStatus('syncing');
    setCloudNoticeMsg('');
    let cloudBackup: AppDataState | null;
    try { cloudBackup = await fetchStateFromCloud(authUser); }
    catch (error) {
      setCloudSyncStatus('error');
      setCloudNoticeMsg(error instanceof Error ? error.message : 'Bulut yedeği yüklenemedi.');
      return;
    }
    if (cloudBackup) {
      skipNextAutoCloudSyncRef.current = true;
      const syncedNow = formatNowTimestamp();
      const restored: AppDataState = preserveLocalTabs({
        ...cloudBackup,
        profile: {
          firstName: cloudBackup.profile?.firstName || authUser.firstName || '',
          lastName: cloudBackup.profile?.lastName || authUser.lastName || '',
          ...cloudBackup.profile,
          email: authUser.email,
          authProvider: authUser.provider,
          lastCloudSyncAt: syncedNow,
          lastRestoreAt: syncedNow,
        },
      }, stateRef.current);
      setState(restored);
      setProfileFirstName(restored.profile?.firstName || '');
      setProfileLastName(restored.profile?.lastName || '');
      await saveAppState(restored);
      setCloudSyncStatus('synced');
      setCloudNoticeMsg('✓ Buluttaki en güncel yedek telefonunuza indirildi.');
    } else {
      setCloudSyncStatus('idle');
      setCloudNoticeMsg('ℹ️ Bu hesaba ait bulutta kayıtlı başka bir yedek bulunamadı.');
    }
  };

  const handleSignOut = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await clearAuthSession();
    setAuthUser(null);
    setCloudReady(false);
    setCloudSyncStatus('idle');
    setCloudNoticeMsg('');
    setAuthScreenVisible(true);
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
    newVal: number,
    sync = true
  ) => {
    const clamped = Math.max(0, Math.round(newVal * 100) / 100);
    const target = habit.goal?.target || 0;
    const prevVal = state.progress?.[habit.id]?.[dateStr] || 0;
    if (target > 0 && prevVal < target && clamped >= target) {
      setTimerFinishKey((k) => k + 1);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
    }
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
    }, sync);
  };

  const actionHabit = useMemo(
    () => state.habits.find((h) => h.id === actionHabitId) || null,
    [state.habits, actionHabitId]
  );

  const { timers, ready: timersReady } = useHabitTimers(loaded, state.habits, setProgressAndAutoMark);
  const actionTimer = actionHabit ? timers.get(actionHabit.id) : undefined;
  const timerRunning = actionTimer?.running ?? false;
  const targetSeconds = actionHabit?.goal?.target || 0;
  const savedSeconds = actionHabit ? getProgress(actionHabit.id, today.key) : 0;
  const timerRemaining = actionTimer?.remaining ??
    (savedSeconds > 0 && savedSeconds < targetSeconds ? targetSeconds - savedSeconds : targetSeconds);

  const handleCardPress = (habit: Habit) => {
    if (!habit.goal || habit.goal.type === 'none' || habit.goal.target <= 0) {
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setCustomAmountStr('');
    setActionHabitId(habit.id);
  };

  const closeActionModal = () => {
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

  const handleSelectSection = (sec: MainSection) => {
    if (!profileOpen && (state.section || 'rutin') === sec) return;
    Haptics.selectionAsync().catch(() => {});
    if (profileOpen) {
      setProfileOpen(false);
    }
    if (reorderMode) setReorderMode(false);
    if (taskReorderMode) setTaskReorderMode(false);
    setState((prev) => {
      if (prev.section === sec) return prev;
      const next = { ...prev, section: sec };
      scheduleSaveAppState(next);
      return next;
    });
  };

  const handleSelectTab = (tabId: TabId) => {
    if (
      !profileOpen &&
      (state.section || 'rutin') === 'rutin' &&
      state.tab === tabId
    ) {
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    if (profileOpen) {
      setProfileOpen(false);
    }
    if (reorderMode) setReorderMode(false);
    if (taskReorderMode) setTaskReorderMode(false);
    setState((prev) => {
      if ((prev.section || 'rutin') === 'rutin' && prev.tab === tabId) {
        return prev;
      }
      const next: AppDataState = { ...prev, section: 'rutin', tab: tabId };
      scheduleSaveAppState(next);
      return next;
    });
  };

  const handleToggleProfile = () => {
    Haptics.selectionAsync().catch(() => {});
    setProfileSavedBanner(false);
    if (!profileOpen) {
      setProfileFirstName(state.profile?.firstName || '');
      setProfileLastName(state.profile?.lastName || '');
      setReorderMode(false);
      setTaskReorderMode(false);
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

  const reorderHabit = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    updateAndSave((prev) => {
      const tabHabits = prev.habits.filter((h) => h.tab === prev.tab);
      const ids = tabHabits.map((h) => h.id);
      if (
        fromIndex < 0 ||
        fromIndex >= ids.length ||
        toIndex < 0 ||
        toIndex >= ids.length
      ) {
        return prev;
      }
      const [movedId] = ids.splice(fromIndex, 1);
      ids.splice(toIndex, 0, movedId);

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
    setHabitEmojiChoice(habit?.emoji || '');
    setEmojiPickerOpen(false);
    const g = habit?.goal;
    if (g && g.type !== 'none' && g.target > 0) {
      setGoalType(g.type);
      if (g.type === 'timer') {
        const totalMinutes = Math.max(1, Math.round(g.target / 60));
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        setTimerHour(String(h));
        setTimerMin(String(m));
        setGoalTargetStr('');
        setGoalUnit('');
      } else {
        setGoalTargetStr(String(g.target));
        setGoalUnit(g.unit || (g.type === 'reps' ? 'tekrar' : ''));
        setTimerHour('0');
        setTimerMin('2');
      }
    } else {
      setGoalType('none');
      setTimerHour('0');
      setTimerMin('2');
      setGoalTargetStr('');
      setGoalUnit('');
    }
    setEditorSubtasks(habit?.subtasks ? [...habit.subtasks] : []);
    setNewSubtaskTitle('');
    setConfirmDelete(false);
    setEditorOpen(true);
  };

  const handleCreateTab = (choices: Omit<CustomTab, 'id'>) => {
    const created: CustomTab = { ...choices, id: `custom-${uid()}` };
    setReorderMode(false);
    updateAndSave((prev) => ({
      ...prev,
      customTabs: [...(prev.customTabs || []), created],
      section: 'rutin',
      tab: created.id,
    }));
    setCategoryEditorOpen(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const openCategoryMenu = (id: TabId) => {
    if (!tabs.some((tab) => tab.id === id)) return;
    Haptics.selectionAsync().catch(() => {});
    setCategoryMenuId(id);
  };

  const handleDeleteTab = (id: TabId) => {
    updateAndSave((prev) => deleteTab(prev, id));
    setCategoryMenuId(null);
    setReorderMode(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleEditCategory = (id: TabId) => {
    setCategoryEditId(id);
    setCategoryMenuId(null);
    setCategoryEditorOpen(true);
  };

  const handleSaveCategory = (appearance: Omit<CustomTab, 'id'>) => {
    if (!categoryEditId) { handleCreateTab(appearance); return; }
    updateAndSave((prev) => editTab(prev, categoryEditId, appearance));
    setCategoryEditorOpen(false);
    setCategoryEditId(null);
  };

  const reorderCategories = (from: number, to: number) => {
    updateAndSave((prev) => reorderTabs(prev, from, to));
  };

  const moveCategory = (id: TabId, direction: -1 | 1) => {
    updateAndSave((prev) => {
      const from = getStateTabs(prev).findIndex((tab) => tab.id === id);
      return reorderTabs(prev, from, from + direction);
    });
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
      const h = Math.max(0, parseInt(timerHour || '0', 10) || 0);
      const m = Math.max(0, parseInt(timerMin || '0', 10) || 0);
      const totalSec = h * 3600 + m * 60;
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
    } else {
      finalGoal = { type: 'none', target: 0 };
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
                  emoji: habitEmojiChoice || undefined,
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
            emoji: habitEmojiChoice || undefined,
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

  // ───────── Görevler (Google Görevler benzeri) İşlemleri ─────────
  const handleQuickAddTask = () => {
    const trimmed = quickTaskTitle.trim();
    if (!trimmed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    const newTask: TaskItem = {
      id: uid(),
      title: trimmed,
      detail: '',
      dueDate: '',
      starred: taskFilter === 'starred',
      done: false,
      createdAt: formatNowTimestamp(),
      subtasks: [],
    };
    animateLayout();
    updateAndSave((prev) => ({
      ...prev,
      tasks: [newTask, ...(prev.tasks || [])],
    }));
    setQuickTaskTitle('');
  };

  const openTaskModal = (task: TaskItem | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setEditingTask(task);
    setTaskTitle(task ? task.title : '');
    setTaskDetail(task?.detail || '');
    setTaskDueDate(task?.dueDate || '');
    setTaskStarred(task ? !!task.starred : taskFilter === 'starred');
    setTaskSubtasks(task?.subtasks ? [...task.subtasks] : []);
    setNewTaskSubtaskTitle('');
    setConfirmTaskDelete(false);
    setTaskDatePickerOpen(false);
    setTaskModalOpen(true);
  };

  const openTaskDatePicker = () => {
    Haptics.selectionAsync().catch(() => {});
    const parsed = parseTaskDueDate(taskDueDate);
    setPickerViewYear(parsed.y);
    setPickerViewMonth(parsed.m);
    setPickerSelectedDate({ y: parsed.y, m: parsed.m, d: parsed.d });
    setPickerHasTime(parsed.hasTime);
    setPickerHour(parsed.h);
    setPickerMinute(parsed.min);
    setTaskDatePickerOpen(true);
  };

  const changePickerMonth = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    const d = new Date(pickerViewYear, pickerViewMonth + delta, 1);
    setPickerViewYear(d.getFullYear());
    setPickerViewMonth(d.getMonth());
  };

  const applyTaskDatePicker = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    ensureNotificationPermissions(true).catch(() => {});
    const formatted = formatTaskDueDate(
      pickerSelectedDate.y,
      pickerSelectedDate.m,
      pickerSelectedDate.d,
      pickerHasTime,
      pickerHour,
      pickerMinute
    );
    setTaskDueDate(formatted);
    setTaskDatePickerOpen(false);
  };

  const syncTaskSubtasksIfEditing = (nextList: Subtask[]) => {
    setTaskSubtasks(nextList);
    if (editingTask) {
      updateAndSave((prev) => ({
        ...prev,
        tasks: (prev.tasks || []).map((t) =>
          t.id === editingTask.id ? { ...t, subtasks: nextList } : t
        ),
      }));
    }
  };

  const handleAddTaskSubtask = () => {
    const t = newTaskSubtaskTitle.trim();
    if (!t) return;
    Haptics.selectionAsync().catch(() => {});
    const nextList = [...taskSubtasks, { id: uid(), title: t, done: false }];
    syncTaskSubtasksIfEditing(nextList);
    setNewTaskSubtaskTitle('');
  };

  const handleToggleTaskSubtaskModal = (subId: string) => {
    Haptics.selectionAsync().catch(() => {});
    const nextList = taskSubtasks.map((s) =>
      s.id === subId ? { ...s, done: !s.done } : s
    );
    syncTaskSubtasksIfEditing(nextList);
  };

  const handleRemoveTaskSubtaskModal = (subId: string) => {
    Haptics.selectionAsync().catch(() => {});
    const nextList = taskSubtasks.filter((s) => s.id !== subId);
    syncTaskSubtasksIfEditing(nextList);
  };

  const saveTaskModal = () => {
    const trimmedTitle = taskTitle.trim();
    const trimmedDetail = taskDetail.trim();
    const trimmedDue = taskDueDate.trim();
    if (!trimmedTitle) {
      Alert.alert('Uyarı', 'Lütfen bir görev adı girin.');
      return;
    }
    const pendingSub = newTaskSubtaskTitle.trim();
    const finalSubtasks = pendingSub
      ? [...taskSubtasks, { id: uid(), title: pendingSub, done: false }]
      : taskSubtasks;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    if (trimmedDue) {
      ensureNotificationPermissions(true).catch(() => {});
    }
    updateAndSave((prev) => {
      const currentTasks = prev.tasks || [];
      if (editingTask) {
        return {
          ...prev,
          tasks: currentTasks.map((t) =>
            t.id === editingTask.id
              ? {
                  ...t,
                  title: trimmedTitle,
                  detail: trimmedDetail,
                  dueDate: trimmedDue,
                  starred: taskStarred,
                  subtasks: finalSubtasks,
                }
              : t
          ),
        };
      }
      const newTask: TaskItem = {
        id: uid(),
        title: trimmedTitle,
        detail: trimmedDetail,
        dueDate: trimmedDue,
        starred: taskStarred,
        done: false,
        createdAt: formatNowTimestamp(),
        subtasks: finalSubtasks,
      };
      return {
        ...prev,
        tasks: [newTask, ...currentTasks],
      };
    });
    setTaskModalOpen(false);
  };

  const handleToggleTaskDone = (taskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const nowStamp = formatNowTimestamp();
    animateLayout();
    updateAndSave((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).map((t) =>
        t.id === taskId
          ? {
              ...t,
              done: !t.done,
              completedAt: !t.done ? nowStamp : undefined,
            }
          : t
      ),
    }));
  };

  const handleToggleTaskStar = (taskId: string) => {
    Haptics.selectionAsync().catch(() => {});
    updateAndSave((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).map((t) =>
        t.id === taskId ? { ...t, starred: !t.starred } : t
      ),
    }));
  };

  const handleToggleTaskSubtaskOnCard = (taskId: string, subId: string) => {
    Haptics.selectionAsync().catch(() => {});
    updateAndSave((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: (t.subtasks || []).map((s) =>
                s.id === subId ? { ...s, done: !s.done } : s
              ),
            }
          : t
      ),
    }));
  };

  const handleDeleteTaskFromModal = () => {
    if (!editingTask) return;
    if (!confirmTaskDelete) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setConfirmTaskDelete(true);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {}
    );
    const deleteId = editingTask.id;
    updateAndSave((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).filter((t) => t.id !== deleteId),
    }));
    setTaskModalOpen(false);
  };

  const handleDeleteSingleTask = (taskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    animateLayout();
    updateAndSave((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).filter((t) => t.id !== taskId),
    }));
  };

  const handleClearCompletedTasks = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {}
    );
    animateLayout();
    updateAndSave((prev) => ({
      ...prev,
      tasks: (prev.tasks || []).filter((t) => !t.done),
    }));
  };

  const moveTask = (taskId: string, direction: -1 | 1) => {
    Haptics.selectionAsync().catch(() => {});
    updateAndSave((prev) => {
      const allTasks = prev.tasks || [];
      const activeIds = allTasks.filter((t) => !t.done).map((t) => t.id);
      const i = activeIds.indexOf(taskId);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= activeIds.length) return prev;
      [activeIds[i], activeIds[j]] = [activeIds[j], activeIds[i]];

      const slots: number[] = [];
      allTasks.forEach((t, idx) => {
        if (!t.done) slots.push(idx);
      });
      const byId = new Map(allTasks.map((t) => [t.id, t]));
      const nextTasks = [...allTasks];
      activeIds.forEach((id, k) => {
        const item = byId.get(id);
        if (item) nextTasks[slots[k]] = item;
      });
      return { ...prev, tasks: nextTasks };
    });
  };

  const reorderTask = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    updateAndSave((prev) => {
      const allTasks = prev.tasks || [];
      const isMatch = (t: TaskItem) =>
        !t.done && (taskFilter === 'starred' ? !!t.starred : true);
      const activeIds = allTasks.filter(isMatch).map((t) => t.id);
      if (
        fromIndex < 0 ||
        fromIndex >= activeIds.length ||
        toIndex < 0 ||
        toIndex >= activeIds.length
      ) {
        return prev;
      }
      const [movedId] = activeIds.splice(fromIndex, 1);
      activeIds.splice(toIndex, 0, movedId);

      const slots: number[] = [];
      allTasks.forEach((t, idx) => {
        if (isMatch(t)) slots.push(idx);
      });
      const byId = new Map(allTasks.map((t) => [t.id, t]));
      const nextTasks = [...allTasks];
      activeIds.forEach((id, k) => {
        const item = byId.get(id);
        if (item) nextTasks[slots[k]] = item;
      });
      return { ...prev, tasks: nextTasks };
    });
  };

  // Yedekle (iOS/Android Share Sheet & Web İndirme)
  const handleExport = async () => {
    try {
      const nowStamp = formatNowTimestamp();
      const exportState: AppDataState = {
        ...state,
        habits: state.habits || [],
        marks: state.marks || {},
        progress: state.progress || {},
        tasks: state.tasks || [],
        profile: {
          firstName: state.profile?.firstName || '',
          lastName: state.profile?.lastName || '',
          ...state.profile,
          lastBackupAt: nowStamp,
        },
      };
      updateAndSave((prev) => ({
        ...prev,
        tasks: prev.tasks || [],
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
          dialogTitle: 'Günlük Rutin ve Görevler Yedeğini Kaydet',
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
      if (
        (!Array.isArray(parsed?.habits) && !Array.isArray(parsed?.tasks)) ||
        (parsed?.marks !== undefined && typeof parsed?.marks !== 'object')
      ) {
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
        const restoredCustomTabs = normalizeCustomTabs(parsed.customTabs);
        updateAndSave((prev) => ({
          v: 1,
          section:
            parsed.section === 'gorevler' || parsed.section === 'rutin'
              ? parsed.section
              : prev.section || 'rutin',
          habits: Array.isArray(parsed.habits) ? parsed.habits : prev.habits,
          marks:
            parsed.marks && typeof parsed.marks === 'object'
              ? parsed.marks
              : prev.marks,
          progress:
            parsed.progress && typeof parsed.progress === 'object'
              ? parsed.progress
              : {},
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
          customTabs: restoredCustomTabs,
          tabOrder: getTabs(restoredCustomTabs, parsed.tabOrder, parsed.deletedTabs, parsed.tabEdits).map((tab) => tab.id),
          deletedTabs: normalizeDeletedTabs(parsed.deletedTabs),
          tabEdits: normalizeTabEdits(parsed.tabEdits),
          tab: getTabs(restoredCustomTabs, parsed.tabOrder, parsed.deletedTabs, parsed.tabEdits).some((t) => t.id === parsed.tab)
            ? parsed.tab
            : getTabs(restoredCustomTabs, parsed.tabOrder, parsed.deletedTabs, parsed.tabEdits)[0].id,
          profile: {
            firstName: restoredFirstName,
            lastName: restoredLastName,
            lastBackupAt:
              parsed.profile?.lastBackupAt || prev.profile?.lastBackupAt,
            lastRestoreAt: nowStamp,
          },
        }));
        Alert.alert(
          'Başarılı',
          'Alışkanlıklar ve görevler yedekten başarıyla geri yüklendi.'
        );
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

  // Aynı sekmede son madde de tamamlanınca (%100) kutlama: konfeti + hero zıplaması + titreşim
  useEffect(() => {
    const prev = prevDoneRef.current;
    prevDoneRef.current = { tab: state.tab, done: doneToday };
    if (!loaded || !prev || prev.tab !== state.tab) return;
    if (
      tabHabits.length > 0 &&
      doneToday === tabHabits.length &&
      prev.done < doneToday
    ) {
      setCelebrateKey((k) => k + 1);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneToday, tabHabits.length, state.tab, loaded]);

  const dim = daysInMonth(viewMonth.y, viewMonth.m);
  const isCurrentMonth =
    viewMonth.y === today.y && viewMonth.m === today.m;

  // Kart içinde tam 7 gün (1 hafta) görünecek şekilde aktivite çemberi boyutu hesabı
  // mainContent yatay padding: 16*2 = 32, card yatay padding: 18*2 = 36
  const leftBorderW = theme.leftAccentBar ? 4 : theme.cardBorderWidth;
  const rightBorderW = theme.cardBorderWidth;
  const cardInnerWidth = Math.max(
    224,
    Math.min(windowWidth, 760) - 32 - 28 - leftBorderW - rightBorderW
  );
  const cellGap = 8;
  const cellSize = Math.floor((cardInnerWidth - cellGap * 6) / 7);
  const rowViewportWidth = cellSize * 7 + cellGap * 6;
  const cellStep = cellSize + cellGap;

  // Son yedi gün başlangıçta görünsün; ayın kalanına yatay kaydırılır.
  const weekStartDay = today.d - 6;
  const startDay = isCurrentMonth
    ? Math.max(1, Math.min(weekStartDay, dim - 6))
    : 1;
  const initialScrollX = (startDay - 1) * cellStep;
  const scrollKey = `${state.tab}-${viewMonth.y}-${viewMonth.m}-${today.key}`;

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

  // Profil: son 12 haftanın günlük tamamlanma ısı haritası
  const heatmapWeeks = useMemo(() => {
    if (!profileOpen) return [];
    const total = state.habits.length;
    const end = new Date(today.y, today.m, today.d);
    const dayFromMonday = (end.getDay() + 6) % 7;
    end.setDate(end.getDate() + (6 - dayFromMonday));
    const start = new Date(end);
    start.setDate(end.getDate() - (12 * 7 - 1));

    return Array.from({ length: 12 }, (_, weekIdx) =>
      Array.from({ length: 7 }, (_, dayIdx) => {
        const date = new Date(start);
        date.setDate(start.getDate() + weekIdx * 7 + dayIdx);
        const key = keyOf(date);
        let done = 0;
        for (const habit of state.habits) {
          if (state.marks[habit.id]?.[key] === 'g') done++;
        }
        return {
          key,
          ratio: total > 0 ? done / total : 0,
          future: key > today.key,
          today: key === today.key,
        };
      })
    );
  }, [profileOpen, state.habits, state.marks, today.y, today.m, today.d, today.key]);

  const heatmapPerfectDays = useMemo(
    () => heatmapWeeks.flat().filter((d) => !d.future && d.ratio >= 1).length,
    [heatmapWeeks]
  );
  const heatmapActiveDays = useMemo(
    () => heatmapWeeks.flat().filter((d) => !d.future && d.ratio > 0).length,
    [heatmapWeeks]
  );

  const daysArray = useMemo(
    () => Array.from({ length: dim }, (_, idx) => idx + 1),
    [dim]
  );
  const allDoneToday = useMemo(
    () =>
      state.habits.filter((h) => state.marks[h.id]?.[today.key] === 'g').length,
    [state.habits, state.marks, today.key]
  );
  const totalMarkedDays = useMemo(
    () => !profileOpen ? 0 :
      Object.values(state.marks).reduce(
        (acc, m) => acc + Object.keys(m || {}).length,
        0
      ),
    [profileOpen, state.marks]
  );
  const maxBestStreak = useMemo(
    () => !profileOpen ? 0 :
      state.habits.reduce(
        (max, h) =>
          Math.max(max, calculateStreaks(state.marks[h.id], today.key).best),
        0
      ),
    [profileOpen, state.habits, state.marks, today.key]
  );

  const stableHandleCardPress = useStableCallback(handleCardPress);
  const stableHandleCellPress = useStableCallback(handleCellPress);
  const stableHandleCellLongPress = useStableCallback(handleCellLongPress);
  const stableOpenEditor = useStableCallback(openEditor);
  const stableMoveHabit = useStableCallback(moveHabit);
  const stableSetListGestureActive = useStableCallback(setListGestureActive);
  const habitCardActions = useMemo<HabitCardActions>(() => ({
    handleCardPress: stableHandleCardPress,
    handleCellPress: stableHandleCellPress,
    handleCellLongPress: stableHandleCellLongPress,
    openEditor: stableOpenEditor,
    moveHabit: stableMoveHabit,
    setListGestureActive: stableSetListGestureActive,
  }), [stableHandleCardPress, stableHandleCellPress, stableHandleCellLongPress, stableOpenEditor, stableMoveHabit, stableSetListGestureActive]);

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

  if (!onboardingDone || authScreenVisible) {
    return (
      <AuthScreen
        onAuthenticated={handleUserAuthenticated}
        onCancel={
          onboardingDone ? () => setAuthScreenVisible(false) : undefined
        }
        initialDefaultFirstName={state.profile?.firstName || ''}
        initialDefaultLastName={state.profile?.lastName || ''}
      />
    );
  }

  const activeSection: MainSection =
    state.section === 'gorevler' ? 'gorevler' : 'rutin';
  const allTasks = state.tasks || [];
  const activeTasksAll = allTasks.filter((t) => !t.done);
  const starredActiveCount = activeTasksAll.filter((t) => t.starred).length;
  const displayedActiveTasks =
    taskFilter === 'starred'
      ? activeTasksAll.filter((t) => t.starred)
      : activeTasksAll;
  const completedTasks = allTasks.filter((t) => t.done);

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

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.bg }]}
    >
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      {/* Kategoriye Göre Dinamik 3D Partikül Atmosferi (Yüksek Performanslı Native Driver) */}
      <NeonBackdrop color={theme.accent} />

      {/* Üst Başlık (Buzlu Cam / Glassmorphism Segmented Bar & Minimal Kontroller) */}
      <View
        style={[
          styles.topbar,
          {
            backgroundColor: 'transparent',
            borderBottomColor: theme.isDark
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.04)',
          },
          Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              } as any)
            : null,
        ]}
      >
        <View style={styles.topbarLeft}>


      {profileOpen ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setProfileOpen(false);
              }}
              style={[
                styles.backToHomeBtn,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                },
              ]}
              activeOpacity={0.75}
            >
              <Text style={[styles.backToHomeArrow, { color: theme.accent }]}>
                ‹
              </Text>
              <Text style={[styles.appTitle, { color: theme.text }]}>
                Profil ve Ayarlar
              </Text>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.topModeTabs,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.04)',
                  borderColor: theme.isDark
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(0,0,0,0.05)',
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleSelectSection('rutin')}
                style={[
                  styles.topModeTabBtn,
                  activeSection === 'rutin' && [
                    styles.topModeTabBtnActive,
                    {
                      backgroundColor: withAlpha(theme.accent, 0.22),
                      borderColor: theme.accent,
                      shadowColor: theme.accent,
                    },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.topModeTabText,
                    {
                      color: activeSection === 'rutin' ? theme.text : theme.muted,
                      fontWeight: activeSection === 'rutin' ? '700' : '600',
                    },
                  ]}
                >
                  Günlük Rutin
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleSelectSection('gorevler')}
                style={[
                  styles.topModeTabBtn,
                  activeSection === 'gorevler' && [
                    styles.topModeTabBtnActive,
                    {
                      backgroundColor: withAlpha(theme.accent, 0.22),
                      borderColor: theme.accent,
                      shadowColor: theme.accent,
                    },
                  ],
                ]}
              >
                <Text
                  style={[
                    styles.topModeTabText,
                    {
                      color:
                        activeSection === 'gorevler' ? theme.text : theme.muted,
                      fontWeight: activeSection === 'gorevler' ? '700' : '600',
                    },
                  ]}
                >
                  Görevler
                </Text>
                {activeTasksAll.length > 0 && (
                  <View
                    style={[
                      styles.topModeBadge,
                      {
                        backgroundColor:
                          activeSection === 'gorevler'
                            ? theme.accent
                            : withAlpha(theme.accent, 0.16),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.topModeBadgeText,
                        {
                          color:
                            activeSection === 'gorevler'
                              ? theme.accentInk
                              : theme.accent,
                        },
                      ]}
                    >
                      {activeTasksAll.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.topbarRightActions}>
          <TouchableOpacity
            onPress={handleToggleProfile}
            activeOpacity={0.8}
            accessibilityLabel="Profil ve ayarları aç"
            style={[
              styles.profileCircleBtn,
              {
                backgroundColor: profileOpen
                  ? theme.accent
                  : theme.isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(255,255,255,0.9)',
                borderColor: theme.accent,
                shadowColor: theme.accent,
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
              <MicroIcon
                name="user"
                size={15}
                color={profileOpen ? theme.accentInk : theme.text}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

          {!profileOpen && activeSection === 'rutin' && (<>
      {/* Üst kategori seçici */}
      <View
        style={[
          styles.categoryBar,
          {
            width: Math.min(windowWidth - 32, 728),
            borderColor: withAlpha(theme.accent, 0.4),
            backgroundColor:
              theme.surfaceGlass ||
              withAlpha(theme.surface, theme.isDark ? 0.82 : 0.86),
            borderTopColor: theme.isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.06)',
            paddingBottom: 4,
          },
          Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(22px)',
                WebkitBackdropFilter: 'blur(22px)',
              } as any)
            : null,
        ]}
      >
        <ScrollView
          ref={categoryScrollRef}
          horizontal
          scrollEnabled={!categoryDragging}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
          onContentSizeChange={() => {
            categoryScrollRef.current?.scrollTo({ x: categoryScrollX, animated: false });
          }}
        >
          <SpringDragList
            items={tabs}
            keyExtractor={(tab) => tab.id}
            axis="horizontal"
            holdDelay={450}
            gap={4}
            accentColor={theme.accent}
            borderRadius={theme.radius}
            onReorder={reorderCategories}
            onDragActiveChange={setCategoryDragging}
            onLongPressNoDrag={(tab) => openCategoryMenu(tab.id)}
            onStartHaptic={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
            onStepHaptic={() => { Haptics.selectionAsync().catch(() => {}); }}
            renderItem={(t, _index, dragControls) => {
            const hs = state.habits.filter((h) => h.tab === t.id);
            const done = hs.filter(
              (h) => getMark(h.id, today.key) === 'g'
            ).length;
            const selected =
              !profileOpen && activeSection === 'rutin' && t.id === state.tab;
            const inactiveGray = '#B6B6B6';
            return (
              <View {...dragControls.longPressDragProps}>
              <TouchableOpacity
                key={t.id}
                accessibilityRole="tab"
                accessibilityLabel={t.name}
                accessibilityState={{ selected }}
                accessibilityHint="Basılı tutup kaydır: sırala. Kaydırmadan bırak: sekme menüsü."
                accessibilityActions={[{ name: 'decrement', label: 'Sola taşı' }, { name: 'increment', label: 'Sağa taşı' }, { name: 'longpress', label: 'Sekme menüsünü aç' }]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === 'decrement') moveCategory(t.id, -1);
                  else if (event.nativeEvent.actionName === 'increment') moveCategory(t.id, 1);
                  else if (event.nativeEvent.actionName === 'longpress') openCategoryMenu(t.id);
                }}
                activeOpacity={0.78}
                onPress={() => { if (!dragControls.consumeLongPress()) handleSelectTab(t.id); }}
                onLongPress={() => {}}
                delayLongPress={450}
                {...(Platform.OS === 'web' ? {
                  onContextMenu: (event: React.MouseEvent) => {
                    event.preventDefault();
                    if ((event.nativeEvent as PointerEvent).pointerType !== 'touch') openCategoryMenu(t.id);
                  },
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
                      event.preventDefault(); openCategoryMenu(t.id);
                    } else if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
                      event.preventDefault(); moveCategory(t.id, event.key === 'ArrowLeft' ? -1 : 1);
                    }
                  },
                } : {})}
                style={[
                  styles.tabBtn,
                  { width: categoryTabWidth },
                  selected && {
                    backgroundColor: withAlpha(t.color, 0.18),
                    borderColor: theme.accent,
                    shadowColor: theme.accent,
                    shadowOpacity: 0.5,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 0 },
                  },
                ]}
              >
                {selected && <AccentSheen color={t.color} />}
                {t.id.startsWith('custom-') || t.customIcon ? (
                  <View style={!selected ? { filter: [{ grayscale: 1 }] } : undefined}>
                    <Text style={{ fontSize: 25, lineHeight: 27, height: 27 }}>{t.emoji}</Text>
                  </View>
                ) : <CategoryIcon category={t.id} size={27} color={selected ? t.color : '#C6C6C6'} />}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabName,
                    {
                      color: selected ? theme.text : inactiveGray,
                      fontWeight: selected ? '700' : '600',
                    },
                  ]}
                >
                  {t.name}
                </Text>
                <View
                  style={[
                    styles.tabCountPill,
                    {
                      backgroundColor: selected
                        ? t.color
                        : theme.isDark
                        ? 'rgba(161, 161, 170, 0.14)'
                        : 'rgba(142, 142, 147, 0.15)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabCount,
                      {
                        color: selected
                          ? t.theme.accentInk
                          : inactiveGray,
                      },
                    ]}
                  >
                    {done}/{hs.length}
                  </Text>
                </View>
              </TouchableOpacity>
              </View>
            );
          }} />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Yeni sekme ekle"
            onPress={() => { setCategoryEditId(null); setCategoryEditorOpen(true); }}
            style={[styles.addTabButton, { borderColor: withAlpha(theme.accent, 0.45), backgroundColor: withAlpha(theme.accent, 0.05) }]}
          >
            <Text style={{ color: theme.accent, fontSize: 30, lineHeight: 32 }}>＋</Text>
            <Text style={{ color: theme.accent, fontSize: 10 }}>Yeni sekme</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      </>)}

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
                {userFullName || authUser?.displayName || 'Misafir Kullanıcı'}
              </Text>
              <Text style={[styles.profileSubtitle, { color: theme.muted }]}>
                {authUser && authUser.provider !== 'guest'
                  ? `${
                      authUser.provider === 'google'
                        ? '🔵 Google Hesabı Bağlı'
                        : authUser.provider === 'apple'
                        ? ' Apple Hesabı Bağlı'
                        : '✉️ E-posta Hesabı Bağlı'
                    }${authUser.email ? ` · ${authUser.email}` : ''}`
                  : '👤 Misafir Modu (Yalnızca Cihazda Saklanıyor)'}
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
                  <AnimatedNumber
                    value={state.habits.length}
                    style={[styles.profileStatVal, { color: theme.text }]}
                  />
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
                  <AnimatedNumber
                    value={allDoneToday}
                    suffix={`/${state.habits.length}`}
                    style={[
                      styles.profileStatVal,
                      { color: MARK_COLORS.green },
                    ]}
                  />
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
                  <AnimatedNumber
                    value={maxBestStreak}
                    suffix=" gün"
                    style={[styles.profileStatVal, { color: theme.text }]}
                  />
                  <Text
                    style={[styles.profileStatLbl, { color: theme.muted }]}
                  >
                    En Uzun Zincir
                  </Text>
                </View>
              </View>
            </View>

            {/* Son 12 Hafta Aktivite Isı Haritası */}
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
              <View style={styles.heatmapHeaderRow}>
                <Text
                  style={[
                    styles.profileSectionTitle,
                    { color: theme.text, marginBottom: 0 },
                  ]}
                >
                  🔥 Son 12 Hafta
                </Text>
                <Text
                  style={[styles.heatmapSummary, { color: theme.muted }]}
                >
                  {heatmapPerfectDays} mükemmel gün
                </Text>
              </View>
              <Text
                style={[
                  styles.profileSectionDesc,
                  { color: theme.muted, marginTop: 6, marginBottom: 12 },
                ]}
              >
                Tüm maddeleri tamamladığın günler daha koyu yeşil görünür.
              </Text>
              <ActivityHeatmap
                weeks={heatmapWeeks}
                color={MARK_COLORS.green}
                trackColor={
                  theme.isDark
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(0,0,0,0.055)'
                }
                todayColor={theme.accent}
                cellGap={4}
                cellRadius={3}
                accessibilityLabel={`Son 12 haftada ${heatmapActiveDays} aktif gün ve ${heatmapPerfectDays} mükemmel gün`}
              />
              <View style={styles.heatmapLegendRow}>
                <Text
                  style={[styles.heatmapLegendText, { color: theme.muted }]}
                >
                  Az
                </Text>
                {[0.2, 0.45, 0.7, 1].map((v) => (
                  <View
                    key={v}
                    style={[
                      styles.heatmapLegendCell,
                      {
                        backgroundColor: withAlpha(
                          MARK_COLORS.green,
                          0.22 + v * 0.78
                        ),
                      },
                    ]}
                  />
                ))}
                <Text
                  style={[styles.heatmapLegendText, { color: theme.muted }]}
                >
                  Çok
                </Text>
                <View style={{ flex: 1 }} />
                <Text
                  style={[styles.heatmapLegendText, { color: theme.muted }]}
                >
                  {heatmapActiveDays}/84 gün
                </Text>
              </View>
            </View>

            {/* Hesap ve Bulut Senkronizasyonu Kartı */}
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
                ☁️ Hesap ve Bulut Yedekleme
              </Text>
              <Text
                style={[styles.profileSectionDesc, { color: theme.muted }]}
              >
                Verileriniz her zaman önce telefonunuza (AsyncStorage) kaydedilir
                ve internetsiz çalışır. Google, Apple veya E-posta hesabınızla
                giriş yaptığınızda internet bağlantısı oldukça arka planda
                otomatik olarak buluta yedeklenir ve yeni cihazınızda otomatik
                indirilir.
              </Text>

              {/* Canlı Senkronizasyon Durum Kutusu */}
              <View
                style={[
                  styles.backupInfoBox,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                    borderColor:
                      cloudSyncStatus === 'synced'
                        ? MARK_COLORS.green
                        : cloudSyncStatus === 'offline-pending'
                        ? '#f59e0b'
                        : theme.isDark
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(0,0,0,0.09)',
                  },
                ]}
              >
                <View style={styles.backupInfoRow}>
                  <Text
                    style={[styles.backupInfoLabel, { color: theme.muted }]}
                  >
                    Oturum Durumu:
                  </Text>
                  <Text style={[styles.backupInfoVal, { color: theme.text }]}>
                    {authUser && authUser.provider !== 'guest'
                      ? authUser.provider === 'google'
                        ? 'Google ile Giriş Yapıldı'
                        : authUser.provider === 'apple'
                        ? 'Apple ile Giriş Yapıldı'
                        : 'E-posta ile Giriş Yapıldı'
                      : 'Misafir Modu'}
                  </Text>
                </View>

                {authUser?.email && (
                  <View style={styles.backupInfoRow}>
                    <Text
                      style={[styles.backupInfoLabel, { color: theme.muted }]}
                    >
                      Bağlı Hesap:
                    </Text>
                    <Text style={[styles.backupInfoVal, { color: theme.text }]}>
                      {authUser.email}
                    </Text>
                  </View>
                )}

                <View style={styles.backupInfoRow}>
                  <Text
                    style={[styles.backupInfoLabel, { color: theme.muted }]}
                  >
                    Bulut Senkronizasyonu:
                  </Text>
                  <Text
                    style={[
                      styles.backupInfoVal,
                      {
                        color:
                          cloudSyncStatus === 'synced'
                            ? MARK_COLORS.green
                            : cloudSyncStatus === 'syncing'
                            ? '#3b82f6'
                            : cloudSyncStatus === 'offline-pending'
                            ? '#f59e0b'
                            : theme.muted,
                      },
                    ]}
                  >
                    {!authUser || authUser.provider === 'guest'
                      ? 'Kapalı (Misafir)'
                      : cloudSyncStatus === 'syncing'
                      ? '↻ Buluta Yedekleniyor...'
                      : cloudSyncStatus === 'synced'
                      ? '✓ Bulut ile Senkronize'
                      : cloudSyncStatus === 'offline-pending'
                      ? '⚡ Çevrimdışı (İnternet Bekleniyor)'
                      : 'Hazır'}
                  </Text>
                </View>

                <View style={styles.backupInfoRow}>
                  <Text
                    style={[styles.backupInfoLabel, { color: theme.muted }]}
                  >
                    Son Bulut Eşitleme:
                  </Text>
                  <Text style={[styles.backupInfoVal, { color: theme.text }]}>
                    {state.profile?.lastCloudSyncAt || 'Henüz eşitlenmedi'}
                  </Text>
                </View>
              </View>

              {Boolean(cloudNoticeMsg) && (
                <View
                  style={[
                    styles.profileSavedToast,
                    {
                      backgroundColor: 'rgba(59, 130, 246, 0.14)',
                      borderColor: '#3b82f6',
                      marginBottom: 10,
                    },
                  ]}
                >
                  <Text
                    style={[styles.profileSavedToastText, { color: theme.text }]}
                  >
                    {cloudNoticeMsg}
                  </Text>
                </View>
              )}

              {!authUser || authUser.provider === 'guest' ? (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setAuthScreenVisible(true);
                  }}
                  activeOpacity={0.85}
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
                    🔐 Google / Apple / E-posta ile Giriş Yap
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.profileBackupBtns}>
                  <TouchableOpacity
                    onPress={handleManualCloudBackup}
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
                      ☁️ Şimdi Buluta Yedekle
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleManualCloudRestore}
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
                      📥 Buluttaki Yedeği Şimdi İndir
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSignOut}
                    activeOpacity={0.82}
                    style={[
                      styles.ghostBtn,
                      styles.profileFullBtn,
                      {
                        borderColor: MARK_COLORS.red,
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.ghostBtnText,
                        { color: MARK_COLORS.red, fontSize: 14 },
                      ]}
                    >
                      🚪 Çıkış Yap / Hesap Değiştir
                    </Text>
                  </TouchableOpacity>
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
                Tüm alışkanlıklarınız, görevlerinizdeki maddeler, alt
                görevleriniz, zincirleriniz, sayaç/miktar kayıtlarınız ve profil
                bilgileriniz cihazınızda saklanır. Veri kaybını önlemek veya
                başka bir cihaza geçmek için tüm verilerinizi yedekleyebilir ve
                istediğiniz zaman yedekten geri yükleyebilirsiniz.
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
                    {state.habits.length} madde ({tabs.length} kategori)
                  </Text>
                </View>
                <View style={styles.backupInfoRow}>
                  <Text
                    style={[styles.backupInfoLabel, { color: theme.muted }]}
                  >
                    Kayıtlı Görevler:
                  </Text>
                  <Text style={[styles.backupInfoVal, { color: theme.text }]}>
                    {allTasks.length} madde ({activeTasksAll.length} aktif,{' '}
                    {completedTasks.length} tamamlanan)
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
      ) : activeSection === 'gorevler' ? (
        /* Görevler (Google Görevler Benzeri Görünüm) */
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            ref={tasksScrollRef}
            style={styles.mainScroll}
            contentContainerStyle={styles.mainContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Google Görevler Liste Sekmeleri (Görevlerim / ★ Yıldızlı) & Eylemler */}
            <View style={styles.toolbar}>
              <View style={styles.taskFilterTabs}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setTaskFilter('all');
                  }}
                  style={[
                    styles.taskFilterBtn,
                    {
                      backgroundColor:
                        taskFilter === 'all' ? theme.accent : theme.surface,
                      borderColor:
                        taskFilter === 'all'
                          ? theme.accent
                          : theme.cardBorderColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.taskFilterBtnText,
                      {
                        color:
                          taskFilter === 'all' ? theme.accentInk : theme.text,
                      },
                    ]}
                  >
                    Görevlerim ({activeTasksAll.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setTaskFilter('starred');
                  }}
                  style={[
                    styles.taskFilterBtn,
                    {
                      backgroundColor:
                        taskFilter === 'starred' ? theme.accent : theme.surface,
                      borderColor:
                        taskFilter === 'starred'
                          ? theme.accent
                          : theme.cardBorderColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.taskFilterBtnText,
                      {
                        color:
                          taskFilter === 'starred'
                            ? theme.accentInk
                            : theme.text,
                      },
                    ]}
                  >
                    ★ Yıldızlı ({starredActiveCount})
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.toolbarRight}>
                { taskFilter === 'all' &&
                  (activeTasksAll.length > 1 || taskReorderMode) && (
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setTaskReorderMode((v) => !v);
                      }}
                      style={[
                        taskReorderMode ? styles.primaryBtn : styles.pillBtn,
                        taskReorderMode
                          ? { backgroundColor: theme.accent }
                          : {
                              backgroundColor: theme.surface,
                              borderColor: theme.cardBorderColor,
                            },
                      ]}
                    >
                      <View style={styles.btnContentRow}>
                        {!taskReorderMode && (
                          <MicroIcon name="sort" size={14} color={theme.accent} />
                        )}
                        <Text
                          style={[
                            styles.pillBtnText,
                            {
                              color: taskReorderMode
                                ? theme.accentInk
                                : theme.text,
                            },
                          ]}
                        >
                          {taskReorderMode ? '✓ Bitti' : 'Sırala'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                {!taskReorderMode && (
                  <TouchableOpacity
                    onPress={() => openTaskModal(null)}
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: theme.accent,
                        shadowColor: theme.accent,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.primaryBtnText, { color: theme.accentInk }]}
                    >
                      ＋ Yeni Görev
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Hızlı Görev Ekleme Çubuğu (Google Tasks Tarzı) */}
            {!taskReorderMode && (
              <View
                style={[
                  styles.card,
                  styles.quickTaskBar,
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
                    styles.taskCircleCheck,
                    {
                      borderColor: theme.accent,
                      opacity: 0.7,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: theme.accent,
                      fontSize: 14,
                      fontWeight: '800',
                    }}
                  >
                    ＋
                  </Text>
                </View>
                <TextInput
                  value={quickTaskTitle}
                  onChangeText={setQuickTaskTitle}
                  maxLength={100}
                  placeholder={
                    taskFilter === 'starred'
                      ? 'Yıldızlı yeni görev ekle...'
                      : 'Yeni bir görev ekle...'
                  }
                  placeholderTextColor={theme.muted}
                  onSubmitEditing={handleQuickAddTask}
                  returnKeyType="done"
                  style={[styles.quickTaskInput, { color: theme.text }]}
                />
                {quickTaskTitle.trim().length > 0 && (
                  <TouchableOpacity
                    onPress={handleQuickAddTask}
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: theme.accent,
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.primaryBtnText,
                        { color: theme.accentInk, fontSize: 13 },
                      ]}
                    >
                      Ekle
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Aktif Görevler Listesi */}
            {displayedActiveTasks.length === 0 ? (
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
                  {taskFilter === 'starred'
                    ? 'Henüz yıldızlı görev yok. Görevlerin yanındaki ☆ simgesine dokunarak önemli görevleri buraya sabitleyebilirsin.'
                    : 'Yapılacak görev yok. Yukarıdan hızlıca yazabilir veya “＋ Madde ekle” ile detaylı görev oluşturabilirsin.'}
                </Text>
              </View>
            ) : (
              <SpringDragList
                items={displayedActiveTasks}
                keyExtractor={(t) => t.id}
                onReorder={reorderTask}
                onDragActiveChange={setListGestureActive}
                onLongPressNoDrag={(t) => openTaskModal(t)}
                onStartHaptic={() => {
                  Haptics.impactAsync(
                    Haptics.ImpactFeedbackStyle.Medium
                  ).catch(() => {});
                }}
                onStepHaptic={() => {
                  Haptics.selectionAsync().catch(() => {});
                }}
                accentColor={theme.accent}
                borderRadius={theme.radius}
                style={styles.cardsList}
                renderItem={(task, idx, dragControls) => {
                  const subtasks = task.subtasks || [];
                  const isCompleting = false;
                  return (
                    <FadeSlideIn index={idx}>
                    <SwipeableTaskRow
                      disabled={taskReorderMode}
                      borderRadius={theme.radius}
                      rightLabel="Tamamla"
                      leftLabel="Sil"
                      rightColor={TASK_COMPLETE_COLOR}
                      leftColor={TASKS_THEME.accentSoft}
                      onSwipeActiveChange={setListGestureActive}
                      onThresholdHaptic={() => {
                        Haptics.impactAsync(
                          Haptics.ImpactFeedbackStyle.Light
                        ).catch(() => {});
                      }}
                      onSwipeRight={() => {
                        Haptics.notificationAsync(
                          Haptics.NotificationFeedbackType.Success
                        ).catch(() => {});
                        handleToggleTaskDone(task.id);
                      }}
                      onSwipeLeft={() => {
                        Haptics.notificationAsync(
                          Haptics.NotificationFeedbackType.Warning
                        ).catch(() => {});
                        handleDeleteSingleTask(task.id);
                      }}
                    >
                    <TaskRowMotion completing={isCompleting}>
                    <View
                      style={[
                        styles.card,
                        taskReorderMode ? styles.compactCard : styles.taskCard,
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
                      {taskReorderMode && (
                        <>
                          <View
                            {...dragControls.handleProps}
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
                          <View
                            {...dragControls.handleProps}
                            style={styles.compactInfo}
                          >
                            <Text
                              style={[
                                styles.cardTitle,
                                {
                                  color: theme.text,
                                  fontStyle: theme.headItalic
                                    ? 'italic'
                                    : 'normal',
                                },
                              ]}
                            >
                              {task.title}
                            </Text>
                            {!!task.detail && (
                              <Text
                                style={[
                                  styles.cardDetail,
                                  { color: theme.muted },
                                ]}
                              >
                                {task.detail}
                              </Text>
                            )}
                          </View>
                          <TouchableOpacity
                            disabled={idx === 0}
                            onPress={() => moveTask(task.id, -1)}
                            style={[
                              styles.iconBtn,
                              {
                                backgroundColor: theme.surface,
                                borderColor: theme.isDark
                                  ? 'rgba(255,255,255,0.18)'
                                  : 'rgba(0,0,0,0.15)',
                                opacity: idx === 0 ? 0.3 : 1,
                              },
                            ]}
                          >
                            <Text style={{ color: theme.text, fontSize: 13 }}>
                              ▲
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={idx === displayedActiveTasks.length - 1}
                            onPress={() => moveTask(task.id, 1)}
                            style={[
                              styles.iconBtn,
                              {
                                backgroundColor: theme.surface,
                                borderColor: theme.isDark
                                  ? 'rgba(255,255,255,0.18)'
                                  : 'rgba(0,0,0,0.15)',
                                opacity:
                                  idx === displayedActiveTasks.length - 1
                                    ? 0.3
                                    : 1,
                              },
                            ]}
                          >
                            <Text style={{ color: theme.text, fontSize: 13 }}>
                              ▼
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}

                      <View style={taskReorderMode ? { display: 'none' } : undefined}>
                      <View style={styles.taskMainRow}>
                        {/* Yuvarlak Onay Kutusu (Google Tasks tarzı) */}
                        <AnimatedCheckCircle
                          checked={isCompleting}
                          color={TASK_COMPLETE_COLOR}
                          borderColor={theme.accent}
                          onPress={() => handleToggleTaskDone(task.id)}
                          accessibilityLabel={`${task.title} görevini tamamla`}
                          style={styles.taskCircleCheck}
                          tickStyle={styles.taskCircleTick}
                        />

                        {/* Görev Başlığı, Açıklaması ve Tarih Etiketi (Basılı Tutup Sürükle destekli) */}
                        <View
                          {...dragControls.longPressDragProps}
                          style={styles.taskBodyPressable}
                        >
                        <Pressable
                          onPress={() => openTaskModal(task)}
                          style={({ pressed }) => [
                            { opacity: pressed ? 0.75 : 1 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.taskItemTitle,
                              {
                                color: isCompleting ? theme.muted : theme.text,
                                textDecorationLine: isCompleting
                                  ? 'line-through'
                                  : 'none',
                                fontStyle: theme.headItalic
                                  ? 'italic'
                                  : 'normal',
                              },
                            ]}
                          >
                            {task.title}
                          </Text>
                          {!!task.detail && (
                            <Text
                              style={[
                                styles.taskItemDetail,
                                { color: theme.muted },
                              ]}
                            >
                              {task.detail}
                            </Text>
                          )}
                          {!!task.dueDate && (
                            <View style={styles.taskMetaRow}>
                              <View
                                style={[
                                  styles.taskDateChip,
                                  {
                                    borderColor: theme.accent,
                                    backgroundColor: theme.isDark
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(0,0,0,0.04)',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.taskDateChipText,
                                    { color: theme.text },
                                  ]}
                                >
                                  📅 {task.dueDate}
                                </Text>
                              </View>
                            </View>
                          )}
                        </Pressable>
                        </View>

                        {/* Yıldız (Önemli) Butonu */}
                        <TouchableOpacity
                          onPress={() => handleToggleTaskStar(task.id)}
                          accessibilityLabel="Yıldızla"
                          style={styles.taskStarBtn}
                        >
                          <Text
                            style={[
                              styles.taskStarIcon,
                              {
                                color: task.starred
                                  ? theme.accent
                                  : theme.muted,
                              },
                            ]}
                          >
                            {task.starred ? '★' : '☆'}
                          </Text>
                        </TouchableOpacity>

                        {/* Sürükle-Bırak Tutamacı */}
                        {displayedActiveTasks.length > 1 && (
                          <View
                            {...dragControls.handleProps}
                            accessibilityLabel="Sürükleyerek sırala"
                            style={{
                              paddingHorizontal: 5,
                              paddingVertical: 4,
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Text
                              style={{
                                color: theme.muted,
                                fontSize: 15,
                                opacity: 0.65,
                              }}
                            >
                              ⠿
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Alt Görevler (Google Tasks gibi girintili) */}
                      {subtasks.length > 0 && (
                        <View style={styles.taskSubtasksContainer}>
                          {subtasks.map((st) => (
                            <TouchableOpacity
                              key={st.id}
                              activeOpacity={0.75}
                              onPress={() =>
                                handleToggleTaskSubtaskOnCard(task.id, st.id)
                              }
                              style={styles.taskSubtaskRow}
                            >
                              <View
                                style={[
                                  styles.taskSubCircle,
                                  {
                                    borderColor: st.done
                                      ? TASK_COMPLETE_COLOR
                                      : theme.muted,
                                    backgroundColor: st.done
                                      ? TASK_COMPLETE_COLOR
                                      : 'transparent',
                                  },
                                ]}
                              >
                                {st.done && (
                                  <Text style={styles.taskSubCircleTick}>
                                    ✓
                                  </Text>
                                )}
                              </View>
                              <Text
                                style={[
                                  styles.taskSubtaskText,
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
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      </View>
                    </View>
                    </TaskRowMotion>
                    </SwipeableTaskRow>
                    </FadeSlideIn>
                  );
                }}
              />
            )}

            {/* Tamamlananlar Bölümü (Google Görevler gibi açılır/kapanır) */}
            {completedTasks.length > 0 && (
              <View
                style={[
                  styles.card,
                  styles.completedSectionCard,
                  {
                    backgroundColor: theme.surface,
                    borderRadius: theme.radius,
                    borderColor: theme.cardBorderColor,
                    borderWidth: theme.cardBorderWidth,
                  },
                ]}
              >
                <View style={styles.completedHeaderRow}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      animateLayout('ease');
                      setCompletedExpanded((v) => !v);
                    }}
                    style={styles.completedToggleBtn}
                  >
                    <Text
                      style={[
                        styles.completedHeaderTitle,
                        { color: theme.text },
                      ]}
                    >
                      {completedExpanded ? '▾' : '▸'} Tamamlananlar (
                      {completedTasks.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleClearCompletedTasks}
                    style={styles.clearCompletedBtn}
                  >
                    <Text
                      style={[
                        styles.clearCompletedText,
                        { color: theme.muted },
                      ]}
                    >
                      Tümünü sil
                    </Text>
                  </TouchableOpacity>
                </View>

                {completedExpanded && (
                  <View style={styles.completedList}>
                    {completedTasks.map((task) => (
                      <SwipeableTaskRow
                        key={task.id}
                        borderRadius={10}
                        rightLabel="Geri Al"
                        leftLabel="Sil"
                        rightColor={TASK_COMPLETE_COLOR}
                        leftColor={TASKS_THEME.accentSoft}
                        onSwipeActiveChange={setListGestureActive}
                        onThresholdHaptic={() => {
                          Haptics.impactAsync(
                            Haptics.ImpactFeedbackStyle.Light
                          ).catch(() => {});
                        }}
                        onSwipeRight={() => {
                          Haptics.selectionAsync().catch(() => {});
                          handleToggleTaskDone(task.id);
                        }}
                        onSwipeLeft={() => {
                          Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Warning
                          ).catch(() => {});
                          handleDeleteSingleTask(task.id);
                        }}
                      >
                      <View
                        style={[
                          styles.completedTaskRow,
                          {
                            backgroundColor: theme.surface,
                            borderTopColor: theme.isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(0,0,0,0.06)',
                          },
                        ]}
                      >
                        <TouchableOpacity
                          onPress={() => handleToggleTaskDone(task.id)}
                          style={[
                            styles.taskCircleCheck,
                            {
                              borderColor: TASK_COMPLETE_COLOR,
                              backgroundColor: TASK_COMPLETE_COLOR,
                            },
                          ]}
                        >
                          <Text style={styles.taskCircleTick}>✓</Text>
                        </TouchableOpacity>

                        <Pressable
                          onPress={() => openTaskModal(task)}
                          style={styles.taskBodyPressable}
                        >
                          <Text
                            style={[
                              styles.taskItemTitle,
                              {
                                color: theme.muted,
                                textDecorationLine: 'line-through',
                              },
                            ]}
                          >
                            {task.title}
                          </Text>
                          {!!task.detail && (
                            <Text
                              style={[
                                styles.taskItemDetail,
                                {
                                  color: theme.muted,
                                  textDecorationLine: 'line-through',
                                  opacity: 0.75,
                                },
                              ]}
                            >
                              {task.detail}
                            </Text>
                          )}
                        </Pressable>

                        <TouchableOpacity
                          onPress={() => handleDeleteSingleTask(task.id)}
                          accessibilityLabel="Görevi sil"
                          style={styles.taskDeleteIconBtn}
                        >
                          <Text style={{ color: theme.muted, fontSize: 15 }}>
                            ✕
                          </Text>
                        </TouchableOpacity>
                      </View>
                      </SwipeableTaskRow>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Görevler Alt Bilgi */}
            <View style={styles.footer}>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.dotSmall,
                      { backgroundColor: TASK_COMPLETE_COLOR },
                    ]}
                  />
                  <Text style={[styles.legendText, { color: theme.muted }]}>
                    Sağa kaydır: tamamla · Sola kaydır: sil
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.dotSmall,
                      { backgroundColor: theme.accent },
                    ]}
                  />
                  <Text style={[styles.legendText, { color: theme.muted }]}>
                    Basılı tut veya ⠿ tutamacından çek: yaylı sürükle-bırak sırala
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        /* Ana İçerik (Günlük Rutin) */
        <ScrollView
          ref={mainScrollRef}
          keyboardShouldPersistTaps="handled"
          style={styles.mainScroll}
          contentContainerStyle={styles.mainContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Araç Çubuğu (Minimal Ay Seçici + Mikro-İkonlu Sırala + Madde Ekle) */}
        <View style={styles.toolbar}>
          <View
            style={[
              styles.monthNavPill,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorderColor,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => changeMonth(-1)}
              style={styles.iconBtnMinimal}
              accessibilityLabel="Önceki ay"
            >
              <Text style={[styles.iconBtnText, { color: theme.accent }]}>‹</Text>
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
              style={styles.iconBtnMinimal}
              accessibilityLabel="Sonraki ay"
            >
              <Text style={[styles.iconBtnText, { color: theme.accent }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Aylık Görünüm Butonu (Ekim 2026 seçicisinin hemen yanı başında) */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setMonthlyViewMode((v) => !v);
            }}
            style={[
              monthlyViewMode ? styles.primaryBtn : styles.pillBtn,
              monthlyViewMode
                ? {
                    backgroundColor: theme.accent,
                    shadowColor: theme.accent,
                    paddingVertical: 8,
                    paddingHorizontal: 8,
                  }
                : {
                    backgroundColor: theme.surface,
                    borderColor: theme.cardBorderColor,
                    paddingVertical: 8,
                    paddingHorizontal: 8,
                  },
            ]}
            accessibilityLabel="Aylık görünümü aç veya kapat"
          >
            <View style={styles.btnContentRow}>
              <MicroIcon
                name="calendar"
                size={12}
                color={monthlyViewMode ? theme.accentInk : theme.accent}
              />
              <Text
                style={[
                  styles.pillBtnText,
                  {
                    color: monthlyViewMode ? theme.accentInk : theme.text,
                    fontWeight: '700',
                  },
                ]}
              >
                {monthlyViewMode ? 'Aylık ✓' : windowWidth < 380 ? 'Aylık' : 'Aylık Görünüm'}
              </Text>
            </View>
          </TouchableOpacity>

          {!isCurrentMonth && (
            <TouchableOpacity
              onPress={() => changeMonth('today')}
              style={[
                styles.pillBtn,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorderColor,
                },
              ]}
            >
              <Text style={[styles.pillBtnText, { color: theme.accent }]}>
                Bugün
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
                        borderColor: theme.cardBorderColor,
                      },
                ]}
              >
                <View style={styles.btnContentRow}>
                  {!reorderMode && (
                    <MicroIcon name="sort" size={12} color={theme.accent} />
                  )}
                  <Text
                    style={[
                      styles.pillBtnText,
                      {
                        color: reorderMode ? theme.accentInk : theme.text,
                      },
                    ]}
                  >
                    {reorderMode ? '✓ Bitti' : 'Sırala'}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {!reorderMode && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Yeni alışkanlık ekle"
                onPress={() => openEditor(null)}
                style={[
                  styles.neonAddBtn,
                  {
                    backgroundColor: withAlpha(theme.accent, 0.08),
                    borderColor: theme.accent,
                    shadowColor: theme.accent,
                  },
                ]}
              >
                <PlusIcon color={theme.accent} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Alışkanlık Kartları (Yumuşak Gölge, Geniş Padding, Mikro-İkonlar & Aktivite Çemberleri) */}
        {tabHabits.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              {
                backgroundColor: withAlpha(theme.surface, 0.6),
                borderRadius: theme.radius,
                borderColor: theme.cardBorderColor,
              },
            ]}
          >
            <FloatingEmoji emoji={activeTab.emoji} />
            <Text style={[styles.emptyText, { color: theme.muted }]}>
              Bu sekmede henüz madde yok. “＋ Yeni Ekle” ile başla.
            </Text>
          </View>
        ) : (
          <SpringDragList
            items={tabHabits}
            keyExtractor={(h) => h.id}
            onReorder={reorderHabit}
            onDragActiveChange={setListGestureActive}
            onStartHaptic={() => {
              Haptics.impactAsync(
                Haptics.ImpactFeedbackStyle.Medium
              ).catch(() => {});
            }}
            onStepHaptic={() => {
              Haptics.selectionAsync().catch(() => {});
            }}
            accentColor={theme.accent}
            borderRadius={theme.radius}
            style={styles.cardsList}
            renderItem={(h, i, dragControls) => (
              <HabitCard
                h={h} i={i} dragControls={dragControls} habitCount={tabHabits.length}
                habitMarks={state.marks[h.id]} habitProgress={state.progress?.[h.id]}
                reorderMode={reorderMode} monthlyViewMode={monthlyViewMode}
                today={today} viewMonth={viewMonth} theme={theme} windowWidth={windowWidth}
                dim={dim} daysArray={daysArray} cardInnerWidth={cardInnerWidth}
                cellSize={cellSize} cellGap={cellGap} rowViewportWidth={rowViewportWidth}
                cellStep={cellStep} initialScrollX={initialScrollX} scrollKey={scrollKey}
                ignoreHabitSwipeRef={ignoreHabitSwipeRef} actions={habitCardActions}
              />
            )}
          />
        )}

        {/* Alt Bilgi */}
        <View style={styles.footer}>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View
                style={[styles.dotSmall, { backgroundColor: MARK_COLORS.green }]}
              />
              <Text style={[styles.legendText, { color: theme.muted }]}>
                Gün çemberi: dokun işaretle · basılı tut durum seç
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.dotSmall, { backgroundColor: theme.accent }]}
              />
              <Text style={[styles.legendText, { color: theme.muted }]}>
                Kart: dokun sayaç/miktar · sola kaydır düzenle · ⠿ sürükle sırala
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
      )}

      {/* Basılı Tutunca Açılan Renk Menüsü */}
      <CategoryEditor visible={categoryEditorOpen} editingTab={tabs.find((tab) => tab.id === categoryEditId)} existingNames={tabs.filter((tab) => tab.id !== categoryEditId).map((tab) => tab.name)} onCancel={() => { setCategoryEditorOpen(false); setCategoryEditId(null); }} onCreate={handleSaveCategory} />
      <CategoryActions
        tab={tabs.find((tab) => tab.id === categoryMenuId) || null}
        habitCount={state.habits.filter((habit) => habit.tab === categoryMenuId).length}
        canDelete={tabs.length > 1}
        onClose={() => setCategoryMenuId(null)}
        onEdit={handleEditCategory}
        onDelete={handleDeleteTab}
      />
      {!!menuTarget && (
      <Modal
        visible
        transparent
        animationType="none"
        onRequestClose={() => setMenuTarget(null)}
      >
        <SheetBackdrop />
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setMenuTarget(null)}
        >
          <SheetPressable
            onDismiss={() => setMenuTarget(null)}
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
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
            </ScrollView>
          </SheetPressable>
        </Pressable>
      </Modal>
      )}

      {/* Madde Ekle / Düzenle Penceresi (Container'a basılı tutunca açılır) */}
      {editorOpen && (
      <Modal
        visible
        transparent
        animationType="none"
        onRequestClose={() => setEditorOpen(false)}
      >
        <SheetBackdrop />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={styles.modalBackdropInner}
            onPress={() => setEditorOpen(false)}
          >
            <SheetPressable
              onDismiss={() => setEditorOpen(false)}
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
                  Madde adı ve emoji
                </Text>
                <View style={styles.habitIdentityRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Emoji seç"
                    accessibilityState={{ expanded: emojiPickerOpen }}
                    onPress={() => setEmojiPickerOpen((open) => !open)}
                    style={[styles.emojiPickerTrigger, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}
                  >
                    <Text style={styles.emojiPickerPreview}>
                      {habitEmojiChoice || habitEmoji(habitName, editingHabit?.tab || state.tab)}
                    </Text>
                    <Text style={{ color: theme.accent, fontSize: 10 }}>▾</Text>
                  </TouchableOpacity>
                <TextInput
                  accessibilityLabel="Madde adı"
                  value={habitName}
                  onChangeText={setHabitName}
                  maxLength={60}
                  placeholder="Örn. Diş fırçalama, Göğüs egzersizi"
                  placeholderTextColor={theme.muted}
                  style={[
                    styles.textInput,
                    styles.habitNameInput,
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
                </View>

                {emojiPickerOpen && (
                  <View style={[styles.emojiPickerPanel, { borderColor: theme.cardBorderColor }]}>
                    <View style={styles.emojiPickerHeader}>
                      <Text style={[styles.inputLabel, { color: theme.text, marginBottom: 0 }]}>Emoji seç</Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Otomatik emoji kullan"
                        onPress={() => { setHabitEmojiChoice(''); setEmojiPickerOpen(false); }}
                        style={{ paddingVertical: 8, paddingHorizontal: 4 }}
                      >
                        <Text style={{ color: theme.accent, fontSize: 12 }}>Otomatik</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.emojiPickerGrid}>
                      {HABIT_EMOJIS.map((option) => (
                        <TouchableOpacity
                          key={option.emoji}
                          accessibilityRole="button"
                          accessibilityLabel={`Emoji: ${option.label}`}
                          accessibilityState={{ selected: habitEmojiChoice === option.emoji }}
                          onPress={() => {
                            Haptics.selectionAsync().catch(() => {});
                            setHabitEmojiChoice(option.emoji);
                            setEmojiPickerOpen(false);
                          }}
                          style={[styles.emojiPickerOption, {
                            borderColor: habitEmojiChoice === option.emoji ? theme.accent : 'transparent',
                            backgroundColor: habitEmojiChoice === option.emoji ? theme.accentSoft : 'rgba(255,255,255,0.04)',
                          }]}
                        >
                          <Text style={{ fontSize: 24 }}>{option.emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

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

                {/* Hedef türü: tek satırda, yalnızca ikonlar. */}
                <View style={styles.goalTypeRow} accessibilityLabel="Hedef türü">
                  {([
                    { id: 'none', label: 'Hedef yok', icon: '⊘' },
                    { id: 'timer', label: 'Sayaç', icon: '⏱️' },
                    { id: 'reps', label: 'Tekrar', icon: '🔁' },
                    { id: 'amount', label: 'Miktar', icon: '📊' },
                  ] as { id: GoalType; label: string; icon: string }[]).map((opt) => {
                        const active = goalType === opt.id;
                        return (
                          <TouchableOpacity
                            key={opt.id}
                            accessibilityRole="button"
                            accessibilityLabel={opt.label}
                            accessibilityState={{ selected: active }}
                            activeOpacity={0.8}
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
                            <Text style={[styles.goalTypeBtnText, { color: active ? theme.accentInk : theme.text }]}>{opt.icon}</Text>
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
                          Saat
                        </Text>
                        <TextInput
                          value={timerHour}
                          onChangeText={(v) =>
                            setTimerHour(v.replace(/[^0-9]/g, ''))
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
                      {TIMER_PRESETS.map((preset) => {
                        const curH = parseInt(timerHour || '0', 10) || 0;
                        const curM = parseInt(timerMin || '0', 10) || 0;
                        const isPresetActive =
                          curH === preset.h && curM === preset.m;
                        return (
                          <TouchableOpacity
                            key={preset.label}
                            onPress={() => {
                              Haptics.selectionAsync().catch(() => {});
                              setTimerHour(String(preset.h));
                              setTimerMin(String(preset.m));
                            }}
                            style={[
                              styles.presetChip,
                              {
                                backgroundColor: isPresetActive
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
                                  color: isPresetActive
                                    ? theme.accentInk
                                    : theme.text,
                                },
                              ]}
                            >
                              {preset.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
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
            </SheetPressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      )}

      {/* Container'a Dokununca Açılan Sayaç / Miktar / Tekrar Arayüzü */}
      {!!actionHabit && !!actionHabit.goal && (
      <Modal
        visible
        transparent
        animationType="none"
        onRequestClose={closeActionModal}
      >
        <SheetBackdrop />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={styles.modalBackdropInner}
            onPress={closeActionModal}
          >
            <SheetPressable
              onDismiss={closeActionModal}
              style={[
                styles.editorCard,
                {
                  backgroundColor: theme.surface,
                  borderRadius: theme.radius,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                      accessibilityRole="button"
                      accessibilityLabel="Maddeyi düzenle"
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
                          <ProgressRing
                            size={Math.min(
                              224,
                              Math.max(184, windowWidth - 120)
                            )}
                            strokeWidth={13}
                            progress={timerPct}
                            color={
                              isFinished
                                ? MARK_COLORS.green
                                : timerRunning && timerRemaining <= 3
                                ? '#ef4444'
                                : theme.accent
                            }
                            trackColor={
                              theme.isDark
                                ? 'rgba(255,255,255,0.10)'
                                : 'rgba(0,0,0,0.08)'
                            }
                            duration={timerRunning ? 950 : 250}
                            pulse={timerRunning && !isFinished}
                          >
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
                                styles.timerRingCaption,
                                { color: theme.muted },
                              ]}
                            >
                              {isFinished
                                ? 'TAMAMLANDI'
                                : timerRunning
                                ? 'DEVAM EDİYOR'
                                : 'KALAN SÜRE'}
                            </Text>
                          </ProgressRing>

                          <Text
                            style={[
                              styles.timerSubStatus,
                              { color: theme.muted, marginTop: 10 },
                            ]}
                          >
                            {isFinished
                              ? '🎉 Süre tamamlandı!'
                              : timerRunning
                              ? 'Sayaç çalışıyor...'
                              : `Hedef süre: ${formatTimerReadable(targetSec)}`}
                          </Text>

                          <ConfettiBurst
                            trigger={timerFinishKey}
                            colors={[
                              theme.accent,
                              MARK_COLORS.green,
                              '#facc15',
                              '#ffffff',
                            ]}
                            count={18}
                            spread={96}
                            size={6}
                            duration={1050}
                          />

                          <FireworksCelebration
                            trigger={timerFinishKey}
                            colors={[
                              theme.accent,
                              MARK_COLORS.green,
                              '#facc15',
                              '#38bdf8',
                              '#f472b6',
                              '#ffffff',
                            ]}
                          />

                          <View style={styles.presetChipsRow}>
                            {[
                              { label: '-15 sn', delta: -15 },
                              { label: '+15 sn', delta: 15 },
                              { label: '+1 dk', delta: 60 },
                            ].map((adj) => (
                              <TouchableOpacity
                                key={adj.label}
                                disabled={!timersReady}
                                onPress={() => {
                                  Haptics.selectionAsync().catch(() => {});
                                  timers.adjust(actionHabit.id, today.key, targetSec, timerRemaining, adj.delta);
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
                              disabled={!timersReady}
                              onPress={() => {
                                Haptics.impactAsync(
                                  Haptics.ImpactFeedbackStyle.Medium
                                ).catch(() => {});
                                timers.toggle(actionHabit.id, today.key, targetSec, timerRemaining);
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
                              disabled={!timersReady}
                              onPress={() => {
                                Haptics.selectionAsync().catch(() => {});
                                timers.reset(actionHabit.id, today.key, targetSec);
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
                              disabled={!timersReady}
                              onPress={() => {
                                Haptics.notificationAsync(
                                  Haptics.NotificationFeedbackType.Success
                                ).catch(() => {});
                                timers.reset(actionHabit.id, actionTimer?.dateKey || today.key, targetSec, true);
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
                          <View style={{ alignItems: 'center', marginVertical: 4 }}>
                            <LiquidWaveGauge
                              size={Math.min(
                                186,
                                Math.max(154, windowWidth - 150)
                              )}
                              pct={progPct}
                              currentValue={currentVal}
                              targetValue={targetVal}
                              unitText={unitText}
                              habitName={actionHabit.name}
                              accentColor={theme.accent}
                              isDark={theme.isDark}
                              textColor={theme.text}
                              mutedColor={theme.muted}
                            />
                          </View>

                          <FireworksCelebration
                            trigger={timerFinishKey}
                            colors={[
                              theme.accent,
                              MARK_COLORS.green,
                              '#facc15',
                              '#38bdf8',
                              '#ffffff',
                            ]}
                          />

                          <Text
                            style={[
                              styles.subInputLabel,
                              { color: theme.muted, marginTop: 4 },
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
              </ScrollView>
            </SheetPressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      )}

      {/* Görev Ekle / Düzenle Penceresi (Google Görevler Tarzı) */}
      {taskModalOpen && (
      <Modal
        visible
        transparent
        animationType="none"
        onRequestClose={() => {
          if (taskDatePickerOpen) setTaskDatePickerOpen(false);
          else setTaskModalOpen(false);
        }}
      >
        <SheetBackdrop />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <Pressable
            style={styles.modalBackdropInner}
            onPress={() => {
              if (taskDatePickerOpen) setTaskDatePickerOpen(false);
              else setTaskModalOpen(false);
            }}
          >
            <SheetPressable
              onDismiss={() => {
                if (taskDatePickerOpen) setTaskDatePickerOpen(false);
                else setTaskModalOpen(false);
              }}
              style={[
                styles.editorCard,
                {
                  backgroundColor: '#1C1C1C',
                  borderColor: '#484848',
                  borderWidth: 1.5,
                  borderRadius: theme.radius,
                  maxHeight: '90%',
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              {taskDatePickerOpen ? (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  scrollEnabled={pickerOuterScrollEnabled}
                >
                  <View style={styles.taskModalTopRow}>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setTaskDatePickerOpen(false);
                      }}
                      style={styles.backToHomeBtn}
                    >
                      <Text style={[styles.backToHomeArrow, { color: '#767676' }]}>
                        ‹
                      </Text>
                      <Text
                        style={[
                          styles.editorTitle,
                          { color: '#ffffff', marginBottom: 0, fontSize: 18 },
                        ]}
                      >
                        Tarih ve Saat Seç
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Takvim (Tarih Seçimi) */}
                  <View style={styles.datePickerBox}>
                    <View style={styles.calendarHeaderRow}>
                      <TouchableOpacity
                        onPress={() => changePickerMonth(-1)}
                        style={styles.calendarNavBtn}
                        accessibilityLabel="Önceki ay"
                      >
                        <Text style={styles.calendarNavBtnText}>‹</Text>
                      </TouchableOpacity>

                      <Text style={styles.calendarMonthTitle}>
                        {formatMonthTR(pickerViewYear, pickerViewMonth)}
                      </Text>

                      <TouchableOpacity
                        onPress={() => changePickerMonth(1)}
                        style={styles.calendarNavBtn}
                        accessibilityLabel="Sonraki ay"
                      >
                        <Text style={styles.calendarNavBtnText}>›</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.calendarWeekdaysRow}>
                      {TR_WEEKDAYS_SHORT.map((wd) => (
                        <Text key={wd} style={styles.calendarWeekdayText}>
                          {wd}
                        </Text>
                      ))}
                    </View>

                    {(() => {
                      const pDim = daysInMonth(pickerViewYear, pickerViewMonth);
                      const firstDayOffset =
                        (new Date(pickerViewYear, pickerViewMonth, 1).getDay() +
                          6) %
                        7;
                      const slots: (number | null)[] = [];
                      for (let i = 0; i < firstDayOffset; i++) slots.push(null);
                      for (let d = 1; d <= pDim; d++) slots.push(d);
                      while (slots.length % 7 !== 0) slots.push(null);

                      const weeks: (number | null)[][] = [];
                      for (let i = 0; i < slots.length; i += 7) {
                        weeks.push(slots.slice(i, i + 7));
                      }

                      return (
                        <View style={styles.calendarGrid}>
                          {weeks.map((week, wIdx) => (
                            <View key={wIdx} style={styles.calendarWeekRow}>
                              {week.map((dayNum, cIdx) => {
                                if (dayNum === null) {
                                  return (
                                    <View
                                      key={`empty-${wIdx}-${cIdx}`}
                                      style={styles.calendarDayCell}
                                    />
                                  );
                                }
                                const isSel =
                                  pickerSelectedDate.y === pickerViewYear &&
                                  pickerSelectedDate.m === pickerViewMonth &&
                                  pickerSelectedDate.d === dayNum;
                                const isTod =
                                  today.y === pickerViewYear &&
                                  today.m === pickerViewMonth &&
                                  today.d === dayNum;

                                return (
                                  <TouchableOpacity
                                    key={dayNum}
                                    activeOpacity={0.75}
                                    onPress={() => {
                                      Haptics.selectionAsync().catch(() => {});
                                      setPickerSelectedDate({
                                        y: pickerViewYear,
                                        m: pickerViewMonth,
                                        d: dayNum,
                                      });
                                    }}
                                    style={[
                                      styles.calendarDayCell,
                                      isTod &&
                                        !isSel && {
                                          borderWidth: 1.5,
                                          borderColor: '#767676',
                                        },
                                      isSel && {
                                        backgroundColor: '#767676',
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.calendarDayText,
                                        isSel && {
                                          color: '#ffffff',
                                          fontWeight: '800',
                                        },
                                      ]}
                                    >
                                      {dayNum}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      );
                    })()}
                  </View>

                  {/* Saat Seçimi */}
                  <View style={styles.datePickerBox}>
                    <View style={styles.timeHeaderRow}>
                      <Text style={styles.timeSectionTitle}>🕒 Saat Seçimi</Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setPickerHasTime((v) => !v);
                        }}
                        style={[
                          styles.timeToggleBtn,
                          {
                            backgroundColor: pickerHasTime
                              ? '#767676'
                              : '#1C1C1C',
                            borderColor: pickerHasTime ? '#767676' : '#484848',
                          },
                        ]}
                      >
                        <Text style={styles.timeToggleBtnText}>
                          {pickerHasTime ? '✓ Saat Açık' : 'Saat Kapalı'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {pickerHasTime && (
                      <View style={styles.wheelPickerRow}>
                        <TimeWheelColumn
                          label="SAAT"
                          items={HOURS_LIST}
                          selectedValue={pickerHour}
                          onValueChange={setPickerHour}
                          onWheelTouchChange={(touching) =>
                            setPickerOuterScrollEnabled(!touching)
                          }
                        />

                        <Text style={styles.wheelColon}>:</Text>

                        <TimeWheelColumn
                          label="DAKİKA"
                          items={MINUTES_LIST}
                          selectedValue={pickerMinute}
                          onValueChange={setPickerMinute}
                          onWheelTouchChange={(touching) =>
                            setPickerOuterScrollEnabled(!touching)
                          }
                        />
                      </View>
                    )}
                  </View>

                  {/* Seçilen Tarih & Saat Önizlemesi */}
                  <View style={styles.datePreviewBanner}>
                    <Text style={styles.datePreviewText}>
                      🔔{' '}
                      {formatTaskDueDate(
                        pickerSelectedDate.y,
                        pickerSelectedDate.m,
                        pickerSelectedDate.d,
                        pickerHasTime,
                        pickerHour,
                        pickerMinute
                      )}{' '}
                      (
                      {
                        TR_WEEKDAYS[
                          new Date(
                            pickerSelectedDate.y,
                            pickerSelectedDate.m,
                            pickerSelectedDate.d
                          ).getDay()
                        ]
                      }
                      )
                    </Text>
                  </View>

                  <View style={styles.editorActions}>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setTaskDueDate('');
                        setTaskDatePickerOpen(false);
                      }}
                      style={[
                        styles.dangerBtn,
                        { borderColor: '#767676', backgroundColor: '#000000' },
                      ]}
                    >
                      <Text style={[styles.dangerBtnText, { color: '#767676' }]}>
                        Temizle
                      </Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                      onPress={() => setTaskDatePickerOpen(false)}
                      style={[
                        styles.ghostBtn,
                        {
                          borderColor: '#484848',
                          backgroundColor: '#000000',
                        },
                      ]}
                    >
                      <Text style={[styles.ghostBtnText, { color: '#ffffff' }]}>
                        Vazgeç
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={applyTaskDatePicker}
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: '#767676' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.primaryBtnText,
                          { color: '#ffffff' },
                        ]}
                      >
                        ✓ Seç
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              ) : (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.taskModalTopRow}>
                    <Text
                      style={[
                        styles.editorTitle,
                        {
                          color: '#ffffff',
                          marginBottom: 0,
                        },
                      ]}
                    >
                      {editingTask ? 'Görevi düzenle' : 'Yeni görev'}
                    </Text>

                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setTaskStarred((s) => !s);
                      }}
                      style={[
                        styles.taskModalStarBtn,
                        {
                          backgroundColor: taskStarred ? '#484848' : '#000000',
                          borderColor: taskStarred ? '#767676' : '#484848',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          color: '#ffffff',
                          fontWeight: '700',
                        }}
                      >
                        {taskStarred ? '★ Önemli' : '☆ Yıldızla'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inputLabel, { color: '#ffffff' }]}>
                    Görev adı
                  </Text>
                  <TextInput
                    value={taskTitle}
                    onChangeText={setTaskTitle}
                    maxLength={100}
                    placeholder="Örn. Faturayı öde, Market alışverişi yap"
                    placeholderTextColor="#B5B5B5"
                    style={[
                      styles.textInput,
                      {
                        color: '#ffffff',
                        backgroundColor: '#000000',
                        borderColor: '#484848',
                      },
                    ]}
                  />

                  <Text style={[styles.inputLabel, { color: '#ffffff' }]}>
                    Ayrıntılar / Not{' '}
                    <Text style={{ fontWeight: '400', color: '#B5B5B5' }}>
                      (isteğe bağlı)
                    </Text>
                  </Text>
                  <TextInput
                    value={taskDetail}
                    onChangeText={setTaskDetail}
                    maxLength={160}
                    placeholder="Ayrıntı ekle..."
                    placeholderTextColor="#B5B5B5"
                    style={[
                      styles.textInput,
                      {
                        color: '#ffffff',
                        backgroundColor: '#000000',
                        borderColor: '#484848',
                      },
                    ]}
                  />

                  <Text style={[styles.inputLabel, { color: '#ffffff' }]}>
                    Tarih / Zaman{' '}
                    <Text style={{ fontWeight: '400', color: '#B5B5B5' }}>
                      (isteğe bağlı)
                    </Text>
                  </Text>
                  <View style={styles.dateTimeFieldRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={openTaskDatePicker}
                      style={[
                        styles.dateTimeSelectBtn,
                        {
                          backgroundColor: '#000000',
                          borderColor: taskDueDate ? '#767676' : '#484848',
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 16 }}>📅</Text>
                      <Text
                        style={[
                          styles.dateTimeSelectBtnText,
                          {
                            color: taskDueDate ? '#ffffff' : '#B5B5B5',
                            fontWeight: taskDueDate ? '700' : '500',
                          },
                        ]}
                      >
                        {taskDueDate || 'Tarih ve saat seçmek için dokun...'}
                      </Text>
                      <View
                        style={[
                          styles.dateTimeActionBadge,
                          { backgroundColor: '#484848' },
                        ]}
                      >
                        <Text style={styles.dateTimeActionBadgeText}>
                          {taskDueDate ? 'Değiştir' : '🕒 Seç'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {!!taskDueDate && (
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setTaskDueDate('');
                        }}
                        accessibilityLabel="Tarihi temizle"
                        style={styles.dateTimeClearBtn}
                      >
                        <Text style={{ color: '#ffffff', fontWeight: '800' }}>
                          ✕
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Alt Görevler */}
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: '#ffffff', marginTop: 4 },
                    ]}
                  >
                    Alt görevler{' '}
                    <Text style={{ fontWeight: '400', color: '#B5B5B5' }}>
                      ({taskSubtasks.length})
                    </Text>
                  </Text>

                  {taskSubtasks.length > 0 && (
                    <View style={styles.subtasksList}>
                      {taskSubtasks.map((st) => (
                        <View
                          key={st.id}
                          style={[
                            styles.subtaskItem,
                            {
                              backgroundColor: '#000000',
                              borderColor: '#484848',
                            },
                          ]}
                        >
                          <TouchableOpacity
                            onPress={() => handleToggleTaskSubtaskModal(st.id)}
                            style={[
                              styles.subtaskCheck,
                              {
                                borderRadius: 11,
                                borderColor: st.done ? '#767676' : '#484848',
                                backgroundColor: st.done
                                  ? '#767676'
                                  : 'transparent',
                              },
                            ]}
                          >
                            {st.done && (
                              <Text style={styles.subtaskCheckIcon}>✓</Text>
                            )}
                          </TouchableOpacity>
                          <Text
                            onPress={() => handleToggleTaskSubtaskModal(st.id)}
                            style={[
                              styles.subtaskTitle,
                              {
                                color: st.done ? '#B5B5B5' : '#ffffff',
                                textDecorationLine: st.done
                                  ? 'line-through'
                                  : 'none',
                              },
                            ]}
                          >
                            {st.title}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleRemoveTaskSubtaskModal(st.id)}
                            style={styles.subtaskRemoveBtn}
                          >
                            <Text style={{ color: '#B5B5B5', fontSize: 14 }}>
                              ✕
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.subtaskAddRow}>
                    <TextInput
                      value={newTaskSubtaskTitle}
                      onChangeText={setNewTaskSubtaskTitle}
                      maxLength={80}
                      placeholder="Alt görev ekle..."
                      placeholderTextColor="#B5B5B5"
                      onSubmitEditing={handleAddTaskSubtask}
                      style={[
                        styles.smallInput,
                        {
                          flex: 1,
                          marginBottom: 0,
                          color: '#ffffff',
                          backgroundColor: '#000000',
                          borderColor: '#484848',
                        },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={handleAddTaskSubtask}
                      style={[
                        styles.subtaskAddBtn,
                        { backgroundColor: '#767676' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.primaryBtnText,
                          { color: '#ffffff' },
                        ]}
                      >
                        ＋ Ekle
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.editorActions}>
                    {editingTask && (
                      <TouchableOpacity
                        onPress={handleDeleteTaskFromModal}
                        style={[
                          styles.dangerBtn,
                          {
                            borderColor: '#767676',
                            backgroundColor: confirmTaskDelete
                              ? '#767676'
                              : '#000000',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dangerBtnText,
                            { color: confirmTaskDelete ? '#ffffff' : '#767676' },
                          ]}
                        >
                          {confirmTaskDelete ? 'Emin misin? Sil' : 'Sil'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                      onPress={() => setTaskModalOpen(false)}
                      style={[
                        styles.ghostBtn,
                        {
                          borderColor: '#484848',
                          backgroundColor: '#000000',
                        },
                      ]}
                    >
                      <Text style={[styles.ghostBtnText, { color: '#ffffff' }]}>
                        Vazgeç
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={saveTaskModal}
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: '#767676' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.primaryBtnText,
                          { color: '#ffffff' },
                        ]}
                      >
                        Kaydet
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </SheetPressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      )}

      {/* Süre bittiğinde veya günlük hedefler tamamlandığında ekranı kaplayan 3B Havai Fişek / Konfeti */}
      <FireworksCelebration
        trigger={celebrateKey + timerFinishKey}
        colors={[
          theme.accent,
          MARK_COLORS.green,
          '#facc15',
          '#38bdf8',
          '#f472b6',
          '#ffffff',
        ]}
      />

      {/* Sekme / bölüm değişiminde tema rengi yumuşak geçiş katmanı */}
      <ThemeCrossfade color={theme.bg} />
    </SafeAreaView>
  );
}


interface HabitCardActions {
  handleCardPress: (habit: Habit) => void;
  handleCellPress: (habit: Habit, key: string) => void;
  handleCellLongPress: (habit: Habit, key: string) => void;
  openEditor: (habit: Habit | null) => void;
  moveHabit: (id: string, direction: -1 | 1) => void;
  setListGestureActive: (active: boolean) => void;
}

interface HabitCardProps {
  h: Habit;
  i: number;
  dragControls: SpringDragItemControls;
  habitCount: number;
  habitMarks?: Record<string, MarkType>;
  habitProgress?: Record<string, number>;
  reorderMode: boolean;
  monthlyViewMode: boolean;
  today: {key: string; d: number};
  viewMonth: {y: number; m: number};
  theme: TabTheme;
  windowWidth: number;
  dim: number;
  daysArray: number[];
  cardInnerWidth: number;
  cellSize: number;
  cellGap: number;
  rowViewportWidth: number;
  cellStep: number;
  initialScrollX: number;
  scrollKey: string;
  ignoreHabitSwipeRef: React.MutableRefObject<boolean>;
  actions: HabitCardActions;
}

// Only the changed habit rerenders; opening/typing in a sheet leaves the list intact.
const HabitCard = React.memo(function HabitCard({h, i, dragControls, habitCount, habitMarks, habitProgress, reorderMode, monthlyViewMode, today, viewMonth, theme, windowWidth, dim, daysArray, cardInnerWidth, cellSize, cellGap, rowViewportWidth, cellStep, initialScrollX, scrollKey, ignoreHabitSwipeRef, actions}: HabitCardProps) {
  const {handleCardPress, handleCellPress, handleCellLongPress, openEditor, moveHabit, setListGestureActive} = actions;
  const getMark = (_id: string, key: string) => habitMarks?.[key] || '';
  const getProgress = (_id: string, key: string) => habitProgress?.[key] || 0;

  const { cur, best } = reorderMode
    ? { cur: 0, best: 0 }
    : calculateStreaks(habitMarks, today.key);
  let monthDone = 0;
  if (!reorderMode) {
    for (let d = 1; d <= dim; d++) {
      if (getMark(h.id, dateKey(viewMonth.y, viewMonth.m, d)) === 'g') {
        monthDone++;
      }
    }
  }
  const todayMark = getMark(h.id, today.key);
  const todayMarkObj = todayMark ? MARKS[todayMark] : null;
  const todayProg = getProgress(h.id, today.key);
  const hasActiveGoal =
    !!h.goal && h.goal.type !== 'none' && h.goal.target > 0;

  let goalBadgeText = '';
  let goalIconName: MicroIconName = 'timer';
  if (hasActiveGoal && h.goal) {
    if (h.goal.type === 'timer') {
      goalIconName = 'timer';
      goalBadgeText =
        todayProg > 0 && todayProg < h.goal.target
          ? `${formatDuration(todayProg)} / ${formatTimerReadable(h.goal.target)}`
          : `${formatTimerReadable(h.goal.target)}`;
    } else if (h.goal.type === 'reps') {
      goalIconName = 'repeat';
      goalBadgeText = `${todayProg}/${h.goal.target} tekrar`;
    } else if (h.goal.type === 'amount') {
      goalIconName = 'chart';
      goalBadgeText = `${todayProg}/${h.goal.target}${h.goal.unit ? ' ' + h.goal.unit : ''}`;
    }
  }

  return (
    <FadeSlideIn index={i}>
    <SwipeableTaskRow
      disabled={reorderMode}
      enableRightSwipe={false}
      leftActionMode="bounce"
      leftLabel="Düzenle"
      leftIcon="✎"
      leftColor={theme.accent}
      borderRadius={theme.radius}
      ignoreSwipeRef={ignoreHabitSwipeRef}
      onSwipeActiveChange={setListGestureActive}
      onThresholdHaptic={() => {
        Haptics.impactAsync(
          Haptics.ImpactFeedbackStyle.Light
        ).catch(() => {});
      }}
      onSwipeLeft={() => {
        Haptics.impactAsync(
          Haptics.ImpactFeedbackStyle.Medium
        ).catch(() => {});
        openEditor(h);
      }}
    >
    <View
      style={[
        styles.card,
        reorderMode && styles.compactCard,
        {
          backgroundColor: theme.surface,
          borderRadius: theme.radius,
          borderColor: theme.cardBorderColor,
          borderWidth: theme.cardBorderWidth,
          shadowColor: theme.isDark ? '#000000' : theme.accent,
        },
      ]}
    >
      <CardSheen color={theme.accent} />
      {reorderMode && (
        <>
          <View
            {...dragControls.handleProps}
            style={[
              styles.dragHandleBadge,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
              },
            ]}
          >
            <Text style={{ color: theme.muted, fontSize: 16 }}>
              ⠿
            </Text>
          </View>
          <View
            {...dragControls.handleProps}
            style={styles.compactInfo}
          >
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
                numberOfLines={1}
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
                backgroundColor: theme.isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.04)',
                borderColor: 'transparent',
                opacity: i === 0 ? 0.3 : 1,
              },
            ]}
          >
            <Text style={{ color: theme.text, fontSize: 12 }}>▲</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={i === habitCount - 1}
            onPress={() => moveHabit(h.id, 1)}
            style={[
              styles.iconBtn,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.04)',
                borderColor: 'transparent',
                opacity: i === habitCount - 1 ? 0.3 : 1,
              },
            ]}
          >
            <Text style={{ color: theme.text, fontSize: 12 }}>▼</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={reorderMode ? { display: 'none' } : undefined}>
      {/* Kart Üst Kısmı (Gelişmiş Tipografi + Mikro-İkonlu İstatistikler + Bugün Aktivite Çemberi) */}
      <View style={styles.cardHead}>
        {habitCount > 1 && (
          <View
            {...dragControls.handleProps}
            accessibilityLabel="Sürükleyerek sırala"
            style={{
              paddingRight: 0,
              paddingVertical: 6,
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: theme.accent,
                fontSize: 17,
                opacity: 1,
              }}
            >
              ⠿
            </Text>
          </View>
        )}
        <HabitEmblem name={h.name} tab={h.tab} emoji={h.emoji} size={windowWidth < 380 ? 34 : 44} />
        <View
          {...dragControls.longPressDragProps}
          style={styles.cardInfo}
        >
        <Pressable
          onPress={() => handleCardPress(h)}
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
            <View
              style={[
                styles.statMicroPill,
                { borderColor: withAlpha(theme.accent, 0.2) },
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(255,255,255,0.05)'
                    : withAlpha(theme.accent, 0.08),
                },
              ]}
            >
              <StreakIcon streak={cur} color={theme.accent} />
              <Text style={[styles.statText, { color: theme.muted }]}>
                <Text style={[styles.statBold, { color: theme.text }]}>
                  {cur}
                </Text>{' '}
                gün
              </Text>
            </View>

            <View
              style={[
                styles.statMicroPill,
                { borderColor: withAlpha(theme.accent, 0.2) },
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.035)',
                },
              ]}
            >
              <MicroIcon
                name="trophy"
                size={12}
                color={theme.accent}
              />
              <Text style={[styles.statText, { color: theme.muted }]}>
                Rekor{' '}
                <Text style={[styles.statBold, { color: theme.text }]}>
                  {best}
                </Text>
              </Text>
            </View>

            <View
              style={[
                styles.statMicroPill,
                { borderColor: withAlpha(theme.accent, 0.2) },
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.035)',
                },
              ]}
            >
              <MicroIcon
                name="calendar"
                size={12}
                color={theme.accent}
              />
              <Text style={[styles.statText, { color: theme.muted }]}>
                <Text style={[styles.statBold, { color: theme.text }]}>
                  {monthDone}
                </Text>
                /{dim}
              </Text>
            </View>

            {!!goalBadgeText && (
              <View
                style={[
                  styles.goalChip,
                  {
                    backgroundColor: withAlpha(theme.accent, 0.12),
                    borderColor: withAlpha(theme.accent, 0.3),
                  },
                ]}
              >
                <MicroIcon
                  name={goalIconName}
                  size={11}
                  color={theme.accent}
                />
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
        </View>

        {/* Bugün Aktivite Çemberi & Minimal Etiketi */}
        <View style={styles.cardActions}>
          <View style={styles.todayBtnWrap}>
            <View
              pointerEvents="none"
              style={[
                styles.todayBadge,
                {
                  backgroundColor: todayMarkObj
                    ? todayMarkObj.color
                    : withAlpha(theme.accent, 0.14),
                },
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.todayBadgeText,
                  {
                    color: todayMarkObj ? '#ffffff' : theme.accent,
                  },
                ]}
              >
                BUGÜN
              </Text>
            </View>
            <MarkPop
              mark={todayMark}
              color={todayMarkObj?.color}
              radiusStyle={{ borderRadius: 999 }}
              burst
              burstColors={[
                MARK_COLORS.green,
                theme.accent,
                '#facc15',
                '#ffffff',
              ]}
            >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${h.name}, bugün: ${todayMarkObj?.subLabel || 'İşaretsiz'}`}
              onPress={() => handleCellPress(h, today.key)}
              onLongPress={() => handleCellLongPress(h, today.key)}
              delayLongPress={380}
              style={({ pressed }) => {
                const isPartialLiquid =
                  hasActiveGoal &&
                  !!h.goal &&
                  (h.goal.type === 'amount' ||
                    h.goal.type === 'reps') &&
                  todayProg > 0 &&
                  todayProg < h.goal.target &&
                  todayMark === 'b';
                return [
                  styles.todayBtn,
                  {
                    backgroundColor: isPartialLiquid
                      ? theme.isDark
                        ? 'rgba(14,165,233,0.12)'
                        : 'rgba(14,165,233,0.08)'
                      : todayMarkObj
                      ? withAlpha(todayMarkObj.color, 0.1)
                      : theme.isDark
                      ? 'rgba(255,255,255,0.06)'
                      : withAlpha(theme.accent, 0.08),
                    borderColor: isPartialLiquid
                      ? '#38bdf8'
                      : todayMarkObj
                      ? todayMarkObj.color
                      : theme.accent,
                    shadowColor: todayMarkObj
                      ? todayMarkObj.color
                      : theme.accent,
                    shadowOpacity: 0.65,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: todayMarkObj ? 4 : 1,
                    transform: [{ scale: pressed ? 0.91 : 1 }],
                  },
                ];
              }}
            >
              {hasActiveGoal &&
                !!h.goal &&
                (h.goal.type === 'amount' ||
                  h.goal.type === 'reps') &&
                todayProg > 0 &&
                todayProg < h.goal.target &&
                todayMark === 'b' && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: 999,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: `${Math.min(
                          95,
                          Math.max(
                            12,
                            Math.round(
                              (todayProg / h.goal.target) * 100
                            )
                          )
                        )}%`,
                        backgroundColor: '#0ea5e9',
                        borderTopWidth: 2,
                        borderTopColor: '#bae6fd',
                      }}
                    />
                  </View>
                )}
              <Text
                style={[
                  styles.todayBtnNum,
                  {
                    color: todayMarkObj ? '#ffffff' : theme.accent,
                  },
                ]}
              >
                {today.d}
              </Text>
              {todayMarkObj && (
                <View
                  style={[
                    styles.cellStatusBadge,
                    {
                      backgroundColor: '#ffffff',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cellStatusSymbol,
                      { color: todayMarkObj.color },
                    ]}
                  >
                    {todayMarkObj.symbol}
                  </Text>
                </View>
              )}
            </Pressable>
            </MarkPop>
          </View>
        </View>
      </View>

      {/* Aktivite Çemberleri: Aylık Takvim Görünümü (3 Satır Kompakt) veya 7 Günlük Haftalık Görünüm */}
      {monthlyViewMode ? (
        (() => {
          const monthCols = 11;
          const mCellSize = Math.min(
            22,
            Math.max(
              18,
              Math.floor((cardInnerWidth - 50) / monthCols)
            )
          );
          const mCellGap = Math.max(
            4,
            Math.floor(
              (cardInnerWidth - mCellSize * monthCols) /
                (monthCols - 1)
            )
          );
          const mLinkH = 11;

          return (
            <View
              style={{
                marginTop: 6,
                marginBottom: -4,
                gap: 4,
                alignSelf: 'center',
                width: cardInnerWidth,
              }}
            >
              {[0, 1, 2].map((rowIdx) => {
                const rowDays = daysArray.slice(
                  rowIdx * monthCols,
                  (rowIdx + 1) * monthCols
                );
                if (rowDays.length === 0) return null;

                return (
                  <View
                    key={`m-row-${rowIdx}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: mCellGap,
                      position: 'relative',
                      height: mCellSize,
                    }}
                  >
                    {rowDays.map((d) => {
                      const k = dateKey(
                        viewMonth.y,
                        viewMonth.m,
                        d
                      );
                      const mark = getMark(h.id, k);
                      const markObj = mark ? MARKS[mark] : null;
                      const isFuture = k > today.key;
                      const isToday = k === today.key;
                      const prevMark =
                        d > 1
                          ? getMark(
                              h.id,
                              dateKey(
                                viewMonth.y,
                                viewMonth.m,
                                d - 1
                              )
                            )
                          : null;
                      const nextMark =
                        d < dim
                          ? getMark(
                              h.id,
                              dateKey(
                                viewMonth.y,
                                viewMonth.m,
                                d + 1
                              )
                            )
                          : null;
                      const inGreenChain =
                        mark === 'g' &&
                        (prevMark === 'g' || nextMark === 'g');

                      return (
                        <View
                          key={k}
                          style={{
                            width: mCellSize,
                            height: mCellSize,
                            position: 'relative',
                          }}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${h.name}, ${d} ${TR_MONTHS[viewMonth.m]}: ${markObj?.subLabel || 'İşaretsiz'}`}
                            disabled={isFuture}
                            onPress={() => handleCellPress(h, k)}
                            onLongPress={() =>
                              handleCellLongPress(h, k)
                            }
                            delayLongPress={380}
                            style={[
                              styles.chainCell,
                              {
                                width: mCellSize,
                                height: mCellSize,
                                borderRadius: mCellSize / 2,
                                backgroundColor: markObj
                                  ? withAlpha(markObj.color, 0.1)
                                  : isToday
                                  ? withAlpha(theme.accent, 0.14)
                                  : theme.isDark
                                  ? 'rgba(255,255,255,0.055)'
                                  : 'rgba(0,0,0,0.04)',
                                borderColor: markObj
                                  ? markObj.color
                                  : isToday
                                  ? theme.accent
                                  : theme.isDark
                                  ? 'rgba(255,255,255,0.07)'
                                  : 'rgba(0,0,0,0.04)',
                                borderWidth: inGreenChain
                                  ? 1.4
                                  : isToday && !markObj
                                  ? 1.6
                                  : 1,
                                opacity: isFuture ? 0.3 : 1,
                              },
                            ]}
                          >
                            <Text
                              allowFontScaling={false}
                              style={{
                                fontSize: 9.5,
                                fontVariant: ['tabular-nums'],
                                color: markObj
                                  ? '#ffffff'
                                  : isToday
                                  ? theme.accent
                                  : theme.muted,
                                fontWeight:
                                  markObj || isToday
                                    ? '800'
                                    : '600',
                              }}
                            >
                              {d}
                            </Text>
                            {markObj && (
                              <View
                                style={{
                                  position: 'absolute',
                                  right: -1.5,
                                  bottom: -1.5,
                                  width: 8.5,
                                  height: 8.5,
                                  borderRadius: 4.25,
                                  backgroundColor: '#ffffff',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Text
                                  allowFontScaling={false}
                                  style={{
                                    fontSize: 6,
                                    fontWeight: '900',
                                    color: markObj.color,
                                    lineHeight: 7,
                                  }}
                                >
                                  {markObj.symbol}
                                </Text>
                              </View>
                            )}
                          </Pressable>
                        </View>
                      );
                    })}

                    {/* Satır İçi 3B Metalik Zincir & Lazer Dalgası Köprüleri */}
                    {rowDays.map((d, colIdx) => {
                      if (
                        colIdx >= rowDays.length - 1 ||
                        d >= dim
                      ) {
                        return null;
                      }
                      const k = dateKey(
                        viewMonth.y,
                        viewMonth.m,
                        d
                      );
                      const mark = getMark(h.id, k);
                      const nextMark = getMark(
                        h.id,
                        dateKey(viewMonth.y, viewMonth.m, d + 1)
                      );
                      const linkActive =
                        mark === 'g' && nextMark === 'g';
                      const linkColor =
                        mark === 'g' && nextMark === 'g'
                          ? MARK_COLORS.green
                          : mark === 'b' && nextMark === 'b'
                          ? MARK_COLORS.blue
                          : MARK_COLORS.green;

                      return (
                        <ChainLink
                          key={`m-link-${k}`}
                          active={linkActive}
                          color={linkColor}
                          trackColor={
                            theme.isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(0,0,0,0.06)'
                          }
                          width={mCellGap}
                          height={mLinkH}
                          delay={14}
                          stepIndex={d}
                          style={{
                            position: 'absolute',
                            left:
                              (colIdx + 1) * mCellSize +
                              colIdx * mCellGap,
                            top: (mCellSize - mLinkH) / 2,
                            elevation: 6,
                          }}
                        />
                      );
                    })}
                  </View>
                );
              })}
            </View>
          );
        })()
      ) : (
      <HabitWeekScroll
        dayCount={dim}
        cellSize={cellSize}
        initialScrollX={initialScrollX}
        rowViewportWidth={rowViewportWidth}
        cellStep={cellStep}
        scrollKey={scrollKey}
        onTouchChange={(t) => {
          ignoreHabitSwipeRef.current = t;
        }}
      >
        {(first, last) => <>
        {daysArray.slice(first, last).map((d) => {
          const k = dateKey(viewMonth.y, viewMonth.m, d);
          const mark = getMark(h.id, k);
          const markObj = mark ? MARKS[mark] : null;
          const isFuture = k > today.key;
          const isToday = k === today.key;
          const prevMark =
            d > 1
              ? getMark(
                  h.id,
                  dateKey(viewMonth.y, viewMonth.m, d - 1)
                )
              : null;
          const nextMark =
            d < dim
              ? getMark(
                  h.id,
                  dateKey(viewMonth.y, viewMonth.m, d + 1)
                )
              : null;
          const inGreenChain =
            mark === 'g' && (prevMark === 'g' || nextMark === 'g');

          return (
            <View
              key={k}
              style={{
                width: cellSize,
                height: cellSize,
                position: 'absolute',
                left: 10 + (d - 1) * cellStep,
                top: 12,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${h.name}, ${d} ${TR_MONTHS[viewMonth.m]}: ${markObj?.subLabel || 'İşaretsiz'}`}
                disabled={isFuture}
                onPress={() => handleCellPress(h, k)}
                onLongPress={() => handleCellLongPress(h, k)}
                delayLongPress={380}
                style={[
                  styles.chainCell,
                  {
                    width: cellSize,
                    height: cellSize,
                    borderRadius: cellSize / 2,
                    backgroundColor: markObj
                      ? withAlpha(markObj.color, 0.1)
                      : isToday
                      ? withAlpha(theme.accent, 0.12)
                      : theme.isDark
                      ? 'rgba(255,255,255,0.055)'
                      : 'rgba(0,0,0,0.04)',
                    borderColor: markObj
                      ? markObj.color
                      : isToday
                      ? theme.accent
                      : theme.isDark
                      ? 'rgba(255,255,255,0.07)'
                      : 'rgba(0,0,0,0.04)',
                    borderWidth: markObj || isToday ? 1.5 : 1,
                    shadowColor: markObj ? markObj.color : isToday ? theme.accent : 'transparent',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: markObj || isToday ? 0.65 : 0,
                    shadowRadius: markObj || isToday ? 8 : 0,
                    elevation: markObj ? 1 : 0,
                    opacity: isFuture ? 0.3 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chainCellText,
                    {
                      color: markObj
                        ? '#ffffff'
                        : isToday
                        ? theme.accent
                        : theme.muted,
                      fontWeight:
                        markObj || isToday ? '800' : '600',
                    },
                  ]}
                >
                  {d}
                </Text>
                {markObj && (
                  <View
                    style={[
                      styles.cellStatusBadge,
                      { backgroundColor: '#ffffff' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cellStatusSymbol,
                        { color: markObj.color },
                      ]}
                    >
                      {markObj.symbol}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}

        {/* 3B Metalik Zincir & Lazer Dalgası Köprü Katmanı (Hücrelerin üstünde, dokunmayı engellemez) */}
        {daysArray.slice(Math.max(0, first - 1), last).map((d) => {
          if (d >= dim) return null;
          const k = dateKey(viewMonth.y, viewMonth.m, d);
          const mark = getMark(h.id, k);
          const nextMark = getMark(
            h.id,
            dateKey(viewMonth.y, viewMonth.m, d + 1)
          );
          const linkActive = mark === 'g' && nextMark === 'g';
          const linkColor =
            mark === 'g' && nextMark === 'g'
              ? MARK_COLORS.green
              : mark === 'b' && nextMark === 'b'
              ? MARK_COLORS.blue
              : MARK_COLORS.green;

          return (
            <ChainLink
              key={`link-${k}`}
              active={linkActive}
              color={linkColor}
              trackColor={
                theme.isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)'
              }
              width={cellGap}
              height={18}
              delay={18}
              stepIndex={d}
              style={{
                position: 'absolute',
                left: 10 + d * cellSize + (d - 1) * cellGap,
                top: 12 + (cellSize - 18) / 2,
                elevation: 6,
              }}
            />
          );
        })}
        </>}
      </HabitWeekScroll>
      )}
      </View>
    </View>
    </SwipeableTaskRow>
    </FadeSlideIn>
  );
});

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 0, zIndex: 20,
    width: '100%', maxWidth: 760, alignSelf: 'center',
  },
  topbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topbarRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backToHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  backToHomeArrow: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '700',
  },
  appTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  topModeTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3.5,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
  },
  topModeTabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10,
    paddingHorizontal: 23, borderRadius: 999, borderWidth: 1, borderColor: 'transparent',
  },
  topModeTabBtnActive: {
    borderWidth: 1, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65, shadowRadius: 12, elevation: 4,
  },
  topModeTabText: {
    fontSize: 13.5,
    letterSpacing: -0.15,
  },
  topModeBadge: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topModeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  taskFilterTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskFilterBtn: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  taskFilterBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  quickTaskBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  quickTaskInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  taskCard: {
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  taskMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  taskCircleCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  taskCircleTick: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  taskBodyPressable: {
    flex: 1,
    gap: 4,
  },
  taskItemTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 22,
  },
  taskItemDetail: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  taskMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  taskDateChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
  },
  taskDateChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  taskStarBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskStarIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  taskSubtasksContainer: {
    marginTop: 12,
    marginLeft: 38,
    gap: 8,
  },
  taskSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  taskSubCircle: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskSubCircleTick: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '800',
  },
  taskSubtaskText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
  },
  completedSectionCard: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  completedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedToggleBtn: {
    paddingVertical: 4,
    flex: 1,
  },
  completedHeaderTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  clearCompletedBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearCompletedText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  completedList: {
    marginTop: 6,
  },
  completedTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  taskDeleteIconBtn: {
    padding: 6,
  },
  taskModalTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  taskModalStarBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1.5,
  },
  profileCircleBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center',
    justifyContent: 'center', shadowColor: '#000000', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 10, elevation: 3,
  },
  profileCircleInitials: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  profileCircleEmoji: {
    fontSize: 15,
  },
  profileHeaderCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  profileBigAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
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
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  profileSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  profileStatBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: 'center',
  },
  profileStatVal: {
    fontSize: 16.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  profileStatLbl: {
    fontSize: 11.5,
    marginTop: 3,
    fontWeight: '600',
    textAlign: 'center',
  },
  heatmapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heatmapSummary: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heatmapLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  heatmapLegendCell: {
    width: 10,
    height: 10,
    borderRadius: 2.5,
  },
  heatmapLegendText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  profileSectionCard: {
    padding: 18,
    marginBottom: 14,
  },
  profileSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.25,
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
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  profileSavedToastText: {
    fontSize: 13,
    fontWeight: '700',
  },
  backupInfoBox: {
    padding: 14,
    borderRadius: 16,
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
  floatingGearBtn: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
    zIndex: 30,
  },
  categoryBar: {
    marginHorizontal: 16, padding: 4, borderWidth: 1, borderColor: 'transparent',
    borderRadius: 24, maxHeight: 92, flexShrink: 0,
    maxWidth: 728, alignSelf: 'center', alignItems: 'stretch',
  },
  tabsScroll: {
    flexDirection: 'row', gap: 4,
  },
  addTabButton: {
    width: 64, borderWidth: 1, borderStyle: 'dashed', borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', gap: 3, marginHorizontal: 2,
  },
  tabBtn: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 7, paddingHorizontal: 5,
    borderRadius: 20, borderWidth: 1, borderColor: 'transparent', gap: 4,
  },
  tabEmojiWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabEmojiInactive: {
    opacity: 0.55,
    filter: [{ grayscale: 1 }],
  },
  tabEmojiGrayscaleClip: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    mixBlendMode: 'saturation',
  },
  tabEmojiShadowClone: {
    position: 'absolute',
    left: -48,
    top: 0,
    paddingRight: 48,
    textShadowColor: '#808080',
    textShadowOffset: { width: 48, height: 0 },
    textShadowRadius: 0,
  },
  tabEmoji: {
    fontSize: 19,
    marginBottom: 1,
  },
  tabName: {
    fontSize: 11, lineHeight: 14, flexShrink: 0, letterSpacing: -0.2, maxWidth: '100%',
  },
  tabCountPill: {
    paddingHorizontal: 11, paddingVertical: 2, borderRadius: 999,
  },
  tabCount: {
    fontSize: 10.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  mainScroll: {
    flex: 1,
  },
  mainContent: {
    paddingHorizontal: 16, paddingTop: 0, paddingBottom: 36, width: '100%', maxWidth: 760, alignSelf: 'center',
  },
  hero: {
    paddingVertical: 11,
    paddingHorizontal: 15,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 5,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  heroEmojiBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: {
    fontSize: 21,
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 17.5,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  heroMotto: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.9,
    marginTop: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  progressLabel: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  progressBarBg: {
    flex: 1,
    height: 5.5,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 99,
  },
  progressPct: {
    minWidth: 38,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  heroLayer: {
    // Kutlama konfetisi alttaki kartların üstünde görünsün
    zIndex: 10,
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 12, marginBottom: 13,
  },
  neonAddBtn: {
    width: 35, height: 35, borderRadius: 18, borderWidth: 1.5, alignItems: 'center',
    padding: 0, flexShrink: 0,
    justifyContent: 'center', shadowOpacity: 0.6, shadowRadius: 9, shadowOffset: { width: 0, height: 0 },
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monthNavPill: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 2,
    borderRadius: 999, borderWidth: 1,
  },
  monthTitle: {
    minWidth: 80, textAlign: 'center', fontSize: 13, fontWeight: '700', letterSpacing: -0.2,
  },
  iconBtnMinimal: {
    width: 20, height: 24, alignItems: 'center', justifyContent: 'center',
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
    fontSize: 19,
    lineHeight: 20,
    fontWeight: '600',
  },
  toolbarRight: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto',
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  primaryBtn: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 15,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  pillBtn: {
    borderRadius: 999, paddingVertical: 9, paddingHorizontal: 10, borderWidth: 1,
  },
  pillBtnText: {
    fontSize: 10.5, fontWeight: '600',
  },
  ghostBtn: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderWidth: 1.4,
  },
  ghostBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  dangerBtn: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderWidth: 1.4,
    borderColor: '#f43f5e',
  },
  dangerBtnConfirm: {
    backgroundColor: '#f43f5e',
  },
  dangerBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#f43f5e',
  },
  emptyBox: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  cardsList: {
    gap: 14,
  },
  card: {
    paddingVertical: 14, paddingHorizontal: 14, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 14, elevation: 3,
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  dragHandleBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactInfo: {
    flex: 1,
    gap: 2,
  },
  cardHead: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
  },
  cardInfo: {
    flex: 1, minWidth: 0, gap: 8,
  },
  cardTitleGroup: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 3,
  },
  cardTitle: {
    fontSize: 16, fontWeight: '700', letterSpacing: -0.3, lineHeight: 22,
  },
  cardDetail: {
    fontSize: 11.5, fontWeight: '400', lineHeight: 17,
  },
  cardStats: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 7,
  },
  statMicroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7,
    paddingVertical: 4, borderRadius: 999, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.12)',
  },
  statText: {
    fontSize: 10, fontWeight: '500', fontVariant: ['tabular-nums'],
  },
  statWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
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
    alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 44,
  },
  todayBtn: {
    width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, alignItems: 'center',
    justifyContent: 'center', position: 'relative',
  },
  todayBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBadgeText: {
    fontSize: 8, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center',
  },
  todayBtnNum: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  chainScroll: {
    marginTop: 12, marginBottom: -2, alignSelf: 'center',
  },
  chainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  chainCell: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chainCellText: {
    fontSize: 13, fontVariant: ['tabular-nums'],
  },
  cellStatusBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  cellStatusSymbol: {
    fontSize: 8.5,
    fontWeight: '900',
    lineHeight: 10,
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
    marginTop: 24,
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
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
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
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalBackdropInner: {
    width: '100%',
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 0,
  },
  menuSheet: {
    width: 268,
    padding: 12,
    borderRadius: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
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
    borderRadius: 14,
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
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 10,
  },
  editorTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.4,
    borderRadius: 14,
    fontSize: 15.5,
    marginBottom: 14,
  },
  editorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  goalChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  goalTypeGrid: {
    gap: 8,
    marginBottom: 14,
  },
  habitIdentityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
  },
  habitNameInput: {
    flex: 1, width: 'auto', minWidth: 0, height: 48, marginBottom: 0,
  },
  emojiPickerTrigger: {
    width: 58, height: 48, borderWidth: 1, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3,
  },
  emojiPickerPreview: { fontSize: 27 },
  emojiPickerPanel: {
    borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 14,
  },
  emojiPickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  emojiPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emojiPickerOption: {
    width: 40, height: 40, borderWidth: 1, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  goalTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  goalTypeBtn: {
    flex: 1,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTypeBtnText: {
    fontSize: 23,
    fontWeight: '700',
    textAlign: 'center',
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
  timerRingCaption: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 2,
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
  dateTimeFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  dateTimeSelectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.8,
    borderRadius: 12,
  },
  dateTimeSelectBtnText: {
    flex: 1,
    fontSize: 15,
  },
  dateTimeActionBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  dateTimeActionBadgeText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '700',
  },
  dateTimeClearBtn: {
    width: 40,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#484848',
    borderWidth: 1.5,
    borderColor: '#767676',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerBox: {
    backgroundColor: '#000000',
    borderWidth: 1.5,
    borderColor: '#484848',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#484848',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavBtnText: {
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '700',
  },
  calendarMonthTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  calendarWeekdayText: {
    flex: 1,
    textAlign: 'center',
    color: '#B5B5B5',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarGrid: {
    gap: 4,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    gap: 4,
  },
  calendarDayCell: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  timeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeSectionTitle: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '800',
  },
  timeToggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 99,
    borderWidth: 1,
  },
  timeToggleBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  timeStepperLabel: {
    color: '#B5B5B5',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  wheelPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 4,
    marginBottom: 2,
  },
  wheelCol: {
    alignItems: 'center',
    gap: 6,
  },
  wheelBox: {
    width: 96,
    height: WHEEL_HEIGHT,
    borderRadius: 14,
    backgroundColor: '#1a0000',
    borderWidth: 1.5,
    borderColor: '#484848',
    overflow: 'hidden',
    position: 'relative',
  },
  wheelHighlightBar: {
    position: 'absolute',
    top: WHEEL_ITEM_HEIGHT,
    left: 6,
    right: 6,
    height: WHEEL_ITEM_HEIGHT,
    borderRadius: 10,
    backgroundColor: '#1C1C1C',
    borderWidth: 1.5,
    borderColor: '#767676',
  },
  wheelScroll: {
    width: '100%',
    height: WHEEL_HEIGHT,
  },
  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemText: {
    fontVariant: ['tabular-nums'],
  },
  wheelItemTextSelected: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  wheelItemTextDim: {
    color: 'rgba(224, 163, 163, 0.45)',
    fontSize: 16,
    fontWeight: '600',
  },
  wheelColon: {
    color: '#767676',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 18,
  },
  datePreviewBanner: {
    backgroundColor: '#484848',
    borderWidth: 1,
    borderColor: '#767676',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    alignItems: 'center',
  },
  datePreviewText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'center',
  },
});

