// What the TV and the phones say to each other. Shared by both sides; no game code here.

/** Bumped when the messages change shape, so an old phone page can ask to be reloaded. */
export const PAD_VERSION = 2;

export type PhoneScreen = 'lobby' | 'remote' | 'select' | 'stage' | 'fight' | 'wait';

/** What a phone shows. The TV sends it whenever it changes. */
export interface PhoneView {
  screen: PhoneScreen;
  /** The headline: what to do now. */
  say: string;
  /** A smaller line under it. */
  sub?: string;
  /** Which player this phone is (0 or 1), or -1 while it waits its turn. */
  seat: number;
  /** Character select: the side this phone picks for, its cursor, its first (point) pick. */
  side?: number;
  cursor?: number;
  first?: number;
  locked?: boolean;
  simple?: boolean;
  team?: boolean;
  /** Stage select: the stage shown. */
  stage?: number;
  /** Lobby: everyone in, and the ways to start (a button each). */
  players?: Array<{ name: string; color: string; on: boolean; me: boolean }>;
  starts?: Array<{ id: string; label: string }>;
  /** Fight: each side's team (point first), for the header. */
  teams?: [number[], number[]];
}

/** The TV's greeting: the roster and stages in the TV's order, and this phone's name and colour. */
export interface PadHello {
  t: 'hello';
  v: number;
  roster: string[];
  stages: Array<{ id: string; name: string }>;
  name: string;
  color: string;
}
