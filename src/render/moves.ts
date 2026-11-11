import { HEROES, METER_MAX } from '../sim';
import type { MoveKey } from '../sim';

export interface MoveLine {
  key: MoveKey;
  name: string;
  input: string;
  note: string;
  damage: number;
}

const INPUTS: Array<[MoveKey, string, string]> = [
  ['light', 'LIGHT', 'Fast. Chains into anything.'],
  ['heavy', 'HEAVY', 'Cancel into a special on hit.'],
  ['kick', '→ + HEAVY', 'Long reach poke.'],
  ['crouchLight', '↓ + LIGHT', 'Hits low.'],
  ['sweep', '↓ + HEAVY', 'Hits low. Knocks down.'],
  ['jumpAttack', 'LIGHT or HEAVY in the air', 'Overhead: block it standing.'],
  ['throw', 'LIGHT + HEAVY up close', 'Beats blocking.'],
  ['special', 'SPECIAL', 'Signature move.'],
  ['projectile', '↓ ↘ → + SPECIAL', 'Projectile.'],
  ['rising', '→ ↓ ↘ + SPECIAL', 'Invincible as it starts. Anti-air.'],
  ['super', 'HEAVY + SPECIAL', `Needs a full meter (${METER_MAX}).`],
];

export function moveList(hero: number): MoveLine[] {
  const moves = HEROES[hero].moves;
  return INPUTS.map(([key, input, note]) => {
    const m = moves[key];
    const damage = m.projectile ? m.projectile.damage : m.damage * m.hits;
    let text = note;
    if (key === 'special') {
      if (m.counter) text = 'Counter stance: catches a strike and hits back. Loses to throws.';
      else if (m.projectile) text = 'Sends the crew charging across the screen.';
      else if (m.advance) text = 'Dashes forward. Knocks down.';
      else text = 'Close-range blast. Knocks down.';
    }
    if (key === 'super') text = `${m.hits}-hit super. Needs a full meter.`;
    return { key, name: m.name, input, note: text, damage };
  });
}

export const BASICS: Array<[string, string]> = [
  ['Block', 'Hold away from your opponent. Hold down-away to block low.'],
  ['Highs and lows', 'Sweeps and low jabs must be blocked crouching. Jump attacks must be blocked standing.'],
  ['Throw', 'LIGHT + HEAVY next to a blocking opponent.'],
  ['Combos', 'A light that hits can chain into another normal or a special. Heavies cancel into specials.'],
  ['Super meter', 'Fills as you attack and take hits. Full meter: HEAVY + SPECIAL.'],
  ['Dash', 'Tap forward twice. Tap back twice to back-dash.'],
  ['Counter hit', 'Hit someone as they start an attack for extra damage.'],
  ['Throw break', 'Press LIGHT + HEAVY as you are grabbed to break the throw.'],
  ['Buffer', 'Press your next attack a moment early: it comes out on the first free frame.'],
  ['Simple specials', 'Options menu: → + SPECIAL for the projectile, ↓ + SPECIAL for the rising attack.'],
];

/** Routes that work for every fighter. ">" is a cancel, "," a chain. */
export const COMBOS: Array<[string, string]> = [
  ['Starter', 'LIGHT, LIGHT, HEAVY > SPECIAL'],
  ['Low starter', '↓ LIGHT, ↓ LIGHT, ↓ HEAVY  (knocks down)'],
  ['Jump in', 'Jump attack, HEAVY > ↓↘→ SPECIAL'],
  ['Meter dump', 'HEAVY > SPECIAL > HEAVY + SPECIAL'],
  ['Launcher', '→↓↘ SPECIAL > HEAVY + SPECIAL  (juggles)'],
  ['Punish', 'Block a big move, then HEAVY > SPECIAL'],
];
