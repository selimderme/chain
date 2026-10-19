'use strict';

/* ───────── Sabitler ───────── */
const STORAGE_KEY = 'gunluk-plan:v1';
const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE = 10;

const TABS = [
  { id: 'beslenme', name: 'Beslenme',          emoji: '🥗', color: '#f97316', motto: 'Vücuduna iyi bak, o da sana iyi baksın.' },
  { id: 'egzersiz', name: 'Egzersiz',          emoji: '💪', color: '#d4ff00', motto: 'Zinciri kırma. Bugün de çalış.' },
  { id: 'bakim',    name: 'Kişisel Bakım',     emoji: '🧴', color: '#ec4899', motto: 'Kendine nazik ol, kendini şımart.' },
  { id: 'ogrenme',  name: 'Öğrenme ve Gelişim', emoji: '📚', color: '#1e40af', motto: 'Her gün biraz daha bilge.' },
  { id: 'ibadet',   name: 'İbadet',            emoji: '🕌', color: '#b8860b', motto: 'Kalbine huzur, gününe bereket.' },
  { id: 'kotu-aliskanliklar', name: 'Kötü Alışkanlıklar', emoji: '🚫', color: '#ef4444', motto: 'Kötü alışkanlıkları bırak, hayatına yer aç.' },
];

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
if (!TABS.some((t) => t.id === state.tab)) state.tab = TABS[0].id;
save();
navigator.storage?.persist?.().catch(() => {});

let view = (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; })();

let reorderMode = false;
const getMark = (id, key) => state.marks[id]?.[key] || '';
function setMark(id, key, val) {
  if (val) (state.marks[id] ||= {})[key] = val;
  else if (state.marks[id]) { delete state.marks[id][key]; if (!Object.keys(state.marks[id]).length) delete state.marks[id]; }
  save();
  render();
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
  const tab = TABS.find((t) => t.id === state.tab);
  document.body.dataset.tab = tab.id;
  document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#fff';
  renderTabs();
  renderPanel(tab);
}

function todayInfo() {
  const now = new Date();
  return { now, key: keyOf(now) };
}

function renderTabs() {
  const { key } = todayInfo();
  $('#tabs').innerHTML = TABS.map((t) => {
    const hs = state.habits.filter((h) => h.tab === t.id);
    const done = hs.filter((h) => getMark(h.id, key) === 'g').length;
    const sel = t.id === state.tab;
    return `<button type="button" role="tab" class="tab" id="tab-${t.id}" data-tab="${t.id}" aria-selected="${sel}" tabindex="${sel ? 0 : -1}" style="--tab-color:${t.color}">
      <span class="t-emoji" aria-hidden="true">${t.emoji}</span>
      <span>${esc(t.name)}</span>
      <span class="t-count">${done}/${hs.length}</span>
    </button>`;
  }).join('');
  $('#panel').setAttribute('aria-labelledby', `tab-${state.tab}`);
}

function cellHTML(h, y, m, d, extra = '', inner = null) {
  const key = dateKey(y, m, d);
  const { key: today } = todayInfo();
  const mark = getMark(h.id, key);
  const future = key > today;
  const dayName = fmtDay.format(new Date(y, m, d));
  const status = mark ? MARKS[mark].label : 'İşaretsiz';
  return `<button type="button" class="cell ${mark ? 's-' + mark : ''} ${key === today ? 'today' : ''} ${extra}" data-cell data-id="${h.id}" data-date="${key}" ${future ? 'disabled' : ''}
    aria-label="${esc(h.name)}, ${dayName}: ${status}" title="${dayName}">${inner ?? d}</button>`;
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
    return `<article class="card" data-habit="${h.id}">
      <div class="card-head">
        <div class="card-info">
          <div class="card-title-group">
            <h4>${esc(h.name)}</h4>
            ${h.detail ? `<span class="detail">${esc(h.detail)}</span>` : ''}
          </div>
          <div class="card-stats">
            <span>🔗 Zincir: <b>${cur}</b> gün</span>
            <span>🏆 En uzun: <b>${best}</b></span>
            <span>📅 Bu ay: <b>${monthDone}/${dim}</b></span>
          </div>
        </div>
        <div class="card-actions">
          <button type="button" class="edit-btn" data-edit="${h.id}" aria-label="${esc(h.name)} maddesini düzenle" title="Düzenle">✎</button>
          ${cellHTML(h, now.getFullYear(), now.getMonth(), now.getDate(), 'today-btn', '<small>Bugün</small>')}
        </div>
      </div>
      <div class="chain" role="group" aria-label="${esc(h.name)} aylık zincir" style="--days: ${dim}">${cells}</div>
    </article>`;
  }).join('');

  $('#panel').innerHTML = `
    <section class="hero">
      <span class="emoji" aria-hidden="true" style="animation-delay:-${Date.now() % 3200}ms">${tab.emoji}</span>
      <div>
        <h2>${esc(tab.name)}</h2>
        <p class="motto">${esc(tab.motto)}</p>
      </div>
      <div class="progress">
        <span>Bugün ${doneToday}/${habits.length}</span>
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
        <span>%${pct}</span>
      </div>
    </section>
    <div class="toolbar">
      <div class="month">
        <button type="button" class="icon-btn" data-month="-1" aria-label="Önceki ay">‹</button>
        <h3>${fmtMonth.format(new Date(y, m, 1))}</h3>
        <button type="button" class="icon-btn" data-month="1" aria-label="Sonraki ay">›</button>
      </div>
      ${isCurrentMonth ? '' : '<button type="button" class="pill" data-month="today">Bu aya dön</button>'}
      <span class="spacer"></span>
      ${habits.length > 1 || reorderMode ? `<button type="button" class="${reorderMode ? 'primary' : 'pill'}" data-reorder aria-pressed="${reorderMode}">${reorderMode ? '✓ Bitti' : '⇅ Sırala'}</button>` : ''}
      ${reorderMode ? '' : '<button type="button" class="primary" data-add>＋ Madde ekle</button>'}
    </div>
    <div class="list ${reorderMode ? 'reordering' : ''}">${cards || '<p class="empty">Bu sekmede henüz madde yok. “Madde ekle” ile başla.</p>'}</div>`;
}

