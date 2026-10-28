import { MarkType } from './constants';

export const TR_MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

export const TR_WEEKDAYS = [
  'Pazar',
  'Pazartesi',
  'Salı',
  'Çarşamba',
  'Perşembe',
  'Cuma',
  'Cumartesi',
];

export const TR_WEEKDAYS_SHORT = [
  'Pzt',
  'Sal',
  'Çar',
  'Per',
  'Cum',
  'Cmt',
  'Paz',
];

export const pad = (n: number): string => String(n).padStart(2, '0');

export const dateKey = (y: number, m: number, d: number): string =>
  `${y}-${pad(m + 1)}-${pad(d)}`;

export const keyOf = (date: Date): string =>
  dateKey(date.getFullYear(), date.getMonth(), date.getDate());

export const parseKey = (k: string): Date => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (date: Date, n: number): Date => {
  const x = new Date(date);
  x.setDate(x.getDate() + n);
  return x;
};

export const daysInMonth = (y: number, m: number): number =>
  new Date(y, m + 1, 0).getDate();

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

export const formatMonthTR = (y: number, m: number): string =>
  `${TR_MONTHS[m]} ${y}`;

export const formatDayTR = (date: Date): string =>
  `${date.getDate()} ${TR_MONTHS[date.getMonth()]} ${TR_WEEKDAYS[date.getDay()]}`;

/** Keep visible days plus a small buffer mounted in the horizontal month strip. */
export function visibleDayRange(count: number, offset: number, step: number, viewport: number): [number, number] {
  const first = Math.max(0, Math.min(count - 1, Math.floor(offset / step)));
  const last = Math.min(count, Math.ceil((Math.max(0, offset) + viewport) / step));
  return [Math.max(0, first - 2), Math.min(count, last + 2)];
}

export function calculateStreaks(
  habitMarks: Record<string, MarkType> | undefined,
  todayKey: string
): { cur: number; best: number } {
  const m = habitMarks || {};
  let cur = 0;
  let d = parseKey(todayKey);
  if (m[todayKey] !== 'g') {
    d = addDays(d, -1); // Bugün henüz işaretlenmediyse zincir bozulmaz
  }
  while (m[keyOf(d)] === 'g') {
    cur++;
    d = addDays(d, -1);
  }

  let best = 0;
  let run = 0;
  const keys = Object.keys(m)
    .filter((k) => m[k] === 'g')
    .sort();
  if (keys.length > 0) {
    let prev: string | null = null;
    for (const k of keys) {
      run = prev && keyOf(addDays(parseKey(prev), 1)) === k ? run + 1 : 1;
      if (run > best) best = run;
      prev = k;
    }
  }
  return { cur, best };
}
