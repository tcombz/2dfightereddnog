import Phaser from 'phaser';
import type { InputSource } from '../dev/localKeyboard';
import {
  FS,
  FS_NAMES,
  HEROES,
  Phase,
  ROUNDS_TO_WIN,
  ROUND_TICKS,
  Result,
  STAGE_WIDTH,
  TICK_RATE,
  createInitialState,
  getHitboxes,
  getHurtboxes,
  hashState,
  step,
} from '../sim';
import type { FighterState, GameState, Rect } from '../sim';
import { cpuInput } from '../dev/cpu';
import { ALL_ART, artFor, frameFor } from './heroArt';

export const VIEW_WIDTH = STAGE_WIDTH;
export const VIEW_HEIGHT = 540;
const GROUND_Y = 480;
/** Default match-up: the two sprite heroes. */
const P1_HERO = Math.max(0, HEROES.findIndex((h) => h.id === 'rogue'));
const P2_HERO = Math.max(0, HEROES.findIndex((h) => h.id === 'jetsetter'));
const TICK_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;
const BAR_W = 400;
const BAR_H = 24;
const BAR_Y = 30;

const FONT = { fontFamily: 'monospace', color: '#ffffff' };

/** Read-only view of the sim. All game logic lives in src/sim. */
export class GameScene extends Phaser.Scene {
  private state: GameState = createInitialState(P1_HERO, P2_HERO);
  private acc = 0;
  private debug = false;
  private gfx!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;
  private cpuText!: Phaser.GameObjects.Text;
  private sprites: Phaser.GameObjects.Image[] = [];
  private nameTexts: Phaser.GameObjects.Text[] = [];
  /** Fighter select screen: the sim is not stepped while this is true. */
  private selecting = true;
  private picks: [number, number] = [P1_HERO, P2_HERO];
  private selectTick = 0;

  constructor(
    private readonly inputs: InputSource,
    private cpuP2 = false,
  ) {
    super('game');
  }

  preload(): void {
    for (const art of ALL_ART) this.load.atlas(art.key, art.png, art.atlas);
  }

