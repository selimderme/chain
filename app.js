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
state.progress ||= {};
state.profile ||= { firstName: '', lastName: '' };
if (!TABS.some((t) => t.id === state.tab)) state.tab = TABS[0].id;
save();
navigator.storage?.persist?.().catch(() => {});

let view = (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; })();

let reorderMode = false;
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
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m > 0 && r > 0) return `${m} dk ${r} sn`;
  return m > 0 ? `${m} dk` : `${r} sn`;
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
  const initials = getInitials(state.profile?.firstName, state.profile?.lastName);
  const pBtn = $('#profileBtn');
  if (pBtn) {
    pBtn.textContent = initials || '👤';
    pBtn.classList.toggle('active', profileOpen);
  }
  const foot = $('#mainFoot');
  if (foot) foot.hidden = profileOpen;
  renderTabs();
  if (profileOpen) renderProfilePage();
  else renderPanel(tab);
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
        <h2 style="margin:0;font-size:1.2rem">Profil</h2>
        <span style="width:80px"></span>
      </div>

      <article class="card" style="text-align:center;padding:20px 16px">
        <div class="profile-avatar-lg">${esc(initials || '👤')}</div>
        <h3 style="margin:0;font-size:1.25rem">${esc(fullName || 'Misafir Kullanıcı')}</h3>
        <p class="detail" style="margin-top:4px">${fullName ? 'Günlük Plan Profili' : 'Aşağıdan adınızı ve soyadınızı kaydedebilirsiniz'}</p>
        <div class="profile-stats-grid">
          <div class="profile-stat-box"><b>${state.habits.length}</b><small>Toplam Madde</small></div>
          <div class="profile-stat-box"><b style="color:var(--green)">${allDoneToday}/${state.habits.length}</b><small>Bugün Tamam</small></div>
          <div class="profile-stat-box"><b>${maxBest} gün</b><small>En Uzun Zincir</small></div>
        </div>
      </article>

      <article class="card" style="padding:18px">
        <h3 style="margin:0 0 12px;font-size:1.05rem">👤 Kişisel Bilgiler</h3>
        <div class="field-block">
          <label class="field-label">Ad
            <input type="text" id="profFirstName" maxlength="40" value="${esc(state.profile?.firstName || '')}" placeholder="Adınızı girin" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border-radius:10px;border:1.5px solid color-mix(in srgb, var(--text) 18%, transparent);background:color-mix(in srgb, var(--text) 5%, transparent)">
          </label>
        </div>
        <div class="field-block">
          <label class="field-label">Soyad
            <input type="text" id="profLastName" maxlength="40" value="${esc(state.profile?.lastName || '')}" placeholder="Soyadınızı girin" style="display:block;width:100%;margin-top:6px;padding:10px 12px;border-radius:10px;border:1.5px solid color-mix(in srgb, var(--text) 18%, transparent);background:color-mix(in srgb, var(--text) 5%, transparent)">
          </label>
        </div>
        <button type="button" class="primary" style="width:100%;padding:11px" data-save-profile>✓ Bilgileri Kaydet</button>
        ${profileSavedMsg ? '<div class="profile-toast">✓ Ad ve soyad bilgileriniz başarıyla kaydedildi.</div>' : ''}
      </article>

      <article class="card" style="padding:18px">
        <h3 style="margin:0 0 8px;font-size:1.05rem">💾 Yedekleme ve Geri Yükleme</h3>
        <p class="detail" style="line-height:1.45">Tüm alışkanlıklarınız, zincirleriniz, ilerleme kayıtlarınız ve profil bilgileriniz cihazınızda saklanır. Verilerinizi yedekleyebilir veya istediğiniz zaman yedekten geri yükleyebilirsiniz.</p>
        <div class="backup-info-box">
          <div class="backup-info-row"><span>Kayıtlı Alışkanlık:</span><b>${state.habits.length} madde (${TABS.length} kategori)</b></div>
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
    const todayProg = getProgress(h.id, todayKey);
    let goalChip = '';
    if (h.goal && h.goal.type !== 'none' && h.goal.target > 0) {
      if (h.goal.type === 'timer') {
        const txt = todayProg > 0 && todayProg < h.goal.target
          ? `⏱️ ${fmtDuration(todayProg)} / ${fmtTimerReadable(h.goal.target)}`
          : `⏱️ ${fmtTimerReadable(h.goal.target)}`;
        goalChip = `<span class="goal-chip">${esc(txt)}</span>`;
      } else if (h.goal.type === 'reps') {
        goalChip = `<span class="goal-chip">🔁 ${todayProg}/${h.goal.target} tekrar</span>`;
      } else if (h.goal.type === 'amount') {
        goalChip = `<span class="goal-chip">📊 ${todayProg}/${h.goal.target}${h.goal.unit ? ' ' + esc(h.goal.unit) : ''}</span>`;
      }
    }
    return `<article class="card" data-habit="${h.id}">
      <div class="card-head" data-card-head="${h.id}">
        <div class="card-info">
          <div class="card-title-group">
            <h4>${esc(h.name)}</h4>
            ${h.detail ? `<span class="detail">${esc(h.detail)}</span>` : ''}
          </div>
          <div class="card-stats">
            <span>🔗 Zincir: <b>${cur}</b> gün</span>
            <span>🏆 En uzun: <b>${best}</b></span>
            <span>📅 Bu ay: <b>${monthDone}/${dim}</b></span>
            ${goalChip}
          </div>
        </div>
        <div class="card-actions">
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
$('#profileBtn')?.addEventListener('click', () => {
  profileSavedMsg = false;
  profileOpen = !profileOpen;
  reorderMode = false;
  render();
});

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  const wasProfile = profileOpen;
  profileOpen = false;
  if (state.tab !== b.dataset.tab || wasProfile) {
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
let currentGoalType = 'none';
let editorSubtasks = [];

function setEditorGoalType(type) {
  currentGoalType = type;
  $('#goalTypeRow').querySelectorAll('[data-goal-type]').forEach((b) => {
    b.classList.toggle('active', b.dataset.goalType === type);
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
  const b = e.target.closest('[data-min]');
  if (!b) return;
  form.elements.timerMin.value = b.dataset.min;
  form.elements.timerSec.value = '0';
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
  const g = habit?.goal;
  if (g && g.type !== 'none' && g.target > 0) {
    setEditorGoalType(g.type);
    if (g.type === 'timer') {
      form.elements.timerMin.value = Math.floor(g.target / 60);
      form.elements.timerSec.value = g.target % 60;
      form.elements.repsTarget.value = '';
      form.elements.amountTarget.value = '';
      form.elements.amountUnit.value = '';
    } else if (g.type === 'reps') {
      form.elements.repsTarget.value = g.target;
      form.elements.timerMin.value = 2;
      form.elements.timerSec.value = 0;
    } else if (g.type === 'amount') {
      form.elements.amountTarget.value = g.target;
      form.elements.amountUnit.value = g.unit || '';
      form.elements.timerMin.value = 2;
      form.elements.timerSec.value = 0;
    }
  } else {
    setEditorGoalType('none');
    form.elements.timerMin.value = 2;
    form.elements.timerSec.value = 0;
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
    const m = Math.max(0, parseInt(form.elements.timerMin.value || '0', 10) || 0);
    const s = Math.max(0, parseInt(form.elements.timerSec.value || '0', 10) || 0);
    const total = m * 60 + s;
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
    editing.goal = goal;
    editing.subtasks = [...editorSubtasks];
  } else {
    state.habits.push({ id: uid(), tab: state.tab, name, detail, goal, subtasks: [...editorSubtasks] });
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

/* ───────── Yedekle / geri yükle ───────── */
function exportBackup() {
  state.profile = { ...(state.profile || { firstName: '', lastName: '' }), lastBackupAt: nowStampTR() };
  save();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
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
    if (!Array.isArray(s.habits) || typeof s.marks !== 'object') throw new Error('format');
    if (!confirm('Mevcut verilerin yerine yedek yüklensin mi?')) return;
    Object.assign(state, {
      habits: s.habits,
      marks: s.marks,
      progress: s.progress && typeof s.progress === 'object' ? s.progress : {},
      tab: TABS.some((t) => t.id === s.tab) ? s.tab : TABS[0].id,
      profile: {
        firstName: typeof s.profile?.firstName === 'string' ? s.profile.firstName : (state.profile?.firstName || ''),
        lastName: typeof s.profile?.lastName === 'string' ? s.profile.lastName : (state.profile?.lastName || ''),
        lastBackupAt: s.profile?.lastBackupAt || state.profile?.lastBackupAt,
        lastRestoreAt: nowStampTR(),
      },
    });
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
