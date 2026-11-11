// Render-only: maps sim fighter state to a sprite frame. The sim knows nothing about this.
import chrisAtlas from '../../assets/heroes/chris/atlas.json';
import chrisPng from '../../assets/heroes/chris/atlas.png';
import chrisBase from '../../assets/heroes/chris/base/east.png';
import chrisSheet from '../../assets/heroes/chris/sheet_portrait.jpg';
import chrisSuper from '../../assets/heroes/chris/super_art.jpg';
import jetsetterAtlas from '../../assets/heroes/jetsetter/atlas.json';
import jetsetterSheet from '../../assets/heroes/jetsetter/sheet_portrait.jpg';
import jetsetterSuper from '../../assets/heroes/jetsetter/super_art.jpg';
import leaderAtlas from '../../assets/heroes/leader/atlas.json';
import leaderPng from '../../assets/heroes/leader/atlas.png';
import leaderBase from '../../assets/heroes/leader/base/east.png';
import leaderSheet from '../../assets/heroes/leader/sheet_portrait.jpg';
import leaderSuper from '../../assets/heroes/leader/super_art.jpg';
import jetsetterPng from '../../assets/heroes/jetsetter/atlas.png';
import jetsetterBase from '../../assets/heroes/jetsetter/base/east.png';
import rogueAtlas from '../../assets/heroes/rogue/atlas.json';
import roguePng from '../../assets/heroes/rogue/atlas.png';
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
  cell: number;
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
  attacks: Record<MoveKey, AttackArt>;
}

