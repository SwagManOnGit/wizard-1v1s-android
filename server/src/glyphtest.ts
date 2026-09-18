// Confusion test for the glyph library: perturbs each template like a finger would and checks
// the recogniser still names it. Stroke direction counts, so a sign drawn backwards is expected
// to be a *different* glyph, never its own twin. Run with: npx tsx src/glyphtest.ts
import { ALL_GLYPH_IDS, GLYPHS, Recognizer, SPELLS, glyphStroke, spellStroke, type Point } from '@wizard/shared';

function perturb(pts: Point[], jitter: number, rot: number, scale: number): Point[] {
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const moved = pts.map(p => {
    const x = (p.x - 50) * scale, y = (p.y - 50) * scale;
    return { x: 150 + x * cos - y * sin, y: 150 + x * sin + y * cos };
  });
  const dense: Point[] = [];
  for (let i = 0; i < moved.length - 1; i++) {
    for (let k = 0; k < 3; k++) {
      const t = k / 3;
      dense.push({
        x: moved[i].x + (moved[i + 1].x - moved[i].x) * t + (Math.random() - 0.5) * jitter,
        y: moved[i].y + (moved[i + 1].y - moved[i].y) * t + (Math.random() - 0.5) * jitter,
      });
    }
  }
  dense.push(moved[moved.length - 1]);
  return dense;
}

const TRIALS = 30;

function run(label: string, entries: { key: string; points: Point[] }[]): number {
  const rec = new Recognizer<string>();
  for (const e of entries) rec.add(e.key, e.points);
  const rows: { id: string; ok: number; min: number; wrong: Record<string, number> }[] = [];
  let total = 0, hits = 0;
  for (const e of entries) {
    let ok = 0, min = 1;
    const wrong: Record<string, number> = {};
    for (let i = 0; i < TRIALS; i++) {
      const p = perturb(e.points, 5, (Math.random() - 0.5) * 0.28, 1.4 + Math.random() * 0.6);
      const m = rec.recognize(p);
      total++;
      if (m && m.key === e.key) { ok++; hits++; min = Math.min(min, m.score); }
      else if (m) wrong[m.key] = (wrong[m.key] ?? 0) + 1;
    }
    rows.push({ id: e.key, ok, min, wrong });
  }
  rows.sort((a, b) => a.ok - b.ok);
  console.log(`\n== ${label}: ${entries.length} templates  overall=${hits}/${total} (${((hits / total) * 100).toFixed(1)}%)`);
  for (const r of rows.slice(0, 14)) {
    if (r.ok === TRIALS) break;
    console.log(`  ${r.id.padEnd(14)} ${r.ok}/${TRIALS} min=${r.ok ? r.min.toFixed(2) : '-'} ${Object.keys(r.wrong).length ? 'confused_with=' + JSON.stringify(r.wrong) : ''}`);
  }
  return hits / total;
}

// 1. Every template, drawn forwards: the shape library on its own.
const a = run('templates, forward only', ALL_GLYPH_IDS.map(id => ({ key: id, points: GLYPHS[id].points })));

// 2. Every template in both directions at once: the worst case the game could ever ask for, since
//    a reversed stroke must not be mistaken for its own forward twin.
const b = run('templates, both directions', ALL_GLYPH_IDS.flatMap(id => [
  { key: id, points: glyphStroke(id) },
  { key: `${id}:rev`, points: glyphStroke(id, true) },
]));

// 3. What the game actually arms: one directional template per spell.
const c = run('spell strokes (what the game arms)', SPELLS.map(s => ({ key: s.id, points: spellStroke(s) })));

// 4. Nearest-neighbour check on the clean spell strokes: how close is each spell to its rival?
console.log('\n--- closest rival per spell (clean strokes, lower is safer)');
const pairs: { a: string; b: string; score: number }[] = [];
for (const s of SPELLS) {
  const solo = new Recognizer<string>();
  for (const other of SPELLS) if (other.id !== s.id) solo.add(other.id, spellStroke(other));
  const m = solo.recognize(spellStroke(s));
  if (m) pairs.push({ a: s.id, b: m.key, score: m.score });
}
pairs.sort((x, y) => y.score - x.score);
for (const p of pairs.slice(0, 12)) console.log(`  ${p.a.padEnd(14)} ~ ${p.b.padEnd(14)} ${p.score.toFixed(2)}`);

const worst = Math.min(a, b, c);
console.log(`\nworst pass rate ${(worst * 100).toFixed(1)}%`);
process.exit(worst >= 0.97 ? 0 : 1);
