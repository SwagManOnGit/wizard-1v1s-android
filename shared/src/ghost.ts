// Ghost duels: a fighter's inputs are recorded with timestamps and replayed later as an opponent.
import type { FighterIndex, PvpBattle } from './pvp';
import type { Build } from './stats';

export interface GhostInput { t: number; k: 'd' | 'c'; v: number | string }

export interface GhostTape {
  v: 1;
  id?: string;
  name: string;
  rating: number;
  seed: number;
  loadout: string[];
  build: Build;
  inputs: GhostInput[];
  duration: number;
  won: boolean;
  createdAt: number;
}

export class GhostRecorder {
  readonly inputs: GhostInput[] = [];
  dodge(t: number, dir: -1 | 1): void { this.inputs.push({ t: Math.round(t * 1000) / 1000, k: 'd', v: dir }); }
  cast(t: number, spellId: string): void { this.inputs.push({ t: Math.round(t * 1000) / 1000, k: 'c', v: spellId }); }
}

/** Feeds a tape's inputs into a fighter as the simulation clock passes each timestamp. */
export class GhostPlayer {
  private cursor = 0;
  constructor(private tape: GhostTape, private sim: PvpBattle, private index: FighterIndex) {}
  tick(): void {
    while (this.cursor < this.tape.inputs.length && this.tape.inputs[this.cursor].t <= this.sim.time) {
      const inp = this.tape.inputs[this.cursor++];
      if (inp.k === 'd') this.sim.dodge(this.index, inp.v as -1 | 1);
      else this.sim.cast(this.index, String(inp.v));
    }
  }
  get finished(): boolean { return this.cursor >= this.tape.inputs.length && this.sim.time > this.tape.duration; }
}
