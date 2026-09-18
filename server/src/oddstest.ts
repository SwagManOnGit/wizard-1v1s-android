// Publishes the real drop odds for every chest. Google Play requires the odds of a paid randomised
// item to be shown before purchase, and the Founder's hoard sells chests for money, so these
// numbers have to exist somewhere a player can read them. Run with: npx tsx src/oddstest.ts
import { CHESTS, RARITY_NAMES, chestOdds, type Rarity } from '@wizard/shared';

console.log('chest         ' + ([1, 2, 3, 4, 5] as Rarity[]).map(r => RARITY_NAMES[r].padStart(8)).join(''));
for (const c of CHESTS) {
  // Straight from the shipped function, so this prints exactly what the shop shows.
  console.log(c.name.padEnd(14) + chestOdds(c).map(p => `${p.toFixed(1)}%`.padStart(8)).join(''));
}

console.log(`\nEach chest rolls its slots independently: ${CHESTS.map(c => `${c.name} ${c.items}`).join(', ')}.`);
