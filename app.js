'use strict';

/* ───────── Sabitler ───────── */
const STORAGE_KEY = 'gunluk-plan:v1';
const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;

const TABS = [
  { id: 'beslenme', name: 'Beslenme',          emoji: '🥗', color: '#F26B27', ink: '#10120A', motto: 'Vücuduna iyi bak, o da sana iyi baksın.' },
  { id: 'egzersiz', name: 'Egzersiz',          emoji: '💪', color: '#C2ED19', ink: '#10120A', motto: 'Zinciri kırma. Bugün de çalış.' },
  { id: 'bakim',    name: 'Kişisel Bakım',     emoji: '🧴', color: '#E54B8E', ink: '#10120A', motto: 'Kendine nazik ol, kendini şımart.' },
  { id: 'ogrenme',  name: 'Öğrenme ve Gelişim', emoji: '📚', color: '#3B72EB', ink: '#FFFFFF', motto: 'Her gün biraz daha bilge.' },
  { id: 'ibadet',   name: 'İbadet',            emoji: '🕌', color: '#C28E1E', ink: '#10120A', motto: 'Kalbine huzur, gününe bereket.' },
  { id: 'kotu-aliskanliklar', name: 'Kötü Alışkanlıklar', emoji: '🚫', color: '#E5484D', ink: '#10120A', motto: 'Kötü alışkanlıkları bırak, hayatına yer aç.' },
];

const ICONS = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M10 2h4"/></svg>',
  repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  sort: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>',
};

const MARKS = {
  g: { label: 'Yeşil – Tamamlandı' },
  b: { label: 'Mavi – Kısmen' },
  r: { label: 'Kırmızı – Yapılmadı' },
};

const DEFAULT_HABITS = {
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
    ['Kur\'an okuma', ''],
    ['Zikir ve dua', ''],
  ],
  'kotu-aliskanliklar': [
    ['Sigara içmemek', 'Bugün hiç içmedim'],
    ['Şeker / abur cubur yememek', 'Paketli gıda ve ilave şeker yok'],
    ['Sosyal medyada aşırı vakit geçirmemek', 'En fazla 30 dk'],
    ['Geç saatte uyumamak', 'En geç 00:00\'da uyu'],
    ['Fast food yememek', 'Ev yapımı ve sağlıklı besinler'],
  ],
};


const CATEGORY_ICONS = {
  beslenme: '<path d="M5 15h26c0 9-5 14-13 14S5 24 5 15Z" fill="currentColor"/><path d="M8 12c2-5 5-5 8-1m3-2 3-4 4 3m-4 4 4-2 3 3M12 6l2-3 3 3"/>',
  egzersiz: '<path d="M12 18h12M8 10v16m4-19v22m12-22v22m4-19v22M4 14v8m28-8v8" stroke-width="3"/>',
  bakim: '<path d="M18 4c-11 10-10 19 0 27C28 23 29 14 18 4Zm0 9v16m-5-9 5 5 5-5M8 15 2 13c0 12 5 18 16 18 11 0 16-6 16-18l-6 2"/>',
  ogrenme: '<path d="M18 8C11 3 6 5 3 6v24c5-2 10-1 15 2 5-3 10-4 15-2V6c-3-1-8-3-15 2Z"/><path d="M18 8v24"/>',
  ibadet: '<path d="M8 30V19h20v11M12 18c-4-7 6-8 6-14 0 6 10 7 6 14M3 30V12m30 18V12M16 30v-7h4v7"/>',
  'kotu-aliskanliklar': '<circle cx="18" cy="18" r="13"/><path d="m9 9 18 18"/>'
};
function categoryIcon(tab) { return '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + CATEGORY_ICONS[tab] + '</svg>'; }
function habitEmoji(h) {
  if (typeof h.emoji === 'string' && h.emoji) return h.emoji;
  const name = h.name.toLocaleLowerCase('tr-TR');
  if (name.includes('protein')) return '🍳';
  if (name.includes('vitamin')) return '🍊';
  if (name.includes('kalori')) return '🔥';
  if (h.tab === 'beslenme' && name.includes('su')) return '💧';
  return {beslenme:'🥗', egzersiz:'🏋️', bakim:'🌿', ogrenme:'📖', ibadet:'🌙', 'kotu-aliskanliklar':'🛡️'}[h.tab] || '🎯';
}

const CUSTOM_TAB_COLORS = [
  { color: '#8B5CF6', label: 'Mor' }, { color: '#3B72EB', label: 'Mavi' },
  { color: '#14B8A6', label: 'Turkuaz' }, { color: '#C2ED19', label: 'Yeşil' },
  { color: '#F26B27', label: 'Turuncu' }, { color: '#E54B8E', label: 'Pembe' },
  { color: '#E5484D', label: 'Kırmızı' }, { color: '#C28E1E', label: 'Altın' },
  { color: '#1E3A8A', label: 'Lacivert' }, { color: '#000000', label: 'Siyah' },
  { color: '#14532D', label: 'Koyu yeşil' }, { color: '#78350F', label: 'Kahverengi' },
];
function normalizeCustomTabs(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' ||
      !/^custom-[A-Za-z0-9_-]{1,100}$/.test(item.id) || seen.has(item.id) ||
      typeof item.name !== 'string' || !item.name.trim()) return [];
    seen.add(item.id);
    return [{ id: item.id, name: item.name.trim().slice(0, 40),
      emoji: typeof item.emoji === 'string' && item.emoji.trim() ? item.emoji.trim().slice(0, 24) : '📁',
      color: typeof item.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(item.color) ? item.color : '#8B5CF6' }];
  });
}
function getAccentInk(color) {
  const [r, g, b] = [1, 3, 5].map(start => {
    const c = parseInt(color.slice(start, start + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722 > 0.179 ? '#10120A' : '#FFFFFF';
}
function getTabs() {
  const tabs = [...TABS.filter(tab => !state.deletedTabs?.includes(tab.id)).map(tab => {
    const edit = state.tabEdits?.[tab.id];
    const [valid] = normalizeCustomTabs([{ ...edit, id: 'custom-edit' }]);
    return valid ? { ...tab, name: valid.name, emoji: valid.emoji, color: valid.color, ink: getAccentInk(valid.color), customIcon: true } : tab;
  }), ...normalizeCustomTabs(state.customTabs).map(tab => ({ ...tab, ink: getAccentInk(tab.color), motto: 'Kendi ritmini oluştur, zincirini sürdür.' }))];
  if (!tabs.length) return [TABS[0]];
  const order = Array.isArray(state.tabOrder) ? [...new Set(state.tabOrder.filter(id => tabs.some(tab => tab.id === id)))] : [];
  return [...order.map(id => tabs.find(tab => tab.id === id)), ...tabs.filter(tab => !order.includes(tab.id))];
}

/* ───────── Yardımcılar ───────── */
const $ = (sel) => document.querySelector(sel);
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const keyOf = (date) => dateKey(date.getFullYear(), date.getMonth(), date.getDate());
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (date, n) => { const x = new Date(date); x.setDate(x.getDate() + n); return x; };
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
const fmtMonth = new Intl.DateTimeFormat('tr-TR', { month: 'long', year: 'numeric' });
const fmtDay = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });

/* ───────── Durum & kalıcılık ───────── */
function seed() {
  const habits = [];
  for (const [tab, items] of Object.entries(DEFAULT_HABITS)) {
    for (const [name, detail] of items) habits.push({ id: uid(), tab, name, detail });
  }
  return { v: 1, tab: TABS[0].id, habits, marks: {} };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.habits) && s.marks) {
        // Yeni eklenen sekmeler varsa onların varsayılan alışkanlıklarını da ekle
        for (const [tab, items] of Object.entries(DEFAULT_HABITS)) {
          if (Array.isArray(s.deletedTabs) && s.deletedTabs.includes(tab)) continue;
          if (!s.habits.some((h) => h.tab === tab)) {
            for (const [name, detail] of items) s.habits.push({ id: uid(), tab, name, detail });
          }
        }
        return s;
      }
    }
  } catch { /* bozuk veri: yeniden başla */ }
  return seed();
}

let saveError = false;
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    if (!saveError) { saveError = true; alert('Veriler tarayıcıya kaydedilemedi. Lütfen "Yedekle" ile bir kopya alın.'); }
  }
}

const state = load();
state.progress ||= {};
state.tasks ||= [];
state.section ||= 'rutin';
state.profile ||= { firstName: '', lastName: '' };
state.customTabs = normalizeCustomTabs(state.customTabs);
state.deletedTabs = Array.isArray(state.deletedTabs) ? state.deletedTabs.filter(id => TABS.some(tab => tab.id === id)) : [];
if (!getTabs().some((t) => t.id === state.tab)) state.tab = getTabs()[0].id;
save();
navigator.storage?.persist?.().catch(() => {});

let view = (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; })();

let reorderMode = false;
let monthlyViewMode = false;
let taskReorderMode = false;
let taskFilter = 'all';
let completedExpanded = true;
let profileOpen = false;
let profileSavedMsg = false;

function getInitials(first, last) {
  const f = (first || '').trim();
  const l = (last || '').trim();
  if (f && l) return (f[0] + l[0]).toLocaleUpperCase('tr-TR');
  const parts = (f || l).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('tr-TR');
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase('tr-TR');
  return '';
}

function nowStampTR() {
  const n = new Date();
  return `${pad(n.getDate())}.${pad(n.getMonth() + 1)}.${n.getFullYear()} ${pad(n.getHours())}:${pad(n.getMinutes())}`;
}
const getMark = (id, key) => state.marks[id]?.[key] || '';
const getProgress = (id, key) => state.progress?.[id]?.[key] || 0;
function setMark(id, key, val) {
  if (val) (state.marks[id] ||= {})[key] = val;
  else if (state.marks[id]) { delete state.marks[id][key]; if (!Object.keys(state.marks[id]).length) delete state.marks[id]; }
  save();
  render();
}
function setProgressAndAutoMark(h, key, newVal) {
  const clamped = Math.max(0, Math.round(newVal * 100) / 100);
  state.progress ||= {};
  if (clamped > 0) (state.progress[h.id] ||= {})[key] = clamped;
  else if (state.progress[h.id]) {
    delete state.progress[h.id][key];
    if (!Object.keys(state.progress[h.id]).length) delete state.progress[h.id];
  }
  const target = h.goal?.target || 0;
  if (target > 0) {
    if (clamped >= target) (state.marks[h.id] ||= {})[key] = 'g';
    else if (clamped > 0) (state.marks[h.id] ||= {})[key] = 'b';
    else if (state.marks[h.id]) {
      delete state.marks[h.id][key];
      if (!Object.keys(state.marks[h.id]).length) delete state.marks[h.id];
    }
  }
  save();
  render();
}

function fmtDuration(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}
function fmtTimerReadable(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const parts = [];
  if (h > 0) parts.push(`${h} saat`);
  if (m > 0) parts.push(`${m} dk`);
  if (r > 0 && h === 0) parts.push(`${r} sn`);
  return parts.length > 0 ? parts.join(' ') : '0 dk';
}

/* ───────── Zincir hesapları (sadece yeşil zinciri sürdürür) ───────── */
function streaks(id, todayKey) {
  const m = state.marks[id] || {};
  let cur = 0;
  let d = parseKey(todayKey);
  if (m[todayKey] !== 'g') d = addDays(d, -1); // bugün henüz işaretlenmediyse zincir bozulmaz
  while (m[keyOf(d)] === 'g') { cur++; d = addDays(d, -1); }

  let best = 0, run = 0;
  const keys = Object.keys(m).filter((k) => m[k] === 'g').sort();
  if (keys.length) {
    let prev = null;
    for (const k of keys) {
      run = prev && keyOf(addDays(parseKey(prev), 1)) === k ? run + 1 : 1;
      if (run > best) best = run;
      prev = k;
    }
  }
  return { cur, best };
}

