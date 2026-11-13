// A companion that rides a fighter's shoulder: Quincy's cat. Presentation only (the sim never sees
// it). Each frame it is told where the host sprite is and which atlas frame it shows; the per-frame
// shoulder points come from scripts/shoulder-anchors.py. It follows with a little lag, hisses when
// the host is hit, leaps off when he is knocked down and hops back when he is up, and cheers on a
// super or a win.
import Phaser from 'phaser';
import { sfx } from './audio';

export type Anchors = Record<string, [number, number]>;

/** The host, as drawn this frame. */
export interface Host {
  sprite: Phaser.GameObjects.Image;
  /** Atlas frame name, e.g. "idle/03". */
  frame: string;
  facing: number;
  /** The host's art: cell size and feet point (anchors are in cell pixels). */
  feetX: number;
  feetY: number;
  scale: number;
  /** Where the floor is under him (world y), for jumping off. */
  floorY: number;
}

type Mode = 'ride' | 'leap' | 'ground' | 'return';

/** How big the cat is drawn (the sheets are 64 px). */
const CAT_SCALE = 0.95;

export class Companion {
  readonly sprite: Phaser.GameObjects.Sprite;
  private mode: Mode = 'ride';
  private x = 0;
  private y = 0;
  private placed = false;

  /** The fight's draw scale for the host: in menus the cat grows with a bigger preview sprite. */
  hostScale = 1.3;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly anchors: Anchors,
    depth: number,
    layer?: Phaser.GameObjects.Layer,
  ) {
    this.sprite = scene.add.sprite(0, 0, 'px_cat_idle').setOrigin(0.5, 0.94).setScale(CAT_SCALE).setDepth(depth);
    this.sprite.play('px_cat_idle');
    layer?.add(this.sprite);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.sprite.active) this.sprite.play('px_cat_idle');
    });
  }

  /** The shoulder point in world space for the host's current frame. */
  private shoulder(h: Host): { x: number; y: number } {
    const a = this.anchors[h.frame] ?? this.anchors['idle/00'] ?? [h.feetX, h.feetY - 160];
    return { x: h.sprite.x + (a[0] - h.feetX) * h.scale * h.facing, y: h.sprite.y + (a[1] - h.feetY) * h.scale + 4 };
  }

  /** Follow the host this frame (riding, or waiting on the floor). */
  update(h: Host): void {
    const s = this.shoulder(h);
    this.sprite.setFlipX(h.facing < 0);
    if (!this.placed) {
      this.x = s.x;
      this.y = s.y;
      this.placed = true;
    }
    if (this.mode === 'ride') {
      // A little lag, so it sways with him instead of being glued on.
      this.x += (s.x - this.x) * 0.55;
      this.y += (s.y - this.y) * 0.55;
      this.sprite.setPosition(Math.round(this.x), Math.round(this.y));
    }
  }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v);
  }

  /** The host got hit: a quick hiss (if it is riding). */
  hiss(): void {
    if (this.mode !== 'ride' || this.sprite.anims.currentAnim?.key === 'px_cat_hiss') return;
    this.sprite.play('px_cat_hiss');
  }

  /** A super or a win: paw up, meow. */
  cheer(volume = 0.7): void {
    this.sprite.play('px_cat_cheer');
    sfx(this.scene, 'meow', volume);
  }

  /** The host is going down: jump clear and sit on the floor behind him. */
  leap(h: Host): void {
    if (this.mode !== 'ride') return;
    this.mode = 'leap';
    const tx = h.sprite.x - h.facing * 80;
    const ty = h.floorY;
    this.sprite.play('px_cat_hiss');
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    const arc = { t: 0 };
    this.scene.tweens.add({
      targets: arc,
      t: 1,
      duration: 380,
      onUpdate: () => {
        const p = arc.t;
        this.sprite.setPosition(sx + (tx - sx) * p, sy + (ty - sy) * p - Math.sin(p * Math.PI) * 70);
      },
      onComplete: () => {
        this.mode = 'ground';
        this.x = tx;
        this.y = ty;
      },
    });
  }

  /** The host is back up: hop back onto the shoulder. */
  hopBack(h: Host): void {
    if (this.mode !== 'ground') return;
    this.mode = 'return';
    const sx = this.sprite.x;
    const sy = this.sprite.y;
    const arc = { t: 0 };
    this.scene.tweens.add({
      targets: arc,
      t: 1,
      duration: 320,
      onUpdate: () => {
        const s = this.shoulder(h);
        const p = arc.t;
        this.sprite.setPosition(sx + (s.x - sx) * p, sy + (s.y - sy) * p - Math.sin(p * Math.PI) * 60);
      },
      onComplete: () => {
        this.mode = 'ride';
        const s = this.shoulder(h);
        this.x = s.x;
        this.y = s.y;
      },
    });
  }

  get anchorsFor(): Anchors {
    return this.anchors;
  }

  get riding(): boolean {
    return this.mode === 'ride';
  }

  get grounded(): boolean {
    return this.mode === 'ground';
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

/**
 * Menus: keep a companion on a hero's preview sprite, creating or removing it as the hero changes.
 * Call every frame with the sprite's current frame name; returns the companion (or null).
 */
export function menuPet(
  scene: Phaser.Scene,
  current: Companion | null,
  art: { anchors?: Anchors; feetX: number; feetY: number },
  sprite: Phaser.GameObjects.Image,
  frame: string,
  facing: number,
): Companion | null {
  if (!art.anchors || !sprite.visible) {
    current?.destroy();
    return null;
  }
  const pet = current && current.anchorsFor === art.anchors ? current : (current?.destroy(), new Companion(scene, art.anchors, sprite.depth + 0.5));
  pet.sprite.setScale(CAT_SCALE * (sprite.scaleY / Math.max(0.01, pet.hostScale)));
  pet.update({ sprite, frame, facing, feetX: art.feetX, feetY: art.feetY, scale: sprite.scaleY, floorY: sprite.y });
  pet.sprite.setAlpha(sprite.alpha).setDepth(sprite.depth + 0.5);
  return pet;
}
