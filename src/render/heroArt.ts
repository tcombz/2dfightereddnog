// Render-only: maps sim fighter state to a sprite frame. The sim knows nothing about this.
import chrisArt from '../../assets/heroes/chris/art.json';
import chrisAtlas from '../../assets/heroes/chris/atlas.json';
import chrisPng from '../../assets/heroes/chris/atlas.png';
import chrisBase from '../../assets/heroes/chris/base/east.png';
import chrisSheet from '../../assets/heroes/chris/sheet_portrait.jpg';
import chrisSuper from '../../assets/heroes/chris/super_art.jpg';
import jetsetterArt from '../../assets/heroes/jetsetter/art.json';
import jetsetterAtlas from '../../assets/heroes/jetsetter/atlas.json';
import jetsetterSheet from '../../assets/heroes/jetsetter/sheet_portrait.jpg';
import jetsetterSuper from '../../assets/heroes/jetsetter/super_art.jpg';
import leaderArt from '../../assets/heroes/leader/art.json';
import leaderAtlas from '../../assets/heroes/leader/atlas.json';
import leaderPng from '../../assets/heroes/leader/atlas.png';
import leaderBase from '../../assets/heroes/leader/base/east.png';
import leaderSheet from '../../assets/heroes/leader/sheet_portrait.jpg';
import leaderSuper from '../../assets/heroes/leader/super_art.jpg';
import jetsetterPng from '../../assets/heroes/jetsetter/atlas.png';
import jetsetterBase from '../../assets/heroes/jetsetter/base/east.png';
import rogueAtlas from '../../assets/heroes/rogue/atlas.json';
import roguePng from '../../assets/heroes/rogue/atlas.png';
import rogueArt from '../../assets/heroes/rogue/art.json';
import rogueBase from '../../assets/heroes/rogue/base/east.png';
import { FS, HEROES, KNOCKDOWN_TICKS, MOVE_KEYS, getMove } from '../sim';
import type { FighterState, MoveKey } from '../sim';

/** Sprite frame indices (into an atlas animation) shown during each part of a move. */
interface AttackArt {
  anim: string;
  startup: number[];
  active: number[];
  recovery: number[];
  /** Cycle the active frames (long multi-hit moves) instead of spreading them once. */
  loopActive?: boolean;
}

/** How a projectile is drawn. */
export type ProjStyle = 'bolt' | 'disc' | 'cards' | 'wave' | 'crew';

export interface HeroArt {
  key: string;
  png: string;
  atlas: object;
  /** Standing base sprite, for portraits and menus. */
  base: string;
  /** Illustrated portrait and super art cut from the character sheet, when there is one. */
  sheet?: string;
  superArt?: string;
  /** Which projectile look each projectile-throwing move uses. */
  projectiles: Partial<Record<MoveKey, ProjStyle>>;
  /** Sprites are drawn at this multiple of their pixel size. */
  scale: number;
  /** Where the fighter's feet centre sits inside the atlas cell, in cell pixels. */
  feetX: number;
  feetY: number;
  cellW: number;
  cellH: number;
  /** Head box in the base sprite (128 px canvas), for portraits. */
  face: { x: number; y: number; w: number; h: number };
  idle: number[];
  walk: number[];
  jump: number[];
  crouch: number[];
  block: number[];
  hit: number[];
  fall: number[];
  lying: number[];
  getup: number[];
  win: number[];
  /** Frames played during the super freeze, before the super's own startup (empty: none). */
  powerUp: number[];
  attacks: Record<MoveKey, AttackArt>;
}

/** The generated art.json written by scripts/import-hero.py: scale, cell, feet, face and frame picks. */
interface ArtJson {
  scale: number;
  cellW: number;
  cellH: number;
  feetX: number;
  feetY: number;
  face: { x: number; y: number; w: number; h: number };
  idle: number[];
  walk: number[];
  jump: number[];
  crouch: number[];
  block: number[];
  hit: number[];
  fall: number[];
  lying: number[];
  getup: number[];
  win: number[];
  powerUp: number[];
  attacks: Record<string, AttackArt>;
}

type ArtFields = Omit<HeroArt, 'key' | 'png' | 'atlas' | 'base' | 'sheet' | 'superArt' | 'projectiles'>;

function fromJson(j: ArtJson): ArtFields {
  const { scale, cellW, cellH, feetX, feetY, face, idle, walk, jump, crouch, block, hit, fall, lying, getup, win, powerUp } = j;
  return {
    scale, cellW, cellH, feetX, feetY, face, idle, walk, jump, crouch, block, hit, fall, lying, getup, win, powerUp,
    attacks: j.attacks as Record<MoveKey, AttackArt>,
  };
}

