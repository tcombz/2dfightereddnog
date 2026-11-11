import {
  BUFFER_TICKS,
  COMBO_SCALE,
  DASH_WINDOW,
  GUARD_RANGE,
  HIST_LEN,
  HIST_MASK,
  INTRO_TICKS,
  JUGGLE_LIMIT,
  KNOCKDOWN_TICKS,
  KO_FREEZE,
  LAUNCH_MIN_VY,
  MAX_SEPARATION,
  METER_MAX,
  MOTION_WINDOW,
  PRESS_LENIENCY,
  PROJECTILE_GUARD_RANGE,
  ROUNDS_TO_WIN,
  ROUND_END_TICKS,
  ROUND_TICKS,
  STAGE_WIDTH,
  START_X,
  SUPER_FREEZE,
} from './constants';
import { HEROES, getMove } from './heroes';
import { INPUT_MASK, Input, numpad } from './input';
import { Cancel, FS, FX, Guard, Kind, Move, Phase, Result } from './types';
import type { FighterState, GameState, HitData, MoveData, ProjectileData, Rect } from './types';

// ---------- state construction ----------

function createFighter(hero: number, slot: number): FighterState {
  const hist: number[] = [];
  for (let i = 0; i < HIST_LEN; i += 1) hist.push(5);
  return {
    hero,
    x: START_X[slot],
    y: 0,
    vx: 0,
    vy: 0,
    push: 0,
    facing: slot === 0 ? 1 : -1,
    health: HEROES[hero].stats.maxHealth,
    meter: 0,
    state: FS.Idle,
    stateTick: 0,
    moveId: -1,
    moveHits: 0,
    hitTick: 0,
    stunTimer: 0,
    low: 0,
    combo: 0,
    comboDamage: 0,
    juggles: 0,
    armorHits: 0,
    buf: 0,
    bufAge: 0,
    bufTick: 0,
    simple: 0,
    prevInput: 0,
    hist,
    projX: 0,
    projY: 0,
    projVx: 0,
    projLife: 0,
    projMove: -1,
    fx: FX.None,
    fxX: 0,
    fxY: 0,
    fxPower: 0,
  };
}

export interface MatchOptions {
  /** No timer, no KOs, health refills after every combo and meter stays full. */
  training?: boolean;
  /** Simple specials per player (accessibility): direction + special instead of motions. */
  simple?: [boolean, boolean];
}

export function createInitialState(p1Hero: number, p2Hero: number, options: MatchOptions = {}): GameState {
  const s: GameState = {
    tick: 0,
    phase: Phase.Intro,
    phaseTimer: INTRO_TICKS,
    round: 1,
    timer: ROUND_TICKS,
    wins: [0, 0],
    roundResult: Result.None,
    matchResult: Result.None,
    hitstop: 0,
    freezeSlot: -1,
    training: options.training ? 1 : 0,
    fighters: [createFighter(p1Hero, 0), createFighter(p2Hero, 1)],
  };
  s.fighters.forEach((f, i) => {
    f.simple = options.simple?.[i] ? 1 : 0;
  });
  if (s.training) {
    s.phase = Phase.Fight;
    s.phaseTimer = 0;
    for (const f of s.fighters) f.meter = METER_MAX;
  }
  return s;
}

function cloneFighter(f: FighterState): FighterState {
  return { ...f, hist: f.hist.slice() };
}

export function cloneState(s: GameState): GameState {
  return {
    ...s,
    wins: [s.wins[0], s.wins[1]],
    fighters: [cloneFighter(s.fighters[0]), cloneFighter(s.fighters[1])],
  };
}

