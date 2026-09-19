// The weekly rumour: one cryptic line, pointing at one spell nobody has told the player about.
//
// It rotates weekly rather than daily so a community has time to chew on it, and it only ever names
// a spell this particular wizard has not found, so it never wastes a week telling them about
// something already in their book.
import { SPELLS, type SpellDef } from '@wizard/shared';
import type { SaveData } from '../save';

/** ISO-ish week key: the same string all week, for everyone. */
export function weekKey(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Thursday decides the year the week belongs to.
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - start.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function hash(key: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return h >>> 0;
}

export interface Rumour { spell: SpellDef; text: string; week: string }

/**
 * This week's rumour, or nothing once a wizard has found every unlisted spell.
 *
 * Deliberately not filtered by whether they could currently find it: half the point is to make
 * somebody want an element they have not bought yet.
 */
export function weeklyRumour(save: SaveData, week = weekKey()): Rumour | null {
  const unfound = SPELLS.filter(s => s.secret && !save.discovered.includes(s.id));
  if (!unfound.length) return null;
  const spell = unfound[hash(week + save.deviceId.slice(0, 4)) % unfound.length];
  return { spell, text: spell.hint, week };
}
