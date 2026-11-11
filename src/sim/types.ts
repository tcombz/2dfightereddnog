export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MoveFrame {
  hitboxes: Rect[];
  hurtboxes: Rect[];
}

/** How a hit has to be blocked. */
export const Guard = {
  /** Blocked standing or crouching. */
  Mid: 0,
  /** Must be blocked crouching. */
  Low: 1,
  /** Overhead: must be blocked standing. */
  High: 2,
  /** Throws cannot be blocked. */
  Throw: 3,
} as const;

/** What a move is, for cancel rules and meter. */
export const Kind = { Normal: 0, Special: 1, Super: 2, Throw: 3 } as const;

/** Bits for MoveData.cancel: which kinds of move it can cancel into once it has connected. */
export const Cancel = { Normal: 1, Special: 2, Super: 4 } as const;

export interface HitData {
  damage: number;
  chipDamage: number;
  hitstun: number;
  blockstun: number;
  knockback: { x: number; y: number };
  knockdown: boolean;
  /** Whole-game freeze when it connects, in ticks. */
  hitstop: number;
}

export interface ProjectileData extends HitData {
  /** Move tick on which the projectile appears. */
  spawnTick: number;
  /** Fighter-local spawn rect (x = forward offset of the near edge, y = bottom edge). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Pixels per tick. */
  speed: number;
  /** Ticks before it fades. */
  life: number;
}

export interface MoveData extends HitData {
  name: string;
  kind: number;
  guard: number;
  startup: number;
  active: number;
  recovery: number;
  /** Pixels per tick the attacker slides forward during the active frames. */
  advance: number;
  /** Most hits the move can land; hits after the first come `rehit` ticks apart. */
  hits: number;
  rehit: number;
  /** Cancel bits: what this move may cancel into after it hits or is blocked. */
  cancel: number;
  /** Ticks from the start of the move with no hurtboxes. */
  invuln: number;
  /** Done in the air: keeps falling and ends on landing. */
  air: boolean;
  /** Super meter spent to perform it. */
  meterCost: number;
  projectile: ProjectileData | null;
  frames: MoveFrame[];
}

/** Every hero has exactly these moves. FighterState.moveId indexes this list. */
export const MOVE_KEYS = [
  'light',
  'heavy',
  'kick',
  'crouchLight',
  'sweep',
  'jumpAttack',
  'throw',
  'special',
  'projectile',
  'rising',
  'super',
] as const;
export type MoveKey = (typeof MOVE_KEYS)[number];

export const Move = {
  Light: 0,
  Heavy: 1,
  Kick: 2,
  CrouchLight: 3,
  Sweep: 4,
  JumpAttack: 5,
  Throw: 6,
  Special: 7,
  Projectile: 8,
  Rising: 9,
  Super: 10,
} as const;

export interface HeroStats {
  maxHealth: number;
  walkSpeed: number;
  backWalkSpeed: number;
  jumpVelocity: number;
  jumpSpeedX: number;
  gravity: number;
  width: number;
  height: number;
  crouchHeight: number;
  dashSpeed: number;
  dashTicks: number;
  backdashSpeed: number;
  backdashTicks: number;
}

export interface HeroData {
  id: string;
  name: string;
  color: string;
  stats: HeroStats;
  hurtboxes: { stand: Rect[]; crouch: Rect[]; air: Rect[] };
  moves: Record<MoveKey, MoveData>;
}

export const FS = {
  Idle: 0,
  Walk: 1,
  Jump: 2,
  Crouch: 3,
  Attack: 4,
  Block: 5,
  Hitstun: 6,
  Knockdown: 7,
  KO: 8,
  Dash: 9,
} as const;

export const FS_NAMES = ['idle', 'walk', 'jump', 'crouch', 'attack', 'block', 'hitstun', 'knockdown', 'ko', 'dash'];

/** What happened to a fighter this tick, for the renderer's sparks and sounds. */
export const FX = { None: 0, Hit: 1, Block: 2, Counter: 3, Throw: 4, Clash: 5 } as const;

export const Phase = { Intro: 0, Fight: 1, RoundEnd: 2, MatchEnd: 3 } as const;

/** Round and match results: -1 undecided, 0 = P1, 1 = P2, 2 = draw. */
export const Result = { None: -1, P1: 0, P2: 1, Draw: 2 } as const;

export interface FighterState {
  hero: number;
  x: number;
  y: number;
  /** Own movement, pixels per tick. */
  vx: number;
  vy: number;
  /** Knockback and pushback, pixels per tick; decays toward 0. */
  push: number;
  facing: number;
  health: number;
  meter: number;
  state: number;
  stateTick: number;
  moveId: number;
  /** Hits the current move has landed (or had blocked). */
  moveHits: number;
  /** stateTick of the current move's last hit. */
  hitTick: number;
  /** Hitstun, blockstun or dash ticks left. */
  stunTimer: number;
  /** 1 while crouching: crouch block, crouching hitstun, crouching attacks. */
  low: number;
  /** Hits taken in the current combo, and their total damage. */
  combo: number;
  comboDamage: number;
  prevInput: number;
  /** Numpad direction (relative to facing) for the last HIST_LEN ticks, indexed by tick. */
  hist: number[];
  /** This fighter's projectile; projLife 0 means none on screen. */
  projX: number;
  projY: number;
  projVx: number;
  projLife: number;
  projMove: number;
  /** This tick's event on this fighter (FX) and where it happened. */
  fx: number;
  fxX: number;
  fxY: number;
  fxPower: number;
}

export interface GameState {
  tick: number;
  phase: number;
  phaseTimer: number;
  round: number;
  timer: number;
  wins: [number, number];
  roundResult: number;
  matchResult: number;
  /** Whole-game freeze ticks left (hit impact, super flash, KO). */
  hitstop: number;
  /** Slot doing a super flash during this freeze, or -1. */
  freezeSlot: number;
  /** 1 in training mode: no timer, health refills after each combo, full meter. */
  training: number;
  fighters: [FighterState, FighterState];
}
