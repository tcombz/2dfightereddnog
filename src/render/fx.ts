// Procedural effect textures and one-shot effects (sparks, dust, rings, afterimages).
import Phaser from 'phaser';
import type { HitStyle } from './heroInfo';

const TAU = Math.PI * 2;

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  draw(ctx);
  tex.refresh();
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: Array<[number, string]>): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A jagged lightning stroke from (x0,y0) to (x1,y1). */
function bolt(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, jag: number, rnd: () => number): void {
  const steps = 7;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    ctx.lineTo(x0 + (x1 - x0) * t + (rnd() - 0.5) * jag, y0 + (y1 - y0) * t + (rnd() - 0.5) * jag);
  }
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Builds every procedural texture once per game. */
export function makeTextures(scene: Phaser.Scene): void {
  // A chunk of rock with a gold glint, for the Tank's impacts.
  canvasTexture(scene, 'fx_rock', 24, 22, (ctx) => {
    ctx.fillStyle = '#4a4238';
    ctx.strokeStyle = '#141210';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(3, 12);
    ctx.lineTo(8, 3);
    ctx.lineTo(17, 2);
    ctx.lineTo(22, 10);
    ctx.lineTo(18, 20);
    ctx.lineTo(7, 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7a6d5c';
    ctx.fillRect(8, 5, 6, 4);
    ctx.fillStyle = '#ffcf4a';
    ctx.fillRect(15, 6, 3, 2);
  });
  canvasTexture(scene, 'fx_glow', 128, 128, (ctx) =>
    radial(ctx, 64, 64, 64, [
      [0, 'rgba(255,255,255,1)'],
      [0.25, 'rgba(255,255,255,0.6)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  canvasTexture(scene, 'fx_dust', 48, 48, (ctx) =>
    radial(ctx, 24, 24, 24, [
      [0, 'rgba(220,214,235,0.9)'],
      [0.6, 'rgba(180,174,200,0.35)'],
      [1, 'rgba(160,150,190,0)'],
    ]),
  );
  canvasTexture(scene, 'fx_shadow', 128, 32, (ctx) => {
    ctx.save();
    ctx.scale(1, 0.25);
    radial(ctx, 64, 64, 64, [
      [0, 'rgba(0,0,0,0.75)'],
      [0.7, 'rgba(0,0,0,0.4)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    ctx.restore();
  });
  canvasTexture(scene, 'fx_streak', 64, 8, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(56, 0.5);
    ctx.lineTo(64, 4);
    ctx.lineTo(56, 7.5);
    ctx.closePath();
    ctx.fill();
  });
  canvasTexture(scene, 'fx_star', 128, 128, (ctx) => {
    radial(ctx, 64, 64, 40, [
      [0, 'rgba(255,255,255,1)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * TAU;
      const long = i % 2 === 0 ? 62 : 36;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(a) * long, 64 + Math.sin(a) * long);
      ctx.lineTo(64 + Math.cos(a + 0.18) * 10, 64 + Math.sin(a + 0.18) * 10);
      ctx.lineTo(64 + Math.cos(a - 0.18) * 10, 64 + Math.sin(a - 0.18) * 10);
      ctx.closePath();
      ctx.fill();
    }
  });
  canvasTexture(scene, 'fx_ring', 128, 128, (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(64, 64, 50, 0, TAU);
    ctx.stroke();
  });
  canvasTexture(scene, 'fx_hex', 96, 128, (ctx) => {
    // Guard flash: a tall shield shape.
    ctx.strokeStyle = 'rgba(160,230,255,1)';
    ctx.fillStyle = 'rgba(120,200,255,0.25)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(48, 4);
    ctx.lineTo(90, 30);
    ctx.lineTo(90, 98);
    ctx.lineTo(48, 124);
    ctx.lineTo(6, 98);
    ctx.lineTo(6, 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  canvasTexture(scene, 'fx_rain', 4, 22, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 22);
    g.addColorStop(0, 'rgba(190,220,255,0)');
    g.addColorStop(1, 'rgba(210,235,255,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(1, 0, 2, 22);
  });
  canvasTexture(scene, 'fx_beam', 200, 560, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 560);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(92, 0);
    ctx.lineTo(108, 0);
    ctx.lineTo(200, 560);
    ctx.lineTo(0, 560);
    ctx.closePath();
    ctx.fill();
  });
  canvasTexture(scene, 'fx_speedline', 512, 6, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 2, 512, 2);
  });
  // The Rogue's lightning bolt projectile, four flickering frames.
  for (let f = 0; f < 4; f += 1) {
    canvasTexture(scene, `fx_bolt${f}`, 112, 72, (ctx) => {
      const rnd = seeded(91 + f * 17);
      radial(ctx, 70, 36, 36, [
        [0, 'rgba(230,250,255,1)'],
        [0.35, 'rgba(90,180,255,0.85)'],
        [1, 'rgba(40,90,255,0)'],
      ]);
      ctx.lineCap = 'round';
      for (const [w, col] of [
        [6, 'rgba(60,150,255,0.6)'],
        [2.5, 'rgba(225,248,255,1)'],
      ] as Array<[number, string]>) {
        ctx.lineWidth = w;
        ctx.strokeStyle = col;
        const r2 = seeded(7 + f * 31);
        for (let k = 0; k < 5; k += 1) {
          const a = (k / 5) * TAU + f;
          bolt(ctx, 70, 36, 70 + Math.cos(a) * 34, 36 + Math.sin(a) * 30, 12, r2);
        }
        bolt(ctx, 70, 36, 4, 36 + (rnd() - 0.5) * 20, 16, r2);
      }
    });
  }
  // Chris's playing card.
  canvasTexture(scene, 'fx_card', 28, 38, (ctx) => {
    ctx.fillStyle = '#fdfaf2';
    ctx.strokeStyle = '#1b1b24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(1, 1, 26, 36, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#b8323f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(5, 5, 18, 28);
    ctx.fillStyle = '#c62a3a';
    ctx.beginPath();
    ctx.moveTo(14, 11);
    ctx.lineTo(20, 19);
    ctx.lineTo(14, 27);
    ctx.lineTo(8, 19);
    ctx.closePath();
    ctx.fill();
  });
  // The Leader's golden wave.
  canvasTexture(scene, 'fx_wave', 110, 90, (ctx) => {
    radial(ctx, 70, 45, 45, [
      [0, 'rgba(255,240,180,0.95)'],
      [0.4, 'rgba(255,190,60,0.7)'],
      [1, 'rgba(255,120,0,0)'],
    ]);
    ctx.strokeStyle = 'rgba(255,236,150,1)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(40, 45, 42, -1.1, 1.1);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,170,40,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(26, 45, 40, -1.0, 1.0);
    ctx.stroke();
  });
  // The Leader's crew charging in: a row of silhouettes rimmed in gold.
  canvasTexture(scene, 'fx_crew', 160, 220, (ctx) => {
    const rnd = seeded(2024);
    const people = [
      { x: 30, s: 0.82 },
      { x: 128, s: 0.86 },
      { x: 58, s: 0.95 },
      { x: 104, s: 0.98 },
      { x: 80, s: 1.05 },
    ];
    for (const p of people) {
      const h = 190 * p.s;
      const top = 216 - h;
      ctx.save();
      ctx.shadowColor = 'rgba(255,190,60,0.9)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#16100a';
      ctx.beginPath();
      ctx.arc(p.x, top + 16 * p.s, 15 * p.s, 0, TAU); // head
      ctx.fill();
      ctx.beginPath(); // body leaning forward
      ctx.moveTo(p.x - 18 * p.s, top + 34 * p.s);
      ctx.lineTo(p.x + 20 * p.s, top + 34 * p.s);
      ctx.lineTo(p.x + 16 * p.s, top + 110 * p.s);
      ctx.lineTo(p.x - 14 * p.s, top + 110 * p.s);
      ctx.closePath();
      ctx.fill();
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#16100a';
      ctx.lineWidth = 11 * p.s;
      const up = rnd() < 0.5;
      ctx.beginPath(); // arms: one raised, one forward
      ctx.moveTo(p.x + 10 * p.s, top + 42 * p.s);
      ctx.lineTo(p.x + (up ? 24 : 40) * p.s, top + (up ? 0 : 50) * p.s);
      ctx.moveTo(p.x - 10 * p.s, top + 42 * p.s);
      ctx.lineTo(p.x - 30 * p.s, top + 76 * p.s);
      ctx.stroke();
      ctx.lineWidth = 13 * p.s;
      ctx.beginPath(); // legs mid-stride
      ctx.moveTo(p.x, top + 106 * p.s);
      ctx.lineTo(p.x + 26 * p.s, top + 150 * p.s);
      ctx.lineTo(p.x + 22 * p.s, 214);
      ctx.moveTo(p.x, top + 106 * p.s);
      ctx.lineTo(p.x - 22 * p.s, top + 160 * p.s);
      ctx.lineTo(p.x - 34 * p.s, 210);
      ctx.stroke();
      ctx.restore();
    }
  });
  // Malcolm's squad: helmeted silhouettes at the ready, rimmed in electric blue.
  canvasTexture(scene, 'fx_squad', 170, 220, (ctx) => {
    const people = [
      { x: 34, s: 0.84 },
      { x: 132, s: 0.88 },
      { x: 84, s: 1.04 },
    ];
    for (const p of people) {
      const top = 216 - 190 * p.s;
      ctx.save();
      ctx.shadowColor = 'rgba(70,160,255,0.95)';
      ctx.shadowBlur = 9;
      ctx.fillStyle = '#070b14';
      ctx.strokeStyle = '#070b14';
      ctx.beginPath(); // helmet with a brim
      ctx.ellipse(p.x, top + 16 * p.s, 17 * p.s, 14 * p.s, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(p.x - 19 * p.s, top + 14 * p.s, 38 * p.s, 6 * p.s);
      ctx.beginPath(); // head
      ctx.arc(p.x + 2 * p.s, top + 26 * p.s, 11 * p.s, 0, TAU);
      ctx.fill();
      ctx.beginPath(); // vest
      ctx.moveTo(p.x - 20 * p.s, top + 38 * p.s);
      ctx.lineTo(p.x + 22 * p.s, top + 38 * p.s);
      ctx.lineTo(p.x + 18 * p.s, top + 112 * p.s);
      ctx.lineTo(p.x - 16 * p.s, top + 112 * p.s);
      ctx.closePath();
      ctx.fill();
      ctx.lineCap = 'round';
      ctx.lineWidth = 10 * p.s;
      ctx.beginPath(); // arms forward at the ready
      ctx.moveTo(p.x + 12 * p.s, top + 46 * p.s);
      ctx.lineTo(p.x + 38 * p.s, top + 66 * p.s);
      ctx.moveTo(p.x - 8 * p.s, top + 48 * p.s);
      ctx.lineTo(p.x + 22 * p.s, top + 72 * p.s);
      ctx.stroke();
      ctx.lineWidth = 6 * p.s; // a shield held in front
      ctx.fillRect(p.x + 30 * p.s, top + 40 * p.s, 10 * p.s, 64 * p.s);
      ctx.lineWidth = 13 * p.s;
      ctx.beginPath(); // legs braced
      ctx.moveTo(p.x, top + 108 * p.s);
      ctx.lineTo(p.x + 20 * p.s, top + 156 * p.s);
      ctx.lineTo(p.x + 22 * p.s, 214);
      ctx.moveTo(p.x, top + 108 * p.s);
      ctx.lineTo(p.x - 18 * p.s, top + 160 * p.s);
      ctx.lineTo(p.x - 26 * p.s, 212);
      ctx.stroke();
      ctx.restore();
    }
  });
  // The dropship that passes over Malcolm's super: a dark hull with blue engine glow.
  canvasTexture(scene, 'fx_dropship', 420, 130, (ctx) => {
    ctx.save();
    ctx.shadowColor = 'rgba(70,160,255,0.8)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#0a0f1c';
    ctx.beginPath(); // hull
    ctx.moveTo(10, 70);
    ctx.lineTo(120, 44);
    ctx.lineTo(330, 40);
    ctx.lineTo(410, 62);
    ctx.lineTo(330, 84);
    ctx.lineTo(120, 88);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); // wings
    ctx.moveTo(150, 60);
    ctx.lineTo(250, 6);
    ctx.lineTo(300, 6);
    ctx.lineTo(260, 60);
    ctx.moveTo(150, 74);
    ctx.lineTo(240, 124);
    ctx.lineTo(292, 124);
    ctx.lineTo(262, 74);
    ctx.fill();
    ctx.restore();
    for (const [x, y] of [[18, 70], [276, 10], [270, 120]]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
      g.addColorStop(0, 'rgba(160,220,255,1)');
      g.addColorStop(1, 'rgba(40,120,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 16, y - 16, 32, 32);
    }
  });
  // A golden crown for the Leader's super.
  canvasTexture(scene, 'fx_crown', 200, 140, (ctx) => {
    const g = ctx.createLinearGradient(0, 10, 0, 130);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(0.5, '#ffc83d');
    g.addColorStop(1, '#b8740e');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#5a3200';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(20, 120);
    ctx.lineTo(10, 40);
    ctx.lineTo(55, 80);
    ctx.lineTo(100, 12);
    ctx.lineTo(145, 80);
    ctx.lineTo(190, 40);
    ctx.lineTo(180, 120);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(20, 112, 160, 20);
    ctx.strokeRect(20, 112, 160, 20);
    for (const [x, y, c] of [
      [100, 60, '#d6283a'],
      [55, 98, '#2f7bff'],
      [145, 98, '#2f7bff'],
      [100, 122, '#d6283a'],
    ] as Array<[number, number, string]>) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, TAU);
      ctx.fill();
    }
    for (const [x, y] of [
      [10, 40],
      [100, 12],
      [190, 40],
    ]) {
      ctx.fillStyle = '#fff6c8';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, TAU);
      ctx.fill();
    }
  });
  // A glowing world globe for Chris's super.
  canvasTexture(scene, 'fx_globe', 256, 256, (ctx) => {
    radial(ctx, 128, 128, 128, [
      [0, 'rgba(120,200,255,0.9)'],
      [0.62, 'rgba(30,90,200,0.75)'],
      [0.8, 'rgba(20,50,140,0.55)'],
      [1, 'rgba(10,30,90,0)'],
    ]);
    ctx.save();
    ctx.beginPath();
    ctx.arc(128, 128, 100, 0, TAU);
    ctx.clip();
    const rnd = seeded(77);
    ctx.fillStyle = 'rgba(255,205,90,0.75)';
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      ctx.ellipse(40 + rnd() * 176, 50 + rnd() * 156, 14 + rnd() * 30, 8 + rnd() * 22, rnd() * 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(190,230,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(128, 128, 100, 0, TAU);
    ctx.stroke();
    for (const k of [0.35, 0.7]) {
      ctx.beginPath();
      ctx.ellipse(128, 128, 100 * k, 100, 0, 0, TAU);
      ctx.stroke();
    }
    for (const y of [-55, 0, 55]) {
      ctx.beginPath();
      ctx.ellipse(128, 128 + y, Math.sqrt(100 * 100 - y * y), 10, 0, 0, TAU);
      ctx.stroke();
    }
  });
  // Vertical lightning strikes for the Rogue's super.
  for (let f = 0; f < 3; f += 1) {
    canvasTexture(scene, `fx_strike${f}`, 90, 560, (ctx) => {
      const rnd = seeded(500 + f * 13);
      const x0 = 45 + (rnd() - 0.5) * 20;
      const x1 = 45 + (rnd() - 0.5) * 20;
      ctx.lineCap = 'round';
      for (const [w, col] of [
        [14, 'rgba(60,140,255,0.35)'],
        [6, 'rgba(120,200,255,0.9)'],
        [2.5, 'rgba(240,252,255,1)'],
      ] as Array<[number, string]>) {
        ctx.lineWidth = w;
        ctx.strokeStyle = col;
        bolt(ctx, x0, 0, x1, 560, 50, seeded(900 + f * 7));
      }
    });
  }
  // The Jetsetter's spinning record.
  canvasTexture(scene, 'fx_disc', 72, 72, (ctx) => {
    ctx.fillStyle = '#0c0c12';
    ctx.beginPath();
    ctx.arc(36, 36, 34, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let r = 14; r < 33; r += 3) {
      ctx.beginPath();
      ctx.arc(36, 36, r, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,230,150,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(36, 36, 28, -0.9, -0.2);
    ctx.stroke();
    ctx.fillStyle = '#f2b632';
    ctx.beginPath();
    ctx.arc(36, 36, 12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7a4a10';
    ctx.fillRect(30, 34, 12, 2);
    ctx.fillStyle = '#0c0c12';
    ctx.beginPath();
    ctx.arc(36, 36, 2.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffd86b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(36, 36, 34, 0, TAU);
    ctx.stroke();
  });
}

export class Effects {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
  ) {}

  private add<T extends Phaser.GameObjects.GameObject>(obj: T, depth: number): T {
    (obj as unknown as Phaser.GameObjects.Components.Depth).setDepth(depth);
    this.layer.add(obj);
    return obj;
  }

  /** A hit: a flash star, streaks flying out along `dir`, and a ring for big hits. */
  hit(x: number, y: number, dir: number, power: number, color: number, counter: boolean): void {
    const big = power >= 10;
    const size = 0.35 + power * 0.045;
    const star = this.add(this.scene.add.image(x, y, 'fx_star').setBlendMode(Phaser.BlendModes.ADD).setTint(color), 60);
    star.setScale(size * 0.4).setAngle(Math.random() * 45);
    this.scene.tweens.add({ targets: star, scale: size * 1.25, alpha: 0, duration: big ? 200 : 140, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
    const core = this.add(this.scene.add.image(x, y, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setScale(size * 1.4), 61);
    this.scene.tweens.add({ targets: core, alpha: 0, scale: size * 2, duration: 160, onComplete: () => core.destroy() });
    const n = big ? 11 : 7;
    for (let i = 0; i < n; i += 1) {
      const a = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 2.2;
      const len = (big ? 90 : 60) + Math.random() * 60;
      const s = this.add(
        this.scene.add.image(x, y, 'fx_streak').setBlendMode(Phaser.BlendModes.ADD).setTint(i % 3 === 0 ? 0xffffff : color),
        62,
      );
      s.setRotation(a).setScale(0.5 + Math.random() * 0.7, 0.8);
      this.scene.tweens.add({
        targets: s,
        x: x + Math.cos(a) * len,
        y: y + Math.sin(a) * len,
        scaleX: 0.1,
        alpha: 0,
        duration: 170 + Math.random() * 90,
        ease: 'Cubic.easeOut',
        onComplete: () => s.destroy(),
      });
    }
    if (big || counter) this.ring(x, y, counter ? 0xff4040 : color, size * 1.4);
  }

  /**
   * The attacker's signature on a hit, on top of the spark: lightning forks, spinning records,
   * flying cards, gold sparks with a crown flicker, or rock chunks and dust.
   */
  themed(style: HitStyle, x: number, y: number, dir: number, power: number): void {
    const s = this.scene;
    const n = power >= 10 ? 5 : 3;
    if (style === 'tactical') {
      // Tracer rounds: hot blue streaks spraying back from the impact, and a shield-hex flash.
      for (let i = 0; i < n + 2; i += 1) {
        const a = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.2;
        const t = this.add(s.add.image(x, y, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(i % 2 ? 0x7fc8ff : 0xe8f6ff), 63);
        t.setScale(0.5 + Math.random() * 0.3, 0.05).setRotation(a);
        const len = 90 + Math.random() * 90 + power * 4;
        s.tweens.add({ targets: t, x: x + Math.cos(a) * len, y: y + Math.sin(a) * len, alpha: 0, duration: 160 + Math.random() * 120, onComplete: () => t.destroy() });
      }
      if (power >= 10) {
        const h = this.add(s.add.image(x, y, 'fx_hex').setBlendMode(Phaser.BlendModes.ADD).setTint(0x4aa8ff).setScale(0.6).setAlpha(0.8), 62);
        s.tweens.add({ targets: h, scale: 1.3, alpha: 0, duration: 260, onComplete: () => h.destroy() });
      }
      return;
    }
    if (style === 'volt') {
      for (let i = 0; i < n; i += 1) {
        const b = this.add(s.add.image(x + (Math.random() - 0.5) * 30, y, `fx_strike${i % 3}`).setBlendMode(Phaser.BlendModes.ADD), 63);
        b.setOrigin(0.5, 0.5).setScale(0.18 + Math.random() * 0.12, 0.22 + power * 0.012).setRotation(dir * (0.9 + Math.random() * 1.2)).setTint(0x9fe8ff);
        s.tweens.add({ targets: b, alpha: 0, duration: 120 + i * 30, onComplete: () => b.destroy() });
      }
      return;
    }
    const key = style === 'vinyl' ? 'fx_disc' : style === 'cards' ? 'fx_card' : style === 'quake' ? 'fx_rock' : 'fx_glow';
    for (let i = 0; i < n + 1; i += 1) {
      const a = (dir > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 2.4 - (style === 'quake' ? 0.6 * dir : 0);
      const p = this.add(s.add.image(x, y, key), 63);
      if (style === 'vinyl') p.setScale(0.32);
      else if (style === 'cards') p.setScale(0.9).setRotation(Math.random() * 6);
      else if (style === 'quake') p.setScale(0.9 + Math.random() * 0.8);
      else p.setScale(0.12 + Math.random() * 0.1).setTint(Math.random() < 0.5 ? 0xffc23d : 0xfff2b0).setBlendMode(Phaser.BlendModes.ADD);
      const len = 70 + Math.random() * 80 + power * 3;
      s.tweens.add({
        targets: p,
        x: x + Math.cos(a) * len,
        y: y + Math.sin(a) * len + (style === 'quake' ? 60 : 0),
        rotation: p.rotation + dir * (4 + Math.random() * 6),
        alpha: 0,
        duration: 260 + Math.random() * 160,
        ease: style === 'quake' ? 'Quad.easeIn' : 'Cubic.easeOut',
        onComplete: () => p.destroy(),
      });
    }
    if (style === 'crown' && power >= 10) {
      const c = this.add(s.add.image(x, y - 30, 'fx_crown').setScale(0.12).setAlpha(0.95), 64);
      s.tweens.add({ targets: c, y: y - 90, scale: 0.22, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
    }
    if (style === 'quake') this.dust(x, y + 40, power >= 10 ? 6 : 3, 90);
  }

  /** Malcolm's Gear Up: a squad drops in at range, holds a beat, and pulls out. */
  breach(x: number, groundY: number, facing: number): void {
    const s = this.scene;
    const sq = this.add(s.add.image(x, groundY + 4, 'fx_squad').setOrigin(0.5, 1).setScale(1.15).setFlipX(facing < 0).setAlpha(0), 46);
    const flash = this.add(s.add.image(x, groundY - 100, 'fx_glow').setTint(0x4aa8ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4, 1.6).setAlpha(0.9), 45);
    s.tweens.add({ targets: sq, alpha: 1, duration: 90 });
    s.tweens.add({ targets: sq, alpha: 0, x: x - facing * 30, delay: 420, duration: 260, onComplete: () => sq.destroy() });
    s.tweens.add({ targets: flash, scaleX: 2.2, alpha: 0, duration: 320, onComplete: () => flash.destroy() });
    this.dust(x, groundY, 5, 80);
  }

  /** A blocked hit: a shield flash in the defender's colour and a few sparks. */
  block(x: number, y: number, dir: number, color = 0x9fe6ff): void {
    const h = this.add(this.scene.add.image(x - dir * 6, y, 'fx_hex').setBlendMode(Phaser.BlendModes.ADD).setTint(color), 60);
    h.setScale(0.55, 0.75);
    this.scene.tweens.add({ targets: h, scaleX: 0.75, scaleY: 0.95, alpha: 0, duration: 180, onComplete: () => h.destroy() });
    for (let i = 0; i < 5; i += 1) {
      const a = (dir > 0 ? Math.PI : 0) + (Math.random() - 0.5) * 1.6;
      const s = this.add(this.scene.add.image(x, y, 'fx_streak').setBlendMode(Phaser.BlendModes.ADD).setTint(color), 62);
      s.setRotation(a).setScale(0.45, 0.6);
      this.scene.tweens.add({ targets: s, x: x + Math.cos(a) * 50, y: y + Math.sin(a) * 50, alpha: 0, duration: 160, onComplete: () => s.destroy() });
    }
  }

  ring(x: number, y: number, color: number, scale = 1): void {
    const r = this.add(this.scene.add.image(x, y, 'fx_ring').setBlendMode(Phaser.BlendModes.ADD).setTint(color), 59);
    r.setScale(scale * 0.2);
    this.scene.tweens.add({ targets: r, scale: scale, alpha: 0, duration: 280, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
  }

  /** Dust kicked up at floor level. */
  dust(x: number, y: number, amount: number, spread = 60): void {
    for (let i = 0; i < amount; i += 1) {
      const d = this.add(this.scene.add.image(x + (Math.random() - 0.5) * spread * 0.4, y - 6, 'fx_dust'), 20);
      const side = Math.random() < 0.5 ? -1 : 1;
      d.setScale(0.5 + Math.random() * 0.5).setAlpha(0.8);
      this.scene.tweens.add({
        targets: d,
        x: d.x + side * (spread * (0.4 + Math.random() * 0.8)),
        y: d.y - 10 - Math.random() * 26,
        scale: d.scale * 2.2,
        alpha: 0,
        duration: 420 + Math.random() * 300,
        ease: 'Quad.easeOut',
        onComplete: () => d.destroy(),
      });
    }
  }

  /** A fading silhouette copy of a sprite (dashes and supers). */
  afterimage(src: Phaser.GameObjects.Image, color: number, alpha = 0.45, ms = 260): void {
    const g = this.add(this.scene.add.image(src.x, src.y, src.texture.key, src.frame.name), 25);
    g.setOrigin(src.originX, src.originY).setScale(src.scaleX, src.scaleY).setFlipX(src.flipX).setRotation(src.rotation);
    g.setTintFill(color).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: ms, onComplete: () => g.destroy() });
  }

  /** Small sparks trailing a projectile. */
  trail(x: number, y: number, color: number): void {
    const p = this.add(this.scene.add.image(x, y, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(color), 40);
    p.setScale(0.18 + Math.random() * 0.12);
    this.scene.tweens.add({ targets: p, alpha: 0, scale: 0.02, y: y + (Math.random() - 0.5) * 24, duration: 260, onComplete: () => p.destroy() });
  }

  /** Text that pops near a fighter ("COUNTER"). */
  popText(x: number, y: number, text: string, color: string): void {
    const t = this.add(
      this.scene.add
        .text(x, y, text, { fontFamily: '"Bungee", Impact, sans-serif', fontSize: '26px', color, stroke: '#000000', strokeThickness: 6 })
        .setOrigin(0.5),
      80,
    );
    t.setScale(0.6);
    this.scene.tweens.add({ targets: t, scale: 1, y: y - 30, duration: 160, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: 550, duration: 250, onComplete: () => t.destroy() });
  }
}
