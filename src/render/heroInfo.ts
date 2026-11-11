// Presentation-only information about each hero: titles, quotes and select-screen ratings.
// Move names, damage and frame data live in the hero JSON (src/heroes/).

export type SuperStyle = 'storm' | 'crowd' | 'world' | 'crown';

export interface HeroInfo {
  title: string;
  /** Shorter name for the fight HUD. */
  short: string;
  /** How the super looks: the effects are themed on each character sheet's super art. */
  superStyle: SuperStyle;
  /** Sound effects for starting the special and throwing the projectile. */
  sfx: { special: string; projectile: string };
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
    short: 'THE ROGUE',
    superStyle: 'storm',
    sfx: { special: 'zap', projectile: 'zap' },
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
    short: 'THE JETSETTER',
    superStyle: 'crowd',
    sfx: { special: 'scratch', projectile: 'scratch' },
    style: 'Luxury · Music · Free spirit',
    tagline: "Life's a playlist.",
    quotes: ['Another banger.', 'Keep up.', 'Good taste.', "That's a bet.", 'One more song?', 'Time to show out.'],
    color: 0xe0b030,
    accent: 0xb06cff,
    ratings: { power: 4, speed: 3, range: 3, defense: 4, technique: 3 },
  },
  chris: {
    title: 'CHRIS "THE DIPLOMAT"',
    short: 'THE DIPLOMAT',
    superStyle: 'world',
    sfx: { special: 'whoosh_light', projectile: 'whoosh_light' },
    style: 'Tactical · Witty · Unpredictable',
    tagline: "Politics, poker... what's the difference?",
    quotes: [
      'Another election? How quaint.',
      'Checkmate.',
      'Short kings rise up.',
      "This is why we can't have nice things.",
      'Pass the cigar.',
      'Global dominance.',
    ],
    color: 0xb8323f,
    accent: 0xffc94a,
    ratings: { power: 3, speed: 4, range: 3, defense: 3, technique: 5 },
  },
  leader: {
    title: 'THE LEADER',
    short: 'THE LEADER',
    superStyle: 'crown',
    sfx: { special: 'crowd', projectile: 'whoosh_heavy' },
    style: 'Brawler · Leader · Strategist',
    tagline: "Let's do this.",
    quotes: ["Let's get it.", 'Stay together.', 'You got this.', "That's the play.", 'Family first.', 'We run this.'],
    color: 0xd4a017,
    accent: 0xff6a2a,
    ratings: { power: 5, speed: 3, range: 3, defense: 4, technique: 3 },
  },
};

export function heroInfo(id: string): HeroInfo {
  return HERO_INFO[id];
}
