// Settings: every option in one place, by category. Left: the categories. Right: the options in
// the chosen one, each with a line saying what it does. Keyboard keys are rebound here, per player.
import Phaser from 'phaser';
import { KEY_ACTIONS, controls, keyLabel, padName } from '../../input/controls';
import type { KeyAction } from '../../input/controls';
import { setMusicVolume, setSfxVolume, setVoice, settings, sfx } from '../audio';
import { C, CPU_LEVELS, CSS, VIEW_H, VIEW_W } from '../config';
import { menuHint } from '../prompts';
import { backdrop, body, display, fitText, goTo, goldFill } from '../ui';

interface Row {
  label: string;
  value?: () => string;
  /** What it does, shown under the panel while selected. */
  help: string;
  change?: (dir: number) => void;
  select?: () => void;
}

interface Category {
  name: string;
  rows: () => Row[];
}

const PANEL_X = 300;
const PANEL_W = VIEW_W - PANEL_X - 30;
const ROW_H = 26;

export class SettingsScene extends Phaser.Scene {
  private cats: Category[] = [];
  private cat = 0;
  private row = 0;
  private focus: 'cats' | 'rows' = 'cats';
  /** Waiting for a key to bind: [player, action]. */
  private listening: [number, KeyAction] | null = null;
  private note = '';
  private g!: Phaser.GameObjects.Graphics;
  private catTexts: Phaser.GameObjects.Text[] = [];
  private rowTexts: Array<{ label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text }> = [];
  private help!: Phaser.GameObjects.Text;
  private footer!: Phaser.GameObjects.Text;
  private heading!: Phaser.GameObjects.Text;
  private stamp = -1;

  constructor() {
    super('settings');
  }

  create(data: { cat?: number } = {}): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.cameras.main.fadeIn(200, 5, 6, 12);
    backdrop(this, 'stage_embassy', 0.85);
    this.listening = null;
    this.note = '';
    this.cat = data?.cat ?? 0;
    this.row = 0;
    this.focus = 'cats';

    const bar = this.add.graphics();
    bar.fillStyle(0xf3f1ff, 0.95).fillRect(0, 0, VIEW_W, 30);
    bar.fillStyle(C.gold, 1).fillRect(0, 30, VIEW_W, 3);
    this.add.text(14, 15, 'AFTER HOURS', display(13, '#1b2040', 0)).setOrigin(0, 0.5);
    const title = this.add.text(30, 46, 'SETTINGS', display(40, '#ffffff', 8));
    goldFill(title);

    const level = (): number => (this.registry.get('cpuLevel') as number | undefined) ?? 1;
    const pct = (v: number): string => `◀ ${Math.round(v * 100)}% ▶`;
    const onOff = (v: boolean): string => `◀ ${v ? 'ON' : 'OFF'} ▶`;
    const keyRows = (player: number): Row[] => [
      ...KEY_ACTIONS.map(([a, label]): Row => ({
        label,
        value: () =>
          this.listening && this.listening[0] === player && this.listening[1] === a
            ? 'PRESS A KEY…'
            : controls.keysFor(player, a).map(keyLabel).join('  /  ') || '—',
        help:
          a === 'throw' || a === 'super' || a === 'heat'
            ? 'Optional: one key that presses both buttons at once. Confirm, then press a key.'
            : 'Confirm, then press the new key. Escape cancels. A key taken from another action is moved here.',
        select: () => this.listen(player, a),
      })),
      {
        label: 'RESET TO DEFAULTS',
        help: player === 0 ? 'Back to W A S D, F G H and R (or J K L and Space).' : 'Back to the arrow keys, U I O and P (or the number pad).',
        select: () => {
          controls.resetKeys(player);
          this.note = `Player ${player + 1} keys reset.`;
        },
      },
    ];

