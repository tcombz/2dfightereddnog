import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { HEROES } from '../../sim';
import { playMusic, sfx } from '../audio';
import { C, CSS, VIEW_H, VIEW_W } from '../config';
import type { MatchSetup } from '../config';
import { artFor, frameName } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { STAGES } from '../stages';
import { body, display, goTo, goldFill, stripes } from '../ui';

const TILE = 92;
const RATING_NAMES: Array<[keyof ReturnType<typeof heroInfo>['ratings'], string]> = [
  ['power', 'POWER'],
  ['speed', 'SPEED'],
  ['range', 'RANGE'],
  ['defense', 'DEFENSE'],
  ['technique', 'TECHNIQUE'],
];

interface Side {
  cursor: number;
  locked: boolean;
  preview: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  style: Phaser.GameObjects.Text;
  tagline: Phaser.GameObjects.Text;
  ready: Phaser.GameObjects.Text;
  lockedAt: number;
}

export class SelectScene extends Phaser.Scene {
  private setup!: MatchSetup;
  private sides: Side[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private tiles: Phaser.GameObjects.Image[] = [];
  private phase: 'heroes' | 'stage' = 'heroes';
  private stage = 0;
  private stageBg!: Phaser.GameObjects.Image;
  private stageCards: Phaser.GameObjects.Image[] = [];
  private stageNames: Phaser.GameObjects.Text[] = [];
  private header!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private ratingLabels: Phaser.GameObjects.Text[] = [];
  private clock = 0;

  constructor() {
    super('select');
  }

  /** Roster size plus the random tile. */
  private get slots(): number {
    return HEROES.length + 1;
  }

  create(data: Partial<MatchSetup>): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.setup = { mode: data.mode ?? 'cpu', p1: 0, p2: 1, stage: 0, cpuLevel: data.cpuLevel ?? 1 };
    this.phase = 'heroes';
    this.stage = Math.floor(Math.random() * STAGES.length);
    this.cameras.main.fadeIn(250, 5, 6, 12);
    playMusic(this, 'menu');

    this.stageBg = this.add.image(0, 0, `stage_${STAGES[this.stage].id}`).setOrigin(0, 0).setScale(VIEW_H / 320).setAlpha(0.5);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, C.night, 0.55).setOrigin(0, 0);
    const deco = this.add.graphics();
    stripes(deco, 0, 0, VIEW_W / 2 - 60, VIEW_H, C.p1, 0.07);
    stripes(deco, VIEW_W / 2 + 60, 0, VIEW_W / 2 - 60, VIEW_H, C.p2, 0.07);
    this.g = this.add.graphics();

    this.header = this.add.text(VIEW_W / 2, 34, 'CHOOSE YOUR FIGHTER', display(32, '#ffffff', 7)).setOrigin(0.5);
    goldFill(this.header);
    const vsLabel = this.setup.mode === 'versus' ? 'PLAYER 2' : this.setup.mode === 'training' ? 'DUMMY' : 'CPU';
    this.add.text(30, 70, 'PLAYER 1', display(16, CSS.p1, 4));
    this.add.text(VIEW_W - 30, 70, vsLabel, display(16, CSS.p2, 4)).setOrigin(1, 0);

    // Roster tiles: every hero, then random.
    const total = this.slots * (TILE + 14) - 14;
    const x0 = VIEW_W / 2 - total / 2 + TILE / 2;
    this.tiles = [];
    for (let i = 0; i < this.slots; i += 1) {
      const x = x0 + i * (TILE + 14);
      if (i < HEROES.length) {
        this.tiles.push(this.add.image(x, 446, `portrait_${HEROES[i].id}`).setDisplaySize(TILE, TILE));
      } else {
        this.tiles.push(this.add.image(x, 446, 'fx_glow').setDisplaySize(TILE, TILE).setAlpha(0));
        this.add.text(x, 446, '?', display(48, CSS.gold, 6)).setOrigin(0.5);
      }
    }

    this.ratingLabels = [];
    this.sides = [0, 1].map((i) => {
      const x = i === 0 ? 340 : VIEW_W - 340;
      const art = artFor(i);
      const preview = this.add
        .image(x, 392, art.key, frameName('idle', 0))
        .setOrigin(art.feetX / art.cell, art.feetY / art.cell)
        .setScale(2.3)
        .setFlipX(i === 1);
      const align = i === 0 ? 0 : 1;
      const tx = i === 0 ? 32 : VIEW_W - 32;
      return {
        cursor: i === 0 ? 0 : Math.min(1, HEROES.length - 1),
        locked: false,
        preview,
        name: this.add.text(tx, 98, '', display(26, CSS.ink, 6)).setOrigin(align, 0),
        style: this.add.text(tx, 130, '', body(14, CSS.muted)).setOrigin(align, 0),
        tagline: this.add.text(tx, 150, '', body(15, CSS.gold)).setOrigin(align, 0),
        ready: this.add.text(x, 112, 'READY', display(30, '#ffffff', 7)).setOrigin(0.5).setVisible(false),
        lockedAt: 0,
      };
    });

