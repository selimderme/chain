import type { Habit, TabId, GoalType } from './constants';

export type DiscoverCategory = 'mind' | 'move' | 'care' | 'focus';
export type SimulationKind = 'breathing' | 'pushup';
export interface DiscoverHabit {
  id: string;
  name: string;
  nameEn: string;
  detail: string;
  detailEn: string;
  emoji: string;
  category: DiscoverCategory;
  tab: TabId;
  goalType: GoalType;
  goalTarget: number;
  goalUnit: string;
  simulation?: SimulationKind;
  aliases?: string[];
}

export const DISCOVER_CATEGORIES: {id: DiscoverCategory; name: string; nameEn: string}[] = [
  {id:'mind', name:'Zihin', nameEn:'Mind'},
  {id:'move', name:'Hareket', nameEn:'Movement'},
  {id:'care', name:'Kendine bakım', nameEn:'Self care'},
  {id:'focus', name:'Odak', nameEn:'Focus'},
];

export const DISCOVER_HABITS: DiscoverHabit[] = [
  {id:'breathing', name:'Nefes egzersizi', nameEn:'Breathing exercise', detail:'1 dakika · 4 sn nefes al, 6 sn ver', detailEn:'1 minute · breathe in for 4s, out for 6s', emoji:'🫁', category:'mind', tab:'bakim', goalType:'timer', goalTarget:60, goalUnit:'', simulation:'breathing'},
  {id:'meditation', name:'Kısa meditasyon', nameEn:'Short meditation', detail:'5 dakika sessizce kendine zaman ayır', detailEn:'Take 5 quiet minutes for yourself', emoji:'🧘', category:'mind', tab:'bakim', goalType:'timer', goalTarget:300, goalUnit:''},
  {id:'gratitude', name:'Üç güzel şey', nameEn:'Three good things', detail:'Bugünün üç güzel anını yaz', detailEn:'Write down three good moments from today', emoji:'✨', category:'mind', tab:'ogrenme', goalType:'none', goalTarget:0, goalUnit:''},
  {id:'journal', name:'Günlük yazma', nameEn:'Journaling', detail:'5 dakika düşüncelerini kâğıda dök', detailEn:'Spend 5 minutes writing your thoughts', emoji:'📝', category:'mind', tab:'ogrenme', goalType:'timer', goalTarget:300, goalUnit:''},
  {id:'pushup', name:'Şınav', nameEn:'Push-ups', detail:'10 tekrar · hareketin ritmini takip et', detailEn:'10 reps · follow the movement rhythm', emoji:'💪', category:'move', tab:'egzersiz', goalType:'reps', goalTarget:10, goalUnit:'tekrar', simulation:'pushup', aliases:['Şınav çekme']},
  {id:'walking', name:'Kısa yürüyüş', nameEn:'Short walk', detail:'10 dakika yürüyüş için zaman ayır', detailEn:'Make time for a 10-minute walk', emoji:'🚶', category:'move', tab:'egzersiz', goalType:'timer', goalTarget:600, goalUnit:''},
  {id:'stretching', name:'Esneme molası', nameEn:'Stretch break', detail:'3 dakikalık hafif hareket molası', detailEn:'A gentle 3-minute movement break', emoji:'🤸', category:'move', tab:'egzersiz', goalType:'timer', goalTarget:180, goalUnit:''},
  {id:'squats', name:'Squat', nameEn:'Squats', detail:'10 tekrar ile günlük hareket rutini', detailEn:'Build a daily movement habit with 10 reps', emoji:'🏋️', category:'move', tab:'egzersiz', goalType:'reps', goalTarget:10, goalUnit:'tekrar'},
  {id:'water', name:'Su içme', nameEn:'Drink water', detail:'Günlük hedefini rutininden düzenleyebilirsin', detailEn:'You can adjust the daily target in your routine', emoji:'💧', category:'care', tab:'beslenme', goalType:'amount', goalTarget:2000, goalUnit:'ml', aliases:['2 litre su']},
  {id:'teeth', name:'Diş fırçalama', nameEn:'Brush teeth', detail:'2 dakikalık kişisel bakım rutini', detailEn:'A 2-minute self-care routine', emoji:'🪥', category:'care', tab:'bakim', goalType:'timer', goalTarget:120, goalUnit:'', aliases:['Diş fırçalama + ip']},
  {id:'skincare', name:'Cilt bakımı', nameEn:'Skin care', detail:'Sabah veya akşam bakımına zaman ayır', detailEn:'Make time for morning or evening skin care', emoji:'🧴', category:'care', tab:'bakim', goalType:'none', goalTarget:0, goalUnit:''},
  {id:'sleep', name:'Uykuya hazırlık', nameEn:'Wind down', detail:'Ekranları bırak, uyku öncesi sakin bir mola ver', detailEn:'Put screens away and take a quiet break before bed', emoji:'🌙', category:'care', tab:'bakim', goalType:'timer', goalTarget:600, goalUnit:''},
  {id:'reading', name:'Kitap okuma', nameEn:'Read a book', detail:'10 dakika · kaldığın sayfadan devam et', detailEn:'10 minutes · pick up where you left off', emoji:'📖', category:'focus', tab:'ogrenme', goalType:'timer', goalTarget:600, goalUnit:'', aliases:['30 dk kitap okuma']},
  {id:'vocabulary', name:'Yeni kelime öğren', nameEn:'Learn new words', detail:'Bugün 5 yeni kelime keşfet', detailEn:'Discover 5 new words today', emoji:'📚', category:'focus', tab:'ogrenme', goalType:'amount', goalTarget:5, goalUnit:'kelime'},
  {id:'focus', name:'Odak seansı', nameEn:'Focus session', detail:'25 dakika tek bir işe odaklan', detailEn:'Focus on one task for 25 minutes', emoji:'🎯', category:'focus', tab:'ogrenme', goalType:'timer', goalTarget:1500, goalUnit:''},
  {id:'screen-break', name:'Ekran molası', nameEn:'Screen break', detail:'2 dakika ekranından uzaklaş', detailEn:'Step away from your screen for 2 minutes', emoji:'🌿', category:'focus', tab:'bakim', goalType:'timer', goalTarget:120, goalUnit:''},
];

function normalizedName(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/[\s\p{P}\p{S}]+/gu, '');
}

/** Detect the original template even after edits, and match existing default habits. */
export function discoverHabitExists(habits: Pick<Habit, 'name' | 'templateId'>[], item: DiscoverHabit): boolean {
  const names = new Set([item.name, item.nameEn, ...(item.aliases || [])].map(normalizedName));
  return habits.some(habit => habit.templateId === item.id || names.has(normalizedName(habit.name)));
}

/** Pure elapsed-time model; pausing or resuming the viewer does not lose its phase. */
export function simulationFrame(kind: SimulationKind, elapsedMs: number) {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const duration = kind === 'breathing' ? 10000 : 4000;
  const first = kind === 'breathing' ? 4000 : 2000;
  const position = elapsed % duration;
  const outgoing = position >= first;
  const phaseDuration = outgoing ? duration - first : first;
  const fraction = (outgoing ? position - first : position) / phaseDuration;
  return {
    phase: (kind === 'breathing' ? outgoing ? 'exhale' : 'inhale' : outgoing ? 'up' : 'down') as 'inhale' | 'exhale' | 'down' | 'up',
    fraction,
    expansion: outgoing ? 1 - fraction : fraction,
    cycles: Math.floor(elapsed / duration),
    remainingSeconds: Math.ceil((phaseDuration * (1 - fraction)) / 1000),
  };
}
