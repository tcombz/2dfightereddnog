import { describe, expect, it } from 'vitest';
import {
  FIGHTER_KEYS,
  FS,
  FX,
  GAME_KEYS,
  HEROES,
  Input,
  MAX_SEPARATION,
  METER_MAX,
  MOVE_KEYS,
  Move,
  Phase,
  Result,
  SUPER_FREEZE,
  createInitialState,
  getMove,
  hashState,
  heroIndex,
  step,
} from '../src/sim';
import type { GameState } from '../src/sim';

type InputLog = Array<[number, number]>;

const ROGUE = heroIndex('rogue');
const JET = heroIndex('jetsetter');
const CHRIS = heroIndex('chris');
const LEADER = heroIndex('leader');
const ALL_HEROES = [ROGUE, JET, CHRIS, LEADER];
const { Left: L, Right: R, Up: U, Down: D, Light, Heavy, Special, Block } = Input;

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

function run(log: InputLog, from: GameState = createInitialState(ROGUE, JET), start = 0): GameState {
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

/** A round already in progress with P1 at x 700 and P2 `gap` pixels to its right. */
function fight(p1 = ROGUE, p2 = JET, gap = 120): GameState {
  const s = createInitialState(p1, p2);
  s.phase = Phase.Fight;
  s.phaseTimer = 0;
  s.fighters[0].x = 700;
  s.fighters[1].x = 700 + gap;
  return s;
}

/** Plays a script of [p1, p2] inputs, then `idle` ticks of the last entry's held inputs. */
function play(s: GameState, script: InputLog, idle = 0, hold: [number, number] = [0, 0]): { s: GameState; fx: number[] } {
  const fx: number[] = [];
  for (const [a, b] of script) {
    s = step(s, a, b);
    fx.push(s.fighters[1].fx);
  }
  for (let t = 0; t < idle; t += 1) {
    s = step(s, hold[0], hold[1]);
    fx.push(s.fighters[1].fx);
  }
  return { s, fx };
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
    expect(h1).toMatchInlineSnapshot(`"856bc197"`);
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
    let s = createInitialState(ROGUE, JET);
    const seen = new Set<number>();
    for (const [a, b] of LOG) {
      deepFreeze(s);
      s = step(s, a, b); // throws if step writes to the frozen state
      if (!allIntegers(s)) throw new Error(`non-integer state at tick ${s.tick}`);
      seen.add(s.fighters[0].state).add(s.fighters[1].state);
      const gap = Math.abs(s.fighters[0].x - s.fighters[1].x);
      if (gap > MAX_SEPARATION) throw new Error(`fighters ${gap} apart at tick ${s.tick}`);
    }
    // The random log should exercise the state machine. KO is covered by the scripted match and dashes
    // (which need a precise double tap) by the movement tests.
    for (const st of Object.values(FS)) if (st !== FS.KO && st !== FS.Dash) expect(seen.has(st), String(st)).toBe(true);
  });

  it('the hash covers every state field', () => {
    const s = createInitialState(ROGUE, JET);
    expect(Object.keys(s.fighters[0]).sort()).toEqual([...FIGHTER_KEYS, 'hist'].sort());
    expect(Object.keys(s).sort()).toEqual([...GAME_KEYS, 'wins', 'fighters'].sort());
  });
});

