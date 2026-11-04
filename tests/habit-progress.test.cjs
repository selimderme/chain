const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

// Exercise the production bar across React updates and native layout events.
// Its animated clip may resize; its SVG drawing surface must stay measurable.
function fixture(initial = 0, reduceMotion = false) {
  const slots = [], animations = new Set();
  let cursor = 0, effects = [], props = { value: initial, color: '#00D9F5', height: 10, label: '100 g protein' };
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useId: () => ':progress:',
    useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
    useState(initial) {
      const i = cursor++;
      slots[i] ??= { value: initial };
      return [slots[i].value, update => { slots[i].value = typeof update === 'function' ? update(slots[i].value) : update; }];
    },
    useEffect(fn, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((dep, n) => dep !== previous.deps[n])) {
        previous?.cleanup?.();
        slots[i] = { deps };
        effects.push(() => { slots[i].cleanup = fn(); });
      }
    },
  };
  class Value {
    constructor(value) { this.value = value; }
    interpolate({ outputRange: [start, end] }) { return start + this.value * (end - start); }
    stopAnimation() { for (const animation of animations) if (animation.value === this) animations.delete(animation); }
  }
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'AuroraGlass.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => {
    if (name === 'react') return react;
    if (name === 'react-native') return {
      View: 'View', Platform: { OS: 'ios' }, StyleSheet: {},
      Easing: { cubic() {}, out: x => x },
      Animated: { View: 'AnimatedView', Value, timing: (value, config) => ({ start() {
        if (config.duration === 0) value.value = config.toValue;
        else animations.add({ value, toValue: config.toValue });
      } }) },
    };
    if (name === 'react-native-svg') return { __esModule: true, default: 'Svg', Defs: 'Defs', LinearGradient: 'LinearGradient', Rect: 'Rect', Stop: 'Stop' };
    if (name === 'expo-blur' || name === './SheetBackdrop') return {};
    if (name === './motion') return { isReduceMotion: () => reduceMotion };
    throw Error(name);
  }, module, module.exports);
  function render() {
    cursor = 0;
    const tree = module.exports.LiquidProgress(props);
    effects.splice(0).forEach(fn => fn());
    return tree;
  }
  return {
    render,
    resize(width) { render().props.onLayout({ nativeEvent: { layout: { width, height: props.height } } }); return render(); },
    update(value) { props = { ...props, value }; return render(); },
    settle() { for (const a of animations) a.value.value = a.toValue; animations.clear(); return render(); },
    pending: () => animations.size,
  };
}

function checkBar(tree, width, ratio) {
  const fill = tree.children.find(x => x?.type === 'AnimatedView');
  assert.ok(Math.abs(fill.props.style.width - width * ratio) < .001, 'fill width matches the entered amount');
  const clip = fill.children[0], svg = clip.children[0];
  assert.equal(clip.props.style.overflow, 'hidden');
  assert.equal(svg.props.width, width, 'SVG retains the full measured drawing width');
  assert.equal(svg.props.height, 10);
  const rect = svg.children.find(x => x?.type === 'Rect');
  assert.equal(rect.props.width, width);
  assert.equal(rect.props.height, 10);
  assert.equal(tree.props.accessibilityValue.now, Math.round(ratio * 100));
}

test('protein progress remains visible through increments, decrements and responsive layout changes', () => {
  const f = fixture();
  for (const width of [252, 322, 362, 252]) {
    f.resize(width);
    for (const value of [0, .35, .5, 1, .35, 0]) {
      f.update(value);
      checkBar(f.settle(), width, value);
    }
  }
});

test('saved progress renders on first layout and clamps empty, excessive and invalid values', () => {
  const f = fixture(.35);
  assert.equal(f.render().children.some(x => x?.type === 'AnimatedView'), false);
  checkBar(f.resize(320), 320, .35);
  for (const [input, expected] of [[1.5, 1], [-1, 0], [NaN, 0], [Infinity, 0]]) {
    f.update(input);
    checkBar(f.settle(), 320, expected);
  }
});

