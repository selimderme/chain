export const STORAGE_KEY = 'gunluk-plan:v1';

export type BuiltInTabId =
  | 'beslenme'
  | 'egzersiz'
  | 'bakim'
  | 'ogrenme'
  | 'ibadet'
  | 'kotu-aliskanliklar';

export type TabId = BuiltInTabId | `custom-${string}`;

export interface CustomTab {
  id: `custom-${string}`;
  name: string;
  emoji: string;
  color: string;
}

export type TabAppearance = Pick<CustomTab, 'name' | 'emoji' | 'color'>;
export type TabEdits = Partial<Record<BuiltInTabId, TabAppearance>>;

export const CUSTOM_TAB_COLORS = [
  { color: '#8B5CF6', label: 'Mor' }, { color: '#3B72EB', label: 'Mavi' },
  { color: '#14B8A6', label: 'Turkuaz' }, { color: '#C2ED19', label: 'Yeşil' },
  { color: '#F26B27', label: 'Turuncu' }, { color: '#E54B8E', label: 'Pembe' },
  { color: '#E5484D', label: 'Kırmızı' }, { color: '#C28E1E', label: 'Altın' },
  { color: '#1E3A8A', label: 'Lacivert' }, { color: '#000000', label: 'Siyah' },
  { color: '#14532D', label: 'Koyu yeşil' }, { color: '#78350F', label: 'Kahverengi' },
] as const;

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
  customIcon?: boolean;
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
  emoji?: string;
  goal?: HabitGoal;
  subtasks?: Subtask[];
}

export const HABIT_EMOJIS = [
  { emoji: '🍳', label: 'Yumurta' }, { emoji: '🥗', label: 'Salata' },
  { emoji: '🍊', label: 'Portakal' }, { emoji: '🍎', label: 'Elma' },
  { emoji: '🥑', label: 'Avokado' }, { emoji: '💧', label: 'Su' },
  { emoji: '☕', label: 'Kahve' }, { emoji: '🔥', label: 'Alev' },
  { emoji: '💪', label: 'Kas' }, { emoji: '🏋️', label: 'Ağırlık' },
  { emoji: '🏃', label: 'Koşu' }, { emoji: '🚴', label: 'Bisiklet' },
  { emoji: '🧘', label: 'Meditasyon' }, { emoji: '🏊', label: 'Yüzme' },
  { emoji: '🚶', label: 'Yürüyüş' }, { emoji: '⚽', label: 'Futbol' },
  { emoji: '🌿', label: 'Yaprak' }, { emoji: '🪥', label: 'Diş fırçası' },
  { emoji: '🧴', label: 'Bakım' }, { emoji: '🚿', label: 'Duş' },
  { emoji: '😴', label: 'Uyku' }, { emoji: '💊', label: 'İlaç' },
  { emoji: '📖', label: 'Kitap' }, { emoji: '✍️', label: 'Yazı' },
  { emoji: '🎓', label: 'Eğitim' }, { emoji: '💻', label: 'Bilgisayar' },
  { emoji: '🎨', label: 'Sanat' }, { emoji: '🎵', label: 'Müzik' },
  { emoji: '🌙', label: 'Ay' }, { emoji: '🤲', label: 'Dua' },
  { emoji: '🕌', label: 'Cami' }, { emoji: '❤️', label: 'Kalp' },
  { emoji: '🛡️', label: 'Kalkan' }, { emoji: '🎯', label: 'Hedef' },
  { emoji: '⭐', label: 'Yıldız' }, { emoji: '✅', label: 'Onay' },
] as const;

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
  /** Device-local categories; explicitly excluded from cloud serialization. */
  customTabs?: CustomTab[];
  /** Device-local category ordering, including built-in categories. */
  tabOrder?: TabId[];
  deletedTabs?: BuiltInTabId[];
  tabEdits?: TabEdits;
  habits: Habit[];
  marks: Record<string, Record<string, MarkType>>;
  progress?: Record<string, Record<string, number>>;
  tasks?: TaskItem[];
  profile?: UserProfile;
}

export const MARK_COLORS = {
  green: '#00E6A0',
  blue: '#3478FF',
  red: '#FF2448',
} as const;

export const NEON_THEME: TabTheme = {
  isDark: true,
  bg: '#080908',
  surface: '#10110F',
  surfaceGlass: 'rgba(16, 17, 15, 0.92)',
  text: '#F7F7F2',
  muted: '#B5B5AF',
  accent: '#FFD600',
  accentGradientEnd: '#A97900',
  accentInk: '#171300',
  accentSoft: '#302700',
  cardBorderColor: 'rgba(229, 206, 128, 0.28)',
  cardBorderWidth: 1,
  radius: 20,
  cellRadius: 999,
  anim: 'glow',
};