describe('match flow', () => {
  it('a scripted match runs to completion: best of 3, P1 wins 2-0', () => {
    let s = createInitialState(ROGUE, JET);
    let ticks = 0;
    while (s.phase !== Phase.MatchEnd && ticks < 60 * 99 * 4) {
      s = step(s, ticks % 32 === 0 ? Light : R, 0);
      ticks += 1;
    }
    expect(s.phase).toBe(Phase.MatchEnd);
    expect(s.matchResult).toBe(Result.P1);
    expect(s.wins).toEqual([2, 0]);
    expect(s.round).toBe(2);
    expect(s.fighters[1].state).toBe(FS.KO);
  });

  it('time out awards the round to the fighter with more health', () => {
    let s = createInitialState(ROGUE, JET);
    // P2 lands one hit, then nobody acts until the 99 second timer expires.
    let ticks = 0;
    while (s.phase !== Phase.RoundEnd && ticks < 60 * 110) {
      const p2 = ticks % 32 === 0 ? Light : L;
      s = step(s, 0, s.fighters[0].health < HEROES[ROGUE].stats.maxHealth ? 0 : p2);
      ticks += 1;
    }
    expect(s.timer).toBe(0);
    expect(s.roundResult).toBe(Result.P2);
    expect(s.wins).toEqual([0, 1]);
  });

  it('blocking a special only costs chip damage', () => {
    const health = (p2: number): number => {
      let s = createInitialState(ROGUE, JET);
      for (let t = 0; t < 900; t += 1) s = step(s, t % 64 === 0 ? Special : R, p2);
      return s.fighters[1].health;
    };
    const max = HEROES[JET].stats.maxHealth;
    expect(health(0)).toBeLessThan(health(Block));
    expect(health(Block)).toBeLessThan(max);
  });

  it('super meter carries over to the next round', () => {
    let s = createInitialState(ROGUE, JET);
    let ticks = 0;
    while (s.round === 1 && ticks < 60 * 99 * 2) {
      s = step(s, ticks % 32 === 0 ? Light : R, 0);
      ticks += 1;
    }
    expect(s.round).toBe(2);
    expect(s.fighters[0].meter).toBeGreaterThan(0);
  });
});

describe('guarding', () => {
  it('holding back blocks a jab', () => {
    const { s, fx } = play(fight(ROGUE, JET, 110), [[Light, R]], 10, [0, R]);
    expect(fx).toContain(FX.Block);
    expect(s.fighters[1].health).toBe(HEROES[JET].stats.maxHealth);
  });

  it('a sweep is low: it beats a standing guard but not a crouching one', () => {
    const vs = (p2: number): GameState => play(fight(ROGUE, JET, 150), [[D | Heavy, p2]], 24, [D, p2]).s;
    expect(vs(R).fighters[1].state).toBe(FS.Knockdown);
    expect(vs(R | D).fighters[1].health).toBe(HEROES[JET].stats.maxHealth);
  });

  it('a jump attack is an overhead: it beats a crouching guard but not a standing one', () => {
    const vs = (p2: number): { s: GameState; fx: number[] } => {
      const script: InputLog = [[U | R, p2]];
      for (let t = 0; t < 22; t += 1) script.push([0, p2]);
      script.push([Light, p2]);
      return play(fight(ROGUE, JET, 230), script, 30, [0, p2]);
    };
    expect(vs(R | D).s.fighters[1].health).toBeLessThan(HEROES[JET].stats.maxHealth);
    const standing = vs(R);
    expect(standing.fx).toContain(FX.Block);
    expect(standing.s.fighters[1].health).toBe(HEROES[JET].stats.maxHealth);
  });

  it('a throw beats blocking', () => {
    const { s, fx } = play(fight(ROGUE, JET, 90), [[Light | Heavy, R]], 20, [0, R]);
    expect(fx).toContain(FX.Throw);
    expect(s.fighters[1].state).toBe(FS.Knockdown);
  });
});

