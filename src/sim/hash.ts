import type { FighterState, GameState } from './types';

/** Every FighterState field the hash covers, in order (hist is hashed separately). */
export const FIGHTER_KEYS = [
  'hero',
  'x',
  'y',
  'vx',
  'vy',
  'push',
  'facing',
  'wallBounced',
  'heat',
  'heatUsed',
  'health',
  'meter',
  'state',
  'stateTick',
  'moveId',
  'moveHits',
  'hitTick',
  'stunTimer',
  'low',
  'combo',
  'comboDamage',
  'juggles',
  'armorHits',
  'buf',
  'bufAge',
  'bufTick',
  'simple',
  'prevInput',
  'projX',
  'projY',
  'projVx',
  'projLife',
  'projMove',
  'fx',
  'fxX',
  'fxY',
  'fxPower',
] as const satisfies ReadonlyArray<keyof FighterState>;

/** Every GameState field the hash covers, in order (wins and fighters are hashed separately). */
export const GAME_KEYS = [
  'tick',
  'phase',
  'phaseTimer',
  'round',
  'timer',
  'roundResult',
  'matchResult',
  'hitstop',
  'freezeSlot',
  'training',
] as const satisfies ReadonlyArray<keyof GameState>;

/** FNV-1a (32 bit) over every state field in a fixed order. Returns 8 hex chars. */
export function hashState(s: GameState): string {
  let h = 0x811c9dc5 | 0;
  const add = (n: number): void => {
    for (let shift = 0; shift < 32; shift += 8) {
      h ^= (n >> shift) & 0xff;
      h = Math.imul(h, 0x01000193);
    }
  };
  for (const k of GAME_KEYS) add(s[k]);
  add(s.wins[0]);
  add(s.wins[1]);
  for (const f of s.fighters) {
    for (const k of FIGHTER_KEYS) add(f[k]);
    add(f.hist.length);
    for (const d of f.hist) add(d);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
