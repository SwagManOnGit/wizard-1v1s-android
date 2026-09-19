// Do two wizards holding the same code actually meet, and does a coded room refuse a bot?
//
// Needs the server running (npm run server). Run with: npx tsx src/friendtest.ts
import { Client } from 'colyseus.js';
import { DUEL_ROOM, PROTOCOL_VERSION, RANKED_BUILD, STARTING_SPELLS, makeDuelCode, normaliseDuelCode } from '@wizard/shared';

const URL = process.env.DUEL_URL ?? 'ws://localhost:2567';

function join(name: string, code: string) {
  return new Client(URL).joinOrCreate(DUEL_ROOM, {
    v: PROTOCOL_VERSION, deviceId: `test-${name}`, name, loadout: [...STARTING_SPELLS], build: RANKED_BUILD, ranked: false, code,
  });
}

const problems: string[] = [];
const started = new Map<string, string>();

async function main(): Promise<void> {
  // 1. The code itself.
  const code = makeDuelCode();
  if (code.length !== 6) problems.push(`code was ${code.length} characters`);
  if (/[OI01]/.test(code)) problems.push(`code ${code} contains a character the alphabet excludes`);
  if (normaliseDuelCode(' ab c-234 ') !== 'ABC234') problems.push(`normalise mangled a spaced code: ${normaliseDuelCode(' ab c-234 ')}`);
  if (normaliseDuelCode('ABCO0I1234') !== 'ABC234') problems.push(`normalise kept an excluded character: ${normaliseDuelCode('ABCO0I1234')}`);

  // 2. Two wizards on the same code should meet each other, not a bot.
  const a = await join('Alpha', code);
  a.onMessage('start', (d: { names?: string[] }) => started.set('Alpha', (d.names ?? []).join(' vs ')));
  await new Promise(r => setTimeout(r, 400));
  const b = await join('Beta', code);
  b.onMessage('start', (d: { names?: string[] }) => started.set('Beta', (d.names ?? []).join(' vs ')));
  await new Promise(r => setTimeout(r, 1200));
  if (!started.has('Alpha') || !started.has('Beta')) problems.push(`the coded duel never started: ${JSON.stringify([...started])}`);
  else if (!started.get('Alpha')?.includes('Beta')) problems.push(`Alpha met "${started.get('Alpha')}" instead of Beta`);
  a.leave(); b.leave();
  await new Promise(r => setTimeout(r, 300));

  // 3. A lone wizard on a code must NOT be given a bot, where a public room would be.
  const lonely = await join('Lonely', makeDuelCode());
  let lonelyStarted = false;
  lonely.onMessage('start', () => { lonelyStarted = true; });
  const publicOne = await join('Public', '');
  let publicStarted = false;
  publicOne.onMessage('start', () => { publicStarted = true; });
  await new Promise(r => setTimeout(r, 10_000));
  if (lonelyStarted) problems.push('a bot filled a friend room, which would steal the seat from the friend');
  if (!publicStarted) problems.push('public matchmaking did not fall back to a bot');
  lonely.leave(); publicOne.leave();

  console.log(`coded duel: ${started.get('Alpha') ?? 'never started'}`);
  console.log(`friend room bot-filled: ${lonelyStarted} (want false) · public room bot-filled: ${publicStarted} (want true)`);
  if (problems.length) {
    for (const p of problems) console.log('  FAIL ' + p);
    process.exit(1);
  }
  console.log('friend duel test ok');
  process.exit(0);
}

main().catch(e => { console.error('friend duel test could not run:', e instanceof Error ? e.message : e); process.exit(2); });