describe('special moves', () => {
  it('down, down-forward, forward + special throws a projectile that crosses the screen', () => {
    const { s } = play(
      fight(ROGUE, JET, 500),
      [[D, 0], [D, 0], [D | R, 0], [D | R, 0], [R | Special, 0]],
      90,
    );
    expect(s.fighters[1].health).toBeLessThan(HEROES[JET].stats.maxHealth);
  });

  it('only one projectile per player is on screen at a time', () => {
    // Wait out the throw animation; the projectile is still flying.
    let { s } = play(fight(ROGUE, JET, 800), [[D, 0], [D | R, 0], [R | Special, 0]], 45);
    expect(s.fighters[0].projLife).toBeGreaterThan(0);
    s = play(s, [[0, 0], [D, 0], [D | R, 0], [R | Special, 0]]).s;
    expect(s.fighters[0].moveId).toBe(Move.Special);
  });

  it('forward, down, down-forward + special is the rising attack, invulnerable as it starts', () => {
    const { s } = play(fight(ROGUE, JET, 300), [[R, 0], [0, 0], [D, 0], [D | R, 0], [D | R | Special, 0]]);
    expect(s.fighters[0].moveId).toBe(Move.Rising);
    const m = getMove(ROGUE, Move.Rising);
    expect(m.invuln).toBeGreaterThan(m.startup);
  });

  it('a super needs a full meter, spends it and freezes the game for its flash', () => {
    const without = play(fight(), [[Heavy | Special, 0]]).s;
    expect(without.fighters[0].moveId).not.toBe(Move.Super);

    const s = fight();
    s.fighters[0].meter = METER_MAX;
    const withMeter = play(s, [[Heavy | Special, 0]]).s;
    expect(withMeter.fighters[0].moveId).toBe(Move.Super);
    expect(withMeter.fighters[0].meter).toBe(0);
    expect(withMeter.hitstop).toBe(SUPER_FREEZE);
    expect(withMeter.freezeSlot).toBe(0);
  });

  it('every move of both heroes connects from a sensible range', () => {
    const cases: Array<[string, InputLog, number]> = [
      ['light', [[Light, 0]], 110],
      ['heavy', [[Heavy, 0]], 130],
      ['kick', [[R | Heavy, 0]], 150],
      ['crouchLight', [[D | Light, 0]], 110],
      ['sweep', [[D | Heavy, 0]], 150],
      ['throw', [[Light | Heavy, 0]], 90],
      ['special', [[Special, 0]], 150],
      ['projectile', [[D, 0], [D | R, 0], [R | Special, 0]], 400],
      ['rising', [[R, 0], [0, 0], [D, 0], [D | R | Special, 0]], 100],
      ['super', [[Heavy | Special, 0]], 150],
    ];
    for (const hero of ALL_HEROES) {
      for (const [name, script, gap] of cases) {
        // A counter stance only hits when it is attacked; it has its own test.
        if (getMove(hero, Move.Special).counter && name === 'special') continue;
        const s = fight(hero, hero === ROGUE ? JET : ROGUE, gap);
        s.fighters[0].meter = METER_MAX;
        const out = play(s, script, 100).s;
        const def = out.fighters[1];
        expect(def.health, `${HEROES[hero].id} ${name}`).toBeLessThan(HEROES[def.hero].stats.maxHealth);
      }
    }
  });
});

describe('combos', () => {
  it('a jab that hits can be cancelled into a special, and the second hit is scaled', () => {
    const script: InputLog = [[Light, 0], [0, 0], [0, 0], [0, 0], [0, 0], [Special, 0]];
    const { s } = play(fight(ROGUE, JET, 110), script, 30, [Special, 0]);
    const def = s.fighters[1];
    const jab = getMove(ROGUE, Move.Light).damage;
    const palm = getMove(ROGUE, Move.Special).damage;
    expect(def.comboDamage).toBe(jab + ((palm * 15) >> 4));
    expect(def.health).toBe(HEROES[JET].stats.maxHealth - def.comboDamage);
  });

  it('a whiffed jab cannot be cancelled', () => {
    const { s } = play(fight(ROGUE, JET, 400), [[Light, 0], [0, 0], [0, 0], [0, 0], [0, 0], [Special, 0]]);
    expect(s.fighters[0].moveId).toBe(Move.Light);
  });
});

