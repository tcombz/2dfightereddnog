// Party mode: a friend group takes turns. The winner stays on their side, the loser goes to the back
// of the queue and the next name steps up. Wins and best streaks make a leaderboard for the night.
import type { PartyState } from './config';

export function newParty(names: string[]): PartyState {
  return {
    names,
    sides: [0, 1],
    queue: names.map((_, i) => i).slice(2),
    wins: names.map(() => 0),
    best: names.map(() => 0),
    streak: 0,
    matches: 0,
  };
}

/** The party after a match: `winner` is the side (0 or 1) that won, or -1 for a draw (both stay). */
export function afterMatch(p: PartyState, winner: number): PartyState {
  const next: PartyState = { ...p, sides: [...p.sides] as [number, number], queue: [...p.queue], wins: [...p.wins], best: [...p.best], matches: p.matches + 1 };
  if (winner !== 0 && winner !== 1) return next;
  const champ = next.sides[winner];
  const loser = next.sides[1 - winner];
  next.wins[champ] += 1;
  // A streak counts wins in a row by whoever stays on.
  next.streak = p.lastWinner === champ ? p.streak + 1 : 1;
  next.lastWinner = champ;
  next.best[champ] = Math.max(next.best[champ], next.streak);
  if (next.queue.length > 0) {
    next.sides[1 - winner] = next.queue.shift() as number;
    next.queue.push(loser);
  }
  return next;
}

/** Names sorted for the leaderboard: most wins, then best streak. */
export function leaderboard(p: PartyState): Array<{ name: string; wins: number; best: number }> {
  return p.names
    .map((name, i) => ({ name, wins: p.wins[i], best: p.best[i] }))
    .sort((a, b) => b.wins - a.wins || b.best - a.best);
}
