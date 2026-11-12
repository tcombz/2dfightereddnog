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
import cracks from '../../assets/fx/cracks.png';
import crown from '../../assets/fx/crown.png';
import debris from '../../assets/fx/debris.png';
import dropship from '../../assets/fx/dropship.png';
import dust from '../../assets/fx/dust.png';
import globe from '../../assets/fx/globe.png';
import strike from '../../assets/fx/strike.png';
import crit from '../../assets/fx/crit.png';
import heatAura from '../../assets/fx/heat_aura.png';
import heatWave from '../../assets/fx/heat_wave.png';
import impact from '../../assets/fx/impact.png';
import squad from '../../assets/fx/squad.png';
import volt from '../../assets/fx/volt.png';
import swing from '../../assets/fx/swing.png';
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
  { key: 'px_swing', url: swing, w: 96, h: 96, frames: 7, fps: 30, loop: false },
  { key: 'px_rogue_bolt', url: rogueBolt, w: 72, h: 72, frames: 8, fps: 14, loop: true },
  { key: 'px_mal_bolt', url: malBolt, w: 85, h: 26, frames: 4, fps: 14, loop: true },
  { key: 'px_edd_spike', url: eddSpike, w: 142, h: 87, frames: 18, fps: 24, loop: false },
  { key: 'px_crew_run', url: crewRun, ...PX_STRIPS.crew_run, fps: 14, loop: true },
  { key: 'px_squad', url: squad, ...PX_STRIPS.squad, fps: 10, loop: true },
  // Hit sparks and Heat, from PixelLab's VFX workbench (white-grey ones are tinted per fighter).
  { key: 'px_impact', url: impact, w: 92, h: 92, frames: 7, fps: 30, loop: false },
  { key: 'px_crit', url: crit, w: 124, h: 128, frames: 8, fps: 28, loop: false },
  { key: 'px_volt', url: volt, w: 200, h: 120, frames: 32, fps: 60, loop: false },
  { key: 'px_heat_aura', url: heatAura, w: 126, h: 200, frames: 8, fps: 12, loop: true },
  { key: 'px_heat_wave', url: heatWave, w: 268, h: 106, frames: 8, fps: 18, loop: false },
  { key: 'px_cracks', url: cracks, w: 141, h: 55, frames: 10, fps: 14, loop: false },
  { key: 'px_strike', url: strike, w: 96, h: 128, frames: 10, fps: 20, loop: false },
  { key: 'px_dust', url: dust, w: 54, h: 41, frames: 8, fps: 16, loop: false },
  { key: 'px_debris', url: debris, w: 73, h: 60, frames: 12, fps: 18, loop: false },
];

const IMAGES: Array<[string, string]> = [
  ['px_record', record],
  ['px_card', card],
  ['px_golden', goldenOrb],
  ['px_rocks', rocks],
  ['px_crown', crown],
  ['px_globe', globe],
  ['px_dropship', dropship],
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