function createNeonTheme(accent: string, accentGradientEnd: string, accentInk = '#10120A'): TabTheme {
  return {
    ...NEON_THEME,
    accent,
    accentGradientEnd,
    accentInk,
    accentSoft: `${accent}24`,
    cardBorderColor: `${accent}48`,
  };
}

export const TASKS_THEME: TabTheme = {
  ...createNeonTheme('#E5E5E5', '#9C9C9C', '#111111'),
  bg: '#090909',
  surface: '#141414',
  surfaceGlass: 'rgba(20,20,20,0.92)',
  text: '#F5F5F5',
  muted: '#A6A6A6',
  accentSoft: '#292929',
  cardBorderColor: 'rgba(255,255,255,0.18)',
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
    symbol: '!',
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
    theme: createNeonTheme('#F26B27', '#EA580C'),
  },
  {
    id: 'egzersiz',
    name: 'Egzersiz',
    emoji: '💪',
    color: '#C2ED19',
    motto: 'Zinciri kırma. Bugün de çalış.',
    theme: createNeonTheme('#C2ED19', '#9ED10B'),
  },
  {
    id: 'bakim',
    name: 'Kişisel Bakım',
    emoji: '🧴',
    color: '#E54B8E',
    motto: 'Kendine nazik ol, kendini şımart.',
    theme: createNeonTheme('#E54B8E', '#C83778'),
  },
  {
    id: 'ogrenme',
    name: 'Öğrenme ve Gelişim',
    emoji: '📚',
    color: '#3B72EB',
    motto: 'Her gün biraz daha bilge.',
    theme: createNeonTheme('#3B72EB', '#2554C7', '#FFFFFF'),
  },
  {
    id: 'ibadet',
    name: 'İbadet',
    emoji: '🕌',
    color: '#C28E1E',
    motto: 'Kalbine huzur, gününe bereket.',
    theme: createNeonTheme('#C28E1E', '#9E7011'),
  },
  {
    id: 'kotu-aliskanliklar',
    name: 'Kötü Alışkanlıklar',
    emoji: '🚫',
    color: '#E5484D',
    motto: 'Kötü alışkanlıkları bırak, hayatına yer aç.',
    theme: createNeonTheme('#E5484D', '#BE2E34'),
  },
];

export function normalizeCustomTabs(value: unknown): CustomTab[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: CustomTab[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' ||
        !/^custom-[A-Za-z0-9_-]{1,100}$/.test(item.id) || seen.has(item.id) ||
        typeof item.name !== 'string' || !item.name.trim()) continue;
    seen.add(item.id);
    result.push({
      id: item.id as CustomTab['id'],
      name: item.name.trim().slice(0, 40),
      emoji: typeof item.emoji === 'string' && item.emoji.trim() ? item.emoji.trim().slice(0, 24) : '📁',
      color: typeof item.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(item.color) ? item.color : '#8B5CF6',
    });
  }
  return result;
}

export function getAccentInk(color: string): string {
  const channels = [1, 3, 5].map((start) => {
    const channel = parseInt(color.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? '#10120A' : '#FFFFFF';
}

export function normalizeDeletedTabs(value: unknown): BuiltInTabId[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is BuiltInTabId => TABS.some((tab) => tab.id === id)))] : [];
}

export function normalizeTabEdits(value: unknown): TabEdits {
  if (!value || typeof value !== 'object') return {};
  const edits: TabEdits = {};
  for (const tab of TABS) {
    const entry = (value as Record<string, unknown>)[tab.id];
    const [normalized] = normalizeCustomTabs([{ ...(entry && typeof entry === 'object' ? entry : {}), id: 'custom-edit' }]);
    if (normalized) edits[tab.id as BuiltInTabId] = { name: normalized.name, emoji: normalized.emoji, color: normalized.color };
  }
  return edits;
}

export function getTabs(customTabs?: CustomTab[], order?: unknown, deleted?: unknown, edited?: unknown): TabConfig[] {
  const deletedIds = new Set(normalizeDeletedTabs(deleted));
  const edits = normalizeTabEdits(edited);
  const tabs: TabConfig[] = [...TABS.filter((tab) => !deletedIds.has(tab.id as BuiltInTabId)).map((tab) => {
    const appearance = edits[tab.id as BuiltInTabId];
    return appearance ? { ...tab, ...appearance, customIcon: true, theme: createNeonTheme(appearance.color, appearance.color, getAccentInk(appearance.color)) } : tab;
  }), ...normalizeCustomTabs(customTabs).map((tab) => ({
    ...tab,
    motto: 'Kendi ritmini oluştur, zincirini sürdür.',
    theme: createNeonTheme(tab.color, tab.color, getAccentInk(tab.color)),
  }))];
  if (tabs.length === 0) return [TABS[0]];
  const ids = Array.isArray(order) ? [...new Set(order.filter((id): id is TabId => typeof id === 'string' && tabs.some((tab) => tab.id === id)))] : [];
  return [...ids.map((id) => tabs.find((tab) => tab.id === id)!), ...tabs.filter((tab) => !ids.includes(tab.id))];
}

