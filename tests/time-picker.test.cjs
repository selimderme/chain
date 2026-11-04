const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function nativeWheel(count, initialValue, platform = 'ios') {
  const refs = [], effects = [], timers = new Map(), changes = [], moves = [];
  let hook = 0, timer = 0, selectedValue = initialValue;
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useMemo: fn => fn(),
    useRef: value => refs[hook++] ??= { current: value },
    useEffect: (fn, deps) => {
      const index = hook++;
      if (!refs[index] || deps.some((value, i) => value !== refs[index][i])) {
        refs[index] = deps;
        effects.push(fn);
      }
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'TimeWheelColumn.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', compiled)(name => {
    if (name === 'react') return react;
    if (name === 'react-native') return {
      Platform: { OS: platform }, View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: value => value },
      Animated: {
        ScrollView: 'ScrollView', Text: 'Text',
        Value: class { constructor(value) { this.value = value; } setValue(value) { this.value = value; } interpolate(config) { return config; } },
        event: (_mapping, config) => config.listener,
      },
    };
    if (name === 'expo-haptics') return { selectionAsync: async () => {} };
    if (name === './utils') return { pad: value => String(value).padStart(2, '0') };
    throw Error(name);
  }, module, module.exports, fn => { timers.set(++timer, fn); return timer; }, id => timers.delete(id));
  const items = Array.from({ length: count }, (_, i) => i);
  const render = () => {
    hook = 0;
    const tree = module.exports.default({ label: count === 60 ? 'DAKİKA' : 'SAAT', items, selectedValue, onValueChange: value => { selectedValue = value; changes.push(value); } });
    const wheel = tree.children[1].children[1];
    wheel.props.ref.current = { scrollTo: config => moves.push(config) };
    effects.splice(0).forEach(fn => fn());
    return wheel;
  };
  return {
    render, changes, moves, value: () => selectedValue,
    tap(delta) {
      const wheel = render();
      const index = count + selectedValue + delta;
      wheel.props.onTouchStart();
      wheel.props.onTouchEnd();
      wheel.children[0][index].props.onPress();
      return render();
    },
    advance() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    setExternal(value) { selectedValue = value; return render(); },
  };
}

for (const count of [24, 60]) {
  test(`native ${count}-value wheel wraps on taps in both directions without duplicate changes`, () => {
    const f = nativeWheel(count, count - 1);
    f.tap(1);
    assert.equal(f.value(), 0);
    f.tap(-1);
    assert.equal(f.value(), count - 1);
    for (let i = 0; i < count + 3; i++) {
      const before = f.value();
      const wheel = f.tap(1);
      // Delayed positioning events and momentum callbacks must not undo a tap.
      wheel.props.onScroll({ nativeEvent: { contentOffset: { y: (count + before) * 42 } } });
      wheel.props.onMomentumScrollEnd();
      f.advance();
      assert.equal(f.value(), (before + 1) % count);
    }
    assert.equal(f.changes.length, count + 5);
    assert.ok(f.moves.some(move => move.animated === true));
  });

  test(`native ${count}-value wheel keeps swiping across its boundary and recenters after release`, () => {
    const f = nativeWheel(count, count - 1);
    const wheel = f.render();
    wheel.props.onTouchStart();
    wheel.props.onScrollBeginDrag();
    for (const index of [count * 2, count * 2 + 1, count * 2 + 2]) {
      wheel.props.onScroll({ nativeEvent: { contentOffset: { y: index * 42 } } });
      f.render();
      assert.equal(f.moves.length, 0, 'selection renders must not reposition an active swipe');
    }
    assert.deepEqual(f.changes, [0, 1, 2]);
    wheel.props.onTouchEnd();
    wheel.props.onScrollEndDrag();
    f.advance();
    assert.equal(f.moves.at(-1).y, (count + 2) * 42);
    assert.equal(f.value(), 2);
  });
}

test('native wheel accepts a changed value from its parent without reporting it as a user change', () => {
  const f = nativeWheel(60, 20);
  f.render();
  f.setExternal(45);
  assert.equal(f.moves.at(-1).y, 105 * 42);
  assert.deepEqual(f.changes, []);
});

