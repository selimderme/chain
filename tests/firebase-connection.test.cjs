const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

function fixture({ configured = true, online = true } = {}) {
  const values = new Map(), requests = [], calls = [];
  let response = { ok: true, status: 200, json: async () => ({}) };
  const user = { uid: 'verified-user', email: 'unit@example.com', provider: 'google', createdAt: 'test' };
  const storage = { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => values.set(key, value), removeItem: async key => values.delete(key) };
  const gateway = {
    firebaseProviderSignIn: async provider => { calls.push(provider); return user; },
    firebaseSignOut: async () => calls.push('signout'),
    restoreFirebaseUser: async () => null,
    firebaseIdToken: async uid => { assert.equal(uid, user.uid); return 'fresh-sdk-token'; },
    firebaseErrorMessage: error => error.message,
  };
  const constantsModule = { exports: {} };
  new Function('module', 'exports', compile('constants.ts'))(constantsModule, constantsModule.exports);
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'navigator', 'fetch', compile('cloudSync.ts'))(name => {
    if (name === '@react-native-async-storage/async-storage') return storage;
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    if (name === './constants') return constantsModule.exports;
    if (name === './firebaseConfig') return { DEFAULT_FIREBASE_CONFIG: { projectId: 'unit-project' }, isFirebaseConfigured: () => configured };
    if (name === './firebaseGateway') return gateway;
    if (name === './utils') return { pad: value => String(value).padStart(2, '0'), uid: () => 'unit-generated' };
    throw Error(name);
  }, module, module.exports, { onLine: online }, async (...args) => { requests.push(args); return response; });
  return { ...module.exports, user, gateway, values, requests, calls, storage,
    respond: value => { response = value; },
    state: { v: 1, tab: 'beslenme', updatedAt: 123, habits: [{ id: 'protein', tab: 'beslenme', name: 'Protein', detail: '' }], marks: {}, progress: {}, tasks: [] } };
}

test('Google sign-in invokes the provider directly and stores no bearer tokens in profile metadata', async () => {
  const f = fixture();
  f.user.idToken = 'legacy-secret'; f.user.refreshToken = 'legacy-refresh';
  const promise = f.signInWithGoogleAccount();
  assert.deepEqual(f.calls, ['google'], 'popup starts in the original click call stack');
  assert.equal((await promise).uid, f.user.uid);
  const stored = JSON.parse(f.values.get('gunluk-plan:auth-session:v1'));
  assert.equal(stored.user.idToken, undefined);
  assert.equal(stored.user.refreshToken, undefined);
});

test('failed provider authorization never falls back to a locally invented account', async () => {
  const f = fixture();
  f.gateway.firebaseProviderSignIn = async () => { throw Error('Provider disabled'); };
  await assert.rejects(f.signInWithGoogleAccount(), /Provider disabled/);
  assert.equal(f.values.has('gunluk-plan:auth-session:v1'), false);
});

test('legacy simulated user metadata cannot restore a real authenticated session', async () => {
  const f = fixture();
  await f.saveAuthSession({ hasCompletedOnboarding: true, user: f.user });
  assert.equal((await f.loadAuthSession()).user, null);
  f.gateway.restoreFirebaseUser = async () => f.user;
  assert.equal((await f.loadAuthSession()).user.uid, f.user.uid);
});

test('Firestore success requires an authorized server response with a fresh SDK token', async () => {
  const f = fixture();
  const result = await f.syncStateToCloud(f.user, f.state);
  assert.equal(result.ok, true);
  assert.equal(await f.hasPendingCloudSync(f.user), false);
  const [url, options] = f.requests[0];
  assert.match(url, /unit-project.*user_backups\/verified-user$/);
  assert.equal(options.headers.Authorization, 'Bearer fresh-sdk-token');
  assert.equal(JSON.parse(options.body).fields.uid.stringValue, f.user.uid);
});