/* ───────── Çizim ───────── */
function render() {
  const tab = getTabs().find((t) => t.id === state.tab) || TABS[0];
  const activeSec = state.section === 'gorevler' ? 'gorevler' : 'rutin';
  document.body.dataset.tab = tab.id;
  document.body.dataset.section = !profileOpen && activeSec === 'gorevler' ? 'gorevler' : 'rutin';
  ['--accent', '--accent-end', '--accent-ink', '--accent-soft'].forEach(key => document.body.style.removeProperty(key));
  if ((tab.id.startsWith('custom-') || tab.customIcon) && document.body.dataset.section === 'rutin') {
    document.body.style.setProperty('--accent', tab.color);
    document.body.style.setProperty('--accent-end', tab.color);
    document.body.style.setProperty('--accent-ink', tab.ink);
    document.body.style.setProperty('--accent-soft', `color-mix(in srgb, ${tab.color} 14%, #10110f)`);
  }
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#fff';
  const initials = getInitials(state.profile?.firstName, state.profile?.lastName);
  const pBtn = $('#profileBtn');
  if (pBtn) {
    pBtn.innerHTML = initials ? esc(initials) : ICONS.user;
    pBtn.classList.toggle('active', profileOpen);
  }
  const gBtn = $('#floatingGearBtn');
  if (gBtn) {
    gBtn.classList.toggle('active', profileOpen);
  }
  $('#topModeTabs')?.querySelectorAll('[data-section]').forEach((b) => {
    b.classList.toggle('active', !profileOpen && b.dataset.section === activeSec);
  });
  const activeTasksCount = (state.tasks || []).filter((t) => !t.done).length;
  const tBadge = $('#tasksBadge');
  if (tBadge) {
    tBadge.textContent = String(activeTasksCount);
    tBadge.hidden = activeTasksCount === 0;
  }
  const foot = $('#mainFoot');
  if (foot) foot.hidden = profileOpen || activeSec === 'gorevler';
  renderTabs();
  $('#tabs').hidden = profileOpen || activeSec !== 'rutin';
  if (profileOpen) renderProfilePage();
  else if (activeSec === 'gorevler') renderTasksPanel();
  else renderPanel(tab);
}

function renderTasksPanel() {
  const allTasks = state.tasks || [];
  const activeAll = allTasks.filter((t) => !t.done);
  const starredCount = activeAll.filter((t) => t.starred).length;
  const displayed = taskFilter === 'starred' ? activeAll.filter((t) => t.starred) : activeAll;
  const completed = allTasks.filter((t) => t.done);

  const activeCards = displayed.map((t, i) => {
    if (taskReorderMode) {
      return `<article class="card compact" data-task-item="${t.id}">
        <span class="handle" style="display:grid;place-items:center">⠿</span>
        <div class="c-name"><h4>${esc(t.title)}</h4>${t.detail ? `<p class="detail">${esc(t.detail)}</p>` : ''}</div>
        <button type="button" class="icon-btn" data-task-move="-1" data-id="${t.id}" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" class="icon-btn" data-task-move="1" data-id="${t.id}" ${i === displayed.length - 1 ? 'disabled' : ''}>▼</button>
      </article>`;
    }
    const subs = (t.subtasks || []).map((st) => `
      <button type="button" class="task-sub-row" data-task-sub-toggle="${st.id}" data-task-id="${t.id}">
        <span class="task-sub-circle ${st.done ? 'done' : ''}">${st.done ? '✓' : ''}</span>
        <span style="${st.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(st.title)}</span>
      </button>
    `).join('');
    return `<article class="card" data-task-item="${t.id}" style="padding:14px 16px">
      <div class="task-row">
        <button type="button" class="task-circle" data-task-done="${t.id}" aria-label="Görevi tamamla"></button>
        <div class="task-body" data-task-edit="${t.id}">
          <h4>${esc(t.title)}</h4>
          ${t.detail ? `<p class="detail">${esc(t.detail)}</p>` : ''}
          ${t.dueDate ? `<div style="margin-top:6px"><span class="goal-chip">${ICONS.calendar} ${esc(t.dueDate)}</span></div>` : ''}
        </div>
        <button type="button" class="task-star-btn ${t.starred ? 'starred' : ''}" data-task-star="${t.id}" aria-label="Yıldızla">${t.starred ? '★' : '☆'}</button>
      </div>
      ${subs ? `<div class="task-subtasks">${subs}</div>` : ''}
    </article>`;
  }).join('');

  const completedHTML = completed.length ? `
    <article class="card" style="margin-top:14px;padding:10px 14px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <button type="button" data-toggle-completed style="background:transparent;border:0;font-weight:800;font-size:.92rem;padding:4px 0">
          ${completedExpanded ? '▾' : '▸'} Tamamlananlar (${completed.length})
        </button>
        <button type="button" data-clear-completed style="background:transparent;border:0;color:var(--red);font-weight:700;font-size:.8rem">Tümünü sil</button>
      </div>
      ${completedExpanded ? `<div style="margin-top:6px;display:grid;gap:8px">
        ${completed.map((t) => `
          <div style="display:flex;align-items:center;gap:12px;padding-top:8px;border-top:1px solid color-mix(in srgb, var(--text) 10%, transparent)">
            <button type="button" class="task-circle done" data-task-done="${t.id}">✓</button>
            <div class="task-body" data-task-edit="${t.id}">
              <h4 style="text-decoration:line-through;color:var(--muted)">${esc(t.title)}</h4>
              ${t.detail ? `<p class="detail" style="text-decoration:line-through;opacity:.75">${esc(t.detail)}</p>` : ''}
            </div>
            <button type="button" data-task-del-single="${t.id}" style="background:transparent;border:0;color:var(--muted);padding:4px 8px">✕</button>
          </div>
        `).join('')}
      </div>` : ''}
    </article>
  ` : '';

  $('#panel').innerHTML = `
    <div class="toolbar">
      <button type="button" class="${taskFilter === 'all' ? 'primary' : 'pill'}" data-task-filter="all">Görevlerim (${activeAll.length})</button>
      <button type="button" class="${taskFilter === 'starred' ? 'primary' : 'pill'}" data-task-filter="starred">★ Yıldızlı (${starredCount})</button>
      <span class="spacer"></span>
      ${taskFilter === 'all' && (activeAll.length > 1 || taskReorderMode) ? `<button type="button" class="${taskReorderMode ? 'primary' : 'pill'}" data-task-reorder>${taskReorderMode ? '✓ Bitti' : `${ICONS.sort} Sırala`}</button>` : ''}
      ${taskReorderMode ? '' : '<button type="button" class="primary" data-task-add>＋ Madde ekle</button>'}
    </div>
    ${taskReorderMode ? '' : `
      <div class="card task-quick-bar">
        <span class="task-circle" style="opacity:.7;color:var(--accent)">＋</span>
        <input type="text" id="quickTaskInput" maxlength="100" placeholder="${taskFilter === 'starred' ? 'Yıldızlı yeni görev ekle...' : 'Yeni bir görev ekle...'}">
        <button type="button" class="primary" data-quick-task-submit style="padding:6px 12px">Ekle</button>
      </div>
    `}
    <div class="list">${activeCards || `<p class="empty">${taskFilter === 'starred' ? 'Henüz yıldızlı görev yok. Görevlerin yanındaki ☆ simgesine dokunarak önemli görevleri buraya sabitleyebilirsin.' : 'Yapılacak görev yok. Yukarıdan hızlıca yazabilir veya “＋ Madde ekle” ile detaylı görev oluşturabilirsin.'}</p>`}</div>
    ${completedHTML}
  `;
}

function renderProfilePage() {
  const { key: todayKey } = todayInfo();
  const initials = getInitials(state.profile?.firstName, state.profile?.lastName);
  const fullName = [state.profile?.firstName, state.profile?.lastName].filter(Boolean).join(' ').trim();
  const allDoneToday = state.habits.filter((h) => getMark(h.id, todayKey) === 'g').length;
  const totalMarked = Object.values(state.marks).reduce((acc, m) => acc + Object.keys(m || {}).length, 0);
  const maxBest = state.habits.reduce((mx, h) => Math.max(mx, streaks(h.id, todayKey).best), 0);

  $('#panel').innerHTML = `
    <div class="profile-page">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <button type="button" class="pill" data-close-profile>‹ Geri Dön</button>
        <h2 style="margin:0;font-size:1.2rem">Profil ve Ayarlar</h2>
        <span style="width:80px"></span>
      </div>

      <article class="card" style="text-align:center;padding:20px 16px">
        <div class="profile-avatar-lg">${initials ? esc(initials) : ICONS.user}</div>
        <h3 style="margin:0;font-size:1.25rem">${esc(fullName || 'Misafir Kullanıcı')}</h3>
        <p class="detail" style="margin-top:4px">${fullName ? 'Günlük Plan Profili' : 'Günlük Plan Özeti'}</p>
        <div class="profile-stats-grid">
          <div class="profile-stat-box"><b>${state.habits.length}</b><small>Toplam Madde</small></div>
          <div class="profile-stat-box"><b style="color:var(--green)">${allDoneToday}/${state.habits.length}</b><small>Bugün Tamam</small></div>
          <div class="profile-stat-box"><b>${maxBest} gün</b><small>En Uzun Zincir</small></div>
        </div>
      </article>

      <article class="card" style="padding:18px">
        <h3 style="margin:0 0 8px;font-size:1.05rem">💾 Yedekleme ve Geri Yükleme</h3>
        <p class="detail" style="line-height:1.45">Tüm alışkanlıklarınız, görevlerinizdeki maddeler, alt görevleriniz, zincirleriniz, ilerleme kayıtlarınız ve profil bilgileriniz cihazınızda saklanır. Verilerinizi yedekleyebilir veya istediğiniz zaman yedekten geri yükleyebilirsiniz.</p>
        <div class="backup-info-box">
          <div class="backup-info-row"><span>Kayıtlı Alışkanlık:</span><b>${state.habits.length} madde (${getTabs().length} kategori)</b></div>
          <div class="backup-info-row"><span>Kayıtlı Görevler:</span><b>${(state.tasks || []).length} madde (${(state.tasks || []).filter((t) => !t.done).length} aktif, ${(state.tasks || []).filter((t) => t.done).length} tamamlanan)</b></div>
          <div class="backup-info-row"><span>Toplam İşaretlenen Gün:</span><b>${totalMarked} kayıt</b></div>
          <div class="backup-info-row"><span>Son Yedekleme:</span><b>${esc(state.profile?.lastBackupAt || 'Henüz yedek alınmadı')}</b></div>
          <div class="backup-info-row"><span>Son Geri Yükleme:</span><b>${esc(state.profile?.lastRestoreAt || 'Henüz geri yükleme yapılmadı')}</b></div>
        </div>
        <div style="display:grid;gap:10px">
          <button type="button" class="primary" style="width:100%;padding:11px" data-export-backup>📥 Yedekle (Dışa Aktar)</button>
          <button type="button" class="pill" style="width:100%;padding:11px" data-import-backup>📤 Yedekten Yükle (Geri Yükle)</button>
        </div>
      </article>
    </div>
  `;
}

function todayInfo() {
  const now = new Date();
  return { now, key: keyOf(now) };
}