/* ───────── Sekme & ay gezinme ───────── */
$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  if (state.tab !== b.dataset.tab) {
    state.tab = b.dataset.tab;
    reorderMode = false;
    save();
    render();
    panel.classList.remove('enter');
    void panel.offsetWidth;
    panel.classList.add('enter');
  }
  $(`#tab-${state.tab}`)?.scrollIntoView({ inline: 'center', block: 'nearest' });
});
$('#tabs').addEventListener('keydown', (e) => {
  const i = TABS.findIndex((t) => t.id === state.tab);
  let n = null;
  if (e.key === 'ArrowRight') n = (i + 1) % TABS.length;
  else if (e.key === 'ArrowLeft') n = (i - 1 + TABS.length) % TABS.length;
  if (n === null) return;
  e.preventDefault();
  state.tab = TABS[n].id; save(); render();
  $(`#tab-${state.tab}`)?.focus();
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
  const cell = e.target.closest('[data-cell]');
  if (!cell || cell.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
  press = { timer: 0, fired: false, x: e.clientX, y: e.clientY, el: cell };
  cell.classList.add('pressing');
  press.timer = setTimeout(() => {
    press.fired = true;
    cell.classList.remove('pressing');
    navigator.vibrate?.(25);
    openMenu(cell);
  }, LONG_PRESS_MS);
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
  if (!cell) return;
  e.preventDefault();
  if (cell.disabled) return;
  if (!press.fired) openMenu(cell);
});

panel.addEventListener('click', (e) => {
  const cell = e.target.closest('[data-cell]');
  if (cell) {
    if (press.fired) { press.fired = false; return; } // uzun basma sonrası gelen click'i yoksay
    if (cell.disabled) return;
    const { id, date } = cell.dataset;
    setMark(id, date, getMark(id, date) ? '' : 'g');
    return;
  }
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
  }
});

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

  const r = cell.getBoundingClientRect();
  const w = menu.offsetWidth, hgt = menu.offsetHeight;
  let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
  let top = r.bottom + 8;
  if (top + hgt > innerHeight - 8) top = Math.max(8, r.top - hgt - 8);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
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

function openEditor(habit) {
  editing = habit;
  $('#editorTitle').textContent = habit ? 'Maddeyi düzenle' : 'Yeni madde';
  form.elements.name.value = habit?.name ?? '';
  form.elements.detail.value = habit?.detail ?? '';
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
  if (editing) { editing.name = name; editing.detail = detail; }
  else state.habits.push({ id: uid(), tab: state.tab, name, detail });
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
  save();
  editor.close();
  render();
});
// Arka plana tıklayınca kapat
editor.addEventListener('click', (e) => { if (e.target === editor) editor.close(); });

/* ───────── Yedekle / geri yükle ───────── */
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gunluk-plan-${keyOf(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#importBtn').addEventListener('click', () => $('#importFile').click());
$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const s = JSON.parse(await file.text());
    if (!Array.isArray(s.habits) || typeof s.marks !== 'object') throw new Error('format');
    if (!confirm('Mevcut verilerin yerine yedek yüklensin mi?')) return;
    Object.assign(state, { habits: s.habits, marks: s.marks, tab: TABS.some((t) => t.id === s.tab) ? s.tab : TABS[0].id });
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
