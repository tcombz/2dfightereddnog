// Tournament bracket, for the TV. Two halves meet in the middle at the final, the trophy above.
// Between matches it animates what just happened (the winner's line lights up and their name slides
// into the next round, the loser greys out), then spotlights the next match. A new bracket deals
// everyone in and sends the byes through first. The final crowns the champion.
import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { phones } from '../../input/phones';
import type { PhonePlayer } from '../../input/phones';
import type { PhoneView } from '../../net/padproto';
import { HEROES } from '../../sim';
import { announce, playMusic, sfx } from '../audio';
import { C, CSS, VIEW_H, VIEW_W } from '../config';
import type { TourneyState } from '../config';
import { heroInfo } from '../heroInfo';
import { BYE, TBD, currentMatch, entrantStatus, forfeit, matchLabel, newTourney, roundName, saveTourney } from '../tourney';
import { Menu, backdrop, body, display, fitText, goTo, goldFill } from '../ui';

export interface BracketData {
  tourney: TourneyState;
  cpuLevel?: number;
  /** A new bracket: deal the names in and send the byes through, with a fanfare. */
  intro?: boolean;
}

const TOP = 118;
const BOTTOM = 446;
const PLATE_H = 28;
/** Colours for entrants without a phone colour. */
const PALETTE = ['#3d8bff', '#ff6a3d', '#2ee6a6', '#ffc23d', '#b06bff', '#ff4fa3', '#4fd8ff', '#c8ff4f', '#ff9d4f', '#9fa8ff', '#ff6b6b', '#6bffb8', '#ffd84f', '#7fffd4', '#ff8fd8', '#a0ff6b'];

interface Plate {
  box: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  /** Right-hand tag: OUT for a loser, games won in the final. */
  tag: Phaser.GameObjects.Text;
  x: number;
  y: number;
  w: number;
  side: 0 | 1;
}

/** A line being drawn from a plate to the slot it advances to. */
interface Run {
  pts: Array<{ x: number; y: number }>;
  p: number;
  color: number;
}

export class BracketScene extends Phaser.Scene {
  /** Every phone gets its view from here, seated or not. */
  readonly phoneAll = true;
  private t!: TourneyState;
  private cpuLevel = 1;
  private plates = new Map<string, Plate>();
  private champPlate: Plate | null = null;
  private linesG!: Phaser.GameObjects.Graphics;
  private litG!: Phaser.GameObjects.Graphics;
  private pulseG!: Phaser.GameObjects.Graphics;
  private runs: Run[] = [];
  /** Lines already lit (winners' paths), redrawn every frame. */
  private lit: Run[] = [];
  /** True once the animations are done and the next match can start. */
  private ready = false;
  private steps: Array<() => number> = [];
  private stepTimer: Phaser.Time.TimerEvent | null = null;
  private banner!: Phaser.GameObjects.Container;
  private options: { menu: Menu; objs: Phaser.GameObjects.GameObject[] } | null = null;
  private clock = 0;
  private pw = 96;
  private colW = 118;
  private x0 = 60;

  constructor() {
    super('bracket');
  }

  create(data: BracketData): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.t = data.tourney;
    this.cpuLevel = data.cpuLevel ?? 1;
    saveTourney(this.t);
    this.plates = new Map();
    this.champPlate = null;
    this.runs = [];
    this.lit = [];
    this.ready = false;
    this.steps = [];
    this.stepTimer = null;
    this.options = null;
    this.clock = 0;
    phones.seatFor({ tourney: this.t });
    this.cameras.main.fadeIn(250, 5, 6, 12);
    playMusic(this, 'menu');
    backdrop(this, 'stage_crown', 0.8);

    const R = this.t.rounds.length;
    this.pw = R >= 4 ? 96 : R === 3 ? 128 : 170;
    this.x0 = this.pw / 2 + 12;
    this.colW = R > 1 ? Math.min(230, (VIEW_W / 2 - 18 - this.pw / 2 - this.x0) / (R - 1)) : 0;

