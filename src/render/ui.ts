// Shared menu pieces: text styles, a vertical menu, scene transitions and a moving backdrop.
import Phaser from 'phaser';
import { sfx } from './audio';
import { C, CSS, FONT_BODY, FONT_DISPLAY, VIEW_H, VIEW_W } from './config';

export function display(size: number, color: string = CSS.ink, stroke = 6): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT_DISPLAY, fontSize: `${size}px`, color, stroke: '#05060c', strokeThickness: stroke };
}

export function body(size: number, color: string = CSS.ink): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: FONT_BODY, fontSize: `${size}px`, color, fontStyle: '600' };
}

/** Gold-to-amber gradient fill for big titles. */
export function goldFill(text: Phaser.GameObjects.Text, top = '#fff2b0', bottom = '#ff9f1c'): void {
  const g = text.context.createLinearGradient(0, 0, 0, text.height);
  g.addColorStop(0, top);
  g.addColorStop(0.55, '#ffc93d');
  g.addColorStop(1, bottom);
  text.setFill(g);
}

export interface MenuItem {
  label: string;
  /** Shown at the right of the row, e.g. a setting's value. */
  value?: () => string;
  onSelect?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
}

/** A vertical list driven by up/down/left/right/confirm, highlighted with a slanted bar. */
export class Menu {
  index = 0;
  private readonly rows: Phaser.GameObjects.Text[] = [];
  private readonly values: Phaser.GameObjects.Text[] = [];
  private readonly bar: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    private readonly items: MenuItem[],
    private readonly width = 340,
    private readonly rowH = 46,
    fontSize = 24,
  ) {
    this.bar = scene.add.graphics();
    items.forEach((it, i) => {
      this.rows.push(scene.add.text(x + 26, y + i * rowH, it.label, display(fontSize, CSS.ink, 5)).setOrigin(0, 0.5));
      this.values.push(scene.add.text(x + width - 18, y + i * rowH, '', body(fontSize - 4, CSS.gold)).setOrigin(1, 0.5));
    });
    this.redraw();
  }

  get objects(): Phaser.GameObjects.GameObject[] {
    return [this.bar, ...this.rows, ...this.values];
  }

  setVisible(v: boolean): void {
    for (const o of this.objects) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(v);
  }

  setDepth(d: number): void {
    for (const o of this.objects) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(d);
  }

  redraw(): void {
    this.bar.clear();
    const y = this.y + this.index * this.rowH;
    const h = this.rowH - 8;
    this.bar.fillStyle(C.gold, 1);
    this.bar.fillPoints(
      [
        { x: this.x + 12, y: y - h / 2 },
        { x: this.x + this.width, y: y - h / 2 },
        { x: this.x + this.width - 12, y: y + h / 2 },
        { x: this.x, y: y + h / 2 },
      ],
      true,
    );
    this.rows.forEach((r, i) => {
      r.setColor(i === this.index ? '#120c02' : CSS.ink).setStroke(i === this.index ? '#ffe9a8' : '#05060c', i === this.index ? 0 : 5);
      r.setX(this.x + (i === this.index ? 32 : 26));
    });
    this.values.forEach((v, i) => {
      v.setText(this.items[i].value?.() ?? '');
      v.setColor(i === this.index ? '#120c02' : CSS.gold);
    });
  }

  /** Feed one menu action; returns true if it was used. */
  handle(action: string): boolean {
    const it = this.items[this.index];
    if (action === 'up' || action === 'down') {
      this.index = (this.index + (action === 'up' ? -1 : 1) + this.items.length) % this.items.length;
      sfx(this.scene, 'ui_move', 0.8);
      this.redraw();
      return true;
    }
    if (action === 'left' && it.onLeft) {
      it.onLeft();
      sfx(this.scene, 'ui_move', 0.8);
      this.redraw();
      return true;
    }
    if (action === 'right' && it.onRight) {
      it.onRight();
      sfx(this.scene, 'ui_move', 0.8);
      this.redraw();
      return true;
    }
    if (action === 'confirm' && it.onSelect) {
      sfx(this.scene, 'ui_confirm');
      it.onSelect();
      this.redraw();
      return true;
    }
    return false;
  }
}

/** Shrink a text object (keeping its origin) so it is no wider than `max` pixels. */
export function fitText<T extends Phaser.GameObjects.Text>(t: T, max: number): T {
  t.setScale(1);
  if (t.width > max) t.setScale(max / t.width);
  return t;
}

/** Fade the camera out, then start another scene. */
export function goTo(scene: Phaser.Scene, key: string, data?: object, ms = 220): void {
  if ((scene as unknown as { leaving?: boolean }).leaving) return;
  (scene as unknown as { leaving?: boolean }).leaving = true;
  scene.cameras.main.fadeOut(ms, 5, 6, 12);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}

/** A stage picture slowly panning behind menus, darkened so text reads on top. */
export function backdrop(scene: Phaser.Scene, stageKey: string, darkness = 0.62): Phaser.GameObjects.Image {
  const img = scene.add.image(0, 0, stageKey).setOrigin(0, 0);
  const scale = VIEW_H / img.height + 0.02;
  img.setScale(scale);
  const range = Math.max(0, img.width * scale - VIEW_W);
  scene.tweens.add({ targets: img, x: -range, duration: 40000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.add.rectangle(0, 0, VIEW_W, VIEW_H, C.night, darkness).setOrigin(0, 0);
  return img;
}

/** Diagonal stripes in a colour, for character and versus screens. */
export function stripes(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha: number): void {
  g.fillStyle(color, alpha);
  for (let i = -h; i < w; i += 28) {
    g.fillPoints(
      [
        { x: x + i, y: y + h },
        { x: x + i + 12, y: y + h },
        { x: x + i + 12 + h, y },
        { x: x + i + h, y },
      ],
      true,
    );
  }
}
