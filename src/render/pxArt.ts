// Pixel-art projectiles and summons from PixelLab (assets/fx): animated sheets and sprites that
// replace the old drawn-in-code shapes. Loaded in Boot; the animations are global.
import Phaser from 'phaser';
import card from '../../assets/fx/card.png';
import crewRun from '../../assets/fx/crew_run.png';
import eddSpike from '../../assets/fx/edd_spike.png';
import goldenOrb from '../../assets/fx/golden_orb.png';
import malBolt from '../../assets/fx/mal_bolt.png';
import record from '../../assets/fx/record.png';
import rocks from '../../assets/fx/rocks.png';
import rogueBolt from '../../assets/fx/rogue_bolt.png';
import squad from '../../assets/fx/squad.png';
import { PX_STRIPS } from './pxStrips';

interface Sheet {
  key: string;
  url: string;
  w: number;
  h: number;
  frames: number;
  fps: number;
  loop: boolean;
}

const SHEETS: Sheet[] = [
  { key: 'px_rogue_bolt', url: rogueBolt, w: 72, h: 72, frames: 8, fps: 14, loop: true },
  { key: 'px_mal_bolt', url: malBolt, w: 85, h: 26, frames: 4, fps: 14, loop: true },
  { key: 'px_edd_spike', url: eddSpike, w: 142, h: 87, frames: 18, fps: 24, loop: false },
  { key: 'px_crew_run', url: crewRun, ...PX_STRIPS.crew_run, fps: 14, loop: true },
  { key: 'px_squad', url: squad, ...PX_STRIPS.squad, fps: 10, loop: true },
];

const IMAGES: Array<[string, string]> = [
  ['px_record', record],
  ['px_card', card],
  ['px_golden', goldenOrb],
  ['px_rocks', rocks],
];

export function preloadPx(scene: Phaser.Scene): void {
  for (const s of SHEETS) scene.load.spritesheet(s.key, s.url, { frameWidth: s.w, frameHeight: s.h, endFrame: s.frames - 1 });
  for (const [key, url] of IMAGES) scene.load.image(key, url);
}

/** One animation per sheet, named after it: play('px_rogue_bolt'). */
export function makePxAnims(scene: Phaser.Scene): void {
  for (const s of SHEETS) {
    if (scene.anims.exists(s.key)) continue;
    scene.anims.create({
      key: s.key,
      frames: scene.anims.generateFrameNumbers(s.key, { start: 0, end: s.frames - 1 }),
      frameRate: s.fps,
      repeat: s.loop ? -1 : 0,
    });
  }
  // The squad advances behind the shield (loop), then plants it (stops on the last frame).
  if (!scene.anims.exists('px_squad_run')) {
    scene.anims.create({ key: 'px_squad_run', frames: scene.anims.generateFrameNumbers('px_squad', { start: 0, end: 2 }), frameRate: 10, repeat: -1 });
    scene.anims.create({ key: 'px_squad_push', frames: scene.anims.generateFrameNumbers('px_squad', { start: 0, end: 2 }), frameRate: 12, repeat: 0 });
  }
}