    const title = this.add.text(VIEW_W / 2, 14, 'TOURNAMENT', display(30, '#ffffff', 7)).setOrigin(0.5, 0);
    goldFill(title);
    const left = this.t.names.length;
    this.add.text(VIEW_W / 2, 52, `${left} PLAYERS  ·  WIN AND YOU MOVE ON  ·  THE FINAL IS FIRST TO 2`, body(12, CSS.muted)).setOrigin(0.5, 0);
    // Round names over each column.
    for (let r = 0; r < R; r += 1) {
      for (const side of [0, 1] as const) {
        if (r === R - 1 && side === 1) continue;
        const x = r === R - 1 ? VIEW_W / 2 : this.colX(r, side);
        this.add.text(x, TOP - 30, roundName(this.t, r), display(10, CSS.gold, 3)).setOrigin(0.5);
      }
    }

    this.linesG = this.add.graphics();
    this.litG = this.add.graphics();
    this.pulseG = this.add.graphics();
    this.drawLines();
    this.buildPlates(data.intro === true);
    this.buildBanner();

    // What to animate: a new bracket's byes, or the result just played.
    const hide = new Set<string>();
    const queue: Array<{ r: number; k: number }> = [];
    const last = this.t.last;
    if (data.intro) {
      this.t.rounds[0].forEach((m, k) => {
        if (m.a === BYE || m.b === BYE) queue.push({ r: 0, k: m.a === BYE ? 2 * k + 1 : 2 * k });
      });
    } else if (last && !last.draw && last.winner >= 0) {
      const m = this.t.rounds[last.round][last.match];
      queue.push({ r: last.round, k: m.winner === m.a ? 2 * last.match : 2 * last.match + 1 });
    }
    for (const q of queue) hide.add(this.parentKey(q.r, q.k));
    this.refreshPlates(hide);
    this.litDecided(queue);