const ART: Record<string, HeroArt> = {
  rogue: {
    key: 'rogue',
    png: roguePng,
    atlas: rogueAtlas,
    base: rogueBase,
    projectiles: { projectile: 'bolt' },
    ...fromJson(rogueArt),
  },
  jetsetter: {
    key: 'jetsetter',
    png: jetsetterPng,
    atlas: jetsetterAtlas,
    base: jetsetterBase,
    sheet: jetsetterSheet,
    superArt: jetsetterSuper,
    projectiles: { projectile: 'disc' },
    ...fromJson(jetsetterArt),
  },
  chris: {
    key: 'chris',
    png: chrisPng,
    atlas: chrisAtlas,
    base: chrisBase,
    sheet: chrisSheet,
    superArt: chrisSuper,
    projectiles: { projectile: 'cards' },
    ...fromJson(chrisArt),
  },
  leader: {
    key: 'leader',
    png: leaderPng,
    atlas: leaderAtlas,
    base: leaderBase,
    sheet: leaderSheet,
    superArt: leaderSuper,
    projectiles: { special: 'crew', projectile: 'wave' },
    ...fromJson(leaderArt),
  },
};

export const ALL_ART: HeroArt[] = Object.values(ART);

export function artFor(hero: number): HeroArt {
  return ART[HEROES[hero].id];
}

export const frameName = (anim: string, i: number): string => `${anim}/${String(i).padStart(2, '0')}`;

/** Sprite origin that puts the feet on the sprite's position, mirrored for a flipped sprite. */
export function feetOrigin(art: HeroArt, flipped = false): [number, number] {
  return [(flipped ? art.cellW - art.feetX : art.feetX) / art.cellW, art.feetY / art.cellH];
}

/** Menu sprite scale: `k` was tuned for the original 2x art, so higher-resolution art draws smaller. */
export function menuScale(art: HeroArt, k: number): number {
  return (k * art.scale) / 2;
}

/** Frame `t` of `total` spread evenly over `frames`. */
function spread(frames: number[], t: number, total: number): number {
  const i = Math.floor((t * frames.length) / Math.max(1, total));
  return frames[Math.min(frames.length - 1, Math.max(0, i))];
}

const loop = (frames: number[], t: number, ticksPerFrame: number): number =>
  frames[Math.floor(t / ticksPerFrame) % frames.length];

const hold = (frames: number[], t: number, ticksPerFrame: number): number =>
  frames[Math.min(frames.length - 1, Math.floor(t / ticksPerFrame))];

/** Ticks the getting-up animation takes at the end of a knockdown. */
const GETUP_TICKS = 20;

export interface Pose {
  frame: string;
  /** Extra screen-space tilt for a few poses, in radians. */
  angle: number;
}

/**
 * The atlas frame to show for a fighter. `clock` drives looping idle animations; `celebrating`
 * switches an idle winner to the win pose, `celebrateTicks` being how long it has been posing.
 */
export function poseFor(art: HeroArt, f: FighterState, clock: number, celebrating: boolean, celebrateTicks: number): Pose {
  const st = HEROES[f.hero].stats;
  const pose = (anim: string, i: number, angle = 0): Pose => ({ frame: frameName(anim, i), angle });

  switch (f.state) {
    case FS.Walk: {
      const back = f.vx * f.facing < 0;
      const t = back ? 1000 - f.stateTick : f.stateTick;
      return pose('walk', loop(art.walk, t, 6));
    }
    case FS.Dash:
      return f.vx * f.facing > 0 ? pose('walk', loop(art.walk, f.stateTick, 3)) : pose('jump', 2);
    case FS.Jump: {
      const airtime = Math.floor((2 * st.jumpVelocity) / st.gravity);
      return pose('jump', spread(art.jump, f.stateTick, airtime));
    }
    case FS.Crouch:
      return pose('crouch', hold(art.crouch, f.stateTick, 2));
    case FS.Block:
      return f.low ? pose('crouch', art.crouch[art.crouch.length - 1]) : pose('block', hold(art.block, f.stateTick, 2));
    case FS.Hitstun:
      if (f.low) return pose('crouch', art.crouch[art.crouch.length - 2]);
      return pose('hit', spread(art.hit, f.stateTick, f.stateTick + f.stunTimer));
    case FS.Knockdown:
    case FS.KO: {
      if (f.y > 0 || f.vy > 0) {
        const i = f.vy > 6 ? 0 : f.vy > -6 ? 1 : 2;
        return pose('knockout', art.fall[i]);
      }
      if (f.state === FS.Knockdown && f.stunTimer <= GETUP_TICKS) {
        return pose('getup', spread(art.getup, GETUP_TICKS - f.stunTimer, GETUP_TICKS));
      }
      const down = f.state === FS.KO ? f.stateTick : KNOCKDOWN_TICKS - f.stunTimer;
      return pose('knockout', hold(art.lying, down, 6));
    }
    case FS.Attack: {
      const move = getMove(f.hero, f.moveId);
      const a = art.attacks[MOVE_KEYS[f.moveId]];
      const t = f.stateTick;
      if (t < move.startup) return pose(a.anim, spread(a.startup, t, move.startup));
      if (t < move.startup + move.active) {
        const at = t - move.startup;
        return pose(a.anim, a.loopActive ? loop(a.active, at, 4) : spread(a.active, at, move.active));
      }
      if (move.air) return pose(a.anim, a.recovery[a.recovery.length - 1]);
      return pose(a.anim, spread(a.recovery, t - move.startup - move.active, move.recovery));
    }
    default:
      if (celebrating) return pose('win', hold(art.win, Math.max(0, celebrateTicks - 10), 7));
      return pose('idle', loop(art.idle, clock, 9));
  }
}
