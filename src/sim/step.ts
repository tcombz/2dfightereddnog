import {
  INTRO_TICKS,
  KNOCKDOWN_TICKS,
  LAUNCH_MIN_VY,
  ROUNDS_TO_WIN,
  ROUND_END_TICKS,
  ROUND_TICKS,
  STAGE_WIDTH,
  START_X,
} from './constants';
import { HEROES, getMove } from './heroes';
import { INPUT_MASK, Input } from './input';
import { FS, Phase, Result } from './types';
import type { FighterState, GameState, MoveData, Rect } from './types';

// ---------- state construction ----------

function createFighter(hero: number, slot: number): FighterState {
  return {
    hero,
    x: START_X[slot],
    y: 0,
    vx: 0,
    vy: 0,
    facing: slot === 0 ? 1 : -1,
    health: HEROES[hero].stats.maxHealth,
    state: FS.Idle,
    stateTick: 0,
    moveId: -1,
    moveHit: 0,
    stunTimer: 0,
    prevInput: 0,
  };
}

export function createInitialState(p1Hero: number, p2Hero: number): GameState {
  return {
    tick: 0,
    phase: Phase.Intro,
    phaseTimer: INTRO_TICKS,
    round: 1,
    timer: ROUND_TICKS,
    wins: [0, 0],
    roundResult: Result.None,
    matchResult: Result.None,
    fighters: [createFighter(p1Hero, 0), createFighter(p2Hero, 1)],
  };
}

export function cloneState(s: GameState): GameState {
  return {
    tick: s.tick,
    phase: s.phase,
    phaseTimer: s.phaseTimer,
    round: s.round,
    timer: s.timer,
    wins: [s.wins[0], s.wins[1]],
    roundResult: s.roundResult,
    matchResult: s.matchResult,
    fighters: [{ ...s.fighters[0] }, { ...s.fighters[1] }],
  };
}

// ---------- geometry (shared with the debug overlay) ----------

/** Fighter-local rect to world rect: x = left edge, y = bottom edge (height above floor). */
export function toWorld(f: FighterState, r: Rect): Rect {
  return {
    x: f.facing === 1 ? f.x + r.x : f.x - r.x - r.w,
    y: f.y + r.y,
    w: r.w,
    h: r.h,
  };
}

function localHurtboxes(f: FighterState): Rect[] {
  const hero = HEROES[f.hero];
  switch (f.state) {
    case FS.Knockdown:
    case FS.KO:
      return [];
    case FS.Attack: {
      const frames = getMove(f.hero, f.moveId).frames;
      return f.stateTick < frames.length ? frames[f.stateTick].hurtboxes : hero.hurtboxes.stand;
    }
    case FS.Jump:
      return hero.hurtboxes.air;
    case FS.Crouch:
      return hero.hurtboxes.crouch;
    default:
      return hero.hurtboxes.stand;
  }
}

function localHitboxes(f: FighterState): Rect[] {
  if (f.state !== FS.Attack) return [];
  const frames = getMove(f.hero, f.moveId).frames;
  return f.stateTick < frames.length ? frames[f.stateTick].hitboxes : [];
}

export function getHurtboxes(f: FighterState): Rect[] {
  return localHurtboxes(f).map((r) => toWorld(f, r));
}

