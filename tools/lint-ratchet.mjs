#!/usr/bin/env node
/**
 * Lint ratchet: ESLint errors always fail. Warnings are the house rules the existing code does not meet yet; they may stay but may not GROW.
 * The allowed count per rule is in lint.baseline.json. When you fix some, run `npm run lint:ratchet:update` to lock the lower numbers in.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BASELINE = `${ROOT}lint.baseline.json`;
const update = process.argv.includes('--update');
const run = spawnSync('npx', ['eslint', '.', '--format', 'json'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
});
let results;
try {
  results = JSON.parse(run.stdout);
} catch {
  console.error(run.stderr || run.stdout);
  process.exit(2);
}
const rules = {};
let errors = 0;
for (const f of results)
  for (const m of f.messages) {
    if (m.severity === 2) errors++;
    else rules[m.ruleId ?? 'unknown'] = (rules[m.ruleId ?? 'unknown'] ?? 0) + 1;
  }
const total = Object.values(rules).reduce((a, b) => a + b, 0);
if (update) {
  writeFileSync(
    BASELINE,
    JSON.stringify({ total, rules: Object.fromEntries(Object.entries(rules).sort()) }, null, 2) + '\n',
  );
  console.log(`baseline written: ${total} warnings`);
  process.exit(errors ? 1 : 0);
}
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { total: 0, rules: {} };
const worse = Object.entries(rules).filter(([r, n]) => n > (base.rules[r] ?? 0));
const better = Object.entries(base.rules).filter(([r, n]) => (rules[r] ?? 0) < n);
console.log(`ESLint: ${errors} errors, ${total} warnings (allowed ${base.total}).`);
if (errors) {
  console.error('Errors must be fixed: run `npx eslint .`');
  process.exit(1);
}
if (worse.length || total > base.total) {
  for (const [r, n] of worse)
    console.error(`  more warnings than allowed for ${r}: ${n} (allowed ${base.rules[r] ?? 0})`);
  console.error('Fix the new warnings (the baseline only goes down).');
  process.exit(1);
}
if (better.length)
  console.log(
    `Warnings went down for ${better.map(([r]) => r).join(', ')}: run \`npm run lint:ratchet:update\` to lock it in.`,
  );
