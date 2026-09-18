// Checks the discovery gates behave as designed: what a new player can find, what a full set opens,
// and that Eclipse stays shut until every element is attuned.
import {
  EQUIP_BY_ID, MUNDANE_ELEMENTS, SPELLS, STARTING_EQUIPMENT, STARTING_SPELLS,
  canDiscover, discoverable, rollLevelDrop, openChest, CHEST_BY_ID, affinityFor,
  type Attunement, type ElementId,
} from '@wizard/shared';

const starter: Attunement = {
  elements: ['arcane'],
  equipped: { hat: STARTING_EQUIPMENT[0], outfit: STARTING_EQUIPMENT[1], staff: STARTING_EQUIPMENT[2], shoes: STARTING_EQUIPMENT[3] },
};
const known = [...STARTING_SPELLS];

console.log(`spells=${SPELLS.length} starters=${known.length}`);
console.log('--- a brand new player');
const day1 = discoverable(starter, known);
console.log(`  findable now: ${day1.length} (${day1.map(s => s.name).join(', ')})`);
console.log(`  arcane affinity from the threadbare starter kit: ${affinityFor(starter, 'arcane')} (expected 0)`);
if (affinityFor(starter, 'arcane') !== 0) throw new Error('starter gear should not attune');
if (day1.some(s => s.tier >= 3)) throw new Error('deep spells must not be findable on day one');

console.log('--- wearing a full Fine+ set of each element, with that element attuned');
for (const el of MUNDANE_ELEMENTS) {
  const att: Attunement = {
    elements: ['arcane', el],
    equipped: { hat: `${el}_hat_3`, outfit: `${el}_outfit_3`, staff: `${el}_staff_3`, shoes: `${el}_shoes_3` },
  };
  const open = discoverable(att, known).filter(s => s.element === el);
  const total = SPELLS.filter(s => s.element === el && !known.includes(s.id)).length;
  const mythic = open.filter(s => s.tier === 5).length;
  console.log(`  ${el.padEnd(7)} findable ${open.length}/${total}, mythic open: ${mythic}`);
  if (open.length !== total) throw new Error(`${el}: a full set should open everything`);
}

console.log('--- eclipse');
const allButOne: Attunement = { elements: MUNDANE_ELEMENTS.filter(e => e !== 'shadow'), equipped: { hat: 'fire_hat_5', outfit: 'fire_outfit_5', staff: 'fire_staff_5', shoes: 'fire_shoes_5' } };
const allSix: Attunement = { elements: [...MUNDANE_ELEMENTS], equipped: allButOne.equipped };
const eclipseSpells = SPELLS.filter(s => s.element === 'eclipse');
const lockedCount = eclipseSpells.filter(s => canDiscover(s, allButOne)).length;
const openCount = eclipseSpells.filter(s => canDiscover(s, allSix)).length;
console.log(`  with all but one element: ${lockedCount} open (expected 0)`);
console.log(`  with every element plus a full Mythic set: ${openCount} of ${eclipseSpells.length} open`);
if (lockedCount !== 0) throw new Error('eclipse must stay shut');
if (openCount !== eclipseSpells.length) throw new Error('eclipse should open with every element and a full set');

console.log('--- drop rates over 2000 level clears');
for (const [lvl, boss] of [[1, false], [25, false], [50, true], [100, true]] as [number, boolean][]) {
  const counts: Record<number, number> = {};
  let drops = 0;
  for (let i = 0; i < 2000; i++) {
    const item = rollLevelDrop(lvl, boss, false, ['arcane', 'fire']);
    if (item) { drops++; counts[item.rarity] = (counts[item.rarity] ?? 0) + 1; }
  }
  const pct = (r: number): string => `${(((counts[r] ?? 0) / drops) * 100).toFixed(1)}%`;
  console.log(`  level ${String(lvl).padStart(3)}${boss ? ' boss' : '     '} drop rate ${((drops / 2000) * 100).toFixed(0)}%  worn ${pct(1)} fine ${pct(2)} rare ${pct(3)} epic ${pct(4)} mythic ${pct(5)}`);
}

console.log('--- chests');
for (const id of ['wood', 'silver', 'gold', 'elemental']) {
  const c = CHEST_BY_ID[id];
  const items = openChest(c, ['arcane'], id === 'elemental' ? ('frost' as ElementId) : undefined);
  console.log(`  ${c.name}: ${items.map(i => `${i.name} (${EQUIP_BY_ID[i.id].rarity})`).join(', ')}`);
  if (id === 'elemental' && items.some(i => i.element !== 'frost')) throw new Error('elemental chest must respect the chosen element');
}

console.log('--- how long to a full Fine+ set of one element, buying gold chests only');
let sets = 0, chests = 0;
const owned = new Set<string>();
while (sets === 0 && chests < 400) {
  chests++;
  for (const it of openChest(CHEST_BY_ID.gold, ['arcane', 'fire'], 'fire')) owned.add(it.id);
  const slots = ['hat', 'outfit', 'staff', 'shoes'];
  if (slots.every(s => [2, 3, 4, 5].some(r => owned.has(`fire_${s}_${r}`)))) sets = chests;
}
console.log(`  a fire set completed after ${sets} gold chests (${sets * CHEST_BY_ID.gold.price} coins) when buying elemental-free gold chests`);
console.log('progression test ok');
