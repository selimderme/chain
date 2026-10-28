const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise production TypeScript with an isolated in-memory device store.
// No user storage, credentials, or network connections are used.
function fixture() {
  const values = new Map();
  const deviceStorage = {
    getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async key => { values.delete(key); },
  };
  const cache = new Map();
  let sequence = 0;
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', `${file}.ts`), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
    const module = { exports: {} };
    const imports = name => {
      if (name === '@react-native-async-storage/async-storage') return deviceStorage;
      if (name === 'react-native') return { Platform: { OS: 'web' } };
      if (name === './utils') return { uid: () => `unit-${++sequence}`, pad: n => String(n).padStart(2, '0') };
      if (name === './firebaseConfig') return { DEFAULT_FIREBASE_CONFIG: {}, isFirebaseConfigured: () => false };
      if (name === './firebaseGateway') return {};
      if (name === './constants') return load('constants');
      throw new Error(`Unexpected dependency: ${name}`);
    };
    new Function('require', 'module', 'exports', 'navigator', 'fetch', compiled.outputText)(
      imports, module, module.exports, { onLine: true }, () => { throw new Error('Network access is forbidden in this test'); }
    );
    cache.set(file, module.exports);
    return module.exports;
  }
  const constants = load('constants');
  const custom = { id: 'custom-unit', name: 'Hobiler', emoji: '🎨', color: '#8B5CF6' };
  const state = {
    v: 1, tab: custom.id, section: 'rutin', customTabs: [custom],
    tabOrder: [custom.id, 'egzersiz', 'beslenme'],
    habits: [
      { id: 'built-in', tab: 'beslenme', name: 'Protein', detail: '' },
      { id: 'local-habit', tab: custom.id, name: 'Yerel çizim', detail: '', emoji: '🎨' },
    ],
    marks: { 'built-in': { '2026-10-27': 'g' }, 'local-habit': { '2026-10-27': 'b' } },
    progress: { 'local-habit': { '2026-10-27': 3 } }, tasks: [],
  };
  return { ...constants, load, values, custom, state };
}

test('custom categories, selected tab and habits survive device save/reload', async () => {
  const f = fixture();
  const storage = f.load('storage');
  await storage.saveAppState(f.state);
  const loaded = await storage.loadAppState();
  assert.equal(loaded.tab, f.custom.id);
  assert.deepEqual(loaded.customTabs, [f.custom]);
  assert.equal(loaded.habits.find(h => h.id === 'local-habit').emoji, '🎨');
  assert.equal(f.getTabs(loaded.customTabs).find(t => t.id === loaded.tab).theme.accent, '#8B5CF6');
});

test('empty custom categories survive reload without requiring habits', async () => {
  const f = fixture();
  const storage = f.load('storage');
  await storage.saveAppState({ ...f.state, habits: [] });
  const loaded = await storage.loadAppState();
  assert.equal(loaded.tab, f.custom.id);
  assert.deepEqual(loaded.customTabs, [f.custom]);
});

test('older device data remains compatible and malformed custom categories are normalized', async () => {
  const f = fixture();
  const storage = f.load('storage');
  const legacy = storage.seedState();
  delete legacy.customTabs;
  await storage.saveAppState(legacy);
  assert.equal((await storage.loadAppState()).tab, 'beslenme');
  assert.deepEqual(f.normalizeCustomTabs([null, { id: 'beslenme', name: 'Duplicate' }, f.custom, f.custom]), [f.custom]);
  const [normalized] = f.normalizeCustomTabs([{ id: 'custom-fallback', name: '  Yerel  ', color: 'url(unsafe)', emoji: '' }]);
  assert.equal(normalized.name, 'Yerel');
  assert.equal(normalized.color, '#8B5CF6');
  assert.equal(normalized.emoji, '📁');
});