    // Rating labels beside the bars.
    for (let i = 0; i < 2; i += 1) {
      RATING_NAMES.forEach(([, label], row) => {
        const t = this.add.text(i === 0 ? 32 : VIEW_W - 32, 182 + row * 18, label, body(12, CSS.muted)).setOrigin(i === 0 ? 0 : 1, 0);
        this.ratingLabels.push(t);
      });
    }

    // Stage select row (hidden until both fighters are locked in).
    this.stageCards = STAGES.map((st, i) =>
      this.add.image(VIEW_W / 2 + (i - 1) * 250, 300, `stage_${st.id}`).setDisplaySize(230, 96).setVisible(false),
    );
    this.stageNames = STAGES.map((st, i) =>
      this.add.text(VIEW_W / 2 + (i - 1) * 250, 362, st.name, display(16, CSS.ink, 4)).setOrigin(0.5).setVisible(false),
    );

    this.hint = this.add.text(VIEW_W / 2, VIEW_H - 14, '', body(13, CSS.muted)).setOrigin(0.5, 1);
    this.refresh();
    controls.take();
  }

  /** Which side the menu input moves right now (one person picks both in CPU and training). */
  private activeSide(player: number): number {
    if (this.setup.mode === 'versus') return player === 1 ? 1 : player === 0 ? 0 : this.sides[0].locked ? 1 : 0;
    return this.sides[0].locked ? 1 : 0;
  }

  private refresh(): void {
    for (let i = 0; i < 2; i += 1) {
      const side = this.sides[i];
      const hero = side.cursor < HEROES.length ? side.cursor : -1;
      if (hero >= 0) {
        const info = heroInfo(HEROES[hero].id);
        const art = artFor(hero);
        side.preview.setTexture(art.key, frameName('idle', 0)).setVisible(true).setOrigin(art.feetX / art.cell, art.feetY / art.cell);
        side.name.setText(info.title);
        side.style.setText(info.style);
        side.tagline.setText(`"${info.tagline}"`);
      } else {
        side.preview.setVisible(false);
        side.name.setText('RANDOM');
        side.style.setText('Let fate pick.');
        side.tagline.setText('');
      }
    }
    const who = this.setup.mode === 'versus' ? 'Each player: move and confirm' : this.sides[0].locked ? 'Now pick the opponent' : 'Pick your fighter';
    this.hint.setText(
      this.phase === 'stage'
        ? 'Choose a stage  ·  Left / Right  ·  Confirm: Enter, F or A  ·  Back: Esc, G or B'
        : `${who}  ·  Confirm: Enter, F or A  ·  Back: Esc, G or B`,
    );
  }

  private lock(i: number): void {
    const side = this.sides[i];
    if (side.cursor >= HEROES.length) side.cursor = Math.floor(Math.random() * HEROES.length);
    side.locked = true;
    side.lockedAt = this.clock;
    side.ready.setVisible(true).setScale(1.6);
    this.tweens.add({ targets: side.ready, scale: 1, duration: 200, ease: 'Back.easeOut' });
    sfx(this, 'ui_confirm');
    sfx(this, HEROES[side.cursor].id === 'rogue' ? 'zap' : 'scratch', 0.6);
    this.refresh();
    if (this.sides[0].locked && this.sides[1].locked) this.time.delayedCall(450, () => this.openStages());
  }

  private openStages(): void {
    this.phase = 'stage';
    this.header.setText('CHOOSE A STAGE');
    goldFill(this.header);
    this.stageCards.forEach((c) => c.setVisible(true));
    this.stageNames.forEach((t) => t.setVisible(true));
    this.setFighterInfoVisible(false);
    this.refresh();
  }

  private setFighterInfoVisible(v: boolean): void {
    for (const side of this.sides) {
      side.preview.setAlpha(v ? 1 : 0.3);
      for (const t of [side.name, side.style, side.tagline, side.ready]) t.setAlpha(v ? 1 : 0);
    }
    for (const t of this.ratingLabels) t.setVisible(v);
  }

  private back(i: number): void {
    if (this.phase === 'stage') {
      this.phase = 'heroes';
      this.header.setText('CHOOSE YOUR FIGHTER');
      goldFill(this.header);
      this.stageCards.forEach((c) => c.setVisible(false));
      this.stageNames.forEach((t) => t.setVisible(false));
      this.setFighterInfoVisible(true);
      this.sides[1].locked = false;
      this.sides[1].ready.setVisible(false);
      this.refresh();
      return;
    }
    const side = this.sides[i];
    if (side.locked) {
      side.locked = false;
      side.ready.setVisible(false);
    } else if (i === 1 && this.setup.mode !== 'versus' && this.sides[0].locked) {
      this.sides[0].locked = false;
      this.sides[0].ready.setVisible(false);
    } else {
      goTo(this, 'title', { skipIntro: true });
      return;
    }
    this.refresh();
  }

  update(_t: number, delta: number): void {
    this.clock += delta;
    const tick = Math.floor(this.clock / (1000 / 60));
    controls.poll();
    for (const e of controls.take()) {
      if (this.phase === 'stage') {
        if (e.action === 'left' || e.action === 'right') {
          this.stage = (this.stage + (e.action === 'left' ? -1 : 1) + STAGES.length) % STAGES.length;
          this.stageBg.setTexture(`stage_${STAGES[this.stage].id}`);
          sfx(this, 'ui_move', 0.8);
        } else if (e.action === 'confirm') {
          sfx(this, 'ui_confirm');
          this.setup.p1 = this.sides[0].cursor;
          this.setup.p2 = this.sides[1].cursor;
          this.setup.stage = this.stage;
          goTo(this, 'versus', this.setup, 300);
        } else if (e.action === 'back' || e.action === 'pause') this.back(1);
        continue;
      }
      const i = this.activeSide(e.player);
      const side = this.sides[i];
      if (e.action === 'back' || e.action === 'pause') this.back(i);
      else if (side.locked) continue;
      else if (e.action === 'left' || e.action === 'right') {
        side.cursor = (side.cursor + (e.action === 'left' ? -1 : 1) + this.slots) % this.slots;
        sfx(this, 'ui_move', 0.8);
        this.refresh();
      } else if (e.action === 'confirm') this.lock(i);
    }

    // Previews: idle, or the win pose once locked.
    this.sides.forEach((side, i) => {
      if (!side.preview.visible) return;
      const art = artFor(side.cursor);
      if (side.locked) {
        const t = Math.floor((this.clock - side.lockedAt) / (1000 / 60));
        side.preview.setFrame(frameName('win', art.win[Math.min(art.win.length - 1, Math.floor(t / 6))]));
      } else side.preview.setFrame(frameName('idle', art.idle[Math.floor((tick + i * 17) / 9) % art.idle.length]));
    });
    this.draw(tick);
  }

  private draw(tick: number): void {
    const g = this.g;
    g.clear();
    // Ratings.
    for (let i = 0; i < 2; i += 1) {
      const side = this.sides[i];
      if (side.cursor >= HEROES.length || this.phase === 'stage') continue;
      const r = heroInfo(HEROES[side.cursor].id).ratings;
      RATING_NAMES.forEach(([k], row) => {
        const y = 186 + row * 18;
        for (let s = 0; s < 5; s += 1) {
          const x = i === 0 ? 112 + s * 22 : VIEW_W - 112 - (s + 1) * 22 + 4;
          g.fillStyle(s < r[k] ? (i === 0 ? C.p1 : C.p2) : 0x232845, 1).fillRect(x, y, 18, 9);
        }
      });
    }
    // Tiles and cursors.
    this.tiles.forEach((t, k) => {
      g.fillStyle(C.panel, 0.95).fillRect(t.x - TILE / 2 - 4, t.y - TILE / 2 - 4, TILE + 8, TILE + 8);
      g.lineStyle(2, C.panelEdge, 1).strokeRect(t.x - TILE / 2 - 4, t.y - TILE / 2 - 4, TILE + 8, TILE + 8);
      for (let i = 0; i < 2; i += 1) {
        const side = this.sides[i];
        if (side.cursor !== k || this.phase === 'stage') continue;
        const color = i === 0 ? C.p1 : C.p2;
        const blink = side.locked ? 1 : 0.65 + 0.35 * Math.sin(tick * 0.2);
        const pad = 8 + i * 6;
        g.lineStyle(4, color, blink).strokeRect(t.x - TILE / 2 - pad, t.y - TILE / 2 - pad, TILE + pad * 2, TILE + pad * 2);
        g.fillStyle(color, 1).fillRect(i === 0 ? t.x - TILE / 2 - pad : t.x + TILE / 2 + pad - 30, t.y - TILE / 2 - pad - 16, 30, 16);
      }
    });
    // Stage cards.
    if (this.phase === 'stage') {
      this.stageCards.forEach((c, k) => {
        const on = k === this.stage;
        c.setAlpha(on ? 1 : 0.45);
        g.lineStyle(on ? 4 : 2, on ? C.gold : C.panelEdge, 1).strokeRect(c.x - 117, c.y - 50, 234, 100);
        this.stageNames[k].setColor(on ? CSS.gold : CSS.muted);
      });
    }
  }
}
