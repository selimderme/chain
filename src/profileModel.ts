import { AppDataState, TabTheme } from './constants';
import { calculateStreaks } from './utils';

export function preferences(state: Pick<AppDataState, 'preferences'>): NonNullable<AppDataState['preferences']> {
  const p = state.preferences;
  return { theme: p?.theme === 'light' || p?.theme === 'system' ? p.theme : 'dark',
    language: p?.language === 'en' ? 'en' : 'tr', notifications: p?.notifications !== false };
}

export function appearance(base: TabTheme, mode: 'light' | 'dark' | 'system', system: string | null | undefined): TabTheme {
  if ((mode === 'system' ? system !== 'light' : mode === 'dark')) return { ...base, isDark: true };
  const lightAccents: Record<string,string> = {'#66D9FF':'#1768C4','#64E2C0':'#136D65','#F5A1D7':'#9E327C','#B6A0FF':'#6745BC','#FFCB91':'#875613','#FF8C9F':'#B23C55','#E5E5E5':'#334155'};
  const accent = lightAccents[base.accent] || base.accent;
  return { ...base, accent, accentInk: base.accent === '#E5E5E5' ? '#FFFFFF' : base.accentInk, isDark: false, bg: '#EFF4FF', surface: 'rgba(255,255,255,0.86)', surfaceGlass: 'rgba(255,255,255,0.80)',
    text: '#18232D', muted: '#586575', accentSoft: `${base.accent}18`, cardBorderColor: '#D5DDE5' };
}

export function habitStatistics(state: Pick<AppDataState, 'habits' | 'marks'>, today: string) {
  return state.habits.map(h => {
    // Future entries are never counted as achievements.
    const marks = Object.fromEntries(Object.entries(state.marks[h.id] || {}).filter(([day]) => day <= today));
    return { ...h, ...calculateStreaks(marks, today), completed: Object.values(marks).filter(m => m === 'g').length };
  }).sort((a, b) => b.cur - a.cur || b.best - a.best || a.name.localeCompare(b.name, 'tr'));
}

export function radarPoint(index: number, count: number, value: number, scale: number) {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(3, count);
  const radius = 98 * Math.max(0, Math.min(1, value / Math.max(1, scale)));
  return { x: 180 + Math.cos(angle) * radius, y: 155 + Math.sin(angle) * radius };
}