test('restoring existing cloud data preserves local categories and their tracking', () => {
  const f = fixture();
  const restored = { v: 1, tab: 'beslenme', habits: [{ id: 'built-in', tab: 'beslenme', name: 'Güncel protein', detail: '' }], marks: {}, tasks: [] };
  const merged = f.preserveLocalTabs(restored, f.state);
  assert.equal(merged.tab, f.custom.id);
  assert.deepEqual(merged.customTabs, [f.custom]);
  assert.equal(merged.habits.find(h => h.id === 'built-in').name, 'Güncel protein');
  assert.equal(merged.habits.find(h => h.id === 'local-habit').name, 'Yerel çizim');
  assert.deepEqual(merged.marks['local-habit'], f.state.marks['local-habit']);
  assert.deepEqual(merged.progress['local-habit'], f.state.progress['local-habit']);
});

test('cloud serialization excludes every custom category and its habit data', async () => {
  const f = fixture();
  const cloud = f.load('cloudSync');
  assert.equal((await cloud.syncStateToCloud({ uid: 'unit-user', provider: 'email' }, { ...f.state, deletedTabs: ['bakim'], tabEdits: { beslenme: { name: 'Yerel görünüm', emoji: '🥗', color: '#8B5CF6' } } })).ok, false, 'a local cache is not a successful cloud backup');
  const payload = JSON.parse(f.values.get('gunluk-plan:cloud-vault:v1:unit-user'));
  assert.equal(payload.customTabs, undefined);
  assert.equal(payload.tabOrder, undefined);
  assert.equal(payload.deletedTabs, undefined);
  assert.equal(payload.tabEdits, undefined);
  assert.equal(payload.tab, 'beslenme');
  assert.deepEqual(payload.habits.map(h => h.id), ['built-in']);
  assert.deepEqual(Object.keys(payload.marks), ['built-in']);
  assert.deepEqual(payload.progress, {});
  assert.equal(JSON.stringify(payload).includes('Hobiler'), false);
  assert.equal(JSON.stringify(payload).includes('Yerel çizim'), false);
});

test('deleting a custom tab removes only its habits and tracking and survives reload', async () => {
  const f = fixture();
  const before = JSON.stringify(f.state);
  const deleted = f.deleteTab(f.state, f.custom.id);
  assert.equal(JSON.stringify(f.state), before, 'source data must remain immutable');
  assert.equal(deleted.tab, 'egzersiz');
  assert.deepEqual(deleted.customTabs, []);
  assert.deepEqual(deleted.habits.map(h => h.id), ['built-in']);
  assert.deepEqual(deleted.marks, { 'built-in': f.state.marks['built-in'] });
  assert.deepEqual(deleted.progress, {});
  assert.ok(!deleted.tabOrder.includes(f.custom.id));
  const storage = f.load('storage');
  await storage.saveAppState(deleted);
  const loaded = await storage.loadAppState();
  assert.deepEqual(loaded.customTabs, []);
  assert.ok(!loaded.habits.some(h => h.id === 'local-habit'));
});

test('deleting an inactive or empty tab preserves the selection and unrelated records', () => {
  const f = fixture();
  const other = { ...f.custom, id: 'custom-other', name: 'İş' };
  const state = { ...f.state, tab: 'egzersiz', customTabs: [f.custom, other], tasks: [{ id: 'task', title: 'Korunacak görev', done: false }] };
  const deleted = f.deleteTab(state, other.id);
  assert.equal(deleted.tab, 'egzersiz');
  assert.deepEqual(deleted.habits, state.habits);
  assert.deepEqual(deleted.marks, state.marks);
  assert.deepEqual(deleted.progress, state.progress);
  assert.strictEqual(deleted.tasks, state.tasks);
  assert.deepEqual(deleted.customTabs, [f.custom]);
});

test('unknown categories cannot be deleted', () => {
  const f = fixture();
  assert.strictEqual(f.deleteTab(f.state, 'custom-missing'), f.state);
});

