const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function compile(file) {
  return ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
}

test('windowed month strip retains every visible day at either end and while scrolling', () => {
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compile('utils.ts'))(() => ({}), module, module.exports);
  const { visibleDayRange } = module.exports;
  for (const count of [28, 29, 30, 31]) {
    for (const step of [35, 48, 90]) {
      const viewport = step * 7 - 8;
      const maxOffset = count * step - 8 - viewport;
      for (let offset = 0; offset <= maxOffset; offset += step / 2) {
        const [first, last] = visibleDayRange(count, offset, step, viewport);
        for (let day = 0; day < count; day++) {
          if (day * step < offset + viewport && (day + 1) * step > offset) {
            assert.ok(day >= first && day < last, `visible day ${day + 1} missing at ${offset}`);
          }
        }
        assert.ok(first >= 0 && last <= count);
        assert.ok(last - first <= 12, 'offscreen days should not all mount');
      }
    }
  }
});

// Run the production row's responder/timer lifecycle without a device or user data.
function rowFixture(options = {}) {
  const effects = [], listeners = new Map(), timers = new Map();
  let timerId = 0, controls;
  const calls = { begin: 0, end: [], moves: [], delays: [] };
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    memo: fn => fn,
    useRef: value => ({ current: value }),
    useMemo: fn => fn(),
    useEffect: fn => effects.push(fn),
    useLayoutEffect: fn => effects.push(fn),
    useState: value => [typeof value === 'function' ? value() : value, () => {}],
  };
  const native = {
    Platform: { OS: 'web' },
    AccessibilityInfo: {},
    Animated: {
      createAnimatedComponent: value => value, View: 'AnimatedView',
      Value: class { setValue() {} interpolate() { return 0; } },
      spring: () => ({ start: callback => callback?.({ finished: true }) }),
      parallel: () => ({ start: callback => callback?.({ finished: true }) }),
    },
    PanResponder: { create: handlers => ({ panHandlers: handlers }) },
    StyleSheet: { create: value => value },
  };
  const window = {
    addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
  };
  const module = { exports: {} };
  const imports = name => {
    if (name === 'react') return react;
    if (name === 'react-native') return native;
    if (name === 'react-native-svg') return {};
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom: 0 }) };
    throw Error(name);
  };
  new Function('require', 'module', 'exports', 'window', 'setTimeout', 'clearTimeout',
    compile('motion.tsx') + '\nexports.testRow = SpringDragRowWrapper;')(
    imports, module, module.exports, window,
    (fn, delay) => { calls.delays.push(delay); const id = ++timerId; timers.set(id, fn); return id; }, id => timers.delete(id)
  );
  module.exports.testRow({
    itemKey: 'test', index: 0, translateY: 0, lift: { interpolate: () => 0 }, accentColor: '#fff', borderRadius: 20,
    ...options,
    onRegisterRowRef() {}, onMeasureHeight() {}, onBeginDrag: () => calls.begin++, onMoveDrag: (_index, delta) => calls.moves.push(delta),
    onEndDrag: cancel => calls.end.push(cancel), renderContent: value => { controls = value; return null; },
  });
  const cleanups = effects.map(fn => fn());
  return {
    calls, controls, renderList: props => module.exports.SpringDragList(props),
    start: () => controls.longPressDragProps.onStartShouldSetPanResponderCapture({ nativeEvent: { pageX: 0, pageY: 0 } }),
    advance: () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    dispatch: name => [...(listeners.get(name) || [])].forEach(fn => fn()),
    dispose: () => cleanups.forEach(fn => fn?.()),
  };
}

test('quick mouse clicks never start a delayed drag after release', () => {
  const f = rowFixture();
  for (let i = 0; i < 3; i++) { f.start(); f.dispatch('pointerup'); f.advance(); }
  assert.equal(f.calls.begin, 0);
  assert.deepEqual(f.calls.end, []);
  f.dispose();
});

test('held horizontal tabs use horizontal movement and suppress the following click', () => {
  const f = rowFixture({ axis: 'horizontal', holdDelay: 450 });
  f.start();
  assert.equal(f.calls.delays.at(-1), 450);
  f.advance();
  f.controls.longPressDragProps.onPanResponderMove(null, { dx: 100, dy: 3 });
  assert.deepEqual(f.calls.moves, [100]);
  f.dispatch('pointerup');
  assert.equal(f.controls.consumeLongPress(), true);
  assert.equal(f.controls.consumeLongPress(), false);
  f.dispose();
});

test('horizontal drag reorders on release and never opens the stationary menu', () => {
  for (const mode of ['stationary', 'drag', 'small-move', 'cancel']) {
    const f = rowFixture();
    const moved = [], menus = [];
    const tree = f.renderList({ items: ['a', 'b', 'c'], keyExtractor: id => id, axis: 'horizontal', onReorder: (...args) => moved.push(args), onLongPressNoDrag: id => menus.push(id), renderItem: () => null });
    const row = tree.children[0][0].props;
    row.onBeginDrag(0);
    if (mode === 'drag') row.onMoveDrag(0, 100);
    if (mode === 'small-move') row.onMoveDrag(0, 12);
    row.onEndDrag(mode === 'cancel');
    assert.deepEqual(menus, mode === 'stationary' ? ['a'] : [], mode);
    assert.deepEqual(moved, mode === 'drag' ? [[0, 1]] : [], mode);
    f.dispose();
  }
});

test('long press still starts dragging and releases exactly once', () => {
  const f = rowFixture();
  f.start(); f.advance();
  assert.equal(f.calls.begin, 1);
  f.dispatch('pointerup'); f.controls.longPressDragProps.onTouchEnd();
  assert.deepEqual(f.calls.end, [false]);
  f.dispose();
});

test('pointer cancellation, window blur and unmount cancel pending drag timers', () => {
  for (const event of ['pointercancel', 'blur', 'unmount']) {
    const f = rowFixture();
    f.start();
    if (event === 'unmount') f.dispose(); else f.dispatch(event);
    f.advance();
    assert.equal(f.calls.begin, 0, event);
    f.dispose();
  }
});

test('a scroll movement cancels long press while the drag handle remains immediate', () => {
  const f = rowFixture();
  f.start();
  f.controls.longPressDragProps.onMoveShouldSetPanResponderCapture({ nativeEvent: { pageX: 0, pageY: 20 } });
  f.advance();
  assert.equal(f.calls.begin, 0);
  f.controls.handleProps.onStartShouldSetPanResponderCapture();
  f.controls.handleProps.onPanResponderGrant();
  assert.equal(f.calls.begin, 1);
  f.dispatch('pointerup');
  assert.deepEqual(f.calls.end, []);
  f.controls.handleProps.onPanResponderRelease();
  assert.deepEqual(f.calls.end, [false]);
  f.dispose();
});