test('rapid adjustments cancel stale animations and reduced motion updates immediately', () => {
  const f = fixture();
  f.resize(320);
  for (const value of [.1, .2, .35]) f.update(value);
  assert.equal(f.pending(), 1);
  checkBar(f.settle(), 320, .35);
  const reduced = fixture(0, true);
  reduced.resize(320);
  reduced.update(.35);
  checkBar(reduced.render(), 320, .35);
  assert.equal(reduced.pending(), 0);
});

function webFixture() {
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const aurora = fs.readFileSync(path.join(__dirname, '..', 'aurora-system.js'), 'utf8');
  const habit = { id: 'protein', name: '100 g protein', emoji: '🍗', goal: { type: 'amount', target: 100, unit: 'g' } };
  const date = '2026-11-04', fill = { style: {} }, attributes = {}, amount = {}, complete = { classList: { toggle() {} }, setAttribute() {} };
  const track = { querySelector: () => fill, setAttribute: (key, value) => { attributes[key] = value; } };
  const calendar = { querySelectorAll: () => [] };
  const card = { dataset: {}, style: { setProperty() {} }, querySelector: selector => ({
    '.reference-value': null, '.aurora-track': track, '.aurora-track>i': fill,
    '.reference-amount': amount, '.reference-complete': complete, '.reference-calendar': calendar,
  })[selector] };
  let saved;
  const context = {
    state: { habits: [habit], marks: {}, progress: {} },
    todayInfo: () => ({ key: date }), en: () => false, t: tr => tr,
    esc: value => String(value), emblem: h => h.emoji,
    reorderMode: false, monthlyViewMode: false, weekOffset: 0, view: { y: 2026, m: 10 },
    color: () => '#00D9F5', dayMarkup: () => '',
    getProgress: (id, key) => context.state.progress?.[id]?.[key] || 0,
    getMark: (id, key) => context.state.marks?.[id]?.[key] || '',
    streaks: () => ({ cur: 3 }),
    save: () => { saved = JSON.stringify(context.state); },
    render: () => context.updateCard(card, habit, 0),
  };
  vm.createContext(context);
  vm.runInContext(app.slice(app.indexOf('function setProgressAndAutoMark('), app.indexOf('function fmtDuration(')) +
    aurora.slice(aurora.indexOf('  function faceMarkup('), aurora.indexOf('  function renderPanel(')), context);
  return { habit, card, fill, attributes, amount, context,
    adjust(value) { context.setProgressAndAutoMark(habit, date, value); },
    reload() { context.state = JSON.parse(saved); context.render(); },
    mark: () => context.getMark(habit.id, date),
  };
}

test('standalone amount, fill and automatic completion agree through updates and storage reload', () => {
  const f = webFixture();
  for (const [value, percent, mark] of [[0, 0, ''], [35, 35, 'b'], [100, 100, 'g'], [110, 100, 'g'], [35, 35, 'b'], [0, 0, '']]) {
    f.adjust(value);
    assert.equal(f.amount.textContent, value + ' g');
    assert.equal(f.fill.style.width, percent + '%');
    assert.equal(f.attributes['aria-valuenow'], percent);
    assert.equal(f.mark(), mark);
    f.reload();
    assert.equal(f.fill.style.width, percent + '%');
    assert.equal(f.mark(), mark);
  }
});

test('standalone habit cards omit streak badges and expose the amount progress', () => {
  const f = webFixture();
  f.adjust(35);
  assert.match(f.card.innerHTML, /role="progressbar" aria-label="100 g protein"/);
  for (const goal of [f.habit.goal, { type: 'timer', target: 60 }, undefined]) {
    assert.doesNotMatch(f.context.faceMarkup({ ...f.habit, goal }), /reference-streak|day streak|günlük seri/);
  }
});
