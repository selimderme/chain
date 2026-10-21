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
  text: string;
  muted: string;
  accent: string;
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
  lastBackupAt?: string;
  lastRestoreAt?: string;
}

export interface AppDataState {
  v: number;
  tab: TabId;
  habits: Habit[];
  marks: Record<string, Record<string, MarkType>>;
  progress?: Record<string, Record<string, number>>;
  profile?: UserProfile;
}

export const MARK_COLORS = {
  green: '#22c55e',
  blue: '#3b82f6',
  red: '#ef4444',
} as const;

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
    color: '#f97316',
    motto: 'Vücuduna iyi bak, o da sana iyi baksın.',
    theme: {
      isDark: false,
      bg: '#fff4e6',
      surface: '#ffffff',
      text: '#4a2c0a',
      muted: '#9a6b3a',
      accent: '#f97316',
      accentInk: '#ffffff',
      accentSoft: '#ffe3c7',
      cardBorderColor: '#ffe3c7',
      cardBorderWidth: 2,
      radius: 24,
      cellRadius: 999,
      anim: 'wobble',
    },
  },
  {
    id: 'egzersiz',
    name: 'Egzersiz',
    emoji: '💪',
    color: '#d4ff00',
    motto: 'Zinciri kırma. Bugün de çalış.',
    theme: {
      isDark: true,
      bg: '#121418',
      surface: '#1d2127',
      text: '#f3f4f6',
      muted: '#9ca3af',
      accent: '#d4ff00',
      accentInk: '#111111',
      accentSoft: '#2a3017',
      cardBorderColor: 'transparent',
      cardBorderWidth: 0,
      leftAccentBar: '#d4ff00',
      radius: 8,
      cellRadius: 4,
      anim: 'pulse',
    },
  },
  {
    id: 'bakim',
    name: 'Kişisel Bakım',
    emoji: '🧴',
    color: '#ec4899',
    motto: 'Kendine nazik ol, kendini şımart.',
    theme: {
      isDark: false,
      bg: '#fff0f6',
      surface: '#ffffff',
      text: '#4b1d37',
      muted: '#a2587f',
      accent: '#ec4899',
      accentInk: '#ffffff',
      accentSoft: '#fde0ee',
      cardBorderColor: '#fbcfe4',
      cardBorderWidth: 1.5,
      radius: 28,
      cellRadius: 999,
      headItalic: true,
      anim: 'floaty',
    },
  },
  {
    id: 'ogrenme',
    name: 'Öğrenme ve Gelişim',
    emoji: '📚',
    color: '#1e40af',
    motto: 'Her gün biraz daha bilge.',
    theme: {
      isDark: true,
      bg: '#070d1a',
      surface: '#0e172e',
      text: '#f0f4fc',
      muted: '#8298be',
      accent: '#17326b',
      accentInk: '#ffffff',
      accentSoft: '#102144',
      cardBorderColor: '#1a2c54',
      cardBorderWidth: 1,
      radius: 14,
      cellRadius: 6,
      anim: 'flip',
    },
  },
  {
    id: 'ibadet',
    name: 'İbadet',
    emoji: '🕌',
    color: '#b8860b',
    motto: 'Kalbine huzur, gününe bereket.',
    theme: {
      isDark: false,
      bg: '#f6eed9',
      surface: '#fffaf0',
      text: '#3b2f12',
      muted: '#8a7440',
      accent: '#b8860b',
      accentInk: '#ffffff',
      accentSoft: '#f1e2b6',
      cardBorderColor: '#d9bd6a',
      cardBorderWidth: 2,
      radius: 16,
      cellRadius: 6,
      cellArch: true,
      anim: 'glow',
    },
  },
  {
    id: 'kotu-aliskanliklar',
    name: 'Kötü Alışkanlıklar',
    emoji: '🚫',
    color: '#ef4444',
    motto: 'Kötü alışkanlıkları bırak, hayatına yer aç.',
    theme: {
      isDark: true,
      bg: '#161214',
      surface: '#221a1e',
      text: '#f7f3f5',
      muted: '#ab959f',
      accent: '#ef4444',
      accentInk: '#ffffff',
      accentSoft: '#3f1924',
      cardBorderColor: '#481d29',
      cardBorderWidth: 1.5,
      radius: 18,
      cellRadius: 8,
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
