// Render-only: maps sim fighter state to a sprite frame. The sim knows nothing about this.
import chrisArt from '../../assets/heroes/chris/art.json';
import chrisAtlas from '../../assets/heroes/chris/atlas.json';
import chrisPng from '../../assets/heroes/chris/atlas.png';
import chrisBase from '../../assets/heroes/chris/base/east.png';
import chrisSheet from '../../assets/heroes/chris/sheet_portrait.jpg';
import chrisSuper from '../../assets/heroes/chris/super_art.jpg';
import eddnogArt from '../../assets/heroes/eddnog/art.json';
import eddnogAtlas from '../../assets/heroes/eddnog/atlas.json';
import eddnogPng from '../../assets/heroes/eddnog/atlas.png';
import eddnogBase from '../../assets/heroes/eddnog/base/east.png';
import eddnogSheet from '../../assets/heroes/eddnog/sheet_portrait.jpg';
import eddnogSuper from '../../assets/heroes/eddnog/super_art.jpg';
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
import malcolmArt from '../../assets/heroes/malcolm/art.json';
import malcolmAtlas from '../../assets/heroes/malcolm/atlas.json';
import malcolmPng from '../../assets/heroes/malcolm/atlas.png';
import malcolmBase from '../../assets/heroes/malcolm/base/east.png';
import malcolmSheet from '../../assets/heroes/malcolm/sheet_portrait.jpg';
import malcolmSuper from '../../assets/heroes/malcolm/super_art.jpg';
import quincyArt from '../../assets/heroes/quincy/art.json';
import quincyAtlas from '../../assets/heroes/quincy/atlas.json';
import quincyPng from '../../assets/heroes/quincy/atlas.png';
import quincyBase from '../../assets/heroes/quincy/base/east.png';
import quincySheet from '../../assets/heroes/quincy/sheet_portrait.jpg';
import quincySuper from '../../assets/heroes/quincy/super_art.jpg';
import rogueAtlas from '../../assets/heroes/rogue/atlas.json';
import roguePng from '../../assets/heroes/rogue/atlas.png';
import rogueArt from '../../assets/heroes/rogue/art.json';
import rogueBase from '../../assets/heroes/rogue/base/east.png';
import rogueSheet from '../../assets/heroes/rogue/sheet_portrait.jpg';
import rogueSuper from '../../assets/heroes/rogue/super_art.jpg';
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
export type ProjStyle = 'bolt' | 'disc' | 'cards' | 'golden' | 'quake' | 'crew' | 'tracer' | 'squad' | 'emblem';

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
  /** A companion who watches from the stage background (Quincy's cat). */
  companion?: boolean;
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
  /** Forward dash run cycle and back-dash hop (empty: fall back to walk and jump frames). */
  dash: number[];
  backdash: number[];
  /** Hit while crouching, and guarding low (empty: fall back to crouch frames). */
  hitLow: number[];
  crouchBlock: number[];
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
  dash?: number[];
  backdash?: number[];
  hitLow?: number[];
  crouchBlock?: number[];
  attacks: Record<string, AttackArt>;
}

type ArtFields = Omit<HeroArt, 'key' | 'png' | 'atlas' | 'base' | 'sheet' | 'superArt' | 'projectiles'>;

function fromJson(j: ArtJson): ArtFields {
  const { scale, cellW, cellH, feetX, feetY, face, idle, walk, jump, crouch, block, hit, fall, lying, getup, win, powerUp } = j;
  return {
    scale, cellW, cellH, feetX, feetY, face, idle, walk, jump, crouch, block, hit, fall, lying, getup, win, powerUp,
    dash: j.dash ?? [],
    backdash: j.backdash ?? [],
    hitLow: j.hitLow ?? [],
    crouchBlock: j.crouchBlock ?? [],
    attacks: withHeat(j),
  };
}

/**
 * Heat Burst and Heat Smash are shared moves with no clips of their own: the burst plays the hero's
 * power-up (a flex that throws the shockwave), the smash borrows the super's strike.
 */