function renderTabs() {
  const { key } = todayInfo();
  $('#tabs').innerHTML = getTabs().map((t) => {
    const hs = state.habits.filter((h) => h.tab === t.id);
    const done = hs.filter((h) => getMark(h.id, key) === 'g').length;
    const sel = t.id === state.tab;
    return `<button type="button" role="tab" class="tab" id="tab-${t.id}" data-tab="${t.id}" aria-selected="${sel}" tabindex="${sel ? 0 : -1}" style="--tab-color:${t.color};--tab-ink:${t.ink}">
      <span class="t-emoji" aria-hidden="true">${t.id.startsWith('custom-') || t.customIcon ? esc(t.emoji) : categoryIcon(t.id)}</span>
      <span>${esc(t.name)}</span>
      <span class="t-count">${done}/${hs.length}</span>
    </button>`;
  }).join('') + '<button type="button" class="add-tab-btn" data-add-tab aria-label="Yeni sekme ekle"><span aria-hidden="true">＋</span><small>Yeni sekme</small></button>';
  $('#panel').setAttribute('aria-labelledby', `tab-${state.tab}`);
}

function chainLinkSVG(uidStr, step) {
  return `<span class="chain-link-3d" style="--step:${step}" aria-hidden="true">
    <span class="chain-laser-track"><span class="chain-laser-wave"></span></span>
    <svg viewBox="0 0 28 20" class="chain-rings-svg" focusable="false">
      <defs>
        <linearGradient id="mG-${uidStr}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.98"/>
          <stop offset="30%" stop-color="#34d399"/>
          <stop offset="72%" stop-color="#10b981"/>
          <stop offset="100%" stop-color="#064e3b"/>
        </linearGradient>
      </defs>
      <g class="ring-left">
        <rect x="1.8" y="5.6" width="14.2" height="10.2" rx="5.1" stroke="rgba(0,0,0,0.42)" stroke-width="3.2" fill="none"/>
        <rect x="1.8" y="4.8" width="14.2" height="10.2" rx="5.1" stroke="url(#mG-${uidStr})" stroke-width="2.9" fill="none"/>
        <path d="M 5.6 5.0 H 11.4 A 4.2 4.2 0 0 1 14.8 7.2" stroke="#ecfdf5" stroke-width="1.05" stroke-linecap="round" fill="none"/>
        <circle cx="3.2" cy="9.9" r="1.4" fill="#ecfdf5"/>
      </g>
      <g class="ring-right">
        <rect x="12.0" y="5.6" width="14.2" height="10.2" rx="5.1" stroke="rgba(0,0,0,0.42)" stroke-width="3.2" fill="none"/>
        <rect x="12.0" y="4.8" width="14.2" height="10.2" rx="5.1" stroke="url(#mG-${uidStr})" stroke-width="2.9" fill="none"/>
        <path d="M 16.4 5.0 H 22.2 A 4.2 4.2 0 0 1 25.4 7.2" stroke="#ecfdf5" stroke-width="1.05" stroke-linecap="round" fill="none"/>
        <circle cx="24.8" cy="9.9" r="1.4" fill="#ecfdf5"/>
      </g>
      <path class="ring-over" d="M 10.6 4.8 H 12.2 A 4.9 4.9 0 0 1 16.0 9.8" stroke="url(#mG-${uidStr})" stroke-width="3.0" stroke-linecap="round" fill="none"/>
      <circle class="ring-core" cx="14" cy="10" r="2.2" fill="#ffffff" stroke="#34d399" stroke-width="1"/>
    </svg>
  </span>`;
}

function cellHTML(h, y, m, d, extra = '', inner = null) {
  const key = dateKey(y, m, d);
  const { key: today } = todayInfo();
  const mark = getMark(h.id, key);
  const future = key > today;
  const dayName = fmtDay.format(new Date(y, m, d));
  const status = mark ? MARKS[mark].label : 'İşaretsiz';
  const isChainGrid = !extra;
  const dim = isChainGrid ? daysInMonth(y, m) : 0;
  const prevGreen = isChainGrid && d > 1 && getMark(h.id, dateKey(y, m, d - 1)) === 'g';
  const nextGreen = isChainGrid && d < dim && getMark(h.id, dateKey(y, m, d + 1)) === 'g';
  const inGreenChain = mark === 'g' && (prevGreen || nextGreen);
  const linkBridge = mark === 'g' && nextGreen ? chainLinkSVG(`${h.id}-${d}`, d) : '';
  return `<button type="button" class="cell ${mark ? 's-' + mark : ''} ${inGreenChain ? 'in-chain' : ''} ${key === today ? 'today' : ''} ${extra}" data-cell data-id="${h.id}" data-date="${key}" ${future ? 'disabled' : ''}
    aria-label="${esc(h.name)}, ${dayName}: ${status}" title="${dayName}">${inner ?? d}${linkBridge}</button>`;
}

function renderPanel(tab) {
  const { now, key: todayKey } = todayInfo();
  const habits = state.habits.filter((h) => h.tab === tab.id);
  const doneToday = habits.filter((h) => getMark(h.id, todayKey) === 'g').length;
  const pct = habits.length ? Math.round((doneToday / habits.length) * 100) : 0;
  const { y, m } = view;
  const dim = daysInMonth(y, m);
  const isCurrentMonth = y === now.getFullYear() && m === now.getMonth();

  const cards = habits.map((h, i) => {
    if (reorderMode) {
      return `<article class="card compact" data-habit="${h.id}">
        <button type="button" class="handle" data-handle aria-label="${esc(h.name)} maddesini sürükle" title="Sürükle">⠿</button>
        <div class="c-name"><h4>${esc(h.name)}</h4>${h.detail ? `<p class="detail">${esc(h.detail)}</p>` : ''}</div>
        <button type="button" class="icon-btn" data-move="-1" data-id="${h.id}" aria-label="${esc(h.name)} yukarı taşı" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" class="icon-btn" data-move="1" data-id="${h.id}" aria-label="${esc(h.name)} aşağı taşı" ${i === habits.length - 1 ? 'disabled' : ''}>▼</button>
      </article>`;
    }
    const { cur, best } = streaks(h.id, todayKey);
    let monthDone = 0;
    let cells = '';
    for (let d = 1; d <= dim; d++) {
      if (getMark(h.id, dateKey(y, m, d)) === 'g') monthDone++;
      cells += cellHTML(h, y, m, d);
    }
    const todayProg = getProgress(h.id, todayKey);
    let goalChip = '';
    if (h.goal && h.goal.type !== 'none' && h.goal.target > 0) {
      if (h.goal.type === 'timer') {
        const txt = todayProg > 0 && todayProg < h.goal.target
          ? `${fmtDuration(todayProg)} / ${fmtTimerReadable(h.goal.target)}`
          : fmtTimerReadable(h.goal.target);
        goalChip = `<span class="goal-chip">${ICONS.timer} ${esc(txt)}</span>`;
      } else if (h.goal.type === 'reps') {
        goalChip = `<span class="goal-chip">${ICONS.repeat} ${todayProg}/${h.goal.target} tekrar</span>`;
      } else if (h.goal.type === 'amount') {
        goalChip = `<span class="goal-chip">${ICONS.chart} ${todayProg}/${h.goal.target}${h.goal.unit ? ' ' + esc(h.goal.unit) : ''}</span>`;
      }
    }
    const flameColor = 'var(--accent)';
    return `<article class="card" data-habit="${h.id}">
      <div class="card-head" data-card-head="${h.id}">
        <span class="routine-grip" aria-hidden="true">⠿</span>
        <span class="habit-emblem" aria-hidden="true">${habitEmoji(h)}</span>
        <div class="card-info">
          <div class="card-title-group">
            <h4>${esc(h.name)}</h4>
            ${h.detail ? `<span class="detail">${esc(h.detail)}</span>` : ''}
          </div>
          <div class="card-stats">
            <span class="stat-pill"><span style="display:inline-grid;color:${flameColor}">${ICONS.flame}</span> <b>${cur}</b> gün</span>
            <span class="stat-pill">${ICONS.trophy} Rekor <b>${best}</b></span>
            <span class="stat-pill">${ICONS.calendar} <b>${monthDone}/${dim}</b></span>
            ${goalChip}
          </div>
        </div>
        <div class="card-actions">
          ${cellHTML(h, now.getFullYear(), now.getMonth(), now.getDate(), 'today-btn', `<small>Bugün</small>${now.getDate()}`)}
        </div>
      </div>
      <div class="chain ${monthlyViewMode ? 'monthly' : 'weekly'}" role="group" aria-label="${esc(h.name)} aylık zincir" style="--days: ${dim}">${cells}</div>
    </article>`;
  }).join('');

  $('#panel').innerHTML = `
    <div class="toolbar">
      <div class="month">
        <button type="button" class="icon-btn" data-month="-1" aria-label="Önceki ay">‹</button>
        <h3>${fmtMonth.format(new Date(y, m, 1))}</h3>
        <button type="button" class="icon-btn" data-month="1" aria-label="Sonraki ay">›</button>
      </div>
      <button type="button" class="pill monthly-toggle ${monthlyViewMode ? 'selected' : ''}" data-monthly aria-pressed="${monthlyViewMode}">${ICONS.calendar}<span>${monthlyViewMode ? 'Aylık ✓' : 'Aylık Görünüm'}</span></button>
      ${isCurrentMonth ? '' : '<button type="button" class="pill" data-month="today">Bu ay</button>'}
      <span class="spacer"></span>
      ${habits.length > 1 || reorderMode ? `<button type="button" class="${reorderMode ? 'primary' : 'pill'}" data-reorder aria-pressed="${reorderMode}">${reorderMode ? '✓ Bitti' : `${ICONS.sort} Sırala`}</button>` : ''}
      ${reorderMode ? '' : '<button type="button" class="neon-add" data-add aria-label="Yeni alışkanlık ekle">' + ICONS.plus + '</button>'}
    </div>
    <div class="list ${reorderMode ? 'reordering' : ''}">${cards || '<p class="empty">Bu sekmede henüz madde yok. “＋” ile başla.</p>'}</div>`;
  if (!monthlyViewMode) {
    requestAnimationFrame(() => {
      const firstDay = isCurrentMonth ? Math.max(1, Math.min(now.getDate() - 6, dim - 6)) : 1;
      document.querySelectorAll('.chain.weekly').forEach(chain => {
        const cell = chain.children[firstDay - 1];
        if (cell) chain.scrollLeft = cell.offsetLeft - chain.children[0].offsetLeft;
      });
    });
  }
}

/* ───────── Sekme & ay gezinme ───────── */
$('#topModeTabs')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-section]');
  if (!b) return;
  profileOpen = false;
  reorderMode = false;
  taskReorderMode = false;
  state.section = b.dataset.section;
  save();
  render();
});

const toggleProfileAndSettings = () => {
  profileSavedMsg = false;
  profileOpen = !profileOpen;
  reorderMode = false;
  taskReorderMode = false;
  render();
};
$('#profileBtn')?.addEventListener('click', toggleProfileAndSettings);
$('#floatingGearBtn')?.addEventListener('click', toggleProfileAndSettings);

$('#tabs').addEventListener('click', (e) => {
  if (suppressTabClick) { suppressTabClick = false; e.preventDefault(); return; }
  if (e.target.closest('[data-add-tab]')) { openCategoryEditor(); return; }
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  const wasProfile = profileOpen;
  const wasTasks = state.section === 'gorevler';
  profileOpen = false;
  if (state.tab !== b.dataset.tab || wasProfile || wasTasks) {
    state.section = 'rutin';
    state.tab = b.dataset.tab;
    reorderMode = false;
    taskReorderMode = false;
    save();
    render();
    panel.classList.remove('enter');
    void panel.offsetWidth;
    panel.classList.add('enter');
  }
  $(`#tab-${state.tab}`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
});
$('#tabs').addEventListener('keydown', (e) => {
  suppressTabClick = false;
  if (!e.target.closest('[role="tab"]')) return;
  const tabs = getTabs();
  const targetId = e.target.closest('[role="tab"]').dataset.tab;
  if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); openCategoryActions(targetId); return; }
  if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
    const from = tabs.findIndex(tab => tab.id === targetId), to = from + (e.key === 'ArrowLeft' ? -1 : 1);
    if (to >= 0 && to < tabs.length) {
      const [tab] = tabs.splice(from, 1); tabs.splice(to, 0, tab);
      state.tabOrder = tabs.map(tab => tab.id); save(); renderTabs();
      $(`#tab-${targetId}`)?.focus();
    }
    return;
  }
  const i = tabs.findIndex((t) => t.id === state.tab);
  let n = null;
  if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
  else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
  if (n === null) return;
  e.preventDefault();
  state.tab = tabs[n].id; save(); render();
  $(`#tab-${state.tab}`)?.focus();
});

