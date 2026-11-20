// Character select, crossover style: one shared grid of portraits in the middle, each player's team
// slots in their top corner, and the hovered fighter standing big on their side in their colours.
// Tag teams pick two (point, then partner); training picks one each.
import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { phones } from '../../input/phones';
import type { PhoneView } from '../../net/padproto';
import { HEROES } from '../../sim';
import { playMusic, sfx } from '../audio';
import { C, CSS, VIEW_H, VIEW_W } from '../config';
import { CPU_LEVELS } from '../config';
import type { MatchSetup } from '../config';
import { arcadeSetup, newArcadeRun } from '../arcade';
import { Companion, menuPet } from '../companion';
import { artFor, feetOrigin, frameName, menuScale, pingpong } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { STAGES } from '../stages';
import { keyFor, menuHint, onPad, padButton } from '../prompts';
import { currentMatch, matchLabel } from '../tourney';
import { body, display, fitText, goTo, goldFill, stripes } from '../ui';

/** Grid: columns per row, tile size and slant. */
const COLS = 5;
const TILE = 76;
const GAP = 8;
const SKEW = 9;
const GRID_Y = 300;
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
  lockedAt: number;
  /** Tag teams: the first pick (the point fighter), -1 until it is made. */
  first: number;
  preview: Phaser.GameObjects.Image;
  /** The point fighter, standing behind once picked. */
  back: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  arch: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  controls: Phaser.GameObjects.Text;
  ready: Phaser.GameObjects.Text;
  /** Team slots: portrait cards for point and partner. */
  slots: Phaser.GameObjects.Image[];
  slotLabels: Phaser.GameObjects.Text[];
}

export class SelectScene extends Phaser.Scene {
  private setup!: MatchSetup;
  private team = true;
  private sides: Side[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private washG!: Phaser.GameObjects.Graphics;
  private tiles: Phaser.GameObjects.Image[] = [];
  private phase: 'heroes' | 'stage' = 'heroes';
  private arcade = false;
  private arcadeTimer: Phaser.Time.TimerEvent | null = null;
  private stage = 0;
  private stageBg!: Phaser.GameObjects.Image;
  private stageCards: Phaser.GameObjects.Image[] = [];
  private stageNames: Phaser.GameObjects.Text[] = [];
  private stageShade!: Phaser.GameObjects.Rectangle;
  private stageTitle!: Phaser.GameObjects.Text;
  private sheets: Phaser.GameObjects.Image[] = [];
  private pets: Array<Companion | null> = [null, null];
  private hint!: Phaser.GameObjects.Text;
  private ratingLabels: Phaser.GameObjects.Text[] = [];
  private clock = 0;
  private promptStamp = -1;
  /** Eased cursor positions on the grid, so the frames glide between tiles. */
  private glide = [{ x: 0, y: 0 }, { x: 0, y: 0 }];

  constructor() {
    super('select');
  }

  /** Roster plus the random tile. */
  private get count(): number {
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
      tourney: data.tourney,
      simple: data.simple ? [...data.simple] : [simple, simple && mode === 'versus'],
    };
    // A phone party: anyone who joined since the last match goes to the back of the queue. Phone
    // players get their own controls setting (simple specials unless they turned it off).
    if (this.setup.party?.phones) this.setup.party = phones.withLatecomers(this.setup.party);
    phones.seatFor(this.setup);
    for (const i of [0, 1]) {
      const ph = phones.phoneAt(i);
      if (ph && this.setup.simple && (i === 0 || mode === 'versus')) this.setup.simple[i] = ph.simple;
    }
    this.phase = 'heroes';
    this.pets = [null, null];
    this.team = mode !== 'training';
    this.stage = Math.floor(Math.random() * STAGES.length);
    this.cameras.main.fadeIn(250, 5, 6, 12);
    playMusic(this, 'menu');

    // Backdrop: a stage, each half washed in its fighter's colour, their illustration faded in.
    this.stageBg = this.add.image(0, 0, `stage_${STAGES[this.stage].id}`).setOrigin(0, 0).setScale(VIEW_H / 320).setAlpha(0.2);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, C.night, 0.6).setOrigin(0, 0);
    this.washG = this.add.graphics();
    this.sheets = [0, 1].map((i) =>
      this.add
        .image(i === 0 ? 0 : VIEW_W, VIEW_H, `sheet_${HEROES[0].id}`)
        .setOrigin(i === 0 ? 0 : 1, 1)
        .setAlpha(0.18)
        .setFlipX(i === 1),
    );
    const deco = this.add.graphics();
    stripes(deco, 0, 0, VIEW_W, VIEW_H, 0xffffff, 0.022);
    // The centre column, darker, holding the title and the grid.
    deco.fillStyle(0x05060c, 0.55).fillPoints([{ x: 300, y: 0 }, { x: 660, y: 0 }, { x: 700, y: VIEW_H }, { x: 260, y: VIEW_H }], true);
    this.g = this.add.graphics().setDepth(6);

