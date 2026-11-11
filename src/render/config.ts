/** Rename the game here. */
export const GAME_TITLE = 'AFTER HOURS';
export const GAME_SUBTITLE = 'ONE ON ONE  ·  NIGHT CITY';

export const VIEW_W = 960;
export const VIEW_H = 540;
/** Screen y of the floor line when the camera is at rest. */
export const GROUND_Y = 480;

export const FONT_DISPLAY = '"Bungee", "Impact", "Arial Black", sans-serif';
export const FONT_BODY = '"Chakra Petch", "Trebuchet MS", "Segoe UI", sans-serif';

/** Colours as numbers (graphics) and strings (text). */
export const C = {
  night: 0x070912,
  panel: 0x10142a,
  panelEdge: 0x2b3263,
  ink: 0xf3f1ff,
  muted: 0x9aa2c8,
  p1: 0x3d8bff,
  p2: 0xff6a3d,
  gold: 0xffc23d,
  health: 0xffd23f,
  healthLow: 0xff5a3d,
  damage: 0xd8263a,
  meter: 0x37b7ff,
  meterFull: 0x7ef0ff,
  violet: 0x8a5cff,
} as const;

export const CSS = {
  ink: '#f3f1ff',
  muted: '#9aa2c8',
  p1: '#3d8bff',
  p2: '#ff6a3d',
  gold: '#ffc23d',
  night: '#070912',
} as const;

export type Mode = 'cpu' | 'versus' | 'training';

/** Everything a match needs, passed from the menus to the fight. */
export interface MatchSetup {
  mode: Mode;
  p1: number;
  p2: number;
  stage: number;
  /** 0 easy, 1 normal, 2 hard. */
  cpuLevel: number;
  /** Set when this match is part of an arcade run. */
  arcade?: ArcadeRun;
  /** Set in party mode: who is playing, and the winner-stays-on queue. */
  party?: PartyState;
  /** Per-player simple specials (one direction + special), chosen at character select. */
  simple?: [boolean, boolean];
}

/** Party mode: winner stays on, the loser hands the controller to the next name in the queue. */
export interface PartyState {
  names: string[];
  /** Which name is on each side right now. */
  sides: [number, number];
  /** Names waiting their turn, next first. */
  queue: number[];
  wins: number[];
  /** Longest winning streak per name, and the current champion's streak. */
  best: number[];
  streak: number;
  matches: number;
  /** Who won the last match, for streaks. */
  lastWinner?: number;
}

/** An arcade run: the opponents in order, which fight is next, continues used, and the difficulty. */
export interface ArcadeRun {
  order: number[];
  fight: number;
  continues: number;
  base: number;
}

export const CPU_LEVELS = ['EASY', 'NORMAL', 'HARD'];
