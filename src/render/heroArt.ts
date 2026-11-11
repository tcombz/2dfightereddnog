// Render-only: maps sim fighter state to a sprite frame. The sim knows nothing about this.
import jetsetterAtlas from '../../assets/heroes/jetsetter/atlas.json';
import jetsetterPng from '../../assets/heroes/jetsetter/atlas.png';
import rogueAtlas from '../../assets/heroes/rogue/atlas.json';
import roguePng from '../../assets/heroes/rogue/atlas.png';
import { FS, HEROES, MOVE_KEYS, Phase, ROUND_END_TICKS, Result, getMove } from '../sim';
import type { FighterState, GameState } from '../sim';

/** Sprite frame indices (into the atlas animation) shown during each part of a move. */
interface AttackArt {
  anim: string;
  startup: number[];
  active: number[];
  recovery: number[];
}

export interface HeroArt {
  key: string;
  png: string;
  atlas: object;
  /** Sprites are drawn at this multiple of their pixel size. */
  scale: number;
  /** Where the fighter's feet centre sits inside the atlas cell, in cell pixels. */
  feetX: number;
  feetY: number;
  cell: number;
  idle: number[];
  walk: number[];
  jump: number[];
  crouch: number[];
  block: number[];
  hit: number[];
  knockout: number[];
  win: number[];
  attacks: Record<(typeof MOVE_KEYS)[number], AttackArt>;
}

const ART: Record<string, HeroArt> = {
  rogue: {
    key: 'rogue',
    png: roguePng,
    atlas: rogueAtlas,
    scale: 2,
    feetX: 82,
    feetY: 147,
    cell: 172,
    idle: [0, 1, 2, 3],
    walk: [0, 1, 2, 3, 4, 5],
    jump: [4, 5, 6, 7],
    crouch: [1, 2, 3, 4],
    block: [3, 4],
    hit: [2, 3, 4, 5],
    knockout: [2, 3, 4, 5, 6],
    win: [2, 3, 4, 5, 6, 7, 8],
    attacks: {
      light: { anim: 'light_punch', startup: [0], active: [1], recovery: [2] },
      heavy: { anim: 'heavy_punch', startup: [0, 1, 2], active: [3], recovery: [3, 0] },
      special: { anim: 'special', startup: [1, 2, 3], active: [4, 5], recovery: [6, 3] },
    },
  },
  jetsetter: {
    key: 'jetsetter',
    png: jetsetterPng,
    atlas: jetsetterAtlas,
    scale: 2,
    feetX: 86,
    feetY: 147,
    cell: 172,
    idle: [0, 1, 2, 3],
    walk: [0, 1, 2, 3, 4, 5],
    jump: [4, 5, 6, 7],
    crouch: [1, 2, 3, 4],
    block: [1, 2],
    hit: [2, 3, 4, 5],
    knockout: [2, 3, 4, 5, 6],
    win: [3, 4, 5, 6, 7, 8],
    attacks: {
      light: { anim: 'light_punch', startup: [0], active: [1], recovery: [2] },
      heavy: { anim: 'heavy_punch', startup: [2, 3, 4], active: [5, 6], recovery: [6, 3] },
      special: { anim: 'special', startup: [4, 5, 6], active: [7, 8], recovery: [8, 6] },
    },
  },
};

export const ALL_ART: HeroArt[] = Object.values(ART);

export function artFor(hero: number): HeroArt | undefined {
  return ART[HEROES[hero].id];
}

const name = (anim: string, i: number): string => `${anim}/${String(i).padStart(2, '0')}`;

/** Frame `t` of `total` spread evenly over `frames`. */
function spread(frames: number[], t: number, total: number): number {
  const i = Math.floor((t * frames.length) / Math.max(1, total));
  return frames[Math.min(frames.length - 1, Math.max(0, i))];
}

const loop = (frames: number[], t: number, ticksPerFrame: number): number =>
  frames[Math.floor(t / ticksPerFrame) % frames.length];

const hold = (frames: number[], t: number, ticksPerFrame: number): number =>
  frames[Math.min(frames.length - 1, Math.floor(t / ticksPerFrame))];

/** The atlas frame name to show for fighter `slot` in this state. */
export function frameFor(art: HeroArt, s: GameState, slot: number): string {
  const f: FighterState = s.fighters[slot];
  const st = HEROES[f.hero].stats;

  switch (f.state) {
    case FS.Walk:
      return name('walk', loop(art.walk, f.stateTick, 5));
    case FS.Jump:
      return name('jump', spread(art.jump, f.stateTick, Math.floor((2 * st.jumpVelocity) / st.gravity)));
    case FS.Crouch:
      return name('crouch', hold(art.crouch, f.stateTick, 2));
    case FS.Block:
      return name('block', hold(art.block, f.stateTick, 2));
    case FS.Hitstun:
      return name('hit', spread(art.hit, f.stateTick, f.stateTick + f.stunTimer));
    case FS.Knockdown:
    case FS.KO:
      return name('knockout', hold(art.knockout, f.stateTick, 4));
    case FS.Attack: {
      const move = getMove(f.hero, f.moveId);
      const a = art.attacks[MOVE_KEYS[f.moveId]];
      const t = f.stateTick;
      if (t < move.startup) return name(a.anim, spread(a.startup, t, move.startup));
      if (t < move.startup + move.active) return name(a.anim, spread(a.active, t - move.startup, move.active));
      return name(a.anim, spread(a.recovery, t - move.startup - move.active, move.recovery));
    }
    default: {
      const won =
        (s.phase === Phase.RoundEnd && s.roundResult === slot) ||
        (s.phase === Phase.MatchEnd && s.matchResult === slot && s.roundResult !== Result.Draw);
      if (won) {
        const t = s.phase === Phase.MatchEnd ? ROUND_END_TICKS : ROUND_END_TICKS - s.phaseTimer;
        return name('win', hold(art.win, Math.max(0, t - 20), 6));
      }
      return name('idle', loop(art.idle, s.tick, 9));
    }
  }
}
