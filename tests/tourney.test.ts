import { describe, expect, it } from 'vitest';
import { BYE, currentMatch, entrantStatus, forfeit, matchLabel, newTourney, readyMatches, recordGame, roundName, seedOrder } from '../src/render/tourney';

/** A fixed shuffle, so brackets are the same every run. */
function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const names = (n: number): string[] => Array.from({ length: n }, (_, i) => `P${i}`);

/** Play the whole bracket, the side given by `pick` winning each game. */
function playOut(n: number, pick: (k: number) => number): { games: number; champion: number } {
  let t = newTourney(names(n), undefined, rng(n));
  let games = 0;
  while (currentMatch(t)) {
    t = recordGame(t, pick(games));
    games += 1;
    expect(games).toBeLessThan(100);
  }
  return { games, champion: t.champion };
}

describe('tournament', () => {
  it('seeds the standard way', () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('gives byes to top seeds, never two byes in one match', () => {
    for (let n = 2; n <= 16; n += 1) {
      const t = newTourney(names(n), undefined, rng(n));
      expect(t.size).toBeGreaterThanOrEqual(n);
      expect(t.size / 2).toBeLessThan(n);
      for (const m of t.rounds[0]) expect(m.a === BYE && m.b === BYE).toBe(false);
      // Everyone is in the bracket exactly once.
      const seen = t.rounds[0].flatMap((m) => [m.a, m.b]).filter((e) => e >= 0);
      expect([...seen].sort((x, y) => x - y)).toEqual(names(n).map((_, i) => i));
      // Byes are already through.
      for (const m of t.rounds[0]) if (m.a === BYE || m.b === BYE) expect(m.winner).toBe(m.a === BYE ? m.b : m.a);
    }
  });

  it('plays out to one champion for every field size from 2 to 16', () => {
    for (let n = 2; n <= 16; n += 1) {
      const { games, champion } = playOut(n, (k) => k % 2);
      expect(champion).toBeGreaterThanOrEqual(0);
      // n - 1 matches; the final is first to two, so one or two extra games.
      expect(games).toBeGreaterThanOrEqual(n);
      expect(games).toBeLessThanOrEqual(n + 1);
    }
  });

  it('ten players: two first-round matches, then quarters, semis and a best-of-3 final', () => {
    const t = newTourney(names(10), undefined, rng(3));
    expect(t.size).toBe(16);
    expect(t.rounds.length).toBe(4);
    // Two first-round matches; two quarter-finals are between bye winners and ready too, but the
    // first round is played first.
    const ready = readyMatches(t);
    expect(ready.filter((r) => r.round === 0).length).toBe(2);
    expect(ready.length).toBe(4);
    expect(ready[0].round).toBe(0);
    expect(ready[1].round).toBe(0);
    expect(roundName(t, 1)).toBe('QUARTER-FINALS');
    expect(roundName(t, 3)).toBe('FINAL');
    expect(t.firstTo).toEqual([1, 1, 1, 2]);
    const cur = currentMatch(t)!;
    expect(matchLabel(t, cur.round, cur.match)).toBe('ROUND 1 · MATCH 1');
  });

  it('a draw is played again; a forfeit sends the other side through', () => {
    let t = newTourney(names(4), undefined, rng(9));
    const before = currentMatch(t)!;
    t = recordGame(t, -1);
    expect(currentMatch(t)!.m.a).toBe(before.m.a);
    expect(t.last?.draw).toBe(true);
    t = forfeit(t, 1);
    expect(t.rounds[0][before.match].winner).toBe(before.m.b);
    expect(t.rounds[1][0].a).toBe(before.m.b);
  });

  it('tells each entrant where they stand', () => {
    let t = newTourney(names(4), undefined, rng(5));
    const cur = currentMatch(t)!;
    expect(entrantStatus(t, cur.m.a).say).toBe("YOU'RE UP!");
    const nxt = readyMatches(t)[1];
    expect(entrantStatus(t, t.rounds[nxt.round][nxt.match].a).say).toBe("YOU'RE UP NEXT");
    t = recordGame(t, 0);
    expect(entrantStatus(t, cur.m.b).say).toBe('KNOCKED OUT');
    expect(entrantStatus(t, cur.m.a).sub).toContain('FINAL');
    while (currentMatch(t)) t = recordGame(t, 0);
    expect(entrantStatus(t, t.champion).say).toBe('CHAMPION!');
  });
});
