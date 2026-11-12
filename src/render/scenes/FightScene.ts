import Phaser from 'phaser';
import { Cpu, guardInput, incomingGuard } from '../../ai/cpu';
import { controls } from '../../input/controls';
import {
  FS,
  FX,
  HEROES,
  INTRO_TICKS,
  Input,
  Kind,
  MOVE_KEYS,
  Move,
  Phase,
  Result,
  STAGE_WIDTH,
  SUPER_FREEZE,
  TICK_RATE,
  createInitialState,
  getHitboxes,
  getHurtboxes,
  getMove,
  getProjectile,
  rallying,
  ROUND_TICKS,
  step,
} from '../../sim';
import type { FighterState, GameState } from '../../sim';
import { playMusic, sfx } from '../audio';
import { C, CSS, GROUND_Y, VIEW_H, VIEW_W } from '../config';
import type { MatchSetup } from '../config';
import { Effects } from '../fx';
import { artFor, feetOrigin, frameName, poseFor } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { Hud } from '../hud';
import { SuperFx } from '../superFx';
import { moveList } from '../moves';
import { backHint, inputText } from '../prompts';
import { STAGES } from '../stages';
import { ComboTracker, TRIALS, stepLabel } from '../trials';
import { Rollback } from '../../net/rollback';
import { online, sendMine, theirs } from '../../net/session';
import { decodeInputs, encodeInputs, saveReplay } from '../replays';
import type { StageDef } from '../stages';
import { Menu, body, display, goTo, goldFill } from '../ui';

const TICK_MS = 1000 / TICK_RATE;
const MAX_STEPS_PER_FRAME = 5;
const DUMMY_MODES = ['STAND', 'CROUCH', 'JUMP', 'BLOCK ALL', 'CPU'];
/** Fighting-game camera: fully zoomed in at CAM_NEAR apart or closer, back to 1x at CAM_FAR. */
const CAM_ZOOM = 1.28;
const CAM_NEAR = 300;
const CAM_FAR = 640;

interface ProjectileView {
  img: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Image;
  /** Extra pieces: Chris's fan of cards, the Leader's crew running beside the first. */
  extra: Phaser.GameObjects.Sprite[];
}

export class FightScene extends Phaser.Scene {
  private setup!: MatchSetup;
  private stage!: StageDef;
  private state!: GameState;
  private acc = 0;
  private clock = 0;
  private world!: Phaser.GameObjects.Layer;
  private ui!: Phaser.GameObjects.Layer;
  private sprites: Phaser.GameObjects.Image[] = [];
  /** Rally: a hot glow behind a fighter who is low on health and building meter fast. */
  private rallyGlow: Phaser.GameObjects.Image[] = [];
  /** Heat: a flame aura in the fighter's colour while it lasts. */
  private heatAura: Phaser.GameObjects.Sprite[] = [];
  private promptStamp = -1;
  private lastSmear = [-1, -1];
  private lastArc = [-1, -1];
  private shadows: Phaser.GameObjects.Image[] = [];
  private projViews: ProjectileView[] = [];
  private darken!: Phaser.GameObjects.Rectangle;
  private debugG!: Phaser.GameObjects.Graphics;
  private fx!: Effects;
  private superFx!: SuperFx;
  private hud!: Hud;
  private cpu: Cpu | null = null;
  private debug = false;
  private paused = false;
  private pauseObjects: Phaser.GameObjects.GameObject[] = [];
  private pauseMenu: Menu | null = null;
  private moveListObjects: Phaser.GameObjects.GameObject[] = [];
  private celebrate = [0, 0];
  /** Render-only settle poses: the sim tick a fighter landed or stood up from a crouch (-99 none). */
  private landedAt = [-99, -99];
  private stoodAt = [-99, -99];
  private matchOverTicks = 0;
  /** Camera: eased zoom and centre, and the extra punch-in a super flash adds. */
  private camZoom = 1;
  private camX = VIEW_W / 2;
  private camY = VIEW_H / 2;
  private punch = { z: 1 };
  /** Playback speed of the sim (render only): the KO plays in slow motion, then eases back. */
  private slowmo = { rate: 1 };
  private dummy = 3;
  private trainingText: Phaser.GameObjects.Text | null = null;
  /** The state the match started from, every input played, and how many sim frames have run. */
  private initState!: GameState;
  private log: Array<[number, number]> = [];
  private frames = 0;
  private simpleFlags: [boolean, boolean] = [false, false];
  /** Online: the rollback session; ticks spent waiting on the other side; a pause press to confirm leaving. */
  private rb: Rollback | null = null;
  private stalled = 0;
  private leaveArmed = 0;
  private netText: Phaser.GameObjects.Text | null = null;
  /** Replay mode: the inputs being played back, and the playback speed. */
  private replayInputs: Array<[number, number]> | null = null;
  private replaySpeed = 1;
  /** The match is decided: the frame it ended, the frame the last round's fight began, the final state. */
  private koFrame = -1;
  private decidedAt = -1;
  private lastPhase: number = Phase.Intro;
  private roundStart = 0;
  private finalState: GameState | null = null;
  /** The finishing-blow replay shown before the results: next frame to play, the last one, done. */
  private finale: { f: number; to: number; done: boolean; objs: Phaser.GameObjects.GameObject[]; at: number } | null = null;
  /** Combo trials (training): the current trial, which are cleared, and what the current combo holds. */
  private trialOn = false;
  private trialIndex = 0;
  private trialCleared: boolean[] = TRIALS.map(() => false);
  private trialWatch = new ComboTracker(0);
  private trialObjs: Phaser.GameObjects.GameObject[] = [];
  private trialChips: Phaser.GameObjects.Text[] = [];
  /** The trial was just cleared and the next one is about to appear. */
  private trialLocked = false;
  private rain: Phaser.GameObjects.Image[] = [];
  private nextLightning = 0;
  private ambientT = 0;

  constructor() {
    super('fight');
  }

  create(setup: MatchSetup): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.setup = setup;
    this.stage = STAGES[setup.stage];
    const simple = (this.registry.get('simple') as boolean | undefined) ?? false;
    const twoHumans = setup.mode === 'versus' || setup.mode === 'online' || setup.mode === 'replay';
    this.simpleFlags = setup.simple ? [setup.simple[0], setup.simple[1] && twoHumans] : [simple, simple && setup.mode === 'versus'];
    this.state = createInitialState(setup.p1, setup.p2, { training: setup.mode === 'training', simple: this.simpleFlags });
    this.initState = this.state;
    this.log = [];
    this.frames = 0;
    this.koFrame = -1;
    this.decidedAt = -1;
    this.lastPhase = Phase.Intro;
    this.roundStart = 0;
    this.finalState = null;
    this.finale = null;
    this.stalled = 0;
    this.leaveArmed = 0;
    this.netText = null;
    this.replaySpeed = 1;
    this.rb = setup.mode === 'online' && setup.online ? new Rollback(this.state, setup.online.me) : null;
    this.replayInputs = setup.mode === 'replay' && setup.replay ? decodeInputs(setup.replay.inputs) : null;
    this.acc = 0;
    this.clock = 0;
    this.paused = false;
    this.celebrate = [0, 0];
    this.landedAt = [-99, -99];
    this.stoodAt = [-99, -99];
    this.punch = { z: 1 };
    this.slowmo = { rate: 1 };
    this.matchOverTicks = 0;
    this.pauseObjects = [];
    this.moveListObjects = [];
    this.pauseMenu = null;
    this.rain = [];
    this.projViews = [];
    this.trainingText = null;
    this.trialOn = false;
    this.trialObjs = [];
    this.trialChips = [];
    this.trialLocked = false;
    this.trialWatch = new ComboTracker(0);
    this.cpu = setup.mode === 'cpu' ? new Cpu(setup.cpuLevel, Date.now() & 0xffff) : setup.mode === 'training' ? new Cpu(1, 99) : null;

    const main = this.cameras.main;
    main.setBackgroundColor(C.night);
    main.fadeIn(300, 5, 6, 12);
    this.world = this.add.layer();
    this.ui = this.add.layer();