// ---------- geometry (shared with the renderer) ----------

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
  const boxes = HEROES[f.hero].hurtboxes;
  switch (f.state) {
    case FS.Knockdown:
      // Launched: only juggle moves can connect (checked in findHit).
      return f.y > 0 ? boxes.air : [];
    case FS.KO:
      return [];
    case FS.Attack: {
      const m = getMove(f.hero, f.moveId);
      if (f.stateTick < m.invuln) return [];
      if (f.stateTick < m.frames.length) return m.frames[f.stateTick].hurtboxes;
      return m.air ? boxes.air : boxes.stand;
    }
    case FS.Jump:
      return boxes.air;
    case FS.Crouch:
      return boxes.crouch;
    case FS.Block:
    case FS.Hitstun:
      return f.low ? boxes.crouch : boxes.stand;
    default:
      return boxes.stand;
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

function projData(f: FighterState): ProjectileData {
  return getMove(f.hero, f.projMove).projectile as ProjectileData;
}

/** World rect of a fighter's projectile, or null when none is on screen. */
export function getProjectile(f: FighterState): Rect | null {
  if (f.projLife <= 0) return null;
  const p = projData(f);
  return { x: f.projX, y: f.projY, w: p.w, h: p.h };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** True while the move's hitboxes are out. */
export function isActiveTick(m: MoveData, tick: number): boolean {
  return tick >= m.startup && tick < m.startup + m.active;
}

// ---------- small helpers ----------

function setState(f: FighterState, state: number): void {
  f.state = state;
  f.stateTick = 0;
  f.moveId = -1;
  f.moveHits = 0;
  f.hitTick = 0;
}

function toward0(v: number): number {
  return v > 0 ? v - 1 : v < 0 ? v + 1 : 0;
}

function clampX(f: FighterState): void {
  const half = HEROES[f.hero].stats.width >> 1;
  f.x = Math.max(half, Math.min(STAGE_WIDTH - half, f.x));
}

/** Gravity step. Returns true on the tick the fighter lands. */
function fall(f: FighterState): boolean {
  f.vy -= HEROES[f.hero].stats.gravity;
  f.y += f.vy;
  if (f.y > 0) return false;
  f.y = 0;
  f.vy = 0;
  return true;
}

function isActionable(f: FighterState): boolean {
  return (
    f.state === FS.Idle ||
    f.state === FS.Walk ||
    f.state === FS.Crouch ||
    (f.state === FS.Block && f.stunTimer <= 0)
  );
}

function setFx(f: FighterState, kind: number, x: number, y: number, power: number): void {
  f.fx = kind;
  f.fxX = x;
  f.fxY = y;
  f.fxPower = power;
}

// ---------- reading the stick ----------

const MOTION_NONE = 0;
const MOTION_QCF = 1;
const MOTION_DP = 2;

function dirAt(f: FighterState, tick: number, back: number): number {
  return f.hist[(tick - back) & HIST_MASK];
}

function seek(f: FighterState, tick: number, from: number, to: number, a: number, b: number): number {
  for (let k = from; k < to; k += 1) {
    const d = dirAt(f, tick, k);
    if (d === a || d === b) return k;
  }
  return -1;
}

/** Quarter circle forward (down, down-forward, forward) or dragon punch (forward, down, down-forward). */
function motion(f: FighterState, tick: number): number {
  let k = 0;
  while (k < 4 && dirAt(f, tick, k) === 5) k += 1;
  const end = dirAt(f, tick, k);
  const limit = k + MOTION_WINDOW;
  if (end === 3) {
    const d = seek(f, tick, k + 1, limit, 2, 1);
    if (d >= 0 && seek(f, tick, d + 1, limit, 6, 6) >= 0) return MOTION_DP;
  }
  if (end === 6 && seek(f, tick, k + 1, limit, 2, 1) >= 0) return MOTION_QCF;
  return MOTION_NONE;
}

/** Forward or back tapped twice: 1 = dash, -1 = backdash, 0 = no dash. */
function dashInput(f: FighterState, tick: number): number {
  const now = dirAt(f, tick, 0);
  if (now !== 6 && now !== 4) return 0;
  if (dirAt(f, tick, 1) !== 5) return 0;
  let k = 2;
  while (k < DASH_WINDOW && dirAt(f, tick, k) === 5) k += 1;
  if (k >= DASH_WINDOW || dirAt(f, tick, k) !== now) return 0;
  return now === 6 ? 1 : -1;
}

function reach(m: MoveData): number {
  let r = 0;
  for (const fr of m.frames) for (const h of fr.hitboxes) r = Math.max(r, h.x + h.w);
  return r;
}

/** An attack or projectile is coming, so holding back raises a guard instead of walking away. */
function threatened(f: FighterState, opp: FighterState): boolean {
  if (opp.state === FS.Attack) {
    const m = getMove(opp.hero, opp.moveId);
    if (opp.stateTick < m.startup + m.active && Math.abs(opp.x - f.x) < reach(m) + GUARD_RANGE) return true;
  }
  if (opp.projLife > 0) {
    const ahead = opp.projVx > 0 ? f.x - opp.projX : opp.projX - f.x;
    if (ahead > -60 && ahead < PROJECTILE_GUARD_RANGE) return true;
  }
  return false;
}

// ---------- choosing and starting moves ----------

function chooseMove(f: FighterState, input: number, pressed: number, tick: number): number {
  const light = (pressed & Input.Light) !== 0;
  const heavy = (pressed & Input.Heavy) !== 0;
  const special = (pressed & Input.Special) !== 0;
  if (!light && !heavy && !special) return -1;
  if (f.y > 0 || f.state === FS.Jump) return light || heavy ? Move.JumpAttack : -1;

  // A buffered press counts as held, so two-button moves still work when pressed early.
  const holdLight = ((input | pressed) & Input.Light) !== 0;
  const holdHeavy = ((input | pressed) & Input.Heavy) !== 0;
  const holdSpecial = ((input | pressed) & Input.Special) !== 0;
  if ((heavy || special) && holdHeavy && holdSpecial && f.meter >= HEROES[f.hero].moves.super.meterCost) {
    return Move.Super;
  }
  if ((light || heavy) && holdLight && holdHeavy) return Move.Throw;

  // A buffered press keeps the direction held when it was pressed: down + LIGHT pressed during a
  // hit is still a low jab if down is let go before it comes out.
  const buffered = pressed === f.buf && f.buf !== 0;
  const dir = buffered ? dirAt(f, f.bufTick, 0) : numpad(input, f.facing);
  if (special) {
    const m = motion(f, buffered ? f.bufTick : tick);
    if (m === MOTION_DP || (f.simple && dir <= 3)) return Move.Rising;
    if ((m === MOTION_QCF || (f.simple && dir === 6)) && f.projLife === 0) return Move.Projectile;
    return Move.Special;
  }
  if (heavy) return dir <= 3 ? Move.Sweep : dir === 6 ? Move.Kick : Move.Heavy;
  return dir <= 3 ? Move.CrouchLight : Move.Light;
}

function startMove(s: GameState, f: FighterState, slot: number, moveId: number): void {
  const m = getMove(f.hero, moveId);
  setState(f, FS.Attack);
  f.moveId = moveId;
  f.buf = 0;
  f.bufAge = 0;
  f.armorHits = 0;
  if (!m.air) {
    f.vx = 0;
    f.vy = 0;
  }
  f.low = moveId === Move.CrouchLight || moveId === Move.Sweep ? 1 : 0;
  if (m.kind === Kind.Super) {
    f.meter -= m.meterCost;
    s.hitstop = SUPER_FREEZE;
    s.freezeSlot = slot;
  }
}

function cancelBit(kind: number): number {
  if (kind === Kind.Normal) return Cancel.Normal;
  if (kind === Kind.Special) return Cancel.Special;
  if (kind === Kind.Super) return Cancel.Super;
  return 0;
}

/** Combos: a move that connected may be cancelled into what its data allows. */
function tryCancel(s: GameState, f: FighterState, slot: number, input: number): void {
  const pressed = f.buf;
  if (pressed === 0) return;
  const m = getMove(f.hero, f.moveId);
  if (m.air) return;
  const next = chooseMove(f, input, pressed, s.tick);
  if (next < 0) return;
  // The second button of a throw or super pressed a few ticks late still counts (before the normal lands).
  if (m.kind === Kind.Normal && f.moveHits === 0 && f.stateTick <= PRESS_LENIENCY && (next === Move.Throw || next === Move.Super)) {
    startMove(s, f, slot, next);
    return;
  }
  if (f.moveHits === 0) return;
  const target = getMove(f.hero, next);
  if (target.air || (m.cancel & cancelBit(target.kind)) === 0) return;
  startMove(s, f, slot, next);
}

// ---------- the fighter state machine ----------

function act(s: GameState, f: FighterState, slot: number, opp: FighterState, input: number): void {
  const st = HEROES[f.hero].stats;
  if (opp.x !== f.x) f.facing = opp.x > f.x ? 1 : -1;

  const move = chooseMove(f, input, f.buf, s.tick);
  if (move >= 0) {
    startMove(s, f, slot, move);
    return;
  }

  const dir = numpad(input, f.facing);
  const down = dir <= 3;
  const back = dir === 1 || dir === 4 || dir === 7;

  if ((input & Input.Block) !== 0 || (back && threatened(f, opp))) {
    if (f.state !== FS.Block) setState(f, FS.Block);
    f.low = down ? 1 : 0;
    f.vx = 0;
    return;
  }

  const dash = dashInput(f, s.tick);
  if (dash !== 0) {
    setState(f, FS.Dash);
    f.low = 0;
    f.stunTimer = dash > 0 ? st.dashTicks : st.backdashTicks;
    f.vx = dash > 0 ? f.facing * st.dashSpeed : -f.facing * st.backdashSpeed;
    return;
  }

  if (dir >= 7) {
    setState(f, FS.Jump);
    f.low = 0;
    f.vy = st.jumpVelocity;
    f.vx = (dir === 9 ? 1 : dir === 7 ? -1 : 0) * f.facing * st.jumpSpeedX;
    return;
  }

  if (down) {
    if (f.state !== FS.Crouch) setState(f, FS.Crouch);
    f.low = 1;
    f.vx = 0;
    return;
  }

  f.low = 0;
  if (dir === 6 || dir === 4) {
    if (f.state !== FS.Walk) setState(f, FS.Walk);
    f.vx = dir === 6 ? f.facing * st.walkSpeed : -f.facing * st.backWalkSpeed;
    return;
  }

  if (f.state !== FS.Idle) setState(f, FS.Idle);
  f.vx = 0;
}

function spawnProjectile(f: FighterState, p: ProjectileData): void {
  f.projMove = f.moveId;
  f.projLife = p.life;
  f.projVx = f.facing * p.speed;
  f.projX = f.facing === 1 ? f.x + p.x : f.x - p.x - p.w;
  f.projY = f.y + p.y;
}

function updateFighter(s: GameState, f: FighterState, slot: number, opp: FighterState, input: number): void {
  f.stateTick += 1;

  // Input buffer: remember fresh attack presses for a few ticks so early presses still come out.
  const fresh = input & ~f.prevInput & (Input.Light | Input.Heavy | Input.Special);
  if (fresh !== 0) {
    f.buf = fresh;
    f.bufAge = 0;
    f.bufTick = s.tick;
  } else if (f.buf !== 0) {
    f.bufAge += 1;
    if (f.bufAge > BUFFER_TICKS) {
      f.buf = 0;
      f.bufAge = 0;
    }
  }

  switch (f.state) {
    case FS.Jump:
      if (fall(f)) {
        f.vx = 0;
        setState(f, FS.Idle);
      }
      break;
    case FS.Attack: {
      const m = getMove(f.hero, f.moveId);
      if (m.air) {
        if (fall(f)) {
          f.vx = 0;
          setState(f, FS.Idle);
        }
      } else if (f.stateTick >= m.frames.length) {
        setState(f, FS.Idle);
      } else {
        if (m.teleport !== 0 && f.stateTick === m.startup - 1) {
          // Blink in: straight to the opponent, stopping in front of them rather than passing through.
          const gap = Math.abs(opp.x - f.x) - ((HEROES[f.hero].stats.width + HEROES[opp.hero].stats.width) >> 1);
          const toward = opp.x >= f.x ? 1 : -1;
          f.x += toward * Math.max(0, Math.min(m.teleport, gap));
          clampX(f);
        } else if (m.teleport !== 0 && f.stateTick === m.startup + m.active && f.moveHits > 0) {
          // Strike out: blink back after landing it.
          f.x -= f.facing * (m.teleport >> 1);
          clampX(f);
        }
        f.vx = isActiveTick(m, f.stateTick) ? f.facing * m.advance : 0;
        const p = m.projectile;
        if (p !== null && f.stateTick === p.spawnTick && f.projLife === 0) spawnProjectile(f, p);
      }
      break;
    }
    case FS.Dash:
      f.stunTimer -= 1;
      if (f.stunTimer <= 0) {
        f.stunTimer = 0;
        f.vx = 0;
        setState(f, FS.Idle);
      }
      break;
    case FS.Hitstun:
      f.stunTimer -= 1;
      if (f.stunTimer <= 0) {
        f.stunTimer = 0;
        setState(f, FS.Idle);
      }
      break;
    case FS.Block:
      if (f.stunTimer > 0) {
        f.stunTimer -= 1;
        f.low = input & Input.Down ? 1 : 0;
      }
      break;
    case FS.Knockdown:
    case FS.KO:
      if (f.y > 0 || f.vy > 0) {
        if (fall(f)) {
          f.vx = 0;
          f.juggles = 0;
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

  // Knockback slides along the floor; in the air it fades at half speed so launches carry.
  if (f.push !== 0) {
    f.x += f.push;
    if (f.y === 0 || (f.stateTick & 1) === 0) f.push = toward0(f.push);
  }

  if (f.state === FS.Jump && (f.buf & (Input.Light | Input.Heavy)) !== 0) {
    startMove(s, f, slot, Move.JumpAttack);
  }
  if (f.state === FS.Attack) tryCancel(s, f, slot, input);
  if (isActionable(f)) {
    f.combo = 0;
    act(s, f, slot, opp, input);
  }

  f.x += f.vx;
  clampX(f);
}

function updateProjectile(f: FighterState): void {
  if (f.projLife <= 0) return;
  f.projX += f.projVx;
  f.projLife -= 1;
  const p = projData(f);
  if (f.projX + p.w < 0 || f.projX > STAGE_WIDTH) f.projLife = 0;
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

/** The camera can only frame MAX_SEPARATION: whoever walked away is held back. */
function enforceSeparation(a: FighterState, b: FighterState, a0x: number, b0x: number): void {
  const dist = Math.abs(b.x - a.x);
  if (dist <= MAX_SEPARATION) return;
  const excess = dist - MAX_SEPARATION;
  const dir = b.x >= a.x ? 1 : -1;
  const aAway = Math.max(0, (a0x - a.x) * dir);
  const bAway = Math.max(0, (b.x - b0x) * dir);
  let fixA = Math.min(aAway, excess);
  let fixB = Math.min(bAway, excess - fixA);
  const rest = excess - fixA - fixB;
  fixA += rest >> 1;
  fixB += rest - (rest >> 1);
  a.x += dir * fixA;
  b.x -= dir * fixB;
  clampX(a);
  clampX(b);
}

interface Contact {
  data: HitData;
  guard: number;
  kind: number;
  /** Most hits of the move, to know which hit is the last. */
  hits: number;
  projectile: boolean;
  x: number;
  y: number;
}

function contact(data: HitData, guard: number, kind: number, hits: number, projectile: boolean, h: Rect, u: Rect): Contact {
  const x0 = Math.max(h.x, u.x);
  const x1 = Math.min(h.x + h.w, u.x + u.w);
  const y0 = Math.max(h.y, u.y);
  const y1 = Math.min(h.y + h.h, u.y + u.h);
  return { data, guard, kind, hits, projectile, x: (x0 + x1) >> 1, y: (y0 + y1) >> 1 };
}

function throwable(def: FighterState): boolean {
  if (def.y > 0) return false;
  return (
    def.state === FS.Idle ||
    def.state === FS.Walk ||
    def.state === FS.Crouch ||
    def.state === FS.Dash ||
    def.state === FS.Attack ||
    (def.state === FS.Block && def.stunTimer <= 0)
  );
}

function findHit(att: FighterState, def: FighterState): Contact | null {
  if (att.state !== FS.Attack) return null;
  const m = getMove(att.hero, att.moveId);
  if (att.moveHits >= m.hits) return null;
  if (att.moveHits > 0 && att.stateTick - att.hitTick < m.rehit) return null;
  if (m.kind === Kind.Throw && !throwable(def)) return null;
  if (def.state === FS.Knockdown && (m.juggle === 0 || def.juggles >= JUGGLE_LIMIT)) return null;
  const hits = getHitboxes(att);
  if (hits.length === 0) return null;
  const hurts = getHurtboxes(def);
  for (const h of hits) {
    for (const u of hurts) {
      if (overlaps(h, u)) return contact(m, m.guard, m.kind, m.hits, false, h, u);
    }
  }
  return null;
}

function findProjectileHit(att: FighterState, def: FighterState): Contact | null {
  const r = getProjectile(att);
  if (r === null || def.state === FS.Knockdown) return null;
  for (const u of getHurtboxes(def)) {
    if (overlaps(r, u)) return contact(projData(att), Guard.Mid, Kind.Special, 1, true, r, u);
  }
  return null;
}

/** Holding away from the hit (or the block button) guards, if the stance matches the hit. */
function guarding(def: FighterState, guard: number, dir: number): boolean {
  if (guard === Guard.Throw || def.y > 0) return false;
  const input = def.prevInput;
  const blockstun = def.state === FS.Block && def.stunTimer > 0;
  if (!blockstun) {
    const ready =
      def.state === FS.Idle || def.state === FS.Walk || def.state === FS.Crouch || def.state === FS.Block;
    if (!ready) return false;
    const away = dir > 0 ? Input.Right : Input.Left;
    const toward = dir > 0 ? Input.Left : Input.Right;
    const back = (input & away) !== 0 && (input & toward) === 0;
    if (!back && (input & Input.Block) === 0) return false;
  }
  const low = (input & Input.Down) !== 0;
  if (guard === Guard.Low && !low) return false;
  if (guard === Guard.High && low) return false;
  return true;
}

/** Pushback a cornered defender can't take goes to the attacker instead. */
function cornerPush(att: FighterState, def: FighterState, dir: number, kb: number): void {
  if (kb <= 0) return;
  const half = HEROES[def.hero].stats.width >> 1;
  const room = dir > 0 ? STAGE_WIDTH - half - def.x : def.x - half;
  if (room < (kb * (kb + 1)) >> 1) att.push = -dir * kb;
}

function applyHit(s: GameState, att: FighterState, def: FighterState, c: Contact): void {
  const d = c.data;
  const dir = c.projectile ? (att.projVx > 0 ? 1 : -1) : att.facing;
  if (!c.projectile) {
    att.moveHits += 1;
    att.hitTick = att.stateTick;
  }
  s.freezeSlot = -1;

  // Throw break: the defender is holding throw or throwing too, so both are pushed apart unhurt.
  const breaking =
    ((def.prevInput & Input.Light) !== 0 && (def.prevInput & Input.Heavy) !== 0) ||
    (def.state === FS.Attack && def.moveId === Move.Throw);
  if (c.kind === Kind.Throw && breaking) {
    att.moveHits = c.hits;
    att.push = -dir * 10;
    def.push = dir * 10;
    if (def.state === FS.Attack) setState(def, FS.Idle);
    s.hitstop = Math.max(s.hitstop, 8);
    setFx(def, FX.Tech, c.x, c.y, 8);
    return;
  }

  // Armor: a big move shrugs off a strike or two and keeps coming (throws and supers break through).
  if (def.state === FS.Attack && c.kind !== Kind.Throw && c.kind !== Kind.Super) {
    const dm = getMove(def.hero, def.moveId);
    if (def.armorHits < dm.armor && def.stateTick < dm.startup + dm.active) {
      def.armorHits += 1;
      def.health = Math.max(1, def.health - Math.max(1, d.damage >> 1));
      att.meter = Math.min(METER_MAX, att.meter + (d.damage >> 2));
      s.hitstop = Math.max(s.hitstop, d.hitstop);
      setFx(def, FX.Armor, c.x, c.y, d.hitstop);
      return;
    }
  }

  // A blocked super can still finish someone on their last sliver of health (chip KO).
  const chipKo = c.kind === Kind.Super && def.health <= d.chipDamage;
  if (!chipKo && guarding(def, c.guard, dir)) {
    def.health = Math.max(1, def.health - d.chipDamage);
    if (def.state !== FS.Block) setState(def, FS.Block);
    def.low = def.prevInput & Input.Down ? 1 : 0;
    def.stunTimer = d.blockstun;
    def.vx = 0;
    def.push = dir * d.knockback.x;
    if (!c.projectile) cornerPush(att, def, dir, d.knockback.x);
    if (c.kind !== Kind.Super) att.meter = Math.min(METER_MAX, att.meter + (d.damage >> 2));
    def.meter = Math.min(METER_MAX, def.meter + (d.damage >> 3));
    s.hitstop = Math.max(s.hitstop, d.hitstop - 2);
    setFx(def, FX.Block, c.x, c.y, d.hitstop);
    return;
  }

  // Counter hit: caught starting an attack. Punish: caught recovering from one (a whiff read).
  let counter = false;
  let punish = false;
  if (def.state === FS.Attack) {
    const dm = getMove(def.hero, def.moveId);
    counter = def.stateTick < dm.startup + dm.active;
    punish = !counter;
  }
  const juggled = def.state === FS.Knockdown;
  const inCombo = def.state === FS.Hitstun || juggled;
  def.combo = inCombo ? def.combo + 1 : 1;
  if (def.combo === 1) def.comboDamage = 0;
  let dmg = (d.damage * COMBO_SCALE[Math.min(def.combo - 1, COMBO_SCALE.length - 1)]) >> 4;
  if (counter || punish) dmg = (dmg * 5) >> 2;
  dmg = Math.max(1, dmg);
  def.health -= dmg;
  def.comboDamage += dmg;
  if (s.training && def.health < 1) def.health = 1;

  const ko = def.health <= 0;
  const lastHit = c.projectile || att.moveHits >= c.hits;
  const launch = ko || def.y > 0 || c.kind === Kind.Throw || (d.knockdown && lastHit);
  if (launch) {
    if (ko) def.health = 0;
    setState(def, ko ? FS.KO : FS.Knockdown);
    def.juggles = juggled ? def.juggles + 1 : 0;
    def.stunTimer = 0;
    def.vx = 0;
    def.low = 0;
    def.push = dir * d.knockback.x;
    def.vy = Math.max(d.knockback.y, LAUNCH_MIN_VY);
  } else {
    setState(def, FS.Hitstun);
    def.stunTimer = d.hitstun + (counter ? 4 : punish ? 6 : 0);
    def.vx = 0;
    def.vy = 0;
    def.push = dir * d.knockback.x;
    if (!c.projectile) cornerPush(att, def, dir, d.knockback.x);
  }

  if (c.kind !== Kind.Super) att.meter = Math.min(METER_MAX, att.meter + d.damage);
  def.meter = Math.min(METER_MAX, def.meter + (dmg >> 1));
  s.hitstop = Math.max(s.hitstop, ko ? KO_FREEZE : d.hitstop);
  setFx(def, c.kind === Kind.Throw ? FX.Throw : counter ? FX.Counter : punish ? FX.Punish : FX.Hit, c.x, c.y, d.hitstop);
}

/** The defender is in the active frames of a counter stance and this is a strike it can answer. */
function countering(def: FighterState, c: Contact): boolean {
  if (def.state !== FS.Attack || c.projectile || c.kind === Kind.Throw) return false;
  const m = getMove(def.hero, def.moveId);
  return m.counter !== 0 && def.moveHits === 0 && isActiveTick(m, def.stateTick);
}

/** A counter stance caught a strike: the strike is deflected and the defender hits back. */
function counterStrike(s: GameState, def: FighterState, att: FighterState, c: Contact): void {
  const m = getMove(def.hero, def.moveId);
  def.facing = att.x >= def.x ? 1 : -1;
  setFx(def, FX.Parry, c.x, c.y, m.hitstop);
  def.stateTick = m.startup + m.active; // straight into the answering strike
  applyHit(s, def, att, { data: m, guard: Guard.Throw, kind: m.kind, hits: m.hits, projectile: false, x: c.x, y: c.y });
}

function resolveHits(s: GameState): void {
  const [a, b] = s.fighters;
  const ra = getProjectile(a);
  const rb = getProjectile(b);
  if (ra !== null && rb !== null && overlaps(ra, rb)) {
    a.projLife = 0;
    b.projLife = 0;
    setFx(a, FX.Clash, (Math.max(ra.x, rb.x) + Math.min(ra.x + ra.w, rb.x + rb.w)) >> 1, ra.y + (ra.h >> 1), 8);
  }

  // Detect everything before applying anything, so trades are symmetric.
  const hitByA = findHit(a, b);
  const hitByB = findHit(b, a);
  const projA = findProjectileHit(a, b);
  const projB = findProjectileHit(b, a);
  if (hitByA) {
    if (countering(b, hitByA)) counterStrike(s, b, a, hitByA);
    else applyHit(s, a, b, hitByA);
  }
  if (hitByB) {
    if (countering(a, hitByB)) counterStrike(s, a, b, hitByB);
    else applyHit(s, b, a, hitByB);
  }
  if (projA) {
    applyHit(s, a, b, projA);
    a.projLife = 0;
  }
  if (projB) {
    applyHit(s, b, a, projB);
    b.projLife = 0;
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
    const old = s.fighters[i];
    const f = createFighter(old.hero, i);
    f.prevInput = old.prevInput;
    f.meter = old.meter; // super meter carries over between rounds
    f.simple = old.simple;
    s.fighters[i] = f;
  }
}

/** Training: health comes back once a combo ends, and meter stays full. */
function refill(s: GameState): void {
  for (const f of s.fighters) {
    f.meter = METER_MAX;
    if (isActionable(f) && f.y === 0) f.health = HEROES[f.hero].stats.maxHealth;
  }
}

// ---------- the one entry point ----------

/** Advance the game by exactly one tick. Pure: never mutates `state`. */
export function step(state: GameState, p1Input: number, p2Input: number): GameState {
  const s = cloneState(state);
  s.tick += 1;
  const fighting = s.phase === Phase.Fight;
  // Outside the Fight phase fighters keep simulating (falling, recovering) with neutral input.
  const inputs = [fighting ? p1Input & INPUT_MASK : 0, fighting ? p2Input & INPUT_MASK : 0];

  for (let i = 0; i < 2; i += 1) {
    const f = s.fighters[i];
    f.fx = FX.None;
    f.hist[s.tick & HIST_MASK] = numpad(inputs[i], f.facing);
  }

  // Freeze frames: nothing moves, but the stick is still read (motions done during a freeze count)
  // and button presses wait, because prevInput is not updated.
  if (s.hitstop > 0) {
    // Attack presses during a freeze go into the buffer (which does not age while frozen), so the
    // next button of a combo can be pressed while the hit is still landing.
    for (let i = 0; i < 2; i += 1) {
      const f = s.fighters[i];
      const fresh = inputs[i] & ~f.prevInput & (Input.Light | Input.Heavy | Input.Special);
      if (fresh !== 0) {
        f.buf = fresh;
        f.bufAge = 0;
        f.bufTick = s.tick;
      }
      f.prevInput = inputs[i];
    }
    s.hitstop -= 1;
    if (s.hitstop === 0) s.freezeSlot = -1;
    return s;
  }

  const [a, b] = s.fighters;
  const [a0, b0] = state.fighters;
  updateFighter(s, a, 0, b0, inputs[0]);
  updateFighter(s, b, 1, a0, inputs[1]);
  a.prevInput = inputs[0];
  b.prevInput = inputs[1];
  updateProjectile(a);
  updateProjectile(b);

  resolvePush(a, b);
  enforceSeparation(a, b, a0.x, b0.x);

  if (fighting) {
    resolveHits(s);
    if (s.training) refill(s);
    else {
      s.timer -= 1;
      checkRoundEnd(s);
    }
  } else {
    advancePhase(s);
  }
  return s;
}
