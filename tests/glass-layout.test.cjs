const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Render the production material through repeated host-layout changes.
// Native SVG caches percentage paths, so the draw geometry must change too.
function fixture() {
  let size;
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useId: () => ':glass:',
    useState: initial => {
      size ??= initial;
      return [size, update => { size = update(size); }];
    },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'AuroraGlass.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', compiled)(name => {
    if (name === 'react') return react;
    if (name === 'react-native') return {
      View: 'View', Platform: { OS: 'ios' },
      StyleSheet: { absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 } },
    };
    if (name === 'react-native-svg') return {
      __esModule: true, default: 'Svg', Defs: 'Defs', Ellipse: 'Ellipse',
      LinearGradient: 'LinearGradient', RadialGradient: 'RadialGradient', Rect: 'Rect', Stop: 'Stop',
    };
    if (name === 'expo-blur') return { BlurView: 'BlurView' };
    if (name === './SheetBackdrop') return { useBlurTarget: () => null };
    if (name === './motion') return {};
    throw Error(name);
  }, module, module.exports);
  const render = () => module.exports.GlassMaterial({});
  return {
    render,
    resize(width, height) {
      render().props.onLayout({ nativeEvent: { layout: { width, height } } });
      return render();
    },
    size: () => size,
  };
}

function checkBounds(tree, width, height) {
  const svg = tree.children.find(child => child?.type === 'Svg');
  assert.equal(svg.props.width, width);
  assert.equal(svg.props.height, height);
  assert.equal(svg.props.viewBox, `0 0 ${width} ${height}`);
  const [fill, rim] = svg.children.filter(child => child?.type === 'Rect');
  assert.equal(fill.props.width, width);
  assert.equal(fill.props.height, height);
  // The outer edge of the stroke must meet the current panel edge.
  assert.equal(rim.props.x + rim.props.width + Number(rim.props.strokeWidth) / 2, width);
  assert.equal(rim.props.y + rim.props.height + Number(rim.props.strokeWidth) / 2, height);
  const glow = svg.children.find(child => child?.type === 'Ellipse');
  assert.equal(glow.props.cy, height);
  assert.equal(glow.props.cx, width);
}

test('opening and closing the emoji gallery keeps the glass rim at the panel edge', () => {
  const f = fixture();
  for (const width of [320, 390, 430]) {
    for (const height of [296, 468, 296, 468]) checkBounds(f.resize(width, height), width, height);
  }
});

test('switching to the date picker and resizing the screen updates every glass layer', () => {
  const f = fixture();
  for (const [width, height] of [[390, 512], [390, 780], [760, 340], [320, 540], [390, 512]]) {
    checkBounds(f.resize(width, height), width, height);
  }
});

test('the material cannot intercept content touches or create repeated layout updates', () => {
  const f = fixture();
  assert.equal(f.render().children.some(child => child?.type === 'Svg'), false, 'wait for a valid host size');
  const tree = f.resize(390, 468);
  assert.equal(tree.props.pointerEvents, 'none');
  const previous = f.size();
  f.resize(390, 468);
  assert.strictEqual(f.size(), previous, 'identical layout events do not trigger another render');
});