    // Stage art at 2x, floor line on GROUND_Y.
    const top = GROUND_Y - this.stage.groundSrcY * 2;
    this.world.add(this.add.image(0, top, `stage_${this.stage.id}`).setOrigin(0, 0).setScale(2).setDepth(0));
    this.buildAmbient(top);
    this.darken = this.add.rectangle(-500, -500, VIEW_W + 1000, VIEW_H + 1000, 0x000000, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(8);
    this.world.add(this.darken);

    this.sprites = [];
    this.shadows = [];
    this.rallyGlow = [];
    this.heatAura = [];
    this.state.fighters.forEach((f, i) => {
      const art = artFor(f.hero);
      this.rallyGlow.push(this.add.image(f.x, GROUND_Y, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff5a1e).setDepth(29).setVisible(false));
      this.heatAura.push(this.add.sprite(f.x, GROUND_Y, 'px_heat_aura').setOrigin(0.5, 0.94).setBlendMode(Phaser.BlendModes.ADD).setDepth(28).setVisible(false).play('px_heat_aura'));
      this.shadows.push(this.add.image(f.x, GROUND_Y + 2, 'fx_shadow').setDepth(12).setAlpha(0.8));
      this.sprites.push(this.add.image(f.x, GROUND_Y, art.key).setScale(art.scale).setDepth(30 + i));
      this.projViews.push({
        glow: this.add.image(0, 0, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(44),
        img: this.add.sprite(0, 0, 'px_record').setVisible(false).setDepth(45),
        extra: [0, 1].map(() => this.add.sprite(0, 0, 'px_card').setVisible(false).setDepth(45)),
      });
    });
    this.world.add([...this.heatAura, ...this.rallyGlow, ...this.shadows, ...this.sprites, ...this.projViews.flatMap((p) => [p.glow, p.img, ...p.extra])]);
    this.debugG = this.add.graphics().setDepth(90);
    this.world.add(this.debugG);
    this.fx = new Effects(this, this.world);
    this.superFx = new SuperFx(this, this.world, this.ui);

    // The HUD gets its own camera so shakes and zooms leave it still.
    const cpuSide = setup.mode === 'cpu' ? 1 : -1;
    this.hud = new Hud(this, this.state, cpuSide, setup.mode === 'training');
    this.ui.add(this.hud.objects);
    if (setup.mode === 'training') {
      this.trainingText = this.add.text(VIEW_W / 2, 78, '', body(13, CSS.ink)).setOrigin(0.5, 0).setBackgroundColor('#0b0e1ccc').setPadding(10, 4, 10, 4);
      this.ui.add(this.trainingText);
    }
    const hudCam = this.cameras.add(0, 0, VIEW_W, VIEW_H);
    main.ignore(this.ui);
    hudCam.ignore(this.world);

    this.centerCamera(true);
    playMusic(this, this.stage.music);
    if (setup.mode !== 'training') this.hud.shout('ROUND 1', '', 1000);
    if (this.rb || this.replayInputs) {
      this.netText = this.add.text(VIEW_W / 2, VIEW_H - 14, '', body(13, CSS.ink)).setOrigin(0.5, 1).setBackgroundColor('#0b0e1ccc').setPadding(10, 3, 10, 3);
      this.ui.add(this.netText);
    }

    const kb = this.input.keyboard;
    if (kb) {
      kb.addCapture('F1,F2,F3,F4,F5');
      kb.on('keydown-F2', () => (this.debug = !this.debug));
      kb.on('keydown-BACKTICK', () => (this.debug = !this.debug));
      kb.on('keydown-F1', () => {
        if (this.setup.mode === 'training') this.dummy = (this.dummy + 1) % DUMMY_MODES.length;
      });
      kb.on('keydown-F3', () => {
        if (this.setup.mode === 'training') this.state = createInitialState(this.setup.p1, this.setup.p2, { training: true });
      });
      kb.on('keydown-F4', () => this.toggleTrials());
      kb.on('keydown-F5', () => {
        if (this.trialOn) this.nextTrial();
      });
    }
    controls.take();
  }

  // ---------- inputs ----------

  private inputs(s: GameState): [number, number] {
    if (this.replayInputs) return this.replayInputs[this.frames] ?? [0, 0];
    const solo = this.setup.mode !== 'versus';
    // Playing alone, either set of keys (or the first pad) drives player 1.
    const p1 = solo ? controls.bits(0) | controls.bits(1) : controls.bits(0);
    if (this.setup.mode === 'versus') return [p1, controls.bits(1)];
    if (this.setup.mode === 'cpu') return [p1, this.cpu ? this.cpu.next(s, 1) : 0];
    return [p1, this.dummyInput(s)];
  }

  private dummyInput(s: GameState): number {
    switch (DUMMY_MODES[this.dummy]) {
      case 'CROUCH':
        return Input.Down;
      case 'JUMP':
        return s.tick % 2 === 0 ? Input.Up : 0;
      case 'BLOCK ALL': {
        const g = incomingGuard(s, 1);
        return g >= 0 ? guardInput(s, 1, g) : 0;
      }
      case 'CPU':
        return this.cpu ? this.cpu.next(s, 1) : 0;
      default:
        return 0;
    }
  }

  // ---------- the loop ----------

  update(_t: number, delta: number): void {
    controls.poll();
    // A trial's buttons follow whatever player 1 is holding: pad buttons or keyboard words.
    if (controls.deviceStamp !== this.promptStamp) {
      this.promptStamp = controls.deviceStamp;
      if (this.trialOn) this.buildTrial();
    }
    for (const e of controls.take()) {
      if (this.finale) {
        // Buttons still mashed from the knockout don't skip it: only a press after it has started.
        if (!this.finale.done && this.time.now - this.finale.at > 700 && (e.action === 'confirm' || e.action === 'pause' || e.action === 'back')) this.finale.done = true;
      }
      else if (this.replayInputs) this.replayControl(e.action);
      else if (this.rb) this.onlineControl(e.action);
      else if (this.paused) this.pauseInput(e.action);
      else if (e.action === 'pause' && this.state.phase !== Phase.MatchEnd) this.openPause();
    }

    if (!this.paused) {
      // After a KO the sim ignores input, so playing it slower changes nothing but the drama.
      this.acc += delta * this.slowmo.rate * this.replaySpeed;
      const most = MAX_STEPS_PER_FRAME * this.replaySpeed;
      let steps = 0;
      while (this.acc >= TICK_MS && steps < most) {
        this.acc -= TICK_MS;
        steps += 1;
        this.tick();
      }
      if (this.acc > TICK_MS * most) this.acc = 0; // tab was hidden: drop the backlog
    }
    if (this.rb) this.netStatus();

    this.draw(delta);

    // The match is decided (online: once both sides' inputs confirm it).
    const decided = this.state.phase === Phase.MatchEnd && (!this.rb || this.rb.confirmed + 1 >= this.rb.frame);
    if (this.finale) {
      if (this.finale.done) this.proceed();
    } else if (decided && !this.paused) {
      this.matchOverTicks += delta / TICK_MS;
      const showFinale = this.setup.mode !== 'training' && this.setup.mode !== 'replay';
      if (showFinale && this.matchOverTicks > 110) this.startFinale();
      else if (!showFinale && this.matchOverTicks > 170) this.proceed();
    }
  }

  /** One sim frame: local, online (rollback), replay, or the finishing-blow replay. */
  private tick(): void {
    if (this.finale) return this.finaleTick();
    if (this.rb) return this.netTick();
    if (this.replayInputs && this.frames >= this.replayInputs.length) {
      if (!this.finale) this.matchOverTicks = 999;
      return;
    }
    const prev = this.state;
    const [a, b] = this.inputs(prev);
    this.log[this.frames] = [a, b];
    this.state = step(prev, a, b);
    this.frames += 1;
    this.clock += 1;
    this.simEvents(prev, this.state);
    this.watchEnd();
  }

  private netTick(): void {
    const rb = this.rb!;
    const m = this.setup.online!.match;
    const t = theirs();
    if (t?.g && t.g.m === m) rb.receive(t.g);
    const send = (): void => sendMine({ g: { m, ...rb.outgoing() } });
    // Decided and confirmed: stop here (keep sending, so the other side can confirm it too).
    if (this.state.phase === Phase.MatchEnd && rb.confirmed + 1 >= rb.frame) {
      this.watchEnd();
      return send();
    }
    if (rb.shouldWait() || !rb.canAdvance()) {
      if (!rb.canAdvance()) this.stalled += 1;
      return send();
    }
    this.stalled = 0;
    rb.addLocal(controls.bits(0) | controls.bits(1));
    const { prev, next } = rb.advance();
    this.state = next;
    this.frames = rb.frame;
    this.clock += 1;
    this.simEvents(prev, next);
    this.watchEnd();
    send();
  }

  private netStatus(): void {
    const rb = this.rb!;
    const o = online();
    const t = theirs();
    const gone = !o || o.link.quietFor() > 8000 || (t !== null && !t.g && this.frames > 120);
    if (gone && !this.finale) {
      goTo(this, 'online', { notice: 'Your opponent left the match.' }, 300);
      return;
    }
    let msg = '';
    if (rb.desynced) msg = 'OUT OF SYNC: the two games disagree. Finish the round and rematch.';
    else if (this.stalled > 20) msg = this.frames < 30 ? 'CONNECTING TO YOUR OPPONENT…' : 'WAITING FOR YOUR OPPONENT…';
    else if (this.leaveArmed > 0 && this.time.now - this.leaveArmed < 2000) msg = 'PRESS START AGAIN TO LEAVE THE MATCH';
    this.netText?.setText(msg).setVisible(msg !== '');
  }

  private onlineControl(action: string): void {
    if (action !== 'pause') return;
    if (this.leaveArmed > 0 && this.time.now - this.leaveArmed < 2000) {
      sendMine({ g: null, ready: false });
      goTo(this, 'online', { notice: 'You left the match.' }, 300);
    } else this.leaveArmed = this.time.now;
  }

  private replayControl(action: string): void {
    if (action === 'confirm') {
      this.replaySpeed = this.replaySpeed >= 4 ? 1 : this.replaySpeed * 2;
      sfx(this, 'ui_move', 0.7);
    } else if (action === 'pause' || action === 'back') this.proceed();
  }

  /** Note where the last round's fight began and where the match ended. */
  private watchEnd(): void {
    const s = this.state;
    if (s.phase === Phase.Fight && s.timer === ROUND_TICKS - 1) this.roundStart = this.frames - 1;
    // The frame a round was decided (the knockout itself, long before the match-end screen).
    if (s.phase === Phase.RoundEnd && this.lastPhase === Phase.Fight) this.decidedAt = this.frames;
    this.lastPhase = s.phase;
    if (s.phase === Phase.MatchEnd && this.koFrame < 0) {
      this.koFrame = this.frames;
      this.finalState = s;
    }
  }

  /** Rewind to a moment before the finishing blow and play it again, slower, letterboxed. */
  private startFinale(): void {
    const log = this.rb ? this.rb.log : this.log;
    if (this.koFrame < 0) {
      this.koFrame = this.frames;
      this.finalState = this.state;
    }
    const hit = this.decidedAt > 0 ? this.decidedAt : this.koFrame;
    const from = Math.max(this.roundStart, hit - 150);
    let s = this.initState;
    for (let f = 0; f < from; f += 1) s = step(s, log[f]?.[0] ?? 0, log[f]?.[1] ?? 0);
    this.state = s;
    this.celebrate = [0, 0];
    this.tweens.killTweensOf(this.slowmo);
    this.slowmo.rate = 0.6;
    const bars = [0, VIEW_H - 54].map((y) => this.add.rectangle(0, y, VIEW_W, 54, 0x000000, 1).setOrigin(0, 0));
    const tag = this.add.text(28, 27, '● REPLAY', display(20, '#ff4a4a', 5)).setOrigin(0, 0.5);
    const skip = this.add.text(VIEW_W - 28, VIEW_H - 27, 'CONFIRM: skip', body(14, CSS.muted)).setOrigin(1, 0.5);
    this.ui.add([...bars, tag, skip]);
    this.tweens.add({ targets: tag, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    this.finale = { f: from, to: Math.min(this.koFrame, hit + 110), done: false, objs: [...bars, tag, skip], at: this.time.now };
  }

  private finaleTick(): void {
    const fin = this.finale!;
    if (fin.done) return;
    const log = this.rb ? this.rb.log : this.log;
    if (fin.f >= fin.to) {
      fin.done = true;
      return;
    }
    const prev = this.state;
    const p = log[fin.f] ?? [0, 0];
    this.state = step(prev, p[0], p[1]);
    fin.f += 1;
    this.clock += 1;
    this.simEvents(prev, this.state);
  }

  /** Leave the fight: results (or the online lobby), saving the replay on the way. */
  private proceed(): void {
    if ((this as unknown as { leaving?: boolean }).leaving) return;
    const setup = this.setup;
    if (setup.mode === 'replay' && setup.replay) {
      goTo(this, setup.replay.back.scene, setup.replay.back.data, 300);
      return;
    }
    const s = this.finalState ?? this.state;
    const wins: [number, number] = [s.wins[0], s.wins[1]];
    const frames = this.koFrame > 0 ? this.koFrame : this.frames;
    const inputs = setup.mode === 'training' ? '' : encodeInputs(this.rb ? this.rb.log : this.log, frames);
    if (inputs) {
      saveReplay({ at: Date.now(), p1: setup.p1, p2: setup.p2, stage: setup.stage, simple: this.simpleFlags, winner: s.matchResult, wins, mode: setup.mode, inputs });
    }
    const o = online();
    if (setup.mode === 'online' && o) {
      o.last = { winner: s.matchResult, wins };
      goTo(this, 'online', {}, 400);
      return;
    }
    goTo(this, 'result', { setup, winner: s.matchResult, wins, replay: inputs, simple: this.simpleFlags }, 400);
  }

  // ---------- sim events to sound and effects ----------

  private signature(slot: number, kind: 'special' | 'projectile' = 'special'): string {
    return heroInfo(HEROES[this.state.fighters[slot].hero].id).sfx[kind];
  }

  private simEvents(prev: GameState, next: GameState): void {
    if (this.trialOn) {
      this.trialWatch.update(prev, next);
      const t = TRIALS[this.trialIndex];
      if (!this.trialLocked && this.trialWatch.progress(t) === t.steps.length) this.clearTrial();
    }
    for (let i = 0; i < 2; i += 1) {
      const f = next.fighters[i];
      const p = prev.fighters[i];
      const att = next.fighters[1 - i];
      const x = f.fxX;
      const y = GROUND_Y - f.fxY;
      const dir = f.x >= att.x ? 1 : -1;

      // Rally: dropping to a third of your health lights you up and doubles your meter gain.
      if (!next.training && next.phase === Phase.Fight && rallying(f) && !rallying(p) && p.health > 0) {
        const info = heroInfo(HEROES[f.hero].id);
        this.time.delayedCall(220, () => {
          this.fx.popText(f.x, GROUND_Y - f.y - 290, 'RALLY!', '#ff8a3a');
          this.fx.ring(f.x, GROUND_Y - f.y - 110, info.accent, 1.3);
          sfx(this, 'super', 0.35, 300);
        });
      }

      if (f.fx === FX.Hit || f.fx === FX.Counter || f.fx === FX.Punish || f.fx === FX.Throw) {
        const projectileHit = att.state !== FS.Attack || att.moveHits === 0;
        const moveId = att.state === FS.Attack ? att.moveId : -1;
        const kind = moveId >= 0 ? getMove(att.hero, moveId).kind : Kind.Special;
        const special = projectileHit || kind === Kind.Special || kind === Kind.Super;
        const attInfo = heroInfo(HEROES[att.hero].id);
        // Every hit carries the attacker's identity: his colours, his particles, his sound on the big ones.
        const color = special ? attInfo.accent : f.fxPower >= 10 ? attInfo.color : 0xfff3c4;
        this.fx.hit(x, y, dir, f.fxPower, color, f.fx === FX.Counter || f.fx === FX.Punish);
        this.fx.themed(attInfo.hitStyle, x, y, dir, f.fxPower);
        if (f.fx === FX.Throw) sfx(this, 'throw');
        else if (moveId === Move.Light || moveId === Move.CrouchLight) sfx(this, 'hit_light', 1, (Math.random() - 0.5) * 200);
        else if (moveId === Move.Kick || moveId === Move.Sweep || moveId === Move.JumpAttack) sfx(this, 'hit_kick');
        else sfx(this, 'hit_heavy', 1, (Math.random() - 0.5) * 150);
        if (special) sfx(this, this.signature(1 - i), 0.55);
        else if (f.fxPower >= 10) sfx(this, attInfo.hitSfx, 0.35, (Math.random() - 0.5) * 200);
        // A deep crunch under every big hit.
        if (f.fxPower >= 10) sfx(this, 'hit_crunch', 0.55, (Math.random() - 0.5) * 150);
        if (f.fxPower >= 10) this.cameras.main.shake(90 + f.fxPower * 6, 0.002 + f.fxPower * 0.00035);
        // Rumble: the one who got hit feels it most.
        controls.rumble(i, Math.min(1, 0.25 + f.fxPower * 0.045), 70 + f.fxPower * 9);
        controls.rumble(1 - i, Math.min(0.6, 0.1 + f.fxPower * 0.02), 50);
        if (f.fx === FX.Counter) this.fx.popText(f.x, GROUND_Y - f.y - 250, 'COUNTER', '#ff6a4a');
        if (f.fx === FX.Punish) this.fx.popText(f.x, GROUND_Y - f.y - 250, 'PUNISH', '#ffb030');
        if (f.fx === FX.Counter || f.fx === FX.Punish) sfx(this, 'counter', 0.7);
      } else if (f.fx === FX.Block) {
        this.fx.block(x, y, dir, heroInfo(HEROES[f.hero].id).accent);
        sfx(this, 'block', 0.9, (Math.random() - 0.5) * 200);
        controls.rumble(i, 0.2, 50);
      } else if (f.fx === FX.Armor) {
        // Armor soaks it: a steel clang, and he keeps coming.
        this.fx.block(x, y, dir, 0xfff2c0);
        this.fx.ring(x, y, heroInfo(HEROES[f.hero].id).accent, 1.1);
        this.fx.popText(f.x, GROUND_Y - f.y - 260, 'ARMOR', '#ffe08a');
        sfx(this, 'armor', 0.9);
        sfx(this, 'block', 0.6, -700);
        this.cameras.main.shake(120, 0.004);
        controls.rumble(i, 0.5, 110);
      } else if (f.fx === FX.Wall) {
        // Wall bounce: they hit the wall, cracks spread, and the screen jolts.
        const wx = f.x + (f.push > 0 ? -40 : 40);
        this.fx.burst('px_cracks', wx, GROUND_Y - f.y - 40, 1.8, 90 * (f.push > 0 ? -1 : 1), undefined, 58);
        this.fx.burst('px_crit', wx, GROUND_Y - f.y - 60, 1.6);
        this.fx.popText(f.x, GROUND_Y - f.y - 220, 'WALL BOUNCE!', '#9fe6ff');
        this.cameras.main.shake(220, 0.012);
        sfx(this, 'slam', 0.8);
        sfx(this, 'hit_crunch', 0.8);
        controls.rumble(i, 0.8, 200);
      } else if (f.fx === FX.Tech) {
        this.fx.block(x, y, dir);
        this.fx.popText(f.x, GROUND_Y - 260, 'BREAK!', '#9fe6ff');
        sfx(this, 'block');
        sfx(this, 'whoosh_heavy', 0.8);
      } else if (f.fx === FX.Parry) {
        const info = heroInfo(HEROES[f.hero].id);
        this.fx.ring(f.x, GROUND_Y - f.y - 120, info.accent, 1.6);
        this.fx.popText(f.x, GROUND_Y - f.y - 270, `${getMove(f.hero, Move.Special).name.toUpperCase()}!`, '#ffd25a');
        this.cameras.main.flash(120, 255, 230, 160);
        sfx(this, 'block');
        sfx(this, this.signature(i), 0.8);
      } else if (f.fx === FX.Clash) {
        this.fx.hit(x, y, 1, 10, 0xffffff, false);
        this.fx.ring(x, y, 0xffffff, 1.4);
        sfx(this, 'zap', 0.7);
        sfx(this, 'scratch', 0.7);
      }

      // A move starting: whoosh or signature sound.
      if (f.state === FS.Attack && (p.state !== FS.Attack || p.moveId !== f.moveId || f.stateTick < p.stateTick)) {
        const key = MOVE_KEYS[f.moveId];
        if (key === 'light' || key === 'crouchLight' || key === 'jumpAttack') sfx(this, 'whoosh_light', 0.7, (Math.random() - 0.5) * 300);
        else if (key === 'heavy' || key === 'kick' || key === 'sweep' || key === 'throw') sfx(this, 'whoosh_heavy', 0.8);
        else if (key === 'rising') sfx(this, 'whoosh_heavy', 0.9);
        else if (key === 'special' && !getMove(f.hero, f.moveId).projectile) sfx(this, this.signature(i), 0.8);
      }
      // Heat Burst: a shockwave ring on the floor, a flash in their colour and a callout.
      if (f.state === FS.Attack && f.moveId === Move.HeatBurst && (p.moveId !== Move.HeatBurst || p.state !== FS.Attack)) {
        const info = heroInfo(HEROES[f.hero].id);
        this.fx.burst('px_heat_wave', f.x, GROUND_Y - 6, 2.2, 0, info.accent, 27);
        this.fx.burst('px_heat_wave', f.x, GROUND_Y - 110, 1.2, 0, info.color, 27);
        this.fx.popText(f.x, GROUND_Y - f.y - 270, 'HEAT!', '#ffb030');
        this.cameras.main.flash(140, 255, 160, 60);
        this.cameras.main.shake(200, 0.008);
        sfx(this, 'super', 0.6, -200);
        sfx(this, this.signature(i), 0.7);
        controls.rumble(i, 0.6, 220);
      }
      // Heat Smash: everything spent on one blow.
      if (f.state === FS.Attack && f.moveId === Move.HeatSmash && (p.moveId !== Move.HeatSmash || p.state !== FS.Attack)) {
        const info = heroInfo(HEROES[f.hero].id);
        this.fx.popText(f.x, GROUND_Y - f.y - 270, 'HEAT SMASH!', '#ff6a2a');
        this.fx.burst('px_heat_wave', f.x, GROUND_Y - 6, 2.6, 0, info.accent, 27);
        this.cameras.main.flash(160, 255, 120, 40);
        sfx(this, 'super', 0.8);
      }
      if (p.projLife === 0 && f.projLife > 0) {
        sfx(this, this.signature(i, f.projMove === Move.Projectile ? 'projectile' : 'special'), 0.9);
        const r = getProjectile(f);
        if (r) this.fx.ring(r.x + r.w / 2, GROUND_Y - r.y - r.h / 2, heroInfo(HEROES[f.hero].id).accent, 0.7);
        // A squadmate who breaches in stays on screen for a beat, even if he connects at once.
        if (r && artFor(f.hero).projectiles[MOVE_KEYS[f.projMove]] === 'squad') this.fx.breach(r.x + r.w / 2, GROUND_Y, f.facing);
      }
      // A blink (Rogue's Rift): leave a lightning ghost where he was, and strike where he lands.
      if (f.state === FS.Attack && p.state === FS.Attack && Math.abs(f.x - p.x) > 40 && getMove(f.hero, f.moveId).teleport !== 0) {
        const accent = heroInfo(HEROES[f.hero].id).accent;
        this.fx.afterimage(this.sprites[i], accent);
        this.fx.ring(p.x, GROUND_Y - p.y - 120, accent, 1.2);
        this.fx.ring(f.x, GROUND_Y - f.y - 120, accent, 1.6);
        this.fx.themed(heroInfo(HEROES[f.hero].id).hitStyle, f.x, GROUND_Y - f.y - 120, f.facing, 12);
        sfx(this, 'blink', 0.9);
        sfx(this, 'zap', 0.5);
        this.cameras.main.flash(70, 160, 220, 255);
      }
      if (f.state === FS.Dash && p.state !== FS.Dash) {
        sfx(this, 'dash', 0.8);
        this.fx.dust(f.x, GROUND_Y, 4, 50);
      }
      // Landings.
      if (p.y > 0 && f.y === 0) {
        if (f.state === FS.Knockdown || f.state === FS.KO) {
          this.fx.dust(f.x, GROUND_Y, 10, 110);
          sfx(this, 'fall', 0.9);
          this.cameras.main.shake(140, 0.004);
        } else {
          this.fx.dust(f.x, GROUND_Y, 3, 40);
          this.landedAt[i] = next.tick;
        }
      }
      if (p.state === FS.Crouch && (f.state === FS.Idle || f.state === FS.Walk)) this.stoodAt[i] = next.tick;
    }

    if (next.freezeSlot >= 0 && prev.freezeSlot < 0) this.superFlash(next.freezeSlot);

    if (prev.phase !== next.phase) {
      if (next.phase === Phase.Fight) {
        this.hud.shout('FIGHT!', '', 650);
        sfx(this, 'round');
      } else if (next.phase === Phase.RoundEnd) this.roundOver(next);
      else if (next.phase === Phase.Intro) {
        this.celebrate = [0, 0];
        this.hud.shout(next.round === 3 ? 'FINAL ROUND' : `ROUND ${next.round}`, '', 1000);
      } else if (next.phase === Phase.MatchEnd) {
        const w = next.matchResult;
        if (w === Result.Draw) this.hud.shout('DRAW GAME', '', 2400);
        else this.hud.shout(heroInfo(HEROES[next.fighters[w].hero].id).name, 'WINS THE MATCH', 2400);
        if (this.stage.ambient === 'concert') sfx(this, 'crowd', 0.8);
      }
    }
  }

  private roundOver(s: GameState): void {
    const [a, b] = s.fighters;
    const ko = a.health <= 0 || b.health <= 0;
    const winner = s.roundResult;
    let sub = '';
    if (winner === Result.P1 || winner === Result.P2) {
      const w = s.fighters[winner];
      if (w.health >= HEROES[w.hero].stats.maxHealth) sub = 'PERFECT';
    }
    // A super that ends the round gets its own call.
    const finisher = winner === Result.P1 || winner === Result.P2 ? s.fighters[winner] : null;
    if (ko && finisher && finisher.state === FS.Attack && finisher.moveId === Move.Super) {
      sub = sub ? `SUPER FINISH · ${sub}` : 'SUPER FINISH';
      this.cameras.main.flash(420, 255, 220, 120);
    }
    if (ko) {
      sfx(this, 'ko');
      sfx(this, 'ko_boom', 0.8);
      this.slowmo.rate = 0.3;
      controls.rumble(0, 1, 500);
      controls.rumble(1, 1, 500);
      this.tweens.add({ targets: this.slowmo, rate: 1, delay: 900, duration: 500, ease: 'Quad.easeIn' });
      this.tweens.add({ targets: this.punch, z: 1.12, duration: 220, ease: 'Quad.easeOut', yoyo: true, hold: 800 });
      this.cameras.main.flash(260, 255, 255, 255);
      this.cameras.main.shake(420, 0.012);
      this.hud.shout(a.health <= 0 && b.health <= 0 ? 'DOUBLE K.O.' : 'K.O.', sub, 1700);
    } else {
      this.hud.shout('TIME', winner === Result.Draw ? 'DRAW' : sub, 1500);
    }
  }

  private superFlash(slot: number): void {
    const f = this.state.fighters[slot];
    const id = HEROES[f.hero].id;
    const move = getMove(f.hero, Move.Super);
    sfx(this, 'super');
    sfx(this, this.signature(slot), 0.7);
    const cam = this.cameras.main;
    this.tweens.add({ targets: this.punch, z: 1.14, duration: 160, ease: 'Quad.easeOut', yoyo: true, hold: 440 });
    cam.shake(200, 0.004);
    controls.rumble(slot, 0.8, 350);
    this.fx.ring(f.x, GROUND_Y - f.y - 120, heroInfo(id).accent, 2.6);
    this.superFx.flash(heroInfo(id), id, slot, move.name, f.x, GROUND_Y - f.y, f.facing);
  }

  // ---------- drawing ----------

  private centerCamera(snap: boolean): void {
    const [a, b] = this.state.fighters;
    const cam = this.cameras.main;
    const gap = Math.abs(a.x - b.x);
    const air = Math.max(a.y, b.y);
    // In close when the fighters are near each other, out wide as they separate or jump high.
    const near = Phaser.Math.Clamp((CAM_FAR - gap) / (CAM_FAR - CAM_NEAR), 0, 1);
    const want = Math.max(1, 1 + (CAM_ZOOM - 1) * near - air / 900);
    // Pull out quickly (a jump or a dash apart), push in gently.
    this.camZoom = snap ? want : this.camZoom + (want - this.camZoom) * (want < this.camZoom ? 0.14 : 0.05);
    const z = this.camZoom;
    const halfW = VIEW_W / (2 * z);
    const tx = Phaser.Math.Clamp((a.x + b.x) / 2, halfW, STAGE_WIDTH - halfW);
    // The floor stays at the same height on screen at any zoom; the view rises a little to follow jumps.
    const ty = GROUND_Y - (GROUND_Y - VIEW_H / 2) / z - Math.min(40, air * 0.25) / z;
    if (snap) {
      this.camX = tx;
      this.camY = ty;
    } else {
      this.camX += (tx - this.camX) * 0.18;
      this.camY += (ty - this.camY) * 0.12;
    }
    cam.setZoom(z * this.punch.z);
    cam.centerOn(this.camX, this.camY);
  }

  private draw(delta: number): void {
    const s = this.state;
    this.centerCamera(false);
    const frozenFor = s.freezeSlot;

    s.fighters.forEach((f, i) => {
      const art = artFor(f.hero);
      const sprite = this.sprites[i];
      const won = (s.phase === Phase.RoundEnd || s.phase === Phase.MatchEnd) && s.roundResult === i && f.state === FS.Idle && f.y === 0;
      if (won && s.hitstop === 0) this.celebrate[i] += 1;
      const pose = poseFor(art, f, this.clock + i * 13, won && this.celebrate[i] > 0, this.celebrate[i]);
      // The super freeze plays the fighter's power-up, before the super's own startup frames.
      if (s.hitstop > 0 && s.freezeSlot === i && f.state === FS.Attack && f.moveId === Move.Super && art.powerUp.length > 0) {
        const n = art.powerUp.length;
        const k = Math.min(n - 1, Math.floor(((SUPER_FREEZE - s.hitstop) * n) / SUPER_FREEZE));
        pose.frame = frameName('power_up', art.powerUp[k]);
      }
      // Round intro: each fighter powers up once as the round is called, player 2 a beat later.
      if (s.phase === Phase.Intro && f.state === FS.Idle && art.powerUp.length > 0) {
        const n = art.powerUp.length;
        const t = INTRO_TICKS - s.phaseTimer - 10 - i * 22;
        if (t >= 0 && t < 64) pose.frame = frameName('power_up', art.powerUp[Math.min(n - 1, Math.floor((t * n) / 64))]);
      }
      // Settle into stance: knees bend on landing, and the fighter rises out of a crouch.
      if ((f.state === FS.Idle || f.state === FS.Walk) && !won) {
        const c = art.crouch;
        const sinceLand = s.tick - this.landedAt[i];
        const sinceStand = s.tick - this.stoodAt[i];
        if (sinceLand >= 0 && sinceLand < 6) pose.frame = frameName('crouch', c[Math.max(0, Math.min(c.length - 1, 2) - (sinceLand >> 1))]);
        else if (sinceStand >= 0 && sinceStand < 4) pose.frame = frameName('crouch', c[Math.max(0, c.length - 3 - (sinceStand >> 1))]);
      }
      // Hit shake: whoever was just hit (or blocked) jitters for the length of the impact freeze.
      const shaken = s.hitstop > 0 && s.freezeSlot < 0 && (f.state === FS.Hitstun || f.state === FS.Knockdown || f.state === FS.KO || (f.state === FS.Block && f.stunTimer > 0));
      const jitter = shaken ? ((this.clock & 1) === 0 ? 1 : -1) * Math.min(7, 2 + (s.hitstop >> 1)) : 0;
      // Heat: the aura burns in the fighter's colour, flickering faster as it runs out.
      const aura = this.heatAura[i];
      aura.setVisible(f.heat > 0);
      if (f.heat > 0) {
        const info = heroInfo(HEROES[f.hero].id);
        const ending = f.heat < 90 && (this.clock & 4) === 0;
        aura.setPosition(f.x, GROUND_Y - f.y + 6).setScale(art.scale * 1.35 * 1.15, art.scale * 1.35).setTint(info.accent).setAlpha(ending ? 0.35 : 0.85);
      }
      const glow = this.rallyGlow[i];
      const rally = !s.training && rallying(f) && (s.phase === Phase.Fight || s.phase === Phase.Intro);
      glow.setVisible(rally);
      if (rally) {
        const pulse = 0.8 + 0.2 * Math.sin(this.clock * 0.01 + i);
        glow.setPosition(f.x, GROUND_Y - f.y - 100).setScale(2.2 * pulse, 3.2).setAlpha(pulse);
      }
      // Motion on top of the frames: wind-up, lunge and follow-through on attacks, recoil when hit.
      const mo = this.motion(f);
      sprite
        .setFrame(pose.frame)
        .setOrigin(...feetOrigin(art, f.facing !== 1))
        .setFlipX(f.facing !== 1)
        .setPosition(f.x + jitter + mo.dx, GROUND_Y - f.y)
        .setRotation(pose.angle + mo.rot)
        .setDepth(f.state === FS.Attack ? 32 : 30 + i);
      // Weight: squash for a moment on landing, stretch a touch on take-off.
      const sinceLanding = s.tick - this.landedAt[i];
      const squash = sinceLanding >= 0 && sinceLanding < 5 ? (5 - sinceLanding) * 0.012 : f.state === FS.Jump && f.stateTick < 5 ? -(5 - f.stateTick) * 0.008 : 0;
      sprite.setScale(art.scale * (1 + squash) * mo.sx, art.scale * (1 - squash) * mo.sy);
      this.swingArc(f, i);

      // Flashes: white on hit, red on counter, blue on block, glow during a super flash.
      if (f.state === FS.Hitstun && f.stateTick < 3) sprite.setTintFill(0xffffff);
      else if (f.state === FS.Block && f.stunTimer > 0 && f.stateTick < 3) sprite.setTintFill(0xa6e4ff);
      else if (frozenFor === i && Math.floor(this.clock / 3) % 2 === 0) sprite.setTintFill(heroInfo(HEROES[f.hero].id).accent);
      else sprite.setTint(this.stage.tint);

      const shadow = this.shadows[i];
      const lift = Math.min(1, f.y / 240);
      shadow.setPosition(f.x, GROUND_Y + 2).setScale(1.1 - lift * 0.5, 1).setAlpha(0.75 - lift * 0.45);

      // Afterimages on dashes and supers, and a short smear as a big strike swings through.
      const superActive = f.state === FS.Attack && f.moveId === Move.Super;
      let swing = false;
      if (f.state === FS.Attack && f.moveId !== Move.Light && f.moveId !== Move.CrouchLight && f.moveId !== Move.Throw && !superActive) {
        const m = getMove(f.hero, f.moveId);
        swing = f.stateTick >= m.startup - 3 && f.stateTick < m.startup + Math.min(m.active, 4);
      }
      if ((f.state === FS.Dash && this.clock % 3 === 0) || (superActive && this.clock % 2 === 0 && s.hitstop === 0)) {
        this.fx.afterimage(sprite, heroInfo(HEROES[f.hero].id).color);
      } else if (swing && s.hitstop === 0 && (s.tick & 1) === 0 && this.lastSmear[i] !== s.tick) {
        this.lastSmear[i] = s.tick;
        this.fx.afterimage(sprite, heroInfo(HEROES[f.hero].id).accent, 0.3, 160);
      }

      // Projectile.
      const view = this.projViews[i];
      const r = getProjectile(f);
      if (r) {
        const cx = r.x + r.w / 2;
        const cy = GROUND_Y - (r.y + r.h / 2);
        // A squadmate who holds position has no speed: face where the caller faces.
        const dir = f.projVx !== 0 ? (f.projVx > 0 ? 1 : -1) : f.facing;
        const style = art.projectiles[MOVE_KEYS[f.projMove]] ?? 'disc';
        const color = heroInfo(HEROES[f.hero].id).accent;
        const spin = (view.img.rotation + dir * 0.45) % (Math.PI * 2);
        // Pixel-art sprites from PixelLab: animated sheets play, single sprites spin or pulse.
        const play = (sp: Phaser.GameObjects.Sprite, key: string): void => {
          if (sp.anims.currentAnim?.key !== key || !sp.anims.isPlaying) sp.play(key);
        };
        const still = (sp: Phaser.GameObjects.Sprite, key: string): void => {
          if (sp.anims.isPlaying) sp.anims.stop();
          if (sp.texture.key !== key) sp.setTexture(key);
        };
        view.img.setVisible(true).setPosition(cx, cy).setOrigin(0.5).setFlipX(dir < 0).setRotation(0).setAlpha(1).clearTint();
        view.extra.forEach((e) => e.setVisible(false));
        let glowScale = 0.9;
        let glowAlpha = 0.6;
        let trail = true;
        if (style === 'bolt') {
          play(view.img, 'px_rogue_bolt');
          view.img.setScale(1.6);
        } else if (style === 'disc') {
          still(view.img, 'px_record');
          view.img.setScale(1.25).setRotation(spin);
        } else if (style === 'golden') {
          still(view.img, 'px_golden');
          view.img.setScale(1.45 + 0.08 * Math.sin(this.clock * 0.5));
          glowScale = 1.3;
        } else if (style === 'quake') {
          // Ground Breaker: a rolling wall of rock, stone spikes bursting up along its path.
          still(view.img, 'px_rocks');
          view.img.setOrigin(0.5, 1).setPosition(cx, GROUND_Y + 4).setScale(1.25 + 0.05 * Math.sin(this.clock * 0.9));
          if (this.clock % 5 === 0) this.fx.spike(cx - dir * 30, GROUND_Y, dir);
          glowAlpha = 0.25;
          trail = false;
        } else if (style === 'tracer') {
          play(view.img, 'px_mal_bolt');
          view.img.setScale(1.5);
          glowScale = 0.7;
        } else if (style === 'squad') {
          // Gear Up: the soldier is drawn by the breach effect (it outlasts the hit); just a glow here.
          view.img.setVisible(false);
          glowScale = 1.4;
          glowAlpha = 0.3;
          trail = false;
          if (this.clock % 4 === 0) this.fx.dust(cx, GROUND_Y, 2, 50);
        } else if (style === 'crew') {
          // The crew charges: three of them running side by side.
          const k = r.h + 20;
          const all = [view.img, ...view.extra];
          all.forEach((sp, n) => {
            play(sp, 'px_crew_run');
            sp.setVisible(true).setOrigin(0.5, 1).setFlipX(dir < 0).setRotation(0).setAlpha(1).clearTint();
            sp.setScale((k - n * 18) / sp.height).setPosition(cx + dir * (30 - n * 42), GROUND_Y + 4).setDepth(45 - n);
          });
          glowAlpha = 0.25;
          trail = false;
          if (this.clock % 3 === 0) this.fx.dust(cx - dir * 60, GROUND_Y, 2, 40);
        } else {
          // A fan of three spinning cards.
          still(view.img, 'px_card');
          view.img.setScale(0.95).setRotation(this.clock * 0.6 * dir);
          view.extra.forEach((e, k) => {
            const off = (k === 0 ? -1 : 1) * 16;
            still(e, 'px_card');
            e.setVisible(true).setOrigin(0.5).setFlipX(false).setDepth(45).setPosition(cx - dir * 14, cy + off).setScale(0.8).setRotation(this.clock * 0.6 * dir + (k + 1) * 1.2);
          });
          glowScale = 0.7;
        }
        view.glow.setVisible(true).setPosition(cx, cy).setTint(color).setScale(glowScale).setAlpha(glowAlpha + 0.2 * Math.sin(this.clock * 0.5));
        if (trail && this.clock % 2 === 0) this.fx.trail(cx - dir * (r.w / 2), cy, color);
      } else {
        view.img.setVisible(false).anims.stop();
        view.glow.setVisible(false);
        view.extra.forEach((e) => e.setVisible(false).anims.stop());
      }
      if (superActive && s.hitstop === 0) this.superFx.active(heroInfo(HEROES[f.hero].id), f.x, GROUND_Y - f.y, f.facing, this.clock);
    });

    this.ambient(delta);
    this.hud.update(s, delta);
    if (this.trainingText) {
      const def = s.fighters[1];
      this.trainingText.setText(
        `TRAINING  ·  DUMMY: ${DUMMY_MODES[this.dummy]} (F1)  ·  HITBOXES (F2)  ·  RESET (F3)  ·  TRIALS (F4)  ·  LAST COMBO: ${def.comboDamage} DMG`,
      );
    }
    if (this.trialOn && this.trialChips.length > 0) {
      // Light up the steps of the route the current combo has done so far.
      const t = TRIALS[this.trialIndex];
      const n = this.trialLocked ? t.steps.length : this.trialWatch.progress(t);
      this.trialChips.forEach((c, k) => c.setColor(k < n ? (this.trialLocked ? '#7dff9a' : CSS.gold) : CSS.ink));
    }
    this.drawDebug();
  }

  /**
   * Procedural motion layered on the sprite frames, which are few and held for several ticks:
   * a wind-up that pulls back through startup, a lunge and stretch on the strike, then a
   * follow-through that eases home with a small overshoot. Heavier moves (more damage) move more.
   * Getting hit snaps the body back and lets it ease upright over the hitstun.
   */
  private motion(f: FighterState): { dx: number; rot: number; sx: number; sy: number } {
    const dir = f.facing;
    if (f.state === FS.Hitstun && f.y === 0) {
      const total = Math.max(1, f.stateTick + f.stunTimer);
      const k = 1 - f.stateTick / total;
      const e = k * k;
      return { dx: -dir * 7 * e, rot: -dir * 0.1 * e, sx: 1, sy: 1 };
    }
    if (f.state === FS.Dash && f.vx * dir > 0) return { dx: 0, rot: dir * 0.07, sx: 1.03, sy: 0.98 };
    if (f.state !== FS.Attack || f.y > 0 || f.moveId === Move.Super || f.moveId === Move.Throw) return { dx: 0, rot: 0, sx: 1, sy: 1 };
    const m = getMove(f.hero, f.moveId);
    const w = Math.min(1.4, Math.max(0.35, m.damage / 80));
    const t = f.stateTick;
    if (t < m.startup) {
      const p = (t + 1) / m.startup;
      const e = p * p;
      return { dx: -dir * 6 * w * e, rot: -dir * 0.06 * w * e, sx: 1 - 0.04 * w * e, sy: 1 + 0.03 * w * e };
    }
    const a = t - m.startup;
    if (a < m.active) {
      const k = 1 - (a / Math.max(1, m.active)) * 0.35;
      return { dx: dir * 10 * w * k, rot: dir * 0.08 * w * k, sx: 1 + 0.07 * w * k, sy: 1 - 0.05 * w * k };
    }
    const r = Math.min(1, (a - m.active) / Math.max(1, m.recovery));
    const v = 0.65 * (1 - r) * (1 - r) - 0.14 * Math.sin(Math.PI * r);
    return { dx: dir * 10 * w * v, rot: dir * 0.08 * w * v, sx: 1 + 0.04 * w * Math.max(0, v), sy: 1 - 0.03 * w * Math.max(0, v) };
  }

  /** A PixelLab swing arc through the hitbox on the first active frame of every melee strike. */
  private swingArc(f: FighterState, i: number): void {
    if (f.state !== FS.Attack || f.moveId === Move.Throw || f.moveId === Move.Super) return;
    const m = getMove(f.hero, f.moveId);
    if (f.stateTick !== m.startup) return;
    const id = this.state.tick - f.stateTick;
    if (this.lastArc[i] === id) return;
    const boxes = getHitboxes(f);
    if (boxes.length === 0) return;
    this.lastArc[i] = id;
    const b = boxes[0];
    const cx = b.x + b.w / 2;
    const cy = GROUND_Y - (b.y + b.h / 2);
    const low = b.y + b.h < 70;
    const k = Math.max(0.7, Math.min(2.2, Math.max(b.w, b.h) / 70));
    const accent = heroInfo(HEROES[f.hero].id).accent;
    const sp = this.fx.burst('px_swing', cx - f.facing * 10, cy, k, 0, accent, 47);
    sp.setFlipX(f.facing !== 1).setScale(k, low ? k * 0.55 : k).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.95);
  }

  private drawDebug(): void {
    const g = this.debugG;
    g.clear();
    if (!this.debug) return;
    const box = (r: { x: number; y: number; w: number; h: number }): void => {
      g.fillRect(r.x, GROUND_Y - r.y - r.h, r.w, r.h);
      g.strokeRect(r.x, GROUND_Y - r.y - r.h, r.w, r.h);
    };
    for (const f of this.state.fighters) {
      g.lineStyle(2, 0x39d353, 1).fillStyle(0x39d353, 0.18);
      getHurtboxes(f).forEach(box);
      g.lineStyle(2, 0xff3b3b, 1).fillStyle(0xff3b3b, 0.3);
      getHitboxes(f).forEach(box);
      const r = getProjectile(f);
      if (r) box(r);
      g.lineStyle(1, 0xffffff, 0.8).lineBetween(f.x, GROUND_Y - f.y - 8, f.x, GROUND_Y - f.y + 8);
    }
  }

  // ---------- stage ambience ----------

  private buildAmbient(top: number): void {
    const st = this.stage;
    const key = `stage_${st.id}`;
    if (st.neon) {
      const n = st.neon;
      const glow = this.add.rectangle(n.x * 2, top + n.y * 2, n.w * 2, n.h * 2, n.color, 0.12).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(2);
      this.world.add(glow);
      this.tweens.add({ targets: glow, fillAlpha: 0.26, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.time.addEvent({
        delay: 2300,
        loop: true,
        callback: () => {
          if (Math.random() < 0.5) this.tweens.add({ targets: glow, alpha: 0.2, duration: 50, yoyo: true, repeat: 2 });
        },
      });
    }
    if (st.ambient === 'storm') {
      this.nextLightning = 3000 + Math.random() * 4000;
    }
    if (st.crowd) {
      const tex = this.textures.get(key);
      if (!tex.has('crowd')) tex.add('crowd', 0, 0, st.crowd.y, tex.getSourceImage().width, st.crowd.h);
      const crowd = this.add.image(0, top + st.crowd.y * 2, key, 'crowd').setOrigin(0, 0).setScale(2).setDepth(1);
      this.world.add(crowd);
      this.tweens.add({ targets: crowd, y: crowd.y - 5, duration: 234, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
      const beams = [
        { x: 180, c: 0xb06cff, a: -20 },
        { x: 560, c: 0xffc23d, a: 15 },
        { x: 980, c: 0xb06cff, a: -10 },
        { x: 1340, c: 0xffc23d, a: 22 },
      ];
      for (const b of beams) {
        const beam = this.add.image(b.x, top + 10, 'fx_beam').setOrigin(0.5, 0).setTint(b.c).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD).setAngle(b.a).setDepth(2);
        this.world.add(beam);
        this.tweens.add({ targets: beam, angle: -b.a, duration: 2600 + Math.random() * 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
    if (st.ambient === 'rain') {
      for (let i = 0; i < 110; i += 1) {
        const front = i % 3 === 0;
        const d = this.add
          .image(Math.random() * VIEW_W, Math.random() * VIEW_H, 'fx_rain')
          .setScrollFactor(0)
          .setAngle(12)
          .setAlpha(front ? 0.5 : 0.28)
          .setScale(front ? 1.2 : 0.8)
          .setDepth(front ? 70 : 3);
        this.rain.push(d);
        this.world.add(d);
      }
    }
    if (st.glow) {
      const g = st.glow;
      const glow = this.add.image(g.x * 2, top + g.y * 2, 'fx_glow').setTint(g.color).setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setScale((g.r * 4) / 128).setAlpha(0.35);
      this.world.add(glow);
      this.tweens.add({ targets: glow, alpha: 0.6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (st.ambient === 'smoke') {
      this.time.addEvent({
        delay: 380,
        loop: true,
        callback: () => {
          const p = this.add.image(Math.random() * STAGE_WIDTH, top + 200 + Math.random() * 300, 'fx_dust').setAlpha(0).setScale(2.5).setDepth(3).setTint(0xd8c8b8);
          this.world.add(p);
          this.tweens.add({ targets: p, alpha: 0.16, duration: 1500, yoyo: true, hold: 600 });
          this.tweens.add({ targets: p, x: p.x + 80, y: p.y - 70, scale: 5, duration: 3600, onComplete: () => p.destroy() });
        },
      });
    }
    if (st.ambient === 'embers') {
      this.time.addEvent({
        delay: 90,
        loop: true,
        callback: () => {
          const e = this.add.image(Math.random() * STAGE_WIDTH, GROUND_Y + 20, 'fx_glow').setTint(Math.random() < 0.5 ? 0xff8a2a : 0xffd060).setBlendMode(Phaser.BlendModes.ADD).setScale(0.05 + Math.random() * 0.06).setDepth(Math.random() < 0.3 ? 70 : 3);
          this.world.add(e);
          this.tweens.add({ targets: e, y: e.y - 300 - Math.random() * 300, x: e.x + (Math.random() - 0.3) * 120, alpha: 0, duration: 2600 + Math.random() * 1600, onComplete: () => e.destroy() });
        },
      });
    }
    if (st.steam) {
      const sx = st.steam.x * 2;
      const sy = top + st.steam.y * 2;
      this.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          const p = this.add.image(sx + (Math.random() - 0.5) * 30, sy, 'fx_dust').setAlpha(0.32).setScale(0.8).setDepth(2).setTint(0xcfe8ff);
          this.world.add(p);
          this.tweens.add({ targets: p, y: sy - 140 - Math.random() * 60, x: p.x + 20 + Math.random() * 30, scale: 3, alpha: 0, duration: 2200, onComplete: () => p.destroy() });
        },
      });
    }
  }

  private ambient(delta: number): void {
    this.ambientT += delta;
    if (this.stage.ambient === 'storm' && this.ambientT > this.nextLightning) {
      this.ambientT = 0;
      this.nextLightning = 5000 + Math.random() * 7000;
      const flash = this.add.rectangle(-500, -500, VIEW_W + 1000, VIEW_H + 1000, 0xc8dcff, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
      this.world.add(flash);
      this.tweens.chain({
        targets: flash,
        tweens: [
          { fillAlpha: 0.22, duration: 40 },
          { fillAlpha: 0.04, duration: 60 },
          { fillAlpha: 0.16, duration: 40 },
          { fillAlpha: 0, duration: 380 },
        ],
        onComplete: () => flash.destroy(),
      });
    }
    for (const d of this.rain) {
      d.y += delta * (d.depth > 50 ? 1.3 : 0.95);
      d.x += delta * 0.22;
      if (d.y > VIEW_H + 20) {
        d.y = -20;
        d.x = Math.random() * VIEW_W - 60;
      }
    }
  }

  // ---------- combo trials ----------

  private toggleTrials(): void {
    if (this.setup.mode !== 'training') return;
    this.trialOn = !this.trialOn;
    this.trialLocked = false;
    this.trialWatch.reset();
    if (this.trialOn) {
      // Trials need a dummy that takes the hits.
      this.dummy = 0;
      this.buildTrial();
    } else this.clearTrialUi();
    sfx(this, 'ui_move', 0.7);
  }

  private nextTrial(): void {
    this.trialIndex = (this.trialIndex + 1) % TRIALS.length;
    this.trialLocked = false;
    this.trialWatch.reset();
    this.buildTrial();
    sfx(this, 'ui_move', 0.7);
  }

  private clearTrial(): void {
    const index = this.trialIndex;
    this.trialLocked = true;
    this.trialCleared[index] = true;
    const all = this.trialCleared.every(Boolean);
    this.hud.shout('TRIAL CLEAR!', all ? 'Every trial done. Try them with the others!' : '', 1000);
    sfx(this, 'ui_confirm');
    sfx(this, 'crowd', 0.5);
    this.time.delayedCall(1500, () => {
      if (this.trialOn && this.trialLocked && this.trialIndex === index) this.nextTrial();
    });
  }

  private clearTrialUi(): void {
    this.trialObjs.forEach((o) => o.destroy());
    this.trialObjs = [];
    this.trialChips = [];
  }

  /** The trial panel under the training bar: name, the route's steps, and a tip. */
  private buildTrial(): void {
    this.clearTrialUi();
    const t = TRIALS[this.trialIndex];
    const simple = this.setup.simple?.[0] ?? (this.registry.get('simple') as boolean | undefined) ?? false;
    const y = 108;
    const done = this.trialCleared[this.trialIndex] ? '  ✓' : '';
    const title = this.add.text(VIEW_W / 2, y, `TRIAL ${this.trialIndex + 1}/${TRIALS.length}  ·  ${t.name.toUpperCase()}${done}`, display(18, '#ffffff', 5)).setOrigin(0.5, 0);
    goldFill(title);
    const chips = t.steps.map(([key, link]) =>
      this.add
        .text(0, y + 30, (link === '' ? '' : link === ',' ? ',  ' : '  >  ') + inputText(stepLabel(key, simple), 0), body(18, CSS.ink))
        .setShadow(0, 2, '#000000', 3),
    );
    const total = chips.reduce((w, c) => w + c.width, 0);
    let x = VIEW_W / 2 - total / 2;
    for (const c of chips) {
      c.setX(x);
      x += c.width;
    }
    const tip = this.add.text(VIEW_W / 2, y + 60, `${inputText(t.tip, 0)}   ·   F5 next   ·   F4 off`, body(12, CSS.muted)).setOrigin(0.5, 0);
    const w = Math.max(total, tip.width, title.width) + 44;
    const bg = this.add.rectangle(VIEW_W / 2, y - 8, w, 88, 0x0b0e1c, 0.82).setOrigin(0.5, 0).setStrokeStyle(2, C.gold, 0.55);
    this.trialObjs = [bg, title, ...chips, tip];
    this.trialChips = chips;
    this.ui.add(this.trialObjs);
  }

  // ---------- pause menu ----------

  private openPause(): void {
    this.paused = true;
    const shade = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x05060c, 0.72).setOrigin(0, 0);
    const title = this.add.text(VIEW_W / 2, 120, 'PAUSED', display(48, '#ffffff', 8)).setOrigin(0.5);
    goldFill(title);
    const training = this.setup.mode === 'training';
    const items = [
      { label: 'RESUME', onSelect: () => this.closePause() },
      { label: 'MOVE LIST', onSelect: () => this.showMoveList() },
    ];
    if (training) {
      const after = (fn: () => void) => () => {
        this.closePause();
        fn();
      };
      items.push({ label: this.trialOn ? 'TRIALS OFF' : 'COMBO TRIALS', onSelect: after(() => this.toggleTrials()) });
      if (this.trialOn) items.push({ label: 'NEXT TRIAL', onSelect: after(() => this.nextTrial()) });
    }
    items.push(
      { label: 'RESTART', onSelect: () => goTo(this, 'fight', this.setup) },
      {
        label: 'CHARACTER SELECT',
        onSelect: () =>
          goTo(this, 'select', { mode: this.setup.mode, cpuLevel: this.setup.cpuLevel, party: this.setup.party, simple: this.setup.simple }),
      },
      { label: 'MAIN MENU', onSelect: () => goTo(this, 'title', { skipIntro: true }) },
    );
    this.pauseMenu = new Menu(this, VIEW_W / 2 - 170, items.length > 5 ? 186 : 200, items, 340, items.length > 5 ? 42 : 46);
    this.pauseObjects = [shade, title, ...this.pauseMenu.objects];
    this.ui.add(this.pauseObjects);
    sfx(this, 'ui_confirm', 0.7);
  }

  private closePause(): void {
    this.pauseObjects.forEach((o) => o.destroy());
    this.moveListObjects.forEach((o) => o.destroy());
    this.pauseObjects = [];
    this.moveListObjects = [];
    this.pauseMenu = null;
    this.paused = false;
    this.acc = 0;
  }

  private pauseInput(action: string): void {
    if (this.moveListObjects.length > 0) {
      if (action === 'back' || action === 'pause' || action === 'confirm') {
        this.moveListObjects.forEach((o) => o.destroy());
        this.moveListObjects = [];
        this.pauseObjects.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(true));
      }
      return;
    }
    if (action === 'pause' || action === 'back') {
      this.closePause();
      return;
    }
    this.pauseMenu?.handle(action);
  }

  private showMoveList(): void {
    this.pauseMenu?.setVisible(false);
    this.pauseObjects.forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(false));
    const objs: Phaser.GameObjects.GameObject[] = [];
    const panel = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W - 60, VIEW_H - 60, C.panel, 0.97).setStrokeStyle(2, C.panelEdge);
    objs.push(panel);
    const f = this.state.fighters[0];
    const info = heroInfo(HEROES[f.hero].id);
    objs.push(this.add.text(60, 46, `${info.title}  ·  MOVE LIST`, display(24, CSS.gold, 5)));
    moveList(f.hero).forEach((m, i) => {
      const y = 90 + i * 30;
      objs.push(this.add.text(60, y, m.name, display(16, CSS.ink, 4)));
      objs.push(this.add.text(300, y, inputText(m.input, -1), body(16, CSS.gold)));
      objs.push(this.add.text(600, y + 1, m.note, body(13, CSS.muted)));
    });
    objs.push(this.add.text(VIEW_W / 2, VIEW_H - 44, backHint(), body(13, CSS.muted)).setOrigin(0.5));
    this.moveListObjects = objs;
    this.ui.add(objs);
  }
}