// A held tab becomes draggable; only a stationary release opens its delete menu.
let tabGesture = null;
let suppressTabClick = false;
const tabStrip = $('#tabs');
function finishTabGesture(cancelled = false) {
  const gesture = tabGesture;
  if (!gesture) return;
  tabGesture = null;
  clearTimeout(gesture.timer);
  if (tabStrip.hasPointerCapture(gesture.pointerId)) tabStrip.releasePointerCapture(gesture.pointerId);
  gesture.button.classList.remove('tab-dragging');
  gesture.button.style.transform = '';
  if (gesture.scrolling) { suppressTabClick = true; return; }
  if (gesture.armed) {
    suppressTabClick = true;
    if (cancelled) { renderTabs(); return; }
    if (gesture.moved) {
      state.tabOrder = [...tabStrip.querySelectorAll('[role="tab"]')].map(button => button.dataset.tab);
      save(); renderTabs();
    } else openCategoryActions(gesture.id);
  }
}
tabStrip.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  const button = event.target.closest('[role="tab"]');
  if (!button) return;
  suppressTabClick = false;
  tabGesture = { id: button.dataset.tab, button, pointerId: event.pointerId, pointerType: event.pointerType, scrollX: tabStrip.scrollLeft, x: event.clientX, y: event.clientY, armed: false, moved: false, scrolling: false, timer: 0 };
  const gesture = tabGesture;
  gesture.timer = setTimeout(() => {
    if (tabGesture !== gesture) return;
    gesture.armed = true;
    button.classList.add('tab-dragging');
    tabStrip.setPointerCapture(event.pointerId);
    navigator.vibrate?.(15);
  }, 450);
});
tabStrip.addEventListener('pointermove', event => {
  const gesture = tabGesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
  if (gesture.scrolling) { event.preventDefault(); tabStrip.scrollLeft = gesture.scrollX - dx; return; }
  if (!gesture.armed) {
    if (Math.hypot(dx, dy) > 8) {
      clearTimeout(gesture.timer);
      if (gesture.pointerType === 'touch' && Math.abs(dx) > Math.abs(dy)) {
        gesture.scrolling = true;
        tabStrip.setPointerCapture(event.pointerId);
        tabStrip.scrollLeft = gesture.scrollX - dx;
        event.preventDefault();
      } else finishTabGesture(true);
    }
    return;
  }
  event.preventDefault();
  if (Math.abs(dx) > 6) gesture.moved = true;
  if (!gesture.moved) return;
  const others = [...tabStrip.querySelectorAll('[role="tab"]')].filter(button => button !== gesture.button);
  const before = others.find(button => { const rect = button.getBoundingClientRect(); return event.clientX < rect.left + rect.width / 2; });
  tabStrip.insertBefore(gesture.button, before || tabStrip.querySelector('[data-add-tab]'));
});
window.addEventListener('pointerup', () => finishTabGesture(false));
window.addEventListener('pointercancel', () => finishTabGesture(true));
window.addEventListener('blur', () => finishTabGesture(true));
tabStrip.addEventListener('contextmenu', event => {
  const button = event.target.closest('[role="tab"]');
  if (!button) return;
  event.preventDefault();
  if (event.pointerType !== 'touch' && !tabGesture?.moved) { finishTabGesture(true); openCategoryActions(button.dataset.tab); }
});

/* ───────── Basılı tutma / dokunma ───────── */
const panel = $('#panel');
const menu = $('#menu');
let press = { timer: 0, fired: false, x: 0, y: 0, el: null };
let menuTarget = null;

function cancelPress() {
  clearTimeout(press.timer);
  press.el?.classList.remove('pressing');
  press.el = null;
}

panel.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const cell = e.target.closest('[data-cell]');
  if (cell) {
    if (cell.disabled) return;
    press = { timer: 0, fired: false, x: e.clientX, y: e.clientY, el: cell };
    cell.classList.add('pressing');
    press.timer = setTimeout(() => {
      press.fired = true;
      cell.classList.remove('pressing');
      navigator.vibrate?.(25);
      openMenu(cell);
    }, LONG_PRESS_MS);
    return;
  }
  if (reorderMode) return;
  const card = e.target.closest('.card[data-habit]');
  if (card && !e.target.closest('button')) {
    press = { timer: 0, fired: false, x: e.clientX, y: e.clientY, el: card };
    card.classList.add('pressing');
    press.timer = setTimeout(() => {
      press.fired = true;
      card.classList.remove('pressing');
      navigator.vibrate?.(30);
      const h = state.habits.find((x) => x.id === card.dataset.habit);
      if (h) openEditor(h);
    }, LONG_PRESS_MS);
  }
});
panel.addEventListener('pointermove', (e) => {
  if (press.el && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE) cancelPress();
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => panel.addEventListener(t, (e) => {
  if (t === 'pointerleave' && e.target !== panel) return;
  cancelPress();
}, true));

// Sağ tık / klavyede menü tuşu / mobilde sistem uzun basması
panel.addEventListener('contextmenu', (e) => {
  const cell = e.target.closest('[data-cell]');
  if (cell) {
    e.preventDefault();
    if (cell.disabled) return;
    if (!press.fired) openMenu(cell);
    return;
  }
  const card = e.target.closest('.card[data-habit]');
  if (card && !reorderMode && !e.target.closest('button')) {
    e.preventDefault();
    if (!press.fired) {
      const h = state.habits.find((x) => x.id === card.dataset.habit);
      if (h) openEditor(h);
    }
  }
});

panel.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-profile]')) {
    profileOpen = false;
    render();
    return;
  }
  if (e.target.closest('[data-save-profile]')) {
    const first = ($('#profFirstName')?.value || '').trim();
    const last = ($('#profLastName')?.value || '').trim();
    state.profile = { ...(state.profile || {}), firstName: first, lastName: last };
    save();
    profileSavedMsg = true;
    render();
    return;
  }
  if (e.target.closest('[data-export-backup]')) {
    exportBackup();
    return;
  }
  if (e.target.closest('[data-import-backup]')) {
    $('#importFile')?.click();
    return;
  }
  const cell = e.target.closest('[data-cell]');
  if (cell) {
    if (press.fired) { press.fired = false; return; } // uzun basma sonrası gelen click'i yoksay
    if (cell.disabled) return;
    const { id, date } = cell.dataset;
    setMark(id, date, getMark(id, date) ? '' : 'g');
    return;
  }
  if (e.target.closest('[data-monthly]')) { monthlyViewMode = !monthlyViewMode; render(); return; }
  if (e.target.closest('[data-reorder]')) { reorderMode = !reorderMode; render(); return; }
  const mv = e.target.closest('[data-move]');
  if (mv) {
    const ids = tabHabits().map((h) => h.id);
    const i = ids.indexOf(mv.dataset.id);
    const j = i + Number(mv.dataset.move);
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    applyOrder(ids);
    render();
    panel.querySelector(`[data-move="${mv.dataset.move}"][data-id="${mv.dataset.id}"]`)?.focus();
    return;
  }
  const edit = e.target.closest('[data-edit]');
  if (edit) return openEditor(state.habits.find((h) => h.id === edit.dataset.edit));
  if (e.target.closest('[data-add]')) return openEditor(null);
  const mo = e.target.closest('[data-month]');
  if (mo) {
    if (mo.dataset.month === 'today') { const n = new Date(); view = { y: n.getFullYear(), m: n.getMonth() }; }
    else { const d = new Date(view.y, view.m + Number(mo.dataset.month), 1); view = { y: d.getFullYear(), m: d.getMonth() }; }
    render();
    return;
  }
  const card = e.target.closest('.card[data-habit]');
  if (card && !reorderMode && !e.target.closest('button')) {
    if (press.fired) { press.fired = false; return; }
    const h = state.habits.find((x) => x.id === card.dataset.habit);
    if (h?.goal && h.goal.type !== 'none' && h.goal.target > 0) {
      openActionModal(h);
    }
    return;
  }
  // Görevler etkileşimleri
  const tf = e.target.closest('[data-task-filter]');
  if (tf) { taskFilter = tf.dataset.taskFilter; render(); return; }
  if (e.target.closest('[data-task-reorder]')) { taskReorderMode = !taskReorderMode; render(); return; }
  if (e.target.closest('[data-task-add]')) { openTaskEditor(null); return; }
  if (e.target.closest('[data-quick-task-submit]')) { quickAddTask(); return; }
  const tDone = e.target.closest('[data-task-done]');
  if (tDone) {
    const t = (state.tasks || []).find((x) => x.id === tDone.dataset.taskDone);
    if (t) { t.done = !t.done; t.completedAt = t.done ? nowStampTR() : undefined; save(); render(); }
    return;
  }
  const tStar = e.target.closest('[data-task-star]');
  if (tStar) {
    const t = (state.tasks || []).find((x) => x.id === tStar.dataset.taskStar);
    if (t) { t.starred = !t.starred; save(); render(); }
    return;
  }
  const tSub = e.target.closest('[data-task-sub-toggle]');
  if (tSub) {
    const t = (state.tasks || []).find((x) => x.id === tSub.dataset.taskId);
    const st = t?.subtasks?.find((s) => s.id === tSub.dataset.taskSubToggle);
    if (st) { st.done = !st.done; save(); render(); }
    return;
  }
  const tEdit = e.target.closest('[data-task-edit]');
  if (tEdit) {
    const t = (state.tasks || []).find((x) => x.id === tEdit.dataset.taskEdit);
    if (t) openTaskEditor(t);
    return;
  }
  const tMove = e.target.closest('[data-task-move]');
  if (tMove) {
    const all = state.tasks || [];
    const activeIds = all.filter((x) => !x.done).map((x) => x.id);
    const i = activeIds.indexOf(tMove.dataset.id);
    const j = i + Number(tMove.dataset.taskMove);
    if (i < 0 || j < 0 || j >= activeIds.length) return;
    [activeIds[i], activeIds[j]] = [activeIds[j], activeIds[i]];
    const slots = [];
    all.forEach((x, idx) => { if (!x.done) slots.push(idx); });
    const byId = new Map(all.map((x) => [x.id, x]));
    activeIds.forEach((id, k) => { state.tasks[slots[k]] = byId.get(id); });
    save(); render();
    return;
  }
  if (e.target.closest('[data-toggle-completed]')) { completedExpanded = !completedExpanded; render(); return; }
  if (e.target.closest('[data-clear-completed]')) { state.tasks = (state.tasks || []).filter((x) => !x.done); save(); render(); return; }
  const tDelSingle = e.target.closest('[data-task-del-single]');
  if (tDelSingle) { state.tasks = (state.tasks || []).filter((x) => x.id !== tDelSingle.dataset.taskDelSingle); save(); render(); }
});
panel.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'quickTaskInput') {
    e.preventDefault();
    quickAddTask();
  }
});
function quickAddTask() {
  const inp = $('#quickTaskInput');
  const val = (inp?.value || '').trim();
  if (!val) return;
  state.tasks ||= [];
  state.tasks.unshift({ id: uid(), title: val, detail: '', dueDate: '', starred: taskFilter === 'starred', done: false, createdAt: nowStampTR(), subtasks: [] });
  save();
  render();
}

