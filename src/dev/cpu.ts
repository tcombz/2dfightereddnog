// TESTING ONLY: a simple computer opponent so one person can play. Not part of the sim.
// It only reads the state and returns an input bitmask, exactly like a human would.
import { FS, HEROES, Input } from '../sim';
import type { GameState } from '../sim';

/** Cheap integer hash of the tick, so decisions vary but need no stored state. */
function roll(tick: number, salt: number): number {
  let h = Math.imul(tick + salt * 7919, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  return (h >>> 16) & 0xff;
}

export function cpuInput(s: GameState, slot: number): number {
  const me = s.fighters[slot];
  const opp = s.fighters[1 - slot];
  const dist = Math.abs(opp.x - me.x);
  const toward = opp.x >= me.x ? Input.Right : Input.Left;
  const away = opp.x >= me.x ? Input.Left : Input.Right;
  const reach = HEROES[me.hero].moves.heavy.frames[HEROES[me.hero].moves.heavy.startup].hitboxes[0];
  const range = reach.x + reach.w + (HEROES[opp.hero].stats.width >> 1);

  // Decisions change every 12 ticks; attack buttons are pressed for one tick only.
  const beat = Math.floor(s.tick / 12);
  const r = roll(beat, slot);
  const press = s.tick % 12 === 0;

  if (opp.state === FS.Attack && dist < range + 40 && r < 110) return Input.Block;
  if (dist > range) return r < 20 ? toward | Input.Up : r < 215 ? toward : 0;
  if (!press) return r < 40 ? away : 0;
  if (r < 90) return Input.Light;
  if (r < 150) return Input.Heavy;
  if (r < 175) return Input.Special;
  if (r < 200) return Input.Block;
  return 0;
}