    const introDelay = data.intro ? 900 + this.plates.size * 40 : 450;
    if (data.intro) {
      this.steps.push(() => {
        sfx(this, 'round', 0.8);
        announce('The bracket is set!');
        return 300;
      });
    }
    queue.forEach((q, n) => this.steps.push(() => this.advance(q.r, q.k, hide, n === queue.length - 1 && !data.intro)));
    if (last?.draw) this.steps.push(() => this.drawAgain());
    this.steps.push(() => {
      this.t = { ...this.t, last: undefined };
      if (this.t.champion >= 0) this.crown();
      else this.spotlight();
      return 0;
    });
    this.stepTimer = this.time.delayedCall(introDelay, () => this.nextStep());
    controls.take();
  }

  // ---------- layout ----------

  private colX(r: number, side: 0 | 1): number {
    const R = this.t.rounds.length;
    if (R === 1) return side === 0 ? VIEW_W / 2 - 130 : VIEW_W / 2 + 130;
    const x = this.x0 + r * this.colW;
    return side === 0 ? x : VIEW_W - x;
  }

  /** Where slot k of round r sits (each match has two slots: 2m and 2m + 1). */
  private slotPos(r: number, k: number): { x: number; y: number; side: 0 | 1 } {
    const R = this.t.rounds.length;
    const mid = (TOP + BOTTOM) / 2;
    if (r === R - 1) {
      const side = (k === 0 ? 0 : 1) as 0 | 1;
      return { x: this.colX(r, side), y: mid, side };
    }
    const count = this.t.size >> r;
    const half = count / 2;
    const side = (k < half ? 0 : 1) as 0 | 1;
    const i = side === 0 ? k : k - half;
    return { x: this.colX(r, side), y: TOP + ((i + 0.5) * (BOTTOM - TOP)) / half, side };
  }

  private champPos(): { x: number; y: number } {
    return { x: VIEW_W / 2, y: (TOP + BOTTOM) / 2 - 96 };
  }

  private key(r: number, k: number): string {
    return `${r}:${k}`;
  }

  /** The slot a winner of slot k in round r moves to (round R means the champion). */
  private parentKey(r: number, k: number): string {
    return this.key(r + 1, k >> 1);
  }

  private entrantAt(r: number, k: number): number {
    if (r >= this.t.rounds.length) return this.t.champion;
    const m = this.t.rounds[r][k >> 1];
    return k % 2 === 0 ? m.a : m.b;
  }

  private colorOf(e: number): string {
    const id = this.t.phones?.[e];
    const p = id ? phones.byId(id) : null;
    return p?.color ?? PALETTE[e % PALETTE.length];
  }

  /** The path from slot (r, k) to the slot it advances to. */
  private path(r: number, k: number): Array<{ x: number; y: number }> {
    const R = this.t.rounds.length;
    const a = this.slotPos(r, k);
    const w = a.side === 0 ? this.pw / 2 : -this.pw / 2;
    const start = { x: a.x + w, y: a.y };
    if (r === R - 1) {
      const c = this.champPos();
      return [start, { x: VIEW_W / 2, y: a.y }, { x: c.x, y: c.y + PLATE_H / 2 + 2 }];
    }
    const p = this.slotPos(r + 1, k >> 1);
    const end = { x: p.x - (p.side === 0 ? this.pw / 2 : -this.pw / 2), y: p.y };
    if (r + 1 === R - 1) end.x = p.x - (a.side === 0 ? this.pw / 2 : -this.pw / 2);
    const mx = (start.x + end.x) / 2;
    return [start, { x: mx, y: a.y }, { x: mx, y: end.y }, end];
  }

  // ---------- drawing ----------

  private drawLines(): void {
    const g = this.linesG;
    g.clear();
    g.lineStyle(2, 0x3a4170, 1);
    const R = this.t.rounds.length;
    for (let r = 0; r < R; r += 1) {
      const n = this.t.size >> r;
      for (let k = 0; k < n; k += 1) {
        if (this.entrantAt(r, k) === BYE) continue;
        const pts = this.path(r, k);
        g.beginPath();
        g.moveTo(pts[0].x, pts[0].y);
        for (const q of pts.slice(1)) g.lineTo(q.x, q.y);
        g.strokePath();
      }
    }
  }

  private makePlate(x: number, y: number, w: number, side: 0 | 1): Plate {
    const g = this.add.graphics();
    const name = this.add.text(-w / 2 + 22, 0, '', display(w > 120 ? 14 : 12, CSS.ink, 3)).setOrigin(0, 0.5);
    const tag = this.add.text(w / 2 - 7, 0, '', display(10, '#ff6a5a', 3)).setOrigin(1, 0.5);
    const box = this.add.container(x, y, [g, name, tag]);
    return { box, g, name, tag, x, y, w, side };
  }

  private paintPlate(p: Plate, e: number, opts: { lost?: boolean; champ?: boolean; score?: number } = {}): void {
    const { g, name, tag, w } = p;
    g.clear();
    tag.setText(e >= 0 && opts.lost ? 'OUT' : e >= 0 && opts.score !== undefined ? String(opts.score) : '');
    tag.setColor(opts.lost ? '#ff6a5a' : CSS.gold).setFontSize(opts.lost ? 10 : 16);
    const h = opts.champ ? PLATE_H + 8 : PLATE_H;
    if (e === TBD) {
      g.lineStyle(2, 0x2b3263, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 7);
      name.setText('');
      return;
    }
    if (e === BYE) {
      g.fillStyle(0x0b0e1c, 0.5).fillRoundedRect(-w / 2, -h / 2, w, h, 7);
      name.setText('BYE').setColor('#4a5280').setX(-w / 2 + 12);
      fitText(name, w - 20);
      return;
    }
    const col = Phaser.Display.Color.HexStringToColor(this.colorOf(e)).color;
    g.fillStyle(opts.champ ? 0x2a1d05 : 0x0b0e1c, opts.lost ? 0.6 : 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, 7);
    g.lineStyle(opts.champ ? 3 : 2, opts.champ ? C.gold : col, opts.lost ? 0.35 : 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 7);
    g.fillStyle(col, opts.lost ? 0.35 : 1).fillCircle(-w / 2 + 11, 0, 5);
    name.setText(this.t.names[e]).setColor(opts.lost ? '#5a6290' : opts.champ ? '#ffe9a8' : CSS.ink).setX(-w / 2 + 22);
    name.setScale(1);
    fitText(name, w - (tag.text ? 34 + tag.width : 30));
  }

  private buildPlates(intro: boolean): void {
    const R = this.t.rounds.length;
    let order = 0;
    for (let r = 0; r < R; r += 1) {
      const n = this.t.size >> r;
      for (let k = 0; k < n; k += 1) {
        const pos = this.slotPos(r, k);
        const plate = this.makePlate(pos.x, pos.y, this.pw, pos.side);
        this.plates.set(this.key(r, k), plate);
        if (intro) {
          // Deal the names in from the sides, first round first.
          plate.box.setX(pos.side === 0 ? -200 : VIEW_W + 200).setAlpha(0);
          this.tweens.add({ targets: plate.box, x: pos.x, alpha: 1, duration: 360, delay: 200 + order * 40, ease: 'Cubic.easeOut' });
          order += 1;
        }
      }
    }
    // The champion's plate, under a trophy.
    const c = this.champPos();
    this.champPlate = this.makePlate(c.x, c.y, Math.max(170, this.pw + 40), 0);
    this.drawTrophy(c.x, c.y - 44);
    this.add.text(VIEW_W / 2, (TOP + BOTTOM) / 2 + 26, 'FIRST TO 2', body(11, CSS.muted)).setOrigin(0.5, 0);
  }

  private drawTrophy(x: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(C.gold, 1);
    g.fillPoints([{ x: x - 20, y: y - 18 }, { x: x + 20, y: y - 18 }, { x: x + 13, y: y + 4 }, { x: x - 13, y: y + 4 }], true);
    g.fillEllipse(x, y + 4, 26, 12);
    g.fillRect(x - 3, y + 6, 6, 9);
    g.fillRect(x - 12, y + 14, 24, 5);
    g.lineStyle(4, C.gold, 1);
    g.strokeCircle(x - 21, y - 9, 7);
    g.strokeCircle(x + 21, y - 9, 7);
    g.fillStyle(0xfff2b0, 0.9).fillRect(x - 12, y - 15, 4, 12);
  }

  /** Fill every plate from the bracket, leaving `hide` empty (they are about to animate in). */
  private refreshPlates(hide: Set<string>): void {
    const R = this.t.rounds.length;
    for (let r = 0; r < R; r += 1) {
      const n = this.t.size >> r;
      for (let k = 0; k < n; k += 1) {
        const plate = this.plates.get(this.key(r, k))!;
        const key = this.key(r, k);
        const e = hide.has(key) ? TBD : this.entrantAt(r, k);
        const m = this.t.rounds[r][k >> 1];
        const lost = e >= 0 && m.winner >= 0 && m.winner !== e;
        // The final shows games won.
        const score = r === R - 1 && m.a >= 0 && m.b >= 0 ? m.score[k % 2] : undefined;
        this.paintPlate(plate, e, { lost, score });
      }
    }
    const champHidden = hide.has(this.key(R, 0));
    if (this.champPlate) this.paintPlate(this.champPlate, champHidden ? TBD : this.t.champion, { champ: true });
  }

  /** Light the paths of everyone already through (except the ones about to animate). */
  private litDecided(skip: Array<{ r: number; k: number }>): void {
    const R = this.t.rounds.length;
    for (let r = 0; r < R; r += 1) {
      this.t.rounds[r].forEach((m, mi) => {
        if (m.winner < 0) return;
        const k = m.winner === m.a ? 2 * mi : 2 * mi + 1;
        if (skip.some((s) => s.r === r && s.k === k)) return;
        this.lit.push({ pts: this.path(r, k), p: 1, color: Phaser.Display.Color.HexStringToColor(this.colorOf(m.winner)).color });
      });
    }
  }

  private buildBanner(): void {
    const g = this.add.graphics();
    g.fillStyle(0x05060c, 0.92).fillRect(0, 0, VIEW_W, 76);
    g.fillStyle(C.gold, 1).fillRect(0, 0, VIEW_W, 3);
    const label = this.add.text(VIEW_W / 2, 12, '', display(13, CSS.gold, 3)).setOrigin(0.5, 0);
    const a = this.add.text(VIEW_W / 2 - 46, 44, '', display(28, '#ffffff', 6)).setOrigin(1, 0.5);
    const vs = this.add.text(VIEW_W / 2, 44, 'VS', display(22, CSS.gold, 5)).setOrigin(0.5);
    const b = this.add.text(VIEW_W / 2 + 46, 44, '', display(28, '#ffffff', 6)).setOrigin(0, 0.5);
    const hint = this.add.text(VIEW_W - 14, 66, '', body(11, CSS.muted)).setOrigin(1, 0.5);
    this.banner = this.add.container(0, VIEW_H, [g, label, a, vs, b, hint]).setDepth(20);
    this.banner.setData({ label, a, b, hint });
  }

  // ---------- the show ----------

  private nextStep(): void {
    this.stepTimer = null;
    const step = this.steps.shift();
    if (!step) return;
    const wait = step();
    this.stepTimer = this.time.delayedCall(Math.max(0, wait), () => this.nextStep());
  }

  /** Skip to the end of the animations (someone pressed OK). */
  private hurry(): void {
    this.stepTimer?.remove();
    this.stepTimer = null;
    for (const r of this.runs) r.p = 1;
    while (this.steps.length > 0) this.steps.shift()!();
  }

  /** The winner of slot (r, k) moves on: their line lights up, then their name lands. */
  private advance(r: number, k: number, hide: Set<string>, loud: boolean): number {
    const e = this.entrantAt(r, k);
    const color = Phaser.Display.Color.HexStringToColor(this.colorOf(e)).color;
    const run: Run = { pts: this.path(r, k), p: 0, color };
    this.runs.push(run);
    const from = this.plates.get(this.key(r, k));
    if (from) this.tweens.add({ targets: from.box, scale: 1.12, duration: 140, yoyo: true });
    sfx(this, 'whoosh_light', 0.6);
    // The loser greys out.
    if (r < this.t.rounds.length) {
      const sib = this.plates.get(this.key(r, k ^ 1));
      const se = this.entrantAt(r, k ^ 1);
      if (sib && se >= 0) {
        this.paintPlate(sib, se, { lost: true });
        this.tweens.add({ targets: sib.box, x: sib.x + (sib.side === 0 ? -6 : 6), duration: 60, yoyo: true, repeat: 2 });
      }
    }
    this.time.delayedCall(460, () => {
      run.p = 1;
      const key = this.parentKey(r, k);
      hide.delete(key);
      const R = this.t.rounds.length;
      const target = r + 1 >= R ? this.champPlate : this.plates.get(key);
      if (target) {
        this.paintPlate(target, e, { champ: r + 1 >= R });
        target.box.setScale(1.5).setAlpha(0.2);
        this.tweens.add({ targets: target.box, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
      }
      sfx(this, loud ? 'ui_confirm' : 'ui_move', loud ? 1 : 0.7);
      if (loud) {
        sfx(this, 'crowd', 0.45);
        this.cameras.main.shake(120, 0.003);
      }
    });
    return loud ? 900 : 360;
  }

  private drawAgain(): number {
    const cur = currentMatch(this.t);
    if (!cur) return 0;
    const t = this.add.text(VIEW_W / 2, (TOP + BOTTOM) / 2 + 60, 'DRAW: PLAY IT AGAIN!', display(26, '#ffffff', 6)).setOrigin(0.5).setDepth(15);
    goldFill(t);
    t.setScale(2).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1600, duration: 300 });
    sfx(this, 'ui_move');
    return 1200;
  }

  /** The next match: its two plates pulse, the banner slides up with the names. */
  private spotlight(): void {
    const cur = currentMatch(this.t);
    if (!cur) return;
    this.ready = true;
    const { label, a, b, hint } = this.banner.data.values as Record<string, Phaser.GameObjects.Text>;
    label.setText(`UP NEXT  ·  ${matchLabel(this.t, cur.round, cur.match)}`);
    const final = cur.round === this.t.rounds.length - 1;
    const score = final ? `  (${cur.m.score[0]})` : '';
    const scoreB = final ? `(${cur.m.score[1]})  ` : '';
    a.setText(`${this.t.names[cur.m.a]}${score}`).setColor(this.colorOf(cur.m.a));
    b.setText(`${scoreB}${this.t.names[cur.m.b]}`).setColor(this.colorOf(cur.m.b));
    fitText(a, VIEW_W / 2 - 80);
    fitText(b, VIEW_W / 2 - 80);
    hint.setText(this.t.phones ? 'Players: press OK on your phones  ·  BACK for options' : 'OK to fight  ·  BACK for options');
    this.tweens.add({ targets: this.banner, y: VIEW_H - 76, duration: 320, ease: 'Back.easeOut' });
    sfx(this, 'round', 0.6);
    announce(`Up next: ${this.t.names[cur.m.a]} versus ${this.t.names[cur.m.b]}`);
    phones.seatFor({ tourney: this.t });
  }

  /** The tournament is won. */
  private crown(): void {
    this.ready = true;
    const e = this.t.champion;
    const pick = this.t.picks[e]?.[0] ?? -1;
    const shade = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05060c, 0.7).setOrigin(0, 0).setDepth(30).setAlpha(0);
    this.tweens.add({ targets: shade, alpha: 1, duration: 500 });
    if (pick >= 0 && this.textures.exists(`sheet_${HEROES[pick].id}`)) {
      const art = this.add.image(VIEW_W / 2 + 230, VIEW_H + 10, `sheet_${HEROES[pick].id}`).setOrigin(0.5, 1).setDepth(31).setAlpha(0);
      art.setScale(440 / art.height);
      this.tweens.add({ targets: art, alpha: 1, x: VIEW_W / 2 + 200, duration: 600, delay: 300, ease: 'Cubic.easeOut' });
    }
    const top = this.add.text(VIEW_W / 2 - 120, 150, 'CHAMPION', display(64, '#ffffff', 10)).setOrigin(0.5).setDepth(32).setScale(3).setAlpha(0);
    goldFill(top);
    const who = this.add.text(VIEW_W / 2 - 120, 240, this.t.names[e], display(48, this.colorOf(e), 8)).setOrigin(0.5).setDepth(32).setAlpha(0);
    fitText(who, 520);
    const hero = pick >= 0 ? heroInfo(HEROES[pick].id).name : '';
    const sub = this.add
      .text(VIEW_W / 2 - 120, 300, `${hero ? `WITH ${hero}  ·  ` : ''}LAST ONE STANDING OF ${this.t.names.length}`, display(14, CSS.ink, 4))
      .setOrigin(0.5)
      .setDepth(32)
      .setAlpha(0);
    this.tweens.add({ targets: top, scale: 1, alpha: 1, duration: 360, delay: 200, ease: 'Back.easeOut', onComplete: () => this.cameras.main.shake(260, 0.01) });
    this.tweens.add({ targets: [who, sub], alpha: 1, duration: 400, delay: 700 });
    this.add.text(VIEW_W / 2 - 120, 470, 'OK: new tournament or back to the lobby', body(13, CSS.muted)).setOrigin(0.5).setDepth(32);
    this.confetti();
    sfx(this, 'super', 0.8);
    sfx(this, 'crowd', 0.8);
    this.cameras.main.flash(300, 255, 230, 140);
    announce(`${this.t.names[e]} is the champion!`);
  }

  private confetti(): void {
    const colors = [0xffc23d, 0xffffff, 0x3d8bff, 0xff6a3d, 0x2ee6a6, 0xb06bff];
    for (let i = 0; i < 90; i += 1) {
      const bit = this.add
        .rectangle(Math.random() * VIEW_W, -20 - Math.random() * VIEW_H, 6 + Math.random() * 6, 10 + Math.random() * 8, colors[i % colors.length])
        .setDepth(33)
        .setAngle(Math.random() * 360);
      this.tweens.add({
        targets: bit,
        y: VIEW_H + 30,
        x: bit.x + (Math.random() - 0.5) * 160,
        angle: bit.angle + 360 + Math.random() * 360,
        duration: 2600 + Math.random() * 2200,
        repeat: -1,
        delay: Math.random() * 1500,
      });
    }
  }

  // ---------- choices ----------

  private startMatch(): void {
    if (!this.ready || this.options || this.t.champion >= 0) return;
    sfx(this, 'ui_confirm');
    goTo(this, 'select', { mode: 'versus', cpuLevel: this.cpuLevel, tourney: { ...this.t, last: undefined } });
  }

  private openOptions(): void {
    if (this.options) return;
    const cur = currentMatch(this.t);
    const items: Array<{ label: string; onSelect: () => void }> = [];
    if (this.t.champion >= 0) {
      items.push({ label: 'NEW TOURNAMENT', onSelect: () => this.restart() });
    } else {
      items.push({ label: 'BACK TO THE BRACKET', onSelect: () => this.closeOptions() });
      if (cur) {
        items.push({ label: `${this.t.names[cur.m.a]} GOES THROUGH`, onSelect: () => this.forfeitTo(0) });
        items.push({ label: `${this.t.names[cur.m.b]} GOES THROUGH`, onSelect: () => this.forfeitTo(1) });
      }
    }
    items.push({ label: this.t.phones ? 'END: BACK TO THE LOBBY' : 'END TOURNAMENT', onSelect: () => this.end() });
    const shade = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05060c, 0.8).setOrigin(0, 0).setDepth(40);
    const head = this.add
      .text(VIEW_W / 2, 170, this.t.champion >= 0 ? 'WHAT NOW?' : 'OPTIONS  ·  SOMEONE LEFT? SEND THE OTHER THROUGH', display(16, CSS.gold, 4))
      .setOrigin(0.5)
      .setDepth(41);
    const menu = new Menu(this, VIEW_W / 2 - 220, 230, items, 440, 46, 20);
    menu.setDepth(41);
    this.options = { menu, objs: [shade, head, ...menu.objects] };
    sfx(this, 'ui_confirm', 0.7);
  }

  private closeOptions(): void {
    this.options?.objs.forEach((o) => o.destroy());
    this.options = null;
  }

  private forfeitTo(side: 0 | 1): void {
    this.closeOptions();
    goTo(this, 'bracket', { tourney: forfeit(this.t, side), cpuLevel: this.cpuLevel } satisfies BracketData, 200);
  }

  private restart(): void {
    // Same players, new draw (phones that have left drop out).
    const ids = this.t.phones;
    let names = this.t.names;
    let keep = ids;
    if (ids) {
      const here = ids.map((id, i) => ({ id, name: phones.byId(id)?.name ?? names[i], on: phones.byId(id)?.conn != null }));
      const on = here.filter((h) => h.on);
      const list = on.length >= 2 ? on : here;
      names = list.map((h) => h.name);
      keep = list.map((h) => h.id);
    }
    goTo(this, 'bracket', { tourney: newTourney(names, keep), cpuLevel: this.cpuLevel, intro: true } satisfies BracketData, 300);
  }

  private end(): void {
    saveTourney(null);
    goTo(this, this.t.phones ? 'phones' : 'party', {}, 250);
  }

  // ---------- phones ----------

  phoneView(seat: number, p: PhonePlayer): Partial<PhoneView> {
    const e = this.t.phones ? this.t.phones.indexOf(p.id) : -1;
    const st = entrantStatus(this.t, e);
    if (seat >= 0 && this.t.champion < 0 && this.ready && !this.options) {
      return { screen: 'remote', say: "YOU'RE UP!", sub: `${st.sub}  ·  press OK when you're both ready` };
    }
    if (this.options && seat >= 0) return { screen: 'remote', say: 'OPTIONS', sub: 'Choose on the TV.' };
    return { screen: 'wait', say: st.say, sub: st.sub };
  }

  // ---------- each frame ----------

  update(_t: number, delta: number): void {
    this.clock += delta;
    controls.poll();
    for (const e of controls.take()) {
      if (this.options) {
        if (e.action === 'back' || e.action === 'pause') this.closeOptions();
        else this.options.menu.handle(e.action);
        continue;
      }
      if (e.action === 'confirm') {
        if (!this.ready) this.hurry();
        else if (this.t.champion >= 0) this.openOptions();
        else this.startMatch();
      } else if (e.action === 'back' || e.action === 'pause') {
        if (!this.ready) this.hurry();
        this.openOptions();
      }
    }
    // Lines: the ones lit, and the ones being drawn.
    for (const r of this.runs) if (r.p < 1) r.p = Math.min(1, r.p + delta / 420);
    const g = this.litG;
    g.clear();
    for (const r of [...this.lit, ...this.runs]) this.strokeRun(g, r);
    // The next match pulses.
    const pg = this.pulseG;
    pg.clear();
    const cur = this.ready && this.t.champion < 0 ? currentMatch(this.t) : null;
    if (cur) {
      const a = 0.45 + 0.45 * Math.sin(this.clock * 0.008);
      for (const k of [2 * cur.match, 2 * cur.match + 1]) {
        const pl = this.plates.get(this.key(cur.round, k));
        if (!pl) continue;
        pg.lineStyle(3, C.gold, a).strokeRoundedRect(pl.x - pl.w / 2 - 5, pl.y - PLATE_H / 2 - 5, pl.w + 10, PLATE_H + 10, 10);
      }
    }
  }

  /** Draw the first `p` of a polyline, with a soft glow under it. */
  private strokeRun(g: Phaser.GameObjects.Graphics, r: Run): void {
    const segs: number[] = [];
    let total = 0;
    for (let i = 1; i < r.pts.length; i += 1) {
      const d = Math.hypot(r.pts[i].x - r.pts[i - 1].x, r.pts[i].y - r.pts[i - 1].y);
      segs.push(d);
      total += d;
    }
    let left = total * r.p;
    for (const [width, alpha] of [[8, 0.18], [3, 1]] as const) {
      left = total * r.p;
      g.lineStyle(width, r.color, alpha);
      g.beginPath();
      g.moveTo(r.pts[0].x, r.pts[0].y);
      for (let i = 1; i < r.pts.length && left > 0; i += 1) {
        const d = segs[i - 1];
        const f = Math.min(1, left / d);
        g.lineTo(r.pts[i - 1].x + (r.pts[i].x - r.pts[i - 1].x) * f, r.pts[i - 1].y + (r.pts[i].y - r.pts[i - 1].y) * f);
        left -= d;
      }
      g.strokePath();
    }
  }
}
