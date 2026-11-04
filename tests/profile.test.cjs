const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function fixture({imageManipulator} = {}) {
  const data = new Map(), cache = new Map();
  const storage = { getItem: async k => data.get(k) ?? null, setItem: async (k, v) => data.set(k, v) };
  function load(name) {
    if (cache.has(name)) return cache.get(name);
    const module = {exports: {}}; cache.set(name, module.exports);
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', name + '.ts'), 'utf8');
    const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText;
    new Function('require', 'module', 'exports', compiled)(n => n.startsWith('./') ? load(n.slice(2)) : n.includes('async-storage') ? storage : n === 'expo-image-manipulator' ? imageManipulator : {}, module, module.exports);
    cache.set(name, module.exports); return module.exports;
  }
  return {load};
}

test('current chains cross month/year boundaries, tolerate pending today and break on partial or missed days', () => {
  const {calculateStreaks} = fixture().load('utils');
  const marks = {'2026-12-30':'g', '2026-12-31':'g'};
  assert.deepEqual(calculateStreaks(marks, '2027-01-01'), {cur: 2, best: 2});
  assert.deepEqual(calculateStreaks({...marks, '2027-01-01':'g'}, '2027-01-01'), {cur: 3, best: 3});
  for (const mark of ['b', 'r']) assert.deepEqual(calculateStreaks({...marks, '2027-01-01':mark}, '2027-01-01'), {cur: 0, best: 2});
  assert.deepEqual(calculateStreaks({'2026-12-30':'g'}, '2027-01-01'), {cur: 0, best: 1});
});

test('radar statistics exclude future and removed records and include every active habit', () => {
  const {habitStatistics, radarPoint} = fixture().load('profileModel');
  const habits = Array.from({length: 17}, (_, i) => ({id: String(i), name: 'Habit '+i, tab:'beslenme', detail:''}));
  const rows = habitStatistics({habits, marks:{'0':{'2026-10-31':'g', '2026-11-01':'g', '2026-11-02':'g'}, removed:{'2026-11-01':'g'}}}, '2026-11-01');
  assert.equal(rows.length, 17);
  assert.deepEqual([rows[0].cur, rows[0].best, rows[0].completed], [2, 2, 2]);
  assert.ok(rows.slice(1).every(h => h.cur === 0 && h.best === 0));
  for (const count of [0, 1, 2, 6]) for (const value of [0, 7, 100]) {
    const p = radarPoint(0, count, value, 7); assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(Math.hypot(p.x - 180, p.y - 155) <= 98.001);
  }
});

test('profile edits, deletion and local preferences survive storage reload without losing habits or tracking', async () => {
  const f = fixture(), {seedState, saveAppState, loadAppState} = f.load('storage');
  const state = seedState(), id = state.habits[0].id;
  state.profile = {firstName:'Deneme', lastName:'Profil', avatar:'🦊', photoUri:'data:image/jpeg;base64,aGVsbG8='};
  state.preferences = {theme:'system', language:'en', notifications:false};
  state.marks[id] = {'2026-11-01':'g'};
  await saveAppState(state);
  let restored = await loadAppState();
  assert.deepEqual(restored.profile, state.profile);
  assert.deepEqual(restored.preferences, state.preferences);
  const snapshot = structuredClone(restored);
  restored.profile = {...restored.profile, firstName:'', lastName:'', avatar:'', photoUri:'', deleted:true};
  await saveAppState(restored); restored = await loadAppState();
  assert.equal(restored.profile.deleted, true);
  assert.equal(restored.profile.photoUri, '');
  assert.deepEqual(restored.habits, snapshot.habits);
  assert.deepEqual(restored.marks, snapshot.marks);
  const merged = f.load('constants').preserveLocalTabs({...restored, preferences:undefined}, snapshot);
  assert.deepEqual(merged.preferences, state.preferences);
});

