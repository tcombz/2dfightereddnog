import Phaser from 'phaser';
import { preloadAudio } from '../audio';
import { C, CSS, GAME_TITLE, VIEW_H, VIEW_W } from '../config';
import { makeTextures } from '../fx';
import { ALL_ART } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { STAGES } from '../stages';
import { display } from '../ui';

/** Loads every asset with a progress bar, builds generated textures, then opens the title. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    const bar = this.add.graphics();
    this.add.text(VIEW_W / 2, VIEW_H / 2 - 40, GAME_TITLE, display(40, CSS.gold, 6)).setOrigin(0.5);
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      bar.clear();
      bar.fillStyle(0x1a1f3a, 1).fillRect(VIEW_W / 2 - 200, VIEW_H / 2 + 10, 400, 10);
      bar.fillStyle(C.gold, 1).fillRect(VIEW_W / 2 - 200, VIEW_H / 2 + 10, 400 * p, 10);
    });
    for (const art of ALL_ART) {
      this.load.atlas(art.key, art.png, art.atlas);
      this.load.image(`${art.key}_base`, art.base);
    }
    for (const st of STAGES) this.load.image(`stage_${st.id}`, st.url);
    preloadAudio(this);
  }

  create(): void {
    makeTextures(this);
    for (const art of ALL_ART) this.makePortrait(art.key, art.face);
    this.scene.start('title');
  }

  /** Square head-and-shoulders portrait cut from the base sprite, on a dark tinted card. */
  private makePortrait(id: string, face: { x: number; y: number; w: number; h: number }): void {
    const key = `portrait_${id}`;
    if (this.textures.exists(key)) return;
    const size = 80;
    const tex = this.textures.createCanvas(key, size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    const color = Phaser.Display.Color.IntegerToColor(heroInfo(id).color);
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, `rgba(${color.red},${color.green},${color.blue},0.55)`);
    g.addColorStop(1, 'rgba(8,10,20,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;
    const src = this.textures.get(`${id}_base`).getSourceImage() as HTMLImageElement;
    ctx.drawImage(src, face.x, face.y, face.w, face.h, 0, 0, size, size);
    tex.refresh();
  }
}