test('initial layout scroll events cannot replace the selected time with zero', () => {
  const f = nativeWheel(24, 12, 'web');
  const wheel = f.render();
  wheel.props.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
  wheel.props.onLayout();
  assert.deepEqual(f.moves.at(-1), { y: 36 * 42, animated: false });
  assert.equal(f.value(), 12);
  assert.deepEqual(f.changes, []);
});

test('Expo web wheel handles mouse scrolling and a subsequent tap independently', () => {
  const f = nativeWheel(60, 59, 'web');
  const wheel = f.render();
  wheel.props.onWheel();
  wheel.props.onScroll({ nativeEvent: { contentOffset: { y: 120 * 42 } } });
  f.advance();
  assert.equal(f.value(), 0);
  f.tap(1);
  assert.equal(f.value(), 1);
  assert.deepEqual(f.changes, [0, 1]);
});

function webWheel(count, initialValue) {
  const listeners = new Map(), timers = new Map(), moves = [];
  let timer = 0;
  const state = { h: 19, min: initialValue };
  const field = count === 60 ? 'min' : 'h';
  state[field] = initialValue;
  const wheel = {
    isConnected: true, scrollTop: 0,
    querySelectorAll: () => [],
    addEventListener: (name, fn) => listeners.set(name, fn),
    scrollTo(config) { this.scrollTop = config.top; moves.push(config); },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const start = source.indexOf('function syncWheelActiveClasses(');
  const end = source.indexOf('function renderTaskDatePickerBody(', start);
  const bind = new Function('dtPickerState', 'WEB_WHEEL_ITEM_H', 'updateDatePickerPreviewText', 'setTimeout', 'clearTimeout',
    source.slice(start, end) + '\nbindTimeWheel(arguments[5], arguments[6], arguments[7]); return timeWheelControls.get(arguments[5]);');
  const control = bind(state, 40, () => {}, fn => { timers.set(++timer, fn); return timer; }, id => timers.delete(id), wheel, count, field);
  return {
    wheel, state, control, moves, field,
    fire(name) { listeners.get(name)?.(); },
    advance() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
  };
}

for (const count of [24, 60]) {
  test(`standalone web ${count}-value wheel wraps and ignores scroll events after a tap`, () => {
    const f = webWheel(count, count - 1);
    assert.equal(f.wheel.scrollTop, (count * 2 - 1) * 40);
    f.fire('wheel');
    f.wheel.scrollTop = count * 2 * 40;
    f.fire('scroll');
    f.advance();
    assert.equal(f.state[f.field], 0);
    assert.equal(f.wheel.scrollTop, count * 40);
    f.control.select(count - 1);
    f.wheel.scrollTop = count * 40;
    f.fire('scroll');
    f.advance();
    assert.equal(f.state[f.field], count - 1);
    assert.ok(f.moves.some(move => move.behavior === 'smooth'));
  });

  test(`native ${count}-value tap glides one row across zero and keeps its selection during animation`, () => {
    const f = nativeWheel(count, count - 1);
    const wheel = f.tap(1);
    assert.deepEqual(f.moves.at(-1), { y: count * 2 * 42, animated: true });
    wheel.props.onScroll({ nativeEvent: { contentOffset: { y: (count * 2 - 0.7) * 42 } } });
    assert.equal(f.value(), 0, 'intermediate animation frames must not overwrite the tapped value');
    wheel.props.onMomentumScrollEnd();
    assert.deepEqual(f.moves.at(-1), { y: count * 42, animated: false });
    assert.deepEqual(f.changes, [0]);
  });

  test(`standalone web ${count}-value tap takes the nearest path and allows a new gesture to interrupt`, () => {
    const f = webWheel(count, count - 1);
    f.control.select(0);
    assert.deepEqual(f.moves.at(-1), { top: count * 2 * 40, behavior: 'smooth' });
    f.wheel.scrollTop = (count * 2 - 0.7) * 40;
    f.fire('scroll');
    assert.equal(f.state[f.field], 0);
    f.fire('wheel');
    f.wheel.scrollTop = (count * 2 + 1) * 40;
    f.fire('scroll');
    f.advance();
    assert.equal(f.state[f.field], 1);
    assert.equal(f.wheel.scrollTop, (count + 1) * 40);
  });
}
