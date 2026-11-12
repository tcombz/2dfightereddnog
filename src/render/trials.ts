// Combo trials for training mode: routes every fighter can do, and a tracker that watches the sim
// to see which moves made up the current combo. Render-side only; it reads sim state, never writes it.
import { FS, MOVE_KEYS } from '../sim';
import type { GameState, MoveKey } from '../sim';

/** One step of a route: the move, and how it follows the step before ("," chain, ">" cancel). */
export type TrialStep = [MoveKey, '' | ',' | '>'];

export interface Trial {
  name: string;
  steps: TrialStep[];
  tip: string;
}

/** Each route is checked for every fighter by `tests/sim.test.ts`. */
export const TRIALS: Trial[] = [
  {
    name: 'Starter',
    steps: [['light', ''], ['light', ','], ['heavy', ','], ['projectile', '>']],
    tip: 'Chain the lights, then cancel the heavy into the projectile as it hits.',
  },
  {
    name: 'Low starter',
    steps: [['crouchLight', ''], ['crouchLight', ','], ['sweep', ',']],
    tip: 'Stay crouched the whole way. The sweep knocks down.',
  },
  {
    name: 'Jump in',
    steps: [['jumpAttack', ''], ['heavy', ','], ['projectile', '>']],
    tip: 'Attack early on the way down, then HEAVY as you land.',
  },
  {
    name: 'Meter dump',
    steps: [['heavy', ''], ['super', '>']],
    tip: 'Cancel the heavy into the super the moment it connects.',
  },
  {
    name: 'Launcher',
    steps: [['rising', ''], ['super', '>']],
    tip: 'The rising attack launches: super them before they land.',
  },
];

/** The button label for a step, as the move list writes it. */
export function stepLabel(key: MoveKey, simple: boolean): string {
  switch (key) {
    case 'light':
      return 'LIGHT';
    case 'heavy':
      return 'HEAVY';
    case 'kick':
      return '→ HEAVY';
    case 'crouchLight':
      return '↓ LIGHT';
    case 'sweep':
      return '↓ HEAVY';
    case 'jumpAttack':
      return 'JUMP ATTACK';
    case 'throw':
      return 'LIGHT + HEAVY';
    case 'special':
      return 'SPECIAL';
    case 'projectile':
      return simple ? '→ SPECIAL' : '↓↘→ SPECIAL';
    case 'rising':
      return simple ? '↓ SPECIAL' : '→↓↘ SPECIAL';
    case 'super':
      return 'HEAVY + SPECIAL';
    case 'heatBurst':
      return 'LIGHT + SPECIAL';
    case 'heatSmash':
      return 'LIGHT + SPECIAL (in Heat)';
  }
}

/** The whole route as one line, e.g. "LIGHT, LIGHT, HEAVY > ↓↘→ SPECIAL". */
export function routeText(t: Trial, simple: boolean): string {
  return t.steps.map(([key, link]) => (link === '' ? '' : link === ',' ? ', ' : ' > ') + stepLabel(key, simple)).join('');
}

/**
 * Watches one attacker's combos. Feed it every sim step; `moves` is then the list of the attacker's
 * moves that have hit in the defender's current combo, in order (a multi-hit move counts once).
 */
export class ComboTracker {
  moves: MoveKey[] = [];
  private tags: string[] = [];
  private moveCount = 0;
  private projCount = 0;

  constructor(private readonly slot: number) {}

  reset(): void {
    this.moves = [];
    this.tags = [];
  }

  /** Returns true when a new move joined the combo on this step. */
  update(prev: GameState, next: GameState): boolean {
    const pa = prev.fighters[this.slot];
    const a = next.fighters[this.slot];
    const pd = prev.fighters[1 - this.slot];
    const d = next.fighters[1 - this.slot];
    const newMove = a.state === FS.Attack && (pa.state !== FS.Attack || pa.moveId !== a.moveId || a.stateTick < pa.stateTick);
    if (newMove) this.moveCount += 1;
    if (d.combo === 0 || d.combo < pd.combo) this.reset();
    if (d.combo === 0 || d.combo === pd.combo) return false;

    // A hit landed. A strike raises the attacker's hit count; otherwise a projectile hit (each
    // projectile is used up by its hit, even one that spawns point blank and hits at once).
    let key: MoveKey;
    let tag: string;
    if (a.state === FS.Attack && a.moveHits > (newMove ? 0 : pa.moveHits)) {
      key = MOVE_KEYS[a.moveId];
      tag = `m${this.moveCount}`;
    } else if (a.projMove >= 0) {
      this.projCount += 1;
      key = MOVE_KEYS[a.projMove];
      tag = `p${this.projCount}`;
    } else return false;
    if (this.tags[this.tags.length - 1] === tag) return false;
    this.moves.push(key);
    this.tags.push(tag);
    return true;
  }

  /** How many steps of the trial the end of the current combo matches (all of them: cleared). */
  progress(t: Trial): number {
    const keys = t.steps.map(([k]) => k);
    for (let n = Math.min(keys.length, this.moves.length); n > 0; n -= 1) {
      const tail = this.moves.slice(this.moves.length - n);
      if (tail.every((k, i) => k === keys[i])) return n;
    }
    return 0;
  }
}
