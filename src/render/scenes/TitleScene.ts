// Home screen: a featured fighter in full colour, a big slanted menu on the left (categories open
// into their own lists), and cards on the right: the featured fighter, a tip, the last match.
import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { HEROES } from '../../sim';
import { playMusic, sfx } from '../audio';
import { C, CPU_LEVELS, CSS, GAME_SUBTITLE, GAME_TITLE, VIEW_H, VIEW_W } from '../config';
import type { MatchSetup, Mode } from '../config';
import { artFor, feetOrigin, frameName, menuScale } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { Companion, menuPet } from '../companion';
import { familyName, menuHint, onPad } from '../prompts';
import { savedReplays } from '../replays';
import { STAGES } from '../stages';
import { body, display, fitText, goTo, goldFill, stripes } from '../ui';

const HOME: Record<string, string> = { rogue: 'rooftop', jetsetter: 'concert', chris: 'embassy', leader: 'crown', eddnog: 'fortress', malcolm: 'helipad', quincy: 'penthouse' };

const TIPS = [
  'Hold back to block. Low attacks need down-back.',
  'Light + Special once a round: Heat Burst, then six seconds of extra damage.',
  'Knock them into the wall in the air for a wall bounce and one more hit.',
  'At a third of your health, the super costs half the meter.',
  'Light + Heavy is a throw. It beats someone who blocks all day.',
  'Training mode has combo trials for every fighter: press F4.',
  'Online: one of you hosts, the other types the four-letter code.',
  'Every finished match is saved under Extras, Replays.',
];

interface Item {
  label: string;
  value?: () => string;
  onSelect?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  /** A category: opens its own list. */
  sub?: Item[];
}

export class TitleScene extends Phaser.Scene {
  private footer!: Phaser.GameObjects.Text;
  private promptStamp = -1;
  private pressStart!: Phaser.GameObjects.Text;
  private started = false;
  private clock = 0;
  /** The menu: the top list, the open category (if any), the cursor in each. */
  private root: Item[] = [];
  private path: Array<{ items: Item[]; index: number; label: string }> = [];
  private menuG!: Phaser.GameObjects.Graphics;
  private rows: Array<{ label: Phaser.GameObjects.Text; value: Phaser.GameObjects.Text }> = [];
  private crumb!: Phaser.GameObjects.Text;
  private menuObjs: Phaser.GameObjects.GameObject[] = [];
  /** The featured fighter, swapped every few seconds. */
  private featured = 0;
  private featuredAt = 0;
  private hero!: Phaser.GameObjects.Image;
  private pet: Companion | null = null;
  private sheet!: Phaser.GameObjects.Image;
  private stageBg!: Phaser.GameObjects.Image;
  private splash!: Phaser.GameObjects.Graphics;
  private card!: { head: Phaser.GameObjects.Text; name: Phaser.GameObjects.Text; arch: Phaser.GameObjects.Text; plan: Phaser.GameObjects.Text };

  constructor() {
    super('title');
  }

  create(data: { skipIntro?: boolean }): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.started = false;
    this.clock = 0;
    this.pet = null;
    this.cameras.main.fadeIn(300, 5, 6, 12);