    const party = this.setup.party;
    const tourney = this.setup.tourney;
    const tm = tourney ? currentMatch(tourney) : null;
    const modeName = tourney && tm
      ? matchLabel(tourney, tm.round, tm.match)
      : party
      ? `PARTY · MATCH ${party.matches + 1}`
      : this.arcade
        ? `ARCADE · ${CPU_LEVELS[this.setup.cpuLevel]}`
        : mode === 'versus'
          ? 'VERSUS'
          : mode === 'training'
            ? 'TRAINING'
            : `VS CPU · ${CPU_LEVELS[this.setup.cpuLevel]}`;
    const title = this.add.text(VIEW_W / 2, 26, this.team ? 'SELECT YOUR TEAM' : 'SELECT YOUR FIGHTER', display(24, '#ffffff', 6)).setOrigin(0.5, 0).setDepth(8);
    goldFill(title);
    this.add.text(VIEW_W / 2, 60, modeName, display(13, CSS.ink, 3)).setOrigin(0.5, 0).setDepth(8);
    const vs = this.add.text(VIEW_W / 2, 178, 'VS', display(64, '#ffffff', 10)).setOrigin(0.5).setDepth(8);
    goldFill(vs);
    this.tweens.add({ targets: vs, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // The grid: one shared set of tiles.
    this.tiles = [];
    for (let k = 0; k < this.count; k += 1) {
      const { x, y } = this.tilePos(k);
      const shape = this.make.graphics({}, false);
      shape.fillStyle(0xffffff).fillPoints(this.tilePoly(x, y, 0), true);
      const mask = shape.createGeometryMask();
      let img: Phaser.GameObjects.Image;
      if (k < HEROES.length) {
        img = this.add.image(x, y + 6, `portrait_${HEROES[k].id}`).setDisplaySize(TILE + 16, TILE + 16).setDepth(7);
      } else {
        img = this.add.image(x, y, 'fx_glow').setDisplaySize(TILE, TILE).setAlpha(0.25).setTint(C.gold).setDepth(7);
        this.add.text(x, y, '?', display(40, CSS.gold, 6)).setOrigin(0.5).setDepth(8);
      }
      img.setMask(mask);
      // Pop in, one after another.
      img.setScale(img.scaleX * 0.2, img.scaleY * 0.2);
      this.tweens.add({ targets: img, scaleX: img.scaleX * 5, scaleY: img.scaleY * 5, duration: 260, delay: 60 + k * 35, ease: 'Back.easeOut' });
      this.tiles.push(img);
    }

    const names =
      tourney && tm
        ? [tourney.names[tm.m.a], tourney.names[tm.m.b]]
        : [party ? party.names[party.sides[0]] : 'PLAYER 1', party ? party.names[party.sides[1]] : this.arcade ? 'ARCADE' : mode === 'versus' ? 'PLAYER 2' : mode === 'training' ? 'DUMMY' : 'CPU'];
    this.ratingLabels = [];
    this.sides = [0, 1].map((i) => {
      const left = i === 0;
      const align = left ? 0 : 1;
      const tx = left ? 22 : VIEW_W - 22;
      const color = left ? CSS.p1 : CSS.p2;
      const x = left ? 160 : VIEW_W - 160;
      const art = artFor(0);
      const back = this.add.image(x, 470, art.key, frameName('idle', 0)).setDepth(3).setVisible(false).setTint(0x7a809c);
      const preview = this.add
        .image(x, 476, art.key, frameName('idle', 0))
        .setOrigin(...feetOrigin(art, !left))
        .setScale(menuScale(art, 2.7))
        .setFlipX(!left)
        .setDepth(4);
      // Team slots, top corner: point and partner.
      const slotCount = this.team ? 2 : 1;
      const slots: Phaser.GameObjects.Image[] = [];
      const slotLabels: Phaser.GameObjects.Text[] = [];
      for (let k = 0; k < slotCount; k += 1) {
        const sx = left ? 22 + 36 + k * 82 : VIEW_W - 22 - 36 - k * 82;
        slots.push(this.add.image(sx, 52, `portrait_${HEROES[0].id}`).setDisplaySize(72, 72).setDepth(9).setVisible(false));
        slotLabels.push(this.add.text(sx, 92, this.team ? (k === 0 ? 'POINT' : 'PARTNER') : 'FIGHTER', body(11, CSS.muted)).setOrigin(0.5, 0).setDepth(9));
      }
      this.add.text(tx, 108, names[i], display(13, color, 3)).setOrigin(align, 0).setDepth(9);
      RATING_NAMES.forEach(([, label], row) => {
        const t = this.add.text(tx, 136 + row * 16, label, body(10, CSS.muted)).setOrigin(align, 0).setDepth(9);
        if (!left && this.arcade) t.setVisible(false);
        else this.ratingLabels.push(t);
      });
      return {
        cursor: left ? 0 : Math.min(1, HEROES.length - 1),
        locked: false,
        lockedAt: 0,
        first: -1,
        preview,
        back,
        name: this.add.text(tx, 504, '', display(48, '#ffffff', 9)).setOrigin(align, 1).setDepth(10),
        title: this.add.text(tx, 452, '', display(14, CSS.gold, 4)).setOrigin(align, 1).setDepth(10),
        arch: this.add.text(tx, 222, '', display(12, color, 3)).setOrigin(align, 0).setDepth(9),
        status: this.add.text(left ? 196 : VIEW_W - 196, 40, '', display(12, CSS.gold, 3)).setOrigin(align, 0).setDepth(9).setWordWrapWidth(110),
        controls: this.add.text(tx, 240, '', body(11, CSS.ink)).setOrigin(align, 0).setDepth(9),
        ready: this.add.text(x, 300, 'READY!', display(42, '#ffffff', 9)).setOrigin(0.5).setVisible(false).setDepth(11),
        slots,
        slotLabels,
      };
    });
    this.sides.forEach((side, i) => {
      const p = this.tilePos(side.cursor);
      this.glide[i] = { x: p.x, y: p.y };
    });

    // Stage select (hidden until both teams are locked in).
    this.stageCards = STAGES.map((st) => this.add.image(VIEW_W / 2, 300, `stage_${st.id}`).setDisplaySize(230, 96).setVisible(false).setDepth(21));
    this.stageNames = STAGES.map((st) => this.add.text(VIEW_W / 2, 362, st.name, display(16, CSS.ink, 4)).setOrigin(0.5).setVisible(false).setDepth(21));
    this.stageShade = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05060c, 0.82).setOrigin(0, 0).setDepth(20).setVisible(false);
    this.stageTitle = this.add.text(VIEW_W / 2, 200, 'CHOOSE A STAGE', display(32, '#ffffff', 7)).setOrigin(0.5).setDepth(21).setVisible(false);
    goldFill(this.stageTitle);
    this.hint = this.add.text(VIEW_W / 2, VIEW_H - 8, '', body(12, CSS.muted)).setOrigin(0.5, 1).setDepth(22);
    if (data.p1 !== undefined) this.sides[0].cursor = data.p1;
    if (data.p2 !== undefined) this.sides[1].cursor = data.p2;
    // A tournament: each player's cursor starts on the point fighter they used last time.
    if (tourney && tm) {
      const a = tourney.picks[tm.m.a]?.[0] ?? -1;
      const b = tourney.picks[tm.m.b]?.[0] ?? -1;
      if (a >= 0) this.sides[0].cursor = a;
      if (b >= 0) this.sides[1].cursor = b;
    }
    this.refresh();
    controls.take();
  }

