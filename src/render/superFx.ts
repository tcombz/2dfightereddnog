// Super cinematics, themed on each character sheet's super art:
// the Rogue's lightning storm, the Jetsetter's crowd and records, Chris's world stage, the Leader's crown and crew.
import Phaser from 'phaser';
import { CSS, VIEW_H, VIEW_W } from './config';
import type { HeroInfo, SuperStyle } from './heroInfo';
import { body, display, goldFill } from './ui';

const TINT: Record<SuperStyle, number> = {
  storm: 0x04123a,
  crowd: 0x26083f,
  world: 0x031431,
  crown: 0x2a1200,
  quake: 0x1c1404,
  squad: 0x020c26,
};

export class SuperFx {
  /** The Leader's crown and halo, kept over his head while the rush runs. */
  private crown: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: Phaser.GameObjects.Layer,
    private readonly ui: Phaser.GameObjects.Layer,
  ) {}

  private w<T extends Phaser.GameObjects.GameObject>(obj: T, depth: number): T {
    (obj as unknown as Phaser.GameObjects.Components.Depth).setDepth(depth);
    this.world.add(obj);
    return obj;
  }

  private fadeOut(objs: Phaser.GameObjects.GameObject[], delay: number, ms = 300): void {
    this.scene.tweens.add({ targets: objs, alpha: 0, delay, duration: ms, onComplete: () => objs.forEach((o) => o.destroy()) });
  }

  /** The super freeze: tint the screen, raise the themed set piece behind the fighter, slam in the cut-in. */
  flash(info: HeroInfo, heroId: string, slot: number, moveName: string, x: number, footY: number, facing: number): void {
    const s = this.scene;
    const style = info.superStyle;
    const tint = this.w(s.add.rectangle(-600, -600, VIEW_W + 1200, VIEW_H + 1200, TINT[style], 0).setOrigin(0, 0).setScrollFactor(0), 9);
    s.tweens.add({ targets: tint, fillAlpha: 0.66, duration: 120 });
    this.fadeOut([tint], 1150, 350);
    const cy = footY - 130;

    if (style === 'storm') {
      for (let i = 0; i < 7; i += 1) {
        s.time.delayedCall(i * 90, () => this.strike(x + (Math.random() - 0.5) * 520, footY));
      }
    } else if (style === 'crowd') {
      const disc = this.w(s.add.image(x - facing * 30, cy - 20, 'fx_disc').setScale(0.4).setAlpha(0.95), 10);
      const glow = this.w(s.add.image(disc.x, disc.y, 'fx_glow').setTint(0xffc23d).setBlendMode(Phaser.BlendModes.ADD).setScale(1), 10);
      s.tweens.add({ targets: disc, scale: 4.2, rotation: 6, duration: 900, ease: 'Cubic.easeOut' });
      s.tweens.add({ targets: glow, scale: 6, duration: 700 });
      this.fadeOut([disc, glow], 900, 400);
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        const d = this.w(s.add.image(x, cy, 'fx_disc').setScale(0.5), 34);
        s.tweens.add({ targets: d, x: x + Math.cos(a) * 340, y: cy + Math.sin(a) * 200, rotation: 8, duration: 1100, ease: 'Quad.easeOut' });
        this.fadeOut([d], 700, 400);
      }
      for (const [bx, c, a] of [
        [x - 300, 0xb06cff, -25],
        [x + 300, 0xffc23d, 25],
        [x, 0xb06cff, 0],
      ] as Array<[number, number, number]>) {
        const beam = this.w(s.add.image(bx, footY - 520, 'fx_beam').setOrigin(0.5, 0).setTint(c).setAlpha(0).setAngle(a).setBlendMode(Phaser.BlendModes.ADD).setScale(1.4, 1.1), 11);
        s.tweens.add({ targets: beam, alpha: 0.5, angle: -a, duration: 700, yoyo: true });
        this.fadeOut([beam], 1300, 200);
      }
    } else if (style === 'world') {
      const globe = this.w(s.add.image(x - facing * 20, cy - 30, 'fx_globe').setScale(0.2).setAlpha(0.95).setBlendMode(Phaser.BlendModes.ADD), 10);
      s.tweens.add({ targets: globe, scale: 2.1, duration: 600, ease: 'Back.easeOut' });
      s.tweens.add({ targets: globe, angle: facing * 40, duration: 1400 });
      this.fadeOut([globe], 1000, 450);
      for (let i = 0; i < 14; i += 1) {
        const card = this.w(s.add.image(x, cy, 'fx_card').setScale(1.4), i % 2 ? 34 : 12);
        const a0 = (i / 14) * Math.PI * 2;
        const orbit = { t: 0 };
        s.tweens.add({
          targets: orbit,
          t: 1,
          duration: 1300,
          onUpdate: () => {
            const a = a0 + orbit.t * 5;
            const r = 60 + orbit.t * 260;
            card.setPosition(x + Math.cos(a) * r, cy + Math.sin(a) * r * 0.45).setRotation(a * 2);
          },
        });
        this.fadeOut([card], 1000, 300);
      }
    } else if (style === 'quake') {
      // Titan Smash: the ground gives way. Rocks erupt along the floor and shockwaves roll out.
      for (let i = 0; i < 18; i += 1) {
        s.time.delayedCall(80 + i * 35, () => {
          const rx = x + (Math.random() - 0.5) * 700;
          const r = this.w(s.add.image(rx, footY + 10, 'fx_rock').setScale(1.2 + Math.random() * 1.6), 34);
          s.tweens.add({ targets: r, y: footY - 120 - Math.random() * 220, rotation: (Math.random() - 0.5) * 8, duration: 420, ease: 'Quad.easeOut', yoyo: true, onComplete: () => r.destroy() });
        });
      }
      for (let k = 0; k < 3; k += 1) {
        s.time.delayedCall(300 + k * 260, () => {
          const ring = this.w(s.add.image(x, footY - 10, 'fx_glow').setTint(0xffc23d).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6, 0.18), 33);
          s.tweens.add({ targets: ring, scaleX: 9, scaleY: 1.1, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
          this.scene.cameras.main.shake(180, 0.008);
        });
      }
      const glow = this.w(s.add.image(x, footY - 120, 'fx_glow').setTint(0xffb020).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.8), 10);
      s.tweens.add({ targets: glow, scale: 5, alpha: 0, duration: 1000, onComplete: () => glow.destroy() });
    } else if (style === 'squad') {
      // Operation: Backup. A dropship roars over, searchlights sweep, and the squad lines up on both sides.
      const ship = this.w(s.add.image(x - facing * 700, footY - 430, 'fx_dropship').setScale(1.6).setFlipX(facing < 0), 10);
      s.tweens.add({ targets: ship, x: x + facing * 700, duration: 1400, ease: 'Sine.easeInOut' });
      this.fadeOut([ship], 1200, 300);
      for (const [bx, a] of [[x - 260, -20], [x + 260, 20]] as Array<[number, number]>) {
        const beam = this.w(s.add.image(bx, footY - 560, 'fx_beam').setOrigin(0.5, 0).setTint(0x4aa8ff).setAlpha(0).setAngle(a).setBlendMode(Phaser.BlendModes.ADD).setScale(1.3, 1.1), 11);
        s.tweens.add({ targets: beam, alpha: 0.55, angle: -a, duration: 650, yoyo: true });
        this.fadeOut([beam], 1300, 200);
      }
      for (const side of [-1, 1]) {
        for (let k = 0; k < 2; k += 1) {
          const sq = this.w(s.add.image(x + side * (420 + k * 90), footY + 4, 'fx_squad').setOrigin(0.5, 1).setScale(1.2 - k * 0.15).setFlipX(side > 0).setAlpha(0), 11 - k);
          s.tweens.add({ targets: sq, alpha: 0.95, x: x + side * (170 + k * 110), duration: 420, delay: 120 + k * 120, ease: 'Cubic.easeOut' });
          this.fadeOut([sq], 1150, 350);
        }
      }
      s.time.delayedCall(500, () => this.scene.cameras.main.shake(200, 0.006));
    } else {
      // The crown drops in over his head as the cut-in clears, and stays through the rush.
      const crown = this.w(s.add.image(x, footY - 470, 'fx_crown').setScale(0.3).setAlpha(0), 33);
      const halo = this.w(s.add.image(x, footY - 330, 'fx_glow').setTint(0xffb020).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0), 32);
      s.tweens.add({ targets: crown, scale: 0.9, alpha: 1, y: footY - 300, duration: 380, delay: 640, ease: 'Bounce.easeOut' });
      s.tweens.add({ targets: halo, scale: 4.5, alpha: 0.75, duration: 380, delay: 640 });
      s.time.delayedCall(1020, () => this.scene.cameras.main.shake(160, 0.006));
      this.fadeOut([crown, halo], 1500, 400);
      this.crown = [crown, halo];
      for (const side of [-1, 1]) {
        const crew = this.w(s.add.image(x + side * 190, footY + 4, 'fx_crew').setOrigin(0.5, 1).setScale(1.25).setFlipX(side > 0).setAlpha(0), 11);
        s.tweens.add({ targets: crew, alpha: 0.95, x: x + side * 150, duration: 400, delay: 150 });
        this.fadeOut([crew], 1100, 350);
      }
      this.embers(x, footY, 40);
    }

    this.cutIn(info, heroId, slot, moveName);
  }

  /** Effects while the super's active frames run (call every render tick). */
  active(info: HeroInfo, x: number, footY: number, facing: number, clock: number): void {
    const style = info.superStyle;
    if (style === 'storm' && clock % 5 === 0) this.strike(x + facing * (60 + Math.random() * 90), footY);
    else if (style === 'crowd' && clock % 3 === 0) this.flyer('fx_disc', x, footY - 130, facing, 0.45);
    else if (style === 'world' && clock % 2 === 0) this.flyer('fx_card', x, footY - 120, facing, 1.3);
    else if (style === 'crown') {
      if (clock % 2 === 0) this.embers(x + facing * 60, footY, 3);
      for (const o of this.crown) if (o.active) o.x += (x - o.x) * 0.35;
    } else if (style === 'squad' && clock % 3 === 0) {
      // The squad lays down cover: tracer streaks flying past him at the target.
      const s = this.scene;
      const y = footY - 90 - Math.random() * 120;
      const t = this.w(s.add.image(x - facing * 200, y, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9fd4ff).setScale(0.9, 0.05), 34);
      s.tweens.add({ targets: t, x: x + facing * 420, alpha: 0, duration: 220, onComplete: () => t.destroy() });
    } else if (style === 'quake' && clock % 6 === 0) {
      // Every slam kicks up rocks and dust in front of him.
      const s = this.scene;
      for (let i = 0; i < 4; i += 1) {
        const r = this.w(s.add.image(x + facing * (70 + Math.random() * 90), footY, 'fx_rock').setScale(0.9 + Math.random()), 34);
        s.tweens.add({ targets: r, y: footY - 60 - Math.random() * 120, x: r.x + facing * Math.random() * 80, rotation: Math.random() * 6, alpha: 0, duration: 480, onComplete: () => r.destroy() });
      }
      s.cameras.main.shake(90, 0.005);
    }
  }

  private strike(x: number, footY: number): void {
    const s = this.scene;
    const b = this.w(s.add.image(x, footY + 10, `fx_strike${Math.floor(Math.random() * 3)}`).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD), 36);
    b.setScale(1, 1.05).setAlpha(1);
    s.tweens.add({ targets: b, alpha: 0, duration: 220, ease: 'Quad.easeIn', onComplete: () => b.destroy() });
    const g = this.w(s.add.image(x, footY - 10, 'fx_glow').setTint(0x7ee0ff).setBlendMode(Phaser.BlendModes.ADD).setScale(1.2), 35);
    s.tweens.add({ targets: g, alpha: 0, scale: 2.4, duration: 260, onComplete: () => g.destroy() });
  }

  private flyer(key: string, x: number, y: number, facing: number, scale: number): void {
    const s = this.scene;
    const f = this.w(s.add.image(x, y + (Math.random() - 0.5) * 140, key).setScale(scale), 34);
    s.tweens.add({
      targets: f,
      x: x + facing * (220 + Math.random() * 160),
      y: f.y + (Math.random() - 0.5) * 80,
      rotation: facing * 9,
      alpha: 0,
      duration: 420,
      onComplete: () => f.destroy(),
    });
  }

  private embers(x: number, footY: number, n: number): void {
    const s = this.scene;
    for (let i = 0; i < n; i += 1) {
      const e = this.w(s.add.image(x + (Math.random() - 0.5) * 360, footY - Math.random() * 40, 'fx_glow'), 33);
      e.setTint(Math.random() < 0.5 ? 0xff7a1a : 0xffc23d).setBlendMode(Phaser.BlendModes.ADD).setScale(0.08 + Math.random() * 0.1);
      s.tweens.add({ targets: e, y: e.y - 160 - Math.random() * 220, x: e.x + (Math.random() - 0.5) * 60, alpha: 0, duration: 700 + Math.random() * 500, onComplete: () => e.destroy() });
    }
  }

  /** The cut-in banner: the sheet's own super art where there is one, else the pixel portrait. */
  private cutIn(info: HeroInfo, heroId: string, slot: number, moveName: string): void {
    const s = this.scene;
    const y = 200;
    const h = 170;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const band = s.add.graphics();
    band.fillStyle(0x000000, 0.8).fillRect(0, y - h / 2 - 6, VIEW_W, h + 12);
    band.fillStyle(info.color, 1).fillRect(0, y - h / 2 - 6, VIEW_W, 4).fillRect(0, y + h / 2 + 2, VIEW_W, 4);
    objs.push(band);
    const artKey = `superart_${heroId}`;
    if (s.textures.exists(artKey)) {
      const art = s.add.image(slot === 0 ? VIEW_W * 0.62 : VIEW_W * 0.38, y, artKey);
      const scale = Math.max(560 / art.width, h / art.height);
      art.setScale(scale);
      // Show only a band of the art the height of the banner.
      const cropH = Math.min(art.height, h / scale);
      art.setCrop(0, (art.height - cropH) / 2, art.width, cropH);
      art.setX(art.x + (slot === 0 ? 260 : -260));
      s.tweens.add({ targets: art, x: art.x + (slot === 0 ? -260 : 260), duration: 260, ease: 'Cubic.easeOut' });
      s.tweens.add({ targets: art, x: `${slot === 0 ? '-' : '+'}=40`, duration: 900, delay: 260 });
      objs.push(art);
    } else {
      const p = s.add.image(slot === 0 ? -100 : VIEW_W + 100, y, `portrait_${heroId}`).setDisplaySize(h, h).setFlipX(slot === 1);
      s.tweens.add({ targets: p, x: slot === 0 ? 120 : VIEW_W - 120, duration: 220, ease: 'Cubic.easeOut' });
      objs.push(p);
      for (let i = 0; i < 4; i += 1) {
        const b = s.add.image(260 + i * 170, y, `fx_strike${i % 3}`).setScale(0.5, 0.3).setAngle(90).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6);
        objs.push(b);
      }
    }
    // Name on the side away from the art's focus.
    const nx = slot === 0 ? 34 : VIEW_W - 34;
    const name = s.add.text(nx, y - 12, moveName.toUpperCase(), display(44, '#ffffff', 9)).setOrigin(slot === 0 ? 0 : 1, 0.5);
    goldFill(name);
    const who = s.add.text(nx, y + 34, info.title, body(17, CSS.ink)).setOrigin(slot === 0 ? 0 : 1, 0.5).setShadow(0, 2, '#000000', 4);
    objs.push(name, who);
    name.setX(nx + (slot === 0 ? -60 : 60)).setAlpha(0);
    s.tweens.add({ targets: name, x: nx, alpha: 1, duration: 200, delay: 80, ease: 'Back.easeOut' });
    this.ui.add(objs);
    band.setAlpha(0);
    s.tweens.add({ targets: band, alpha: 1, duration: 80 });
    s.time.delayedCall(720, () => s.tweens.add({ targets: objs, alpha: 0, duration: 160, onComplete: () => objs.forEach((o) => o.destroy()) }));
  }
}
