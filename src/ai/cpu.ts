// Computer opponent. It reads the game state like a player watching the screen and answers with an
// input bitmask, so it plugs in exactly where a human's controls would. Not part of the sim.
import { FS, Guard, HEROES, Input, Kind, Move, Phase, getMove } from '../sim';
import type { FighterState, GameState } from '../sim';

/** Relative directions in a queued input; turned into Left or Right using the fighter's facing. */
const FWD = 256;
const BACK = 512;
const { Up: UP, Down: DOWN, Light: LIGHT, Heavy: HEAVY, Special: SPECIAL } = Input;

interface Level {
  /** Ticks between neutral decisions, and before reacting to an attack. */
  think: number;
  react: number;
  block: number;
  antiAir: number;
  confirm: number;
  punish: number;
  aggression: number;
  projectile: number;
}

const LEVELS: Level[] = [
  { think: 26, react: 16, block: 0.3, antiAir: 0.12, confirm: 0.2, punish: 0.15, aggression: 0.4, projectile: 0.12 },
  { think: 16, react: 9, block: 0.6, antiAir: 0.45, confirm: 0.6, punish: 0.5, aggression: 0.55, projectile: 0.22 },
  { think: 9, react: 4, block: 0.88, antiAir: 0.8, confirm: 0.9, punish: 0.85, aggression: 0.65, projectile: 0.3 },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function reach(f: FighterState, move: number): number {
  let r = 0;
  for (const fr of getMove(f.hero, move).frames) for (const h of fr.hitboxes) r = Math.max(r, h.x + h.w);
  return r;
}

/** How to guard against what the opponent is doing right now: -1 nothing to block, else a Guard value. */
export function incomingGuard(s: GameState, slot: number): number {
  const me = s.fighters[slot];
  const opp = s.fighters[1 - slot];
  const dist = Math.abs(opp.x - me.x);
  if (opp.state === FS.Attack) {
    const m = getMove(opp.hero, opp.moveId);
    if (m.kind !== Kind.Throw && opp.stateTick < m.startup + m.active && dist < reach(opp, opp.moveId) + 90) return m.guard;
  }
  if (opp.projLife > 0) {
    const ahead = opp.projVx > 0 ? me.x - opp.projX : opp.projX - me.x;
    if (ahead > -40 && ahead < 300) return Guard.Mid;
  }
  if ((opp.state === FS.Jump || opp.y > 0) && dist < 260 && opp.vy < 6) return Guard.High;
  return -1;
}

/** Input that blocks the incoming attack correctly (for the training dummy and the CPU). */
export function guardInput(s: GameState, slot: number, guard: number): number {
  const me = s.fighters[slot];
  const opp = s.fighters[1 - slot];
  const away = opp.x >= me.x ? Input.Left : Input.Right;
  return away | (guard === Guard.Low ? Input.Down : 0);
}

export class Cpu {
  private queue: number[] = [];
  private wait = 30;
  private readonly rng: () => number;
  private lastThreat = '';
  private willBlock = false;
  private reactAt = 0;
  private lastConfirm = -1;
  private lastAntiAir = -1;
  private lastPunish = '';

  constructor(
    private readonly level: number,
    seed = 7,
  ) {
    this.rng = mulberry32(seed);
  }

  private chance(p: number): boolean {
    return this.rng() < p;
  }

  private push(...steps: number[]): void {
    this.queue.push(...steps);
  }

  private hold(bits: number, ticks: number): void {
    for (let i = 0; i < ticks; i += 1) this.queue.push(bits);
  }

  private out(rel: number, me: FighterState): number {
    let b = rel & (UP | DOWN | LIGHT | HEAVY | SPECIAL | Input.Block);
    if (rel & FWD) b |= me.facing === 1 ? Input.Right : Input.Left;
    if (rel & BACK) b |= me.facing === 1 ? Input.Left : Input.Right;
    return b;
  }

  next(s: GameState, slot: number): number {
    const me = s.fighters[slot];
    const opp = s.fighters[1 - slot];
    if (s.phase !== Phase.Fight || s.hitstop > 0) {
      if (s.phase !== Phase.Fight) this.queue = [];
      return this.queue.length && s.hitstop > 0 ? this.out(this.queue[0], me) : 0;
    }
    const L = LEVELS[this.level];
    const dist = Math.abs(opp.x - me.x);

    // Combo: my attack just connected, so cancel it into the next part.
    if (me.state === FS.Attack && me.moveHits > 0 && (opp.state === FS.Hitstun || opp.state === FS.Block)) {
      const key = s.tick - me.stateTick;
      if (this.lastConfirm !== key) {
        this.lastConfirm = key;
        const hit = opp.state === FS.Hitstun;
        if (hit && this.chance(L.confirm)) this.queue = this.comboAfter(me);
        else if (!hit && this.chance(L.confirm * 0.3)) this.queue = [0, SPECIAL];
      }
    }
    if (this.queue.length > 0) return this.out(this.queue.shift() as number, me);

    const actionable =
      me.state === FS.Idle || me.state === FS.Walk || me.state === FS.Crouch || (me.state === FS.Block && me.stunTimer === 0);

    // Defence: decide once per incoming attack whether to see it in time.
    const guard = incomingGuard(s, slot);
    if (guard >= 0 && actionable) {
      const key = opp.projLife > 0 && opp.state !== FS.Attack ? `p${opp.projX >> 6}` : `a${opp.moveId}:${s.tick - opp.stateTick}:${opp.state}`;
      if (this.lastThreat !== key) {
        this.lastThreat = key;
        this.willBlock = this.chance(L.block);
        this.reactAt = s.tick + Math.floor(this.rng() * L.react);
        // Anti-air instead of blocking a jump-in.
        const jumping = opp.state === FS.Jump || (opp.state === FS.Attack && opp.y > 0);
        const jumpKey = s.tick - opp.stateTick;
        if (jumping && dist < 230 && this.lastAntiAir !== jumpKey && this.chance(L.antiAir)) {
          this.lastAntiAir = jumpKey;
          this.queue = [FWD, DOWN, DOWN | FWD | SPECIAL];
          return this.out(this.queue.shift() as number, me);
        }
      }
      if (this.willBlock && s.tick >= this.reactAt) {
        // Easy sometimes guards the wrong height.
        const g = this.level === 0 && this.chance(0.25) ? (guard === Guard.Low ? Guard.Mid : Guard.Low) : guard;
        return guardInput(s, slot, g);
      }
    }

    // Punish an attack that whiffed or was blocked and is now recovering.
    if (actionable && opp.state === FS.Attack && dist < 190) {
      const m = getMove(opp.hero, opp.moveId);
      const key = `${opp.moveId}:${s.tick - opp.stateTick}`;
      if (opp.stateTick >= m.startup + m.active && m.recovery - (opp.stateTick - m.startup - m.active) > 8 && this.lastPunish !== key) {
        this.lastPunish = key;
        if (this.chance(L.punish)) {
          this.queue = me.meter >= HEROES[me.hero].moves.super.meterCost && this.chance(0.5) ? [HEAVY | SPECIAL] : [HEAVY];
          return this.out(this.queue.shift() as number, me);
        }
      }
    }

    // A counter stance is waiting: never strike into it; grab it when close.
    if (actionable && opp.state === FS.Attack) {
      const om = getMove(opp.hero, opp.moveId);
      if (om.counter && opp.stateTick < om.startup + om.active) {
        if (dist < 115 && this.chance(L.punish)) return LIGHT | HEAVY;
        return 0;
      }
    }

    if (!actionable) return 0;
    this.wait -= 1;
    if (this.wait > 0) return me.state === FS.Walk ? this.out(me.vx * me.facing > 0 ? FWD : BACK, me) : 0;
    this.wait = L.think + Math.floor(this.rng() * L.think);
    this.neutral(s, me, opp, dist, L);
    return this.queue.length > 0 ? this.out(this.queue.shift() as number, me) : 0;
  }

  private comboAfter(me: FighterState): number[] {
    const superReady = me.meter >= HEROES[me.hero].moves.super.meterCost;
    switch (me.moveId) {
      case Move.Light:
      case Move.CrouchLight:
        return this.chance(0.4) ? [0, LIGHT] : [0, HEAVY];
      case Move.Heavy:
      case Move.Kick:
        return superReady && this.chance(0.6) ? [0, HEAVY | SPECIAL] : [0, SPECIAL];
      case Move.Special:
      case Move.Rising:
        return superReady ? [0, HEAVY | SPECIAL] : [];
      default:
        return [];
    }
  }

  private neutral(_s: GameState, me: FighterState, opp: FighterState, dist: number, L: Level): void {
    const r = this.rng();
    const superReady = me.meter >= HEROES[me.hero].moves.super.meterCost;
    const oppDown = opp.state === FS.Knockdown || opp.state === FS.KO;
    if (oppDown) {
      // Walk up to meet them as they stand.
      if (dist > 170) this.hold(FWD, 12);
      else this.hold(0, 8);
      return;
    }
    if (dist > 420) {
      if (me.projLife === 0 && r < L.projectile * 2) this.push(DOWN, DOWN | FWD, FWD | SPECIAL);
      else if (r < 0.35) this.push(FWD, 0, FWD);
      else this.hold(FWD, 18 + Math.floor(this.rng() * 20));
      return;
    }
    if (dist > 210) {
      if (me.projLife === 0 && r < L.projectile) this.push(DOWN, DOWN | FWD, FWD | SPECIAL);
      else if (r < L.projectile + 0.12) {
        // Jump in with an attack timed for the way down.
        this.push(UP | FWD);
        this.hold(0, 19);
        this.push(HEAVY);
      } else if (r < 0.5 && dist < reach(me, Move.Kick) + 60) this.push(FWD | HEAVY);
      else if (r < 0.5 + L.aggression * 0.4) this.hold(FWD, 10 + Math.floor(this.rng() * 16));
      else this.hold(BACK, 8 + Math.floor(this.rng() * 10));
      return;
    }
    // Close range.
    if (superReady && r < 0.12) this.push(HEAVY | SPECIAL);
    else if (dist < 115 && r < 0.2 && (opp.state === FS.Block || opp.state === FS.Idle || opp.state === FS.Crouch)) this.push(LIGHT | HEAVY);
    else if (r < 0.38) this.push(LIGHT);
    else if (r < 0.5) this.push(DOWN | LIGHT);
    else if (r < 0.6) this.push(DOWN | HEAVY);
    else if (r < 0.7) this.push(HEAVY);
    else if (r < 0.76) this.push(SPECIAL);
    else if (r < 0.88) this.hold(BACK, 12);
    else this.push(BACK, 0, BACK);
  }
}