const ART: Record<string, HeroArt> = {
  rogue: {
    key: 'rogue',
    png: roguePng,
    atlas: rogueAtlas,
    base: rogueBase,
    projectiles: { projectile: 'bolt' },
    scale: 2,
    feetX: 100,
    feetY: 170,
    cell: 200,
    face: { x: 50, y: 4, w: 40, h: 40 },
    idle: [0, 1, 2, 3],
    walk: [0, 1, 2, 3, 4, 5],
    jump: [2, 3, 4, 5, 6, 7, 8],
    crouch: [1, 2, 3, 4],
    block: [3, 4],
    hit: [2, 3, 4, 5],
    fall: [2, 3, 4],
    lying: [5, 6],
    getup: [0, 1, 2, 3, 4],
    win: [2, 3, 4, 5, 6, 7, 8],
    attacks: {
      light: { anim: 'light_punch', startup: [0], active: [1], recovery: [2] },
      heavy: { anim: 'heavy_punch', startup: [0, 1, 2], active: [3], recovery: [3, 2, 0] },
      kick: { anim: 'kick', startup: [1, 2, 3], active: [4, 5], recovery: [6, 7, 8] },
      crouchLight: { anim: 'crouch_light', startup: [1, 2], active: [3], recovery: [2, 1] },
      sweep: { anim: 'sweep', startup: [1, 2, 3], active: [4], recovery: [3, 5] },
      jumpAttack: { anim: 'jump_attack', startup: [0, 1], active: [2, 3], recovery: [4] },
      throw: { anim: 'heavy_punch', startup: [1], active: [3], recovery: [3, 2, 1, 0] },
      special: { anim: 'special', startup: [0, 1, 2, 3], active: [4, 5], recovery: [6, 3] },
      projectile: { anim: 'projectile', startup: [0, 1, 2, 3], active: [4], recovery: [5, 4, 0] },
      rising: { anim: 'uppercut', startup: [0, 1], active: [2, 3], recovery: [4, 5, 6] },
      super: { anim: 'special', startup: [1, 2], active: [3, 4, 5], recovery: [6, 3], loopActive: true },
    },
  },
  jetsetter: {
    key: 'jetsetter',
    png: jetsetterPng,
    atlas: jetsetterAtlas,
    base: jetsetterBase,
    sheet: jetsetterSheet,
    superArt: jetsetterSuper,
    projectiles: { projectile: 'disc' },
    scale: 2,
    feetX: 100,
    feetY: 170,
    cell: 200,
    face: { x: 52, y: 2, w: 40, h: 40 },
    idle: [0, 1, 2, 3],
    walk: [0, 1, 2, 3, 4, 5],
    jump: [2, 3, 4, 5, 6, 7, 8],
    crouch: [1, 2, 3, 4],
    block: [1, 2],
    hit: [2, 3, 4, 5],
    fall: [2, 3, 4],
    lying: [5, 6],
    getup: [0, 1, 2, 3, 4],
    win: [3, 4, 5, 6, 7, 8],
    attacks: {
      light: { anim: 'light_punch', startup: [0], active: [1], recovery: [2] },
      heavy: { anim: 'heavy_punch', startup: [1, 2, 3], active: [4], recovery: [6, 3] },
      kick: { anim: 'kick', startup: [1, 2], active: [3, 4], recovery: [5, 6] },
      crouchLight: { anim: 'crouch_light', startup: [1, 2], active: [3], recovery: [2, 1] },
      sweep: { anim: 'sweep', startup: [1, 2, 3], active: [4], recovery: [3, 5] },
      jumpAttack: { anim: 'jump_attack', startup: [0, 1], active: [2, 3], recovery: [4] },
      throw: { anim: 'heavy_punch', startup: [1], active: [3], recovery: [3, 1, 0] },
      special: { anim: 'special', startup: [4, 5, 6], active: [7, 8], recovery: [8, 6] },
      projectile: { anim: 'projectile', startup: [0, 1, 2, 3], active: [4], recovery: [5, 6] },
      rising: { anim: 'uppercut', startup: [0, 1], active: [2, 3], recovery: [4, 5] },
      super: { anim: 'heavy_punch', startup: [1, 2, 3], active: [4, 5], recovery: [6], loopActive: true },
    },
  },
  chris: {
    key: 'chris',
    png: chrisPng,
    atlas: chrisAtlas,
    base: chrisBase,
    sheet: chrisSheet,
    superArt: chrisSuper,
    projectiles: { projectile: 'cards' },
    scale: 2,
    feetX: 100,
    feetY: 170,
    cell: 200,
    face: { x: 52, y: 4, w: 36, h: 36 },
    idle: [0, 1, 2, 3, 4, 5, 6, 7],
    walk: [0, 1, 2, 3, 4, 5],
    jump: [3, 4, 5, 6],
    crouch: [1, 2, 3, 4],
    block: [3, 4],
    hit: [2, 3, 4, 5],
    fall: [2, 3, 4],
    lying: [5, 6],
    getup: [0, 1, 2, 3, 4],
    win: [1, 2, 3, 4, 5, 6, 7, 8],
    attacks: {
      light: { anim: 'light_punch', startup: [0], active: [1], recovery: [2] },
      heavy: { anim: 'heavy_punch', startup: [1, 2, 3], active: [4], recovery: [3, 0] },
      kick: { anim: 'kick', startup: [1, 2], active: [3, 4], recovery: [5] },
      crouchLight: { anim: 'crouch_light', startup: [0, 1], active: [3], recovery: [2, 1] },
      sweep: { anim: 'sweep', startup: [1, 2, 3], active: [4], recovery: [3, 5] },
      jumpAttack: { anim: 'jump_attack', startup: [0, 1], active: [2, 3], recovery: [4] },
      throw: { anim: 'heavy_punch', startup: [1], active: [4], recovery: [3, 1, 0] },
      // The Diplomacy: cards swirl while he waits; the answer sends them flying.
      special: { anim: 'special', startup: [1, 2], active: [3, 4, 5, 6], recovery: [7, 8, 0], loopActive: true },
      projectile: { anim: 'projectile', startup: [0, 1, 2], active: [3], recovery: [4, 5, 6] },
      rising: { anim: 'uppercut', startup: [0, 1], active: [2, 3], recovery: [4, 5, 6] },
      super: { anim: 'special', startup: [4, 5], active: [5, 6, 7], recovery: [8], loopActive: true },
    },
  },
  leader: {
    key: 'leader',
    png: leaderPng,
    atlas: leaderAtlas,
    base: leaderBase,
    sheet: leaderSheet,
    superArt: leaderSuper,
    projectiles: { special: 'crew', projectile: 'wave' },
    scale: 2,
    feetX: 100,
    feetY: 170,
    cell: 200,
    face: { x: 60, y: 2, w: 40, h: 40 },
    idle: [0, 1, 2, 3, 4, 5, 6, 7],
    walk: [0, 1, 2, 3, 4, 5],
    jump: [3, 4, 5, 6],
    crouch: [1, 2, 3, 4],
    block: [3, 4],
    hit: [2, 3, 4, 5],
    fall: [2, 3, 4],
    lying: [5, 6],
    getup: [0, 1, 2, 3, 4],
    win: [2, 3, 4, 5, 6, 7, 8],
    attacks: {
      light: { anim: 'light_punch', startup: [0, 1], active: [2], recovery: [1] },
      heavy: { anim: 'heavy_punch', startup: [1, 2, 3], active: [5], recovery: [4, 0] },
      kick: { anim: 'kick', startup: [1, 2], active: [3, 4], recovery: [5] },
      crouchLight: { anim: 'crouch_light', startup: [0, 1], active: [2], recovery: [1] },
      sweep: { anim: 'sweep', startup: [1, 2, 3], active: [4], recovery: [3, 5] },
      jumpAttack: { anim: 'jump_attack', startup: [0, 1], active: [2, 3], recovery: [4] },
      throw: { anim: 'heavy_punch', startup: [1], active: [5], recovery: [4, 1, 0] },
      special: { anim: 'special', startup: [1, 2, 3, 4, 5], active: [8], recovery: [8, 7, 6] },
      projectile: { anim: 'projectile', startup: [0, 1, 2, 3], active: [4], recovery: [5] },
      rising: { anim: 'uppercut', startup: [0, 1], active: [2, 3], recovery: [4, 5] },
      super: { anim: 'special', startup: [2, 3], active: [3, 4, 5], recovery: [8], loopActive: true },
    },
  },
};

export const ALL_ART: HeroArt[] = Object.values(ART);

export function artFor(hero: number): HeroArt {
  return ART[HEROES[hero].id];
}

export const frameName = (anim: string, i: number): string => `${anim}/${String(i).padStart(2, '0')}`;

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
