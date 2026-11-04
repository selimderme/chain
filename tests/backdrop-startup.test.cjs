const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};

function webBackdrop({decode = true} = {}) {
  const bitmap = deferred(), body = {dataset:{backdropReady:'false'}};
  let image, decodeCalls = 0;
  class FakeImage {
    constructor() {
      image = this;
      if (decode) this.decode = () => { decodeCalls++; return bitmap.promise; };
    }
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'backdrop-ready.js'), 'utf8'), {
    Image:FakeImage, document:{body},
  });
  return {image, bitmap, body, decodeCalls:()=>decodeCalls};
}

test('standalone startup waits for the loaded background to finish decoding', async () => {
  const f = webBackdrop();
  assert.equal(f.body.dataset.backdropReady, 'false');
  await flush();
  assert.equal(f.body.dataset.backdropReady, 'false');
  f.image.onload();
  await flush();
  assert.equal(f.decodeCalls(), 1);
  assert.equal(f.body.dataset.backdropReady, 'false', 'loading alone must not expose the unsettled image');
  f.bitmap.resolve();
  await flush();
  assert.equal(f.body.dataset.backdropReady, 'true');
});

test('an unavailable or undecodable background still releases the standalone app', async () => {
  const missing = webBackdrop();
  missing.image.onerror(new Error('Background unavailable'));
  await flush();
  assert.equal(missing.body.dataset.backdropReady, 'true');
  assert.equal(missing.decodeCalls(), 0);

  const invalid = webBackdrop();
  invalid.image.onload();
  await flush();
  invalid.bitmap.reject(new Error('Background cannot be decoded'));
  await flush();
  assert.equal(invalid.body.dataset.backdropReady, 'true');
});

test('browsers without an image decode method release startup after load', async () => {
  const f = webBackdrop({decode:false});
  assert.equal(f.body.dataset.backdropReady, 'false');
  f.image.onload();
  await flush();
  assert.equal(f.body.dataset.backdropReady, 'true');
});

function nativeBackdrop({loadAsync, prefetch}) {
  const module = {exports:{}};
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', 'backdropAsset.ts'), 'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => {
    if (name === 'expo-asset') return {Asset:{loadAsync}};
    if (name === 'react-native') return {Image:{prefetch}};
    if (name.endsWith('.png')) return 1;
    throw new Error('Unexpected backdrop dependency: ' + name);
  }, module, module.exports);
  return module.exports;
}

test('native screens can share one preparation and wait for the bitmap cache', async () => {
  const asset = deferred(), cache = deferred();
  let loads = 0, preparedUri, settled = false;
  const f = nativeBackdrop({loadAsync:()=>{ loads++; return asset.promise; },prefetch:uri=>{ preparedUri = uri; return cache.promise; }});
  const first = f.warmNeonBackdrop(), second = f.warmNeonBackdrop();
  first.then(()=>{settled = true;});
  assert.equal(first, second);
  assert.equal(loads, 1);
  asset.resolve([{localUri:'local://prepared-atmosphere',uri:'remote://atmosphere'}]);
  await flush();
  assert.equal(preparedUri, 'local://prepared-atmosphere');
  assert.equal(settled, false);
  cache.resolve(true);
  await first;
  assert.equal(settled, true);
  assert.equal(f.warmNeonBackdrop(), first, 'later screens reuse the prepared image');
});

test('a failed native preparation can be retried instead of poisoning later startup attempts', async () => {
  let attempts = 0;
  const f = nativeBackdrop({loadAsync:async()=>[{uri:'local://atmosphere'}],prefetch:async()=>++attempts > 1});
  await assert.rejects(f.warmNeonBackdrop());
  await f.warmNeonBackdrop();
  assert.equal(attempts, 2);
});
