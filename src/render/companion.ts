// A fighter's companion: Quincy's cat. Presentation only (the sim never sees it). In a fight it sits
// in the background of the stage, on the back of the floor on its owner's side, and reacts: it
// hisses when its owner is knocked down and paws up with a meow on his super and his wins. In the
// menus it sits on the floor beside him.
import Phaser from 'phaser';
import { sfx } from './audio';

/** How big the cat is drawn at a fighter's draw scale (the sheets are 64 px). */
const CAT_SCALE = 1.1;
/** In the fight it sits further back: a little smaller and in the stage's shade. */
const STAGE_SCALE = 1.0;
const STAGE_TINT = 0xb8b0d0;

export class Companion {
  readonly sprite: Phaser.GameObjects.Sprite;

  constructor(
    private readonly scene: Phaser.Scene,
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

  /** Sit in the stage background at a world point (its feet), facing the middle of the stage. */
  sitInStage(x: number, floorY: number, faceRight: boolean): this {
    this.sprite.setPosition(x, floorY).setScale(STAGE_SCALE).setTint(STAGE_TINT).setFlipX(!faceRight);
    return this;
  }

  /** Its owner was knocked down: a hiss (if it is not mid-cheer). */
  hiss(): void {
    if (this.sprite.anims.currentAnim?.key === 'px_cat_cheer' && this.sprite.anims.isPlaying) return;
    this.sprite.play('px_cat_hiss');
  }

  /** A super or a win: paw up, meow. */
  cheer(volume = 0.7): void {
    this.sprite.play('px_cat_cheer');
    sfx(this.scene, 'meow', volume);
  }

  destroy(): void {
    this.sprite.destroy();
  }
}

/**
 * Menus: keep the cat sitting on the floor beside a hero's preview sprite (in front of him),
 * creating or removing it as the hero changes. Call every frame; returns the companion (or null).
 */
export function menuPet(
  scene: Phaser.Scene,
  current: Companion | null,
  art: { companion?: boolean; scale: number },
  sprite: Phaser.GameObjects.Image,
  facing: number,
): Companion | null {
  if (!art.companion || !sprite.visible) {
    current?.destroy();
    return null;
  }
  const pet = current ?? new Companion(scene, sprite.depth - 0.5);
  // Previews are drawn bigger than in a fight: the cat grows with them. It sits in front of him.
  const k = sprite.scaleY / art.scale;
  pet.sprite
    .setScale(CAT_SCALE * k)
    .setPosition(sprite.x + facing * 78 * k, sprite.y)
    .setFlipX(facing < 0)
    .setAlpha(sprite.alpha)
    .setDepth(sprite.depth - 0.5);
  return pet;
}
