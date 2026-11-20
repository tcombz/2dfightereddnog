// The fight HUD. Reads sim state; draws on its own camera so screen shake and zoom leave it alone.
import Phaser from 'phaser';
import { announce } from './audio';
import { ASSIST_COOLDOWN, HEAT_TICKS, HEROES, METER_LEVEL, METER_MAX, Phase, ROUNDS_TO_WIN, TICK_RATE, rallying } from '../sim';
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
  private readonly heatLabels: Phaser.GameObjects.Text[];
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
  /** Point portraits and names (they change on a tag), the partners' small portraits, the hyper level digits. */
  private readonly portraits: Phaser.GameObjects.Image[] = [];
  private readonly names: Phaser.GameObjects.Text[] = [];
  private readonly partnerPics: Phaser.GameObjects.Image[] = [];
  private readonly levels: Phaser.GameObjects.Text[];
  private readonly assistTags: Phaser.GameObjects.Text[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    state: GameState,
    cpuSide: number,
    private readonly training: boolean,
    players: [string, string] | null = null,
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
      this.portraits.push(add(scene.add.image(x, 14, `portrait_${id}`).setOrigin(0, 0).setDisplaySize(PORTRAIT, PORTRAIT).setFlipX(i === 1)));
    });
    this.timer = add(scene.add.text(VIEW_W / 2, BAR_Y + 12, '99', display(38, CSS.ink, 6)).setOrigin(0.5));
    state.fighters.forEach((f, i) =>
      this.names.push(
        add(
          scene.add
            .text(i === 0 ? 82 : VIEW_W - 82, BAR_Y + BAR_H + 6, heroInfo(HEROES[f.hero].id).title, display(15, CSS.ink, 4))
            .setOrigin(i === 0 ? 0 : 1, 0),
        ),
      ),
    );
    // Tag teams: the partner's small portrait under the main one, and its assist light.
    if (state.team) {
      state.bench.forEach((b, i) => {
        const x = i === 0 ? 16 : VIEW_W - 16 - 34;
        this.partnerPics.push(add(scene.add.image(x, 76, `portrait_${HEROES[b.hero].id}`).setOrigin(0, 0).setDisplaySize(34, 34).setFlipX(i === 1)));
        this.assistTags.push(add(scene.add.text(i === 0 ? 56 : VIEW_W - 56, 104, '', display(10, '#7dff9a', 3)).setOrigin(i === 0 ? 0 : 1, 0.5)));
      });
    }
    // Hyper level: a big number beside each meter.
    this.levels = [0, 1].map((i) => add(scene.add.text(i === 0 ? 24 : VIEW_W - 24, VIEW_H - 22, '0', display(26, '#9ff6ff', 5)).setOrigin(i === 0 ? 0 : 1, 0.5)));
    // Party and tournament play: whose side is whose, under the fighter names.
    if (players) {
      players.forEach((name, i) => {
        add(
          scene.add
            .text(i === 0 ? 82 : VIEW_W - 82, BAR_Y + BAR_H + 26, name, display(12, i === 0 ? '#9cc3ff' : '#ffb98a', 3))
            .setOrigin(i === 0 ? 0 : 1, 0),
        );
      });
    }
    if (cpuSide >= 0) {
      add(scene.add.text(cpuSide === 0 ? 82 : VIEW_W - 82, BAR_Y + BAR_H + 26, 'CPU', body(12, CSS.muted)).setOrigin(cpuSide === 0 ? 0 : 1, 0));
    }
    this.meterLabels = [0, 1].map((i) =>
      add(scene.add.text(i === 0 ? 54 : VIEW_W - 54, VIEW_H - 42, 'HYPER', display(13, CSS.ink, 4)).setOrigin(i === 0 ? 0 : 1, 1)),
    );
    this.heatLabels = [0, 1].map((i) =>
      add(scene.add.text(i === 0 ? 24 + 230 + 14 + 33 : VIEW_W - 24 - 230 - 14 - 33, VIEW_H - 30, 'HEAT', display(11, '#ffffff', 3)).setOrigin(0.5)),
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
    announce(spoken(text, sub));
    const t = this.announce;
    this.scene.tweens.killTweensOf([t, this.announceSub]);
    t.setText(text).setScale(1);
    // Long banners shrink to fit the screen.
    const k = Math.min(1, (VIEW_W - 80) / Math.max(1, t.width));
    t.setAlpha(1).setScale(2.2 * k);
    if (gold) goldFill(t);
    else t.setFill('#ffffff');
    this.scene.tweens.add({ targets: t, scale: k, duration: 220, ease: 'Back.easeOut' });
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
      // After a tag the point fighter is someone else: portrait, name, and the trail start fresh.
      const pid = `portrait_${HEROES[f.hero].id}`;
      if (this.portraits[i].texture.key !== pid) {
        this.portraits[i].setTexture(pid).setDisplaySize(PORTRAIT, PORTRAIT);
        this.names[i].setText(heroInfo(HEROES[f.hero].id).title);
        this.trail[i] = f.health;
      }
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
      // Recoverable (red) health, which comes back while this fighter rests on the bench.
      if (s.team && f.red > 0) fill(Math.min(1, (Math.max(0, f.health) + f.red) / max), 0xff8fa8, 0.55);
      const low = frac < 0.25;
      const pulse = low ? 0.75 + 0.25 * Math.sin(s.tick * 0.25) : 1;
      fill(frac, low ? C.healthLow : C.health, pulse);
      fill(frac, 0xffffff, 0.18); // sheen
      g.fillStyle(0xffffff, 0.22).fillRect(left, BAR_Y + 2, BAR_W, 3);
      g.lineStyle(2, 0xffffff, 0.9).strokeRect(left, BAR_Y, BAR_W, BAR_H);
      // Portrait frame.
      const px = i === 0 ? 16 : VIEW_W - 16 - PORTRAIT;
      g.lineStyle(3, i === 0 ? C.p1 : C.p2, 1).strokeRect(px, 14, PORTRAIT, PORTRAIT);

      // Tag teams: the partner's bar and assist light under the main bar.
      if (s.team) {
        const b = s.bench[i];
        const bmax = HEROES[b.hero].stats.maxHealth;
        const bw = Math.round(BAR_W * 0.5);
        const bx = i === 0 ? left + BAR_W - bw : left;
        const by = BAR_Y + BAR_H + 30;
        g.fillStyle(0x05060c, 0.9).fillRect(bx - 2, by - 2, bw + 4, 10);
        g.fillStyle(0x2a0d14, 1).fillRect(bx, by, bw, 6);
        const bfr = Math.max(0, b.health) / bmax;
        const bwf = Math.round(bw * bfr);
        if (b.red > 0) {
          const rw = Math.round(bw * Math.min(1, (Math.max(0, b.health) + b.red) / bmax));
          g.fillStyle(0xff8fa8, 0.55).fillRect(i === 0 ? bx + bw - rw : bx, by, rw, 6);
        }
        g.fillStyle(C.health, 1).fillRect(i === 0 ? bx + bw - bwf : bx, by, bwf, 6);
        const pic = this.partnerPics[i];
        const bid = `portrait_${HEROES[b.hero].id}`;
        if (pic.texture.key !== bid) pic.setTexture(bid).setDisplaySize(34, 34);
        pic.setAlpha(b.health > 0 ? 1 : 0.3);
        const ready = b.health > 0 && b.out === 0 && b.cd === 0;
        g.lineStyle(2, b.health <= 0 ? 0x3a3f5a : ready ? 0x7dff9a : 0x5a6290, 1).strokeRect(pic.x, 76, 34, 34);
        // Cooldown fill under the portrait.
        if (b.health > 0 && !ready) {
          const cw = Math.round(34 * (1 - b.cd / (ASSIST_COOLDOWN * 2)));
          g.fillStyle(0x7dff9a, 0.6).fillRect(pic.x, 112, Math.max(0, Math.min(34, cw)), 3);
        }
        this.assistTags[i].setText(b.health <= 0 ? 'K.O.' : b.out === 1 ? 'ASSIST!' : ready ? 'ASSIST READY' : 'ASSIST…').setColor(ready ? '#7dff9a' : CSS.muted);
      }

      // Round wins: diamonds beside the timer (a tag match is one round).
      for (let r = 0; r < (s.team ? 1 : ROUNDS_TO_WIN); r += 1) {
        const cx = i === 0 ? VIEW_W / 2 - 58 - r * 20 : VIEW_W / 2 + 58 + r * 20;
        const cy = BAR_Y + BAR_H + 16;
        const won = r < s.wins[i];
        g.fillStyle(won ? C.gold : 0x23284a, 1);
        g.fillPoints([{ x: cx, y: cy - 8 }, { x: cx + 7, y: cy }, { x: cx, y: cy + 8 }, { x: cx - 7, y: cy }], true);
        g.lineStyle(2, won ? 0xfff0b0 : 0x5a6290, 1).strokePoints([{ x: cx, y: cy - 8 }, { x: cx + 7, y: cy }, { x: cx, y: cy + 8 }, { x: cx - 7, y: cy }], true);
      }

      // Hyper meter at the bottom: three levels, the big number is how many supers are ready.
      const mw = 200;
      const mx = i === 0 ? 54 : VIEW_W - 54 - mw;
      const my = VIEW_H - 36;
      const level = Math.floor(f.meter / METER_LEVEL);
      const max3 = f.meter >= METER_MAX;
      const part = max3 ? 1 : (f.meter % METER_LEVEL) / METER_LEVEL;
      g.fillStyle(0x05060c, 0.85).fillRect(mx - 3, my - 3, mw + 6, 18);
      // The bar behind shows the level already banked; the bright one is the level filling now.
      const banked = [0x0b2236, 0x1d4f7a, 0x2a78b8, 0x3fb0ff][Math.min(3, level)];
      g.fillStyle(banked, 1).fillRect(mx, my, mw, 12);
      const mwFill = Math.round(mw * part);
      const flash = level > 0 ? 0.75 + 0.25 * Math.abs(Math.sin(s.tick * 0.12)) : 1;
      g.fillStyle(max3 ? C.meterFull : C.meter, flash).fillRect(i === 0 ? mx : mx + mw - mwFill, my, mwFill, 12);
      g.lineStyle(2, level > 0 ? 0xffffff : 0x4aa8e0, 1).strokeRect(mx, my, mw, 12);
      const rally = !s.training && rallying(f);
      if (rally) g.lineStyle(2, 0xff7a2e, 0.5 + 0.5 * Math.abs(Math.sin(s.tick * 0.15))).strokeRect(mx - 2, my - 2, mw + 4, 16);
      this.levels[i].setText(String(level)).setColor(level > 0 ? '#9ff6ff' : '#3a4a6a');
      this.meterLabels[i]
        .setText(max3 ? 'HYPER  MAX' : level > 0 ? 'HYPER  READY' : rally ? 'HYPER  ·  RALLY: HALF COST' : 'HYPER')
        .setColor(level > 0 ? '#9ff6ff' : rally ? '#ff9a4a' : CSS.muted);

      // Heat pill beside the meter: ready (glowing), burning down, or spent for the round.
      const hw = 66;
      const hx = i === 0 ? mx + mw + 14 : mx - 14 - hw;
      const accent = heroInfo(HEROES[f.hero].id).accent;
      g.fillStyle(0x05060c, 0.85).fillRoundedRect(hx - 2, my - 4, hw + 4, 20, 6);
      if (f.heat > 0) {
        const fw = Math.round((hw * f.heat) / HEAT_TICKS);
        g.fillStyle(accent, 0.85 + 0.15 * Math.sin(s.tick * 0.4)).fillRoundedRect(i === 0 ? hx : hx + hw - fw, my - 2, Math.max(6, fw), 16, 5);
      } else if (f.heatUsed === 0) {
        g.fillStyle(accent, 0.25 + 0.2 * Math.abs(Math.sin(s.tick * 0.08))).fillRoundedRect(hx, my - 2, hw, 16, 5);
      }
      g.lineStyle(2, f.heatUsed === 0 || f.heat > 0 ? accent : 0x3a3f5a, 1).strokeRoundedRect(hx, my - 2, hw, 16, 5);
      this.heatLabels[i]
        .setPosition(hx + hw / 2, my + 6)
        .setText(f.heat > 0 ? 'HEAT!' : 'HEAT')
        .setColor(f.heatUsed === 0 || f.heat > 0 ? '#ffffff' : '#5a6080');

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

const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five'];

/** What the announcer says for a banner. */
function spoken(text: string, sub: string): string {
  const t = text.replace(/K\.O\./g, 'Knockout').replace(/"[^"]*"/g, '').replace(/\s+/g, ' ').trim();
  const round = /^ROUND (\d)$/.exec(t);
  let line = round ? `Round ${NUMBERS[+round[1]] ?? round[1]}` : t;
  if (sub === 'WINS THE MATCH') line = `${line} wins!`;
  else if (sub && sub !== 'DRAW' && !sub.includes('.')) line = `${line}. ${sub.replace(/·/g, '. ')}`;
  else if (sub === 'DRAW') line = `${line}. Draw.`;
  return line.toLowerCase().replace(/(^|[.!] )([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
}
