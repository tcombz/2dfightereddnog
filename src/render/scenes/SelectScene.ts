import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { HEROES } from '../../sim';
import { playMusic, sfx } from '../audio';
import { C, CSS, VIEW_H, VIEW_W } from '../config';
import { CPU_LEVELS } from '../config';
import type { MatchSetup } from '../config';
import { arcadeSetup, newArcadeRun } from '../arcade';
import { Companion, menuPet } from '../companion';
import { artFor, feetOrigin, frameName, menuScale } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { STAGES } from '../stages';
import { menuHint } from '../prompts';
import { body, display, fitText, goTo, goldFill, stripes } from '../ui';

const TILE_W = 110;
const TILE_H = 52;
/** How far each tile's top edge leans over its bottom edge. */
const SKEW = 12;
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
  /** The fighter's nickname above the big first name. */
  title: Phaser.GameObjects.Text;
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
  private vs!: Phaser.GameObjects.Text;
  private washG!: Phaser.GameObjects.Graphics;
  private sheets: Phaser.GameObjects.Image[] = [];
  private tileMasks: Phaser.GameObjects.Graphics[] = [];
  private stageShade!: Phaser.GameObjects.Rectangle;
  private pets: Array<Companion | null> = [null, null];
  private stageTitle!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private ratingLabels: Phaser.GameObjects.Text[] = [];
  private clock = 0;
  private promptStamp = -1;

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
    this.pets = [null, null];
    this.stage = Math.floor(Math.random() * STAGES.length);
    this.cameras.main.fadeIn(250, 5, 6, 12);
    playMusic(this, 'menu');

    // Each half washes in its fighter's colour, the character sheet art faded behind the sprite.
    this.stageBg = this.add.image(0, 0, `stage_${STAGES[this.stage].id}`).setOrigin(0, 0).setScale(VIEW_H / 320).setAlpha(0.18);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, C.night, 0.6).setOrigin(0, 0);
    this.washG = this.add.graphics();
    this.sheets = [0, 1].map((i) =>
      this.add
        .image(i === 0 ? 0 : VIEW_W, VIEW_H, `sheet_${HEROES[0].id}`)
        .setOrigin(i === 0 ? 0 : 1, 1)
        .setAlpha(0.22)
        .setFlipX(i === 1),
    );
    const deco = this.add.graphics();
    stripes(deco, 0, 0, VIEW_W / 2, VIEW_H, 0xffffff, 0.025);
    stripes(deco, VIEW_W / 2, 0, VIEW_W / 2, VIEW_H, 0xffffff, 0.025);
    this.g = this.add.graphics().setDepth(5);

    // Centre: the emblem, the screen name and VS between the two portrait columns.
    const emblem = this.add.graphics().setDepth(6);
    emblem.fillStyle(0x05060c, 1).fillPoints([{ x: VIEW_W / 2, y: 26 }, { x: VIEW_W / 2 + 44, y: 70 }, { x: VIEW_W / 2, y: 114 }, { x: VIEW_W / 2 - 44, y: 70 }], true);
    emblem.lineStyle(3, C.gold, 1).strokePoints([{ x: VIEW_W / 2, y: 26 }, { x: VIEW_W / 2 + 44, y: 70 }, { x: VIEW_W / 2, y: 114 }, { x: VIEW_W / 2 - 44, y: 70 }], true);
    goldFill(this.add.text(VIEW_W / 2, 70, 'AH', display(30, '#ffffff', 5)).setOrigin(0.5).setDepth(7));
    this.header = this.add
      .text(VIEW_W / 2, 150, 'CHARACTER\nSELECT', body(22, CSS.ink))
      .setOrigin(0.5)
      .setAlign('center')
      .setLineSpacing(2)
      .setDepth(6);
    this.add.rectangle(VIEW_W / 2, 196, 18, 2, C.gold).setDepth(6);
    this.vs = this.add.text(VIEW_W / 2, 262, 'VS', display(44, '#ffffff', 7)).setOrigin(0.5).setDepth(6);
    goldFill(this.vs);

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
    let p1Name = party ? party.names[party.sides[0]] : 'PLAYER 1';
    let p2Name = vsLabel;
    if (party) {
      this.add.text(VIEW_W / 2, 214, `PARTY · MATCH ${party.matches + 1}`, display(12, CSS.gold, 3)).setOrigin(0.5, 0).setDepth(6);
      if (party.streak > 1 && party.lastWinner !== undefined) {
        const champSide = party.sides.indexOf(party.lastWinner);
        if (champSide === 0) p1Name += `  ★${party.streak}`;
        if (champSide === 1) p2Name += `  ★${party.streak}`;
      }
    }

    // Two slanted columns of portraits, one per player, meeting in a V at the bottom.
    this.tiles = [];
    this.tileMasks = [];
    for (let col = 0; col < 2; col += 1) {
      for (let k = 0; k < this.slots; k += 1) {
        const { x, y } = this.tilePos(col, k);
        const shape = this.make.graphics({}, false);
        shape.fillStyle(0xffffff).fillPoints(this.tilePoly(x, y, 0), true);
        const mask = shape.createGeometryMask();
        let img: Phaser.GameObjects.Image;
        if (k < HEROES.length) {
          img = this.add.image(x, y, `portrait_${HEROES[k].id}`).setDisplaySize(TILE_W + 10, TILE_W + 10).setDepth(6);
          // Faces sit in the top of the portrait: show the eyes, not the chest.
          img.setY(y + TILE_W * 0.07);
        } else {
          img = this.add.image(x, y, 'fx_glow').setDisplaySize(TILE_W, TILE_H).setAlpha(0.15).setTint(C.gold).setDepth(6);
          this.add.text(x, y, '?', display(34, CSS.gold, 6)).setOrigin(0.5).setDepth(7);
        }
        img.setMask(mask);
        this.tiles.push(img);
        this.tileMasks.push(shape);
      }
    }

    this.ratingLabels = [];
    this.sides = [0, 1].map((i) => {
      const x = i === 0 ? 170 : VIEW_W - 170;
      const art = artFor(i);
      const preview = this.add
        .image(x, 452, art.key, frameName('idle', 0))
        .setOrigin(...feetOrigin(art, i === 1))
        .setScale(menuScale(art, 2.9))
        .setFlipX(i === 1)
        .setDepth(3);
      const align = i === 0 ? 0 : 1;
      const tx = i === 0 ? 26 : VIEW_W - 26;
      const color = i === 0 ? CSS.p1 : CSS.p2;
      // The bottom band: player tag under a rule, the big first name above, the title above that.
      this.add.rectangle(i === 0 ? 0 : VIEW_W, 506, 300, 2, 0xffffff, 0.5).setOrigin(align, 0.5).setDepth(8);
      this.add.text(tx, 514, i === 0 ? p1Name : p2Name, display(13, color, 3)).setOrigin(align, 0).setDepth(8);
      return {
        cursor: i === 0 ? 0 : Math.min(1, HEROES.length - 1),
        locked: false,
        preview,
        name: this.add.text(tx, 500, '', display(54, '#ffffff', 9)).setOrigin(align, 1).setDepth(8),
        style: this.add.text(tx, 16, '', display(16, color, 4)).setOrigin(align, 0).setDepth(8),
        tagline: this.add.text(tx, 38, '', body(14, CSS.ink)).setOrigin(align, 0).setDepth(8),
        ready: this.add.text(x, 300, 'READY', display(40, '#ffffff', 9)).setOrigin(0.5).setVisible(false).setDepth(9),
        controls: this.add.text(tx, 160, '', body(12, CSS.ink)).setOrigin(align, 0).setDepth(8),
        title: this.add.text(tx, 440, '', display(15, CSS.gold, 4)).setOrigin(align, 1).setDepth(8),
        lockedAt: 0,
      };
    });

    // Rating labels beside the bars.
    for (let i = 0; i < 2; i += 1) {
      RATING_NAMES.forEach(([, label], row) => {
        const t = this.add.text(i === 0 ? 26 : VIEW_W - 26, 62 + row * 18, label, body(11, CSS.muted)).setOrigin(i === 0 ? 0 : 1, 0).setDepth(8);
        if (i === 1 && this.arcade) t.setVisible(false);
        else this.ratingLabels.push(t);
      });
    }

    // Stage select row (hidden until both fighters are locked in).
    this.stageCards = STAGES.map((st, i) =>
      this.add.image(VIEW_W / 2 + (i - 1) * 250, 300, `stage_${st.id}`).setDisplaySize(230, 96).setVisible(false).setDepth(21),
    );
    this.stageNames = STAGES.map((st, i) =>
      this.add.text(VIEW_W / 2 + (i - 1) * 250, 362, st.name, display(16, CSS.ink, 4)).setOrigin(0.5).setVisible(false).setDepth(21),
    );

    this.stageShade = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05060c, 0.8).setOrigin(0, 0).setDepth(20).setVisible(false);
    this.stageTitle = this.add.text(VIEW_W / 2, 200, 'CHOOSE A STAGE', display(32, '#ffffff', 7)).setOrigin(0.5).setDepth(21).setVisible(false);
    goldFill(this.stageTitle);
    this.hint = this.add.text(VIEW_W / 2, VIEW_H - 8, '', body(12, CSS.muted)).setOrigin(0.5, 1).setDepth(22);
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
        side.preview.setTexture(art.key, frameName('idle', 0)).setVisible(true).setOrigin(...feetOrigin(art, i === 1)).setScale(menuScale(art, 2.9));
        side.name.setText(info.name);
        side.title.setText(info.title.replace(/^[^"]*"|"$/g, '').replace(info.name, '').trim() || info.title);
        side.style.setText(info.archetype);
        side.tagline.setText(`"${info.tagline}"`);
        this.sheets[i].setTexture(`sheet_${HEROES[hero].id}`).setVisible(true);
        this.sheets[i].setScale(VIEW_H / this.sheets[i].height);
      } else {
        side.preview.setVisible(false);
        side.name.setText('RANDOM');
        side.title.setText('');
        side.style.setText('Let fate pick.');
        side.tagline.setText('');
        this.sheets[i].setVisible(false);
      }
      if (i === 1 && this.arcade) {
        side.title.setText('');
        this.sheets[i].setVisible(false);
      }
      fitText(side.name, 330);
      fitText(side.style, 250);
      fitText(side.tagline, 250);
      fitText(side.controls, 250);
    }
    const who =
      this.setup.mode === 'versus' ? 'Each player: move and confirm' : this.sides[0].locked && !this.arcade ? 'Now pick the opponent' : 'Pick your fighter';
    this.hint.setText(
      this.phase === 'stage'
        ? `Choose a stage  ·  Left / Right  ·  ${menuHint()}`
        : `${who}  ·  Up / Down: controls  ·  ${menuHint()}`,
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
    this.stageShade.setVisible(true);
    this.stageTitle.setVisible(true);
    this.stageCards.forEach((c) => c.setVisible(true));
    this.stageNames.forEach((t) => t.setVisible(true));
    this.setFighterInfoVisible(false);
    this.refresh();
  }

  private setFighterInfoVisible(v: boolean): void {
    for (const side of this.sides) {
      side.preview.setAlpha(v ? 1 : 0.3);
      for (const t of [side.name, side.style, side.tagline, side.ready, side.title]) t.setAlpha(v ? 1 : 0);
    }
    for (const t of this.ratingLabels) t.setVisible(v);
  }

  private back(i: number): void {
    if (this.phase === 'stage') {
      this.phase = 'heroes';
      this.stageShade.setVisible(false);
      this.stageTitle.setVisible(false);
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
    if (controls.deviceStamp !== this.promptStamp) {
      this.promptStamp = controls.deviceStamp;
      this.refresh();
    }
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
      this.pets[i] = menuPet(this, this.pets[i], art, side.preview, side.preview.frame.name, i === 0 ? 1 : -1);
    });
    this.draw(tick);
  }

  /** Centre of portrait tile `k` in a player's column: the columns lean in towards a V. */
  private tilePos(col: number, k: number): { x: number; y: number } {
    const step = TILE_H + 8;
    const top = (VIEW_H - (this.slots * step - 8)) / 2 + TILE_H / 2 - 6;
    const x = 318 + k * 15;
    return { x: col === 0 ? x : VIEW_W - x, y: top + k * step };
  }

  private tilePoly(x: number, y: number, pad: number): Phaser.Types.Math.Vector2Like[] {
    const w = TILE_W / 2 + pad;
    const h = TILE_H / 2 + pad;
    return [
      { x: x - w + SKEW, y: y - h },
      { x: x + w + SKEW, y: y - h },
      { x: x + w - SKEW, y: y + h },
      { x: x - w - SKEW, y: y + h },
    ];
  }

  private draw(tick: number): void {
    const g = this.g;
    g.clear();
    // Colour washes behind each fighter.
    const w = this.washG;
    w.clear();
    for (let i = 0; i < 2; i += 1) {
      const side = this.sides[i];
      const hero = side.cursor < HEROES.length && !(i === 1 && this.arcade) ? side.cursor : -1;
      const col = hero >= 0 ? heroInfo(HEROES[hero].id).color : i === 0 ? C.p1 : C.p2;
      const x0 = i === 0 ? 0 : VIEW_W;
      const d = i === 0 ? 1 : -1;
      w.fillStyle(col, 0.28).fillPoints([{ x: x0, y: 0 }, { x: x0 + d * 400, y: 0 }, { x: x0 + d * 470, y: VIEW_H }, { x: x0, y: VIEW_H }], true);
      w.fillStyle(col, 0.18).fillPoints([{ x: x0, y: 0 }, { x: x0 + d * 250, y: 0 }, { x: x0 + d * 330, y: VIEW_H }, { x: x0, y: VIEW_H }], true);
    }
    // Ratings.
    for (let i = 0; i < 2; i += 1) {
      const side = this.sides[i];
      if (side.cursor >= HEROES.length || this.phase === 'stage' || (i === 1 && this.arcade)) continue;
      const r = heroInfo(HEROES[side.cursor].id).ratings;
      RATING_NAMES.forEach(([k], row) => {
        const y = 66 + row * 18;
        for (let n = 0; n < 5; n += 1) {
          const x = i === 0 ? 104 + n * 20 : VIEW_W - 104 - (n + 1) * 20 + 4;
          g.fillStyle(n < r[k] ? (i === 0 ? C.p1 : C.p2) : 0x232845, 1).fillRect(x, y, 16, 8);
        }
      });
    }
    // Portrait frames and the cursors.
    for (let col = 0; col < 2; col += 1) {
      const side = this.sides[col];
      const dim = col === 1 && this.arcade;
      for (let k = 0; k < this.slots; k += 1) {
        const { x, y } = this.tilePos(col, k);
        const tile = this.tiles[col * this.slots + k];
        const on = side.cursor === k && this.phase === 'heroes' && !dim;
        tile.setAlpha(dim ? 0.25 : k < HEROES.length ? (on ? 1 : 0.62) : tile.alpha);
        g.lineStyle(2, 0xffffff, dim ? 0.15 : 0.45).strokePoints(this.tilePoly(x, y, 0), true);
        if (!on) continue;
        const color = col === 0 ? C.p1 : C.p2;
        const blink = side.locked ? 1 : 0.65 + 0.35 * Math.sin(tick * 0.2);
        g.lineStyle(5, color, blink).strokePoints(this.tilePoly(x, y, 3), true);
        const tagX = col === 0 ? x - TILE_W / 2 - SKEW + 2 : x + TILE_W / 2 - SKEW - 28;
        g.fillStyle(color, 1).fillRect(tagX, y - TILE_H / 2 - 3, 30, 15);
      }
    }
    // Stage cards: a carousel showing the chosen stage between its neighbours.
    if (this.phase === 'stage') {
      g.setDepth(21);
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
    } else g.setDepth(5);
  }
}
