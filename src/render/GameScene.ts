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

export const VIEW_WIDTH = STAGE_WIDTH;
export const VIEW_HEIGHT = 540;
const GROUND_Y = 470;
const TICK_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;
const BAR_W = 400;
const BAR_H = 24;
const BAR_Y = 30;

const FONT = { fontFamily: 'monospace', color: '#ffffff' };

/** Read-only view of the sim. All game logic lives in src/sim. */
export class GameScene extends Phaser.Scene {
  private state: GameState = createInitialState(0, 1);
  private acc = 0;
  private debug = false;
  private gfx!: Phaser.GameObjects.Graphics;
  private timerText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private debugText!: Phaser.GameObjects.Text;

  constructor(private readonly inputs: InputSource) {
    super('game');
  }

  create(): void {
    this.gfx = this.add.graphics();
    this.timerText = this.add.text(VIEW_WIDTH / 2, BAR_Y + BAR_H / 2, '', { ...FONT, fontSize: '40px' }).setOrigin(0.5);
    this.messageText = this.add
      .text(VIEW_WIDTH / 2, 200, '', { ...FONT, fontSize: '48px', align: 'center', stroke: '#000000', strokeThickness: 6 })
      .setOrigin(0.5);
    this.debugText = this.add.text(8, GROUND_Y + 8, '', { ...FONT, fontSize: '12px', color: '#9fe89f' });
    this.add.text(40, BAR_Y + BAR_H + 4, `P1 ${HEROES[this.state.fighters[0].hero].name}`, { ...FONT, fontSize: '14px' });
    this.add
      .text(VIEW_WIDTH - 40, BAR_Y + BAR_H + 4, `${HEROES[this.state.fighters[1].hero].name} P2`, { ...FONT, fontSize: '14px' })
      .setOrigin(1, 0);

    const kb = this.input.keyboard!;
    const toggle = (): void => {
      this.debug = !this.debug;
    };
    kb.on('keydown-F2', toggle);
    kb.on('keydown-BACKTICK', toggle);
    kb.on('keydown-ENTER', () => {
      if (this.state.phase === Phase.MatchEnd) this.state = createInitialState(0, 1);
    });
  }

  update(_time: number, delta: number): void {
    this.acc += delta;
    let steps = 0;
    while (this.acc >= TICK_MS && steps < MAX_STEPS_PER_FRAME) {
      const [p1, p2] = this.inputs.read();
      this.state = step(this.state, p1, p2);
      this.acc -= TICK_MS;
      steps += 1;
    }
    if (this.acc > TICK_MS * MAX_STEPS_PER_FRAME) this.acc = 0; // tab was hidden: drop the backlog
    this.draw();
  }

  // ---------- drawing ----------

  private draw(): void {
    const s = this.state;
    const g = this.gfx;
    g.clear();

    // Stage: floor and walls.
    g.fillStyle(0x2c3345).fillRect(0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y);
    g.fillStyle(0x596480).fillRect(0, GROUND_Y, VIEW_WIDTH, 3);
    g.fillStyle(0x596480).fillRect(0, 90, 6, GROUND_Y - 90).fillRect(VIEW_WIDTH - 6, 90, 6, GROUND_Y - 90);

    for (const f of s.fighters) this.drawFighter(f);
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

  private drawFighter(f: FighterState): void {
    const g = this.gfx;
    const hero = HEROES[f.hero];
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
    this.messageText.setText(this.message(s));
  }

  private message(s: GameState): string {
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
        return `${who(s.matchResult)}${s.matchResult === Result.Draw ? '' : ' THE MATCH'}\nEnter: rematch`;
    }
  }
}
