// Arcade mode: pick a fighter, then beat every other fighter in turn on their home stage while the
// CPU gets tougher. A loss offers a continue; clearing the ladder crowns a champion.
import { HEROES } from '../sim';
import type { ArcadeRun, MatchSetup } from './config';
import { STAGES } from './stages';

/** Where each fighter is met. */
const HOME: Record<string, string> = { rogue: 'rooftop', jetsetter: 'concert', chris: 'embassy', leader: 'crown', eddnog: 'fortress', malcolm: 'helipad', quincy: 'penthouse', ignar: 'fortress', vesper: 'rooftop' };

/** A fighter's home stage id. */
export function homeStage(id: string): string {
  return HOME[id] ?? 'rooftop';
}

/** CPU level for each fight of the ladder, by the difficulty picked on the title screen. */
const LADDER = [
  [0, 0, 1, 1, 1, 1],
  [0, 1, 1, 1, 2, 2],
  [1, 1, 2, 2, 2, 2],
];

export function newArcadeRun(p1: number, base: number, partner?: number): ArcadeRun {
  const order = HEROES.map((_, i) => i).filter((i) => i !== p1);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { order, fight: 0, continues: 0, base, partner };
}

/** The match for the run's current fight. */
export function arcadeSetup(p1: number, run: ArcadeRun): MatchSetup {
  const p2 = run.order[run.fight];
  const home = STAGES.findIndex((s) => s.id === HOME[HEROES[p2].id]);
  const levels = LADDER[run.base] ?? LADDER[1];
  // Tag teams: each opponent brings the next fighter on the ladder as a partner.
  const foePartner = run.order[(run.fight + 1) % run.order.length] === p1 ? run.order[(run.fight + 2) % run.order.length] : run.order[(run.fight + 1) % run.order.length];
  const partners: [number, number] | undefined = run.partner !== undefined ? [run.partner, foePartner === p2 ? (p2 + 1) % HEROES.length : foePartner] : undefined;
  return {
    partners,
    mode: 'cpu',
    p1,
    p2,
    stage: home >= 0 ? home : Math.floor(Math.random() * STAGES.length),
    cpuLevel: levels[Math.min(run.fight, levels.length - 1)],
    arcade: run,
  };
}
