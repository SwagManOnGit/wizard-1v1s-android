// Confusion test for the glyph library: perturbs each template like a finger would and checks
// the recogniser still names it. Run with: npx tsx src/glyphtest.ts
import { ALL_GLYPH_IDS, GLYPHS, Recognizer, type Point } from '@wizard/shared';

const rec = new Recognizer<string>();
for (const id of ALL_GLYPH_IDS) rec.add(id, GLYPHS[id].points);

function perturb(pts: Point[], jitter: number, rot: number, scale: number, reverse: boolean): Point[] {
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
  if (reverse) dense.reverse();
  return dense;
}

const TRIALS = 30;
const rows: { id: string; ok: number; min: number; wrong: Record<string, number> }[] = [];
let total = 0, hits = 0;
for (const id of ALL_GLYPH_IDS) {
  let ok = 0, min = 1;
  const wrong: Record<string, number> = {};
  for (let i = 0; i < TRIALS; i++) {
    const p = perturb(GLYPHS[id].points, 5, (Math.random() - 0.5) * 0.28, 1.4 + Math.random() * 0.6, Math.random() < 0.5);
    const m = rec.recognize(p);
    total++;
    if (m && m.key === id) { ok++; hits++; min = Math.min(min, m.score); }
    else if (m) wrong[m.key] = (wrong[m.key] ?? 0) + 1;
  }
  rows.push({ id, ok, min, wrong });
}

rows.sort((a, b) => a.ok - b.ok);
console.log(`glyphs=${ALL_GLYPH_IDS.length}  overall=${hits}/${total} (${((hits / total) * 100).toFixed(1)}%)`);
console.log('--- weakest first');
for (const r of rows.slice(0, 16)) {
  console.log(`${r.id.padEnd(12)} ${r.ok}/${TRIALS} min=${r.ok ? r.min.toFixed(2) : '-'} ${Object.keys(r.wrong).length ? 'confused_with=' + JSON.stringify(r.wrong) : ''}`);
}

// Nearest-neighbour check on the clean templates: how close is each glyph to its closest rival?
console.log('--- closest rival per glyph (clean templates, lower is safer)');
const pairs: { a: string; b: string; score: number }[] = [];
for (const id of ALL_GLYPH_IDS) {
  const solo = new Recognizer<string>();
  for (const other of ALL_GLYPH_IDS) if (other !== id) solo.add(other, GLYPHS[other].points);
  const m = solo.recognize(GLYPHS[id].points);
  if (m) pairs.push({ a: id, b: m.key, score: m.score });
}
pairs.sort((x, y) => y.score - x.score);
for (const p of pairs.slice(0, 12)) console.log(`${p.a.padEnd(12)} ~ ${p.b.padEnd(12)} ${p.score.toFixed(3)}`);
