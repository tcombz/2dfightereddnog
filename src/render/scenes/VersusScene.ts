import Phaser from 'phaser';
import { HEROES } from '../../sim';
import { announce, ensureMusic, sfx, stopMusic } from '../audio';
import { CSS, VIEW_H, VIEW_W } from '../config';
import type { MatchSetup } from '../config';
import { artFor, feetOrigin, frameName, menuScale } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { STAGES } from '../stages';
import { body, display, fitText, goTo, goldFill, stripes } from '../ui';

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

    const said = (h: number): string => heroInfo(HEROES[h].id).name.toLowerCase();
    const team = (i: number): string => (setup.partners ? `${said(i === 0 ? setup.p1 : setup.p2)} and ${said(setup.partners[i])}` : said(i === 0 ? setup.p1 : setup.p2));
    announce(`${team(0)}. Versus. ${team(1)}!`);
    // Each team stands together on its own side: the partner behind, towards the edge, a shade
    // darker; the point fighter in front. Names and the team line in the corners (player 1 top
    // left, player 2 bottom right), kept clear of the fighters.
    [setup.p1, setup.p2].forEach((hero, i) => {
      const left = i === 0;
      const art = artFor(hero);
      const info = heroInfo(HEROES[hero].id);
      const id = HEROES[hero].id;
      const partner = setup.partners?.[i];
      const enter = (img: Phaser.GameObjects.Image, toX: number, delay: number): void => {
        img.setX(left ? -260 : VIEW_W + 260);
        this.tweens.add({ targets: img, x: toX, duration: 380, ease: 'Cubic.easeOut', delay });
      };
      if (partner !== undefined && this.textures.exists(`sheet_${HEROES[partner].id}`)) {
        const back = this.add.image(0, VIEW_H + 6, `sheet_${HEROES[partner].id}`).setOrigin(0.5, 1).setFlipX(!left).setTint(0x8a90b0);
        back.setScale(370 / back.height);
        enter(back, left ? 110 : VIEW_W - 110, 160 + i * 120);
      }
      if (this.textures.exists(`sheet_${id}`)) {
        const front = this.add.image(0, VIEW_H + 10, `sheet_${id}`).setOrigin(0.5, 1).setFlipX(!left);
        front.setScale(470 / front.height);
        enter(front, left ? 300 : VIEW_W - 300, i * 120);
      } else {
        const sprite = this.add
          .image(0, VIEW_H + 40, art.key, frameName('win', art.win[Math.min(2, art.win.length - 1)]))
          .setOrigin(...feetOrigin(art, !left))
          .setScale(menuScale(art, 3.2))
          .setFlipX(!left);
        enter(sprite, left ? 300 : VIEW_W - 300, i * 120);
      }
      const ax = left ? 30 : VIEW_W - 30;
      const align = left ? 0 : 1;
      const lines = this.add.container(0, 0).setAlpha(0);
      const name = this.add.text(ax, left ? 34 : VIEW_H - 96, info.title, display(info.title.length > 14 ? 30 : 38, '#ffffff', 8)).setOrigin(align, 0);
      fitText(name, VIEW_W * 0.52);
      goldFill(name);
      lines.add(name);
      if (partner !== undefined) {
        const p = heroInfo(HEROES[partner].id);
        const team = this.add
          .text(ax + (left ? 2 : -2), left ? 80 : VIEW_H - 122, `&  ${p.title}`, display(16, left ? '#bcd6ff' : '#ffd8bc', 4))
          .setOrigin(align, 0);
        fitText(team, VIEW_W * 0.48);
        lines.add(team);
      }
      const party = setup.party;
      if (party) {
        lines.add(
          this.add
            .text(ax, left ? 10 : VIEW_H - 146, party.names[party.sides[i]], display(16, left ? '#9cc3ff' : '#ffb98a', 5))
            .setOrigin(align, 0),
        );
      }
      this.tweens.add({ targets: lines, alpha: 1, duration: 300, delay: 300 + i * 120 });
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
