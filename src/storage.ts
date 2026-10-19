import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppDataState,
  DEFAULT_HABITS,
  Habit,
  STORAGE_KEY,
  TABS,
  TabId,
} from './constants';
import { uid } from './utils';

export function seedState(): AppDataState {
  const habits: Habit[] = [];
  for (const [tab, items] of Object.entries(DEFAULT_HABITS) as [
    TabId,
    [string, string][],
  ][]) {
    for (const [name, detail] of items) {
      habits.push({ id: uid(), tab, name, detail });
    }
  }
  return {
    v: 1,
    tab: TABS[0].id,
    habits,
    marks: {},
  };
}

export async function loadAppState(): Promise<AppDataState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppDataState;
      if (parsed && Array.isArray(parsed.habits) && parsed.marks) {
        for (const [tab, items] of Object.entries(DEFAULT_HABITS) as [
          TabId,
          [string, string][],
        ][]) {
          if (!parsed.habits.some((h) => h.tab === tab)) {
            for (const [name, detail] of items) {
              parsed.habits.push({ id: uid(), tab, name, detail });
            }
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
