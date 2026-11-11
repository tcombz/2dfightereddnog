import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { HEROES } from '../../sim';
import { sfx } from '../audio';
import { C, CSS, VIEW_H, VIEW_W } from '../config';
import { heroInfo } from '../heroInfo';
import { BASICS, COMBOS, moveList } from '../moves';
import { backdrop, body, display, goTo, goldFill } from '../ui';

const CONTROLS: Array<[string, string, string, string]> = [
  ['', 'PLAYER 1', 'PLAYER 2', 'GAMEPAD'],
  ['Move', 'W A S D', 'Arrow keys', 'Stick or d-pad'],
  ['Light', 'F or J', 'U or Numpad 1', 'A or X'],
  ['Heavy', 'G or K', 'I or Numpad 2', 'Y'],
  ['Special', 'H or L', 'O or Numpad 3', 'B'],
  ['Block', 'Hold back (or R, Space)', 'Hold back (or P)', 'Hold back (or LB)'],
  ['Throw', 'Light + Heavy', 'Light + Heavy', 'RB'],
  ['Super', 'Heavy + Special', 'Heavy + Special', 'RT'],
  ['Pause', 'Esc', 'Esc', 'Start'],
];

/** Controls, basics and both heroes' move lists, one page at a time. */
export class HowToScene extends Phaser.Scene {
  private page = 0;
  private content: Phaser.GameObjects.GameObject[] = [];
  private back = 'title';

  constructor() {
    super('howto');
  }

  private get pages(): string[] {
    return ['CONTROLS', 'BASICS', 'COMBOS', ...HEROES.map((h) => heroInfo(h.id).title)];
  }

  create(data: { back?: string }): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.back = data?.back ?? 'title';
    this.page = 0;
    this.cameras.main.fadeIn(200, 5, 6, 12);
    backdrop(this, 'stage_concert', 0.78);
    this.add.text(VIEW_W / 2, VIEW_H - 16, '◀ ▶ change page  ·  Esc, G or B to go back', body(13, CSS.muted)).setOrigin(0.5, 1);
    this.render();
    controls.take();
  }

  private render(): void {
    this.content.forEach((o) => o.destroy());
    this.content = [];
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.content.push(o);
      return o;
    };
    const title = add(this.add.text(VIEW_W / 2, 40, this.pages[this.page], display(34, '#ffffff', 7)).setOrigin(0.5));
    goldFill(title);
    add(this.add.text(VIEW_W / 2, 74, `${this.page + 1} / ${this.pages.length}`, body(13, CSS.muted)).setOrigin(0.5));
    const g = add(this.add.graphics());
    g.fillStyle(C.panel, 0.92).fillRoundedRect(40, 96, VIEW_W - 80, VIEW_H - 140, 12);
    g.lineStyle(2, C.panelEdge, 1).strokeRoundedRect(40, 96, VIEW_W - 80, VIEW_H - 140, 12);

    if (this.page === 0) {
      CONTROLS.forEach((row, r) => {
        const y = 122 + r * 40;
        row.forEach((cell, c) => {
          const x = [70, 220, 470, 690][c];
          const style = r === 0 ? display(15, CSS.gold, 4) : c === 0 ? display(15, CSS.ink, 4) : body(16, CSS.ink);
          add(this.add.text(x, y, cell, style));
        });
      });
    } else if (this.page === 2) {
      add(this.add.text(70, 112, 'Every fighter shares these routes. "," chains a normal into the next; ">" cancels into a special or super.', body(14, CSS.muted)).setWordWrapWidth(820));
      COMBOS.forEach(([name, route], r) => {
        const y = 158 + r * 46;
        add(this.add.text(70, y, name.toUpperCase(), display(16, CSS.gold, 4)));
        add(this.add.text(290, y, route, body(19, CSS.ink)));
      });
    } else if (this.page === 1) {
      BASICS.forEach(([name, text], r) => {
        const y = 112 + r * 37;
        add(this.add.text(70, y, name.toUpperCase(), display(16, CSS.gold, 4)));
        add(this.add.text(290, y, text, body(16, CSS.ink)).setWordWrapWidth(590));
      });
    } else {
      const hero = this.page - 3;
      const info = heroInfo(HEROES[hero].id);
      add(this.add.text(70, 108, `${info.style}  ·  "${info.tagline}"`, body(14, CSS.muted)));
      moveList(hero).forEach((m, r) => {
        const y = 136 + r * 33;
        add(this.add.text(70, y, m.name, display(15, CSS.ink, 4)));
        add(this.add.text(290, y, m.input, body(16, CSS.gold)));
        add(this.add.text(560, y + 1, m.note, body(13, CSS.muted)));
        add(this.add.text(VIEW_W - 70, y, String(m.damage), body(14, CSS.ink)).setOrigin(1, 0));
      });
      add(this.add.text(VIEW_W - 70, 108, 'DAMAGE', display(12, CSS.muted, 3)).setOrigin(1, 0));
    }
  }

  update(): void {
    controls.poll();
    for (const e of controls.take()) {
      if (e.action === 'left' || e.action === 'right') {
        this.page = (this.page + (e.action === 'left' ? -1 : 1) + this.pages.length) % this.pages.length;
        sfx(this, 'ui_move', 0.8);
        this.render();
      } else if (e.action === 'back' || e.action === 'pause' || e.action === 'confirm') {
        sfx(this, 'ui_confirm', 0.6);
        goTo(this, this.back, { skipIntro: true });
      }
    }
  }
}
