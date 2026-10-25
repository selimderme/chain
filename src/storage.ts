import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppDataState,
  DEFAULT_HABITS,
  Habit,
  HabitGoal,
  STORAGE_KEY,
  TABS,
  TabId,
} from './constants';
import { uid } from './utils';

export function inferDefaultGoal(name: string): HabitGoal | undefined {
  const lower = (name || '').toLocaleLowerCase('tr-TR').trim();
  if (lower.includes('2 litre su') || lower === 'su') {
    return { type: 'amount', target: 2000, unit: 'ml' };
  }
  if (lower.includes('100 g protein')) {
    return { type: 'amount', target: 100, unit: 'g' };
  }
  if (lower.includes('2000 kalori')) {
    return { type: 'amount', target: 2000, unit: 'kcal' };
  }
  if (lower.includes('5 porsiyon')) {
    return { type: 'reps', target: 5, unit: 'tekrar' };
  }
  if (lower.includes('8000 adım')) {
    return { type: 'amount', target: 8000, unit: 'adım' };
  }
  if (lower.includes('30 dk kitap')) {
    return { type: 'timer', target: 1800, unit: 'sn' };
  }
  if (lower.includes('yeni kelime')) {
    return { type: 'reps', target: 5, unit: 'tekrar' };
  }
  return undefined;
}

export function seedState(): AppDataState {
  const habits: Habit[] = [];
  for (const [tab, items] of Object.entries(DEFAULT_HABITS) as [
    TabId,
    [string, string][],
  ][]) {
    for (const [name, detail] of items) {
      const goal = inferDefaultGoal(name);
      habits.push({ id: uid(), tab, name, detail, ...(goal ? { goal } : {}) });
    }
  }
  return {
    v: 1,
    section: 'rutin',
    tab: TABS[0].id,
    habits,
    marks: {},
    progress: {},
    tasks: [],
    profile: { firstName: '', lastName: '' },
  };
}

export async function loadAppState(): Promise<AppDataState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppDataState;
      if (parsed && Array.isArray(parsed.habits) && parsed.marks) {
        if (!parsed.progress || typeof parsed.progress !== 'object') {
          parsed.progress = {};
        }
        if (!Array.isArray(parsed.tasks)) {
          parsed.tasks = [];
        }
        if (parsed.section !== 'rutin' && parsed.section !== 'gorevler') {
          parsed.section = 'rutin';
        }
        if (!parsed.profile || typeof parsed.profile !== 'object') {
          parsed.profile = { firstName: '', lastName: '' };
        }
        for (const [tab, items] of Object.entries(DEFAULT_HABITS) as [
          TabId,
          [string, string][],
        ][]) {
          if (!parsed.habits.some((h) => h.tab === tab)) {
            for (const [name, detail] of items) {
              const goal = inferDefaultGoal(name);
              parsed.habits.push({
                id: uid(),
                tab,
                name,
                detail,
                ...(goal ? { goal } : {}),
              });
            }
          }
        }
        for (const h of parsed.habits) {
          if (h.goal === undefined) {
            const inferred = inferDefaultGoal(h.name);
            if (inferred) h.goal = inferred;
          }
        }
        if (!TABS.some((t) => t.id === parsed.tab)) {
          parsed.tab = TABS[0].id;
        }
        return parsed;
      }
    }
  } catch {
    // Bozuk veri: varsayılan duruma dön
  }
  const initial = seedState();
  await saveAppState(initial);
  return initial;
}

export async function saveAppState(state: AppDataState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Depolama hatası sessizce yakalanır
  }
}
