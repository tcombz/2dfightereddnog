import Phaser from 'phaser';
import { HEROES } from '../../sim';
import { ensureMusic, sfx, stopMusic } from '../audio';
import { CSS, VIEW_H, VIEW_W } from '../config';
import type { MatchSetup } from '../config';
import { artFor, feetOrigin, frameName, menuScale } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { STAGES } from '../stages';
import { body, display, goTo, goldFill, stripes } from '../ui';

/** The split-screen VS splash shown while the stage music loads. */
export class VersusScene extends Phaser.Scene {
  constructor() {
    super('versus');
  }

  create(setup: MatchSetup): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.cameras.main.fadeIn(200, 255, 255, 255);
    stopMusic(this, 400);
    const stage = STAGES[setup.stage];

    const g = this.add.graphics();
    g.fillStyle(0x0b1530, 1).fillRect(0, 0, VIEW_W, VIEW_H);
    // Two halves split by a slanted line.
    g.fillStyle(0x0d2a66, 1).fillPoints([{ x: 0, y: 0 }, { x: VIEW_W / 2 + 70, y: 0 }, { x: VIEW_W / 2 - 70, y: VIEW_H }, { x: 0, y: VIEW_H }], true);
    g.fillStyle(0x4a1e0c, 1).fillPoints([{ x: VIEW_W / 2 + 70, y: 0 }, { x: VIEW_W, y: 0 }, { x: VIEW_W, y: VIEW_H }, { x: VIEW_W / 2 - 70, y: VIEW_H }], true);
    stripes(g, 0, 0, VIEW_W, VIEW_H, 0xffffff, 0.035);
    g.lineStyle(6, 0xffffff, 0.9).lineBetween(VIEW_W / 2 + 70, 0, VIEW_W / 2 - 70, VIEW_H);

    [setup.p1, setup.p2].forEach((hero, i) => {
      const art = artFor(hero);
      const info = heroInfo(HEROES[hero].id);
      const fromX = i === 0 ? -260 : VIEW_W + 260;
      const toX = i === 0 ? 250 : VIEW_W - 250;
      const id = HEROES[hero].id;
      if (this.textures.exists(`sheet_${id}`)) {
        // The illustrated portrait from the character sheet, big.
        const art2 = this.add.image(fromX, VIEW_H / 2 + 20, `sheet_${id}`).setFlipX(i === 1);
        art2.setScale((VIEW_H - 60) / art2.height);
        this.tweens.add({ targets: art2, x: toX, duration: 380, ease: 'Cubic.easeOut', delay: i * 120 });
      } else {
        const sprite = this.add
          .image(fromX, VIEW_H + 40, art.key, frameName('win', art.win[Math.min(2, art.win.length - 1)]))
          .setOrigin(...feetOrigin(art, i === 1))
          .setScale(menuScale(art, 3.2))
          .setFlipX(i === 1);
        this.tweens.add({ targets: sprite, x: toX, duration: 380, ease: 'Cubic.easeOut', delay: i * 120 });
      }
      const name = this.add
        .text(i === 0 ? 30 : VIEW_W - 30, i === 0 ? 40 : VIEW_H - 92, info.title, display(info.title.length > 14 ? 30 : 40, '#ffffff', 8))
        .setOrigin(i === 0 ? 0 : 1, 0)
        .setAlpha(0);
      goldFill(name);
      const tag = this.add
        .text(i === 0 ? 32 : VIEW_W - 32, i === 0 ? 92 : VIEW_H - 40, `"${info.tagline}"`, body(17, i === 0 ? '#bcd6ff' : '#ffd8bc'))
        .setOrigin(i === 0 ? 0 : 1, 0)
        .setAlpha(0);
      this.tweens.add({ targets: [name, tag], alpha: 1, duration: 300, delay: 300 + i * 120 });
    });

    const vs = this.add.text(VIEW_W / 2, VIEW_H / 2, 'VS', display(120, '#ffffff', 12)).setOrigin(0.5).setScale(3).setAlpha(0);
    goldFill(vs);
    this.tweens.add({
      targets: vs,
      scale: 1,
      alpha: 1,
      duration: 260,
      delay: 450,
      ease: 'Back.easeOut',
      onStart: () => sfx(this, 'round', 0.9),
      onComplete: () => this.cameras.main.shake(180, 0.008),
    });
    if (setup.arcade) {
      const run = setup.arcade;
      const last = run.fight === run.order.length - 1;
      const label = last ? 'FINAL FIGHT' : `FIGHT ${run.fight + 1} OF ${run.order.length}`;
      this.add
        .text(VIEW_W / 2, VIEW_H / 2 + 86, label, display(22, last ? '#ffd27a' : '#ffffff', 5))
        .setOrigin(0.5)
        .setBackgroundColor('#00000088')
        .setPadding(12, 4, 12, 4);
    }
    this.add
      .text(VIEW_W / 2, VIEW_H - 14, `${stage.name}  ·  ${stage.place}`, display(14, CSS.ink, 4))
      .setOrigin(0.5, 1)
      .setBackgroundColor('#00000088')
      .setPadding(10, 4, 10, 4);

    // Load the stage's music in the background; leave once both it and the splash are done.
    let loaded = false;
    let shown = false;
    const go = (): void => {
      if (loaded && shown) goTo(this, 'fight', setup, 250);
    };
    ensureMusic(this, stage.music, () => {
      loaded = true;
      go();
    });
    this.time.delayedCall(2600, () => {
      shown = true;
      go();
    });
  }
}