export function getHitboxes(f: FighterState): Rect[] {
  return localHitboxes(f).map((r) => toWorld(f, r));
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// ---------- fighter state machine ----------

function setState(f: FighterState, state: number): void {
  f.state = state;
  f.stateTick = 0;
  f.moveId = -1;
  f.moveHit = 0;
}

function toward0(v: number): number {
  return v > 0 ? v - 1 : v < 0 ? v + 1 : 0;
}

function clampX(f: FighterState): void {
  const half = HEROES[f.hero].stats.width >> 1;
  f.x = Math.max(half, Math.min(STAGE_WIDTH - half, f.x));
}

function isActionable(f: FighterState): boolean {
  return (
    f.state === FS.Idle ||
    f.state === FS.Walk ||
    f.state === FS.Crouch ||
    (f.state === FS.Block && f.stunTimer <= 0)
  );
}

function act(f: FighterState, oppX: number, input: number): void {
  const st = HEROES[f.hero].stats;
  f.facing = oppX >= f.x ? 1 : -1;

  const pressed = input & ~f.prevInput;
  const move = pressed & Input.Special ? 2 : pressed & Input.Heavy ? 1 : pressed & Input.Light ? 0 : -1;
  if (move >= 0) {
    setState(f, FS.Attack);
    f.moveId = move;
    f.vx = 0;
    return;
  }

  if (input & Input.Block) {
    if (f.state !== FS.Block) setState(f, FS.Block);
    f.stunTimer = 0;
    f.vx = 0;
    return;
  }

  const dir = (input & Input.Right ? 1 : 0) - (input & Input.Left ? 1 : 0);

  if (input & Input.Up) {
    setState(f, FS.Jump);
    f.vy = st.jumpVelocity;
    f.vx = dir * st.jumpSpeedX;
    return;
  }

  if (input & Input.Down) {
    if (f.state !== FS.Crouch) setState(f, FS.Crouch);
    f.vx = 0;
    return;
  }

  if (dir !== 0) {
    if (f.state !== FS.Walk) setState(f, FS.Walk);
    f.vx = dir * (dir === f.facing ? st.walkSpeed : st.backWalkSpeed);
    return;
  }

  if (f.state !== FS.Idle) setState(f, FS.Idle);
  f.vx = 0;
}

function updateFighter(f: FighterState, oppX: number, input: number): void {
  const st = HEROES[f.hero].stats;
  f.stateTick += 1;

  switch (f.state) {
    case FS.Jump:
      f.vy -= st.gravity;
      f.y += f.vy;
      if (f.y <= 0) {
        f.y = 0;
        f.vy = 0;
        f.vx = 0;
        setState(f, FS.Idle);
      }
      break;
    case FS.Attack:
      if (f.stateTick >= getMove(f.hero, f.moveId).frames.length) setState(f, FS.Idle);
      break;
    case FS.Hitstun:
      f.vx = toward0(f.vx);
      f.stunTimer -= 1;
      if (f.stunTimer <= 0) {
        f.stunTimer = 0;
        setState(f, FS.Idle);
      }
      break;
    case FS.Block:
      if (f.stunTimer > 0) {
        f.vx = toward0(f.vx);
        f.stunTimer -= 1;
      }
      break;
    case FS.Knockdown:
    case FS.KO:
      if (f.y > 0 || f.vy > 0) {
        // Airborne part of the knockdown.
        f.vy -= st.gravity;
        f.y += f.vy;
        if (f.y <= 0) {
          f.y = 0;
          f.vy = 0;
          f.vx = 0;
          f.stunTimer = KNOCKDOWN_TICKS;
        }
      } else if (f.state === FS.Knockdown) {
        f.stunTimer -= 1;
        if (f.stunTimer <= 0) {
          f.stunTimer = 0;
          setState(f, FS.Idle);
        }
      }
      break;
    default:
      break;
  }

  if (isActionable(f)) act(f, oppX, input);

  f.x += f.vx;
  clampX(f);
}

// ---------- interactions ----------

function resolvePush(a: FighterState, b: FighterState): void {
  const down = (f: FighterState): boolean => f.state === FS.Knockdown || f.state === FS.KO;
  if (down(a) || down(b)) return;
  const sa = HEROES[a.hero].stats;
  const sb = HEROES[b.hero].stats;
  if (a.y >= sb.height || b.y >= sa.height) return;

  const minDist = (sa.width + sb.width) >> 1;
  const dir = b.x >= a.x ? 1 : -1;
  const overlap = minDist - Math.abs(b.x - a.x);
  if (overlap <= 0) return;

  const half = overlap >> 1;
  a.x -= dir * half;
  b.x += dir * (overlap - half);
  clampX(a);
  clampX(b);

  // One of them was stopped by a wall: the other takes the rest.
  const rest = minDist - Math.abs(b.x - a.x);
  if (rest > 0) {
    const before = a.x;
    a.x -= dir * rest;
    clampX(a);
    b.x += dir * (rest - Math.abs(a.x - before));
    clampX(b);
  }
}

function findHit(att: FighterState, def: FighterState): MoveData | null {
  if (att.state !== FS.Attack || att.moveHit !== 0) return null;
  const hits = getHitboxes(att);
  if (hits.length === 0) return null;
  const hurts = getHurtboxes(def);
  for (const h of hits) {
    for (const u of hurts) {
      if (overlaps(h, u)) return getMove(att.hero, att.moveId);
    }
  }
  return null;
}

function applyHit(dir: number, def: FighterState, move: MoveData): void {
  if (def.state === FS.Block) {
    def.health = Math.max(1, def.health - move.chipDamage);
    def.stunTimer = move.blockstun;
    def.vx = dir * move.knockback.x;
    return;
  }

  def.health -= move.damage;
  const ko = def.health <= 0;
  if (ko || move.knockdown || def.y > 0) {
    if (ko) def.health = 0;
    setState(def, ko ? FS.KO : FS.Knockdown);
    def.stunTimer = 0;
    def.vx = dir * move.knockback.x;
    def.vy = Math.max(move.knockback.y, LAUNCH_MIN_VY);
  } else {
    setState(def, FS.Hitstun);
    def.stunTimer = move.hitstun;
    def.vx = dir * move.knockback.x;
    def.vy = 0;
  }
}

function resolveHits(a: FighterState, b: FighterState): void {
  // Detect both before applying either, so trades are symmetric.
  const hitByA = findHit(a, b);
  const hitByB = findHit(b, a);
  const dirA = a.facing;
  const dirB = b.facing;
  if (hitByA) {
    a.moveHit = 1;
    applyHit(dirA, b, hitByA);
  }
  if (hitByB) {
    if (b.state === FS.Attack) b.moveHit = 1;
    applyHit(dirB, a, hitByB);
  }
}

// ---------- round and match flow ----------

function checkRoundEnd(s: GameState): void {
  const [a, b] = s.fighters;
  const koA = a.health <= 0;
  const koB = b.health <= 0;
  if (!koA && !koB && s.timer > 0) return;

  let result: number;
  if (koA !== koB) result = koB ? Result.P1 : Result.P2;
  else if (koA) result = Result.Draw;
  else {
    // Time out: compare remaining health as a fraction of each hero's max (cross-multiplied).
    const ha = a.health * HEROES[b.hero].stats.maxHealth;
    const hb = b.health * HEROES[a.hero].stats.maxHealth;
    result = ha > hb ? Result.P1 : hb > ha ? Result.P2 : Result.Draw;
  }

  // A drawn round counts for both players, so a match always ends within three rounds.
  if (result !== Result.P2) s.wins[0] += 1;
  if (result !== Result.P1) s.wins[1] += 1;
  s.roundResult = result;
  s.phase = Phase.RoundEnd;
  s.phaseTimer = ROUND_END_TICKS;
}

function advancePhase(s: GameState): void {
  if (s.phase === Phase.MatchEnd) return;
  s.phaseTimer -= 1;
  if (s.phaseTimer > 0) return;
  s.phaseTimer = 0;

  if (s.phase === Phase.Intro) {
    s.phase = Phase.Fight;
    return;
  }

  // RoundEnd finished.
  const w0 = s.wins[0] >= ROUNDS_TO_WIN;
  const w1 = s.wins[1] >= ROUNDS_TO_WIN;
  if (w0 || w1) {
    s.matchResult = w0 && w1 ? Result.Draw : w0 ? Result.P1 : Result.P2;
    s.phase = Phase.MatchEnd;
    return;
  }
  s.round += 1;
  s.timer = ROUND_TICKS;
  s.roundResult = Result.None;
  s.phase = Phase.Intro;
  s.phaseTimer = INTRO_TICKS;
  for (let i = 0; i < 2; i += 1) {
    const prev = s.fighters[i].prevInput;
    s.fighters[i] = createFighter(s.fighters[i].hero, i);
    s.fighters[i].prevInput = prev;
  }
}

// ---------- the one entry point ----------

/** Advance the game by exactly one tick. Pure: never mutates `state`. */
export function step(state: GameState, p1Input: number, p2Input: number): GameState {
  const s = cloneState(state);
  s.tick += 1;
  const in1 = p1Input & INPUT_MASK;
  const in2 = p2Input & INPUT_MASK;
  const fighting = s.phase === Phase.Fight;
  const [a, b] = s.fighters;

  // Outside the Fight phase fighters keep simulating (falling, recovering) with neutral input.
  const ax = a.x;
  const bx = b.x;
  updateFighter(a, bx, fighting ? in1 : 0);
  updateFighter(b, ax, fighting ? in2 : 0);
  a.prevInput = in1;
  b.prevInput = in2;

  resolvePush(a, b);

  if (fighting) {
    resolveHits(a, b);
    s.timer -= 1;
    checkRoundEnd(s);
  } else {
    advancePhase(s);
  }
  return s;
}
