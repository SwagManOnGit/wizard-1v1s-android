// Guards the sealed apocrypha.
//
// Two ways this can go wrong silently, both caught here: somebody edits secrets.source.ts and
// forgets `npm run seal`, so the game ships the old spells; or the seal round-trips badly and a
// spell comes back subtly different. Run with: npx tsx src/sealtest.ts
import { SPELLS, SPELL_BY_ID, seal, unseal } from '@wizard/shared';
import { SECRET_SOURCE } from '../../shared/src/secrets.source';

const sealed = unseal();
const problems: string[] = [];

if (sealed.length !== SECRET_SOURCE.length) {
  problems.push(`sealed ${sealed.length} spells but the source has ${SECRET_SOURCE.length}: run "npm run seal"`);
}

// Field by field, because a dropped effect would still leave the counts matching.
for (const want of SECRET_SOURCE) {
  const got = sealed.find(s => s.id === want.id);
  if (!got) { problems.push(`${want.id} is missing from the seal: run "npm run seal"`); continue; }
  if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`${want.id} differs from the source: run "npm run seal"`);
}

// The seal must be deterministic, or every build would churn the file.
if (seal(SECRET_SOURCE) !== seal(SECRET_SOURCE)) problems.push('sealing is not deterministic');

// And the game must actually be able to cast them.
for (const s of SECRET_SOURCE) {
  if (!SPELL_BY_ID[s.id]) problems.push(`${s.id} never reached SPELLS`);
  if (!SPELL_BY_ID[s.id]?.secret) problems.push(`${s.id} lost its secret flag`);
}

console.log(`sealed spells: ${sealed.length}, total spells: ${SPELLS.length}, listed: ${SPELLS.filter(s => !s.secret).length}`);
if (problems.length) {
  for (const p of problems) console.log('  FAIL ' + p);
  process.exit(1);
}
console.log('seal test ok');