/* ───────── Sıralama ───────── */
const tabHabits = () => state.habits.filter((h) => h.tab === state.tab);
function applyOrder(ids) {
  // Sekmedeki maddeleri, genel listedeki kendi yerlerine yeni sırayla geri koy
  const slots = [];
  state.habits.forEach((h, i) => { if (h.tab === state.tab) slots.push(i); });
  const byId = new Map(state.habits.map((h) => [h.id, h]));
  ids.forEach((id, k) => { state.habits[slots[k]] = byId.get(id); });
  save();
}

let drag = null;
panel.addEventListener('pointerdown', (e) => {
  const handle = e.target.closest('[data-handle]');
  if (!handle) return;
  e.preventDefault();
  const card = handle.closest('.card');
  handle.setPointerCapture(e.pointerId);
  card.classList.add('dragging');
  drag = { card, handle, list: card.parentElement, id: e.pointerId };
});
panel.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (e.clientY < 90) scrollBy(0, -14);
  else if (e.clientY > innerHeight - 90) scrollBy(0, 14);
  const over = document.elementFromPoint(panel.getBoundingClientRect().left + 20, e.clientY)?.closest('.card.compact');
  if (!over || over === drag.card || over.parentElement !== drag.list) return;
  const r = over.getBoundingClientRect();
  drag.list.insertBefore(drag.card, e.clientY < r.top + r.height / 2 ? over : over.nextSibling);
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const ids = [...drag.list.querySelectorAll('.card.compact')].map((c) => c.dataset.habit);
  drag = null;
  applyOrder(ids);
  render();
}
panel.addEventListener('pointerup', endDrag);
panel.addEventListener('pointercancel', endDrag);

/* ───────── Renk menüsü ───────── */
function openMenu(cell) {
  const { id, date } = cell.dataset;
  const h = state.habits.find((x) => x.id === id);
  menuTarget = { id, date };
  $('#menuTitle').textContent = `${fmtDay.format(parseKey(date))} · ${h?.name ?? ''}`;
  const cur = getMark(id, date);
  menu.querySelectorAll('[data-mark]').forEach((b) => b.classList.toggle('active', b.dataset.mark === cur));

  if (menu.matches(':popover-open')) menu.hidePopover();
  menu.showPopover();

  menu.querySelector('button')?.focus({ preventScroll: true });
}
function closeMenu() {
  if (menu.matches(':popover-open')) menu.hidePopover();
  menuTarget = null;
}
menu.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mark]');
  if (!b || !menuTarget) return;
  const t = menuTarget;
  closeMenu();
  setMark(t.id, t.date, b.dataset.mark);
});
// "manual" popover: dışarı dokununca / Esc ile kendimiz kapatıyoruz
document.addEventListener('pointerdown', (e) => {
  if (menu.matches(':popover-open') && !menu.contains(e.target)) closeMenu();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
addEventListener('scroll', closeMenu, { passive: true });
addEventListener('resize', closeMenu);

/* ───────── Ekle / düzenle ───────── */
const editor = $('#editor');
const form = $('#editorForm');
const deleteBtn = $('#deleteBtn');
let editing = null;
let currentGoalType = 'none';
let editorSubtasks = [];
let editorEmoji = '';
const HABIT_EMOJIS = ['🍳', '🥗', '🍊', '🍎', '🥑', '💧', '☕', '🔥', '💪', '🏋️', '🏃', '🚴', '🧘', '🏊', '🚶', '⚽', '🌿', '🪥', '🧴', '🚿', '😴', '💊', '📖', '✍️', '🎓', '💻', '🎨', '🎵', '🌙', '🤲', '🕌', '❤️', '🛡️', '🎯', '⭐', '✅'];

const categoryEditor = $('#categoryEditor');
let categoryEmoji = '📁';
let categoryColor = CUSTOM_TAB_COLORS[0].color;
let editingCategoryId = null;
function renderCategoryChoices() {
  $('#categoryEmojiPreview').textContent = categoryEmoji;
  $('#categoryEmojiChoices').innerHTML = ['📁', ...HABIT_EMOJIS].map(emoji => `<button type="button" class="emoji-picker-option" data-category-emoji="${emoji}" aria-label="Sekme emojisi: ${emoji}" aria-pressed="${categoryEmoji === emoji}">${emoji}</button>`).join('');
  $('#categoryColors').innerHTML = CUSTOM_TAB_COLORS.map(option => `<button type="button" class="category-color-option" data-category-color="${option.color}" aria-label="Renk: ${option.label}" aria-pressed="${categoryColor === option.color}" style="--swatch:${option.color};--swatch-ink:${getAccentInk(option.color)}"><span>${categoryColor === option.color ? '✓' : ''}</span></button>`).join('');
  categoryEditor.style.setProperty('--category-color', categoryColor);
  categoryEditor.style.setProperty('--category-ink', getAccentInk(categoryColor));
}
function openCategoryEditor(id = null) {
  const tab = id ? getTabs().find(tab => tab.id === id) : null;
  editingCategoryId = tab?.id || null;
  $('#categoryForm').reset();
  categoryEmoji = tab?.emoji || '📁'; categoryColor = tab?.color || CUSTOM_TAB_COLORS[0].color;
  $('#categoryName').value = tab?.name || '';
  $('#categoryEditorTitle').textContent = tab ? 'Sekmeyi düzenle' : 'Yeni sekme';
  $('#categoryForm .category-create-btn').textContent = tab ? 'Değişiklikleri kaydet' : 'Sekme ekle';
  $('#categoryEmojiChoices').hidden = true;
  $('#categoryEmojiBtn').setAttribute('aria-expanded', 'false');
  $('#categoryError').hidden = true;
  renderCategoryChoices(); categoryEditor.showModal(); $('#categoryName').focus();
}
$('#categoryEmojiBtn').addEventListener('click', () => {
  const open = $('#categoryEmojiChoices').hidden;
  $('#categoryEmojiChoices').hidden = !open;
  $('#categoryEmojiBtn').setAttribute('aria-expanded', String(open));
});
$('#categoryEmojiChoices').addEventListener('click', event => {
  const button = event.target.closest('[data-category-emoji]');
  if (!button) return;
  categoryEmoji = button.dataset.categoryEmoji;
  renderCategoryChoices();
  $('#categoryEmojiChoices').hidden = true;
  $('#categoryEmojiBtn').setAttribute('aria-expanded', 'false');
});
$('#categoryColors').addEventListener('click', event => {
  const button = event.target.closest('[data-category-color]');
  if (!button) return;
  categoryColor = button.dataset.categoryColor; renderCategoryChoices();
});
$('#categoryName').addEventListener('input', () => { $('#categoryError').hidden = true; });
$('#categoryForm').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#categoryName').value.trim();
  const duplicate = getTabs().some(tab => tab.id !== editingCategoryId && tab.name.trim().toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'));
  if (!name || duplicate) {
    $('#categoryError').textContent = !name ? 'Lütfen bir sekme adı gir.' : 'Bu isimde bir sekme zaten var.';
    $('#categoryError').hidden = false; return;
  }
  const tab = { id: editingCategoryId || `custom-${uid()}`, name, emoji: categoryEmoji, color: categoryColor };
  if (editingCategoryId) {
    if (editingCategoryId.startsWith('custom-')) state.customTabs = state.customTabs.map(item => item.id === editingCategoryId ? tab : item);
    else state.tabEdits = { ...state.tabEdits, [editingCategoryId]: { name, emoji: categoryEmoji, color: categoryColor } };
  } else {
    state.customTabs = [...(state.customTabs || []), tab];
    state.tab = tab.id;
  }
  state.section = 'rutin'; profileOpen = false; reorderMode = false;
  save(); categoryEditor.close(); render();
  $(`#tab-${tab.id}`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
});
$('#cancelCategoryBtn').addEventListener('click', () => categoryEditor.close());
categoryEditor.addEventListener('click', event => { if (event.target === categoryEditor) categoryEditor.close(); });

const categoryActions = $('#categoryActions');
let categoryActionId = null;
function openCategoryActions(id) {
  const tab = getTabs().find(tab => tab.id === id);
  if (!tab) return;
  categoryActionId = id;
  const count = state.habits.filter(habit => habit.tab === id).length;
  $('#categoryActionsTitle').textContent = `${tab.emoji} ${tab.name}`;
  $('#categoryDeleteCount').textContent = `${count} madde ve takip kayıtları`;
  $('#categoryDeleteDescription').textContent = `“${tab.name}” sekmesi, içindeki ${count} madde ve bu maddelerin takip kayıtları silinecek. Bu işlem geri alınamaz.`;
  $('#categoryDeleteMenu').hidden = false;
  $('#categoryDeleteConfirmation').hidden = true;
  $('#categoryDeleteOption').disabled = getTabs().length <= 1;
  $('#categoryLastTabNote').hidden = getTabs().length > 1;
  if (!categoryActions.open) categoryActions.showModal();
}
$('#categoryEditOption').addEventListener('click', () => {
  const id = categoryActionId;
  categoryActions.close();
  openCategoryEditor(id);
});
$('#categoryDeleteOption').addEventListener('click', () => {
  $('#categoryDeleteMenu').hidden = true;
  $('#categoryDeleteConfirmation').hidden = false;
});
categoryActions.querySelectorAll('[data-close-category-actions]').forEach(button => button.addEventListener('click', () => categoryActions.close()));
categoryActions.addEventListener('click', event => { if (event.target === categoryActions) categoryActions.close(); });
categoryActions.addEventListener('close', () => { categoryActionId = null; });
$('#categoryDeleteConfirm').addEventListener('click', () => {
  const id = categoryActionId;
  if (getTabs().length <= 1 || !getTabs().some(tab => tab.id === id)) return;
  const ids = new Set(state.habits.filter(habit => habit.tab === id).map(habit => habit.id));
  state.tabOrder = getTabs().map(tab => tab.id).filter(tabId => tabId !== id);
  state.customTabs = state.customTabs.filter(tab => tab.id !== id);
  if (TABS.some(tab => tab.id === id)) state.deletedTabs = [...new Set([...(state.deletedTabs || []), id])];
  state.habits = state.habits.filter(habit => habit.tab !== id);
  state.marks = Object.fromEntries(Object.entries(state.marks).filter(([habitId]) => !ids.has(habitId)));
  state.progress = Object.fromEntries(Object.entries(state.progress || {}).filter(([habitId]) => !ids.has(habitId)));
  if (state.tab === id) state.tab = getTabs()[0].id;
  reorderMode = false;
  save(); categoryActions.close(); render();
});

function renderEditorEmoji() {
  $('#habitEmojiPreview').textContent = editorEmoji || habitEmoji({ name: form.elements.name.value, tab: editing?.tab || state.tab });
  $('#emojiChoices').innerHTML = HABIT_EMOJIS.map(emoji => `<button type="button" class="emoji-picker-option" data-emoji="${emoji}" aria-label="Emoji: ${emoji}" aria-pressed="${editorEmoji === emoji}">${emoji}</button>`).join('');
}

function closeEmojiPicker() {
  $('#emojiPicker').hidden = true;
  $('#habitEmojiBtn').setAttribute('aria-expanded', 'false');
}

$('#habitEmojiBtn').addEventListener('click', () => {
  const open = $('#emojiPicker').hidden;
  $('#emojiPicker').hidden = !open;
  $('#habitEmojiBtn').setAttribute('aria-expanded', String(open));
});
$('#emojiChoices').addEventListener('click', (event) => {
  const option = event.target.closest('[data-emoji]');
  if (!option) return;
  editorEmoji = option.dataset.emoji;
  renderEditorEmoji();
  closeEmojiPicker();
  $('#habitEmojiBtn').focus();
});
$('#autoEmojiBtn').addEventListener('click', () => {
  editorEmoji = '';
  renderEditorEmoji();
  closeEmojiPicker();
  $('#habitEmojiBtn').focus();
});
form.elements.name.addEventListener('input', renderEditorEmoji);

function setEditorGoalType(type) {
  currentGoalType = type;
  $('#goalTypeRow').querySelectorAll('[data-goal-type]').forEach((b) => {
    b.classList.toggle('active', b.dataset.goalType === type);
    b.setAttribute('aria-pressed', String(b.dataset.goalType === type));
  });
  $('#goalTimerBox').hidden = type !== 'timer';
  $('#goalRepsBox').hidden = type !== 'reps';
  $('#goalAmountBox').hidden = type !== 'amount';
}

function renderEditorSubtasks() {
  $('#subtaskCount').textContent = `(${editorSubtasks.length})`;
  $('#subtasksList').innerHTML = editorSubtasks.map((st) => `
    <div class="subtask-item ${st.done ? 'done' : ''}" data-sub-id="${st.id}">
      <input type="checkbox" data-sub-toggle="${st.id}" ${st.done ? 'checked' : ''}>
      <span>${esc(st.title)}</span>
      <button type="button" class="subtask-del" data-sub-del="${st.id}" aria-label="Sil">✕</button>
    </div>
  `).join('');
}

$('#goalTypeRow').addEventListener('click', (e) => {
  const b = e.target.closest('[data-goal-type]');
  if (b) setEditorGoalType(b.dataset.goalType);
});
$('#timerPresets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-h]');
  if (!b) return;
  form.elements.timerHour.value = b.dataset.h;
  form.elements.timerMin.value = b.dataset.m;
});
$('#repsPresets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-reps]');
  if (b) form.elements.repsTarget.value = b.dataset.reps;
});
$('#unitPresets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-unit]');
  if (b) form.elements.amountUnit.value = b.dataset.unit;
});