test('permission, authentication and quota failures keep data pending and never report cloud success', async () => {
  for (const status of [401, 403, 429, 500]) {
    const f = fixture();
    f.respond({ ok: false, status });
    const result = await f.syncStateToCloud(f.user, f.state);
    assert.equal(result.ok, false, String(status));
    assert.ok(result.error);
    assert.equal(await f.hasPendingCloudSync(f.user), true);
    assert.ok(f.values.has('gunluk-plan:cloud-vault:v1:verified-user'));
  }
});

test('an unconfigured or offline backend is never replaced with fake successful cloud storage', async () => {
  for (const options of [{ configured: false }, { online: false }]) {
    const f = fixture(options);
    assert.equal((await f.syncStateToCloud(f.user, f.state)).ok, false);
    assert.equal(f.requests.length, 0);
    assert.equal(await f.hasPendingCloudSync(f.user), true);
  }
});

test('unauthenticated or mismatched SDK identity cannot issue a Firestore request', async () => {
  const f = fixture();
  f.gateway.firebaseIdToken = async () => { throw Error('No verified session'); };
  assert.equal((await f.syncStateToCloud(f.user, f.state)).ok, false);
  assert.equal(f.requests.length, 0);
});

test('unreadable remote backups cannot be treated as empty accounts, even when a local cache exists', async () => {
  const f = fixture();
  await f.storage.setItem('gunluk-plan:cloud-vault:v1:verified-user', JSON.stringify(f.state));
  f.respond({ ok: false, status: 403 });
  await assert.rejects(f.fetchStateFromCloud(f.user), /izin verilmedi/);
  f.respond({ ok: false, status: 404, json: async () => ({ error: { message: 'The database (default) does not exist for project unit-project' } }) });
  await assert.rejects(f.fetchStateFromCloud(f.user), /veritabanını oluştur/);
  f.respond({ ok: false, status: 404, json: async () => ({ error: { message: 'Document not found' } }) });
  assert.equal(await f.fetchStateFromCloud(f.user), null);
});

test('account switching isolates local snapshots and preserves the previous account for a later return', async () => {
  const f = fixture();
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compile('localAccounts.ts'))(() => f.storage, module, module.exports);
  const { prepareLocalAccount, activateLocalAccount } = module.exports;
  const a = { ...f.state, tasks: [{ id: 'private-a', title: 'A private task' }] };
  const empty = { ...f.state, tasks: [] };
  await activateLocalAccount('account-a', a);
  assert.deepEqual(await prepareLocalAccount('account-b', a, empty), empty);
  await activateLocalAccount('account-b', empty);
  assert.deepEqual(await prepareLocalAccount('account-a', empty, empty), a);
});

test('timer ticks stay local while start, pause, reset, adjustment and finish can synchronize', () => {
  let publish;
  const reports = [];
  const fStorage = {};
  const module = { exports: {} };
  const react = { useRef: current => ({ current }), useState: value => [typeof value === 'function' ? value() : value, () => {}], useEffect() {} };
  new Function('require', 'module', 'exports', compile('useHabitTimers.ts'))(name => {
    if (name === 'react') return react;
    if (name === 'react-native') return {};
    if (name === '@react-native-async-storage/async-storage') return fStorage;
    if (name === './constants') return { STORAGE_KEY: 'unit' };
    if (name === './useStableCallback') return { useStableCallback: callback => callback };
    if (name === './habitTimers') return { HabitTimers: class { constructor(_now, progress) { publish = progress; } } };
    throw Error(name);
  }, module, module.exports);
  module.exports.useHabitTimers(true, [{ id: 'book', goal: { type: 'timer' } }], (...args) => reports.push(args));
  publish({ habitId: 'book', dateKey: '2026-10-28', endsAt: 60000 }, 0);
  publish({ habitId: 'book', dateKey: '2026-10-28', endsAt: 60000 }, 1);
  publish({ habitId: 'book', dateKey: '2026-10-28', endsAt: 60000 }, 2);
  publish({ habitId: 'book', dateKey: '2026-10-28', endsAt: 90000 }, 2);
  publish({ habitId: 'book', dateKey: '2026-10-28', endsAt: null }, 5);
  publish({ habitId: 'book', dateKey: '2026-10-28', endsAt: null }, 0);
  assert.deepEqual(reports.map(report => report[3]), [true, false, false, true, true, true]);
});