export function getStateTabs(state: Pick<AppDataState, 'customTabs' | 'tabOrder' | 'deletedTabs' | 'tabEdits'>): TabConfig[] {
  return getTabs(state.customTabs, state.tabOrder, state.deletedTabs, state.tabEdits);
}

export function editTab(state: AppDataState, id: TabId, appearance: TabAppearance): AppDataState {
  const current = getStateTabs(state).find((tab) => tab.id === id);
  const name = appearance.name.trim();
  if (!current || !name || getStateTabs(state).some((tab) => tab.id !== id && tab.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))) return state;
  const values = { ...appearance, name };
  return id.startsWith('custom-') ? {
    ...state, customTabs: (state.customTabs || []).map((tab) => tab.id === id ? { ...tab, ...values } : tab),
  } : {
    ...state, tabEdits: { ...state.tabEdits, [id]: values },
  };
}

export function reorderTabs(state: AppDataState, from: number, to: number): AppDataState {
  const ids = getStateTabs(state).map((tab) => tab.id);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return state;
  const [id] = ids.splice(from, 1);
  ids.splice(to, 0, id);
  return { ...state, tabOrder: ids };
}

/** Remove a category and its tracking; remember removed built-ins across startup. */
export function deleteTab(state: AppDataState, tabId: TabId): AppDataState {
  const customTabs = normalizeCustomTabs(state.customTabs);
  const tabs = getStateTabs(state);
  if (tabs.length <= 1 || !tabs.some((tab) => tab.id === tabId)) return state;
  const remaining = tabs.filter((tab) => tab.id !== tabId);
  const removedIds = new Set(state.habits.filter((habit) => habit.tab === tabId).map((habit) => habit.id));
  return {
    ...state,
    customTabs: customTabs.filter((tab) => tab.id !== tabId),
    deletedTabs: normalizeDeletedTabs([...(state.deletedTabs || []), ...(TABS.some((tab) => tab.id === tabId) ? [tabId] : [])]),
    tabOrder: remaining.map((tab) => tab.id),
    tab: state.tab === tabId ? remaining[0].id : state.tab,
    habits: state.habits.filter((habit) => habit.tab !== tabId),
    marks: Object.fromEntries(Object.entries(state.marks).filter(([id]) => !removedIds.has(id))),
    progress: Object.fromEntries(Object.entries(state.progress || {}).filter(([id]) => !removedIds.has(id))),
  };
}

/** Cloud restores update built-in data while retaining device-local tabs. */
export function preserveLocalTabs(restored: AppDataState, local: AppDataState): AppDataState {
  const customTabs = normalizeCustomTabs(local.customTabs);
  const customIds = new Set(customTabs.map((tab) => tab.id));
  const localHabits = local.habits.filter((habit) => customIds.has(habit.tab as CustomTab['id']));
  const localHabitIds = new Set(localHabits.map((habit) => habit.id));
  const deletedTabs = normalizeDeletedTabs(local.deletedTabs);
  const deletedHabitIds = new Set(restored.habits.filter((habit) => deletedTabs.includes(habit.tab as BuiltInTabId)).map((habit) => habit.id));
  const localTabs = getStateTabs(local);
  return {
    ...restored,
    customTabs,
    deletedTabs,
    tabEdits: normalizeTabEdits(local.tabEdits),
    tabOrder: localTabs.map((tab) => tab.id),
    tab: customIds.has(local.tab as CustomTab['id']) ? local.tab : localTabs.some((tab) => tab.id === restored.tab) ? restored.tab : localTabs[0].id,
    habits: [...restored.habits.filter((habit) => !deletedHabitIds.has(habit.id)), ...localHabits],
    marks: { ...Object.fromEntries(Object.entries(restored.marks).filter(([id]) => !deletedHabitIds.has(id))), ...Object.fromEntries(Object.entries(local.marks).filter(([id]) => localHabitIds.has(id))) },
    progress: { ...Object.fromEntries(Object.entries(restored.progress || {}).filter(([id]) => !deletedHabitIds.has(id))), ...Object.fromEntries(Object.entries(local.progress || {}).filter(([id]) => localHabitIds.has(id))) },
  };
}

export const DEFAULT_HABITS: Record<BuiltInTabId, [string, string][]> = {
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
