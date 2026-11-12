import { describe, expect, it } from 'vitest';
import { Rollback, type NetFrame } from '../src/net/rollback';
import { decodeInputs, encodeInputs } from '../src/render/replays';
import { createInitialState, hashState, step } from '../src/sim';

/** A small deterministic random source (the test must not depend on Math.random). */
function rng(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x >>> 8;
  };
}

/** Inputs that change every few frames, like a person mashing. */
function player(seed: number): (f: number) => number {
  const r = rng(seed);
  let cur = 0;
  return (f) => {
    if (f % 7 === 0) cur = r() & 0xff;
    return cur;
  };
}

describe('online play (rollback)', () => {
  it('two sides with lag and dropped messages end in the same state as one straight run', () => {
    const init = createInitialState(0, 3);
    const sides = [new Rollback(init, 0), new Rollback(init, 1)];
    const press = [player(11), player(29)];
    const drop = rng(5);
    // Messages in flight: [arrive at tick, to side, message].
    const wire: Array<[number, number, NetFrame]> = [];
    const pressed: number[][] = [[], []];
    const FRAMES = 1500;
    for (let t = 0; sides.some((s) => s.frame < FRAMES); t += 1) {
      sides.forEach((s, i) => {
        // Side 1 starts 9 ticks late, and each side has its own lag (5 and 8 ticks).
        if (i === 1 && t < 9) return;
        for (const w of wire) if (w[1] === i && w[0] === t) s.receive(w[2]);
        if (s.frame >= FRAMES || s.shouldWait() || !s.canAdvance()) return;
        const bits = press[i](s.frame);
        pressed[i][s.frame + 2] = bits;
        s.addLocal(bits);
        s.advance();
        if (drop() % 4 !== 0) wire.push([t + (i === 0 ? 5 : 8), 1 - i, s.outgoing()]);
      });
      if (t > 20000) throw new Error('stuck');
    }
    // Let the last inputs arrive.
    for (let k = 0; k < 3; k += 1) sides.forEach((s, i) => s.receive({ ...sides[1 - i].outgoing() }));
    let s = init;
    for (let f = 0; f < FRAMES; f += 1) s = step(s, pressed[0][f] ?? 0, pressed[1][f] ?? 0);
    sides.forEach((side) => side.advance());
    const straight = step(s, pressed[0][FRAMES] ?? 0, pressed[1][FRAMES] ?? 0);
    expect(hashState(sides[0].state)).toBe(hashState(straight));
    expect(hashState(sides[1].state)).toBe(hashState(straight));
    expect(sides[0].rollbacks + sides[1].rollbacks).toBeGreaterThan(0);
    expect(sides[0].desynced || sides[1].desynced).toBe(false);
  });

  it('replays encode and decode every input exactly', () => {
    const p = [player(3), player(4)];
    const log: Array<[number, number]> = [];
    for (let f = 0; f < 3000; f += 1) log.push([p[0](f), f > 2000 ? 0 : p[1](f)]);
    const code = encodeInputs(log);
    expect(decodeInputs(code)).toEqual(log);
    expect(code.length).toBeLessThan(log.length * 2);
  });
});
