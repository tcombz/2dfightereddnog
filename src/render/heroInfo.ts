// Presentation-only information about each hero: titles, quotes and select-screen ratings.
// Move names, damage and frame data live in the hero JSON (src/heroes/).

export interface HeroInfo {
  title: string;
  style: string;
  tagline: string;
  /** Lines shown on the results screen when this hero wins. */
  quotes: string[];
  /** Main and accent colours for menus, sparks and the super flash. */
  color: number;
  accent: number;
  /** Select screen ratings out of 5. */
  ratings: { power: number; speed: number; range: number; defense: number; technique: number };
}

export const HERO_INFO: Record<string, HeroInfo> = {
  rogue: {
    title: 'THE ROGUE',
    style: 'Agile · Electric · Hit and run',
    tagline: 'In and out before the thunder.',
    quotes: [
      'Blink and you missed it.',
      'You fight like it is raining. Slow.',
      'Lights out.',
      'Too slow by a mile.',
      'Next time, bring an umbrella.',
    ],
    color: 0x2f7bff,
    accent: 0x7ee0ff,
    ratings: { power: 3, speed: 5, range: 4, defense: 3, technique: 4 },
  },
  jetsetter: {
    title: 'THE JETSETTER',
    style: 'Luxury · Music · Free spirit',
    tagline: "Life's a playlist.",
    quotes: ['Another banger.', 'Keep up.', 'Good taste.', "That's a bet.", 'One more song?', 'Time to show out.'],
    color: 0xe0b030,
    accent: 0xb06cff,
    ratings: { power: 4, speed: 3, range: 3, defense: 4, technique: 3 },
  },
};

export function heroInfo(id: string): HeroInfo {
  return HERO_INFO[id];
}
