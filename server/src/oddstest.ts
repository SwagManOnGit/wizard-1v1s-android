// Publishes the real drop odds for every chest. Google Play requires the odds of a paid randomised
// item to be shown before purchase, and the Founder's hoard sells chests for money, so these
// numbers have to exist somewhere a player can read them. Run with: npx tsx src/oddstest.ts
import { CHESTS, RARITY_NAMES, rarityWeights, type Rarity } from '@wizard/shared';

console.log('chest         ' + ([1, 2, 3, 4, 5] as Rarity[]).map(r => RARITY_NAMES[r].padStart(8)).join(''));
for (const c of CHESTS) {
  // Same filtering rollItem applies: weights outside the chest's rarity band are zeroed.
  const weights = rarityWeights(c.level, false).map((w, i) => {
    const r = (i + 1) as Rarity;
    if (c.minRarity && r < c.minRarity) return 0;
    if (c.maxRarity && r > c.maxRarity) return 0;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const pct = weights.map(w => (w / total) * 100);
  console.log(c.name.padEnd(14) + pct.map(p => `${p.toFixed(1)}%`.padStart(8)).join(''));
}

console.log(`\nEach chest rolls its slots independently: ${CHESTS.map(c => `${c.name} ${c.items}`).join(', ')}.`);
