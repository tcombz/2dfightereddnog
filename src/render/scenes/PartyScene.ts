// Party lobby: type everyone's name (or add players from a pad), then winner stays on.
import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { sfx } from '../audio';
import { C, CSS, VIEW_H, VIEW_W } from '../config';
import { newParty } from '../party';
import { menuHint, onPad } from '../prompts';
import { Menu, backdrop, body, display, goTo, goldFill } from '../ui';

const MAX_PLAYERS = 12;

export class PartyScene extends Phaser.Scene {
  private names: string[] = [];
  private list!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private nameBox?: HTMLInputElement;
  private menu!: Menu;
  private promptStamp = -1;

  constructor() {
    super('party');
  }

  create(): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.names = this.loadNames();
    this.cameras.main.fadeIn(200, 5, 6, 12);
    backdrop(this, 'stage_concert', 0.78);
    const title = this.add.text(VIEW_W / 2, 40, 'PARTY MODE', display(36, '#ffffff', 7)).setOrigin(0.5);
    goldFill(title);
    this.add
      .text(VIEW_W / 2, 78, 'Winner stays on. The loser hands the controller to the next name in line.', body(15, CSS.muted))
      .setOrigin(0.5);
    const g = this.add.graphics();
    g.fillStyle(C.panel, 0.92).fillRoundedRect(VIEW_W / 2 + 20, 104, 400, 380, 12);
    g.lineStyle(2, C.panelEdge, 1).strokeRoundedRect(VIEW_W / 2 + 20, 104, 400, 380, 12);
    this.add.text(VIEW_W / 2 + 40, 118, 'PLAYERS', display(16, CSS.gold, 4));
    this.list = this.add.text(VIEW_W / 2 + 40, 148, '', body(18, CSS.ink)).setLineSpacing(4);
    this.hint = this.add.text(VIEW_W / 2, VIEW_H - 16, '', body(13, CSS.muted)).setOrigin(0.5, 1);

    this.add.text(60, 112, 'NAME', display(14, CSS.gold, 3));
    this.menu = new Menu(
      this,
      60,
      230,
      [
        { label: 'ADD PLAYER', onSelect: () => this.add_() },
        { label: 'REMOVE LAST', onSelect: () => this.removeLast() },
        { label: 'START PARTY', onSelect: () => this.start() },
        { label: 'BACK', onSelect: () => this.leave('title') },
      ],
      380,
      48,
      22,
    );
    this.makeInput();
    this.refresh();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.nameBox?.remove());
    controls.take();
  }

  private loadNames(): string[] {
    try {
      const raw = localStorage.getItem('afterhours.party');
      const n = raw ? (JSON.parse(raw) as string[]) : [];
      return Array.isArray(n) ? n.filter((s) => typeof s === 'string').slice(0, MAX_PLAYERS) : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem('afterhours.party', JSON.stringify(this.names));
    } catch {
      // Remembered for this visit only.
    }
  }

  /** A real text box over the canvas, so names can be typed with any keyboard. */
  private makeInput(): void {
    const el = document.createElement('input');
    el.type = 'text';
    el.maxLength = 14;
    el.placeholder = 'Type a name, press Enter';
    el.style.cssText =
      'position:fixed;box-sizing:border-box;padding:0 12px;font-weight:600;font-family:system-ui,sans-serif;' +
      'border-radius:8px;border:2px solid #ffc23d;background:#0b0e1c;color:#f3f1ff;z-index:5;outline:none';
    // Sits on the canvas at (60, 134) to (440, 174) in game pixels, whatever size the window is.
    const place = (): void => {
      const r = this.game.canvas.getBoundingClientRect();
      const k = r.width / VIEW_W;
      Object.assign(el.style, {
        left: `${r.left + 60 * k}px`,
        top: `${r.top + 134 * k}px`,
        width: `${380 * k}px`,
        height: `${40 * k}px`,
        fontSize: `${Math.max(12, 17 * k)}px`,
      });
    };
    place();
    this.scale.on(Phaser.Scale.Events.RESIZE, place);
    window.addEventListener('resize', place);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, place);
      window.removeEventListener('resize', place);
    });
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        if (el.value.trim()) this.add_();
        else this.start();
      } else if (e.key === 'Escape') el.blur();
    });
    document.body.appendChild(el);
    this.nameBox = el;
    window.setTimeout(() => el.focus(), 50);
  }

  private add_(): void {
    if (this.names.length >= MAX_PLAYERS) return;
    const typed = this.nameBox?.value.trim() ?? '';
    const name = (typed || `Player ${this.names.length + 1}`).toUpperCase().slice(0, 14);
    this.names.push(name);
    if (this.nameBox) this.nameBox.value = '';
    sfx(this, 'ui_confirm', 0.7);
    this.save();
    this.refresh();
  }

  private removeLast(): void {
    this.names.pop();
    sfx(this, 'ui_move', 0.7);
    this.save();
    this.refresh();
  }

  private start(): void {
    if (this.names.length < 2) {
      this.hint.setText('Add at least two players to start.');
      sfx(this, 'ui_move', 0.7);
      return;
    }
    this.leave('select', { mode: 'versus', cpuLevel: 1, party: newParty([...this.names]) });
  }

  private leave(key: string, data?: object): void {
    this.nameBox?.remove();
    this.nameBox = undefined;
    goTo(this, key, key === 'title' ? { skipIntro: true } : data);
  }

  private refresh(): void {
    this.list.setText(
      this.names.length === 0
        ? 'Nobody yet.\nType names in the box,\nor ADD PLAYER from a controller.'
        : this.names.map((n, i) => `${i + 1}.  ${n}${i === 0 ? '   (player 1 side)' : i === 1 ? '   (player 2 side)' : ''}`).join('\n'),
    );
    this.hint.setText(
      onPad(-1)
        ? `Controller: ADD PLAYER adds "Player N" (type real names on a keyboard)  ·  ${menuHint()}`
        : 'Keyboard: type a name and press Enter (Enter on an empty box starts)  ·  Pads: use the menu',
    );
  }

  update(): void {
    controls.poll();
    if (controls.deviceStamp !== this.promptStamp) {
      this.promptStamp = controls.deviceStamp;
      this.refresh();
    }
    for (const e of controls.take()) {
      if (e.action === 'back' || e.action === 'pause') {
        this.leave('title');
        return;
      }
      this.menu.handle(e.action);
    }
  }
}
