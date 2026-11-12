import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { HEROES } from '../../sim';
import { sfx } from '../audio';
import { C, CSS, VIEW_H, VIEW_W } from '../config';
import { heroInfo } from '../heroInfo';
import { BASICS, COMBOS, moveList } from '../moves';
import { backHint, familyName, inputText, padButton } from '../prompts';
import { backdrop, body, display, goTo, goldFill } from '../ui';

const CONTROLS: Array<[string, string, string, string]> = [
  ['', 'PLAYER 1', 'PLAYER 2', 'GAMEPAD (XBOX / PS)'],
  ['Move', 'W A S D', 'Arrow keys', 'Stick or d-pad'],
  ['Light', 'F or J', 'U or Numpad 1', 'A / ✕  or  X / □'],
  ['Heavy', 'G or K', 'I or Numpad 2', 'Y / △'],
  ['Special', 'H or L', 'O or Numpad 3', 'B / ○'],
  ['Block', 'Hold back (or R, Space)', 'Hold back (or P)', 'Hold back, LB / L1'],
  ['Throw', 'Light + Heavy', 'Light + Heavy', 'RB / R1'],
  ['Super', 'Heavy + Special', 'Heavy + Special', 'RT / R2'],
  ['Heat', 'Light + Special', 'Light + Special', 'LT / L2'],
  ['Pause', 'Esc', 'Esc', 'Start / Options'],
];

/** Controls, basics and both heroes' move lists, one page at a time. */
export class HowToScene extends Phaser.Scene {
  private page = 0;
  private content: Phaser.GameObjects.GameObject[] = [];
  private back = 'title';
  private stamp = -1;
  private footer!: Phaser.GameObjects.Text;

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
    this.footer = this.add.text(VIEW_W / 2, VIEW_H - 16, '', body(13, CSS.muted)).setOrigin(0.5, 1);
    this.stamp = controls.deviceStamp;
    this.render();
    controls.take();
  }

  /** The gamepad column: the connected pad's own buttons, else the usual Xbox / PlayStation pairs. */
  private controlsTable(): Array<[string, string, string, string]> {
    if (controls.padsConnected() === 0) return CONTROLS;
    const pad = (a: Parameters<typeof padButton>[0]): string => padButton(a, controls.pad(0) ? 0 : 1);
    const rows = CONTROLS.map((r) => [...r] as [string, string, string, string]);
    rows[0][3] = `YOUR ${familyName(controls.pad(0) ? 0 : 1).toUpperCase()} PAD`;
    rows[2][3] = pad('light');
    rows[3][3] = pad('heavy');
    rows[4][3] = pad('special');
    rows[5][3] = `Hold back, or ${pad('block')}`;
    rows[6][3] = pad('throw');
    rows[7][3] = pad('super');
    rows[8][3] = pad('heat');
    rows[9][3] = pad('start');
    return rows;
  }

  private render(): void {
    this.footer.setText(`◀ ▶ change page  ·  ${backHint()}`);
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
      this.controlsTable().forEach((row, r) => {
        const y = 120 + r * 35;
        row.forEach((cell, c) => {
          const x = [70, 220, 470, 690][c];
          const style = r === 0 ? display(15, CSS.gold, 4) : c === 0 ? display(15, CSS.ink, 4) : body(16, CSS.ink);
          add(this.add.text(x, y, cell, style));
        });
      });
      add(this.add.text(70, 476, 'Any controller works, plugged in or Bluetooth. Title screen > Controllers to test, remap or swap pads.', body(14, CSS.muted)));
    } else if (this.page === 2) {
      add(this.add.text(70, 112, 'Every fighter shares these routes. "," chains a normal into the next; ">" cancels into a special or super.', body(14, CSS.muted)).setWordWrapWidth(820));
      COMBOS.forEach(([name, route], r) => {
        const y = 158 + r * 46;
        add(this.add.text(70, y, name.toUpperCase(), display(16, CSS.gold, 4)));
        add(this.add.text(290, y, inputText(route, -1), body(19, CSS.ink)));
      });
    } else if (this.page === 1) {
      BASICS.forEach(([name, text], r) => {
        const y = 104 + r * 28;
        add(this.add.text(70, y, name.toUpperCase(), display(16, CSS.gold, 4)));
        add(this.add.text(290, y, inputText(text, -1), body(15, CSS.ink)).setWordWrapWidth(620));
      });
    } else {
      const hero = this.page - 3;
      const info = heroInfo(HEROES[hero].id);
      add(this.add.text(70, 108, `${info.archetype}  ·  ${info.plan}`, body(14, CSS.muted)));
      moveList(hero).forEach((m, r) => {
        const y = 132 + r * 27;
        add(this.add.text(70, y, m.name, display(15, CSS.ink, 4)));
        add(this.add.text(290, y, inputText(m.input, -1), body(16, CSS.gold)));
        add(this.add.text(560, y + 1, m.note, body(13, CSS.muted)));
        add(this.add.text(VIEW_W - 70, y, String(m.damage), body(14, CSS.ink)).setOrigin(1, 0));
      });
      add(this.add.text(VIEW_W - 70, 108, 'DAMAGE', display(12, CSS.muted, 3)).setOrigin(1, 0));
    }
  }

  update(): void {
    controls.poll();
    // Picked up a pad (or went back to the keys): redraw with the right buttons.
    if (controls.deviceStamp !== this.stamp) {
      this.stamp = controls.deviceStamp;
      this.render();
    }
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