  // ---------- layout ----------

  private tilePos(k: number): { x: number; y: number } {
    const rows = Math.ceil(this.count / COLS);
    const row = Math.floor(k / COLS);
    const inRow = row < rows - 1 ? COLS : this.count - COLS * (rows - 1);
    const col = k % COLS;
    const w = inRow * (TILE + GAP) - GAP;
    return { x: VIEW_W / 2 - w / 2 + TILE / 2 + col * (TILE + GAP) - row * SKEW, y: GRID_Y + row * (TILE + GAP) };
  }

  private tilePoly(x: number, y: number, pad: number): Phaser.Types.Math.Vector2Like[] {
    const w = TILE / 2 + pad;
    const h = TILE / 2 + pad;
    return [
      { x: x - w + SKEW, y: y - h },
      { x: x + w + SKEW, y: y - h },
      { x: x + w - SKEW, y: y + h },
      { x: x - w - SKEW, y: y + h },
    ];
  }

  // ---------- state ----------

  private activeSide(player: number): number {
    if (this.setup.mode === 'versus') return player === 1 ? 1 : player === 0 ? 0 : this.sides[0].locked ? 1 : 0;
    return this.sides[0].locked && !this.arcade ? 1 : 0;
  }

  private human(i: number): boolean {
    return i === 0 || this.setup.mode === 'versus';
  }

