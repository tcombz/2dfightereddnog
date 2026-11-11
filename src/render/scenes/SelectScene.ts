import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { HEROES } from '../../sim';
import { playMusic, sfx } from '../audio';
import { C, CSS, VIEW_H, VIEW_W } from '../config';
import { CPU_LEVELS } from '../config';
import type { MatchSetup } from '../config';
import { arcadeSetup, newArcadeRun } from '../arcade';
import { artFor, feetOrigin, frameName, menuScale } from '../heroArt';
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
  /** Classic or simple specials, picked per player with up and down. */
  controls: Phaser.GameObjects.Text;
  lockedAt: number;
}

export class SelectScene extends Phaser.Scene {
  private setup!: MatchSetup;
  private sides: Side[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private tiles: Phaser.GameObjects.Image[] = [];
  private phase: 'heroes' | 'stage' = 'heroes';
  /** Arcade: only player 1 picks; the opponents come from the ladder. */
  private arcade = false;
  private arcadeTimer: Phaser.Time.TimerEvent | null = null;
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

  create(data: Partial<MatchSetup> & { arcadeStart?: boolean }): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.arcade = data.arcadeStart === true;
    this.arcadeTimer = null;
    const mode = data.mode ?? 'cpu';
    const simple = (this.registry.get('simple') as boolean | undefined) ?? false;
    this.setup = {
      mode,
      p1: 0,
      p2: 1,
      stage: 0,
      cpuLevel: data.cpuLevel ?? 1,
      party: data.party,
      simple: data.simple ? [...data.simple] : [simple, simple && mode === 'versus'],
    };
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
    const party = this.setup.party;
    const vsLabel = party
      ? party.names[party.sides[1]]
      : this.arcade
        ? 'ARCADE'
        : this.setup.mode === 'versus'
          ? 'PLAYER 2'
          : this.setup.mode === 'training'
            ? 'DUMMY'
            : 'CPU';
    const p1Label = this.add.text(30, 70, party ? party.names[party.sides[0]] : 'PLAYER 1', display(16, CSS.p1, 4));
    const p2Label = this.add.text(VIEW_W - 30, 70, vsLabel, display(16, CSS.p2, 4)).setOrigin(1, 0);
    if (party) {
      this.add.text(VIEW_W / 2, 64, `PARTY  ·  MATCH ${party.matches + 1}`, display(13, CSS.gold, 3)).setOrigin(0.5, 0);
      if (party.streak > 1 && party.lastWinner !== undefined) {
        const champSide = party.sides.indexOf(party.lastWinner);
        if (champSide >= 0) {
          const label = champSide === 0 ? p1Label : p2Label;
          label.setText(`${label.text}  ★${party.streak}`);
        }
      }
    }

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
        .setOrigin(...feetOrigin(art, i === 1))
        .setScale(menuScale(art, 2.3))
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
        controls: this.add.text(i === 0 ? 32 : VIEW_W - 32, 290, '', body(13, CSS.ink)).setOrigin(align, 0),
        lockedAt: 0,
      };
    });

    // Rating labels beside the bars.
    for (let i = 0; i < 2; i += 1) {
      RATING_NAMES.forEach(([, label], row) => {
        const t = this.add.text(i === 0 ? 32 : VIEW_W - 32, 182 + row * 18, label, body(12, CSS.muted)).setOrigin(i === 0 ? 0 : 1, 0);
        if (i === 1 && this.arcade) t.setVisible(false);
        else this.ratingLabels.push(t);
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
    // Winner stays on with the same fighter (they can still change).
    if (data.p1 !== undefined) this.sides[0].cursor = data.p1;
    if (data.p2 !== undefined) this.sides[1].cursor = data.p2;
    this.refresh();
    controls.take();
  }

  /** Which side the menu input moves right now (one person picks both in CPU and training). */
  private activeSide(player: number): number {
    if (this.setup.mode === 'versus') return player === 1 ? 1 : player === 0 ? 0 : this.sides[0].locked ? 1 : 0;
    return this.sides[0].locked && !this.arcade ? 1 : 0;
  }

  /** Sides a person plays (the CPU and the dummy have no controls to pick). */
  private human(i: number): boolean {
    return i === 0 || this.setup.mode === 'versus';
  }

  private toggleControls(i: number): void {
    const s = this.setup.simple ?? [false, false];
    s[i] = !s[i];
    this.setup.simple = s;
    sfx(this, 'ui_move', 0.8);
    this.refresh();
  }

  private refresh(): void {
    for (let i = 0; i < 2; i += 1) {
      const side = this.sides[i];
      const simple = this.setup.simple?.[i] ?? false;
      side.controls
        .setVisible(this.human(i) && this.phase === 'heroes')
        .setText(
          simple
            ? `▲▼ CONTROLS: SIMPLE  ·  specials on one button`
            : `▲▼ CONTROLS: CLASSIC  ·  motion inputs`,
        )
        .setColor(simple ? CSS.gold : CSS.ink);
      const hero = side.cursor < HEROES.length ? side.cursor : -1;
      if (i === 1 && this.arcade) {
        side.preview.setVisible(false);
        side.name.setText('THE LADDER');
        side.style.setText(`Beat the other ${HEROES.length - 1} fighters in a row  ·  ${CPU_LEVELS[this.setup.cpuLevel]}`);
        side.tagline.setText('Lose and you can continue.');
      } else if (hero >= 0) {
        const info = heroInfo(HEROES[hero].id);
        const art = artFor(hero);
        side.preview.setTexture(art.key, frameName('idle', 0)).setVisible(true).setOrigin(...feetOrigin(art, i === 1)).setScale(menuScale(art, 2.3));
        side.name.setText(info.title);
        side.style.setText(`${info.archetype}  ·  ${info.style}`);
        side.tagline.setText(`"${info.tagline}"`);
      } else {
        side.preview.setVisible(false);
        side.name.setText('RANDOM');
        side.style.setText('Let fate pick.');
        side.tagline.setText('');
      }
    }
    const who =
      this.setup.mode === 'versus' ? 'Each player: move and confirm' : this.sides[0].locked && !this.arcade ? 'Now pick the opponent' : 'Pick your fighter';
    this.hint.setText(
      this.phase === 'stage'
        ? 'Choose a stage  ·  Left / Right  ·  Confirm: Enter, F or A  ·  Back: Esc, G or B'
        : `${who}  ·  Up / Down: controls  ·  Confirm: Enter, F or A  ·  Back: Esc, G or B`,
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
    if (this.arcade && i === 0) {
      const run = newArcadeRun(side.cursor, this.setup.cpuLevel);
      this.arcadeTimer = this.time.delayedCall(650, () => goTo(this, 'versus', arcadeSetup(side.cursor, run), 300));
      return;
    }
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
      this.arcadeTimer?.remove();
      this.arcadeTimer = null;
    } else if (i === 1 && this.setup.mode !== 'versus' && this.sides[0].locked) {
      this.sides[0].locked = false;
      this.sides[0].ready.setVisible(false);
    } else {
      goTo(this, this.setup.party ? 'party' : 'title', { skipIntro: true });
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
      } else if ((e.action === 'up' || e.action === 'down') && this.human(i)) this.toggleControls(i);
      else if (e.action === 'confirm') this.lock(i);
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
      if (side.cursor >= HEROES.length || this.phase === 'stage' || (i === 1 && this.arcade)) continue;
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
        if (side.cursor !== k || this.phase === 'stage' || (i === 1 && this.arcade)) continue;
        const color = i === 0 ? C.p1 : C.p2;
        const blink = side.locked ? 1 : 0.65 + 0.35 * Math.sin(tick * 0.2);
        const pad = 8 + i * 6;
        g.lineStyle(4, color, blink).strokeRect(t.x - TILE / 2 - pad, t.y - TILE / 2 - pad, TILE + pad * 2, TILE + pad * 2);
        g.fillStyle(color, 1).fillRect(i === 0 ? t.x - TILE / 2 - pad : t.x + TILE / 2 + pad - 30, t.y - TILE / 2 - pad - 16, 30, 16);
      }
    });
    // Stage cards: a carousel showing the chosen stage between its neighbours.
    if (this.phase === 'stage') {
      const n = STAGES.length;
      this.stageCards.forEach((c, k) => {
        let off = (k - this.stage + n) % n;
        if (off > n / 2) off -= n;
        const show = Math.abs(off) <= 1;
        const on = off === 0;
        c.setVisible(show).setPosition(VIEW_W / 2 + off * 250, 300).setAlpha(on ? 1 : 0.45);
        this.stageNames[k].setVisible(show).setPosition(c.x, 362).setColor(on ? CSS.gold : CSS.muted);
        if (show) g.lineStyle(on ? 4 : 2, on ? C.gold : C.panelEdge, 1).strokeRect(c.x - 117, c.y - 50, 234, 100);
      });
    }
  }
}
