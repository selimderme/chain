const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exercise the production responder lifecycle without touching device storage.
function fixture() {
  const effects = [], values = [], animations = [];
  let closed = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    memo: fn => fn, useRef: value => ({ current: value }),
    useMemo: fn => fn(), useEffect: fn => effects.push(fn),
  };
  const native = {
    Platform: { OS: 'web' }, AccessibilityInfo: {}, Pressable: 'Pressable', View: 'View',
    Easing: { out: value => value, cubic: 'cubic' },
    Animated: {
      createAnimatedComponent: value => value,
      Value: class {
        constructor(value) { this.value = value; values.push(this); }
        setValue(value) { this.value = value; }
        interpolate() { return 0; }
        stopAnimation() {}
      },
      timing: (value, config) => ({
        start: callback => { animations.push({ kind: 'timing', ...config }); value.setValue(config.toValue); callback?.({ finished: true }); },
        stop() {},
      }),
      spring: (value, config) => ({ start: () => { animations.push({ kind: 'spring', ...config }); value.setValue(config.toValue); } }),
    },
    PanResponder: { create: handlers => ({ panHandlers: handlers }) },
    StyleSheet: { create: value => value },
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'motion.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    if (name === 'react') return react;
    if (name === 'react-native') return native;
    if (name === 'react-native-svg') return {};
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom: 0 }) };
    throw Error(name);
  }, module, module.exports);
  const sheet = module.exports.SheetPressable({ onDismiss: () => closed++, children: 'Content' });
  const handle = sheet.children[0];
  sheet.props.onLayout({ nativeEvent: { layout: { height: 480 } } });
  const cleanups = effects.map(fn => fn());
  return { sheet, handle, drag: values[1], animations, closed: () => closed, dispose: () => cleanups.forEach(fn => fn?.()) };
}

test('sheet handle stays centered and reserves gestures for its own touch area', () => {
  const f = fixture();
  assert.equal(f.handle.type, 'View', 'Pressable would override the gesture responder handlers');
  assert.equal(f.handle.props.onStartShouldSetPanResponderCapture(), true);
  assert.equal(f.handle.props.style.left, 0);
  assert.equal(f.handle.props.style.right, 0);
  assert.equal(f.handle.props.style.alignItems, 'center');
  assert.equal(f.handle.props.style.touchAction, 'none');
  assert.equal(f.sheet.props.onMoveShouldSetPanResponder, undefined, 'content remains scrollable');
  assert.equal(f.handle.props.onMoveShouldSetPanResponder(null, { dx: 40, dy: 10 }), false);
  assert.equal(f.handle.props.onMoveShouldSetPanResponder(null, { dx: 1, dy: 10 }), true);
  f.dispose();
});

test('short, upward and interrupted pulls restore the panel without closing', () => {
  const f = fixture();
  const pan = f.handle.props;
  pan.onPanResponderGrant();
  pan.onPanResponderMove(null, { dy: 35 });
  assert.equal(f.drag.value, 35);
  pan.onPanResponderRelease(null, { dy: 35, vy: 0 });
  assert.equal(f.drag.value, 0);
  assert.equal(f.closed(), 0);
  pan.onPanResponderMove(null, { dy: -90 });
  assert.equal(f.drag.value, 0);
  pan.onPanResponderRelease(null, { dy: -90, vy: 0 });
  pan.onPanResponderMove(null, { dy: 90 });
  pan.onPanResponderTerminate();
  assert.equal(f.drag.value, 0);
  assert.equal(f.closed(), 0);
  f.dispose();
});

test('downward drag or flick closes once and resets the sheet for reopening', () => {
  for (const gesture of [{ dy: 85, vy: 0 }, { dy: 25, vy: 0.9 }]) {
    const f = fixture();
    f.handle.props.onPanResponderRelease(null, gesture);
    assert.equal(f.closed(), 1);
    assert.equal(f.animations.at(-1).toValue, 512, 'animate beyond the measured sheet height');
    assert.equal(f.drag.value, 0);
    f.dispose();
  }
});

test('keyboard activation closes the panel and consumes the activation key', () => {
  const f = fixture();
  let prevented = false;
  f.handle.props.onKeyDown({ key: 'Enter', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(f.closed(), 1);
  f.dispose();
});
