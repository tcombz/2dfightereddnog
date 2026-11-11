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

export interface MoveData {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  chipDamage: number;
  hitstun: number;
  blockstun: number;
  knockback: { x: number; y: number };
  knockdown: boolean;
  /** Pixels per tick the attacker slides forward during the active frames (0 = stays put). */
  advance: number;
  frames: MoveFrame[];
}

export interface HeroData {
  id: string;
  name: string;
  color: string;
  stats: {
    maxHealth: number;
    walkSpeed: number;
    backWalkSpeed: number;
    jumpVelocity: number;
    jumpSpeedX: number;
    gravity: number;
    width: number;
    height: number;
    crouchHeight: number;
  };
  hurtboxes: { stand: Rect[]; crouch: Rect[]; air: Rect[] };
  moves: { light: MoveData; heavy: MoveData; special: MoveData; kick: MoveData };
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
} as const;

export const FS_NAMES = ['idle', 'walk', 'jump', 'crouch', 'attack', 'block', 'hitstun', 'knockdown', 'ko'];

export const Phase = { Intro: 0, Fight: 1, RoundEnd: 2, MatchEnd: 3 } as const;

/** Round and match results: -1 undecided, 0 = P1, 1 = P2, 2 = draw. */
export const Result = { None: -1, P1: 0, P2: 1, Draw: 2 } as const;

export interface FighterState {
  hero: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  health: number;
  state: number;
  stateTick: number;
  moveId: number;
  moveHit: number;
  stunTimer: number;
  prevInput: number;
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
  fighters: [FighterState, FighterState];
}
