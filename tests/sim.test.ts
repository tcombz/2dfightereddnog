import { describe, expect, it } from 'vitest';
import {
  FS,
  HEROES,
  Input,
  MOVE_KEYS,
  Phase,
  Result,
  createInitialState,
  hashState,
  step,
} from '../src/sim';
import type { GameState } from '../src/sim';

type InputLog = Array<[number, number]>;

/** Test-side integer LCG. The sim itself has no randomness. */
function makeLog(seed: number, ticks: number): InputLog {
  let s = seed | 0;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return (s >>> 16) & 0xffff;
  };
  const log: InputLog = [];
  let a = 0;
  let b = 0;
  let holdA = 0;
  let holdB = 0;
  for (let i = 0; i < ticks; i += 1) {
    if (holdA === 0) {
      a = next() & next() & 0xff;
      holdA = 1 + (next() & 7);
    }
    if (holdB === 0) {
      b = next() & next() & 0xff;
      holdB = 1 + (next() & 7);
    }
    holdA -= 1;
    holdB -= 1;
    log.push([a, b]);
  }
  return log;
}

function run(log: InputLog, from: GameState = createInitialState(0, 1), start = 0): GameState {
  let s = from;
  for (let i = start; i < log.length; i += 1) s = step(s, log[i][0], log[i][1]);
  return s;
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}

function allIntegers(o: unknown): boolean {
  if (typeof o === 'number') return Number.isInteger(o);
  if (o && typeof o === 'object') return Object.values(o).every(allIntegers);
  return true;
}

const LOG = makeLog(12345, 20000);

describe('determinism', () => {
  it('same input log always produces the same final state hash', () => {
    const h1 = hashState(run(LOG));
    const h2 = hashState(run(LOG));
    const h3 = hashState(run(LOG.map(([a, b]) => [a, b] as [number, number])));
    expect(h2).toBe(h1);
    expect(h3).toBe(h1);
    // Golden value: pins the result across runs, machines and refactors.
    expect(h1).toMatchInlineSnapshot(`"7e67ecb3"`);
  });

  it('resuming from a serialized mid-run state gives the same hash', () => {
    const half = LOG.length >> 1;
    const mid = run(LOG.slice(0, half));
    const restored = JSON.parse(JSON.stringify(mid)) as GameState;
    expect(hashState(run(LOG, restored, half))).toBe(hashState(run(LOG)));
  });

  it('a different input log produces a different hash', () => {
    expect(hashState(run(makeLog(999, 20000)))).not.toBe(hashState(run(LOG)));
  });

  it('step never mutates its input and keeps every field an integer', () => {
    let s = createInitialState(0, 1);
    const seen = new Set<number>();
    for (const [a, b] of LOG) {
      deepFreeze(s);
      s = step(s, a, b); // throws if step writes to the frozen state
      if (!allIntegers(s)) throw new Error(`non-integer state at tick ${s.tick}`);
      seen.add(s.fighters[0].state).add(s.fighters[1].state);
    }
    // The random log should exercise the state machine (KO is covered by the scripted match below).
    for (const st of Object.values(FS)) if (st !== FS.KO) expect(seen.has(st), String(st)).toBe(true);
  });
});

describe('match flow', () => {
  it('a scripted match runs to completion: best of 3, P1 wins 2-0', () => {
    let s = createInitialState(0, 1);
    let ticks = 0;
    while (s.phase !== Phase.MatchEnd && ticks < 60 * 99 * 4) {
      s = step(s, ticks % 32 === 0 ? Input.Light : Input.Right, 0);
      ticks += 1;
    }
    expect(s.phase).toBe(Phase.MatchEnd);
    expect(s.matchResult).toBe(Result.P1);
    expect(s.wins).toEqual([2, 0]);
    expect(s.round).toBe(2);
    expect(s.fighters[1].state).toBe(FS.KO);
  });

  it('time out awards the round to the fighter with more health', () => {
    let s = createInitialState(0, 1);
    // P2 lands one hit, then nobody acts until the 99 second timer expires.
    let ticks = 0;
    while (s.phase !== Phase.RoundEnd && ticks < 60 * 110) {
      const p2 = ticks % 32 === 0 ? Input.Light : Input.Left;
      s = step(s, 0, s.fighters[0].health < HEROES[0].stats.maxHealth ? 0 : p2);
      ticks += 1;
    }
    expect(s.timer).toBe(0);
    expect(s.roundResult).toBe(Result.P2);
    expect(s.wins).toEqual([0, 1]);
  });

  it('blocking reduces damage to chip', () => {
    const play = (p2: number): number => {
      let s = createInitialState(0, 1);
      for (let t = 0; t < 700; t += 1) s = step(s, t % 32 === 0 ? Input.Light : Input.Right, p2);
      return s.fighters[1].health;
    };
    const max = HEROES[1].stats.maxHealth;
    expect(play(0)).toBeLessThan(play(Input.Block));
    expect(play(Input.Block)).toBeLessThan(max);
  });
});

describe('hero data', () => {
  it('frame data is consistent and integer-only', () => {
    for (const hero of HEROES) {
      expect(allIntegers(hero)).toBe(true);
      for (const key of MOVE_KEYS) {
        const m = hero.moves[key];
        expect(m.frames.length).toBe(m.startup + m.active + m.recovery);
        m.frames.forEach((f, i) => {
          const active = i >= m.startup && i < m.startup + m.active;
          expect(f.hitboxes.length > 0).toBe(active);
          expect(f.hurtboxes.length).toBeGreaterThan(0);
        });
      }
    }
  });
});

describe('sim purity', () => {
  const sources = import.meta.glob('../src/sim/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

  it('sim source has no floats, division, randomness, clocks or renderer imports', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(3);
    for (const [file, raw] of Object.entries(sources)) {
      expect(raw, file).not.toMatch(/phaser|\.\.\/render|\.\.\/dev/i);
      const code = raw
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""');
      expect(code, file).not.toMatch(/Math\.(?!imul\b|abs\b|min\b|max\b)\w+/);
      expect(code, file).not.toMatch(/\b(Date|performance|parseFloat|window|document)\b/);
      expect(code, file).not.toMatch(/\d\.\d/);
      expect(code, file).not.toMatch(/\//);
    }
  });
});
