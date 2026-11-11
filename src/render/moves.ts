import { HEROES, METER_MAX } from '../sim';
import type { MoveKey } from '../sim';
import { TRIALS, routeText } from './trials';

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
      if (m.teleport) text = 'Invincible blink in, strike, blink out.';
      else if (m.armor) text = `Armored charge (${m.armor} hits). Knocks down.`;
      else if (m.counter) text = 'Counter stance: catches a strike and hits back. Loses to throws.';
      else if (m.projectile) text = 'Sends the crew charging across the screen.';
      else if (m.advance) text = 'Dashes forward. Knocks down.';
      else text = 'Close-range blast. Knocks down.';
    }
    if (key === 'super') text = `${m.hits}-hit super. Needs a full meter.`;
    if (key === 'heavy' && m.armor) text = `Armored (${m.armor} hit). Cancels on hit.`;
    return { key, name: m.name, input, note: text, damage };
  });
}

export const BASICS: Array<[string, string]> = [
  ['Block', 'Hold away from your opponent. Hold down-away to block low.'],
  ['Highs and lows', 'Block sweeps and low jabs crouching, and jump attacks standing.'],
  ['Throw', 'LIGHT + HEAVY next to a blocking opponent.'],
  ['Combos', 'Lights chain into other normals or specials. Heavies cancel into specials.'],
  ['Super meter', 'Fills as you attack and take hits. Full meter: HEAVY + SPECIAL.'],
  ['Dash', 'Tap forward twice. Tap back twice to back-dash.'],
  ['Counter hit', 'Hit someone as they start an attack for extra damage.'],
  ['Throw break', 'Press LIGHT + HEAVY as you are grabbed to break the throw.'],
  ['Buffer', 'Press your next attack a moment early: it comes out on the first free frame.'],
  ['Simple specials', 'Pick at character select (Up / Down): → + SPECIAL shoots, ↓ + SPECIAL rises.'],
  ['Armor', 'Big moves that soak hits and keep coming. Beat them with a throw or a super.'],
  ['Rally', 'On a third of your health or less, you glow and build meter twice as fast.'],
];

/** Routes that work for every fighter (the combo trials). ">" is a cancel, "," a chain. */
export const COMBOS: Array<[string, string]> = [
  ...TRIALS.map((t): [string, string] => [t.name, routeText(t, false)]),
  ['Punish', 'Block a big move, then HEAVY > ↓↘→ SPECIAL'],
  ['Practise', 'Training mode: F4 (or the pause menu) starts the combo trials.'],
];
