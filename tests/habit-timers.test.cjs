const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', 'habitTimers.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const compiledModule = { exports: {} };
new Function('module', 'exports', compiled)(compiledModule, compiledModule.exports);
const { HabitTimers } = compiledModule.exports;

function fixture(initial = 100000) {
  let now = initial, saved = [], changed = 0;
  const reports = [];
  const timers = new HabitTimers(() => now,
    (timer, elapsed) => reports.push({ habit: timer.habitId, date: timer.dateKey, elapsed }),
    () => changed++, value => { saved = structuredClone(value); });
  return { timers, reports, advance: ms => { now += ms; }, now: () => now,
    saved: () => saved, changed: () => changed };
}

test('countdown catches up after screen lock without receiving interval ticks', () => {
  const f = fixture();
  f.timers.toggle('book', '2026-10-27', 1800, 1800);
  f.advance(125400);
  f.timers.tick();
  assert.equal(f.timers.get('book').remaining, 1675);
  assert.equal(f.timers.get('book').running, true);
  assert.equal(f.reports.at(-1).elapsed, 125);
});

test('closing or switching panels does not affect independent timers', () => {
  const f = fixture();
  f.timers.toggle('book', '2026-10-27', 1800, 1800);
  f.advance(10000);
  f.timers.toggle('exercise', '2026-10-27', 600, 600);
  f.advance(20000); f.timers.tick();
  assert.equal(f.timers.get('book').remaining, 1770);
  assert.equal(f.timers.get('exercise').remaining, 580);
  f.timers.toggle('exercise', '2026-10-27', 600, 580);
  f.advance(10000); f.timers.tick();
  assert.equal(f.timers.get('book').remaining, 1760);
  assert.equal(f.timers.get('exercise').remaining, 580);
});

test('only pausing freezes time and resuming preserves fractional seconds', () => {
  const f = fixture();
  f.timers.toggle('book', '2026-10-27', 60, 60);
  f.advance(2450);
  f.timers.toggle('book', '2026-10-27', 60, 58);
  assert.equal(f.saved()[0].remainingMs, 57550);
  assert.equal(f.timers.get('book').running, false);
  f.advance(3600000); f.timers.tick();
  assert.equal(f.timers.get('book').remaining, 58);
  f.timers.toggle('book', '2026-10-27', 60, 58);
  f.advance(550); f.timers.tick();
  assert.equal(f.timers.get('book').remaining, 57);
});

test('stored running deadline survives reload and paused timer stays paused', () => {
  const f = fixture();
  f.timers.toggle('book', '2026-10-27', 1800, 1800);
  f.timers.toggle('pause', '2026-10-27', 600, 600);
  f.advance(10100);
  f.timers.toggle('pause', '2026-10-27', 600, 590);
  const reloaded = fixture(f.now() + 90000);
  reloaded.timers.restore(JSON.parse(JSON.stringify(f.saved())));
  reloaded.timers.tick();
  assert.equal(reloaded.timers.get('book').remaining, 1700);
  assert.equal(reloaded.timers.get('book').running, true);
  assert.equal(reloaded.timers.get('pause').remaining, 590);
  assert.equal(reloaded.timers.get('pause').running, false);
});

test('completion after suspension reports once and stays on the starting date', () => {
  const f = fixture();
  f.timers.toggle('book', '2026-10-27', 60, 60);
  f.advance(86400000); f.timers.tick(); f.timers.tick();
  assert.deepEqual(f.timers.get('book'), { remaining: 0, running: false, dateKey: '2026-10-27' });
  assert.deepEqual(f.reports.filter(report => report.elapsed === 60), [{ habit: 'book', date: '2026-10-27', elapsed: 60 }]);
  assert.equal(f.saved()[0].endsAt, null);
  f.timers.toggle('book', '2026-10-28', 60, 0);
  assert.equal(f.timers.get('book').dateKey, '2026-10-28');
  assert.equal(f.timers.get('book').remaining, 60);
});

test('adjusting running time updates the persisted deadline and survives suspension', () => {
  const f = fixture();
  f.timers.toggle('book', '2026-10-27', 60, 60);
  f.advance(10000);
  f.timers.adjust('book', '2026-10-27', 60, 50, 60);
  assert.equal(f.saved()[0].endsAt, f.now() + 110000);
  f.advance(90000); f.timers.tick();
  assert.equal(f.timers.get('book').remaining, 20);
  f.timers.adjust('book', '2026-10-27', 60, 20, -30);
  assert.equal(f.timers.get('book').remaining, 0);
  assert.equal(f.timers.get('book').running, false);
});

test('reset and mark complete stop the session intentionally', () => {
  const f = fixture();
  f.timers.toggle('book', '2026-10-27', 60, 40);
  f.timers.reset('book', '2026-10-27', 60);
  f.advance(5000); f.timers.tick();
  assert.equal(f.timers.get('book').remaining, 60);
  assert.equal(f.timers.get('book').running, false);
  f.timers.reset('book', '2026-10-27', 60, true);
  assert.equal(f.timers.get('book').remaining, 0);
  assert.equal(f.reports.at(-1).elapsed, 60);
});

test('restore rejects invalid data and removed habits cannot keep writing progress', () => {
  const f = fixture();
  f.timers.restore([null, {}, { habitId: 'bad', dateKey: '2026-10-27', targetSec: 60, remainingMs: 1000, endsAt: 'invalid' }]);
  assert.equal(f.timers.get('bad'), undefined);
  f.timers.toggle('deleted', '2026-10-27', 60, 60);
  f.timers.retain(() => false);
  const before = f.reports.length;
  f.advance(60000); f.timers.tick();
  assert.equal(f.timers.get('deleted'), undefined);
  assert.equal(f.reports.length, before);
  assert.deepEqual(f.saved(), []);
});