test('tab order moves in either direction, retains selection and persists locally', async () => {
  const f = fixture();
  const ids = f.getTabs(f.state.customTabs, f.state.tabOrder).map(t => t.id);
  const reordered = f.reorderTabs(f.state, 0, ids.length - 1);
  assert.equal(reordered.tab, f.custom.id);
  assert.equal(reordered.tabOrder.at(-1), f.custom.id);
  assert.deepEqual(f.reorderTabs(reordered, ids.length - 1, 0).tabOrder, ids);
  assert.strictEqual(f.reorderTabs(f.state, -1, 0), f.state);
  assert.strictEqual(f.reorderTabs(f.state, 0, 99), f.state);
  const storage = f.load('storage');
  await storage.saveAppState(reordered);
  assert.deepEqual((await storage.loadAppState()).tabOrder, reordered.tabOrder);
});

test('malformed orders omit stale IDs and duplicates and append new categories', () => {
  const f = fixture();
  const tabs = f.getTabs([f.custom], ['egzersiz', 'missing', 'egzersiz', null]);
  assert.equal(tabs[0].id, 'egzersiz');
  assert.equal(new Set(tabs.map(t => t.id)).size, tabs.length);
  assert.equal(tabs.at(-1).id, f.custom.id);
  const merged = f.preserveLocalTabs({ ...f.state, customTabs: [], tabOrder: ['beslenme'] }, f.state);
  assert.deepEqual(merged.tabOrder, f.getTabs(f.state.customTabs, f.state.tabOrder).map(t => t.id));
});

test('deleted default tabs and their habits do not return after reload or cloud restore', async () => {
  const f = fixture();
  const deleted = f.deleteTab({ ...f.state, tab: 'beslenme' }, 'beslenme');
  assert.ok(deleted.deletedTabs.includes('beslenme'));
  assert.ok(!f.getStateTabs(deleted).some(tab => tab.id === 'beslenme'));
  assert.ok(!deleted.habits.some(habit => habit.tab === 'beslenme'));
  const storage = f.load('storage');
  await storage.saveAppState(deleted);
  const loaded = await storage.loadAppState();
  assert.ok(!loaded.habits.some(habit => habit.tab === 'beslenme'));
  assert.ok(!f.getStateTabs(loaded).some(tab => tab.id === 'beslenme'));
  const restored = f.preserveLocalTabs(f.state, loaded);
  assert.ok(!f.getStateTabs(restored).some(tab => tab.id === 'beslenme'));
  assert.ok(!restored.habits.some(habit => habit.id === 'built-in'));
  assert.equal(restored.marks['built-in'], undefined);
});

test('default and custom tab edits retain IDs and all tracking and survive reload', async () => {
  const f = fixture();
  const look = { name: 'Yeni Beslenme', emoji: '🥑', color: '#14B8A6' };
  const builtin = f.editTab(f.state, 'beslenme', look);
  const edited = f.editTab(builtin, f.custom.id, { ...look, name: 'Sanat' });
  assert.strictEqual(edited.habits, f.state.habits);
  assert.strictEqual(edited.marks, f.state.marks);
  assert.strictEqual(edited.progress, f.state.progress);
  const storage = f.load('storage');
  await storage.saveAppState(edited);
  const loaded = await storage.loadAppState();
  const tab = f.getStateTabs(loaded).find(tab => tab.id === 'beslenme');
  assert.equal(tab.name, look.name);
  assert.equal(tab.emoji, look.emoji);
  assert.equal(tab.theme.accent, look.color);
  assert.equal(loaded.customTabs[0].id, f.custom.id);
  assert.equal(loaded.customTabs[0].name, 'Sanat');
  assert.strictEqual(f.editTab(f.state, 'beslenme', { ...look, name: 'Hobiler' }), f.state);
});

test('the last remaining tab cannot be deleted and malformed metadata is normalized', () => {
  const f = fixture();
  let state = f.state;
  const tabs = f.getStateTabs(state);
  for (const tab of tabs.slice(1)) state = f.deleteTab(state, tab.id);
  assert.equal(f.getStateTabs(state).length, 1);
  assert.strictEqual(f.deleteTab(state, f.getStateTabs(state)[0].id), state);
  assert.deepEqual(f.normalizeDeletedTabs(['missing', 'beslenme', 'beslenme']), ['beslenme']);
  assert.deepEqual(f.normalizeTabEdits({ beslenme: null, egzersiz: { name: '' } }), {});
});
