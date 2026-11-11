import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { HEROES, Result } from '../../sim';
import { playMusic, sfx } from '../audio';
import { C, CSS, VIEW_H, VIEW_W } from '../config';
import type { MatchSetup } from '../config';
import { artFor, frameName } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { STAGES } from '../stages';
import { Menu, body, display, goTo, goldFill, stripes } from '../ui';

interface ResultData {
  setup: MatchSetup;
  winner: number;
  wins: [number, number];
}

export class ResultScene extends Phaser.Scene {
  private menu!: Menu;
  private sprite: Phaser.GameObjects.Image | null = null;
  private hero = 0;
  private clock = 0;

  constructor() {
    super('result');
  }

  create(data: ResultData): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.clock = 0;
    this.cameras.main.fadeIn(350, 5, 6, 12);
    playMusic(this, 'menu');
    const { setup, winner } = data;
    const stage = STAGES[setup.stage];
    this.add.image(0, 0, `stage_${stage.id}`).setOrigin(0, 0).setScale(VIEW_H / 320).setAlpha(0.35);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, C.night, 0.55).setOrigin(0, 0);
    const deco = this.add.graphics();
    stripes(deco, 0, 0, VIEW_W, VIEW_H, 0xffffff, 0.03);

    if (winner === Result.Draw) {
      const t = this.add.text(VIEW_W / 2, 150, 'DRAW GAME', display(64, '#ffffff', 10)).setOrigin(0.5);
      goldFill(t);
      this.sprite = null;
    } else {
      this.hero = winner === 0 ? setup.p1 : setup.p2;
      const id = HEROES[this.hero].id;
      const info = heroInfo(id);
      const art = artFor(this.hero);
      this.sprite = this.add
        .image(250, VIEW_H - 10, art.key, frameName('win', art.win[0]))
        .setOrigin(art.feetX / art.cell, art.feetY / art.cell)
        .setScale(3);
      const who = setup.mode === 'cpu' && winner === 1 ? 'CPU' : `PLAYER ${winner + 1}`;
      this.add.text(470, 70, who, display(18, winner === 0 ? CSS.p1 : CSS.p2, 4));
      const t = this.add.text(470, 92, `${info.title} WINS`, display(42, '#ffffff', 8));
      goldFill(t);
      const quote = info.quotes[Math.floor(Math.random() * info.quotes.length)];
      const bubble = this.add.graphics();
      bubble.fillStyle(0xffffff, 0.95).fillRoundedRect(470, 160, 440, 70, 14);
      bubble.fillTriangle(470, 196, 448, 214, 486, 214);
      this.add.text(490, 195, `"${quote}"`, body(22, '#111428')).setOrigin(0, 0.5).setWordWrapWidth(400);
      sfx(this, 'crowd', 0.6);
    }
    this.add.text(470, 248, `${data.wins[0]} - ${data.wins[1]}`, display(22, CSS.muted, 4));

    this.menu = new Menu(this, 470, 310, [
      { label: 'REMATCH', onSelect: () => goTo(this, 'versus', setup) },
      { label: 'CHARACTER SELECT', onSelect: () => goTo(this, 'select', { mode: setup.mode, cpuLevel: setup.cpuLevel }) },
      { label: 'MAIN MENU', onSelect: () => goTo(this, 'title', { skipIntro: true }) },
    ]);
    controls.take();
  }

  update(_t: number, delta: number): void {
    this.clock += delta;
    if (this.sprite) {
      const art = artFor(this.hero);
      const t = Math.floor(this.clock / (1000 / 60));
      this.sprite.setFrame(frameName('win', art.win[Math.min(art.win.length - 1, Math.floor(t / 7))]));
    }
    controls.poll();
    for (const e of controls.take()) this.menu.handle(e.action);
  }
}
