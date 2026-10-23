export const STORAGE_KEY = 'gunluk-plan:v1';

export type TabId =
  | 'beslenme'
  | 'egzersiz'
  | 'bakim'
  | 'ogrenme'
  | 'ibadet'
  | 'kotu-aliskanliklar';

export type MarkType = 'g' | 'b' | 'r';

export interface TabTheme {
  isDark: boolean;
  bg: string;
  surface: string;
  surfaceGlass?: string;
  text: string;
  muted: string;
  accent: string;
  accentGradientEnd?: string;
  accentInk: string;
  accentSoft: string;
  cardBorderColor: string;
  cardBorderWidth: number;
  leftAccentBar?: string;
  radius: number;
  cellRadius: number;
  cellArch?: boolean;
  headItalic?: boolean;
  anim: 'wobble' | 'pulse' | 'floaty' | 'flip' | 'glow';
}

export interface TabConfig {
  id: TabId;
  name: string;
  emoji: string;
  color: string;
  motto: string;
  theme: TabTheme;
}

export type GoalType = 'none' | 'timer' | 'reps' | 'amount';

export type MainSection = 'rutin' | 'gorevler';

export interface HabitGoal {
  type: GoalType;
  target: number; // timer: saniye, reps: tekrar sayısı, amount: hedef miktar
  unit?: string; // örn: 'ml', 'g', 'kcal', 'adım', 'tekrar'
}

export interface Subtask {
  id: string;
  title: string;
  done?: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  detail?: string;
  dueDate?: string;
  starred?: boolean;
  done: boolean;
  createdAt: string;
  completedAt?: string;
  subtasks?: Subtask[];
}

export interface Habit {
  id: string;
  tab: TabId;
  name: string;
  detail: string;
  goal?: HabitGoal;
  subtasks?: Subtask[];
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  email?: string;
  authProvider?: AuthProviderType;
  lastBackupAt?: string;
  lastRestoreAt?: string;
  lastCloudSyncAt?: string;
}

export type AuthProviderType = 'google' | 'apple' | 'email' | 'guest';

export type CloudSyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline-pending'
  | 'error';

export interface AuthUser {
  uid: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  provider: AuthProviderType;
  idToken?: string;
  refreshToken?: string;
  createdAt: string;
}

export interface AppDataState {
  v: number;
  updatedAt?: number;
  section?: MainSection;
  tab: TabId;
  habits: Habit[];
  marks: Record<string, Record<string, MarkType>>;
  progress?: Record<string, Record<string, number>>;
  tasks?: TaskItem[];
  profile?: UserProfile;
}

export const MARK_COLORS = {
  green: '#10b981',
  blue: '#3b82f6',
  red: '#f43f5e',
} as const;

export const TASKS_THEME: TabTheme = {
  isDark: true,
  bg: '#0E0A0C',
  surface: '#1A1215',
  surfaceGlass: 'rgba(26, 18, 21, 0.78)',
  text: '#F8F4F5',
  muted: '#B59499',
  accent: '#E53945',
  accentGradientEnd: '#B81D2A',
  accentInk: '#ffffff',
  accentSoft: '#2E1418',
  cardBorderColor: 'rgba(229, 57, 69, 0.16)',
  cardBorderWidth: 1,
  radius: 20,
  cellRadius: 999,
  anim: 'pulse',
};

export const MARKS: Record<
  MarkType,
  { label: string; shortLabel: string; subLabel: string; color: string; symbol: string }
> = {
  g: {
    label: 'Yeşil – Tamamlandı',
    shortLabel: 'Yeşil',
    subLabel: 'Tamamlandı',
    color: MARK_COLORS.green,
    symbol: '✓',
  },
  b: {
    label: 'Mavi – Kısmen',
    shortLabel: 'Mavi',
    subLabel: 'Kısmen',
    color: MARK_COLORS.blue,
    symbol: '◐',
  },
  r: {
    label: 'Kırmızı – Yapılmadı',
    shortLabel: 'Kırmızı',
    subLabel: 'Yapılmadı',
    color: MARK_COLORS.red,
    symbol: '✕',
  },
};

