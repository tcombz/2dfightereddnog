import type { GameState } from './types';

/** FNV-1a (32 bit) over every state field in a fixed order. Returns 8 hex chars. */
export function hashState(s: GameState): string {
  let h = 0x811c9dc5 | 0;
  const add = (n: number): void => {
    for (let shift = 0; shift < 32; shift += 8) {
      h ^= (n >> shift) & 0xff;
      h = Math.imul(h, 0x01000193);
    }
  };
  add(s.tick);
  add(s.phase);
  add(s.phaseTimer);
  add(s.round);
  add(s.timer);
  add(s.wins[0]);
  add(s.wins[1]);
  add(s.roundResult);
  add(s.matchResult);
  for (const f of s.fighters) {
    add(f.hero);
    add(f.x);
    add(f.y);
    add(f.vx);
    add(f.vy);
    add(f.facing);
    add(f.health);
    add(f.state);
    add(f.stateTick);
    add(f.moveId);
    add(f.moveHit);
    add(f.stunTimer);
    add(f.prevInput);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
