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
  step,
} from '../../sim';
import type { GameState } from '../../sim';
import { playMusic, sfx } from '../audio';
import { C, CSS, GROUND_Y, VIEW_H, VIEW_W } from '../config';
import type { MatchSetup } from '../config';
import { Effects } from '../fx';
import { artFor, feetOrigin, frameName, poseFor } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { Hud } from '../hud';
import { SuperFx } from '../superFx';
import { moveList } from '../moves';
import { STAGES } from '../stages';
import { ComboTracker, TRIALS, stepLabel } from '../trials';
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
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  /** Extra cards for Chris's fan of cards. */
  extra: Phaser.GameObjects.Image[];
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
  private dummy = 3;
  private trainingText: Phaser.GameObjects.Text | null = null;
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
    this.state = createInitialState(setup.p1, setup.p2, {
      training: setup.mode === 'training',
      simple: [simple, simple && setup.mode === 'versus'],
    });
    this.acc = 0;
    this.clock = 0;
    this.paused = false;
    this.celebrate = [0, 0];
    this.landedAt = [-99, -99];
    this.stoodAt = [-99, -99];
    this.punch = { z: 1 };
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
    this.state.fighters.forEach((f, i) => {
      const art = artFor(f.hero);
      this.shadows.push(this.add.image(f.x, GROUND_Y + 2, 'fx_shadow').setDepth(12).setAlpha(0.8));
      this.sprites.push(this.add.image(f.x, GROUND_Y, art.key).setScale(art.scale).setDepth(30 + i));
      this.projViews.push({
        glow: this.add.image(0, 0, 'fx_glow').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(44),
        img: this.add.image(0, 0, 'fx_disc').setVisible(false).setDepth(45),
        extra: [0, 1].map(() => this.add.image(0, 0, 'fx_card').setVisible(false).setDepth(45)),
      });
    });
    this.world.add([...this.shadows, ...this.sprites, ...this.projViews.flatMap((p) => [p.glow, p.img, ...p.extra])]);
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
    for (const e of controls.take()) {
      if (this.paused) this.pauseInput(e.action);
      else if (e.action === 'pause' && this.state.phase !== Phase.MatchEnd) this.openPause();
    }

    if (!this.paused) {
      this.acc += delta;
      let steps = 0;
      while (this.acc >= TICK_MS && steps < MAX_STEPS_PER_FRAME) {
        const prev = this.state;
        const [a, b] = this.inputs(prev);
        this.state = step(prev, a, b);
        this.clock += 1;
        this.simEvents(prev, this.state);
        this.acc -= TICK_MS;
        steps += 1;
      }
      if (this.acc > TICK_MS * MAX_STEPS_PER_FRAME) this.acc = 0; // tab was hidden: drop the backlog
    }

    this.draw(delta);

    if (this.state.phase === Phase.MatchEnd && !this.paused) {
      this.matchOverTicks += delta / TICK_MS;
      if (this.matchOverTicks > 170) {
        const s = this.state;
        goTo(this, 'result', { setup: this.setup, winner: s.matchResult, wins: [s.wins[0], s.wins[1]] }, 400);
      }
    }
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

      if (f.fx === FX.Hit || f.fx === FX.Counter || f.fx === FX.Throw) {
        const projectileHit = att.state !== FS.Attack || att.moveHits === 0;
        const moveId = att.state === FS.Attack ? att.moveId : -1;
        const kind = moveId >= 0 ? getMove(att.hero, moveId).kind : Kind.Special;
        const special = projectileHit || kind === Kind.Special || kind === Kind.Super;
        const color = special ? heroInfo(HEROES[att.hero].id).accent : f.fxPower >= 10 ? 0xffb347 : 0xfff3c4;
        this.fx.hit(x, y, dir, f.fxPower, color, f.fx === FX.Counter);
        if (f.fx === FX.Throw) sfx(this, 'throw');
        else if (moveId === Move.Light || moveId === Move.CrouchLight) sfx(this, 'hit_light', 1, (Math.random() - 0.5) * 200);
        else if (moveId === Move.Kick || moveId === Move.Sweep || moveId === Move.JumpAttack) sfx(this, 'hit_kick');
        else sfx(this, 'hit_heavy', 1, (Math.random() - 0.5) * 150);
        if (special) sfx(this, this.signature(1 - i), 0.55);
        if (f.fxPower >= 10) this.cameras.main.shake(90 + f.fxPower * 6, 0.002 + f.fxPower * 0.00035);
        if (f.fx === FX.Counter) this.fx.popText(f.x, GROUND_Y - f.y - 250, 'COUNTER', '#ff6a4a');
      } else if (f.fx === FX.Block) {
        this.fx.block(x, y, dir);
        sfx(this, 'block', 0.9, (Math.random() - 0.5) * 200);
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
      if (p.projLife === 0 && f.projLife > 0) {
        sfx(this, this.signature(i, f.projMove === Move.Projectile ? 'projectile' : 'special'), 0.9);
        const r = getProjectile(f);
        if (r) this.fx.ring(r.x + r.w / 2, GROUND_Y - r.y - r.h / 2, heroInfo(HEROES[f.hero].id).accent, 0.7);
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
        else this.hud.shout(`${heroInfo(HEROES[next.fighters[w].hero].id).title}`, 'WINS THE MATCH', 2400);
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
    if (ko) {
      sfx(this, 'ko');
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
      sprite
        .setFrame(pose.frame)
        .setOrigin(...feetOrigin(art, f.facing !== 1))
        .setFlipX(f.facing !== 1)
        .setPosition(f.x, GROUND_Y - f.y)
        .setDepth(f.state === FS.Attack ? 32 : 30 + i);

      // Flashes: white on hit, red on counter, blue on block, glow during a super flash.
      if (f.state === FS.Hitstun && f.stateTick < 3) sprite.setTintFill(0xffffff);
      else if (f.state === FS.Block && f.stunTimer > 0 && f.stateTick < 3) sprite.setTintFill(0xa6e4ff);
      else if (frozenFor === i && Math.floor(this.clock / 3) % 2 === 0) sprite.setTintFill(heroInfo(HEROES[f.hero].id).accent);
      else sprite.setTint(this.stage.tint);

      const shadow = this.shadows[i];
      const lift = Math.min(1, f.y / 240);
      shadow.setPosition(f.x, GROUND_Y + 2).setScale(1.1 - lift * 0.5, 1).setAlpha(0.75 - lift * 0.45);

      // Afterimages on dashes and supers.
      const superActive = f.state === FS.Attack && f.moveId === Move.Super;
      if ((f.state === FS.Dash && this.clock % 3 === 0) || (superActive && this.clock % 2 === 0 && s.hitstop === 0)) {
        this.fx.afterimage(sprite, heroInfo(HEROES[f.hero].id).color);
      }

      // Projectile.
      const view = this.projViews[i];
      const r = getProjectile(f);
      if (r) {
        const cx = r.x + r.w / 2;
        const cy = GROUND_Y - (r.y + r.h / 2);
        const dir = f.projVx > 0 ? 1 : -1;
        const style = art.projectiles[MOVE_KEYS[f.projMove]] ?? 'disc';
        const color = heroInfo(HEROES[f.hero].id).accent;
        const spin = (view.img.rotation + dir * 0.45) % (Math.PI * 2);
        view.img.setVisible(true).setPosition(cx, cy).setFlipX(dir < 0).setRotation(0).setAlpha(1);
        view.extra.forEach((e) => e.setVisible(false));
        let glowScale = 0.9;
        if (style === 'bolt') view.img.setTexture(`fx_bolt${Math.floor(this.clock / 2) % 4}`).setScale(1.1);
        else if (style === 'disc') view.img.setTexture('fx_disc').setScale(1).setRotation(spin);
        else if (style === 'wave') view.img.setTexture('fx_wave').setScale(1 + 0.08 * Math.sin(this.clock * 0.6));
        else if (style === 'crew') {
          view.img.setTexture('fx_crew').setDisplaySize(r.w + 30, r.h + 10).setPosition(cx, cy + 5);
          glowScale = 1.8;
          if (this.clock % 3 === 0) this.fx.dust(cx - dir * 40, GROUND_Y, 2, 40);
        } else {
          // A fan of three spinning cards.
          view.img.setTexture('fx_card').setScale(1.5).setRotation(this.clock * 0.6 * dir);
          view.extra.forEach((e, k) => {
            const off = (k === 0 ? -1 : 1) * 16;
            e.setVisible(true).setPosition(cx - dir * 14, cy + off).setScale(1.3).setRotation(this.clock * 0.6 * dir + (k + 1) * 1.2);
          });
          glowScale = 0.7;
        }
        view.glow.setVisible(true).setPosition(cx, cy).setTint(color).setScale(glowScale).setAlpha(0.6 + 0.2 * Math.sin(this.clock * 0.5));
        if (this.clock % 2 === 0) this.fx.trail(cx - dir * (r.w / 2), cy, color);
      } else {
        view.img.setVisible(false);
        view.glow.setVisible(false);
        view.extra.forEach((e) => e.setVisible(false));
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
    const simple = (this.registry.get('simple') as boolean | undefined) ?? false;
    const y = 108;
    const done = this.trialCleared[this.trialIndex] ? '  ✓' : '';
    const title = this.add.text(VIEW_W / 2, y, `TRIAL ${this.trialIndex + 1}/${TRIALS.length}  ·  ${t.name.toUpperCase()}${done}`, display(18, '#ffffff', 5)).setOrigin(0.5, 0);
    goldFill(title);
    const chips = t.steps.map(([key, link]) =>
      this.add
        .text(0, y + 30, (link === '' ? '' : link === ',' ? ',  ' : '  >  ') + stepLabel(key, simple), body(18, CSS.ink))
        .setShadow(0, 2, '#000000', 3),
    );
    const total = chips.reduce((w, c) => w + c.width, 0);
    let x = VIEW_W / 2 - total / 2;
    for (const c of chips) {
      c.setX(x);
      x += c.width;
    }
    const tip = this.add.text(VIEW_W / 2, y + 60, `${t.tip}   ·   F5 next   ·   F4 off`, body(12, CSS.muted)).setOrigin(0.5, 0);
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
      { label: 'CHARACTER SELECT', onSelect: () => goTo(this, 'select', { mode: this.setup.mode, cpuLevel: this.setup.cpuLevel }) },
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
      const y = 92 + i * 36;
      objs.push(this.add.text(60, y, m.name, display(16, CSS.ink, 4)));
      objs.push(this.add.text(300, y, m.input, body(16, CSS.gold)));
      objs.push(this.add.text(600, y + 1, m.note, body(13, CSS.muted)));
    });
    objs.push(this.add.text(VIEW_W / 2, VIEW_H - 44, 'Back: Esc, G or B', body(13, CSS.muted)).setOrigin(0.5));
    this.moveListObjects = objs;
    this.ui.add(objs);
  }
}