describe('feel and combo depth', () => {
  it('an attack pressed a few ticks before recovery ends comes out on the first free tick', () => {
    let s = fight(ROGUE, JET, 500);
    s = play(s, [[Light, 0]]).s; // whiffed jab, 14 ticks long
    const jab = getMove(ROGUE, Move.Light);
    const total = jab.startup + jab.active + jab.recovery;
    for (let t = 1; t < total; t += 1) s = step(s, t === total - 3 ? Heavy : 0, 0);
    expect(s.fighters[0].moveId).toBe(Move.Light);
    s = step(s, 0, 0);
    expect(s.fighters[0].moveId).toBe(Move.Heavy);
  });

  it('a rising attack launches and a super cancel juggles the opponent', () => {
    let s = fight(ROGUE, JET, 110);
    s.fighters[0].meter = METER_MAX;
    s = play(s, [[R, 0], [0, 0], [D, 0], [D | R | Special, 0]]).s;
    let maxCombo = 0;
    let superStarted = false;
    for (let t = 0; t < 140; t += 1) {
      const launched = s.fighters[1].state === FS.Knockdown && s.fighters[1].combo >= 1;
      s = step(s, launched && !superStarted ? Heavy | Special : 0, 0);
      if (s.fighters[0].moveId === Move.Super) superStarted = true;
      maxCombo = Math.max(maxCombo, s.fighters[1].combo);
    }
    expect(superStarted).toBe(true);
    expect(maxCombo).toBeGreaterThanOrEqual(2);
  });

  it('the second button of a super or throw still counts when pressed a few ticks late', () => {
    for (const late of [1, 2, 3, 4]) {
      let s = fight(JET, ROGUE, 500);
      s.fighters[0].meter = METER_MAX;
      s = step(s, Heavy, 0);
      for (let t = 1; t < late; t += 1) s = step(s, Heavy, 0);
      s = step(s, Heavy | Special, 0);
      expect(s.fighters[0].moveId).toBe(Move.Super);
    }
    let s = fight(ROGUE, JET, 90);
    s = step(s, Light, 0);
    for (let t = 1; t < 3; t += 1) s = step(s, Light, 0);
    s = step(s, Light | Heavy, 0);
    expect(s.fighters[0].moveId).toBe(Move.Throw);
  });

  it('pressing throw back breaks a throw', () => {
    const { s, fx } = play(fight(ROGUE, JET, 90), [[Light | Heavy, Light | Heavy]], 20);
    expect(fx).toContain(FX.Tech);
    expect(s.fighters[1].health).toBe(HEROES[JET].stats.maxHealth);
    expect(s.fighters[0].health).toBe(HEROES[ROGUE].stats.maxHealth);
  });

  it('simple specials: forward + special throws the projectile, down + special is the rising attack', () => {
    const simple = (input: number): number => {
      const s = createInitialState(ROGUE, JET, { simple: [true, false] });
      s.phase = Phase.Fight;
      s.fighters[0].x = 600;
      s.fighters[1].x = 1000;
      return play(s, [[input, 0]]).s.fighters[0].moveId;
    };
    expect(simple(R | Special)).toBe(Move.Projectile);
    expect(simple(D | Special)).toBe(Move.Rising);
    expect(simple(Special)).toBe(Move.Special);
  });
});

/**
 * Plays a combo route like a player confirming each hit: perform a step, wait for the hit to land,
 * then input the next step. Returns the longest combo the defender took.
 */
function comboTrial(att: number, def: number, steps: InputLog[], gap = 105): number {
  let s = fight(att, def, gap);
  s.fighters[0].meter = METER_MAX;
  let best = 0;
  for (let k = 0; k < steps.length; k += 1) {
    if (k > 0) {
      const before = s.fighters[1].combo;
      let waited = 0;
      while (s.fighters[1].combo <= before && waited < 60) {
        s = step(s, 0, 0);
        best = Math.max(best, s.fighters[1].combo);
        waited += 1;
      }
    }
    for (const [a, b] of steps[k]) {
      s = step(s, a, b);
      best = Math.max(best, s.fighters[1].combo);
    }
  }
  for (let t = 0; t < 90; t += 1) {
    s = step(s, 0, 0);
    best = Math.max(best, s.fighters[1].combo);
  }
  return best;
}

describe('combo routes from the How to Play page work for every fighter', () => {
  const qcf: InputLog = [[D, 0], [D | R, 0], [R | Special, 0]];
  const routes: Array<[string, InputLog[], number]> = [
    ['LIGHT, LIGHT, HEAVY > projectile', [[[Light, 0]], [[Light, 0]], [[Heavy, 0]], qcf], 4],
    ['low LIGHT, low LIGHT, sweep', [[[D | Light, 0]], [[D, 0], [D | Light, 0]], [[D, 0], [D | Heavy, 0]]], 3],
    ['HEAVY > super', [[[Heavy, 0]], [[Heavy | Special, 0]]], 3],
    ['rising > super juggle', [[[R, 0], [0, 0], [D, 0], [D | R | Special, 0]], [[Heavy | Special, 0]]], 2],
  ];
  for (const [name, steps, expected] of routes) {
    it(name, () => {
      for (const hero of ALL_HEROES) {
        expect(comboTrial(hero, JET, steps), HEROES[hero].id).toBeGreaterThanOrEqual(expected);
      }
    });
  }
});

