// Presentation-only information about each hero: titles, quotes and select-screen ratings.
// Move names, damage and frame data live in the hero JSON (src/heroes/).

export type SuperStyle = 'storm' | 'crowd' | 'world' | 'crown' | 'quake' | 'squad' | 'rank' | 'dragon' | 'cosmos';

/** The signature particles every hit of this fighter throws off. */
export type HitStyle = 'volt' | 'vinyl' | 'cards' | 'crown' | 'quake' | 'tactical' | 'arcane' | 'ember' | 'stardust';

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
    style: 'Storm ninja · Lightning · Rushdown',
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
    style: 'Rocket boots · Sound waves · Showman',
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
    style: 'Card master · Gold gauntlet · Trickster',
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
    color: 0x2a4aa8,
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
    style: 'Crowned king · Golden aura · Brawler',
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
    style: 'Power armour · Piston fists · Tank',
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
    style: 'Energy shield · Drone · Commander',
    archetype: 'TACTICIAN',
    plan: 'Pin them with Suppressing Fire, make them jump, and call the squad in where they land.',
    tagline: 'Stay sharp.',
    quotes: ['Stay sharp.', 'Protect the team.', 'Get back up.', 'We move together.', 'Game on.', 'For the squad.'],
    color: 0xc0283c,
    accent: 0x3fe0d0,
    ratings: { power: 4, speed: 3, range: 4, defense: 3, technique: 4 },
  },
  quincy: {
    title: 'QUINCY "THE NEW BLOOD"',
    short: 'QUINCY',
    name: 'QUINCY',
    superStyle: 'rank',
    sfx: { special: 'whoosh_heavy', projectile: 'cards' },
    hitStyle: 'arcane',
    hitSfx: 'hit_crunch',
    style: 'Plasma claws · Cat spirit · Brawler',
    archetype: 'BRAWLER',
    plan: 'Toss emblems to make them jump, Ranked Dive across the screen, then swing big up close.',
    tagline: 'Good games. Good money. Better company.',
    quotes: ['Bet.', 'Ez.', "It's just a game.", 'My cat says no.', "You're cooked.", 'One more.', 'Just one more game.'],
    color: 0x8a3dff,
    accent: 0xd08cff,
    ratings: { power: 4, speed: 3, range: 3, defense: 2, technique: 3 },
  },
  ignar: {
    title: 'IGNAR "THE DRAGON KNIGHT"',
    short: 'IGNAR',
    name: 'IGNAR',
    superStyle: 'dragon',
    sfx: { special: 'slam', projectile: 'whoosh_heavy' },
    hitStyle: 'ember',
    hitSfx: 'hit_crunch',
    style: 'Dragon-blooded · Brawler · Fire',
    archetype: 'RUSHDOWN',
    plan: 'Charge through their pokes with the Dragon Rush, burn them up close, and never let them rest.',
    tagline: 'The last dragon does not kneel.',
    quotes: ['Burn bright.', 'Kneel to the flame.', 'Ash and embers.', 'You fought well. For a mortal.', 'The fire remembers.', 'Again!'],
    color: 0xe0402a,
    accent: 0xffa23d,
    ratings: { power: 5, speed: 4, range: 3, defense: 3, technique: 2 },
  },
  vesper: {
    title: 'VESPER "THE STAR WITCH"',
    short: 'VESPER',
    name: 'VESPER',
    superStyle: 'cosmos',
    sfx: { special: 'blink', projectile: 'zap' },
    hitStyle: 'stardust',
    hitSfx: 'hit_light',
    style: 'Witch · Zoner · Starlight',
    archetype: 'ZONER',
    plan: 'Keep them out with Star Orbs and the long Staff Arc, and drop a Gravity Well where they want to be.',
    tagline: 'The stars already know how this ends.',
    quotes: ['Written in the stars.', 'Mind the gravity.', 'Such a small orbit.', 'The night is mine.', 'Wish upon a falling star.', 'Fate is a polite word.'],
    color: 0x6a4cff,
    accent: 0xc9a8ff,
    ratings: { power: 3, speed: 3, range: 5, defense: 2, technique: 4 },
  },
};

export function heroInfo(id: string): HeroInfo {
  return HERO_INFO[id];
}