function addSubtaskFromInput() {
  const inp = $('#newSubtaskInput');
  const val = inp.value.trim();
  if (!val) return;
  editorSubtasks.push({ id: uid(), title: val, done: false });
  inp.value = '';
  if (editing) { editing.subtasks = [...editorSubtasks]; save(); }
  renderEditorSubtasks();
}
$('#addSubtaskBtn').addEventListener('click', addSubtaskFromInput);
$('#newSubtaskInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addSubtaskFromInput(); }
});
$('#subtasksList').addEventListener('click', (e) => {
  const tog = e.target.closest('[data-sub-toggle]');
  if (tog) {
    const st = editorSubtasks.find((x) => x.id === tog.dataset.subToggle);
    if (st) { st.done = tog.checked; if (editing) { editing.subtasks = [...editorSubtasks]; save(); } renderEditorSubtasks(); }
    return;
  }
  const del = e.target.closest('[data-sub-del]');
  if (del) {
    editorSubtasks = editorSubtasks.filter((x) => x.id !== del.dataset.subDel);
    if (editing) { editing.subtasks = [...editorSubtasks]; save(); }
    renderEditorSubtasks();
  }
});

function openEditor(habit) {
  editing = habit;
  $('#editorTitle').textContent = habit ? 'Maddeyi düzenle' : 'Yeni madde';
  form.elements.name.value = habit?.name ?? '';
  form.elements.detail.value = habit?.detail ?? '';
  editorEmoji = habit?.emoji || '';
  closeEmojiPicker();
  renderEditorEmoji();
  const g = habit?.goal;
  if (g && g.type !== 'none' && g.target > 0) {
    setEditorGoalType(g.type);
    if (g.type === 'timer') {
      const totalMins = Math.max(1, Math.round(g.target / 60));
      form.elements.timerHour.value = Math.floor(totalMins / 60);
      form.elements.timerMin.value = totalMins % 60;
      form.elements.repsTarget.value = '';
      form.elements.amountTarget.value = '';
      form.elements.amountUnit.value = '';
    } else if (g.type === 'reps') {
      form.elements.repsTarget.value = g.target;
      form.elements.timerHour.value = 0;
      form.elements.timerMin.value = 2;
    } else if (g.type === 'amount') {
      form.elements.amountTarget.value = g.target;
      form.elements.amountUnit.value = g.unit || '';
      form.elements.timerHour.value = 0;
      form.elements.timerMin.value = 2;
    }
  } else {
    setEditorGoalType('none');
    form.elements.timerHour.value = 0;
    form.elements.timerMin.value = 2;
    form.elements.repsTarget.value = '';
    form.elements.amountTarget.value = '';
    form.elements.amountUnit.value = '';
  }
  editorSubtasks = habit?.subtasks ? habit.subtasks.map((s) => ({ ...s })) : [];
  $('#newSubtaskInput').value = '';
  renderEditorSubtasks();
  deleteBtn.hidden = !habit;
  deleteBtn.classList.remove('confirm');
  deleteBtn.textContent = 'Sil';
  editor.showModal();
  form.elements.name.focus();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = form.elements.name.value.trim();
  const detail = form.elements.detail.value.trim();
  if (!name) return;
  let goal = undefined;
  if (currentGoalType === 'timer') {
    const h = Math.max(0, parseInt(form.elements.timerHour.value || '0', 10) || 0);
    const m = Math.max(0, parseInt(form.elements.timerMin.value || '0', 10) || 0);
    const total = h * 3600 + m * 60;
    if (total <= 0) { alert('Lütfen geçerli bir sayaç süresi girin.'); return; }
    goal = { type: 'timer', target: total, unit: 'sn' };
  } else if (currentGoalType === 'reps') {
    const r = Math.round(parseFloat(form.elements.repsTarget.value || '0') || 0);
    if (r <= 0) { alert('Lütfen geçerli bir tekrar sayısı girin.'); return; }
    goal = { type: 'reps', target: r, unit: 'tekrar' };
  } else if (currentGoalType === 'amount') {
    const a = parseFloat(form.elements.amountTarget.value || '0') || 0;
    if (a <= 0) { alert('Lütfen geçerli bir hedef miktar girin.'); return; }
    goal = { type: 'amount', target: a, unit: form.elements.amountUnit.value.trim() || 'birim' };
  }
  const pendingSub = $('#newSubtaskInput').value.trim();
  if (pendingSub) editorSubtasks.push({ id: uid(), title: pendingSub, done: false });
  if (editing) {
    editing.name = name;
    editing.detail = detail;
    editing.emoji = editorEmoji || undefined;
    editing.goal = goal;
    editing.subtasks = [...editorSubtasks];
  } else {
    state.habits.push({ id: uid(), tab: state.tab, name, detail, emoji: editorEmoji || undefined, goal, subtasks: [...editorSubtasks] });
  }
  save();
  editor.close();
  render();
});
$('#cancelBtn').addEventListener('click', () => editor.close());
deleteBtn.addEventListener('click', () => {
  if (!deleteBtn.classList.contains('confirm')) {
    deleteBtn.classList.add('confirm');
    deleteBtn.textContent = 'Emin misin? Sil';
    return;
  }
  state.habits = state.habits.filter((h) => h !== editing);
  delete state.marks[editing.id];
  if (state.progress) delete state.progress[editing.id];
  save();
  editor.close();
  render();
});
// Arka plana tıklayınca kapat
editor.addEventListener('click', (e) => { if (e.target === editor) editor.close(); });

/* ───────── Sayaç / Miktar / Tekrar Arayüzü ───────── */
const actionModal = $('#actionModal');
const actionBody = $('#actionBody');
let activeActionHabit = null;
let timerInterval = 0;
let timerRem = 0;
let timerRun = false;

function stopTimerInterval() {
  clearInterval(timerInterval);
  timerInterval = 0;
  timerRun = false;
}

