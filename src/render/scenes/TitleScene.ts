import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { playMusic, setMusicVolume, setSfxVolume, settings, sfx } from '../audio';
import { CPU_LEVELS, CSS, GAME_SUBTITLE, GAME_TITLE, VIEW_H, VIEW_W } from '../config';
import type { MatchSetup, Mode } from '../config';
import { ALL_ART, feetOrigin, frameName, menuScale } from '../heroArt';
import { Menu, backdrop, body, display, goTo, goldFill } from '../ui';

export class TitleScene extends Phaser.Scene {
  private menu!: Menu;
  private pressStart!: Phaser.GameObjects.Text;
  private started = false;
  private fighters: Phaser.GameObjects.Image[] = [];
  private clock = 0;

  constructor() {
    super('title');
  }

  create(data: { skipIntro?: boolean }): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.started = false;
    this.cameras.main.fadeIn(300, 5, 6, 12);
    backdrop(this, 'stage_rooftop', 0.5);

    // The two fighters facing each other.
    this.fighters = ALL_ART.slice(0, 2).map((art, i) =>
      this.add
        .image(i === 0 ? 170 : VIEW_W - 170, VIEW_H + 30, art.key, frameName('idle', 0))
        .setOrigin(...feetOrigin(art, i === 1))
        .setScale(menuScale(art, 2.7))
        .setFlipX(i === 1)
        .setTint(i === 0 ? 0xc8d8ff : 0xffe2c8),
    );

    const title = this.add.text(VIEW_W / 2, 150, GAME_TITLE, display(92, '#ffffff', 12)).setOrigin(0.5);
    goldFill(title);
    title.setShadow(0, 6, '#000000', 0, true, true);
    this.add.text(VIEW_W / 2, 214, GAME_SUBTITLE, display(18, CSS.ink, 5)).setOrigin(0.5);
    this.pressStart = this.add.text(VIEW_W / 2, 400, 'PRESS ENTER OR START', display(24, CSS.ink, 6)).setOrigin(0.5);
    this.tweens.add({ targets: this.pressStart, alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });
    this.add.text(VIEW_W / 2, VIEW_H - 18, 'Keyboard or gamepad  ·  Best in a desktop browser', body(13, CSS.muted)).setOrigin(0.5);

    const cpuLevel = (): number => (this.registry.get('cpuLevel') as number | undefined) ?? 1;
    const pct = (v: number): string => `◀ ${Math.round(v * 100)}% ▶`;
    const start = (mode: Mode): void => {
      const setup: Partial<MatchSetup> = { mode, cpuLevel: cpuLevel() };
      goTo(this, 'select', setup);
    };
    this.menu = new Menu(
      this,
      VIEW_W / 2 - 190,
      250,
      [
        { label: 'PARTY MODE', onSelect: () => goTo(this, 'party') },
        {
          label: 'ARCADE',
          value: () => `◀ ${CPU_LEVELS[cpuLevel()]} ▶`,
          onSelect: () => goTo(this, 'select', { mode: 'cpu', cpuLevel: cpuLevel(), arcadeStart: true }),
          onLeft: () => this.registry.set('cpuLevel', (cpuLevel() + 2) % 3),
          onRight: () => this.registry.set('cpuLevel', (cpuLevel() + 1) % 3),
        },
        {
          label: 'VS CPU',
          value: () => `◀ ${CPU_LEVELS[cpuLevel()]} ▶`,
          onSelect: () => start('cpu'),
          onLeft: () => this.registry.set('cpuLevel', (cpuLevel() + 2) % 3),
          onRight: () => this.registry.set('cpuLevel', (cpuLevel() + 1) % 3),
        },
        { label: 'VS PLAYER', onSelect: () => start('versus') },
        { label: 'TRAINING', onSelect: () => start('training') },
        { label: 'HOW TO PLAY', onSelect: () => goTo(this, 'howto', { back: 'title' }) },
        { label: 'CONTROLLERS', onSelect: () => goTo(this, 'pads') },
        {
          label: 'SPECIALS',
          value: () => `◀ ${this.registry.get('simple') ? 'SIMPLE' : 'CLASSIC'} ▶`,
          onLeft: () => this.toggleSimple(),
          onRight: () => this.toggleSimple(),
          onSelect: () => this.toggleSimple(),
        },
        { label: 'MUSIC', value: () => pct(settings.music), onLeft: () => setMusicVolume(settings.music - 0.1), onRight: () => setMusicVolume(settings.music + 0.1) },
        { label: 'SOUND FX', value: () => pct(settings.sfx), onLeft: () => setSfxVolume(settings.sfx - 0.1), onRight: () => setSfxVolume(settings.sfx + 0.1) },
        {
          label: 'FULLSCREEN',
          value: () => (this.scale.isFullscreen ? 'ON' : 'OFF'),
          onSelect: () => (this.scale.isFullscreen ? this.scale.stopFullscreen() : this.scale.startFullscreen()),
        },
      ],
      380,
      24,
      17,
    );
    this.menu.setVisible(false);
    if (data?.skipIntro) this.open();
    controls.take();
  }

  /** Simple specials: forward + special for the projectile, down + special for the rising attack. */
  private toggleSimple(): void {
    const v = !this.registry.get('simple');
    this.registry.set('simple', v);
    try {
      localStorage.setItem('afterhours.simple', v ? '1' : '0');
    } catch {
      // Not remembered; still applies this visit.
    }
  }

  private open(): void {
    this.started = true;
    this.pressStart.setVisible(false);
    this.menu.setVisible(true);
    this.menu.redraw();
    playMusic(this, 'menu');
  }

  update(_t: number, delta: number): void {
    this.clock += delta;
    const tick = Math.floor(this.clock / (1000 / 60));
    this.fighters.forEach((s, i) => s.setFrame(frameName('idle', Math.floor((tick + i * 13) / 9) % 4)));
    controls.poll();
    for (const e of controls.take()) {
      if (!this.started) {
        if (e.action === 'confirm' || e.action === 'pause') {
          sfx(this, 'ui_confirm');
          this.open();
        }
        continue;
      }
      this.menu.handle(e.action);
    }
  }
}
