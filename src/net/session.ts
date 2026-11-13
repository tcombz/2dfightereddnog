// The online session that outlives scenes: the link, who hosts, and this side's lobby picks.
import type { Link, Presence } from './link';
import type { NetFrame } from './rollback';

export interface StartMsg {
  /** Match number, so a stale fight message is never mistaken for the new one. */
  m: number;
  p1: number;
  p2: number;
  stage: number;
  s1: boolean;
  s2: boolean;
}

/** One side's presence: lobby picks, the start order (host), and in a fight the latest inputs. */
export interface Lobby extends Presence {
  hero: number;
  simple: boolean;
  ready: boolean;
  stage: number;
  start: StartMsg | null;
  g: (NetFrame & { m: number }) | null;
  /** Set to a match number when this side quit that match on purpose. */
  bye?: number;
  /** The last match result each side saw, for the lobby banner. */
  wins: [number, number];
}

export interface Online {
  link: Link;
  code: string;
  host: boolean;
  /** Player slot this side plays: the host is player 1. */
  me: 0 | 1;
  mine: Lobby;
  /** Matches played this session. */
  played: number;
  /** Set after a match, for the lobby banner. */
  last?: { winner: number; wins: [number, number] };
}

let current: Online | null = null;

export function online(): Online | null {
  return current;
}

export function setOnline(o: Online | null): void {
  if (current && current !== o) current.link.close();
  current = o;
}

/** Send this side's presence now (merged with `patch`). */
export function sendMine(patch: Partial<Lobby> = {}): void {
  if (!current) return;
  Object.assign(current.mine, patch);
  current.link.set({ ...current.mine });
}

export function theirs(): Partial<Lobby> | null {
  return (current?.link.other() as Partial<Lobby> | null) ?? null;
}