  private altKey(i: number): string {
    return onPad(i) ? padButton('heavy', i) : keyFor('special', i);
  }

  private toggleControls(i: number): void {
    const s = this.setup.simple ?? [false, false];
    s[i] = !s[i];
    this.setup.simple = s;
    const ph = phones.phoneAt(i);
    if (ph) ph.simple = s[i];
    sfx(this, 'ui_move', 0.8);
    this.refresh();
  }

  private refresh(): void {
    for (let i = 0; i < 2; i += 1) {
      const side = this.sides[i];
      const simple = this.setup.simple?.[i] ?? false;
      side.controls
        .setVisible(this.human(i) && this.phase === 'heroes')
        .setText(`${phones.phoneAt(i) ? 'PHONE' : this.altKey(i)}: CONTROLS ${simple ? 'SIMPLE' : 'CLASSIC'}`)
        .setColor(simple ? CSS.gold : CSS.ink);
      const hero = side.cursor < HEROES.length ? side.cursor : -1;
      if (i === 1 && this.arcade) {
        side.preview.setVisible(false);
        side.back.setVisible(false);
        side.name.setText('THE LADDER');
        side.title.setText('');
        side.arch.setText(`BEAT ${HEROES.length - 1} TEAMS IN A ROW`);
        side.status.setText('');
        this.sheets[i].setVisible(false);
        side.slots.forEach((s) => s.setVisible(false));
        side.slotLabels.forEach((s) => s.setVisible(false));
      } else if (hero >= 0) {
        const info = heroInfo(HEROES[hero].id);
        const art = artFor(hero);
        side.preview.setTexture(art.key, frameName('idle', 0)).setVisible(true).setOrigin(...feetOrigin(art, i === 1)).setScale(menuScale(art, 2.7));
        side.name.setText(info.name);
        side.title.setText(info.title.replace(/^[^"]*"|"$/g, '').replace(info.name, '').trim() || info.title);
        side.arch.setText(info.archetype);
        this.sheets[i].setTexture(`sheet_${HEROES[hero].id}`).setVisible(true);
        this.sheets[i].setScale(VIEW_H / this.sheets[i].height);
      } else {
        side.preview.setVisible(false);
        side.name.setText('RANDOM');
        side.title.setText('');
        side.arch.setText('LET FATE PICK');
        this.sheets[i].setVisible(false);
      }
      // The point fighter waits behind, a step back, once picked.
      if (this.team && side.first >= 0 && !(i === 1 && this.arcade)) {
        const art = artFor(side.first);
        const x = i === 0 ? 62 : VIEW_W - 62;
        side.back
          .setTexture(art.key, frameName('idle', 0))
          .setOrigin(...feetOrigin(art, i === 1))
          .setFlipX(i === 1)
          .setScale(menuScale(art, 2.3))
          .setPosition(x, 452)
          .setVisible(true)
          .setTint(side.locked ? 0xffffff : 0x7a809c);
      } else side.back.setVisible(false);
      // Team slots.
      if (!(i === 1 && this.arcade)) {
        const picks = this.team ? [side.first, side.locked ? side.cursor : -1] : [side.locked ? side.cursor : -1];
        side.slots.forEach((slot, k) => {
          const h = picks[k];
          slot.setVisible(h >= 0);
          if (h >= 0) slot.setTexture(`portrait_${HEROES[h].id}`).setDisplaySize(72, 72);
        });
        side.status.setText(
          side.locked
            ? 'READY!'
            : !this.team
              ? 'PICK A FIGHTER'
              : side.first < 0
                ? 'PICK YOUR POINT'
                : 'NOW PICK A PARTNER',
        );
      }
      fitText(side.name, 300);
      fitText(side.arch, 250);
      fitText(side.title, 280);
    }
    const who = this.setup.mode === 'versus' ? 'Each player: move and confirm' : this.sides[0].locked && !this.arcade ? 'Now pick the opponent' : 'Pick with the arrows';
    const onPhones = phones.phoneAt(0) !== null || phones.phoneAt(1) !== null;
    this.hint.setText(
      onPhones
        ? this.phase === 'stage'
          ? 'Pick the stage on your phone, then FIGHT!'
          : 'Pick on your phone: tap a fighter, tap again (or LOCK IN) to lock'
        : this.phase === 'stage'
          ? `Choose a stage  ·  Left / Right  ·  ${menuHint()}`
          : `${who}  ·  ${menuHint()}`,
    );
  }

  /** A slot filling: the card slams in. */
  private slam(i: number, k: number): void {
    const slot = this.sides[i].slots[k];
    if (!slot) return;
    const sx = slot.scaleX;
    const sy = slot.scaleY;
    slot.setScale(sx * 1.6, sy * 1.6).setAlpha(0.3);
    this.tweens.add({ targets: slot, scaleX: sx, scaleY: sy, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    this.cameras.main.shake(90, 0.003);
  }

  private lock(i: number): void {
    const side = this.sides[i];
    const arcadeFoe = i === 1 && this.arcade;
    if (side.cursor >= HEROES.length) {
      do side.cursor = Math.floor(Math.random() * HEROES.length);
      while (side.cursor === side.first);
    }
    if (this.team && !arcadeFoe) {
      if (side.first < 0) {
        side.first = side.cursor;
        side.cursor = (side.cursor + 1) % HEROES.length;
        sfx(this, 'ui_confirm');
        sfx(this, heroInfo(HEROES[side.first].id).sfx.special, 0.5);
        this.refresh();
        this.slam(i, 0);
        return;
      }
      if (side.cursor === side.first) {
        sfx(this, 'ui_move', 0.6);
        this.cameras.main.shake(120, 0.004);
        return;
      }
    }
    side.locked = true;
    side.lockedAt = this.clock;
    side.ready.setVisible(true).setScale(1.8).setAlpha(0);
    this.tweens.add({ targets: side.ready, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    sfx(this, 'ui_confirm');
    sfx(this, heroInfo(HEROES[side.cursor].id).sfx.special, 0.6);
    this.refresh();
    this.slam(i, this.team ? 1 : 0);
    if (this.arcade && i === 0) {
      const point = this.team ? side.first : side.cursor;
      const run = newArcadeRun(point, this.setup.cpuLevel, this.team ? side.cursor : undefined);
      this.arcadeTimer = this.time.delayedCall(700, () => goTo(this, 'versus', arcadeSetup(point, run), 300));
      return;
    }
    if (this.sides[0].locked && this.sides[1].locked) this.time.delayedCall(500, () => this.openStages());
  }

  private openStages(): void {
    this.phase = 'stage';
    this.stageShade.setVisible(true);
    this.stageTitle.setVisible(true);
    this.stageCards.forEach((c) => c.setVisible(true));
    this.stageNames.forEach((t) => t.setVisible(true));
    this.refresh();
  }

  private back(i: number): void {
    if (this.phase === 'stage') {
      this.phase = 'heroes';
      this.stageShade.setVisible(false);
      this.stageTitle.setVisible(false);
      this.stageCards.forEach((c) => c.setVisible(false));
      this.stageNames.forEach((t) => t.setVisible(false));
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
    } else if (side.first >= 0) {
      side.cursor = side.first;
      side.first = -1;
    } else if (i === 1 && this.setup.mode !== 'versus' && this.sides[0].locked) {
      this.sides[0].locked = false;
      this.sides[0].ready.setVisible(false);
    } else {
      if (this.setup.tourney) {
        goTo(this, 'bracket', { tourney: this.setup.tourney, cpuLevel: this.setup.cpuLevel });
        return;
      }
      const fromPhones = !!this.setup.party?.phones || (!this.setup.party && phones.connected().length > 0);
      goTo(this, fromPhones ? 'phones' : this.setup.party ? 'party' : 'title', { skipIntro: true });
      return;
    }
    sfx(this, 'ui_move', 0.8);
    this.refresh();
  }

  private confirmStage(): void {
    if ((this as unknown as { leaving?: boolean }).leaving) return;
    sfx(this, 'ui_confirm');
    if (this.team) {
      this.setup.p1 = this.sides[0].first;
      this.setup.p2 = this.sides[1].first;
      this.setup.partners = [this.sides[0].cursor, this.sides[1].cursor];
    } else {
      this.setup.p1 = this.sides[0].cursor;
      this.setup.p2 = this.sides[1].cursor;
      this.setup.partners = undefined;
    }
    this.setup.stage = this.stage;
    goTo(this, 'versus', this.setup, 300);
  }

  private showStage(k: number): void {
    this.stage = (k + STAGES.length) % STAGES.length;
    this.stageBg.setTexture(`stage_${STAGES[this.stage].id}`);
    sfx(this, 'ui_move', 0.8);
  }

  // ---------- phones ----------

  /** What a seated phone shows: its side's picks, or the stage list. */
  phoneView(seat: number): Partial<PhoneView> | null {
    if (seat < 0 || this.arcade) return null;
    if (this.phase === 'stage') return { screen: 'stage', say: 'CHOOSE A STAGE', stage: this.stage };
    const i = this.activeSide(seat);
    const side = this.sides[i];
    const cpu = i === 1 && this.setup.mode !== 'versus';
    const who = cpu ? "THE CPU'S " : '';
    const say = side.locked
      ? 'READY!'
      : !this.team
        ? `PICK ${cpu ? 'THE CPU FIGHTER' : 'A FIGHTER'}`
        : side.first < 0
          ? `PICK ${who || 'YOUR '}POINT`
          : `NOW PICK ${who || 'A '}PARTNER`;
    return {
      screen: 'select',
      say,
      side: i,
      cursor: side.cursor,
      first: side.first,
      locked: side.locked,
      team: this.team,
      simple: this.human(i) ? (this.setup.simple?.[i] ?? false) : undefined,
    };
  }

  phoneCommand(seat: number, c: string, v: unknown): void {
    if (seat < 0 || this.arcade || (this as unknown as { leaving?: boolean }).leaving) return;
    if (this.phase === 'stage') {
      if (c === 'stage' && typeof v === 'number' && v >= 0 && v < STAGES.length) this.showStage(v);
      else if (c === 'lock') this.confirmStage();
      else if (c === 'back') this.back(1);
      return;
    }
    const i = this.activeSide(seat);
    const side = this.sides[i];
    if (c === 'back') this.back(i);
    else if (side.locked) return;
    else if (c === 'hero' && typeof v === 'number' && v >= 0 && v < this.count && v !== side.cursor) {
      side.cursor = v;
      sfx(this, 'ui_move', 0.8);
      this.refresh();
    } else if (c === 'lock') this.lock(i);
    else if (c === 'simple' && this.human(i)) this.toggleControls(i);
  }

  /** Grid moves: left / right along the row (wrapping), up / down between rows. */
  private move(side: Side, action: string): void {
    const n = this.count;
    const rows = Math.ceil(n / COLS);
    if (action === 'left' || action === 'right') side.cursor = (side.cursor + (action === 'left' ? -1 : 1) + n) % n;
    else {
      const row = Math.floor(side.cursor / COLS);
      const col = side.cursor % COLS;
      const next = (row + (action === 'up' ? -1 : 1) + rows) % rows;
      side.cursor = Math.min(n - 1, next * COLS + col);
    }
    sfx(this, 'ui_move', 0.8);
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
        if (e.action === 'left' || e.action === 'right') this.showStage(this.stage + (e.action === 'left' ? -1 : 1));
        else if (e.action === 'confirm') this.confirmStage();
        else if (e.action === 'back' || e.action === 'pause') this.back(1);
        continue;
      }
      const i = this.activeSide(e.player);
      const side = this.sides[i];
      if (e.action === 'back' || e.action === 'pause') this.back(i);
      else if (side.locked) continue;
      else if (e.action === 'left' || e.action === 'right' || e.action === 'up' || e.action === 'down') this.move(side, e.action);
      else if (e.action === 'alt' && this.human(i)) this.toggleControls(i);
      else if (e.action === 'confirm') this.lock(i);
    }

    // Fighters: breathing idles, the win pose once locked.
    this.sides.forEach((side, i) => {
      if (side.preview.visible) {
        const art = artFor(side.cursor);
        if (side.locked) {
          const t = Math.floor((this.clock - side.lockedAt) / (1000 / 60));
          side.preview.setFrame(frameName('win', art.win[Math.min(art.win.length - 1, Math.floor(t / 6))]));
        } else side.preview.setFrame(frameName('idle', pingpong(art.idle, tick + i * 17, 10)));
        const b = Math.sin(this.clock * 0.0042 + i * 1.7);
        const k = menuScale(art, 2.7);
        side.preview.setScale(k * (1 - 0.006 * b), k * (1 + 0.014 * b));
      }
      if (side.back.visible && side.first >= 0) {
        const art = artFor(side.first);
        side.back.setFrame(frameName('idle', pingpong(art.idle, tick + 31, 10)));
      }
      this.pets[i] = menuPet(this, this.pets[i], artFor(side.cursor < HEROES.length ? side.cursor : 0), side.preview, i === 0 ? 1 : -1);
      // Glide the cursor frame toward its tile.
      const p = this.tilePos(side.cursor);
      const g = this.glide[i];
      const k = Math.min(1, delta / 55);
      g.x += (p.x - g.x) * k;
      g.y += (p.y - g.y) * k;
    });
    this.draw(tick);
  }

  private draw(tick: number): void {
    const g = this.g;
    g.clear();
    // Colour washes, one per half.
    const w = this.washG;
    w.clear();
    for (let i = 0; i < 2; i += 1) {
      const side = this.sides[i];
      const hero = side.cursor < HEROES.length && !(i === 1 && this.arcade) ? side.cursor : -1;
      const col = hero >= 0 ? heroInfo(HEROES[hero].id).color : i === 0 ? C.p1 : C.p2;
      const x0 = i === 0 ? 0 : VIEW_W;
      const d = i === 0 ? 1 : -1;
      w.fillStyle(col, 0.3).fillPoints([{ x: x0, y: 0 }, { x: x0 + d * 330, y: 0 }, { x: x0 + d * 290, y: VIEW_H }, { x: x0, y: VIEW_H }], true);
      w.fillStyle(col, 0.16).fillPoints([{ x: x0, y: 0 }, { x: x0 + d * 200, y: 0 }, { x: x0 + d * 150, y: VIEW_H }, { x: x0, y: VIEW_H }], true);
    }
    // Stage select: only the carousel (the rest sits under the shade).
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
      return;
    }
    g.setDepth(6);
    // Ratings, and the team slot frames.
    for (let i = 0; i < 2; i += 1) {
      const side = this.sides[i];
      const color = i === 0 ? C.p1 : C.p2;
      if (!(i === 1 && this.arcade)) {
        side.slots.forEach((slot, k) => {
          const filled = slot.visible;
          const active = !side.locked && ((this.team && k === (side.first < 0 ? 0 : 1)) || (!this.team && k === 0));
          const pulse = active ? 0.55 + 0.45 * Math.sin(tick * 0.18) : 1;
          g.fillStyle(0x05060c, filled ? 0 : 0.7).fillRect(slot.x - 36, 16, 72, 72);
          g.lineStyle(active ? 3 : 2, filled ? color : active ? 0xffffff : 0x3a4170, pulse).strokeRect(slot.x - 36, 16, 72, 72);
        });
      }
      if (side.cursor >= HEROES.length || (i === 1 && this.arcade)) continue;
      const r = heroInfo(HEROES[side.cursor].id).ratings;
      RATING_NAMES.forEach(([key], row) => {
        const y = 139 + row * 16;
        for (let n = 0; n < 5; n += 1) {
          const x = i === 0 ? 100 + n * 18 : VIEW_W - 100 - (n + 1) * 18 + 4;
          g.fillStyle(n < r[key] ? color : 0x232845, 1).fillRect(x, y, 14, 7);
        }
      });
    }
    // Tiles and the two cursor frames.
    for (let k = 0; k < this.count; k += 1) {
      const { x, y } = this.tilePos(k);
      const hovered = this.sides.some((s, i) => s.cursor === k && !(i === 1 && this.arcade));
      const taken = this.sides.some((s) => s.first === k || (s.locked && s.cursor === k));
      this.tiles[k].setAlpha(k < HEROES.length ? (hovered ? 1 : taken ? 0.85 : 0.6) : this.tiles[k].alpha);
      g.lineStyle(2, 0xffffff, hovered ? 0.8 : 0.35).strokePoints(this.tilePoly(x, y, 0), true);
    }
    if (this.phase === 'heroes') {
      for (let i = 0; i < 2; i += 1) {
        if (i === 1 && this.arcade) continue;
        const side = this.sides[i];
        const color = i === 0 ? C.p1 : C.p2;
        const { x, y } = this.glide[i];
        const same = this.sides[0].cursor === this.sides[1].cursor && !this.arcade;
        const pad = same && i === 1 ? 7 : 3;
        const blink = side.locked ? 1 : 0.6 + 0.4 * Math.sin(tick * 0.22);
        g.lineStyle(5, color, blink).strokePoints(this.tilePoly(x, y, pad), true);
        // The player tag on the frame's top corner.
        const tx = i === 0 ? x - TILE / 2 + SKEW - pad : x + TILE / 2 + SKEW + pad - 26;
        g.fillStyle(color, 1).fillRect(tx, y - TILE / 2 - pad - 12, 26, 13);
      }
    }
  }
}
