// The fight HUD. Reads sim state; draws on its own camera so screen shake and zoom leave it alone.
import Phaser from 'phaser';
import { HEROES, METER_MAX, Phase, ROUNDS_TO_WIN, TICK_RATE } from '../sim';
import type { GameState } from '../sim';
import { C, CSS, VIEW_H, VIEW_W } from './config';
import { heroInfo } from './heroInfo';
import { body, display, goldFill } from './ui';

const BAR_W = 360;
const BAR_H = 22;
const BAR_Y = 26;
const PORTRAIT = 56;

export class Hud {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly timer: Phaser.GameObjects.Text;
  private readonly meterLabels: Phaser.GameObjects.Text[];
  private readonly comboText: Phaser.GameObjects.Text[];
  private readonly comboSub: Phaser.GameObjects.Text[];
  private readonly announce: Phaser.GameObjects.Text;
  private readonly announceSub: Phaser.GameObjects.Text;
  /** Health shown on the red trail, which catches up after a combo. */
  private trail = [0, 0];
  private trailHold = [0, 0];
  private comboShown = [0, 0];
  private comboFade = [0, 0];
  readonly objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    state: GameState,
    cpuSide: number,
    private readonly training: boolean,
  ) {
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.objects.push(o);
      return o;
    };
    this.g = add(scene.add.graphics());
    // Portraits.
    state.fighters.forEach((f, i) => {
      const id = HEROES[f.hero].id;
      const x = i === 0 ? 16 : VIEW_W - 16 - PORTRAIT;
      add(scene.add.image(x, 14, `portrait_${id}`).setOrigin(0, 0).setDisplaySize(PORTRAIT, PORTRAIT).setFlipX(i === 1));
    });
    this.timer = add(scene.add.text(VIEW_W / 2, BAR_Y + 12, '99', display(38, CSS.ink, 6)).setOrigin(0.5));
    state.fighters.forEach((f, i) =>
      add(
        scene.add
          .text(i === 0 ? 82 : VIEW_W - 82, BAR_Y + BAR_H + 6, heroInfo(HEROES[f.hero].id).title, display(15, CSS.ink, 4))
          .setOrigin(i === 0 ? 0 : 1, 0),
      ),
    );
    if (cpuSide >= 0) {
      add(scene.add.text(cpuSide === 0 ? 82 : VIEW_W - 82, BAR_Y + BAR_H + 26, 'CPU', body(12, CSS.muted)).setOrigin(cpuSide === 0 ? 0 : 1, 0));
    }
    this.meterLabels = [0, 1].map((i) =>
      add(scene.add.text(i === 0 ? 24 : VIEW_W - 24, VIEW_H - 42, 'SUPER', display(13, CSS.ink, 4)).setOrigin(i === 0 ? 0 : 1, 1)),
    );
    this.comboText = [0, 1].map((i) =>
      add(scene.add.text(i === 0 ? 28 : VIEW_W - 28, 150, '', display(40, CSS.gold, 7)).setOrigin(i === 0 ? 0 : 1, 0).setAlpha(0)),
    );
    this.comboSub = [0, 1].map((i) =>
      add(scene.add.text(i === 0 ? 30 : VIEW_W - 30, 198, '', display(15, CSS.ink, 4)).setOrigin(i === 0 ? 0 : 1, 0).setAlpha(0)),
    );
    this.announce = add(scene.add.text(VIEW_W / 2, VIEW_H / 2 - 40, '', display(84, CSS.ink, 10)).setOrigin(0.5).setAlpha(0));
    this.announceSub = add(scene.add.text(VIEW_W / 2, VIEW_H / 2 + 34, '', display(24, CSS.ink, 5)).setOrigin(0.5).setAlpha(0));
    this.trail = state.fighters.map((f) => f.health);
  }

  /** Big centre text: ROUND 1, FIGHT!, K.O. ... */
  shout(text: string, sub = '', hold = 900, gold = true): void {
    const t = this.announce;
    this.scene.tweens.killTweensOf([t, this.announceSub]);
    t.setText(text).setAlpha(1).setScale(2.2);
    if (gold) goldFill(t);
    else t.setFill('#ffffff');
    this.scene.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: hold, duration: 260 });
    this.announceSub.setText(sub).setAlpha(sub ? 1 : 0);
    if (sub) this.scene.tweens.add({ targets: this.announceSub, alpha: 0, delay: hold, duration: 260 });
  }

  update(s: GameState, dtMs: number): void {
    const g = this.g;
    g.clear();

    // Timer box.
    g.fillStyle(C.panel, 0.92).fillRoundedRect(VIEW_W / 2 - 40, 12, 80, 52, 8);
    g.lineStyle(2, C.panelEdge, 1).strokeRoundedRect(VIEW_W / 2 - 40, 12, 80, 52, 8);
    this.timer.setText(this.training ? '∞' : String(Math.ceil(s.timer / TICK_RATE)));
    this.timer.setColor(!this.training && s.timer < 10 * TICK_RATE && s.phase === Phase.Fight ? '#ff6a5a' : CSS.ink);

    for (let i = 0; i < 2; i += 1) {
      const f = s.fighters[i];
      const max = HEROES[f.hero].stats.maxHealth;
      const left = i === 0 ? 78 : VIEW_W - 78 - BAR_W;
      // Trail catches up once the combo is over.
      if (f.health > this.trail[i]) this.trail[i] = f.health;
      if (f.combo === 0) {
        this.trailHold[i] -= dtMs;
        if (this.trailHold[i] <= 0) this.trail[i] = Math.max(f.health, this.trail[i] - dtMs * 0.5);
      } else this.trailHold[i] = 450;

      const frac = Math.max(0, f.health) / max;
      const trailFrac = Math.max(0, this.trail[i]) / max;
      // Frame.
      g.fillStyle(0x05060c, 0.9).fillRect(left - 4, BAR_Y - 4, BAR_W + 8, BAR_H + 8);
      g.fillStyle(0x2a0d14, 1).fillRect(left, BAR_Y, BAR_W, BAR_H);
      // Bars drain toward the centre.
      const fill = (fr: number, color: number, alpha = 1): void => {
        const w = Math.round(BAR_W * fr);
        g.fillStyle(color, alpha).fillRect(i === 0 ? left + BAR_W - w : left, BAR_Y, w, BAR_H);
      };
      fill(trailFrac, C.damage);
      const low = frac < 0.25;
      const pulse = low ? 0.75 + 0.25 * Math.sin(s.tick * 0.25) : 1;
      fill(frac, low ? C.healthLow : C.health, pulse);
      fill(frac, 0xffffff, 0.18); // sheen
      g.fillStyle(0xffffff, 0.22).fillRect(left, BAR_Y + 2, BAR_W, 3);
      g.lineStyle(2, 0xffffff, 0.9).strokeRect(left, BAR_Y, BAR_W, BAR_H);
      // Portrait frame.
      const px = i === 0 ? 16 : VIEW_W - 16 - PORTRAIT;
      g.lineStyle(3, i === 0 ? C.p1 : C.p2, 1).strokeRect(px, 14, PORTRAIT, PORTRAIT);

      // Round wins: diamonds beside the timer.
      for (let r = 0; r < ROUNDS_TO_WIN; r += 1) {
        const cx = i === 0 ? VIEW_W / 2 - 58 - r * 20 : VIEW_W / 2 + 58 + r * 20;
        const cy = BAR_Y + BAR_H + 16;
        const won = r < s.wins[i];
        g.fillStyle(won ? C.gold : 0x23284a, 1);
        g.fillPoints([{ x: cx, y: cy - 8 }, { x: cx + 7, y: cy }, { x: cx, y: cy + 8 }, { x: cx - 7, y: cy }], true);
        g.lineStyle(2, won ? 0xfff0b0 : 0x5a6290, 1).strokePoints([{ x: cx, y: cy - 8 }, { x: cx + 7, y: cy }, { x: cx, y: cy + 8 }, { x: cx - 7, y: cy }], true);
      }

      // Super meter at the bottom.
      const mw = 230;
      const mx = i === 0 ? 24 : VIEW_W - 24 - mw;
      const my = VIEW_H - 36;
      const mfrac = f.meter / METER_MAX;
      const full = f.meter >= METER_MAX;
      g.fillStyle(0x05060c, 0.85).fillRect(mx - 3, my - 3, mw + 6, 18);
      g.fillStyle(0x0b2236, 1).fillRect(mx, my, mw, 12);
      const mwFill = Math.round(mw * mfrac);
      const flash = full ? 0.6 + 0.4 * Math.abs(Math.sin(s.tick * 0.12)) : 1;
      g.fillStyle(full ? C.meterFull : C.meter, flash).fillRect(i === 0 ? mx : mx + mw - mwFill, my, mwFill, 12);
      g.lineStyle(2, full ? 0xffffff : 0x4aa8e0, 1).strokeRect(mx, my, mw, 12);
      this.meterLabels[i].setText(full ? 'SUPER  READY' : 'SUPER').setColor(full ? '#9ff6ff' : CSS.muted);

      // Combo counter for the attacker's side: shows hits taken by the other fighter.
      const def = s.fighters[1 - i];
      const side = i;
      if (def.combo >= 2) {
        this.comboShown[side] = def.combo;
        this.comboFade[side] = 1100;
        this.comboText[side].setText(`${def.combo} HITS`).setAlpha(1);
        goldFill(this.comboText[side]);
        this.comboSub[side].setText(`${def.comboDamage} DAMAGE`).setAlpha(1);
      } else if (this.comboFade[side] > 0) {
        this.comboFade[side] -= dtMs;
        const a = Math.max(0, Math.min(1, this.comboFade[side] / 400));
        this.comboText[side].setAlpha(a);
        this.comboSub[side].setAlpha(a);
      }
    }
  }
}