export const TABS: TabConfig[] = [
  {
    id: 'beslenme',
    name: 'Beslenme',
    emoji: '🥗',
    color: '#F26B27',
    motto: 'Vücuduna iyi bak, o da sana iyi baksın.',
    theme: {
      isDark: false,
      bg: '#FDF8F3',
      surface: '#FFFFFF',
      surfaceGlass: 'rgba(255, 255, 255, 0.80)',
      text: '#1F1610',
      muted: '#8C705A',
      accent: '#F26B27',
      accentGradientEnd: '#EA580C',
      accentInk: '#FFFFFF',
      accentSoft: '#FFF0E5',
      cardBorderColor: 'rgba(242, 107, 39, 0.11)',
      cardBorderWidth: 1,
      radius: 22,
      cellRadius: 999,
      anim: 'wobble',
    },
  },
  {
    id: 'egzersiz',
    name: 'Egzersiz',
    emoji: '💪',
    color: '#C2ED19',
    motto: 'Zinciri kırma. Bugün de çalış.',
    theme: {
      isDark: true,
      bg: '#0E1116',
      surface: '#171C24',
      surfaceGlass: 'rgba(23, 28, 36, 0.80)',
      text: '#F3F6FA',
      muted: '#8E9BAE',
      accent: '#C2ED19',
      accentGradientEnd: '#9ED10B',
      accentInk: '#111605',
      accentSoft: '#252E18',
      cardBorderColor: 'rgba(255, 255, 255, 0.07)',
      cardBorderWidth: 1,
      radius: 20,
      cellRadius: 999,
      anim: 'pulse',
    },
  },
  {
    id: 'bakim',
    name: 'Kişisel Bakım',
    emoji: '🧴',
    color: '#E54B8E',
    motto: 'Kendine nazik ol, kendini şımart.',
    theme: {
      isDark: false,
      bg: '#FDF6F9',
      surface: '#FFFFFF',
      surfaceGlass: 'rgba(255, 255, 255, 0.82)',
      text: '#281421',
      muted: '#94627D',
      accent: '#E54B8E',
      accentGradientEnd: '#C83778',
      accentInk: '#FFFFFF',
      accentSoft: '#FCE8F1',
      cardBorderColor: 'rgba(229, 75, 142, 0.12)',
      cardBorderWidth: 1,
      radius: 22,
      cellRadius: 999,
      headItalic: false,
      anim: 'floaty',
    },
  },
  {
    id: 'ogrenme',
    name: 'Öğrenme ve Gelişim',
    emoji: '📚',
    color: '#3B72EB',
    motto: 'Her gün biraz daha bilge.',
    theme: {
      isDark: true,
      bg: '#090F1D',
      surface: '#121C31',
      surfaceGlass: 'rgba(18, 28, 49, 0.80)',
      text: '#F1F5FC',
      muted: '#8499BC',
      accent: '#3B72EB',
      accentGradientEnd: '#2554C7',
      accentInk: '#FFFFFF',
      accentSoft: '#19294B',
      cardBorderColor: 'rgba(59, 114, 235, 0.15)',
      cardBorderWidth: 1,
      radius: 20,
      cellRadius: 999,
      anim: 'flip',
    },
  },
  {
    id: 'ibadet',
    name: 'İbadet',
    emoji: '🕌',
    color: '#C28E1E',
    motto: 'Kalbine huzur, gününe bereket.',
    theme: {
      isDark: false,
      bg: '#FAF6EC',
      surface: '#FFFFFF',
      surfaceGlass: 'rgba(255, 255, 255, 0.82)',
      text: '#2B2313',
      muted: '#87754C',
      accent: '#C28E1E',
      accentGradientEnd: '#9E7011',
      accentInk: '#FFFFFF',
      accentSoft: '#F5EBD3',
      cardBorderColor: 'rgba(194, 142, 30, 0.15)',
      cardBorderWidth: 1,
      radius: 20,
      cellRadius: 999,
      cellArch: false,
      anim: 'glow',
    },
  },
  {
    id: 'kotu-aliskanliklar',
    name: 'Kötü Alışkanlıklar',
    emoji: '🚫',
    color: '#E5484D',
    motto: 'Kötü alışkanlıkları bırak, hayatına yer aç.',
    theme: {
      isDark: true,
      bg: '#110E12',
      surface: '#1B161D',
      surfaceGlass: 'rgba(27, 22, 29, 0.80)',
      text: '#F7F3F5',
      muted: '#A38F99',
      accent: '#E5484D',
      accentGradientEnd: '#BE2E34',
      accentInk: '#FFFFFF',
      accentSoft: '#341820',
      cardBorderColor: 'rgba(229, 72, 77, 0.16)',
      cardBorderWidth: 1,
      radius: 20,
      cellRadius: 999,
      anim: 'wobble',
    },
  },
];

export const DEFAULT_HABITS: Record<TabId, [string, string][]> = {
  beslenme: [
    ['100 g protein', 'Yumurta, tavuk, yoğurt, baklagil…'],
    ['C vitamini', 'Portakal, biber, kivi…'],
    ['2000 kalori', 'Günlük hedef'],
    ['2 litre su', ''],
    ['5 porsiyon sebze/meyve', ''],
  ],
  egzersiz: [
    ['Göğüs egzersizi', ''],
    ['Karın egzersizi', ''],
    ['Bacak egzersizi', ''],
    ['Biseps egzersizi', ''],
    ['8000 adım yürüyüş', ''],
  ],
  bakim: [
    ['Cilt bakımı', 'Sabah & akşam'],
    ['Diş fırçalama + ip', 'Sabah & akşam'],
    ['Duş', ''],
    ['Saç bakımı', ''],
  ],
  ogrenme: [
    ['30 dk kitap okuma', ''],
    ['Yeni kelime öğren', 'En az 5 kelime'],
    ['Online ders / kurs', ''],
    ['Günlük yazma', ''],
  ],
  ibadet: [
    ['Sabah namazı', ''],
    ['Öğle namazı', ''],
    ['İkindi namazı', ''],
    ['Akşam namazı', ''],
    ['Yatsı namazı', ''],
    ["Kur'an okuma", ''],
    ['Zikir ve dua', ''],
  ],
  'kotu-aliskanliklar': [
    ['Sigara içmemek', 'Bugün hiç içmedim'],
    ['Şeker / abur cubur yememek', 'Paketli gıda ve ilave şeker yok'],
    ['Sosyal medyada aşırı vakit geçirmemek', 'En fazla 30 dk'],
    ['Geç saatte uyumamak', "En geç 00:00'da uyu"],
    ['Fast food yememek', 'Ev yapımı ve sağlıklı besinler'],
  ],
};