describe('counter stance', () => {
  it("Chris's Diplomacy deflects a strike and answers it", () => {
    // Chris braces; the Rogue jabs into the stance.
    const { s, fx } = play(fight(ROGUE, CHRIS, 110), [[0, Special], [0, 0], [0, 0], [Light, 0]], 30);
    expect(s.fighters[1].health).toBe(HEROES[CHRIS].stats.maxHealth);
    expect(s.fighters[0].health).toBeLessThan(HEROES[ROGUE].stats.maxHealth);
    expect(s.fighters[0].state).toBe(FS.Knockdown);
    expect(fx).not.toContain(FX.Hit);
  });

  it('a throw beats the counter stance', () => {
    const { s } = play(fight(ROGUE, CHRIS, 90), [[0, Special], [0, 0], [0, 0], [Light | Heavy, 0]], 30);
    expect(s.fighters[1].health).toBeLessThan(HEROES[CHRIS].stats.maxHealth);
  });
});

describe('every hero', () => {
  it('plays a deterministic match against every other hero', () => {
    for (const a of ALL_HEROES) {
      for (const b of ALL_HEROES) {
        const log = makeLog(a * 31 + b, 6000);
        expect(hashState(run(log, createInitialState(a, b)))).toBe(hashState(run(log, createInitialState(a, b))));
      }
    }
  });
});

describe('movement', () => {
  it('tapping forward twice dashes farther than walking', () => {
    const dashed = play(fight(ROGUE, JET, 700), [[R, 0], [0, 0], [R, 0]], 12, [0, 0]).s.fighters[0].x;
    const walked = play(fight(ROGUE, JET, 700), [[R, 0], [R, 0], [R, 0]], 12, [R, 0]).s.fighters[0].x;
    expect(dashed).toBeGreaterThan(walked);
  });

  it('fighters can never walk farther apart than the camera frames', () => {
    const { s } = play(fight(ROGUE, JET, 600), [], 200, [L, R]);
    expect(Math.abs(s.fighters[1].x - s.fighters[0].x)).toBe(MAX_SEPARATION);
  });
});

describe('training mode', () => {
  it('has no timer, never KOs, and refills health once a combo ends', () => {
    let s = createInitialState(ROGUE, JET, { training: true });
    expect(s.phase).toBe(Phase.Fight);
    s.fighters[0].x = 700;
    s.fighters[1].x = 810;
    // The jab comes out on its 5th tick; set P2 nearly dead just before it lands.
    s = play(s, [[Light, 0]], 3).s;
    s.fighters[1].health = 5;
    s = play(s, [], 2).s;
    expect(s.fighters[1].health).toBe(1);
    s = play(s, [], 40).s;
    expect(s.fighters[1].health).toBe(HEROES[JET].stats.maxHealth);
    expect(s.timer).toBe(createInitialState(ROGUE, JET).timer);
    expect(s.fighters[0].meter).toBe(METER_MAX);
  });
});

describe('hero data', () => {
  it('frame data is consistent and integer-only', () => {
    for (const hero of HEROES) {
      expect(allIntegers(hero)).toBe(true);
      for (const key of MOVE_KEYS) {
        const m = hero.moves[key];
        expect(m, `${hero.id} ${key}`).toBeDefined();
        expect(m.frames.length).toBe(m.startup + m.active + m.recovery);
        expect(m.hits).toBeGreaterThanOrEqual(1);
        m.frames.forEach((f, i) => {
          const active = i >= m.startup && i < m.startup + m.active;
          // Projectile moves hit with the projectile, and counter stances with their answer.
          if (m.projectile || m.counter) expect(f.hitboxes.length).toBe(0);
          else expect(f.hitboxes.length > 0, `${hero.id} ${key} frame ${i}`).toBe(active);
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
      expect(raw, file).not.toMatch(/phaser|\.\.\/render|\.\.\/dev|\.\.\/input|\.\.\/ai/i);
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
