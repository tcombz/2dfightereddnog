// Controllers: which pad each player has, a live button test, and a remap for any controller
// (pressed one action at a time, saved per controller in this browser). Rumble on or off.
import Phaser from 'phaser';
import { REMAP_STEPS, controls, padName } from '../../input/controls';
import type { PadAction, PadMap, PadSource } from '../../input/controls';
import { Input } from '../../sim';
import { sfx } from '../audio';
import { C, CSS, VIEW_H, VIEW_W } from '../config';
import { Menu, backdrop, body, display, goTo, goldFill } from '../ui';
import { backHint, padButton } from '../prompts';

const LIVE: Array<[number, string, PadAction | null]> = [
  [Input.Left, '←', null],
  [Input.Up, '↑', null],
  [Input.Down, '↓', null],
  [Input.Right, '→', null],
  [Input.Light, 'LIGHT', 'light'],
  [Input.Heavy, 'HEAVY', 'heavy'],
  [Input.Special, 'SPECIAL', 'special'],
  [Input.Block, 'BLOCK', 'block'],
];

/** Directions wait this long for a press before keeping the current setting. */
const DIRECTION_WAIT_MS = 6000;

interface Capture {
  slot: number;
  step: number;
  map: PadMap;
  /** Buttons held and axis values when the step began, so only a fresh press counts. */
  baseButtons: boolean[];
  baseAxes: number[];
  /** Wait for every button to be let go before listening (one press, one action). */
  armed: boolean;
  startedAt: number;
}

export class ControllerScene extends Phaser.Scene {
  private menu!: Menu;
  private info: Phaser.GameObjects.Text[] = [];
  private live: Phaser.GameObjects.Text[] = [];
  private prompt!: Phaser.GameObjects.Text;
  private capture: Capture | null = null;
  private clock = 0;
  private footer!: Phaser.GameObjects.Text;

  constructor() {
    super('pads');
  }

  create(): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.capture = null;
    this.cameras.main.fadeIn(200, 5, 6, 12);
    backdrop(this, 'stage_concert', 0.8);
    const title = this.add.text(VIEW_W / 2, 40, 'CONTROLLERS', display(34, '#ffffff', 7)).setOrigin(0.5);
    goldFill(title);
    this.add
      .text(VIEW_W / 2, 74, 'Any pad works, plugged in or Bluetooth. Press a button on it if it does not show up.', body(14, CSS.muted))
      .setOrigin(0.5);

    const g = this.add.graphics();
    this.info = [];
    this.live = [];
    for (let i = 0; i < 2; i += 1) {
      const x = 60 + i * 430;
      g.fillStyle(C.panel, 0.92).fillRoundedRect(x, 100, 410, 120, 12);
      g.lineStyle(2, i === 0 ? C.p1 : C.p2, 1).strokeRoundedRect(x, 100, 410, 120, 12);
      this.add.text(x + 18, 112, `PLAYER ${i + 1}`, display(16, i === 0 ? CSS.p1 : CSS.p2, 4));
      this.info.push(this.add.text(x + 18, 140, '', body(15, CSS.ink)).setWordWrapWidth(380));
      this.live.push(this.add.text(x + 18, 186, '', display(14, CSS.gold, 3)));
    }
    this.prompt = this.add.text(VIEW_W / 2, 500, '', display(18, '#ffffff', 5)).setOrigin(0.5);
    this.footer = this.add.text(VIEW_W / 2, VIEW_H - 14, '', body(13, CSS.muted)).setOrigin(0.5, 1);

