import brawler from '../heroes/brawler.json';
import striker from '../heroes/striker.json';
import type { HeroData, MoveData } from './types';

/** Immutable hero registry. FighterState.hero indexes into this. */
export const HEROES: readonly HeroData[] = [
  brawler as unknown as HeroData,
  striker as unknown as HeroData,
];

/** FighterState.moveId indexes into this. */
export const MOVE_KEYS = ['light', 'heavy', 'special'] as const;

export function getMove(hero: number, moveId: number): MoveData {
  return HEROES[hero].moves[MOVE_KEYS[moveId]];
}
