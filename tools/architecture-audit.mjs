#!/usr/bin/env node
/**
 * Architecture inventory of src/ (read-only, no dependencies): what talks to storage, which keys are saved, how layers and features import each other, how big and how dense the files are,
 * where data is hard-coded. Prints Markdown. Run: `npm run audit:architecture` (add `> docs/architecture/audit-data.md` to refresh the saved copy).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)); const SRC = join(ROOT, 'src');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
const files = walk(SRC).map((p) => ({ path: relative(ROOT, p).split(sep).join('/'), text: readFileSync(p, 'utf8') }));
const LIB = /^src\/components\/(base|application|foundations|shared-assets)\//; const ours = files.filter((f) => !LIB.test(f.path)); const lines = (t) => t.split('\n');
const out = []; const h = (t) => out.push(`\n## ${t}\n`); const table = (head, rows) => { out.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)); };
const top = (arr, n) => arr.sort((a, b) => b[1] - a[1]).slice(0, n);

out.push('# Architecture inventory (generated)'); out.push(`Files: ${files.length} (${ours.length} ours, ${files.length - ours.length} Untitled UI library). Lines (ours): ${ours.reduce((n, f) => n + lines(f.text).length, 0)}.`);

h('1. Storage access outside the storage layer');
const storageUse = ours.filter((f) => /\b(localStorage|sessionStorage)\b/.test(f.text) && f.path !== 'src/data/storage.ts').map((f) => [f.path, (f.text.match(/\b(localStorage|sessionStorage)\b/g) ?? []).length]);
out.push(`Files touching local/session storage directly (everything except \`src/data/storage.ts\` should go through a \`StorageBackend\`): **${storageUse.length}**`); table(['file', 'uses'], top(storageUse, 40).map(([f, n]) => [f, String(n)]));

h('2. Saved keys');
const keys = new Map(); for (const f of ours) for (const m of f.text.matchAll(/['"`](atiflow\.[A-Za-z0-9_.-]+|sb-collapsed)['"`]/g)) keys.set(m[1], [...(keys.get(m[1]) ?? []), f.path]);
table(['key', 'defined in'], [...keys].sort().map(([k, v]) => [`\`${k}\``, [...new Set(v)].join(', ')]));

h('3. Layer imports (src/core, adapters, engine, ui, data, components, features)');
const layerOf = (p) => { const m = p.match(/^src\/([^/]+)/); return m ? m[1] : 'root'; }; const importsOf = (f) => [...f.text.matchAll(/(?:import|export)[^'"`;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1] ?? m[2]);
const resolve = (from, spec) => { if (spec.startsWith('@/')) return 'src/' + spec.slice(2); if (spec.startsWith('.')) { const parts = from.split('/'); parts.pop(); for (const s of spec.split('/')) { if (s === '..') parts.pop(); else if (s !== '.') parts.push(s); } return parts.join('/'); } return null; };
const matrix = {}; const bad = [];
const RULES = { core: ['core', 'data'], adapters: ['adapters', 'core', 'data'], engine: ['engine', 'core', 'data'] };
for (const f of ours) for (const spec of importsOf(f)) { const t = resolve(f.path, spec); if (!t) continue; const a = layerOf(f.path), b = layerOf(t); matrix[a] ??= {}; matrix[a][b] = (matrix[a][b] ?? 0) + 1; if (RULES[a] && !RULES[a].includes(b)) bad.push(`${f.path} -> ${t}`); }
const layers = [...new Set(Object.keys(matrix).concat(...Object.values(matrix).map(Object.keys)))].sort();
table(['from \\ to', ...layers], layers.filter((a) => matrix[a]).map((a) => [a, ...layers.map((b) => String(matrix[a][b] ?? ''))]));
out.push(`\nBreaks of the documented rule (core/adapters/engine import only core + data): **${bad.length}**`); bad.slice(0, 30).forEach((b) => out.push(`- ${b}`));

h('4. Feature-to-feature imports (src/features/<a> -> src/features/<b>)');
const fx = {}; for (const f of ours) { const a = f.path.match(/^src\/features\/([^/]+)/)?.[1]; if (!a) continue; for (const spec of importsOf(f)) { const t = resolve(f.path, spec); const b = t?.match(/^src\/features\/([^/]+)/)?.[1]; if (b && b !== a) { fx[`${a} -> ${b}`] = (fx[`${a} -> ${b}`] ?? 0) + 1; } } }
out.push(`Distinct feature pairs: **${Object.keys(fx).length}**, imports: **${Object.values(fx).reduce((n, v) => n + v, 0)}** (deep imports into another feature's internals are the coupling to remove).`); table(['pair', 'imports'], top(Object.entries(fx), 25).map(([k, v]) => [k, String(v)]));

h('5. Size and density');
const sized = ours.map((f) => [f.path, lines(f.text).length, Math.max(...lines(f.text).map((l) => l.length))]);
out.push(`Files over 300 lines: **${sized.filter((s) => s[1] > 300).length}**. Lines over 160 characters: **${ours.reduce((n, f) => n + lines(f.text).filter((l) => l.length > 160).length, 0)}** of ${ours.reduce((n, f) => n + lines(f.text).length, 0)}. Lines over 300 characters: **${ours.reduce((n, f) => n + lines(f.text).filter((l) => l.length > 300).length, 0)}**.`);
table(['largest files', 'lines', 'longest line'], top(sized.map((s) => [s[0], s[1], s[2]]), 12).map((s) => [s[0], String(s[1]), String(s[2])]));
table(['densest files (lines > 160 chars)', 'count'], top(ours.map((f) => [f.path, lines(f.text).filter((l) => l.length > 160).length]), 12).map(([f, n]) => [f, String(n)]));

h('6. Hard-coded data and risky patterns (outside tests)');
const count = (re, fs = ours) => fs.reduce((n, f) => n + (f.text.match(re) ?? []).length, 0); const where = (re) => ours.filter((f) => re.test(f.text)).map((f) => f.path);
table(['pattern', 'occurrences', 'files'], [
  ['station ids (`STA-###`)', count(/STA-\d{3}/g), where(/STA-\d{3}/).length], ['fleet names ("Line Side Fleet" / "Assembly Fleet")', count(/Line Side Fleet|Assembly Fleet/g), where(/Line Side Fleet|Assembly Fleet/).length],
  ['`public/sites/` paths', count(/public\/sites|\/sites\//g), where(/public\/sites|\/sites\//).length], ['plain-text passwords (`password:`)', count(/password: '/g), where(/password: '/).length],
  ['`any` type', count(/:\s*any\b|as any\b|<any>/g), where(/:\s*any\b|as any\b|<any>/).length], ['`eslint-disable` comments', count(/eslint-disable/g), where(/eslint-disable/).length],
  ['`console.*` calls', count(/console\.(log|warn|error|info)/g), where(/console\.(log|warn|error|info)/).length], ['`window.__` dev handles', count(/window\.__|\{ __/g), where(/Object\.assign\(window/).length],
  ['`TODO` / `FIXME`', count(/TODO|FIXME/g), where(/TODO|FIXME/).length], ['`setTimeout` / `setInterval`', count(/setTimeout|setInterval/g), where(/setTimeout|setInterval/).length],
].map((r) => r.map(String)));

h('7. Stores (zustand) and where their state is saved');
const stores = ours.filter((f) => /createStore|create<|createDocument\(/.test(f.text)).map((f) => [f.path, /createDocument\(|localBackend/.test(f.text) ? 'StorageBackend' : /localStorage/.test(f.text) ? 'localStorage directly' : 'memory only']);
table(['file', 'persistence'], stores);

console.log(out.join('\n'));
