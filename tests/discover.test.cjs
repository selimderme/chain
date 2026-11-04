const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const catalog = require('../discover-catalog.js');
const {webCatalogSource} = require('../scripts/sync-discover-catalog.cjs');

test('web catalog matches the native catalog and runs directly in a browser', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'discover-catalog.js'), 'utf8');
  assert.equal(source, webCatalogSource());
  const context = {window:{}};
  vm.runInNewContext(source, context);
  assert.equal(context.window.DiscoverCatalog.habits.length, 16);
  assert.equal(typeof context.window.DiscoverCatalog.exists, 'function');
});

test('each discover habit has a valid category, destination and actionable target', () => {
  const ids = new Set(), categories = new Set(catalog.categories.map(x => x.id));
  const tabs = new Set(['beslenme','egzersiz','bakim','ogrenme','ibadet','kotu-aliskanliklar']);
  for (const h of catalog.habits) {
    assert.ok(!ids.has(h.id)); ids.add(h.id);
    assert.ok(h.name && h.nameEn && h.detail && h.detailEn && h.emoji);
    assert.ok(categories.has(h.category) && tabs.has(h.tab));
    assert.ok(h.goalType === 'none' ? h.goalTarget === 0 : Number.isFinite(h.goalTarget) && h.goalTarget > 0);
  }
  for (const category of categories) assert.equal(catalog.habits.filter(h => h.category === category).length, 4);
});

test('duplicate prevention recognizes existing defaults, English names and renamed templates', () => {
  const water = catalog.habits.find(h => h.id === 'water');
  assert.ok(catalog.exists([{name:'2 litre su'}], water));
  assert.ok(catalog.exists([{name:'  DRINK WATER  '}], water));
  assert.ok(catalog.exists([{name:'Bana özel su hedefi',templateId:'water'}], water));
  assert.ok(!catalog.exists([{name:'Kahve',templateId:'other'}], water));
  assert.ok(!catalog.exists([], water));
  assert.ok(catalog.exists([{name:'Diş fırçalama + ip'}], catalog.habits.find(h => h.id === 'teeth')));
});

test('animation phases stay consistent through phase boundaries, pause/resume and whole cycles', () => {
  const frame = catalog.simulationFrame;
  assert.deepEqual([frame('breathing',0).phase, frame('breathing',0).expansion], ['inhale',0]);
  assert.deepEqual([frame('breathing',4000).phase, frame('breathing',4000).expansion], ['exhale',1]);
  assert.equal(frame('breathing',7000).expansion,.5);
  assert.deepEqual([frame('breathing',10000).phase, frame('breathing',10000).cycles], ['inhale',1]);
  assert.equal(frame('pushup',2000).phase,'up');
  assert.equal(frame('pushup',40000).cycles,10);
  assert.deepEqual(frame('pushup',2300), frame('pushup',2300));
  assert.equal(frame('breathing',-10).expansion,0);
  assert.equal(frame('breathing',NaN).expansion,0);
});

test('a discovered habit retains its template, destination and goal after native storage reload', async () => {
  const data = new Map(), cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const module = {exports:{}};
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', name + '.ts'), 'utf8');
    const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    new Function('require','module','exports',compiled)(n => n.startsWith('./') ? load(n.slice(2)) : n.includes('async-storage') ? {getItem:async k=>data.get(k)??null,setItem:async(k,v)=>data.set(k,v)} : {}, module, module.exports);
    cache.set(name,module.exports); return module.exports;
  }
  const storage = load('storage'), state = storage.seedState();
  const template = catalog.habits.find(h => h.id === 'pushup');
  const added = {id:'discover-pushup-test', templateId:template.id, tab:'custom-fitness', name:template.name, detail:template.detail, emoji:template.emoji, goal:{type:template.goalType,target:template.goalTarget,unit:template.goalUnit}};
  state.customTabs = [{id:'custom-fitness',name:'Sporum',emoji:'💪',color:'#14B8A6'}];
  state.habits.push(added);
  await storage.saveAppState(state);
  const restored = await storage.loadAppState();
  assert.deepEqual(restored.habits.find(h => h.id === added.id),added);
  assert.ok(catalog.exists(restored.habits,template));
});