test('profile photos are centered, reduced and saved independently of temporary file URIs', async () => {
  const actions = [], released = [], options = [];
  const source = {width:800,height:600,release:()=>released.push('source')};
  const output = {saveAsync:async value=>{options.push(value);return {base64:'cGhvdG8='};},release:()=>released.push('output')};
  let calls = 0;
  const context = {renderAsync:async()=>++calls===1?source:output, crop:value=>{actions.push(value);return context;}, resize:value=>{actions.push(value);return context;}, release:()=>released.push('context')};
  const imageManipulator = {SaveFormat:{JPEG:'jpeg'}, ImageManipulator:{manipulate:(uri,bounds)=>{assert.equal(uri,'file:///temporary-photo.png');assert.deepEqual(bounds,{maxWidth:800,maxHeight:800});return context;}}};
  const {prepareProfilePhoto} = fixture({imageManipulator}).load('profilePhotoStorage');
  assert.equal(await prepareProfilePhoto('file:///temporary-photo.png'),'data:image/jpeg;base64,cGhvdG8=');
  assert.deepEqual(actions,[{originX:100,originY:0,width:600,height:600},{width:320,height:320}]);
  assert.deepEqual(options,[{format:'jpeg',compress:.75,base64:true}]);
  assert.deepEqual(released,['output','source','context']);
});

test('unreadable and oversized photo results fail without retaining image resources', async () => {
  for(const oversized of [false,true]) {
    const released = [];
    const source={width:400,height:300,release:()=>released.push('source')};
    const output={saveAsync:async()=>({base64:'x'.repeat(350001)}),release:()=>released.push('output')};
    let calls=0;
    const context={renderAsync:async()=>{calls++;if(!oversized)throw Error('unreadable');return calls===1?source:output;},crop:()=>context,resize:()=>context,release:()=>released.push('context')};
    const imageManipulator={SaveFormat:{JPEG:'jpeg'},ImageManipulator:{manipulate:()=>context}};
    await assert.rejects(fixture({imageManipulator}).load('profilePhotoStorage').prepareProfilePhoto('test'));
    assert.deepEqual(released,oversized?['output','source','context']:['context']);
  }
});

test('appearance follows system changes while explicit modes override them', () => {
  const f = fixture(), {appearance, preferences} = f.load('profileModel'), {NEON_THEME} = f.load('constants');
  assert.equal(appearance(NEON_THEME,'system','light').isDark, false);
  assert.equal(appearance(NEON_THEME,'system','dark').isDark, true);
  assert.equal(appearance(NEON_THEME,'dark','light').isDark, true);
  assert.equal(appearance(NEON_THEME,'light','dark').isDark, false);
  assert.deepEqual(preferences({preferences:{theme:'invalid',language:'invalid'}}), {theme:'dark',language:'tr',notifications:true});
});

function standaloneFixture() {
  const events = {}, nodes = new Map(), state = {section:'kesfet', habits: [{id:'h', name:'Kitap', tab:'beslenme'}], marks: {h:{'2026-11-01':'g'}}, profile:{firstName:'',lastName:''}, preferences:{theme:'light',language:'tr',notifications:true}};
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {innerHTML:'', style:{}, dataset:{}, removeAttribute(){}, focus(){}, setCustomValidity(){}, reportValidity(){}});
    return nodes.get(selector);
  };
  let homeResets = 0;
  const permission = {permission:'denied'}, context = {state, window:{matchMedia:()=>({matches:true,addEventListener(){}}), Notification:permission, AuroraWeb:{resetHomeView(){homeResets++;}}}, document:{body:{dataset:{}},documentElement:{}}, Notification:permission,
    panel:{addEventListener:(name, fn)=>{events[name]=fn;}}, render(){
      const profile = context.window.ProfileWeb;
      if (!profile) return;
      profile.applyAppearance();
      if (profile.renderSession()) return;
      if (context.profileOpen) profile.renderProfilePage();
      else node('#panel').innerHTML = '';
    }, save(){}, profileOpen:true, reorderMode:false, taskReorderMode:false, monthlyViewMode:false,
    getInitials:()=>'', getMark:()=>'', getTabs:()=>[{id:'beslenme',name:'Beslenme'}], keyOf:()=> '2026-11-01',
    streaks:()=>({cur:1,best:1}), esc:s=>String(s).replaceAll('<','&lt;'), $:node,
    FormData:class {constructor(form){this.values=form.values;} get(key){return this.values[key];}}
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','profile-web.js'),'utf8'), context);
  const click = action => events.click({target:{closest:()=>({dataset:{profileAction:action}})}});
  return {events, state, node, permission, context, click, homeResets:()=>homeResets};
}

