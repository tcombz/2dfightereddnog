import jetsetter from '../heroes/jetsetter.json';
import rogue from '../heroes/rogue.json';
import { MOVE_KEYS } from './types';
import type { HeroData, MoveData } from './types';

export { MOVE_KEYS } from './types';

/** Immutable hero registry. FighterState.hero indexes into this. */
export const HEROES: readonly HeroData[] = [rogue as unknown as HeroData, jetsetter as unknown as HeroData];

export function getMove(hero: number, moveId: number): MoveData {
  return HEROES[hero].moves[MOVE_KEYS[moveId]];
}

export function heroIndex(id: string): number {
  return HEROES.findIndex((h) => h.id === id);
}