    this.cats = [
      {
        name: 'GAMEPLAY',
        rows: () => [
          {
            label: 'SPECIAL INPUTS',
            value: () => `◀ ${this.registry.get('simple') ? 'SIMPLE' : 'CLASSIC'} ▶`,
            help: 'Classic: motion inputs (↓↘→ + SPECIAL). Simple: one direction + SPECIAL. Each player can still change it at character select.',
            change: () => this.toggleSimple(),
          },
          {
            label: 'CPU DIFFICULTY',
            value: () => `◀ ${CPU_LEVELS[level()]} ▶`,
            help: 'How hard the computer fights in Arcade and VS CPU.',
            change: (d) => this.registry.set('cpuLevel', (level() + d + 3) % 3),
          },
          {
            label: 'CONTROLLER RUMBLE',
            value: () => onOff(controls.rumbleOn),
            help: 'Shake the controller on big hits and knockouts (where the browser supports it).',
            change: () => controls.setRumble(!controls.rumbleOn),
          },
        ],
      },
      {
        name: 'AUDIO',
        rows: () => [
          { label: 'MUSIC', value: () => pct(settings.music), help: 'Music volume.', change: (d) => setMusicVolume(settings.music + d * 0.1) },
          { label: 'SOUND EFFECTS', value: () => pct(settings.sfx), help: 'Hits, menus and the crowd.', change: (d) => setSfxVolume(settings.sfx + d * 0.1) },
          {
            label: 'ANNOUNCER',
            value: () => onOff(settings.voice),
            help: 'The voice that calls the rounds, knockouts and winners (your browser’s speech voice).',
            change: () => setVoice(!settings.voice),
          },
        ],
      },
      {
        name: 'DISPLAY',
        rows: () => [
          {
            label: 'FULLSCREEN',
            value: () => onOff(this.scale.isFullscreen),
            help: 'Fill the whole screen. Escape or F11 leaves it too.',
            select: () => (this.scale.isFullscreen ? this.scale.stopFullscreen() : this.scale.startFullscreen()),
            change: () => (this.scale.isFullscreen ? this.scale.stopFullscreen() : this.scale.startFullscreen()),
          },
        ],
      },
      { name: 'KEYBOARD · P1', rows: () => keyRows(0) },
      { name: 'KEYBOARD · P2', rows: () => keyRows(1) },
      {
        name: 'CONTROLLERS',
        rows: () => [
          {
            label: 'SET UP AND REMAP CONTROLLERS',
            help: 'Test buttons, remap any controller one button at a time, swap which pad is player 1. Controllers work everywhere, online too.',
            select: () => goTo(this, 'pads', { back: 'settings' }),
          },
          { label: 'PLAYER 1 PAD', value: () => padName(controls.pad(0)).toUpperCase(), help: 'Press any button on a controller to connect it.' },
          { label: 'PLAYER 2 PAD', value: () => padName(controls.pad(1)).toUpperCase(), help: 'The second controller to connect is player 2.' },
        ],
      },
    ];