  create(): void {
    this.gfx = this.add.graphics();
    this.sprites = this.state.fighters.map(() => this.add.image(0, 0, ALL_ART[0].key).setVisible(false));
    this.cpuText = this.add.text(VIEW_WIDTH - 40, BAR_Y + BAR_H + 22, '', { ...FONT, fontSize: '12px', color: '#9fb4ff' }).setOrigin(1, 0);
    this.timerText = this.add.text(VIEW_WIDTH / 2, BAR_Y + BAR_H / 2, '', { ...FONT, fontSize: '40px' }).setOrigin(0.5);
    this.messageText = this.add
      .text(VIEW_WIDTH / 2, 200, '', { ...FONT, fontSize: '48px', align: 'center', stroke: '#000000', strokeThickness: 6 })
      .setOrigin(0.5);
    this.debugText = this.add.text(8, GROUND_Y + 8, '', { ...FONT, fontSize: '12px', color: '#9fe89f' });
    this.nameTexts = [
      this.add.text(40, BAR_Y + BAR_H + 4, '', { ...FONT, fontSize: '14px' }),
      this.add.text(VIEW_WIDTH - 40, BAR_Y + BAR_H + 4, '', { ...FONT, fontSize: '14px' }).setOrigin(1, 0),
    ];

    const kb = this.input.keyboard!;
    const toggle = (): void => {
      this.debug = !this.debug;
    };
    kb.on('keydown-F2', toggle);
    kb.on('keydown-BACKTICK', toggle);
    const cycle = (slot: number, by: number): void => {
      if (!this.selecting) return;
      this.picks[slot] = (this.picks[slot] + by + HEROES.length) % HEROES.length;
      this.state = createInitialState(this.picks[0], this.picks[1]);
    };
    const confirm = (): void => {
      if (this.selecting) {
        this.state = createInitialState(this.picks[0], this.picks[1]);
        this.acc = 0;
        this.selecting = false;
      } else if (this.state.phase === Phase.MatchEnd) {
        this.selecting = true;
      }
    };
    kb.on('keydown-ENTER', confirm);
    kb.on('keydown-A', () => cycle(0, -1));
    kb.on('keydown-D', () => cycle(0, 1));
    kb.on('keydown-LEFT', () => cycle(1, -1));
    kb.on('keydown-RIGHT', () => cycle(1, 1));
    // Touch: tap the left or right third to change that side's fighter, the middle to confirm.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.selecting) confirm();
      else if (p.x < VIEW_WIDTH / 3) cycle(0, 1);
      else if (p.x > (VIEW_WIDTH * 2) / 3) cycle(1, 1);
      else confirm();
    });
    kb.on('keydown-C', () => {
      this.cpuP2 = !this.cpuP2;
    });
  }

  update(_time: number, delta: number): void {
    if (this.selecting) {
      // Preview only: a throwaway copy with a moving tick so the idle animations play.
      this.selectTick += 1;
      this.draw({ ...this.state, tick: this.selectTick });
      return;
    }
    this.acc += delta;
    let steps = 0;
    while (this.acc >= TICK_MS && steps < MAX_STEPS_PER_FRAME) {
      const [p1, p2] = this.inputs.read();
      this.state = step(this.state, p1, this.cpuP2 ? cpuInput(this.state, 1) : p2);
      this.acc -= TICK_MS;
      steps += 1;
    }
    if (this.acc > TICK_MS * MAX_STEPS_PER_FRAME) this.acc = 0; // tab was hidden: drop the backlog
    this.draw(this.state);
  }

  // ---------- drawing ----------

  private draw(s: GameState): void {
    const g = this.gfx;
    g.clear();

    // Stage: floor and walls.
    g.fillStyle(0x2c3345).fillRect(0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y);
    g.fillStyle(0x596480).fillRect(0, GROUND_Y, VIEW_WIDTH, 3);
    g.fillStyle(0x596480).fillRect(0, 90, 6, GROUND_Y - 90).fillRect(VIEW_WIDTH - 6, 90, 6, GROUND_Y - 90);

    s.fighters.forEach((f, i) => this.drawFighter(s, i, f));
    this.cpuText.setText(this.cpuP2 ? 'CPU' : '');
    this.nameTexts[0].setText(`P1 ${HEROES[s.fighters[0].hero].name}`);
    this.nameTexts[1].setText(`${HEROES[s.fighters[1].hero].name} P2`);
    if (this.debug) for (const f of s.fighters) this.drawDebugBoxes(f);
    this.drawHud(s);

    this.debugText.setVisible(this.debug);
    if (this.debug) {
      const line = (i: number): string => {
        const f = s.fighters[i];
        return `P${i + 1} ${FS_NAMES[f.state]} f${f.stateTick} x${f.x} y${f.y} hp${f.health} stun${f.stunTimer}`;
      };
      this.debugText.setText(`tick ${s.tick}  hash ${hashState(s)}\n${line(0)}\n${line(1)}`);
    }
  }

  private fillWorld(r: Rect): void {
    this.gfx.fillRect(r.x, GROUND_Y - r.y - r.h, r.w, r.h);
  }

  private strokeWorld(r: Rect): void {
    this.gfx.strokeRect(r.x, GROUND_Y - r.y - r.h, r.w, r.h);
  }

  private drawFighter(s: GameState, slot: number, f: FighterState): void {
    const g = this.gfx;
    const hero = HEROES[f.hero];
    const art = artFor(f.hero);
    const sprite = this.sprites[slot];
    sprite.setVisible(art !== undefined);
    if (art) {
      // Flipping mirrors the cell, so the feet anchor mirrors with it.
      const ox = f.facing === 1 ? art.feetX : art.cell - art.feetX;
      sprite
        .setTexture(art.key, frameFor(art, s, slot))
        .setScale(art.scale)
        .setOrigin(ox / art.cell, art.feetY / art.cell)
        .setFlipX(f.facing !== 1)
        .setPosition(f.x, GROUND_Y - f.y)
        .setDepth(f.state === FS.Attack ? 2 : 1);
      if (f.state === FS.Hitstun && f.stateTick < 4) sprite.setTintFill(0xffffff);
      else sprite.clearTint();
      return;
    }

    const st = hero.stats;
    const base = parseInt(hero.color.slice(1), 16);
    const light = Phaser.Display.Color.ValueToColor(base).lighten(30).color;
    const lying = (f.state === FS.Knockdown || f.state === FS.KO) && f.y === 0 && f.vy === 0;

    let w = st.width;
    let h = f.state === FS.Crouch ? st.crouchHeight : st.height;
    if (lying) {
      w = st.height;
      h = 28;
    }
    const flash = f.state === FS.Hitstun && f.stateTick < 4;
    g.fillStyle(flash ? 0xffffff : f.state === FS.KO ? 0x666666 : base);
    this.fillWorld({ x: f.x - w / 2, y: f.y, w, h });

    if (lying) return;

    // Eye, so facing is readable.
    g.fillStyle(0x111111);
    this.fillWorld({ x: f.x + f.facing * (w / 2 - 14) - 4, y: f.y + h - 22, w: 8, h: 8 });

    if (f.state === FS.Attack) {
      const hits = getHitboxes(f);
      g.fillStyle(light);
      if (hits.length > 0) hits.forEach((r) => this.fillWorld(r));
      else this.fillWorld({ x: f.facing === 1 ? f.x + w / 2 : f.x - w / 2 - 14, y: f.y + 60, w: 14, h: 18 });
    } else if (f.state === FS.Block) {
      g.fillStyle(0x7fe3ff);
      this.fillWorld({ x: f.facing === 1 ? f.x + w / 2 + 2 : f.x - w / 2 - 10, y: f.y + 10, w: 8, h: h - 20 });
    }
  }

  private drawDebugBoxes(f: FighterState): void {
    const g = this.gfx;
    const st = HEROES[f.hero].stats;
    g.lineStyle(1, 0xffe14d, 1);
    this.strokeWorld({ x: f.x - st.width / 2, y: f.y, w: st.width, h: st.height });
    g.lineStyle(2, 0x39d353, 1);
    g.fillStyle(0x39d353, 0.2);
    for (const r of getHurtboxes(f)) {
      this.fillWorld(r);
      this.strokeWorld(r);
    }
    g.lineStyle(2, 0xff3b3b, 1);
    g.fillStyle(0xff3b3b, 0.35);
    for (const r of getHitboxes(f)) {
      this.fillWorld(r);
      this.strokeWorld(r);
    }
  }

  private drawHud(s: GameState): void {
    const g = this.gfx;
    const frac = (i: number): number => s.fighters[i].health / HEROES[s.fighters[i].hero].stats.maxHealth;
    const x1 = 40;
    const x2 = VIEW_WIDTH - 40 - BAR_W;

    g.fillStyle(0x4a1515).fillRect(x1, BAR_Y, BAR_W, BAR_H).fillRect(x2, BAR_Y, BAR_W, BAR_H);
    g.fillStyle(0xf2c230);
    const w1 = Math.round(BAR_W * frac(0));
    const w2 = Math.round(BAR_W * frac(1));
    g.fillRect(x1 + BAR_W - w1, BAR_Y, w1, BAR_H); // P1 drains toward the centre
    g.fillRect(x2, BAR_Y, w2, BAR_H);
    g.lineStyle(2, 0xffffff, 1).strokeRect(x1, BAR_Y, BAR_W, BAR_H).strokeRect(x2, BAR_Y, BAR_W, BAR_H);

    // Round win pips.
    for (let i = 0; i < ROUNDS_TO_WIN; i += 1) {
      g.fillStyle(i < s.wins[0] ? 0xf2c230 : 0x444444).fillCircle(x1 + BAR_W - 10 - i * 22, BAR_Y + BAR_H + 14, 7);
      g.fillStyle(i < s.wins[1] ? 0xf2c230 : 0x444444).fillCircle(x2 + 10 + i * 22, BAR_Y + BAR_H + 14, 7);
    }

    this.timerText.setText(String(Math.ceil(s.timer / TICK_RATE)));
    this.messageText.setFontSize(this.selecting ? 26 : 48).setY(this.selecting ? 150 : 200);
    this.messageText.setText(this.message(s));
  }

  private message(s: GameState): string {
    if (this.selecting) return 'CHOOSE YOUR FIGHTER\nP1: A / D or tap left     P2: ◀ / ▶ or tap right\nEnter or tap centre to FIGHT';
    const who = (r: number): string => (r === Result.Draw ? 'DRAW' : `P${r + 1} WINS`);
    switch (s.phase) {
      case Phase.Intro:
        return `ROUND ${s.round}`;
      case Phase.Fight:
        return s.timer > ROUND_TICKS - 40 ? 'FIGHT!' : '';
      case Phase.RoundEnd: {
        const ko = s.fighters[0].health <= 0 || s.fighters[1].health <= 0;
        return `${ko ? 'K.O.' : 'TIME UP'}\n${who(s.roundResult)} THE ROUND`.replace('DRAW THE ROUND', 'DRAW');
      }
      default:
        return `${who(s.matchResult)}${s.matchResult === Result.Draw ? '' : ' THE MATCH'}\nEnter or tap: fighter select`;
    }
  }
}
