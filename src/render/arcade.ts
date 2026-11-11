// Arcade mode: pick a fighter, then beat every other fighter in turn on their home stage while the
// CPU gets tougher. A loss offers a continue; clearing the ladder crowns a champion.
import { HEROES } from '../sim';
import type { ArcadeRun, MatchSetup } from './config';
import { STAGES } from './stages';

/** Where each fighter is met. */
const HOME: Record<string, string> = { rogue: 'rooftop', jetsetter: 'concert', chris: 'embassy', leader: 'crown' };

/** CPU level for each fight of the ladder, by the difficulty picked on the title screen. */
const LADDER = [
  [0, 0, 1],
  [0, 1, 2],
  [1, 2, 2],
];

export function newArcadeRun(p1: number, base: number): ArcadeRun {
  const order = HEROES.map((_, i) => i).filter((i) => i !== p1);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { order, fight: 0, continues: 0, base };
}

/** The match for the run's current fight. */
export function arcadeSetup(p1: number, run: ArcadeRun): MatchSetup {
  const p2 = run.order[run.fight];
  const home = STAGES.findIndex((s) => s.id === HOME[HEROES[p2].id]);
  const levels = LADDER[run.base] ?? LADDER[1];
  return {
    mode: 'cpu',
    p1,
    p2,
    stage: home >= 0 ? home : Math.floor(Math.random() * STAGES.length),
    cpuLevel: levels[Math.min(run.fight, levels.length - 1)],
    arcade: run,
  };
}