    this.g = this.add.graphics();
    this.catTexts = this.cats.map((c, i) => this.add.text(46, 128 + i * 46, c.name, display(19, CSS.ink, 4)).setOrigin(0, 0.5).setDepth(2));
    this.heading = this.add.text(PANEL_X + 20, 116, '', display(16, CSS.gold, 4)).setDepth(2);
    this.rowTexts = [];
    for (let k = 0; k < 12; k += 1) {
      const y = 154 + k * ROW_H;
      this.rowTexts.push({
        label: this.add.text(PANEL_X + 22, y, '', display(15, CSS.ink, 3)).setOrigin(0, 0.5).setDepth(2),
        value: this.add.text(PANEL_X + PANEL_W - 22, y, '', body(15, CSS.gold)).setOrigin(1, 0.5).setDepth(2),
      });
    }
    this.help = this.add.text(PANEL_X + 20, VIEW_H - 74, '', body(14, CSS.ink)).setDepth(2).setWordWrapWidth(PANEL_W - 40).setLineSpacing(2);
    this.footer = this.add.text(VIEW_W / 2, VIEW_H - 14, '', body(13, CSS.muted)).setOrigin(0.5);
    this.draw();
    controls.take();
  }

  private get rows(): Row[] {
    return this.cats[this.cat].rows();
  }

  private toggleSimple(): void {
    const v = !this.registry.get('simple');
    this.registry.set('simple', v);
    try {
      localStorage.setItem('afterhours.simple', v ? '1' : '0');
    } catch {
      // Applies for this visit.
    }
  }

  private listen(player: number, action: KeyAction): void {
    this.listening = [player, action];
    this.note = '';
    controls.captureKey((code) => {
      this.listening = null;
      if (code === null) this.note = 'Cancelled.';
      else if (code === '') this.note = 'That key belongs to the menus (Enter, Escape, Backspace, Tab, F-keys). Pick another.';
      else {
        controls.bindKey(player, action, code);
        this.note = `${keyLabel(code)} is now ${KEY_ACTIONS.find(([a]) => a === action)?.[1]} for player ${player + 1}.`;
        sfx(this, 'ui_confirm');
      }
      controls.take();
      this.draw();
    });
    this.draw();
  }

  private draw(): void {
    const g = this.g;
    g.clear();
    // Categories.
    this.catTexts.forEach((t, i) => {
      const on = i === this.cat;
      const y = 128 + i * 46;
      if (on) {
        g.fillStyle(this.focus === 'cats' ? C.gold : 0x2b3263, 1);
        g.fillPoints([{ x: 34, y: y - 18 }, { x: 270, y: y - 18 }, { x: 260, y: y + 18 }, { x: 24, y: y + 18 }], true);
      }
      t.setColor(on && this.focus === 'cats' ? '#120c02' : CSS.ink).setStroke('#05060c', on && this.focus === 'cats' ? 0 : 4);
    });
    // Panel.
    g.fillStyle(0x0b0e1c, 0.9).fillRect(PANEL_X, 100, PANEL_W, VIEW_H - 140);
    g.lineStyle(2, C.panelEdge, 1).strokeRect(PANEL_X, 100, PANEL_W, VIEW_H - 140);
    g.fillStyle(C.panelEdge, 1).fillRect(PANEL_X + 20, VIEW_H - 84, PANEL_W - 40, 1);
    this.heading.setText(this.cats[this.cat].name);
    const rows = this.rows;
    if (this.row >= rows.length) this.row = rows.length - 1;
    this.rowTexts.forEach((r, k) => {
      const it = rows[k];
      r.label.setVisible(!!it);
      r.value.setVisible(!!it);
      if (!it) return;
      const on = this.focus === 'rows' && k === this.row;
      const y = 154 + k * ROW_H;
      if (on) g.fillStyle(C.gold, 1).fillRect(PANEL_X + 10, y - ROW_H / 2 + 2, PANEL_W - 20, ROW_H - 4);
      r.label.setText(it.label).setColor(on ? '#120c02' : CSS.ink).setStroke('#05060c', on ? 0 : 3);
      r.value.setText(it.value?.() ?? (it.select ? '›' : '')).setColor(on ? '#120c02' : CSS.gold);
      fitText(r.label, PANEL_W * 0.55);
      fitText(r.value, PANEL_W * 0.4);
    });
    const it = rows[this.row];
    this.help.setText(this.note || (this.focus === 'rows' && it ? it.help : 'Pick a category: up and down, then confirm.'));
    this.footer.setText(
      this.listening ? 'Press the new key  ·  Escape cancels' : this.focus === 'rows' ? `Left / Right: change  ·  ${menuHint()}` : menuHint(),
    );
  }

  update(): void {
    controls.poll();
    if (controls.deviceStamp !== this.stamp) {
      this.stamp = controls.deviceStamp;
      this.draw();
    }
    const events = controls.take();
    if (this.listening) return;
    for (const e of events) {
      const a = e.action;
      this.note = '';
      if (this.focus === 'cats') {
        if (a === 'up' || a === 'down') {
          this.cat = (this.cat + (a === 'up' ? -1 : 1) + this.cats.length) % this.cats.length;
          this.row = 0;
          sfx(this, 'ui_move', 0.8);
        } else if (a === 'confirm' || a === 'right') {
          this.focus = 'rows';
          this.row = 0;
          sfx(this, 'ui_confirm', 0.8);
        } else if (a === 'back' || a === 'pause') {
          goTo(this, 'title', { skipIntro: true });
          return;
        }
      } else {
        const rows = this.rows;
        const it = rows[this.row];
        if (a === 'up' || a === 'down') {
          this.row = (this.row + (a === 'up' ? -1 : 1) + rows.length) % rows.length;
          sfx(this, 'ui_move', 0.8);
        } else if ((a === 'left' || a === 'right') && it.change) {
          it.change(a === 'left' ? -1 : 1);
          sfx(this, 'ui_move', 0.8);
        } else if (a === 'confirm' && (it.select || it.change)) {
          sfx(this, 'ui_confirm', 0.8);
          if (it.select) it.select();
          else it.change?.(1);
        } else if (a === 'back' || a === 'pause' || a === 'left') {
          this.focus = 'cats';
          sfx(this, 'ui_move', 0.8);
        }
      }
      if (this.listening) break;
    }
    this.draw();
  }
}
