// Measures how distinct the enemy wizards actually are, because "they all look the same" is a
// claim about a distribution and not about any one fight.
//
//   npx tsx server/src/lookstest.ts
//
// Fails if neighbouring levels are too similar or if any look repeats within a chapter.
import { writeFileSync } from 'node:fs';
import { MAX_LEVEL, enemyForLevel, enemyLook, type WizardLook } from '@wizard/shared';

const KEYS: (keyof WizardLook)[] = [
  'robe', 'hat', 'trim', 'skin', 'beardColor', 'boots', 'hatStyle', 'staffStyle', 'beard', 'cape',
];

function shared(a: WizardLook, b: WizardLook): number {
  return KEYS.filter(k => a[k] === b[k]).length;
}

/** Rounded so two builds that differ by a hair do not count as different. */
function signature(l: WizardLook): string {
  return [...KEYS.map(k => String(l[k])), l.girth.toFixed(1), l.height.toFixed(1)].join('|');
}

const looks: WizardLook[] = [];
for (let level = 1; level <= MAX_LEVEL; level++) looks.push(enemyLook(enemyForLevel(level)));

let worstNeighbour = 0, worstAt = 0;
const neighbourCounts: number[] = new Array(KEYS.length + 1).fill(0);
for (let i = 1; i < looks.length; i++) {
  const n = shared(looks[i - 1], looks[i]);
  neighbourCounts[n]++;
  if (n > worstNeighbour) { worstNeighbour = n; worstAt = i + 1; }
}

const sigs = looks.map(signature);
const distinct = new Set(sigs).size;

// The window that matters is the one a player sees in a session: a run of ten levels.
let windowDupes = 0;
for (let i = 0; i < sigs.length; i++) {
  for (let j = i + 1; j < Math.min(sigs.length, i + 10); j++) if (sigs[i] === sigs[j]) windowDupes++;
}

const girths = looks.map(l => l.girth);
const heights = looks.map(l => l.height);
const range = (v: number[]): string => `${Math.min(...v).toFixed(2)}..${Math.max(...v).toFixed(2)}`;

console.log(`--- enemy looks over ${MAX_LEVEL} levels`);
console.log(`  distinct looks            ${distinct} of ${MAX_LEVEL}`);
console.log(`  attributes shared by neighbours, out of ${KEYS.length}:`);
neighbourCounts.forEach((c, n) => { if (c) console.log(`    ${String(n).padStart(2)} shared   ${c}`); });
console.log(`  worst neighbour pair      ${worstNeighbour} shared, at level ${worstAt}`);
console.log(`  repeats within ten levels ${windowDupes}`);
console.log(`  girth ${range(girths)}   height ${range(heights)}`);
for (const key of ['skin', 'hatStyle', 'staffStyle', 'trim', 'boots', 'beardColor'] as const) {
  const seen = new Map<string, number>();
  for (const l of looks) seen.set(String(l[key]), (seen.get(String(l[key])) ?? 0) + 1);
  const counts = [...seen.values()].sort((a, b) => a - b);
  console.log(`  ${key.padEnd(11)} ${seen.size} values, ${counts[0]}..${counts[counts.length - 1]} uses each`);
}

// --dump <file> <level,level,...> writes those looks out for tools/wizard-model.py --lineup, which
// renders them side by side. Numbers prove the combinations differ; only a picture shows whether
// the differences read.
const dump = process.argv.indexOf('--dump');
if (dump > 0) {
  const path = process.argv[dump + 1];
  const levels = (process.argv[dump + 2] ?? '3,17,42,88,150,275')
    .split(',').map(Number).filter(n => n >= 1 && n <= MAX_LEVEL);
  writeFileSync(path, JSON.stringify(levels.map(l => ({ level: l, ...enemyLook(enemyForLevel(l)) })), null, 2));
  console.log(`  wrote ${levels.length} looks to ${path}`);
}

const fail: string[] = [];
if (worstNeighbour > 6) fail.push(`neighbouring levels share ${worstNeighbour} of ${KEYS.length} attributes`);
if (windowDupes > 0) fail.push(`${windowDupes} looks repeat within ten levels of each other`);
if (distinct < MAX_LEVEL * 0.9) fail.push(`only ${distinct} distinct looks`);
if (fail.length) { console.error('looks test FAILED: ' + fail.join('; ')); process.exit(1); }
console.log('looks test ok');
