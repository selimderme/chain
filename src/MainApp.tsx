import { InstantButton as TouchableOpacity } from './InstantButton';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
  useColorScheme,
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
import EmojiPicker from './EmojiPicker';
import TimeWheelColumn from './TimeWheelColumn';
import CategoryActions from './CategoryActions';
import SettingsScreen, { settingsTheme } from './SettingsScreen';
import StatisticsScreen from './StatisticsScreen';
import DiscoverScreen from './DiscoverScreen';
import {DiscoverHabit, discoverHabitExists} from './discoverCatalog';
import ProfilePhoto from './ProfilePhoto';
import { AuroraDock, AuroraIcon, auroraHabitColor, AuroraCategoryGlyph, AuroraActivePill, AuroraMoreDots } from './AuroraUI';
import { AuroraSummary, AuroraHabitFace, AuroraRoutineToolbar, SolidOrb } from './AuroraReference';
import {GlassMaterial,GlowFill,SoftButton} from './AuroraGlass';
import { appearance, preferences } from './profileModel';
import { SheetBackdrop, SheetHost } from './SheetBackdrop';
import { useStableCallback } from './useStableCallback';
import { useHabitTimers } from './useHabitTimers';
import { activateLocalAccount, prepareLocalAccount } from './localAccounts';
import { CardSheen, CategoryIcon, AccentSheen, HabitEmblem, habitEmoji, NeonBackdrop, PlusIcon } from './NeonDesign';
import {
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

const HOURS_LIST = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_LIST = Array.from({ length: 60 }, (_, i) => i);

const TASK_NOTIFICATION_CHANNEL_ID = 'gorev-hatirlatici';
const TASK_COMPLETE_COLOR = '#50CBFF';

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

async function syncTaskNotifications(tasks: TaskItem[], promptPerm = false, enabled = true): Promise<void> {
  if (Platform.OS === 'web') {
    if (promptPerm) {
      await ensureNotificationPermissions(true);
    }
    return;
  }
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) {
      if (item.identifier.startsWith('task-reminder-')) {
        await Notifications.cancelScheduledNotificationAsync(item.identifier);
      }
    }

    if (!enabled) return;
    const hasActiveDatedTasks = tasks.some((t) => !t.done && !!t.dueDate);
    const permitted = await ensureNotificationPermissions(promptPerm || hasActiveDatedTasks);
    if (!permitted) return;

    const nowMs = Date.now();
    for (const task of tasks) {
      if (task.done || !task.dueDate) continue;
      const triggerDate = getTaskTriggerDate(task.dueDate);
      if (!triggerDate || triggerDate.getTime() <= nowMs) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: `task-reminder-${task.id}`,
        content: {
          title: task.title,
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const compactDatePicker = windowHeight < 740;
  const wideDatePicker = windowWidth >= 640 && windowHeight < 740;
  const pickerDayHeight = compactDatePicker ? (windowHeight < 620 ? 20 : 28) : 36;
  const pickerInsets = useSafeAreaInsets();
  const [datePickerContentHeight, setDatePickerContentHeight] = useState(0);
  const [datePickerActionsHeight, setDatePickerActionsHeight] = useState(56);
  const datePickerAvailableHeight = windowHeight * 0.98 - 24 - Math.max(pickerInsets.bottom + 8, 16) - datePickerActionsHeight - (compactDatePicker ? 8 : 12) - 4;
  const datePickerScale = datePickerContentHeight > 0 ? Math.min(1, Math.max(0.1, datePickerAvailableHeight / datePickerContentHeight)) : 1;
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
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [routineOptionsOpen,setRoutineOptionsOpen]=useState(false);
  const [weekOffset,setWeekOffset]=useState(0);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
  const [categoryMenuId, setCategoryMenuId] = useState<TabId | null>(null);
  const [categoryEditId, setCategoryEditId] = useState<TabId | null>(null);
  const [categoryDragging, setCategoryDragging] = useState(false);
  const categoryScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const categoryWidths = useRef<Record<string, number>>({});
  const categoryViewportWidth = useRef(0);
  const categoryContentWidth = useRef(0);
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
  const [profilePanel, setProfilePanel] = useState<'stats' | 'settings' | null>(null);

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
  const firedWebNotifsRef = useRef<Set<string>>(new Set());
  const notificationSyncRef = useRef<Promise<void>>(Promise.resolve());
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
    notificationSyncRef.current = notificationSyncRef.current.catch(() => {}).then(() =>
      syncTaskNotifications(stateRef.current.tasks || [], false, preferences(stateRef.current).notifications));
  }, [loaded, state.tasks, state.preferences?.notifications]);

  // Web veya uygulama açıkken zamanı gelen görevleri kontrol et
  useEffect(() => {
    if (!loaded || !preferences(state).notifications) return;
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
              new window.Notification(task.title);
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
  }, [loaded, state.tasks, state.preferences?.notifications]);

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
  const revealSelectedCategory = () => {
    if (categoryDragging || categoryViewportWidth.current <= 0) return;
    let left = 0;
    for (const tab of tabs) {
      const width = categoryWidths.current[tab.id];
      if (!width) return;
      if (tab.id === state.tab) {
        const viewport = categoryViewportWidth.current;
        const target = left + width / 2 - viewport / 2;
        const x = Math.max(0, Math.min(target, Math.max(0, categoryContentWidth.current - viewport)));
        categoryScrollRef.current?.scrollTo({x, animated:false});
        return;
      }
      left += width + 4;
    }
  };
  useEffect(() => {
    revealSelectedCategory();
  }, [tabs, state.tab, windowWidth, loaded, state.section, profileOpen, categoryDragging]);
  const activeTab: TabConfig = useMemo(
    () => tabs.find((t) => t.id === state.tab) || tabs[0],
    [state.tab, tabs]
  );
  const isTasksMode = state.section === 'gorevler' && !profileOpen && !discoverOpen;
  const systemScheme = useColorScheme();
  const theme = appearance(isTasksMode || profileOpen ? TASKS_THEME : activeTab.theme, preferences(state).theme, systemScheme);
  const formTheme:TabTheme = {...appearance(TASKS_THEME,preferences(state).theme,systemScheme),
    surface:theme.isDark?'#0A1E44E8':'#F4F9FFF2',surfaceGlass:theme.isDark?'#0D2C588C':'#E5F2FFB8',
    accent:'#008EFF',accentGradientEnd:'#005BDB',accentInk:'#FFFFFF',accentSoft:theme.isDark?'#008EFF30':'#168CFF18',
    text:theme.isDark?'#F4F9FF':'#15365F',muted:theme.isDark?'#9DB9E7':'#4C709A',cardBorderColor:theme.isDark?'#78C9FF66':'#4C9EEB70'};
  const tx = (tr: string, en: string) => preferences(state).language === 'en' ? en : tr;

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
      const first = localState.profile?.deleted ? '' : localState.profile?.firstName || user.firstName || '';
      const last = localState.profile?.deleted ? '' : localState.profile?.lastName || user.lastName || '';



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
    await saveAppState(stateRef.current);
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

  const handleCellPress = (habit: Habit, dateStr: string, completeOnly = false) => {
    const current = getMark(habit.id, dateStr);
    setMark(habit.id, dateStr, (completeOnly ? current === 'g' : !!current) ? '' : 'g');
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
    setDiscoverOpen(false);
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
    setDiscoverOpen(false);
    if (
      !profileOpen &&
      (state.section || 'rutin') === 'rutin' &&
      state.tab === tabId
    ) {
      revealSelectedCategory();
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

  const handleShowToday = () => {
    setProfilePanel(null);
    handleSelectSection('rutin');
    setMonthlyViewMode(false);
    setWeekOffset(0);
  };

  const handleToggleProfile = () => {
    setDiscoverOpen(false);
    Haptics.selectionAsync().catch(() => {});

    if (!profileOpen) {
      setProfilePanel(null);


      setReorderMode(false);
      setTaskReorderMode(false);
    }
    setProfileOpen((prev) => !prev);
  };

  const handleAddDiscoveredHabit = (template: DiscoverHabit, destination: TabId) => {
    updateAndSave(prev => {
      if (discoverHabitExists(prev.habits, template)) return prev;
      const available=getStateTabs(prev);
      const tab=available.find(item=>item.id===destination)?.id || available[0].id;
      const en=preferences(prev).language==='en';
      return {...prev, habits:[...prev.habits, {
        id:uid(),templateId:template.id,tab,name:en?template.nameEn:template.name,
        detail:en?template.detailEn:template.detail,emoji:template.emoji,
        goal:{type:template.goalType,target:template.goalTarget,unit:template.goalUnit},subtasks:[],
      }]};
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
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
    if (preferences(state).notifications) ensureNotificationPermissions(true).catch(() => {});
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
      if (preferences(state).notifications) ensureNotificationPermissions(true).catch(() => {});
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
            ...parsed.profile,
            firstName: restoredFirstName,
            lastName: restoredLastName,
            lastBackupAt:
              parsed.profile?.lastBackupAt || prev.profile?.lastBackupAt,
            lastRestoreAt: nowStamp,
          },
          preferences: parsed.preferences || prev.preferences,
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
    Math.min(windowWidth, 760) - 32 - 32 - leftBorderW - rightBorderW
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

  const stableQuickAdjust = useStableCallback((habit:Habit,direction:number)=>{if(!habit.goal||!['amount','reps'].includes(habit.goal.type))return;setProgressAndAutoMark(habit,today.key,getProgress(habit.id,today.key)+direction*getQuickSteps(habit.goal)[0]);});
  const stableHandleCardPress = useStableCallback(handleCardPress);
  const stableHandleCellPress = useStableCallback(handleCellPress);
  const stableHandleCellLongPress = useStableCallback(handleCellLongPress);
  const stableOpenEditor = useStableCallback(openEditor);
  const stableMoveHabit = useStableCallback(moveHabit);
  const stableSetListGestureActive = useStableCallback(setListGestureActive);
  const habitCardActions = useMemo<HabitCardActions>(() => ({
    quickAdjust: stableQuickAdjust,
    handleCardPress: stableHandleCardPress,
    handleCellPress: stableHandleCellPress,
    handleCellLongPress: stableHandleCellLongPress,
    openEditor: stableOpenEditor,
    moveHabit: stableMoveHabit,
    setListGestureActive: stableSetListGestureActive,
  }), [stableQuickAdjust, stableHandleCardPress, stableHandleCellPress, stableHandleCellLongPress, stableOpenEditor, stableMoveHabit, stableSetListGestureActive]);

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

  const navigationDock = <AuroraDock theme={theme} bottom={pickerInsets.bottom} english={preferences(state).language==='en'} active={profileOpen?profilePanel:discoverOpen?'discover':activeSection==='rutin'?'home':null}
    onHome={handleShowToday}
    onDiscover={()=>{setProfileOpen(false);setProfilePanel(null);setDiscoverOpen(true);setReorderMode(false);setTaskReorderMode(false);}}
    onStats={()=>{setDiscoverOpen(false);setProfileOpen(true);setProfilePanel('stats');}}
    onSettings={()=>{setDiscoverOpen(false);setProfileOpen(true);setProfilePanel('settings');}}/>;

  if (profileOpen && profilePanel==='stats') {
    return <View style={[styles.safeArea,{backgroundColor:theme.bg}]}>
      <NeonBackdrop color={theme.accent} isDark={theme.isDark}/>
      <SafeAreaView edges={['top','left','right']} style={styles.safeArea}>
        <StatusBar style={theme.isDark?'light':'dark'}/>
        <View style={{flex:1,paddingBottom:Math.max(10,pickerInsets.bottom-14)+74}}><StatisticsScreen state={state} theme={theme} today={today.key}/></View>
        {navigationDock}
      </SafeAreaView>
    </View>;
  }

  if (profileOpen && profilePanel==='settings') {
    return <SafeAreaView edges={['top','left','right']} style={[styles.safeArea,{backgroundColor:settingsTheme(theme).bg}]}>
      <StatusBar style={theme.isDark?'light':'dark'}/>
      <SettingsScreen state={state} theme={theme} authUser={authUser} cloudStatus={cloudSyncStatus} cloudNotice={cloudNoticeMsg}
        close={handleShowToday} update={updateAndSave} signIn={() => setAuthScreenVisible(true)} signOut={handleSignOut}
        cloudBackup={handleManualCloudBackup} cloudRestore={handleManualCloudRestore} exportBackup={handleExport} importBackup={handleImport}
        notifications={async enabled => !enabled || await ensureNotificationPermissions(true)}/>
    </SafeAreaView>;
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: theme.bg }]}
    >
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />

      {/* Kategoriye Göre Dinamik 3D Partikül Atmosferi (Yüksek Performanslı Native Driver) */}
      <NeonBackdrop color={theme.accent} isDark={theme.isDark} />

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
          {!profileOpen && <View style={{flexDirection:"row",alignItems:"center",gap:windowWidth<360?6:10,marginRight:8,flexShrink:1}}><AuroraIcon name="sun" color="#5CD6FF" size={windowWidth<360?20:25}/><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} style={{color:theme.text,fontSize:windowWidth<360?15:windowWidth<400?19:20.5,fontWeight:"700",letterSpacing:-.4,flexShrink:1}}>{preferences(state).language === "en" ? "Daily Routine" : "Günlük Rutin"}</Text></View>}


      {profileOpen ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setProfileOpen(false);
              }}
              style={[
                styles.backToHomeBtn,
                {
                  backgroundColor: theme.accentSoft,
                },
              ]}
              activeOpacity={0.75}
            >
              <Text style={[styles.backToHomeArrow, { color: theme.accent }]}>
                ‹
              </Text>
              <Text style={[styles.appTitle, { color: theme.text }]}>
                {preferences(state).language === 'en' ? 'Profile' : 'Profil'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View
              style={[
                styles.topModeTabs,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(8,24,66,0.55)'
                    : 'rgba(0,0,0,0.04)',
                  borderColor: theme.isDark
                    ? 'rgba(110,145,225,0.42)'
                    : 'rgba(0,0,0,0.05)',
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleSelectSection('rutin')}
                style={[
                  styles.topModeTabBtn,
                  !discoverOpen && activeSection === 'rutin' && [
                    styles.topModeTabBtnActive,
                    {
                      backgroundColor: theme.isDark ? 'transparent' : withAlpha(theme.accent, 0.22),
                      borderColor: theme.isDark ? '#41B7FF' : theme.accent,
                      shadowColor: theme.isDark ? '#006FFF' : theme.accent,
                    },
                  ],
                ]}
              >
                {!discoverOpen && activeSection === 'rutin' && theme.isDark && <AuroraActivePill radius={16} from="#087AE0" to="#103F76"/>}
                <Text
                  style={[
                    styles.topModeTabText,
                    {
                      color: !discoverOpen && activeSection === 'rutin' ? theme.text : theme.muted,
                      fontWeight: !discoverOpen && activeSection === 'rutin' ? '700' : '600',
                    },
                  ]}
                >
                  {preferences(state).language === 'en' ? "Daily" : "Günlük"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleSelectSection('gorevler')}
                style={[
                  styles.topModeTabBtn,
                  !discoverOpen && activeSection === 'gorevler' && [
                    styles.topModeTabBtnActive,
                    {
                      backgroundColor: theme.isDark ? 'transparent' : withAlpha(theme.accent, 0.22),
                      borderColor: theme.isDark ? '#41B7FF' : theme.accent,
                      shadowColor: theme.isDark ? '#006FFF' : theme.accent,
                    },
                  ],
                ]}
              >
                {!discoverOpen && activeSection === 'gorevler' && theme.isDark && <AuroraActivePill radius={16} from="#087AE0" to="#103F76"/>}
                <Text
                  style={[
                    styles.topModeTabText,
                    {
                      color:
                        !discoverOpen && activeSection === 'gorevler' ? theme.text : theme.muted,
                      fontWeight: !discoverOpen && activeSection === 'gorevler' ? '700' : '600',
                    },
                  ]}
                >
                  {preferences(state).language === 'en' ? "Tasks" : "Görevler"}
                </Text>
                {activeTasksAll.length > 0 && (
                  <View
                    style={[
                      styles.topModeBadge,
                      {
                        backgroundColor:
                          !discoverOpen && activeSection === 'gorevler'
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
                            !discoverOpen && activeSection === 'gorevler'
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
                backgroundColor: profileOpen ? '#075DCC' : theme.isDark ? '#245DD4' : '#DBECFF',
                borderColor: theme.isDark ? '#8AD8FF' : '#397DCD',
                shadowColor: '#168CFF',
              },
            ]}
          >
            {state.profile?.photoUri ? <Image source={{uri:state.profile.photoUri}} style={{width:36,height:36,borderRadius:18}} /> : userInitials ? (
              <Text
                style={[
                  styles.profileCircleInitials,
                  {
                    color: profileOpen || theme.isDark ? '#F4FBFF' : '#175391',
                  },
                ]}
              >
                {userInitials}
              </Text>
            ) : (
              <MicroIcon
                name="user"
                size={15}
                color={profileOpen || theme.isDark ? '#F4FBFF' : '#175391'}
              />
            )}
          </TouchableOpacity>
        </View>
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
              <GlassMaterial accent="#008EFF" radius={24} light={!theme.isDark}/>
              <ProfilePhoto uri={state.profile?.photoUri} initials={userInitials} theme={theme} english={preferences(state).language === 'en'}
                onChange={photoUri => updateAndSave(prev => ({...prev,profile:{firstName:'',lastName:'',...prev.profile,photoUri}}))}/>

              <Text
                style={[
                  styles.profileDisplayName,
                  {
                    color: theme.text,
                    fontStyle: theme.headItalic ? 'italic' : 'normal',
                  },
                ]}
              >
                {userFullName || (state.profile?.deleted ? '' : authUser?.displayName) || (preferences(state).language === 'en' ? 'Guest' : 'Misafir Kullanıcı')}
              </Text>
              {!!(authUser?.email || state.profile?.email) && <Text style={[styles.profileSubtitle, {color: theme.muted}]}>
                {authUser?.email || state.profile?.email}
              </Text>}

              <View style={styles.profileStatsRow}>
                <View
                  style={[
                    styles.profileStatBox,
                    {
                      backgroundColor: theme.isDark
                        ? '#008EFF24'
                        : '#168CFF12',
                    },
                  ]}
                >
                  <GlassMaterial accent="#008EFF" radius={16} light={!theme.isDark}/>
                  <AnimatedNumber
                    value={state.habits.length}
                    style={[styles.profileStatVal, {color:theme.isDark?'#6DDFFF':'#126AC2'}]}
                  />
                  <Text
                    style={[styles.profileStatLbl, { color: theme.muted }]}
                  >
                    {preferences(state).language === 'en' ? "Total habits" : "Toplam Madde"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.profileStatBox,
                    {
                      backgroundColor: theme.isDark
                        ? '#008EFF24'
                        : '#168CFF12',
                    },
                  ]}
                >
                  <GlassMaterial accent="#008EFF" radius={16} light={!theme.isDark}/>
                  <AnimatedNumber
                    value={allDoneToday}
                    suffix={`/${state.habits.length}`}
                    style={[
                      styles.profileStatVal,
                      { color:theme.isDark?'#6DDFFF':'#126AC2' },
                    ]}
                  />
                  <Text
                    style={[styles.profileStatLbl, { color: theme.muted }]}
                  >
                    {preferences(state).language === 'en' ? "Done today" : "Bugün Tamam"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.profileStatBox,
                    {
                      backgroundColor: theme.isDark
                        ? '#008EFF24'
                        : '#168CFF12',
                    },
                  ]}
                >
                  <GlassMaterial accent="#008EFF" radius={16} light={!theme.isDark}/>
                  <AnimatedNumber
                    value={maxBestStreak}
                    suffix={tx(' gün', ' days')}
                    style={[styles.profileStatVal, {color:theme.isDark?'#6DDFFF':'#126AC2'}]}
                  />
                  <Text
                    style={[styles.profileStatLbl, { color: theme.muted }]}
                  >
                    {preferences(state).language === 'en' ? "Best streak" : "En Uzun Zincir"}
                  </Text>
                </View>
              </View>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>
      ) : discoverOpen ? (
        <DiscoverScreen habits={state.habits} tabs={tabs} initialTab={state.tab} theme={theme} english={preferences(state).language==='en'} onAdd={handleAddDiscoveredHabit} onViewRoutine={handleSelectTab}/>
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
                  <GlassMaterial accent="#008EFF" radius={22} light={!theme.isDark}/>
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
                  <GlassMaterial accent="#008EFF" radius={22} light={!theme.isDark}/>
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
                <GlassMaterial accent="#008EFF" radius={24} light={!theme.isDark}/>
                <View
                  style={[
                    styles.taskCircleCheck,
                    {
                      position:'relative',zIndex:1,
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
                        position:'relative',zIndex:1,
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
                    backgroundColor:theme.isDark?'#008EFF0D':'#168CFF08',
                    borderColor:theme.cardBorderColor,
                  },
                ]}
              >
                <Text style={[styles.emptyText, { color: theme.muted }]}>
                  {taskFilter === 'starred'
                    ? 'Henüz yıldızlı görev yok. Görevlerin yanındaki ☆ simgesine dokunarak önemli görevleri buraya sabitleyebilirsin.'
                    : 'Yapılacak görev yok. Yukarıdan hızlıca yazabilir veya “＋ Yeni Görev” ile detaylı görev oluşturabilirsin.'}
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
                      <GlassMaterial accent="#008EFF" radius={24} light={!theme.isDark}/>
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
        <AuroraSummary theme={theme} date={parseKey(today.key)} done={doneToday} total={tabHabits.length} english={preferences(state).language==='en'} weekOffset={weekOffset} onWeekChange={delta=>setWeekOffset(old=>old+delta)}/>
          {!profileOpen && activeSection === 'rutin' && (<>
      {/* Üst kategori seçici */}
      <View
        style={[
          styles.categoryBar,
          {
            width: '100%',
            borderColor: theme.isDark ? 'transparent' : withAlpha(theme.accent, 0.4),
            backgroundColor:theme.isDark?'#0B1D4D33':theme.surfaceGlass,
            borderTopColor: theme.isDark
              ? 'transparent'
              : 'rgba(0,0,0,0.06)',
          },
          Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(22px)',
                WebkitBackdropFilter: 'blur(22px)',
              } as any)
            : null,
        ]}
      >
        <GlassMaterial radius={22} accent={theme.accent} light={!theme.isDark}/>
        <ScrollView
          ref={categoryScrollRef}
          horizontal
          style={{flex:1,minWidth:0,height:36}}
          scrollEnabled={!categoryDragging}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScroll}
          onLayout={(event) => {
            categoryViewportWidth.current = event.nativeEvent.layout.width;
            revealSelectedCategory();
          }}
          onContentSizeChange={(width) => {
            categoryContentWidth.current = width;
            revealSelectedCategory();
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
              <View {...dragControls.longPressDragProps} onLayout={(event) => {
                categoryWidths.current[t.id] = event.nativeEvent.layout.width;
                revealSelectedCategory();
              }}>
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
                  { minWidth: 60 },
                  selected && {
                    borderColor: theme.isDark ? '#18D1FF' : theme.accent,
                    shadowColor: '#008EFF',
                    shadowOpacity: 0.55,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 0 },
                  },
                ]}
              >
                {selected && (theme.isDark ? <AuroraActivePill radius={13}/> : <AccentSheen color={t.color} />)}
                {t.id.startsWith('custom-') || t.customIcon ? (
                  <View style={!selected ? { filter: [{ grayscale: 1 }] } : undefined}>
                    <Text style={{ fontSize: 17, lineHeight: 20, height: 20 }}>{t.emoji}</Text>
                  </View>
                ) : ['beslenme','egzersiz','bakim','ogrenme'].includes(t.id) ? <View><AuroraCategoryGlyph category={t.id} color={selected?'#FFFFFF':'#C3CEE8'} size={17}/></View> : <View><CategoryIcon category={t.id} size={17} color={selected ? '#FFFFFF' : '#C3CEE8'} /></View>}
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tabName,
                    {
                      color: selected ? '#FFFFFF' : '#C7D1EA',
                      fontWeight: selected ? '700' : '500',
                    },
                  ]}
                >
                  {!t.customIcon?({'bakim':'Bakım','ogrenme':'Öğrenme'} as Record<string,string>)[t.id]||t.name:t.name}
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
            style={[styles.addTabButton, { borderColor: '#6DDFFF99', backgroundColor: '#008EFF20' }]}
          >
            <PlusIcon color="#6DDFFF" size={22}/>
          </TouchableOpacity>
        </ScrollView>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Görünüm ve sıralama" accessibilityState={{expanded:routineOptionsOpen}} onPress={()=>setRoutineOptionsOpen(v=>!v)} style={{width:34,height:34,alignItems:'center',justifyContent:'center',borderRadius:17,borderWidth:1,borderColor:'#9BBEFF38',backgroundColor:'#0A1A4659',marginLeft:4}}><AuroraMoreDots color={theme.isDark?'#C9D4EE':theme.muted}/></TouchableOpacity>
      </View>

      </>)}
        {(routineOptionsOpen || reorderMode || monthlyViewMode) && <AuroraRoutineToolbar
          theme={theme} viewMonth={viewMonth} monthly={monthlyViewMode} reordering={reorderMode}
          canReorder={tabHabits.length > 1 || reorderMode} english={preferences(state).language==='en'}
          onMonth={changeMonth}
          onMonthly={()=>{Haptics.selectionAsync().catch(()=>{});setMonthlyViewMode(v=>!v);}}
          onReorder={()=>{Haptics.selectionAsync().catch(()=>{});setReorderMode(v=>!v);}}
        />}

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
            holdDelay={450}
            onDragActiveChange={active=>{ignoreHabitSwipeRef.current=active;setListGestureActive(active);}}
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
            gap={10}
            style={styles.cardsList}
            renderItem={(h, i, dragControls) => (
              <HabitCard
                h={h} i={i} dragControls={dragControls} habitCount={tabHabits.length}
                habitMarks={state.marks[h.id]} habitProgress={state.progress?.[h.id]}
                reorderMode={reorderMode} monthlyViewMode={monthlyViewMode} weekOffset={weekOffset} english={preferences(state).language==='en'}
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

      {!profileOpen && !discoverOpen && activeSection==='rutin' && !reorderMode && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Yeni alışkanlık ekle" onPress={()=>openEditor(null)} style={{position:'absolute',zIndex:41,right:Math.max(14,(windowWidth-728)/2+10),bottom:Math.max(10,pickerInsets.bottom-14)+74,width:50,height:50,borderRadius:25,borderWidth:1.5,borderColor:'#79EBFF',backgroundColor:'#006CFF',alignItems:'center',justifyContent:'center',shadowColor:'#008EFF',shadowOpacity:.8,shadowRadius:18,shadowOffset:{width:0,height:4},elevation:10}}><SolidOrb fill="#229CFF" end="#003AFF" radius={25}/><View><PlusIcon color="#FFFFFF" size={31}/></View></TouchableOpacity>}
      {navigationDock}
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
                  backgroundColor: formTheme.surface,
                  borderWidth:1, borderColor:formTheme.cardBorderColor,
                  borderRadius: formTheme.radius,
                  maxHeight: '88%',
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <GlassMaterial accent="#008EFF" radius={24} light={!formTheme.isDark}/>
              <ScrollView
                style={{position:'relative',zIndex:1}}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text
                  style={[
                    styles.editorTitle,
                    {
                      color: formTheme.text,
                      fontStyle: formTheme.headItalic ? 'italic' : 'normal',
                    },
                  ]}
                >
                  {editingHabit ? 'Maddeyi düzenle' : 'Yeni madde'}
                </Text>

                <Text style={[styles.inputLabel, { color: formTheme.text }]}>
                  Madde adı ve emoji
                </Text>
                <View style={styles.habitIdentityRow}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Emoji seç"
                    accessibilityState={{ expanded: emojiPickerOpen }}
                    onPress={() => setEmojiPickerOpen((open) => !open)}
                    style={[styles.emojiPickerTrigger, { backgroundColor: formTheme.accentSoft, borderColor: formTheme.accent }]}
                  >
                    <Text style={styles.emojiPickerPreview}>
                      {habitEmojiChoice || habitEmoji(habitName, editingHabit?.tab || state.tab)}
                    </Text>
                    <Text style={{ color: formTheme.accent, fontSize: 10 }}>▾</Text>
                  </TouchableOpacity>
                <TextInput
                  accessibilityLabel="Madde adı"
                  value={habitName}
                  onChangeText={setHabitName}
                  maxLength={60}
                  placeholder="Örn. Diş fırçalama, Göğüs egzersizi"
                  placeholderTextColor={formTheme.muted}
                  style={[
                    styles.textInput,
                    styles.habitNameInput,
                    {
                      color: formTheme.text,
                      backgroundColor: formTheme.isDark
                        ? formTheme.surfaceGlass
                        : formTheme.surfaceGlass,
                      borderColor: formTheme.isDark
                        ? formTheme.cardBorderColor
                        : formTheme.cardBorderColor,
                    },
                  ]}
                />
                </View>

                {emojiPickerOpen && (
                  <View style={[styles.emojiPickerPanel, { borderColor: formTheme.cardBorderColor }]}>
                    <View style={styles.emojiPickerHeader}>
                      <Text style={[styles.inputLabel, { color: formTheme.text, marginBottom: 0 }]}>Emoji seç</Text>
                      <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Otomatik emoji kullan"
                        onPress={() => { setHabitEmojiChoice(''); setEmojiPickerOpen(false); }}
                        style={{ paddingVertical: 8, paddingHorizontal: 4 }}
                      >
                        <Text style={{ color: formTheme.accent, fontSize: 12 }}>Otomatik</Text>
                      </TouchableOpacity>
                    </View>
                    <EmojiPicker value={habitEmojiChoice} theme={formTheme} onSelect={emoji => {
                      Haptics.selectionAsync().catch(() => {});
                      setHabitEmojiChoice(emoji);
                      setEmojiPickerOpen(false);
                    }} />
                  </View>
                )}

                <Text style={[styles.inputLabel, { color: formTheme.text }]}>
                  Hedef / not{' '}
                  <Text style={{ fontWeight: '400', color: formTheme.muted }}>
                    (isteğe bağlı)
                  </Text>
                </Text>
                <TextInput
                  value={habitDetail}
                  onChangeText={setHabitDetail}
                  maxLength={80}
                  placeholder="Örn. Sabah & akşam, 3×12 tekrar"
                  placeholderTextColor={formTheme.muted}
                  style={[
                    styles.textInput,
                    {
                      color: formTheme.text,
                      backgroundColor: formTheme.isDark
                        ? formTheme.surfaceGlass
                        : formTheme.surfaceGlass,
                      borderColor: formTheme.isDark
                        ? formTheme.cardBorderColor
                        : formTheme.cardBorderColor,
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
                                  ? formTheme.accent
                                  : formTheme.isDark
                                  ? formTheme.surfaceGlass
                                  : formTheme.surfaceGlass,
                                borderColor: active
                                  ? formTheme.accent
                                  : formTheme.isDark
                                  ? formTheme.cardBorderColor
                                  : formTheme.cardBorderColor,
                              },
                            ]}
                          >
                            <Text style={[styles.goalTypeBtnText, { color: active ? formTheme.accentInk : formTheme.text }]}>{opt.icon}</Text>
                          </TouchableOpacity>
                        );
                  })}
                </View>

                {goalType === 'timer' && (
                  <View
                    style={[
                      styles.goalConfigBox,
                      {
                        backgroundColor: formTheme.isDark
                          ? formTheme.accentSoft
                          : formTheme.accentSoft,
                        borderColor: formTheme.isDark
                          ? formTheme.cardBorderColor
                          : formTheme.cardBorderColor,
                      },
                    ]}
                  >
                    <View style={styles.inlineInputsRow}>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.subInputLabel, { color: formTheme.muted }]}
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
                          placeholderTextColor={formTheme.muted}
                          style={[
                            styles.smallInput,
                            {
                              color: formTheme.text,
                              borderColor: formTheme.isDark
                                ? formTheme.cardBorderColor
                                : formTheme.cardBorderColor,
                            },
                          ]}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.subInputLabel, { color: formTheme.muted }]}
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
                          placeholderTextColor={formTheme.muted}
                          style={[
                            styles.smallInput,
                            {
                              color: formTheme.text,
                              borderColor: formTheme.isDark
                                ? formTheme.cardBorderColor
                                : formTheme.cardBorderColor,
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
                                  ? formTheme.accent
                                  : formTheme.isDark
                                  ? formTheme.surfaceGlass
                                  : formTheme.surfaceGlass,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.presetChipText,
                                {
                                  color: isPresetActive
                                    ? formTheme.accentInk
                                    : formTheme.text,
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
                        backgroundColor: formTheme.isDark
                          ? formTheme.accentSoft
                          : formTheme.accentSoft,
                        borderColor: formTheme.isDark
                          ? formTheme.cardBorderColor
                          : formTheme.cardBorderColor,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.subInputLabel, { color: formTheme.muted }]}
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
                      placeholderTextColor={formTheme.muted}
                      style={[
                        styles.smallInput,
                        {
                          color: formTheme.text,
                          borderColor: formTheme.isDark
                            ? formTheme.cardBorderColor
                            : formTheme.cardBorderColor,
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
                                  ? formTheme.accent
                                  : formTheme.isDark
                                  ? formTheme.surfaceGlass
                                  : formTheme.surfaceGlass,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              {
                                color:
                                  goalTargetStr === String(r)
                                    ? formTheme.accentInk
                                    : formTheme.text,
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
                        backgroundColor: formTheme.isDark
                          ? formTheme.accentSoft
                          : formTheme.accentSoft,
                        borderColor: formTheme.isDark
                          ? formTheme.cardBorderColor
                          : formTheme.cardBorderColor,
                      },
                    ]}
                  >
                    <View style={styles.inlineInputsRow}>
                      <View style={{ flex: 1.2 }}>
                        <Text
                          style={[styles.subInputLabel, { color: formTheme.muted }]}
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
                          placeholderTextColor={formTheme.muted}
                          style={[
                            styles.smallInput,
                            {
                              color: formTheme.text,
                              borderColor: formTheme.isDark
                                ? formTheme.cardBorderColor
                                : formTheme.cardBorderColor,
                            },
                          ]}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.subInputLabel, { color: formTheme.muted }]}
                        >
                          Birim
                        </Text>
                        <TextInput
                          value={goalUnit}
                          onChangeText={setGoalUnit}
                          maxLength={15}
                          placeholder="ml, g, kcal..."
                          placeholderTextColor={formTheme.muted}
                          style={[
                            styles.smallInput,
                            {
                              color: formTheme.text,
                              borderColor: formTheme.isDark
                                ? formTheme.cardBorderColor
                                : formTheme.cardBorderColor,
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
                                  ? formTheme.accent
                                  : formTheme.isDark
                                  ? formTheme.surfaceGlass
                                  : formTheme.surfaceGlass,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              {
                                color:
                                  goalUnit === u ? formTheme.accentInk : formTheme.text,
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
                    { color: formTheme.text, marginTop: 4 },
                  ]}
                >
                  Alt başlıklar{' '}
                  <Text style={{ fontWeight: '400', color: formTheme.muted }}>
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
                            backgroundColor: formTheme.isDark
                              ? formTheme.surfaceGlass
                              : formTheme.surfaceGlass,
                            borderColor: formTheme.isDark
                              ? formTheme.cardBorderColor
                              : formTheme.cardBorderColor,
                          },
                        ]}
                      >
                        <TouchableOpacity
                          onPress={() => handleToggleSubtask(st.id)}
                          style={[
                            styles.subtaskCheck,
                            {
                              borderColor: st.done
                                ? formTheme.accent
                                : formTheme.muted,
                              backgroundColor: st.done
                                ? formTheme.accent
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
                              color: st.done ? formTheme.muted : formTheme.text,
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
                          <Text style={{ color: formTheme.muted, fontSize: 14 }}>
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
                    placeholderTextColor={formTheme.muted}
                    onSubmitEditing={handleAddSubtask}
                    style={[
                      styles.smallInput,
                      {
                        flex: 1,
                        marginBottom: 0,
                        color: formTheme.text,
                        backgroundColor: formTheme.isDark
                          ? formTheme.surfaceGlass
                          : formTheme.surfaceGlass,
                        borderColor: formTheme.isDark
                          ? formTheme.cardBorderColor
                          : formTheme.cardBorderColor,
                      },
                    ]}
                  />
                  <TouchableOpacity
                    onPress={handleAddSubtask}
                    style={[
                      styles.subtaskAddBtn,
                      { backgroundColor: formTheme.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.primaryBtnText,
                        { color: formTheme.accentInk },
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
                        borderColor: formTheme.cardBorderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.ghostBtnText, { color: formTheme.text }]}>
                      Vazgeç
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={saveEditor}
                    style={[
                      styles.primaryBtn,
                      { backgroundColor: formTheme.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.primaryBtnText,
                        { color: formTheme.accentInk },
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
              expanded={taskDatePickerOpen}
              onDismiss={() => {
                if (taskDatePickerOpen) setTaskDatePickerOpen(false);
                else setTaskModalOpen(false);
              }}
              style={[
                styles.editorCard,
                taskDatePickerOpen && compactDatePicker && { paddingHorizontal: 12 },
                {
                  backgroundColor: formTheme.surface,
                  borderColor: formTheme.cardBorderColor,
                  borderWidth: 1.5,
                  borderRadius: formTheme.radius,
                  maxHeight: '90%',
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <GlassMaterial accent="#008EFF" radius={24} light={!formTheme.isDark}/>
              {taskDatePickerOpen ? (
                <>
                <View style={datePickerScale < 1 ? { height: datePickerContentHeight * datePickerScale } : undefined}>
                <View
                  testID="date-picker-content"
                  onLayout={(event) => setDatePickerContentHeight(event.nativeEvent.layout.height)}
                  style={datePickerScale < 1 ? { transform: [{ scale: datePickerScale }], transformOrigin: 'top center' } : undefined}
                >
                  <View style={[styles.taskModalTopRow, compactDatePicker && { marginBottom: 8 }]}>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setTaskDatePickerOpen(false);
                      }}
                      style={styles.backToHomeBtn}
                    >
                      <Text style={[styles.backToHomeArrow, { color: formTheme.accent }]}>
                        ‹
                      </Text>
                      <Text
                        style={[
                          styles.editorTitle,
                          { color: formTheme.text, marginBottom: 0, fontSize: 18 },
                        ]}
                      >
                        Tarih ve Saat Seç
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Takvim (Tarih Seçimi) */}
                  <View style={wideDatePicker && { flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.datePickerBox, {backgroundColor:formTheme.surfaceGlass,borderColor:formTheme.cardBorderColor}, compactDatePicker && styles.compactDatePickerBox, wideDatePicker && { flex: 1 }]}>
                    <View style={[styles.calendarHeaderRow, compactDatePicker && { marginBottom: 4 }]}>
                      <TouchableOpacity
                        onPress={() => changePickerMonth(-1)}
                        style={[styles.calendarNavBtn,{backgroundColor:formTheme.accentSoft,borderColor:formTheme.cardBorderColor}]}
                        accessibilityLabel="Önceki ay"
                      >
                        <Text style={[styles.calendarNavBtnText,{color:formTheme.text}]}>‹</Text>
                      </TouchableOpacity>

                      <Text style={[styles.calendarMonthTitle,{color:formTheme.text}]}>
                        {formatMonthTR(pickerViewYear, pickerViewMonth)}
                      </Text>

                      <TouchableOpacity
                        onPress={() => changePickerMonth(1)}
                        style={[styles.calendarNavBtn,{backgroundColor:formTheme.accentSoft,borderColor:formTheme.cardBorderColor}]}
                        accessibilityLabel="Sonraki ay"
                      >
                        <Text style={[styles.calendarNavBtnText,{color:formTheme.text}]}>›</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.calendarWeekdaysRow}>
                      {TR_WEEKDAYS_SHORT.map((wd) => (
                        <Text key={wd} style={[styles.calendarWeekdayText,{color:formTheme.muted}]}>
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
                                      style={[styles.calendarDayCell, { height: pickerDayHeight }]}
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
                                      { height: pickerDayHeight },
                                      isTod &&
                                        !isSel && {
                                          borderWidth: 1.5,
                                          borderColor: formTheme.accent,
                                        },
                                      isSel && {
                                        backgroundColor: formTheme.accent,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.calendarDayText, {color:formTheme.text},
                                        isSel && {
                                          color: formTheme.accentInk,
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
                  <View style={[styles.datePickerBox, {backgroundColor:formTheme.surfaceGlass,borderColor:formTheme.cardBorderColor}, compactDatePicker && styles.compactDatePickerBox, wideDatePicker && { flex: 1 }]}>
                    <View style={[styles.timeHeaderRow, compactDatePicker && { marginBottom: 4 }]}>
                      <Text style={[styles.timeSectionTitle,{color:formTheme.text}]}>🕒 Saat Seçimi</Text>
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
                              ? formTheme.accent
                              : formTheme.surface,
                            borderColor: pickerHasTime ? formTheme.accent : formTheme.cardBorderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.timeToggleBtnText,{color:pickerHasTime?formTheme.accentInk:formTheme.text}]}>
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
                        />

                        <Text style={[styles.wheelColon,{color:formTheme.muted}]}>:</Text>

                        <TimeWheelColumn
                          label="DAKİKA"
                          items={MINUTES_LIST}
                          selectedValue={pickerMinute}
                          onValueChange={setPickerMinute}
                        />
                      </View>
                    )}
                  </View>
                  </View>

                  {/* Seçilen Tarih & Saat Önizlemesi */}
                  <View style={[styles.datePreviewBanner,{backgroundColor:formTheme.accentSoft,borderColor:formTheme.cardBorderColor}, compactDatePicker && { paddingVertical: 6 }]}>
                    <Text style={[styles.datePreviewText, {color:formTheme.text}, compactDatePicker && { fontSize: 12 }]}>
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

                </View>
                </View>
                  <View
                    onLayout={(event) => setDatePickerActionsHeight(event.nativeEvent.layout.height)}
                    style={[styles.editorActions, styles.taskSheetActions, compactDatePicker && { marginTop: 8, paddingTop: 8 }]}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setTaskDueDate('');
                        setTaskDatePickerOpen(false);
                      }}
                      style={[
                        styles.dangerBtn,
                        { borderColor: formTheme.accent, backgroundColor: formTheme.surfaceGlass },
                      ]}
                    >
                      <Text style={[styles.dangerBtnText, { color: formTheme.accent }]}>
                        Temizle
                      </Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                      onPress={() => setTaskDatePickerOpen(false)}
                      style={[
                        styles.ghostBtn,
                        {
                          borderColor: formTheme.cardBorderColor,
                          backgroundColor: formTheme.surfaceGlass,
                        },
                      ]}
                    >
                      <Text style={[styles.ghostBtnText, { color: formTheme.text }]}>
                        Vazgeç
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={applyTaskDatePicker}
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: formTheme.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.primaryBtnText,
                          { color: formTheme.accentInk },
                        ]}
                      >
                        ✓ Seç
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                <ScrollView
                  testID="task-editor-scroll"
                  style={styles.taskSheetScroll}
                  contentContainerStyle={{ paddingBottom: 12 }}
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.taskModalTopRow}>
                    <Text
                      style={[
                        styles.editorTitle,
                        {
                          color: formTheme.text,
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
                          backgroundColor: taskStarred ? formTheme.accentSoft : formTheme.surfaceGlass,
                          borderColor: taskStarred ? formTheme.accent : formTheme.cardBorderColor,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          color: formTheme.text,
                          fontWeight: '700',
                        }}
                      >
                        {taskStarred ? '★ Önemli' : '☆ Yıldızla'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inputLabel, { color: formTheme.text }]}>
                    Görev adı
                  </Text>
                  <TextInput
                    value={taskTitle}
                    onChangeText={setTaskTitle}
                    maxLength={100}
                    placeholder="Örn. Faturayı öde, Market alışverişi yap"
                    placeholderTextColor={formTheme.muted}
                    style={[
                      styles.textInput,
                      {
                        color: formTheme.text,
                        backgroundColor: formTheme.surfaceGlass,
                        borderColor: formTheme.cardBorderColor,
                      },
                    ]}
                  />

                  <Text style={[styles.inputLabel, { color: formTheme.text }]}>
                    Ayrıntılar / Not{' '}
                    <Text style={{ fontWeight: '400', color: formTheme.muted }}>
                      (isteğe bağlı)
                    </Text>
                  </Text>
                  <TextInput
                    value={taskDetail}
                    onChangeText={setTaskDetail}
                    maxLength={160}
                    placeholder="Ayrıntı ekle..."
                    placeholderTextColor={formTheme.muted}
                    style={[
                      styles.textInput,
                      {
                        color: formTheme.text,
                        backgroundColor: formTheme.surfaceGlass,
                        borderColor: formTheme.cardBorderColor,
                      },
                    ]}
                  />

                  <Text style={[styles.inputLabel, { color: formTheme.text }]}>
                    Tarih / Zaman{' '}
                    <Text style={{ fontWeight: '400', color: formTheme.muted }}>
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
                          backgroundColor: formTheme.surfaceGlass,
                          borderColor: taskDueDate ? formTheme.accent : formTheme.cardBorderColor,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 16 }}>📅</Text>
                      <Text
                        style={[
                          styles.dateTimeSelectBtnText,
                          {
                            color: taskDueDate ? formTheme.text : formTheme.muted,
                            fontWeight: taskDueDate ? '700' : '500',
                          },
                        ]}
                      >
                        {taskDueDate || 'Tarih ve saat seçmek için dokun...'}
                      </Text>
                      <View
                        style={[
                          styles.dateTimeActionBadge,
                          { backgroundColor: formTheme.accent },
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
                        style={[styles.dateTimeClearBtn,{backgroundColor:formTheme.accentSoft,borderColor:formTheme.cardBorderColor}]}
                      >
                        <Text style={{ color: formTheme.text, fontWeight: '800' }}>
                          ✕
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Alt Görevler */}
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: formTheme.text, marginTop: 4 },
                    ]}
                  >
                    Alt görevler{' '}
                    <Text style={{ fontWeight: '400', color: formTheme.muted }}>
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
                              backgroundColor: formTheme.surfaceGlass,
                              borderColor: formTheme.cardBorderColor,
                            },
                          ]}
                        >
                          <TouchableOpacity
                            onPress={() => handleToggleTaskSubtaskModal(st.id)}
                            style={[
                              styles.subtaskCheck,
                              {
                                borderRadius: 11,
                                borderColor: st.done ? formTheme.accent : formTheme.cardBorderColor,
                                backgroundColor: st.done
                                  ? formTheme.accent
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
                                color: st.done ? formTheme.muted : formTheme.text,
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
                            <Text style={{ color: formTheme.muted, fontSize: 14 }}>
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
                      placeholderTextColor={formTheme.muted}
                      onSubmitEditing={handleAddTaskSubtask}
                      style={[
                        styles.smallInput,
                        {
                          flex: 1,
                          marginBottom: 0,
                          color: formTheme.text,
                          backgroundColor: formTheme.surfaceGlass,
                          borderColor: formTheme.cardBorderColor,
                        },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={handleAddTaskSubtask}
                      style={[
                        styles.subtaskAddBtn,
                        { backgroundColor: formTheme.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.primaryBtnText,
                          { color: formTheme.accentInk },
                        ]}
                      >
                        ＋ Ekle
                      </Text>
                    </TouchableOpacity>
                  </View>

                </ScrollView>
                  <View style={[styles.editorActions, styles.taskSheetActions]}>
                    {editingTask && (
                      <TouchableOpacity
                        onPress={handleDeleteTaskFromModal}
                        style={[
                          styles.dangerBtn,
                          {
                            borderColor: '#FF8BA488',
                            backgroundColor: confirmTaskDelete
                              ? '#C52F58'
                              : formTheme.surfaceGlass,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dangerBtnText,
                            { color: confirmTaskDelete ? '#FFFFFF' : '#FF8BA4' },
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
                          borderColor: formTheme.cardBorderColor,
                          backgroundColor: formTheme.surfaceGlass,
                        },
                      ]}
                    >
                      <Text style={[styles.ghostBtnText, { color: formTheme.text }]}>
                        Vazgeç
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={saveTaskModal}
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: formTheme.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.primaryBtnText,
                          { color: formTheme.accentInk },
                        ]}
                      >
                        Kaydet
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
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
  quickAdjust:(habit:Habit,direction:number)=>void;
  handleCardPress: (habit: Habit) => void;
  handleCellPress: (habit: Habit, key: string, completeOnly?: boolean) => void;
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
  weekOffset:number;
  english:boolean;
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
const HabitCard = React.memo(function HabitCard({h, i, dragControls, habitCount, habitMarks, habitProgress, reorderMode, monthlyViewMode, weekOffset, today, viewMonth, theme: baseTheme, windowWidth, dim, daysArray, cardInnerWidth, cellSize, cellGap, rowViewportWidth, cellStep, initialScrollX, scrollKey, ignoreHabitSwipeRef, actions, english}: HabitCardProps) {
  const accent = auroraHabitColor(h, i);
  const theme = {...baseTheme, accent, accentSoft:accent+'20',surface:baseTheme.isDark?'rgba(14,32,74,.28)':baseTheme.surface};
  const {handleCardPress, handleCellPress, handleCellLongPress, openEditor, moveHabit, setListGestureActive} = actions;
  const getMark = (_id: string, key: string) => habitMarks?.[key] || '';
  const getProgress = (_id: string, key: string) => habitProgress?.[key] || 0;

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
          paddingTop:12,
          paddingBottom:9,
          paddingHorizontal:13,
          borderRadius:22,
          borderColor: theme.isDark ? 'transparent' : theme.cardBorderColor,
          borderWidth: theme.cardBorderWidth,
          shadowColor: theme.isDark ? '#020A24' : theme.accent,
        },
      ]}
    >
      <GlassMaterial accent={theme.accent} radius={22} light={!theme.isDark}/>
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
      <AuroraHabitFace habit={h} theme={theme} progress={todayProg} mark={todayMark} today={today.key} weekOffset={weekOffset} marks={habitMarks} monthly={monthlyViewMode} viewMonth={viewMonth} english={english}
        onEdit={()=>openEditor(h)} onOpen={()=>handleCardPress(h)} onAdjust={direction=>actions.quickAdjust(h,direction)} onMark={(key,completeOnly)=>handleCellPress(h,key,completeOnly)} onLongMark={key=>handleCellLongPress(h,key)} dragProps={dragControls.longPressDragProps} consumeLongPress={dragControls.consumeLongPress}/>

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
  topbarLeft: { flex:1, flexDirection: 'row', alignItems: 'center', justifyContent:'space-between', marginRight:9 },
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
  topModeTabs: {flexDirection:'row',alignItems:'center',padding:3,borderRadius:19,borderWidth:1,gap:0},
  topModeTabBtn: {flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:5.5,paddingHorizontal:10,borderRadius:16,borderWidth:1,borderColor:'transparent'},
  topModeTabBtnActive: {
    borderWidth: 1, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 2,
  },
  topModeTabText: {fontSize:12.5,fontWeight:'600'},
  topModeBadge: {
    display: 'none',
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
    position:'relative',zIndex:1,
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
    width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', overflow: 'hidden',
    justifyContent: 'center', shadowColor: '#000000', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 3,
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
    flex: 1, borderWidth:1, borderColor:'#78C9FF66', overflow:'hidden',
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
    marginHorizontal: 0, marginBottom: 11, padding: 4, borderWidth: 1, borderColor: 'transparent',
    borderRadius: 22, height: 44, flexDirection:'row', flexShrink: 0,
    maxWidth: 728, alignSelf: 'center', alignItems: 'center',
  },
  tabsScroll: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
  },
  addTabButton: {
    width: 36, height: 36, flexShrink: 0, borderWidth: 1, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 2,
  },
  tabBtn: {flexDirection:'row',alignItems:'center',justifyContent:'center',height:34,paddingHorizontal:7,borderRadius:13,borderWidth:1,borderColor:'transparent',gap:5},
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
    fontSize: 12, lineHeight: 16, flexShrink: 0, letterSpacing: -0.3,
  },
  tabCountPill: { display:'none',
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
  mainContent: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 118 },
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
    gap: 10,
  },
  card: {
    paddingVertical: 12, paddingHorizontal: 12, shadowOffset: { width: 0, height: 6 },
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
    fontSize: 17, fontWeight: '700', letterSpacing: -0.4, lineHeight: 23,
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
  taskSheetScroll: {
    position:'relative',zIndex:1,
    flexShrink: 1,
    minHeight: 0,
  },
  taskSheetActions: {
    position:'relative',zIndex:1,
    flexShrink: 0,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#78C9FF66',
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
    backgroundColor: '#0D2C588C',
    borderWidth: 1.5,
    borderColor: '#6DDFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerBox: {
    backgroundColor: '#0D2C588C',
    borderWidth: 1.5,
    borderColor: '#0D2C588C',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  compactDatePickerBox: {
    padding: 6,
    marginBottom: 8,
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
    backgroundColor: '#0A1E44E8',
    borderWidth: 1,
    borderColor: '#0D2C588C',
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
    color: '#9DB9E7',
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
  wheelPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 4,
    marginBottom: 2,
  },
  wheelColon: {
    color: '#6DDFFF',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 18,
  },
  datePreviewBanner: {
    backgroundColor: '#0D2C588C',
    borderWidth: 1,
    borderColor: '#6DDFFF',
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

