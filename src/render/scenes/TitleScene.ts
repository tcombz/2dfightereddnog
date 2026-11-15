// Home screen, in two beats like the big crossover fighters:
// 1. Attract: the logo slams in over the whole roster lined up, energy streaking across. Press start.
// 2. Main menu: the logo moves to the corner, a big slanted list slides in on the left with a line
//    about each mode, and the featured fighter stands on the right in their colours.
import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { HEROES } from '../../sim';
import { playMusic, sfx } from '../audio';
import { C, CPU_LEVELS, CSS, GAME_TITLE, VIEW_H, VIEW_W } from '../config';
import type { MatchSetup, Mode } from '../config';
import { artFor, feetOrigin, frameName, menuScale, pingpong } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { Companion, menuPet } from '../companion';
import { familyName, menuHint, onPad } from '../prompts';
import { savedReplays } from '../replays';
import { STAGES } from '../stages';
import { body, display, fitText, goTo, goldFill } from '../ui';

const HOME: Record<string, string> = { rogue: 'rooftop', jetsetter: 'concert', chris: 'embassy', leader: 'crown', eddnog: 'fortress', malcolm: 'helipad', quincy: 'penthouse', ignar: 'fortress', vesper: 'rooftop' };

const TIPS = [
  'Pick two fighters: BLOCK + LIGHT calls your partner in for an assist.',
  'BLOCK + SPECIAL tags your partner in. The one resting gets red health back.',
  'Any normal > BLOCK + HEAVY launches. Press UP to super jump after them.',
  'Full meter? DOWN + HEAVY + SPECIAL is the Level 3 hyper.',
  'Hold back to block. Low attacks need down-back.',
  'LIGHT + HEAVY is a throw. It beats someone who blocks all day.',
  'Training mode has combo trials for every fighter: press F4.',
  'Online: Quick Match, or send a friend your invite link.',
  'Every finished match is saved under Extras, Replays.',
];

interface Item {
  label: string;
  /** One line about the mode, under the menu. */
  desc: string;
  value?: () => string;
  onSelect?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  /** A category: opens its own list. */
  sub?: Item[];
}

/** The attract-screen lineup: back row first (drawn behind), then the front row. */
interface LineupFighter {
  hero: number;
  img: Phaser.GameObjects.Image;
  front: boolean;
}

export class TitleScene extends Phaser.Scene {
  private footer!: Phaser.GameObjects.Text;
  private promptStamp = -1;
  private pressStart!: Phaser.GameObjects.Text;
  private started = false;
  private clock = 0;
  private root: Item[] = [];
  private path: Array<{ items: Item[]; index: number; label: string }> = [];
  private menuG!: Phaser.GameObjects.Graphics;
  private rows: Array<{ label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text }> = [];
  private crumb!: Phaser.GameObjects.Text;
  private desc!: Phaser.GameObjects.Text;
  private menuObjs: Phaser.GameObjects.GameObject[] = [];
  /** Eased menu cursor (for the sliding highlight) and when the list last opened (slide-in). */
  private ease = 0;
  private openedAt = 0;
  private featured = 0;
  private featuredAt = 0;
  private hero!: Phaser.GameObjects.Image;
  private heroName!: Phaser.GameObjects.Text;
  private heroTitle!: Phaser.GameObjects.Text;
  private pet: Companion | null = null;
  private stageBg!: Phaser.GameObjects.Image;
  private splash!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private logo!: Phaser.GameObjects.Container;
  private lineup: LineupFighter[] = [];
  private ticker!: Phaser.GameObjects.Text;
  private sparks: Array<{ img: Phaser.GameObjects.Image; vx: number; vy: number }> = [];

  constructor() {
    super('title');
  }

  create(data: { skipIntro?: boolean }): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.started = false;
    this.clock = 0;
    this.pet = null;
    this.sparks = [];
    this.cameras.main.fadeIn(300, 5, 6, 12);