    // Backdrop: the featured fighter's home stage, a paint splash in their colour, their sheet art.
    this.featured = Math.floor(Math.random() * HEROES.length);
    this.stageBg = this.add.image(0, 0, 'stage_rooftop').setOrigin(0, 0).setScale(VIEW_H / 320).setAlpha(0.45);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, C.night, 0.45).setOrigin(0, 0);
    this.splash = this.add.graphics();
    this.sheet = this.add.image(VIEW_W - 250, VIEW_H, 'sheet_rogue').setOrigin(0.5, 1).setAlpha(0.2);
    this.hero = this.add.image(560, VIEW_H + 6, 'rogue').setDepth(2);
    const deco = this.add.graphics();
    stripes(deco, 0, 0, VIEW_W, VIEW_H, 0xffffff, 0.02);

    // Top bar.
    const bar = this.add.graphics().setDepth(10);
    bar.fillStyle(0xf3f1ff, 0.95).fillRect(0, 0, VIEW_W, 30);
    bar.fillStyle(C.gold, 1).fillRect(0, 30, VIEW_W, 3);
    this.add.text(14, 15, 'VER 1.22', display(13, '#9aa2c8', 0)).setOrigin(0, 0.5).setDepth(11);
    this.add.circle(110, 15, 6, 0x37d67a).setDepth(11);
    this.add.text(122, 15, 'ONLINE READY', display(13, '#1b2040', 0)).setOrigin(0, 0.5).setDepth(11);
    const replays = savedReplays().length;
    this.add.text(VIEW_W - 14, 15, `${HEROES.length} FIGHTERS  ·  ${STAGES.length} STAGES  ·  ${replays} REPLAYS`, display(13, '#1b2040', 0)).setOrigin(1, 0.5).setDepth(11);

    // Logo, top left.
    const title = this.add.text(30, 46, GAME_TITLE, display(58, '#ffffff', 10)).setDepth(10);
    goldFill(title);
    title.setShadow(0, 5, '#000000', 0, true, true);
    this.add.text(34, 112, GAME_SUBTITLE, display(14, CSS.ink, 4)).setDepth(10);

    // Right-hand cards.
    this.card = this.buildCards();

    // Bottom bar.
    const foot = this.add.graphics().setDepth(10);
    foot.fillStyle(0x05060c, 0.85).fillRect(0, VIEW_H - 28, VIEW_W, 28);
    this.footer = this.add.text(VIEW_W - 16, VIEW_H - 14, '', body(13, CSS.muted)).setOrigin(1, 0.5).setDepth(11);
    this.promptStamp = -1;

    this.pressStart = this.add.text(300, 330, 'PRESS ENTER OR START', display(26, CSS.ink, 6)).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: this.pressStart, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });

    this.buildMenu();
    this.showFeatured(true);
    this.setMenuVisible(false);
    if (data?.skipIntro) this.open();
    controls.take();
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
      { label: 'PARTY MODE', onSelect: () => goTo(this, 'party') },
      { label: 'ARCADE', value: level, onLeft: easier, onRight: harder, onSelect: () => goTo(this, 'select', { mode: 'cpu', cpuLevel: cpuLevel(), arcadeStart: true }) },
      {
        label: 'VERSUS',
        sub: [
          { label: 'VS PLAYER', onSelect: () => start('versus') },
          { label: 'VS CPU', value: level, onLeft: easier, onRight: harder, onSelect: () => start('cpu') },
        ],
      },
      { label: 'ONLINE', onSelect: () => goTo(this, 'online') },
      { label: 'TRAINING', onSelect: () => start('training') },
      {
        label: 'EXTRAS',
        sub: [
          { label: 'REPLAYS', onSelect: () => goTo(this, 'replays') },
          { label: 'HOW TO PLAY', onSelect: () => goTo(this, 'howto', { back: 'title' }) },
        ],
      },
      { label: 'SETTINGS', onSelect: () => goTo(this, 'settings') },
    ];
    this.path = [{ items: this.root, index: 0, label: '' }];
    this.menuG = this.add.graphics().setDepth(8);
    this.crumb = this.add.text(40, 146, '', display(14, CSS.gold, 4)).setDepth(9);
    this.rows = [];
    for (let k = 0; k < 8; k += 1) {
      this.rows.push({
        label: this.add.text(0, 0, '', display(24, CSS.ink, 5)).setOrigin(0, 0.5).setDepth(9),
        value: this.add.text(0, 0, '', body(15, CSS.gold)).setOrigin(0, 0.5).setDepth(9),
      });
    }
    this.menuObjs = [this.menuG, this.crumb, ...this.rows.flatMap((r) => [r.label, r.value])];
  }

  private get level(): { items: Item[]; index: number; label: string } {
    return this.path[this.path.length - 1];
  }

  /** Draw the list: the chosen row big on a slanted gold bar, the rest smaller and stepping right. */
  private drawMenu(): void {
    const { items, index } = this.level;
    const g = this.menuG;
    g.clear();
    this.crumb.setText(this.path.length > 1 ? `◀ ${this.level.label}` : '');
    let y = 186;
    this.rows.forEach((r, k) => {
      const it = items[k];
      r.label.setVisible(!!it);
      r.value.setVisible(!!it);
      if (!it) return;
      const on = k === index;
      const h = on ? 54 : 34;
      const x = 22 + k * 12;
      const w = on ? 360 : 300;
      const cy = y + h / 2;
      g.fillStyle(on ? C.gold : 0x05060c, on ? 1 : 0.72);
      g.fillPoints(
        [
          { x, y },
          { x: x + w, y },
          { x: x + w - 16, y: y + h },
          { x: x - 16, y: y + h },
        ],
        true,
      );
      if (on) g.fillStyle(0xffffff, 1).fillRect(x - 16, y + h - 4, w, 4);
      r.label
        .setText(it.label + (it.sub ? '  ›' : ''))
        .setStyle(display(on ? 34 : 22, on ? '#120c02' : CSS.ink, on ? 0 : 4))
        .setPosition(x + 14, cy);
      r.value
        .setText(it.value?.() ?? '')
        .setColor(on ? '#120c02' : CSS.gold)
        .setPosition(x + w - 26 - (it.value ? 0 : 0), cy)
        .setOrigin(1, 0.5);
      fitText(r.label, w - (it.value ? 150 : 40));
      y += h + 6;
    });
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
      if (it.sub) this.path.push({ items: it.sub, index: 0, label: it.label });
      else it.onSelect?.();
      sfx(this, 'ui_confirm');
    } else if (action === 'back' || action === 'left') {
      if (this.path.length > 1) {
        this.path.pop();
        sfx(this, 'ui_move', 0.8);
      }
    } else return;
    this.drawMenu();
  }

  // ---------- cards and the featured fighter ----------

  private buildCards(): TitleScene['card'] {
    const x = VIEW_W - 268;
    const w = 252;
    const g = this.add.graphics().setDepth(8);
    const panel = (y: number, h: number, head: string, color: number): Phaser.GameObjects.Text => {
      g.fillStyle(0x0b0e1c, 0.88).fillRect(x, y, w, h);
      g.fillStyle(color, 1).fillRect(x, y, w, 24);
      return this.add.text(x + 10, y + 12, head, display(13, '#120c02', 0)).setOrigin(0, 0.5).setDepth(9);
    };
    // Featured fighter.
    const head = panel(48, 150, 'FEATURED FIGHTER', C.gold);
    const name = this.add.text(x + 10, 80, '', display(26, '#ffffff', 5)).setDepth(9);
    const arch = this.add.text(x + 10, 116, '', display(12, CSS.gold, 3)).setDepth(9);
    const plan = this.add.text(x + 10, 136, '', body(13, CSS.ink)).setDepth(9).setWordWrapWidth(w - 20).setLineSpacing(1);
    // A tip.
    panel(208, 106, 'TIP OF THE NIGHT', 0x37b7ff);
    this.add
      .text(x + 10, 240, TIPS[Math.floor(Math.random() * TIPS.length)], body(14, CSS.ink))
      .setDepth(9)
      .setWordWrapWidth(w - 20)
      .setLineSpacing(2);
    // The last match played in this browser.
    panel(324, 150, 'LAST MATCH', 0xff6a3d);
    const last = savedReplays()[0];
    if (last && last.p1 < HEROES.length && last.p2 < HEROES.length) {
      const a = heroInfo(HEROES[last.p1].id);
      const b = heroInfo(HEROES[last.p2].id);
      [last.p1, last.p2].forEach((h, i) => {
        this.add
          .image(x + 50 + i * 152, 390, `portrait_${HEROES[h].id}`)
          .setDisplaySize(64, 64)
          .setDepth(9)
          .setAlpha(last.winner === i ? 1 : 0.5);
      });
      this.add.text(x + w / 2, 390, `${last.wins[0]} - ${last.wins[1]}`, display(22, '#ffffff', 5)).setOrigin(0.5).setDepth(9);
      fitText(this.add.text(x + w / 2, 438, `${a.name}  vs  ${b.name}`, display(13, CSS.ink, 3)).setOrigin(0.5).setDepth(9), w - 20);
      this.add.text(x + w / 2, 458, 'Watch it: Extras › Replays', body(12, CSS.muted)).setOrigin(0.5).setDepth(9);
    } else {
      this.add.text(x + 10, 356, 'No matches yet tonight.\nPick a mode and make some history.', body(14, CSS.muted)).setDepth(9).setLineSpacing(3);
    }
    return { head, name, arch, plan };
  }

  /** Put the featured fighter on screen (or swap to the next one with a quick slide). */
  private showFeatured(first: boolean): void {
    const hero = HEROES[this.featured];
    const info = heroInfo(hero.id);
    const art = artFor(this.featured);
    const stage = STAGES.find((s) => s.id === HOME[hero.id]) ?? STAGES[0];
    this.stageBg.setTexture(`stage_${stage.id}`);
    this.sheet.setTexture(`sheet_${hero.id}`).setScale((VIEW_H - 40) / this.sheet.height);
    this.hero.setTexture(art.key, frameName('idle', 0)).setOrigin(...feetOrigin(art, false)).setScale(menuScale(art, 3.4));
    const g = this.splash;
    g.clear();
    g.fillStyle(info.color, 0.35).fillPoints([{ x: 380, y: 0 }, { x: 760, y: 0 }, { x: 690, y: VIEW_H }, { x: 300, y: VIEW_H }], true);
    g.fillStyle(info.accent, 0.22).fillPoints([{ x: 470, y: 0 }, { x: 560, y: 0 }, { x: 470, y: VIEW_H }, { x: 380, y: VIEW_H }], true);
    this.card.name.setText(info.name);
    fitText(this.card.name, 232);
    this.card.arch.setText(`${info.title.replace(/^[^"]*"|"$/g, '')}  ·  ${info.archetype}`);
    fitText(this.card.arch, 232);
    this.card.plan.setText(info.plan);
    if (!first) {
      this.hero.setAlpha(0).setX(600);
      this.tweens.add({ targets: this.hero, alpha: 1, x: 560, duration: 300, ease: 'Cubic.easeOut' });
    }
  }

  private open(): void {
    this.started = true;
    this.pressStart.setVisible(false);
    this.setMenuVisible(true);
    playMusic(this, 'menu');
  }

  update(_t: number, delta: number): void {
    this.clock += delta;
    const tick = Math.floor(this.clock / (1000 / 60));
    const art = artFor(this.featured);
    this.hero.setFrame(frameName('idle', art.idle[Math.floor(tick / 9) % art.idle.length]));
    this.pet = menuPet(this, this.pet, art, this.hero, this.hero.frame.name, 1);
    if (this.clock - this.featuredAt > 7000) {
      this.featuredAt = this.clock;
      this.featured = (this.featured + 1) % HEROES.length;
      this.showFeatured(false);
    }
    controls.poll();
    if (controls.deviceStamp !== this.promptStamp) {
      this.promptStamp = controls.deviceStamp;
      this.footer.setText(onPad(-1) ? `${familyName(-1)} controller  ·  ${menuHint()}` : `Keyboard or any controller  ·  ${menuHint()}`);
    }
    for (const e of controls.take()) {
      if (!this.started) {
        if (e.action === 'confirm' || e.action === 'pause') {
          sfx(this, 'ui_confirm');
          this.open();
        }
        continue;
      }
      this.handle(e.action);
    }
  }
}
