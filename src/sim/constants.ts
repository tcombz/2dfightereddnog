export const TICK_RATE = 60;

/** The stage is wider than one screen; the camera follows the fighters. */
export const STAGE_WIDTH = 1536;
/** Fighters can never be farther apart than this, so both always fit on screen. */
export const MAX_SEPARATION = 820;
export const START_X: readonly [number, number] = [568, 968];

export const ROUND_SECONDS = 99;
export const ROUND_TICKS = ROUND_SECONDS * TICK_RATE;
export const ROUNDS_TO_WIN = 2;
export const INTRO_TICKS = 120;
export const ROUND_END_TICKS = 240;

/** Ticks spent on the floor after a knockdown before standing up (invulnerable throughout). */
export const KNOCKDOWN_TICKS = 50;
export const LAUNCH_MIN_VY = 8;

export const METER_MAX = 1000;

/** Whole-game freezes, in ticks. */
export const SUPER_FREEZE = 45;
export const KO_FREEZE = 60;

/** Input history per fighter, for motion inputs and dashes. Must be a power of two. */
export const HIST_LEN = 64;
export const HIST_MASK = HIST_LEN - 1;
/** A motion (down, forward...) must be finished within this many ticks. */
export const MOTION_WINDOW = 15;
/** Two taps of a direction within this many ticks make a dash. */
export const DASH_WINDOW = 10;
/** A move the button press is late for by up to this many ticks still counts (2-button presses). */
export const PRESS_LENIENCY = 4;
/** A button pressed up to this many ticks before the fighter can act still comes out. */
export const BUFFER_TICKS = 6;
/** Most extra hits a launched opponent can take before landing. */
export const JUGGLE_LIMIT = 2;

/** Damage scaling in sixteenths, by hit number within a combo (last entry repeats). */
export const COMBO_SCALE: readonly number[] = [16, 15, 13, 11, 10, 9, 8];

/** A blocked hit or a projectile is "threatening" inside this distance, so holding back guards. */
export const GUARD_RANGE = 120;
export const PROJECTILE_GUARD_RANGE = 420;
