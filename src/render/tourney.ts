// Tournament mode: single elimination. Entrants are shuffled into seeds; when the field is not a
// power of two the top seeds get byes (spread across the bracket, never two byes in one match).
// Every match is one game except the final, which is first to two. Plain data, so the bracket
// travels between scenes in the match setup like the party state. Not part of the sim.
import type { MatchSetup, TourneyMatch, TourneyState } from './config';

/** No opponent: the other entrant goes through. */
export const BYE = -2;
/** Not known yet: the winner of an earlier match. */
export const TBD = -1;

/** Standard seed order for a bracket: seed 1 meets the last seed, and the top two meet in the final. */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

function shuffled(n: number, random: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** A fresh bracket for these names (2 or more), byes already through. */
export function newTourney(names: string[], phones?: string[], random: () => number = Math.random): TourneyState {
  const n = names.length;
  let size = 2;
  while (size < n) size *= 2;
  const seedTo = shuffled(n, random);
  const order = seedOrder(size);
  const rounds: TourneyMatch[][] = [];
  const first: TourneyMatch[] = [];
  for (let m = 0; m < size / 2; m += 1) {
    const sa = order[2 * m];
    const sb = order[2 * m + 1];
    first.push({ a: sa <= n ? seedTo[sa - 1] : BYE, b: sb <= n ? seedTo[sb - 1] : BYE, winner: TBD, score: [0, 0] });
  }
  rounds.push(first);
  for (let count = size / 4; count >= 1; count /= 2) {
    rounds.push(Array.from({ length: count }, () => ({ a: TBD, b: TBD, winner: TBD, score: [0, 0] as [number, number] })));
  }
  const t: TourneyState = {
    names: [...names],
    phones: phones ? [...phones] : undefined,
    size,
    rounds,
    firstTo: rounds.map((_, r) => (r === rounds.length - 1 ? 2 : 1)),
    picks: names.map(() => [-1, -1] as [number, number]),
    champion: TBD,
  };
  return settle(t);
}

function copy(t: TourneyState): TourneyState {
  return {
    ...t,
    rounds: t.rounds.map((r) => r.map((m) => ({ ...m, score: [...m.score] as [number, number] }))),
    picks: t.picks.map((p) => [...p] as [number, number]),
    names: [...t.names],
    phones: t.phones ? [...t.phones] : undefined,
  };
}

/** Carry every decided winner (byes included) into the next round. Mutates `t`; returns it. */
function settle(t: TourneyState): TourneyState {
  const last = t.rounds.length - 1;
  t.rounds.forEach((round, r) => {
    round.forEach((m, k) => {
      if (m.winner === TBD) {
        if (m.a >= 0 && m.b === BYE) m.winner = m.a;
        else if (m.b >= 0 && m.a === BYE) m.winner = m.b;
        else if (m.a === BYE && m.b === BYE) m.winner = BYE;
      }
      if (m.winner === TBD) return;
      if (r === last) {
        t.champion = m.winner;
        return;
      }
      const next = t.rounds[r + 1][k >> 1];
      if (k % 2 === 0) next.a = m.winner;
      else next.b = m.winner;
    });
  });
  return t;
}

/** Matches ready to play (both entrants known, not decided), in the order they will be played. */
export function readyMatches(t: TourneyState): Array<{ round: number; match: number }> {
  const out: Array<{ round: number; match: number }> = [];
  t.rounds.forEach((round, r) =>
    round.forEach((m, k) => {
      if (m.a >= 0 && m.b >= 0 && m.winner === TBD) out.push({ round: r, match: k });
    }),
  );
  return out;
}

/** The match to play now, or null once there is a champion. */
export function currentMatch(t: TourneyState): { round: number; match: number; m: TourneyMatch } | null {
  const first = readyMatches(t)[0];
  return first ? { ...first, m: t.rounds[first.round][first.match] } : null;
}

/**
 * The bracket after a game of the current match: `side` 0 (player 1, entrant a) or 1 won; anything
 * else is a draw, which is played again.
 */
export function recordGame(t: TourneyState, side: number): TourneyState {
  const cur = currentMatch(t);
  if (!cur) return t;
  const next = copy(t);
  const m = next.rounds[cur.round][cur.match];
  if (side !== 0 && side !== 1) {
    next.last = { round: cur.round, match: cur.match, winner: TBD, draw: true };
    return next;
  }
  m.score[side] += 1;
  if (m.score[side] >= next.firstTo[cur.round]) m.winner = side === 0 ? m.a : m.b;
  next.last = { round: cur.round, match: cur.match, winner: m.winner };
  return settle(next);
}

/** Give a match to one side without playing (someone left). */
export function forfeit(t: TourneyState, side: 0 | 1): TourneyState {
  const cur = currentMatch(t);
  if (!cur) return t;
  const next = copy(t);
  const m = next.rounds[cur.round][cur.match];
  m.winner = side === 0 ? m.a : m.b;
  next.last = { round: cur.round, match: cur.match, winner: m.winner };
  return settle(next);
}

/** Remember the team each side played, so their cursor starts there next time. */
export function withPicks(t: TourneyState, a: number, b: number, teamA: [number, number], teamB: [number, number]): TourneyState {
  const next = copy(t);
  if (a >= 0) next.picks[a] = teamA;
  if (b >= 0) next.picks[b] = teamB;
  return next;
}

export function roundName(t: TourneyState, round: number): string {
  const left = t.rounds.length - round;
  return left === 1 ? 'FINAL' : left === 2 ? 'SEMI-FINALS' : left === 3 ? 'QUARTER-FINALS' : `ROUND ${round + 1}`;
}

/** "QUARTER-FINAL 2", "SEMI-FINAL 1", "FINAL · GAME 2". */
export function matchLabel(t: TourneyState, round: number, match: number): string {
  const left = t.rounds.length - round;
  if (left === 1) {
    const m = t.rounds[round][match];
    return `GRAND FINAL · GAME ${m.score[0] + m.score[1] + 1}`;
  }
  // Number the matches that are actually played in this round (byes do not count).
  const played = t.rounds[round].filter((m, k) => k <= match && m.a !== BYE && m.b !== BYE).length;
  const base = left === 2 ? 'SEMI-FINAL' : left === 3 ? 'QUARTER-FINAL' : `ROUND ${round + 1} · MATCH`;
  return `${base} ${played}`;
}

/** What an entrant's phone says between their matches. */
export function entrantStatus(t: TourneyState, e: number): { say: string; sub: string } {
  const name = (k: number): string => (k >= 0 ? t.names[k] : k === BYE ? 'BYE' : '?');
  if (e < 0) return { say: 'WATCHING', sub: 'The bracket is set. You are in the next one.' };
  if (t.champion === e) return { say: 'CHAMPION!', sub: 'You won the tournament.' };
  if (t.champion >= 0) return { say: 'GG', sub: `${name(t.champion)} is the champion.` };
  for (let r = 0; r < t.rounds.length; r += 1) {
    for (const m of t.rounds[r]) {
      if ((m.a === e || m.b === e) && m.winner >= 0 && m.winner !== e) {
        return { say: 'KNOCKED OUT', sub: `${roundName(t, r)}, by ${name(m.winner)}. Cheer them on!` };
      }
    }
  }
  const ready = readyMatches(t);
  const opp = (m: TourneyMatch): number => (m.a === e ? m.b : m.a);
  const at = ready.findIndex(({ round, match }) => {
    const m = t.rounds[round][match];
    return m.a === e || m.b === e;
  });
  if (at === 0) {
    const { round, match } = ready[0];
    return { say: "YOU'RE UP!", sub: `vs ${name(opp(t.rounds[round][match]))}` };
  }
  if (at === 1) {
    const { round, match } = ready[1];
    return { say: "YOU'RE UP NEXT", sub: `vs ${name(opp(t.rounds[round][match]))}` };
  }
  // Still in: the next match, against a known opponent or the winner of another match.
  for (let r = 0; r < t.rounds.length; r += 1) {
    const k = t.rounds[r].findIndex((m) => (m.a === e || m.b === e) && m.winner === TBD);
    if (k < 0) continue;
    const m = t.rounds[r][k];
    const o = opp(m);
    if (o >= 0) return { say: 'STILL IN', sub: `${roundName(t, r)} vs ${name(o)}` };
    // The other slot is the winner of the sibling match in the round before.
    const feed = t.rounds[r - 1]?.[m.a === e ? 2 * k + 1 : 2 * k];
    const from = feed ? `the winner of ${name(feed.a)} vs ${name(feed.b)}` : 'a winner still to come';
    return { say: 'STILL IN', sub: `${roundName(t, r)} vs ${from}` };
  }
  return { say: 'STILL IN', sub: 'Watch the TV.' };
}

const SAVE_KEY = 'afterhours.tourney';

/** Keep the bracket in this browser, so a reload of the TV page can pick it up again. */
export function saveTourney(t: TourneyState | null): void {
  try {
    if (t && t.champion < 0) localStorage.setItem(SAVE_KEY, JSON.stringify({ ...t, last: undefined }));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // Not saved; the tournament still runs.
  }
}

/** A tournament left unfinished in this browser, if there is one. */
export function savedTourney(): TourneyState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const t = raw ? (JSON.parse(raw) as TourneyState) : null;
    return t && Array.isArray(t.rounds) && Array.isArray(t.names) && t.champion < 0 && currentMatch(t) ? t : null;
  } catch {
    return null;
  }
}

/** The players' names for each side of this match, in party or tournament play. */
export function sideNames(setup: Pick<MatchSetup, 'party' | 'tourney'>): [string, string] | null {
  if (setup.tourney) {
    const cur = currentMatch(setup.tourney);
    if (cur) return [setup.tourney.names[cur.m.a], setup.tourney.names[cur.m.b]];
  }
  if (setup.party) return [setup.party.names[setup.party.sides[0]], setup.party.names[setup.party.sides[1]]];
  return null;
}