test('standalone profile actions preserve tracking, undo deletion and respect denied notification permission', async () => {
  const {events, state, node, permission, context, click} = standaloneFixture();
  assert.doesNotMatch(node('#panel').innerHTML,/Habit streak radar chart|data-profile-action="edit"/);
  assert.doesNotMatch(node('#panel').innerHTML,/data-profile-action="(?:stats|settings)"/);
  context.window.ProfileWeb.openSection('settings');
  assert.match(node('#panel').innerHTML,/class="settings-page"/);
  assert.match(node('#panel').innerHTML,/data-profile-action="settings-language"/);
  assert.doesNotMatch(node('#panel').innerHTML,/Add profile|Profil ekle/);
  assert.doesNotMatch(node('#panel').innerHTML,/role="switch"/);
  await click('settings-notifications');
  assert.match(node('#panel').innerHTML,/role="switch"/);
  await click('settings-back');
  assert.doesNotMatch(node('#panel').innerHTML,/role="switch"/);
  events.submit({target:{id:'profileEditorForm',values:{first:'  Deneme  ',last:'Profil',avatar:'🦊'}},preventDefault(){}});
  assert.equal(state.profile.firstName,'Deneme');
  const tracking = JSON.stringify(state.marks);
  await click('delete'); await click('confirm-delete');
  assert.equal(state.profile.deleted,true); assert.equal(JSON.stringify(state.marks),tracking);
  await click('undo'); assert.equal(state.profile.firstName,'Deneme');
  await click('notifications'); assert.equal(state.preferences.notifications,false);
  await click('notifications'); assert.equal(state.preferences.notifications,false);
  assert.match(node('#notificationNotice').textContent,/izni verilmedi/);
  permission.permission = 'granted'; await click('notifications'); assert.equal(state.preferences.notifications,true);
  await click('lang-en');
  assert.equal(state.preferences.theme,'light');
  assert.equal(context.document.body.dataset.appearance,'light');
  await click('logout'); assert.equal(state.sessionLocked,true);
  assert.equal(context.window.ProfileWeb.renderSession(),true);
  await click('return'); assert.equal(state.sessionLocked,false);
  assert.equal(JSON.stringify(state.marks),tracking);
});

test('standalone statistics has no back action and settings returns to Today from any previous tab', async () => {
  const {state, node, context, click, homeResets} = standaloneFixture();
  const profile = context.window.ProfileWeb;
  const tracking = JSON.stringify(state.marks);
  context.profileOpen = false;
  profile.openSection('stats');
  assert.equal(context.profileOpen,true);
  assert.equal(context.document.body.dataset.profileSection,'stats');
  assert.match(node('#panel').innerHTML,/class="settings-page statistics-page"/);
  assert.match(node('#panel').innerHTML,/Alışkanlık zincirleri radar grafiği/);
  assert.doesNotMatch(node('#panel').innerHTML,/data-profile-action="(?:stats-back|back)"|class="card profile-hero"/);

  profile.closeSection();
  assert.equal(context.profileOpen,false);
  context.profileOpen = true;
  context.render();
  assert.match(node('#panel').innerHTML,/class="card profile-hero"/);
  assert.doesNotMatch(node('#panel').innerHTML,/statistics-page/);

  for (const previous of ['rutin','kesfet','gorevler']) {
    state.section = previous;
    profile.openSection('settings');
    assert.equal(context.document.body.dataset.profileSection,'settings');
    assert.match(node('#panel').innerHTML,/data-profile-action="settings-language"/);
    assert.doesNotMatch(node('#panel').innerHTML,/settings-appearance|Görünüm|Appearance/);
    await click('settings-language');
    assert.match(node('#panel').innerHTML,/data-profile-action="lang-en"/);
    await click('settings-back');
    assert.equal(context.profileOpen,true);
    assert.equal(state.section,previous);
    assert.match(node('#panel').innerHTML,/data-profile-action="settings-language"/);

    context.reorderMode = context.taskReorderMode = context.monthlyViewMode = true;
    await click('settings-back');
    assert.equal(context.profileOpen,false);
    assert.equal(state.section,'rutin');
    assert.equal(context.reorderMode,false);
    assert.equal(context.taskReorderMode,false);
    assert.equal(context.monthlyViewMode,false);
    assert.equal(context.document.body.dataset.profileSection,'');
    assert.equal(context.document.body.dataset.settings,'false');
    assert.doesNotMatch(node('#panel').innerHTML,/settings-page|profile-page/);
  }
  assert.equal(homeResets(),3);
  assert.equal(state.preferences.theme,'light');
  assert.equal(JSON.stringify(state.marks),tracking);
});