function withHeat(j: ArtJson): Record<MoveKey, AttackArt> {
  const a = { ...j.attacks } as Record<string, AttackArt>;
  const pu = j.powerUp;
  if (!a.heatBurst) {
    a.heatBurst = pu.length >= 4
      ? { anim: 'power_up', startup: pu.slice(0, pu.length >> 1), active: pu.slice(pu.length >> 1), recovery: [...pu].reverse().slice(0, 3) }
      : { ...a.special };
  }
  if (!a.heatSmash) a.heatSmash = { ...a.super, loopActive: false };
  return a as Record<MoveKey, AttackArt>;
}

const ART: Record<string, HeroArt> = {
  rogue: {
    key: 'rogue',
    png: roguePng,
    atlas: rogueAtlas,
    base: rogueBase,
    sheet: rogueSheet,
    superArt: rogueSuper,
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
    projectiles: { special: 'crew', projectile: 'golden' },
    ...fromJson(leaderArt),
  },
  eddnog: {
    key: 'eddnog',
    png: eddnogPng,
    atlas: eddnogAtlas,
    base: eddnogBase,
    sheet: eddnogSheet,
    superArt: eddnogSuper,
    projectiles: { projectile: 'quake' },
    ...fromJson(eddnogArt),
  },
  malcolm: {
    key: 'malcolm',
    png: malcolmPng,
    atlas: malcolmAtlas,
    base: malcolmBase,
    sheet: malcolmSheet,
    superArt: malcolmSuper,
    projectiles: { special: 'squad', projectile: 'tracer' },
    ...fromJson(malcolmArt),
  },
  quincy: {
    key: 'quincy',
    png: quincyPng,
    atlas: quincyAtlas,
    base: quincyBase,
    sheet: quincySheet,
    superArt: quincySuper,
    projectiles: { projectile: 'emblem' },
    companion: true,
    ...fromJson(quincyArt),
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

/**
 * A hit reaction: snap straight to the biggest recoil (the first listed frame) and hold it while
 * the blow lands, then ease back through the rest. Hits read as hits instead of a slow flinch.
 */
function impact(frames: number[], t: number, total: number): number {
  const hold = Math.max(3, total >> 2);
  if (t < hold || frames.length === 1) return frames[0];
  return frames[Math.min(frames.length - 1, 1 + Math.floor(((t - hold) * (frames.length - 1)) / Math.max(1, total - hold)))];
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
      if (f.vx * f.facing > 0) return art.dash.length ? pose('dash', loop(art.dash, f.stateTick, 3)) : pose('walk', loop(art.walk, f.stateTick, 3));
      return art.backdash.length ? pose('backdash', spread(art.backdash, f.stateTick, st.backdashTicks)) : pose('jump', 2);
    case FS.Jump: {
      const airtime = Math.floor((2 * st.jumpVelocity) / st.gravity);
      return pose('jump', spread(art.jump, f.stateTick, airtime));
    }
    case FS.Crouch:
      return pose('crouch', hold(art.crouch, f.stateTick, 2));
    case FS.Block:
      if (f.low) {
        return art.crouchBlock.length
          ? pose('crouch_block', hold(art.crouchBlock, f.stateTick, 2))
          : pose('crouch', art.crouch[art.crouch.length - 1]);
      }
      return pose('block', hold(art.block, f.stateTick, 2));
    case FS.Hitstun: {
      const total = f.stateTick + f.stunTimer;
      // Hit in the air (a juggle): tumble with the knockdown fall frames, not a standing flinch.
      if (f.y > 0) return pose('knockout', art.fall[f.vy > 4 ? 0 : f.vy > -4 ? 1 : 2]);
      if (f.low) {
        return art.hitLow.length ? pose('hit_low', impact(art.hitLow, f.stateTick, total)) : pose('crouch', art.crouch[art.crouch.length - 2]);
      }
      return pose('hit', impact(art.hit, f.stateTick, total));
    }
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
