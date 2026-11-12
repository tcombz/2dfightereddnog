// Presentation-only information about each hero: titles, quotes and select-screen ratings.
// Move names, damage and frame data live in the hero JSON (src/heroes/).

export type SuperStyle = 'storm' | 'crowd' | 'world' | 'crown' | 'quake' | 'squad';

/** The signature particles every hit of this fighter throws off. */
export type HitStyle = 'volt' | 'vinyl' | 'cards' | 'crown' | 'quake' | 'tactical';

export interface HeroInfo {
  title: string;
  /** Shorter name for the fight HUD. */
  short: string;
  /** First name, for the announcer and the big banners. */
  name: string;
  /** How the super looks: the effects are themed on each character sheet's super art. */
  superStyle: SuperStyle;
  /** Sound effects for starting the special and throwing the projectile. */
  sfx: { special: string; projectile: string };
  /** What every hit throws off, and the sound layered on heavy hits. */
  hitStyle: HitStyle;
  hitSfx: string;
  style: string;
  /** The fighter's archetype and their plan in one line, so a newcomer knows what they want to do. */
  archetype: string;
  plan: string;
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
    title: 'BRENT "THE ROGUE"',
    short: 'BRENT',
    name: 'BRENT',
    superStyle: 'storm',
    sfx: { special: 'zap', projectile: 'zap' },
    hitStyle: 'volt',
    hitSfx: 'zap',
    style: 'Agile · Strategic · Unpredictable',
    archetype: 'RUSHDOWN',
    plan: 'Blink in with the Rift, hit, blink out. Never let them breathe.',
    tagline: 'Play smart. Strike fast.',
    quotes: [
      "Let's not waste each other's time.",
      "You saw that coming. Didn't you?",
      "That's not how this works.",
      "Now we're getting somewhere.",
      'Time to balance the books.',
      "I'm just being honest. You weren't winning that.",
      'Tell it like it is.',
    ],
    color: 0x2f7bff,
    accent: 0x7ee0ff,
    ratings: { power: 4, speed: 5, range: 3, defense: 3, technique: 4 },
  },
  jetsetter: {
    title: 'LUIS "THE JETSETTER"',
    short: 'LUIS',
    name: 'LUIS',
    superStyle: 'crowd',
    sfx: { special: 'scratch', projectile: 'scratch' },
    hitStyle: 'vinyl',
    hitSfx: 'scratch',
    style: 'Luxury · Music · Free spirit',
    archetype: 'ALL-ROUNDER',
    plan: 'Fast dash, long jumps, a travelling spinning kick and records to keep space.',
    tagline: "Life's a playlist.",
    quotes: ['Another banger.', 'Keep up.', 'Good taste.', "That's a bet.", 'One more song?', 'Time to show out.'],
    color: 0xe0b030,
    accent: 0xb06cff,
    ratings: { power: 4, speed: 3, range: 3, defense: 4, technique: 3 },
  },
  chris: {
    title: 'CHRIS "THE DIPLOMAT"',
    short: 'CHRIS',
    name: 'CHRIS',
    superStyle: 'world',
    sfx: { special: 'cards', projectile: 'cards' },
    hitStyle: 'cards',
    hitSfx: 'cards',
    style: 'Tactical · Witty · Unpredictable',
    archetype: 'TRICKSTER',
    plan: 'Bait an attack into the Diplomacy, then make them pay. Cards keep them guessing.',
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
    title: 'TYLER "THE LEADER"',
    short: 'TYLER',
    name: 'TYLER',
    superStyle: 'crown',
    sfx: { special: 'crowd', projectile: 'whoosh_heavy' },
    hitStyle: 'crown',
    hitSfx: 'crowd',
    style: 'Brawler · Leader · Strategist',
    archetype: 'ZONER',
    plan: 'Own the screen with the crew and the Golden Rule, then crown the rush.',
    tagline: "Let's do this.",
    quotes: ["Let's get it.", 'Stay together.', 'You got this.', "That's the play.", 'Family first.', 'We run this.'],
    color: 0xd4a017,
    accent: 0xff6a2a,
    ratings: { power: 5, speed: 3, range: 3, defense: 4, technique: 3 },
  },
  eddnog: {
    title: 'EDDNOG "THE TANK"',
    short: 'EDDNOG',
    name: 'EDDNOG',
    superStyle: 'quake',
    sfx: { special: 'slam', projectile: 'slam' },
    hitStyle: 'quake',
    hitSfx: 'slam',
    style: 'Brawler · Tank · Support',
    archetype: 'GRAPPLER',
    plan: 'Armor through their pokes, get close, and Bear Hug them off the screen.',
    tagline: 'Bigger than the fight.',
    quotes: ['Team first!', 'Smash time!', 'We got this!', 'Good times!', "Let's go!", 'Together... we win.'],
    color: 0xe0a526,
    accent: 0xffd34a,
    ratings: { power: 5, speed: 2, range: 4, defense: 5, technique: 3 },
  },
  malcolm: {
    title: 'MALCOLM "THE CAPTAIN"',
    short: 'MALCOLM',
    name: 'MALCOLM',
    superStyle: 'squad',
    sfx: { special: 'squad', projectile: 'tracer' },
    hitStyle: 'tactical',
    hitSfx: 'tracer',
    style: 'Tactical · Support · Leader',
    archetype: 'TACTICIAN',
    plan: 'Pin them with Suppressing Fire, make them jump, and call the squad in where they land.',
    tagline: 'Stay sharp.',
    quotes: ['Stay sharp.', 'Protect the team.', 'Get back up.', 'We move together.', 'Game on.', 'For the squad.'],
    color: 0x2f7bff,
    accent: 0x7fc8ff,
    ratings: { power: 4, speed: 3, range: 4, defense: 3, technique: 4 },
  },
};

export function heroInfo(id: string): HeroInfo {
  return HERO_INFO[id];
}
