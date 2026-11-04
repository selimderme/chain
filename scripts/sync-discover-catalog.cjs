const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function webCatalogSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'discoverCatalog.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  return '// Generated from src/discoverCatalog.ts. Run node scripts/sync-discover-catalog.cjs after catalog edits.\n' +
    '(function () {\nconst exports = {};\n' + compiled +
    '\nconst catalog = {habits: exports.DISCOVER_HABITS, categories: exports.DISCOVER_CATEGORIES, exists: exports.discoverHabitExists, simulationFrame: exports.simulationFrame};\n' +
    'if (typeof window !== "undefined") window.DiscoverCatalog = catalog;\n' +
    'if (typeof module !== "undefined" && module.exports) module.exports = catalog;\n})();\n';
}

if (require.main === module) fs.writeFileSync(path.join(__dirname, '..', 'discover-catalog.js'), webCatalogSource(), 'utf8');
module.exports = {webCatalogSource};