    // Backdrop: a stage, darkened, under moving energy.
    this.featured = Math.floor(Math.random() * HEROES.length);
    this.stageBg = this.add.image(0, 0, 'stage_rooftop').setOrigin(0, 0).setScale(VIEW_H / 320).setAlpha(0.35);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, C.night, 0.55).setOrigin(0, 0);
    this.fxG = this.add.graphics().setDepth(1);
    // Light rays fanning out behind the logo.
    for (let k = 0; k < 6; k += 1) {
      const ray = this.add.image(VIEW_W / 2, 150, 'fx_beam').setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setTint(k % 2 ? C.p1 : C.p2).setAlpha(0.16).setScale(2.2, 2.8).setDepth(1);
      ray.setAngle(-75 + k * 30);
      this.tweens.add({ targets: ray, angle: ray.angle + 30, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.splash = this.add.graphics().setDepth(2);

    this.buildLineup();

    // The featured fighter (menu state), right side.
    this.hero = this.add.image(720, VIEW_H + 4, 'rogue').setDepth(4).setVisible(false);
    this.heroTitle = this.add.text(VIEW_W - 28, VIEW_H - 112, '', display(15, CSS.gold, 4)).setOrigin(1, 1).setDepth(6).setVisible(false);
    this.heroName = this.add.text(VIEW_W - 24, VIEW_H - 46, '', display(52, '#ffffff', 9)).setOrigin(1, 1).setDepth(6).setVisible(false);

    this.logo = this.buildLogo();

    // Bottom bar: a ticker of tips, the controls hint on the right.
    const foot = this.add.graphics().setDepth(10);
    foot.fillStyle(0x05060c, 0.9).fillRect(0, VIEW_H - 28, VIEW_W, 28);
    foot.fillStyle(C.p1, 1).fillRect(0, VIEW_H - 30, VIEW_W / 2, 2);
    foot.fillStyle(C.p2, 1).fillRect(VIEW_W / 2, VIEW_H - 30, VIEW_W / 2, 2);
    const tips = Phaser.Utils.Array.Shuffle([...TIPS]).join('      ★      ');
    this.ticker = this.add.text(VIEW_W, VIEW_H - 14, tips, body(13, CSS.ink)).setOrigin(0, 0.5).setDepth(11);
    const hintBg = this.add.graphics().setDepth(12);
    hintBg.fillStyle(0x05060c, 1).fillRect(VIEW_W - 330, VIEW_H - 28, 330, 28);
    this.footer = this.add.text(VIEW_W - 14, VIEW_H - 14, '', body(13, CSS.muted)).setOrigin(1, 0.5).setDepth(13);
    this.promptStamp = -1;
    // Status, top right.
    const status = this.add
      .text(VIEW_W - 14, 18, `ONLINE READY  ·  ${HEROES.length} FIGHTERS  ·  ${savedReplays().length} REPLAYS`, body(12, CSS.muted))
      .setOrigin(1, 0.5)
      .setDepth(11);
    this.add.circle(status.x - status.width - 10, 18, 5, 0x37d67a).setDepth(11);

    this.pressStart = this.add.text(VIEW_W / 2, 292, 'PRESS START', display(30, '#ffffff', 7)).setOrigin(0.5).setDepth(12);
    this.tweens.add({ targets: this.pressStart, alpha: 0.2, duration: 520, yoyo: true, repeat: -1 });

    this.buildMenu();
    this.setMenuVisible(false);
    if (data?.skipIntro) this.open(true);
    controls.take();
  }

  // ---------- attract screen ----------

  private buildLogo(): Phaser.GameObjects.Container {
    const band = this.add.graphics();
    // A slanted two-tone band behind the title: player 1 blue into player 2 red.
    band.fillStyle(C.p1, 0.95).fillPoints([{ x: -330, y: 34 }, { x: 0, y: 34 }, { x: -18, y: 66 }, { x: -348, y: 66 }], true);
    band.fillStyle(C.p2, 0.95).fillPoints([{ x: 0, y: 34 }, { x: 330, y: 34 }, { x: 312, y: 66 }, { x: -18, y: 66 }], true);
    band.fillStyle(0xffffff, 1).fillRect(-348, 66, 678, 3);
    const title = this.add.text(0, -6, GAME_TITLE, display(92, '#ffffff', 14)).setOrigin(0.5);
    goldFill(title);
    title.setShadow(0, 7, '#000000', 0, true, true);
    const sub = this.add.text(-8, 50, 'TAG TEAM  ·  HYPER COMBO  ·  NIGHT CITY', display(15, '#ffffff', 0)).setOrigin(0.5);
    const glow = this.add.image(0, 0, 'fx_glow').setTint(C.gold).setBlendMode(Phaser.BlendModes.ADD).setScale(7, 2.2).setAlpha(0.35);
    const c = this.add.container(VIEW_W / 2, 150, [glow, band, title, sub]).setDepth(12);
    // Slam in: big and transparent to full size, a flash and a shake.
    c.setScale(2.4).setAlpha(0);
    this.tweens.add({
      targets: c,
      scale: 1,
      alpha: 1,
      duration: 380,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.cameras.main.flash(220, 255, 220, 140);
        this.cameras.main.shake(180, 0.006);
        sfx(this, 'hit_heavy', 0.5);
      },
    });
    this.tweens.add({ targets: glow, alpha: 0.18, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return c;
  }

  /** The whole roster lined up along the bottom: a darker back row and a full-colour front row. */
  private buildLineup(): void {
    this.lineup = [];
    const n = HEROES.length;
    const order = Array.from({ length: n }, (_, k) => k);
    const back = order.filter((_, k) => k % 2 === 1);
    const front = order.filter((_, k) => k % 2 === 0);
    const place = (list: number[], isFront: boolean): void => {
      const span = isFront ? 820 : 720;
      list.forEach((h, k) => {
        const art = artFor(h);
        const x = VIEW_W / 2 - span / 2 + (span * (k + 0.5)) / list.length;
        const facing = x < VIEW_W / 2 ? 1 : -1;
        const img = this.add
          .image(x, isFront ? VIEW_H + 8 : VIEW_H - 46, art.key, frameName('idle', 0))
          .setOrigin(...feetOrigin(art, facing < 0))
          .setFlipX(facing < 0)
          .setScale(menuScale(art, isFront ? 2.15 : 1.7))
          .setDepth(isFront ? 6 : 5)
          .setTint(isFront ? 0xffffff : 0x6c7290);
        // Rise into place, one after another.
        const y = img.y;
        img.setY(y + 80).setAlpha(0);
        this.tweens.add({ targets: img, y, alpha: 1, duration: 420, delay: 250 + k * 70 + (isFront ? 140 : 0), ease: 'Cubic.easeOut' });
        this.lineup.push({ hero: h, img, front: isFront });
      });
    };
    place(back, false);
    place(front, true);
  }

  /** Energy streaks across the screen, and sparks rising. */
  private drawEnergy(dt: number): void {
    const g = this.fxG;
    g.clear();
    const t = this.clock / 1000;
    for (let k = 0; k < 7; k += 1) {
      const fromLeft = k % 2 === 0;
      const speed = 260 + k * 37;
      const span = VIEW_W + 600;
      const off = ((t * speed + k * 211) % span) - 300;
      const x = fromLeft ? off : VIEW_W - off;
      const y = 40 + ((k * 73) % 420);
      const len = 160 + (k % 3) * 90;
      const dir = fromLeft ? 1 : -1;
      g.fillStyle(fromLeft ? C.p1 : C.p2, 0.22);
      g.fillPoints([{ x, y }, { x: x - dir * len, y: y + 10 }, { x: x - dir * len, y: y + 14 }, { x, y: y + 6 }], true);
    }
    // Sparks.
    if (this.sparks.length < 26 && Math.random() < 0.35) {
      const img = this.add
        .image(Math.random() * VIEW_W, VIEW_H - 30, 'fx_glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(Math.random() < 0.5 ? C.gold : Math.random() < 0.5 ? C.p1 : C.p2)
        .setScale(0.06 + Math.random() * 0.08)
        .setDepth(7);
      this.sparks.push({ img, vx: (Math.random() - 0.5) * 30, vy: -(60 + Math.random() * 110) });
    }
    this.sparks = this.sparks.filter((p) => {
      p.img.x += (p.vx * dt) / 1000;
      p.img.y += (p.vy * dt) / 1000;
      p.img.setAlpha(Math.max(0, Math.min(1, (p.img.y - 40) / 300)));
      if (p.img.y < 30) {
        p.img.destroy();
        return false;
      }
      return true;
    });
  }

  // ---------- the menu ----------

  private buildMenu(): void {
    const cpuLevel = (): number => (this.registry.get('cpuLevel') as number | undefined) ?? 1;
    const harder = (): void => void this.registry.set('cpuLevel', (cpuLevel() + 1) % 3);
    const easier = (): void => void this.registry.set('cpuLevel', (cpuLevel() + 2) % 3);
    const level = (): string => `◀ ${CPU_LEVELS[cpuLevel()]} ▶`;
    const start = (mode: Mode): void => {
      const setup: Partial<MatchSetup> = { mode, cpuLevel: cpuLevel() };
      goTo(this, 'select', setup);
    };
    this.root = [
      { label: 'ARCADE', desc: 'Pick a team and fight through the whole ladder. Left / Right: difficulty.', value: level, onLeft: easier, onRight: harder, onSelect: () => goTo(this, 'select', { mode: 'cpu', cpuLevel: cpuLevel(), arcadeStart: true }) },
      {
        label: 'VERSUS',
        desc: 'Two teams, one round. Against a friend on this machine or the CPU.',
        sub: [
          { label: 'VS PLAYER', desc: 'Two players on one keyboard, or plug in controllers.', onSelect: () => start('versus') },
          { label: 'VS CPU', desc: 'Your team against the computer. Left / Right: difficulty.', value: level, onLeft: easier, onRight: harder, onSelect: () => start('cpu') },
        ],
      },
      { label: 'ONLINE', desc: 'Quick Match a stranger, or send a friend your invite link.', onSelect: () => goTo(this, 'online') },
      { label: 'PARTY MODE', desc: 'Winner stays on. Add everyone in the room and fight for the streak.', onSelect: () => goTo(this, 'party') },
      { label: 'TRAINING', desc: 'Free practice, hitboxes and combo trials for every fighter (F4).', onSelect: () => start('training') },
      {
        label: 'EXTRAS',
        desc: 'Replays of your last matches, and how to play.',
        sub: [
          { label: 'REPLAYS', desc: 'Watch your last ten matches again.', onSelect: () => goTo(this, 'replays') },
          { label: 'HOW TO PLAY', desc: 'Controls, the basics and every move list.', onSelect: () => goTo(this, 'howto', { back: 'title' }) },
        ],
      },
      { label: 'SETTINGS', desc: 'Sound, display, gameplay, and your keys and controllers.', onSelect: () => goTo(this, 'settings') },
    ];
    this.path = [{ items: this.root, index: 0, label: '' }];
    this.menuObjs = [];
    this.menuG = this.add.graphics().setDepth(8);
    this.crumb = this.add.text(44, 124, '', display(14, CSS.gold, 4)).setDepth(9);
    this.rows = [];
    for (let k = 0; k < 8; k += 1) {
      this.rows.push({
        label: this.add.text(0, 0, '', display(24, CSS.ink, 5)).setOrigin(0, 0.5).setDepth(9),
        value: this.add.text(0, 0, '', body(15, CSS.gold)).setOrigin(1, 0.5).setDepth(9),
      });
    }
    // The line about the chosen mode, on a strip above the footer.
    const strip = this.add.graphics().setDepth(8);
    strip.fillStyle(0x05060c, 0.8).fillRect(0, 446, 500, 56);
    strip.fillStyle(C.gold, 1).fillRect(0, 446, 6, 56);
    this.desc = this.add.text(22, 474, '', body(15, CSS.ink)).setOrigin(0, 0.5).setDepth(9).setWordWrapWidth(460).setLineSpacing(1);
    this.menuObjs.push(strip);
    this.menuObjs.push(this.menuG, this.crumb, this.desc, ...this.rows.flatMap((r) => [r.label, r.value]));
  }

  private get level(): { items: Item[]; index: number; label: string } {
    return this.path[this.path.length - 1];
  }

  /**
   * The list: slanted bars that slide in one after another when it opens; the highlight glides to
   * the chosen row, which grows and pushes out to the right.
   */
  private drawMenu(): void {
    const { items, index } = this.level;
    const g = this.menuG;
    g.clear();
    this.crumb.setText(this.path.length > 1 ? `◀ ${this.level.label}` : '');
    const since = this.clock - this.openedAt;
    let y = 136;
    this.rows.forEach((r, k) => {
      const it = items[k];
      r.label.setVisible(!!it);
      r.value.setVisible(!!it);
      if (!it) return;
      // How "chosen" this row is, eased: 1 on the cursor, falling off around it.
      const on = Math.max(0, 1 - Math.abs(this.ease - k));
      const slide = Math.min(1, Math.max(0, (since - k * 45) / 220));
      const enter = 1 - (1 - slide) * (1 - slide);
      const h = 33 + 13 * on;
      const x = 30 + on * 22 - (1 - enter) * 420;
      const w = 330 + on * 40;
      const cy = y + h / 2;
      g.fillStyle(0x05060c, 0.78 * enter);
      g.fillPoints([{ x, y }, { x: x + w, y }, { x: x + w - 14, y: y + h }, { x: x - 14, y: y + h }], true);
      if (on > 0.02) {
        // The gold highlight, with a white rule and a coloured nub that slides with it.
        g.fillStyle(C.gold, on);
        g.fillPoints([{ x, y }, { x: x + w, y }, { x: x + w - 14, y: y + h }, { x: x - 14, y: y + h }], true);
        g.fillStyle(0xffffff, on).fillRect(x - 14, y + h - 3, w, 3);
        g.fillStyle(C.p2, on).fillPoints([{ x: x + w + 6, y }, { x: x + w + 22, y }, { x: x + w + 8, y: y + h }, { x: x + w - 8, y: y + h }], true);
      }
      const chosen = k === index;
      r.label
        .setText(it.label + (it.sub ? '  ›' : ''))
        .setStyle(display(chosen ? 28 : 20, chosen ? '#120c02' : CSS.ink, chosen ? 0 : 4))
        .setPosition(x + 16, cy)
        .setAlpha(enter);
      r.value
        .setText(it.value?.() ?? '')
        .setColor(chosen ? '#120c02' : CSS.gold)
        .setPosition(x + w - 26, cy)
        .setAlpha(enter);
      fitText(r.label, w - (it.value ? 150 : 40));
      y += h + 6;
    });
    this.desc.setText(items[index]?.desc ?? '');
  }

  private setMenuVisible(v: boolean): void {
    for (const o of this.menuObjs) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(v);
    if (v) this.drawMenu();
  }

  private handle(action: string): void {
    const lv = this.level;
    const it = lv.items[lv.index];
    if (action === 'up' || action === 'down') {
      lv.index = (lv.index + (action === 'up' ? -1 : 1) + lv.items.length) % lv.items.length;
      sfx(this, 'ui_move', 0.8);
    } else if ((action === 'left' && it.onLeft) || (action === 'right' && it.onRight)) {
      (action === 'left' ? it.onLeft : it.onRight)?.();
      sfx(this, 'ui_move', 0.8);
    } else if (action === 'confirm' || (action === 'right' && it.sub)) {
      if (it.sub) {
        this.path.push({ items: it.sub, index: 0, label: it.label });
        this.ease = 0;
        this.openedAt = this.clock;
      } else it.onSelect?.();
      sfx(this, 'ui_confirm');
    } else if (action === 'back' || action === 'left') {
      if (this.path.length > 1) {
        this.path.pop();
        this.ease = this.level.index;
        this.openedAt = this.clock;
        sfx(this, 'ui_move', 0.8);
      }
    }
  }

  // ---------- the featured fighter ----------

  private showFeatured(first: boolean): void {
    const hero = HEROES[this.featured];
    const info = heroInfo(hero.id);
    const art = artFor(this.featured);
    const stage = STAGES.find((s) => s.id === HOME[hero.id]) ?? STAGES[0];
    this.stageBg.setTexture(`stage_${stage.id}`);
    this.hero.setTexture(art.key, frameName('idle', 0)).setOrigin(...feetOrigin(art, true)).setFlipX(true).setScale(menuScale(art, 3.2)).setVisible(true);
    const g = this.splash;
    g.clear();
    g.fillStyle(info.color, 0.4).fillPoints([{ x: 560, y: 0 }, { x: VIEW_W, y: 0 }, { x: VIEW_W, y: VIEW_H }, { x: 470, y: VIEW_H }], true);
    g.fillStyle(info.accent, 0.25).fillPoints([{ x: 640, y: 0 }, { x: 700, y: 0 }, { x: 610, y: VIEW_H }, { x: 550, y: VIEW_H }], true);
    this.heroName.setText(info.name).setVisible(true);
    fitText(this.heroName, 380);
    this.heroTitle.setText(`${info.title.replace(/^[^"]*"|"$/g, '')}  ·  ${info.archetype}`).setVisible(true);
    fitText(this.heroTitle, 380);
    if (!first) {
      this.hero.setAlpha(0).setX(780);
      this.tweens.add({ targets: this.hero, alpha: 1, x: 720, duration: 320, ease: 'Cubic.easeOut' });
      this.heroName.setAlpha(0).setX(VIEW_W + 40);
      this.tweens.add({ targets: this.heroName, alpha: 1, x: VIEW_W - 24, duration: 320, ease: 'Cubic.easeOut' });
    }
  }

  private open(instant = false): void {
    this.started = true;
    this.pressStart.setVisible(false);
    // The roster steps aside, the logo moves to the corner, the menu and the featured fighter arrive.
    for (const f of this.lineup) {
      this.tweens.killTweensOf(f.img);
      if (instant) f.img.setVisible(false);
      else this.tweens.add({ targets: f.img, y: f.img.y + 120, alpha: 0, duration: 260, ease: 'Quad.easeIn', onComplete: () => f.img.setVisible(false) });
    }
    this.tweens.killTweensOf(this.logo);
    const to = { x: 196, y: 62, scale: 0.42, alpha: 1 };
    if (instant) this.logo.setPosition(to.x, to.y).setScale(to.scale).setAlpha(1);
    else this.tweens.add({ targets: this.logo, ...to, duration: 360, ease: 'Cubic.easeInOut' });
    this.openedAt = this.clock + (instant ? 0 : 180);
    this.ease = this.level.index;
    this.setMenuVisible(true);
    this.showFeatured(true);
    if (!instant) {
      this.hero.setAlpha(0).setX(800);
      this.tweens.add({ targets: this.hero, alpha: 1, x: 720, duration: 380, delay: 150, ease: 'Cubic.easeOut' });
    }
    this.featuredAt = this.clock;
    playMusic(this, 'menu');
  }

  update(_t: number, delta: number): void {
    this.clock += delta;
    const tick = Math.floor(this.clock / (1000 / 60));
    this.drawEnergy(delta);
    this.ticker.x -= delta * 0.06;
    if (this.ticker.x < -this.ticker.width) this.ticker.x = VIEW_W;
    // Idles: every fighter breathes on their own beat.
    for (const f of this.lineup) {
      if (!f.img.visible) continue;
      const art = artFor(f.hero);
      f.img.setFrame(frameName('idle', pingpong(art.idle, tick + f.hero * 7, 10)));
    }
    if (this.started) {
      const art = artFor(this.featured);
      this.hero.setFrame(frameName('idle', pingpong(art.idle, tick, 10)));
      const b = Math.sin(this.clock * 0.0042);
      this.hero.setScale(menuScale(art, 3.2) * (1 - 0.006 * b), menuScale(art, 3.2) * (1 + 0.014 * b));
      this.pet = menuPet(this, this.pet, art, this.hero, -1);
      if (this.clock - this.featuredAt > 7000) {
        this.featuredAt = this.clock;
        this.featured = (this.featured + 1) % HEROES.length;
        this.showFeatured(false);
      }
      this.ease += (this.level.index - this.ease) * Math.min(1, delta / 70);
      this.drawMenu();
    }
    controls.poll();
    if (controls.deviceStamp !== this.promptStamp) {
      this.promptStamp = controls.deviceStamp;
      this.footer.setText(onPad(-1) ? `${familyName(-1)} controller  ·  ${menuHint()}` : `Keyboard or controller  ·  ${menuHint()}`);
      fitText(this.footer, 310);
    }
    for (const e of controls.take()) {
      if (!this.started) {
        if (e.action === 'confirm' || e.action === 'pause') {
          sfx(this, 'ui_confirm');
          sfx(this, 'super', 0.5);
          this.cameras.main.flash(160, 255, 255, 255);
          this.open();
        }
        continue;
      }
      this.handle(e.action);
    }
  }
}