    this.menu = new Menu(
      this,
      VIEW_W / 2 - 190,
      258,
      [
        { label: 'SET UP PLAYER 1 PAD', onSelect: () => this.begin(0) },
        { label: 'SET UP PLAYER 2 PAD', onSelect: () => this.begin(1) },
        { label: 'SWAP PLAYER PADS', onSelect: () => controls.swapSlots() },
        {
          label: 'RUMBLE',
          value: () => (controls.rumbleOn ? '◀ ON ▶' : '◀ OFF ▶'),
          onSelect: () => this.toggleRumble(),
          onLeft: () => this.toggleRumble(),
          onRight: () => this.toggleRumble(),
        },
        { label: 'RESET PAD SETUPS', onSelect: () => this.reset() },
        { label: 'BACK', onSelect: () => goTo(this, 'title', { skipIntro: true }) },
      ],
      380,
      36,
      19,
    );
    controls.take();
  }

  private toggleRumble(): void {
    controls.setRumble(!controls.rumbleOn);
    if (controls.rumbleOn) {
      controls.rumble(0, 0.7, 250);
      controls.rumble(1, 0.7, 250);
    }
  }

  private reset(): void {
    for (let i = 0; i < 2; i += 1) {
      const p = controls.pad(i);
      if (p) controls.clearRemap(p);
    }
    this.prompt.setText('Pads are back to their default layout.');
  }

  private begin(slot: number): void {
    const p = controls.pad(slot);
    if (!p) {
      this.prompt.setText(`No controller for player ${slot + 1}: connect one and press a button on it.`);
      return;
    }
    controls.capturing = true;
    this.capture = { slot, step: 0, map: { ...controls.mapFor(p) }, baseButtons: [], baseAxes: [], armed: false, startedAt: 0 };
    this.startStep();
  }

  private startStep(): void {
    const c = this.capture;
    if (!c) return;
    const p = controls.pad(c.slot);
    if (!p) {
      this.finish(false);
      return;
    }
    c.baseButtons = p.buttons.map((b) => b.pressed || b.value > 0.5);
    c.baseAxes = [...p.axes];
    c.armed = false;
    c.startedAt = this.clock;
    const [action, label] = REMAP_STEPS[c.step];
    const dir = ['up', 'down', 'left', 'right'].includes(action);
    this.prompt.setText(
      `Player ${c.slot + 1}: press ${label}  (${c.step + 1}/${REMAP_STEPS.length})${dir ? '  ·  wait to keep the current d-pad' : ''}  ·  Esc skips`,
    );
  }

  /** The first fresh press on the pad: a button, an axis pushed far from rest, or a hat direction. */
  private detect(p: Gamepad, c: Capture): PadSource | null {
    const held = p.buttons.some((b) => b.pressed || b.value > 0.5);
    if (!c.armed) {
      // Let go of everything first (axes back near where they rested).
      const axesBack = p.axes.every((v, k) => Math.abs(v - (c.baseAxes[k] ?? v)) < 0.3);
      if (!held && axesBack) c.armed = true;
      else if (!held) c.baseButtons = p.buttons.map(() => false);
      return null;
    }
    for (let k = 0; k < p.buttons.length; k += 1) {
      const b = p.buttons[k];
      if ((b.pressed || b.value > 0.5) && !c.baseButtons[k]) return { kind: 'button', index: k };
    }
    for (let k = 0; k < p.axes.length; k += 1) {
      const v = p.axes[k];
      const base = c.baseAxes[k] ?? 0;
      // A hat switch rests outside -1..1 and jumps to one of its eight positions.
      if (Math.abs(base) > 1.05 && Math.abs(v) <= 1.05) {
        const dirs = [1, 3, 2, 6, 4, 12, 8, 9][Math.max(0, Math.min(7, Math.round((v + 1) * 3.5)))];
        return { kind: 'hat', index: k, dirs };
      }
      if (Math.abs(v - base) > 0.6 && Math.abs(v) > 0.5) return { kind: 'axis', index: k, dir: v > 0 ? 1 : -1 };
    }
    return null;
  }

  private accept(src: PadSource | null): void {
    const c = this.capture;
    if (!c) return;
    const [action] = REMAP_STEPS[c.step];
    if (src) {
      const keep = ['up', 'down', 'left', 'right'].includes(action) ? stickFor(action) : [];
      c.map[action] = [src, ...keep];
      sfx(this, 'ui_confirm', 0.6);
      controls.rumble(c.slot, 0.4, 80);
    }
    c.step += 1;
    if (c.step >= REMAP_STEPS.length) this.finish(true);
    else this.startStep();
  }

  private finish(save: boolean): void {
    const c = this.capture;
    this.capture = null;
    controls.capturing = false;
    if (!c) return;
    const p = controls.pad(c.slot);
    if (save && p) {
      controls.saveRemap(p, c.map);
      this.prompt.setText(`Saved for ${padName(p)}. Try it in the live test above.`);
    } else {
      this.prompt.setText('Setup cancelled.');
    }
  }

  update(_t: number, delta: number): void {
    this.clock += delta;
    controls.poll();
    this.footer.setText(`Keyboard players: no setup needed  ·  ${backHint()}`);
    for (let i = 0; i < 2; i += 1) {
      const p = controls.pad(i);
      const kind = !p ? '' : controls.hasRemap(p) ? 'your setup' : p.mapping === 'standard' ? 'standard layout' : 'best-guess layout: set it up below';
      this.info[i].setText(p ? `${padName(p)}\n${kind}` : 'No controller. Keyboard works too.');
      const bits = controls.bits(i);
      const pressed = LIVE.filter(([b]) => bits & b).map(([, s, a]) => (a && p ? `${s} (${padButton(a, i)})` : s));
      // At rest, show where each attack is on this pad.
      const legend = p ? LIVE.filter(([, , a]) => a).map(([, s, a]) => `${padButton(a as PadAction, i)} ${s}`).join('   ') : 'press anything to test';
      this.live[i].setText(pressed.join('  ') || legend);
    }

    const c = this.capture;
    if (c) {
      for (const e of controls.take()) {
        if (e.action === 'pause') this.accept(null);
        else if (e.action === 'back' && e.player === -1) this.finish(false);
      }
      const p = controls.pad(c.slot);
      if (!p) {
        this.finish(false);
        return;
      }
      const [action] = REMAP_STEPS[c.step];
      const src = this.detect(p, c);
      if (src) this.accept(src);
      else if (['up', 'down', 'left', 'right'].includes(action) && this.clock - c.startedAt > DIRECTION_WAIT_MS) this.accept(null);
      return;
    }
    for (const e of controls.take()) {
      if (e.action === 'back' || e.action === 'pause') {
        goTo(this, 'title', { skipIntro: true });
        return;
      }
      this.menu.handle(e.action);
    }
  }
}

/** The left stick always moves too, whatever d-pad source was picked. */
function stickFor(action: PadAction): PadSource[] {
  if (action === 'up') return [{ kind: 'axis', index: 1, dir: -1 }];
  if (action === 'down') return [{ kind: 'axis', index: 1, dir: 1 }];
  if (action === 'left') return [{ kind: 'axis', index: 0, dir: -1 }];
  return [{ kind: 'axis', index: 0, dir: 1 }];
}