function getQuickStepsWeb(goal) {
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

function renderActionModal() {
  if (!activeActionHabit || !activeActionHabit.goal) return;
  const h = activeActionHabit;
  const g = h.goal;
  const { key: todayKey } = todayInfo();

  if (g.type === 'timer') {
    const targetSec = g.target || 1;
    const elapsed = Math.max(0, targetSec - timerRem);
    const pct = Math.min(100, Math.round((elapsed / targetSec) * 100));
    const done = timerRem <= 0;
    actionBody.innerHTML = `
      <h2 id="actionTitle">${esc(h.name)}</h2>
      <div class="timer-digits">${fmtDuration(timerRem)}</div>
      <p class="timer-sub">${done ? '🎉 Süre tamamlandı!' : timerRun ? 'Sayaç çalışıyor...' : 'Hedef süre: ' + esc(fmtTimerReadable(targetSec))}</p>
      <div class="action-bar"><span style="width:${pct}%"></span></div>
      <div class="preset-chips" style="justify-content:center;margin-bottom:12px">
        <button type="button" class="chip" data-t-adj="-15">-15 sn</button>
        <button type="button" class="chip" data-t-adj="15">+15 sn</button>
        <button type="button" class="chip" data-t-adj="60">+1 dk</button>
      </div>
      <div class="editor-actions">
        <button type="button" class="primary" style="flex:1" data-t-toggle>${timerRun ? '⏸ Duraklat' : done ? '↺ Tekrar Başlat' : timerRem < targetSec ? '▶ Devam Et' : '▶ Başlat'}</button>
        <button type="button" class="ghost" data-t-reset>↺ Sıfırla</button>
      </div>
      <div class="editor-actions">
        <button type="button" class="primary" style="flex:1;background:var(--green);color:#fff" data-t-done>✓ Tamamlandı İşaretle</button>
        <button type="button" class="ghost" data-action-close>Kapat</button>
      </div>
    `;
  } else {
    const targetVal = g.target || 1;
    const curVal = getProgress(h.id, todayKey);
    const unit = g.type === 'reps' ? 'tekrar' : (g.unit || '');
    const pct = Math.min(100, Math.round((curVal / targetVal) * 100));
    const steps = getQuickStepsWeb(g);
    actionBody.innerHTML = `
      <h2 id="actionTitle">${esc(h.name)}</h2>
      <div class="amount-big">${curVal} <small>/ ${targetVal} ${esc(unit)} (%${pct})</small></div>
      <div class="action-bar"><span style="width:${pct}%"></span></div>
      <div class="preset-chips" style="margin-bottom:12px">
        <button type="button" class="chip" data-a-step="${-steps[0]}">-${steps[0]}</button>
        ${steps.map((st) => `<button type="button" class="chip active" data-a-step="${st}">+${st} ${esc(unit)}</button>`).join('')}
      </div>
      <div class="subtask-add-row" style="margin-bottom:12px">
        <input type="number" step="any" id="customAmountInput" placeholder="Özel miktar (${esc(unit)})">
        <button type="button" class="primary" data-a-custom>＋ Ekle</button>
      </div>
      <div class="editor-actions">
        <button type="button" class="ghost" data-a-reset>↺ Sıfırla</button>
        <button type="button" class="primary" style="flex:1;background:var(--green);color:#fff" data-a-complete>✓ Hedefi Tamamla</button>
        <button type="button" class="ghost" data-action-close>Kapat</button>
      </div>
    `;
  }
}

function openActionModal(habit) {
  stopTimerInterval();
  activeActionHabit = habit;
  const { key: todayKey } = todayInfo();
  if (habit.goal?.type === 'timer') {
    const doneSec = getProgress(habit.id, todayKey);
    timerRem = doneSec > 0 && doneSec < habit.goal.target ? habit.goal.target - doneSec : habit.goal.target;
  }
  renderActionModal();
  actionModal.showModal();
}

actionBody.addEventListener('click', (e) => {
  if (!activeActionHabit || !activeActionHabit.goal) return;
  const h = activeActionHabit;
  const g = h.goal;
  const { key: todayKey } = todayInfo();

  if (e.target.closest('[data-action-close]')) {
    stopTimerInterval();
    actionModal.close();
    return;
  }
  const adj = e.target.closest('[data-t-adj]');
  if (adj) {
    timerRem = Math.max(0, timerRem + Number(adj.dataset.tAdj));
    renderActionModal();
    return;
  }
  if (e.target.closest('[data-t-toggle]')) {
    if (timerRun) {
      stopTimerInterval();
    } else {
      if (timerRem <= 0) timerRem = g.target;
      timerRun = true;
      timerInterval = setInterval(() => {
        if (timerRem <= 1) {
          stopTimerInterval();
          timerRem = 0;
          navigator.vibrate?.([60, 40, 80]);
          setProgressAndAutoMark(h, todayKey, g.target);
          renderActionModal();
          return;
        }
        timerRem--;
        setProgressAndAutoMark(h, todayKey, Math.max(0, g.target - timerRem));
        renderActionModal();
      }, 1000);
    }
    renderActionModal();
    return;
  }
  if (e.target.closest('[data-t-reset]')) {
    stopTimerInterval();
    timerRem = g.target;
    setProgressAndAutoMark(h, todayKey, 0);
    renderActionModal();
    return;
  }
  if (e.target.closest('[data-t-done]')) {
    stopTimerInterval();
    timerRem = 0;
    setProgressAndAutoMark(h, todayKey, g.target);
    actionModal.close();
    return;
  }
  const stepBtn = e.target.closest('[data-a-step]');
  if (stepBtn) {
    const cur = getProgress(h.id, todayKey);
    setProgressAndAutoMark(h, todayKey, cur + Number(stepBtn.dataset.aStep));
    renderActionModal();
    return;
  }
  if (e.target.closest('[data-a-custom]')) {
    const inp = $('#customAmountInput');
    const val = parseFloat(inp?.value || '0') || 0;
    if (val > 0) {
      const cur = getProgress(h.id, todayKey);
      setProgressAndAutoMark(h, todayKey, cur + val);
      renderActionModal();
    }
    return;
  }
  if (e.target.closest('[data-a-reset]')) {
    setProgressAndAutoMark(h, todayKey, 0);
    renderActionModal();
    return;
  }
  if (e.target.closest('[data-a-complete]')) {
    setProgressAndAutoMark(h, todayKey, g.target);
    actionModal.close();
  }
});
actionModal.addEventListener('close', stopTimerInterval);
actionModal.addEventListener('click', (e) => { if (e.target === actionModal) { stopTimerInterval(); actionModal.close(); } });

/* ───────── Görev Ekle / Düzenle Penceresi ───────── */
const taskEditor = $('#taskEditor');
const taskForm = $('#taskEditorForm');
const deleteTaskBtn = $('#deleteTaskBtn');
const taskStarToggleBtn = $('#taskStarToggleBtn');
const TR_MONTHS_WEB = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const TR_WEEKDAYS_WEB = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const TR_WEEKDAYS_SHORT_WEB = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const WEB_WHEEL_ITEM_H = 40;
const firedWebTaskNotifs = new Set();

function requestWebNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function getTaskDueDateObjWeb(dueStr) {
  if (!dueStr || !dueStr.trim()) return null;
  const s = dueStr.trim();
  const tm = s.match(/(\d{1,2}):(\d{2})/);
  const h = tm ? Math.min(23, Math.max(0, parseInt(tm[1], 10))) : 9;
  const min = tm ? Math.min(59, Math.max(0, parseInt(tm[2], 10))) : 0;
  const n = new Date();
  for (let i = 0; i < TR_MONTHS_WEB.length; i++) {
    const rx = new RegExp(`(\\d{1,2})\\s+${TR_MONTHS_WEB[i]}(?:\\s+(\\d{4}))?`, 'i');
    const m = s.match(rx);
    if (m) {
      const y = m[2] ? parseInt(m[2], 10) : n.getFullYear();
      const d = Math.max(1, Math.min(31, parseInt(m[1], 10)));
      const dt = new Date(y, i, d, h, min, 0, 0);
      if (!isNaN(dt.getTime())) return dt;
    }
  }
  return null;
}

function checkDueTasksWeb() {
  const nowMs = Date.now();
  for (const t of state.tasks || []) {
    if (t.done || !t.dueDate) continue;
    const dt = getTaskDueDateObjWeb(t.dueDate);
    if (!dt) continue;
    const diff = nowMs - dt.getTime();
    const key = `${t.id}:${t.dueDate}`;
    if (diff >= 0 && diff < 60000 && !firedWebTaskNotifs.has(key)) {
      firedWebTaskNotifs.add(key);
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`🔔 Görev Zamanı: ${t.title}`, {
            body: t.detail ? `${t.detail} (${t.dueDate})` : `📅 ${t.dueDate} için planlanan görevinizin zamanı geldi!`,
          });
        } catch {}
      }
    }
  }
}
setInterval(checkDueTasksWeb, 15000);

let editingTask = null;
let taskStarred = false;
let taskSubtasks = [];
let dtPickerState = {
  viewY: new Date().getFullYear(),
  viewM: new Date().getMonth(),
  selY: new Date().getFullYear(),
  selM: new Date().getMonth(),
  selD: new Date().getDate(),
  hasTime: true,
  h: 12,
  min: 0,
};

function formatTaskDueWeb(y, m, d, hasTime, h, min) {
  const datePart = `${d} ${TR_MONTHS_WEB[m]} ${y}`;
  return hasTime ? `${datePart} · ${pad(h)}:${pad(min)}` : datePart;
}

function parseTaskDueWeb(dueStr) {
  const n = new Date();
  const def = { y: n.getFullYear(), m: n.getMonth(), d: n.getDate(), hasTime: true, h: 12, min: 0 };
  if (!dueStr || !dueStr.trim()) return def;
  const s = dueStr.trim();
  const tm = s.match(/(\d{1,2}):(\d{2})/);
  const hasTime = !!tm;
  const h = tm ? Math.min(23, Math.max(0, parseInt(tm[1], 10))) : 12;
  const min = tm ? Math.min(59, Math.max(0, parseInt(tm[2], 10))) : 0;
  for (let i = 0; i < TR_MONTHS_WEB.length; i++) {
    const rx = new RegExp(`(\\d{1,2})\\s+${TR_MONTHS_WEB[i]}(?:\\s+(\\d{4}))?`, 'i');
    const m = s.match(rx);
    if (m) {
      return { y: m[2] ? parseInt(m[2], 10) : n.getFullYear(), m: i, d: Math.max(1, Math.min(31, parseInt(m[1], 10))), hasTime, h, min };
    }
  }
  return { ...def, hasTime, h, min };
}

function updateTaskDueUI(val) {
  const v = (val || '').trim();
  if (taskForm?.elements?.taskDueDate) taskForm.elements.taskDueDate.value = v;
  const lbl = $('#taskDueDateLabel');
  const btn = $('#openTaskDatePickerBtn');
  const badge = $('#taskDueDateActionBadge');
  const clr = $('#clearTaskDueDateBtn');
  if (lbl) {
    lbl.textContent = v || 'Tarih ve saat seçmek için dokun...';
    lbl.classList.toggle('muted', !v);
  }
  if (btn) btn.classList.toggle('has-value', !!v);
  if (badge) badge.textContent = v ? 'Değiştir' : '🕒 Seç';
  if (clr) clr.hidden = !v;
}

function showTaskDatePicker(open) {
  const mainV = $('#taskEditorMainView');
  const pickV = $('#taskDatePickerView');
  if (mainV) mainV.hidden = open;
  if (pickV) pickV.hidden = !open;
  if (open) renderTaskDatePickerBody();
}

function updateDatePickerPreviewText() {
  const banner = $('#dtPreviewBanner');
  if (!banner) return;
  const { selY, selM, selD, hasTime, h, min } = dtPickerState;
  const wdName = TR_WEEKDAYS_WEB[new Date(selY, selM, selD).getDay()];
  const previewStr = `${formatTaskDueWeb(selY, selM, selD, hasTime, h, min)} (${wdName})`;
  banner.textContent = `🔔 ${previewStr}`;
}

function syncWheelActiveClasses(wheelEl, selectedVal) {
  if (!wheelEl) return;
  wheelEl.querySelectorAll('.dt-wheel-item').forEach((btn) => {
    const val = Number(btn.dataset.val);
    btn.classList.toggle('active', val === selectedVal);
  });
}

function renderTaskDatePickerBody() {
  const body = $('#taskDatePickerBody');
  if (!body) return;
  const { viewY, viewM, selY, selM, selD, hasTime, h, min } = dtPickerState;
  const pDim = daysInMonth(viewY, viewM);
  const firstOff = (new Date(viewY, viewM, 1).getDay() + 6) % 7;
  const { now } = todayInfo();
  let cellsHTML = '';
  for (let i = 0; i < firstOff; i++) cellsHTML += `<span></span>`;
  for (let d = 1; d <= pDim; d++) {
    const isSel = selY === viewY && selM === viewM && selD === d;
    const isTod = now.getFullYear() === viewY && now.getMonth() === viewM && now.getDate() === d;
    cellsHTML += `<button type="button" class="dt-day-btn ${isSel ? 'selected' : ''} ${isTod && !isSel ? 'today' : ''}" data-dt-day="${d}">${d}</button>`;
  }
  const wdName = TR_WEEKDAYS_WEB[new Date(selY, selM, selD).getDay()];
  const previewStr = `${formatTaskDueWeb(selY, selM, selD, hasTime, h, min)} (${wdName})`;

  let hoursHTML = '';
  for (let i = 0; i < 24; i++) {
    hoursHTML += `<button type="button" class="dt-wheel-item ${i === h ? 'active' : ''}" data-wheel-h="${i}" data-val="${i}">${pad(i)}</button>`;
  }
  let minsHTML = '';
  for (let i = 0; i < 60; i++) {
    minsHTML += `<button type="button" class="dt-wheel-item ${i === min ? 'active' : ''}" data-wheel-m="${i}" data-val="${i}">${pad(i)}</button>`;
  }

  body.innerHTML = `
    <div class="dt-box">
      <div class="dt-cal-head">
        <button type="button" class="dt-cal-nav" data-dt-month="-1" aria-label="Önceki ay">‹</button>
        <b>${TR_MONTHS_WEB[viewM]} ${viewY}</b>
        <button type="button" class="dt-cal-nav" data-dt-month="1" aria-label="Sonraki ay">›</button>
      </div>
      <div class="dt-weekdays">${TR_WEEKDAYS_SHORT_WEB.map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="dt-days-grid">${cellsHTML}</div>
    </div>

    <div class="dt-box">
      <div class="dt-time-head">
        <b style="font-size:.9rem">🕒 Saat Seçimi</b>
        <button type="button" class="chip ${hasTime ? 'active' : ''}" data-dt-toggle-time style="border:1px solid ${hasTime ? '#767676' : '#484848'}">
          ${hasTime ? '✓ Saat Açık' : 'Saat Kapalı'}
        </button>
      </div>
      ${hasTime ? `
        <div class="dt-wheel-row">
          <div class="dt-wheel-col">
            <small>SAAT</small>
            <div class="dt-wheel-box">
              <div class="dt-wheel-highlight"></div>
              <div class="dt-wheel-scroll" id="dtHourWheel">${hoursHTML}</div>
            </div>
          </div>
          <b class="dt-wheel-colon">:</b>
          <div class="dt-wheel-col">
            <small>DAKİKA</small>
            <div class="dt-wheel-box">
              <div class="dt-wheel-highlight"></div>
              <div class="dt-wheel-scroll" id="dtMinWheel">${minsHTML}</div>
            </div>
          </div>
        </div>
      ` : ''}
    </div>

    <div class="dt-preview-banner" id="dtPreviewBanner">🔔 ${esc(previewStr)}</div>
  `;

  if (hasTime) {
    const hWheel = $('#dtHourWheel');
    const mWheel = $('#dtMinWheel');
    if (hWheel) {
      hWheel.scrollTop = h * WEB_WHEEL_ITEM_H;
      hWheel.addEventListener('scroll', () => {
        const idx = Math.max(0, Math.min(23, Math.round(hWheel.scrollTop / WEB_WHEEL_ITEM_H)));
        if (idx !== dtPickerState.h) {
          dtPickerState.h = idx;
          syncWheelActiveClasses(hWheel, idx);
          updateDatePickerPreviewText();
        }
      }, { passive: true });
    }
    if (mWheel) {
      mWheel.scrollTop = min * WEB_WHEEL_ITEM_H;
      mWheel.addEventListener('scroll', () => {
        const idx = Math.max(0, Math.min(59, Math.round(mWheel.scrollTop / WEB_WHEEL_ITEM_H)));
        if (idx !== dtPickerState.min) {
          dtPickerState.min = idx;
          syncWheelActiveClasses(mWheel, idx);
          updateDatePickerPreviewText();
        }
      }, { passive: true });
    }
  }
}

$('#openTaskDatePickerBtn')?.addEventListener('click', () => {
  const p = parseTaskDueWeb(taskForm?.elements?.taskDueDate?.value || '');
  dtPickerState = { viewY: p.y, viewM: p.m, selY: p.y, selM: p.m, selD: p.d, hasTime: p.hasTime, h: p.h, min: p.min };
  showTaskDatePicker(true);
});
$('#clearTaskDueDateBtn')?.addEventListener('click', () => updateTaskDueUI(''));
$('#closeDatePickerBackBtn')?.addEventListener('click', () => showTaskDatePicker(false));
$('#cancelDatePickerBtn')?.addEventListener('click', () => showTaskDatePicker(false));
$('#clearDatePickerBtn')?.addEventListener('click', () => {
  updateTaskDueUI('');
  showTaskDatePicker(false);
});
$('#applyDatePickerBtn')?.addEventListener('click', () => {
  requestWebNotifPermission();
  const { selY, selM, selD, hasTime, h, min } = dtPickerState;
  updateTaskDueUI(formatTaskDueWeb(selY, selM, selD, hasTime, h, min));
  showTaskDatePicker(false);
});
$('#taskDatePickerBody')?.addEventListener('click', (e) => {
  const mBtn = e.target.closest('[data-dt-month]');
  if (mBtn) {
    const d = new Date(dtPickerState.viewY, dtPickerState.viewM + Number(mBtn.dataset.dtMonth), 1);
    dtPickerState.viewY = d.getFullYear();
    dtPickerState.viewM = d.getMonth();
    renderTaskDatePickerBody();
    return;
  }
  const dBtn = e.target.closest('[data-dt-day]');
  if (dBtn) {
    dtPickerState.selY = dtPickerState.viewY;
    dtPickerState.selM = dtPickerState.viewM;
    dtPickerState.selD = Number(dBtn.dataset.dtDay);
    renderTaskDatePickerBody();
    return;
  }
  if (e.target.closest('[data-dt-toggle-time]')) {
    dtPickerState.hasTime = !dtPickerState.hasTime;
    renderTaskDatePickerBody();
    return;
  }
  const whBtn = e.target.closest('[data-wheel-h]');
  if (whBtn) {
    const val = Number(whBtn.dataset.wheelH);
    dtPickerState.h = val;
    const hWheel = $('#dtHourWheel');
    if (hWheel) hWheel.scrollTo({ top: val * WEB_WHEEL_ITEM_H, behavior: 'smooth' });
    syncWheelActiveClasses(hWheel, val);
    updateDatePickerPreviewText();
    return;
  }
  const wmBtn = e.target.closest('[data-wheel-m]');
  if (wmBtn) {
    const val = Number(wmBtn.dataset.wheelM);
    dtPickerState.min = val;
    const mWheel = $('#dtMinWheel');
    if (mWheel) mWheel.scrollTo({ top: val * WEB_WHEEL_ITEM_H, behavior: 'smooth' });
    syncWheelActiveClasses(mWheel, val);
    updateDatePickerPreviewText();
  }
});

function updateTaskStarBtn() {
  if (!taskStarToggleBtn) return;
  taskStarToggleBtn.textContent = taskStarred ? '★ Önemli' : '☆ Yıldızla';
  taskStarToggleBtn.classList.toggle('active', taskStarred);
}
taskStarToggleBtn?.addEventListener('click', () => {
  taskStarred = !taskStarred;
  updateTaskStarBtn();
});
function renderTaskEditorSubtasks() {
  if (!$('#taskSubtaskCount')) return;
  $('#taskSubtaskCount').textContent = `(${taskSubtasks.length})`;
  $('#taskSubtasksList').innerHTML = taskSubtasks.map((st) => `
    <div class="subtask-item ${st.done ? 'done' : ''}" data-tsub-id="${st.id}">
      <input type="checkbox" data-tsub-toggle="${st.id}" ${st.done ? 'checked' : ''}>
      <span>${esc(st.title)}</span>
      <button type="button" class="subtask-del" data-tsub-del="${st.id}" aria-label="Sil">✕</button>
    </div>
  `).join('');
}
function addTaskSubtaskFromInput() {
  const inp = $('#newTaskSubtaskInput');
  const val = (inp?.value || '').trim();
  if (!val) return;
  taskSubtasks.push({ id: uid(), title: val, done: false });
  inp.value = '';
  if (editingTask) { editingTask.subtasks = [...taskSubtasks]; save(); }
  renderTaskEditorSubtasks();
}
$('#addTaskSubtaskBtn')?.addEventListener('click', addTaskSubtaskFromInput);
$('#newTaskSubtaskInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); addTaskSubtaskFromInput(); }
});
$('#taskSubtasksList')?.addEventListener('click', (e) => {
  const tog = e.target.closest('[data-tsub-toggle]');
  if (tog) {
    const st = taskSubtasks.find((x) => x.id === tog.dataset.tsubToggle);
    if (st) { st.done = tog.checked; if (editingTask) { editingTask.subtasks = [...taskSubtasks]; save(); } renderTaskEditorSubtasks(); }
    return;
  }
  const del = e.target.closest('[data-tsub-del]');
  if (del) {
    taskSubtasks = taskSubtasks.filter((x) => x.id !== del.dataset.tsubDel);
    if (editingTask) { editingTask.subtasks = [...taskSubtasks]; save(); }
    renderTaskEditorSubtasks();
  }
});

function openTaskEditor(task) {
  if (!taskEditor || !taskForm) return;
  editingTask = task;
  showTaskDatePicker(false);
  $('#taskEditorTitle').textContent = task ? 'Görevi düzenle' : 'Yeni görev';
  taskForm.elements.taskTitle.value = task?.title ?? '';
  taskForm.elements.taskDetail.value = task?.detail ?? '';
  updateTaskDueUI(task?.dueDate ?? '');
  taskStarred = task ? !!task.starred : taskFilter === 'starred';
  updateTaskStarBtn();
  taskSubtasks = task?.subtasks ? task.subtasks.map((s) => ({ ...s })) : [];
  $('#newTaskSubtaskInput').value = '';
  renderTaskEditorSubtasks();
  deleteTaskBtn.hidden = !task;
  deleteTaskBtn.classList.remove('confirm');
  deleteTaskBtn.textContent = 'Sil';
  taskEditor.showModal();
  taskForm.elements.taskTitle.focus();
}

taskForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = taskForm.elements.taskTitle.value.trim();
  const detail = taskForm.elements.taskDetail.value.trim();
  const dueDate = taskForm.elements.taskDueDate.value.trim();
  if (!title) return;
  const pendingSub = ($('#newTaskSubtaskInput')?.value || '').trim();
  if (pendingSub) taskSubtasks.push({ id: uid(), title: pendingSub, done: false });
  state.tasks ||= [];
  if (editingTask) {
    editingTask.title = title;
    editingTask.detail = detail;
    editingTask.dueDate = dueDate;
    editingTask.starred = taskStarred;
    editingTask.subtasks = [...taskSubtasks];
  } else {
    state.tasks.unshift({
      id: uid(),
      title,
      detail,
      dueDate,
      starred: taskStarred,
      done: false,
      createdAt: nowStampTR(),
      subtasks: [...taskSubtasks],
    });
  }
  save();
  taskEditor.close();
  render();
});
$('#cancelTaskBtn')?.addEventListener('click', () => taskEditor.close());
deleteTaskBtn?.addEventListener('click', () => {
  if (!deleteTaskBtn.classList.contains('confirm')) {
    deleteTaskBtn.classList.add('confirm');
    deleteTaskBtn.textContent = 'Emin misin? Sil';
    return;
  }
  state.tasks = (state.tasks || []).filter((t) => t !== editingTask);
  save();
  taskEditor.close();
  render();
});
taskEditor?.addEventListener('click', (e) => { if (e.target === taskEditor) taskEditor.close(); });

/* ───────── Yedekle / geri yükle ───────── */
function exportBackup() {
  state.tasks ||= [];
  state.profile = { ...(state.profile || { firstName: '', lastName: '' }), lastBackupAt: nowStampTR() };
  save();
  const exportPayload = {
    ...state,
    habits: state.habits || [],
    marks: state.marks || {},
    progress: state.progress || {},
    tasks: state.tasks || [],
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gunluk-plan-${keyOf(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  if (profileOpen) render();
}
$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const s = JSON.parse(await file.text());
    if ((!Array.isArray(s.habits) && !Array.isArray(s.tasks)) || (s.marks !== undefined && typeof s.marks !== 'object')) throw new Error('format');
    if (!confirm('Mevcut verilerin yerine yedek yüklensin mi?')) return;
    const importedCustomTabs = normalizeCustomTabs(s.customTabs);
    Object.assign(state, {
      section: s.section === 'gorevler' || s.section === 'rutin' ? s.section : (state.section || 'rutin'),
      habits: Array.isArray(s.habits) ? s.habits : (state.habits || []),
      marks: s.marks && typeof s.marks === 'object' ? s.marks : (state.marks || {}),
      progress: s.progress && typeof s.progress === 'object' ? s.progress : {},
      tasks: Array.isArray(s.tasks) ? s.tasks : [],
      customTabs: importedCustomTabs,
      tabOrder: Array.isArray(s.tabOrder) ? s.tabOrder : [],
      deletedTabs: Array.isArray(s.deletedTabs) ? s.deletedTabs.filter(id => TABS.some(tab => tab.id === id)) : [],
      tabEdits: s.tabEdits && typeof s.tabEdits === 'object' ? s.tabEdits : {},
      tab: [...TABS, ...importedCustomTabs].some((t) => t.id === s.tab) ? s.tab : TABS[0].id,
      profile: {
        firstName: typeof s.profile?.firstName === 'string' ? s.profile.firstName : (state.profile?.firstName || ''),
        lastName: typeof s.profile?.lastName === 'string' ? s.profile.lastName : (state.profile?.lastName || ''),
        lastBackupAt: s.profile?.lastBackupAt || state.profile?.lastBackupAt,
        lastRestoreAt: nowStampTR(),
      },
    });
    if (!getTabs().some(tab => tab.id === state.tab)) state.tab = getTabs()[0].id;
    save();
    render();
  } catch {
    alert('Geçersiz yedek dosyası.');
  }
});

/* ───────── Gün değişimi ───────── */
let lastDay = keyOf(new Date());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const k = keyOf(new Date());
  if (k !== lastDay) { lastDay = k; const n = new Date(); view = { y: n.getFullYear(), m: n.getMonth() }; }
  render();
});

render();
