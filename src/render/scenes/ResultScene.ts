import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { HEROES, Result } from '../../sim';
import { playMusic, sfx } from '../audio';
import { C, CSS, VIEW_H, VIEW_W } from '../config';
import type { MatchSetup } from '../config';
import { artFor, feetOrigin, frameName, menuScale } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { arcadeSetup } from '../arcade';
import { afterMatch, leaderboard } from '../party';
import { STAGES } from '../stages';
import { Menu, body, display, goTo, goldFill, stripes } from '../ui';
import { winLine } from '../rivals';

interface ResultData {
  setup: MatchSetup;
  winner: number;
  wins: [number, number];
  /** The match's inputs, for WATCH REPLAY, and the special-input flags it was played with. */
  replay?: string;
  simple?: [boolean, boolean];
}

export class ResultScene extends Phaser.Scene {
  private menu!: Menu;
  private sprite: Phaser.GameObjects.Image | null = null;
  private hero = 0;
  private clock = 0;

  constructor() {
    super('result');
  }

  create(data: ResultData): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.clock = 0;
    this.cameras.main.fadeIn(350, 5, 6, 12);
    playMusic(this, 'menu');
    const { setup, winner } = data;
    const run = setup.arcade;
    const won = winner === 0;
    const champion = run !== undefined && won && run.fight === run.order.length - 1;
    const stage = STAGES[setup.stage];
    this.add.image(0, 0, `stage_${stage.id}`).setOrigin(0, 0).setScale(VIEW_H / 320).setAlpha(0.35);
    this.add.rectangle(0, 0, VIEW_W, VIEW_H, C.night, 0.55).setOrigin(0, 0);
    const deco = this.add.graphics();
    stripes(deco, 0, 0, VIEW_W, VIEW_H, 0xffffff, 0.03);
    // Confetti first, so it falls behind the text.
    if (champion) {
      const champ = heroInfo(HEROES[setup.p1].id);
      this.celebrate(champ.color, champ.accent);
    }

    if (winner === Result.Draw) {
      const t = this.add.text(VIEW_W / 2, 150, 'DRAW GAME', display(64, '#ffffff', 10)).setOrigin(0.5);
      goldFill(t);
      this.sprite = null;
    } else {
      this.hero = winner === 0 ? setup.p1 : setup.p2;
      const id = HEROES[this.hero].id;
      const info = heroInfo(id);
      const art = artFor(this.hero);
      this.sprite = this.add
        .image(250, VIEW_H - 10, art.key, frameName('win', art.win[0]))
        .setOrigin(...feetOrigin(art))
        .setScale(menuScale(art, 3));
      let who = setup.mode === 'cpu' && winner === 1 ? 'CPU' : `PLAYER ${winner + 1}`;
      if (setup.party) who = setup.party.names[setup.party.sides[winner]];
      if (run && won) who = champion ? 'ARCADE CLEAR' : `FIGHT ${run.fight + 1} OF ${run.order.length} WON`;
      this.add.text(470, 70, who, display(18, winner === 0 ? CSS.p1 : CSS.p2, 4));
      const t = this.add.text(470, 92, champion ? `${info.name}: CHAMPION` : `${info.name} WINS`, display(42, '#ffffff', 8));
      // Long names shrink to fit beside the fighter.
      const room = VIEW_W - 470 - 24;
      if (t.width > room) t.setScale(room / t.width);
      goldFill(t);
      const quote = winLine(this.hero, winner === 0 ? setup.p2 : setup.p1);
      const bubble = this.add.graphics();
      bubble.fillStyle(0xffffff, 0.95).fillRoundedRect(470, 160, 440, 70, 14);
      bubble.fillTriangle(470, 196, 448, 214, 486, 214);
      this.add.text(490, 195, `"${quote}"`, body(22, '#111428')).setOrigin(0, 0.5).setWordWrapWidth(400);
      sfx(this, 'crowd', 0.6);
    }
    const score = `${data.wins[0]} - ${data.wins[1]}`;
    const extra = run ? (champion ? `  ·  continues used: ${run.continues}` : won ? '' : '  ·  continue?') : '';
    this.add.text(470, 248, score + extra, display(22, CSS.muted, 4));

    const mainMenu = { label: 'MAIN MENU', onSelect: () => goTo(this, 'title', { skipIntro: true }) };
    const inputs = data.replay ?? '';
    const watch = inputs
      ? [
          {
            label: 'WATCH REPLAY',
            onSelect: () =>
              goTo(this, 'fight', {
                mode: 'replay',
                p1: setup.p1,
                p2: setup.p2,
                stage: setup.stage,
                cpuLevel: setup.cpuLevel,
                simple: data.simple,
                replay: { inputs, back: { scene: 'result', data } },
              } satisfies MatchSetup),
          },
        ]
      : [];
    let items;
    const party = setup.party;
    if (party) {
      const next = afterMatch(party, winner === 0 || winner === 1 ? winner : -1);
      if ((winner === 0 || winner === 1) && next.streak > 1) {
        this.add.text(470 + 200, 248, `${next.streak} IN A ROW!`, display(22, CSS.gold, 4));
      }
      const up = `NEXT:  ${next.names[next.sides[0]]}  vs  ${next.names[next.sides[1]]}`;
      this.add.text(470, 284, up, display(15, CSS.ink, 4));
      // The champion keeps their fighter and their controls; the challenger picks fresh.
      const keep = (side: number): boolean => next.sides[side] === party.sides[side];
      const simple = (this.registry.get('simple') as boolean | undefined) ?? false;
      const carry = {
        mode: 'versus' as const,
        cpuLevel: setup.cpuLevel,
        party: next,
        p1: keep(0) ? setup.p1 : undefined,
        p2: keep(1) ? setup.p2 : undefined,
        simple: [keep(0) ? (setup.simple?.[0] ?? simple) : simple, keep(1) ? (setup.simple?.[1] ?? simple) : simple] as [boolean, boolean],
      };
      items = [
        { label: 'NEXT MATCH', onSelect: () => goTo(this, 'select', carry) },
        ...watch,
        { label: 'END PARTY', onSelect: () => goTo(this, 'party') },
      ];
      this.standings(next);
      this.menu = new Menu(this, 470, 326, items);
      controls.take();
      return;
    }
    if (run && champion) {
      items = [{ label: 'PLAY ARCADE AGAIN', onSelect: () => goTo(this, 'select', { mode: 'cpu', cpuLevel: run.base, arcadeStart: true }) }, ...watch, mainMenu];
    } else if (run && won) {
      items = [{ label: 'NEXT FIGHT', onSelect: () => goTo(this, 'versus', arcadeSetup(setup.p1, { ...run, fight: run.fight + 1 })) }, ...watch, mainMenu];
    } else if (run) {
      items = [{ label: 'CONTINUE', onSelect: () => goTo(this, 'versus', arcadeSetup(setup.p1, { ...run, continues: run.continues + 1 })) }, ...watch, mainMenu];
    } else {
      items = [
        { label: 'REMATCH', onSelect: () => goTo(this, 'versus', setup) },
        { label: 'CHARACTER SELECT', onSelect: () => goTo(this, 'select', { mode: setup.mode, cpuLevel: setup.cpuLevel, simple: setup.simple }) },
        ...watch,
        mainMenu,
      ];
    }
    this.menu = new Menu(this, 470, 310, items);
    controls.take();
  }

  /** Party standings for the night: wins and best streak, top six. */
  private standings(p: ReturnType<typeof afterMatch>): void {
    const rows = leaderboard(p).slice(0, 6);
    const x = 470;
    const y = 418;
    const g = this.add.graphics();
    g.fillStyle(C.panel, 0.88).fillRoundedRect(x, y - 8, 440, 26 + rows.length * 17, 10);
    this.add.text(x + 14, y - 2, 'TONIGHT', display(12, CSS.gold, 3));
    this.add.text(x + 426, y - 2, 'WINS  ·  BEST RUN', body(12, CSS.muted)).setOrigin(1, 0);
    rows.forEach((r, k) => {
      const lead = k === 0 && r.wins > 0;
      this.add.text(x + 14, y + 16 + k * 17, `${k + 1}. ${r.name}${lead ? '  ★' : ''}`, body(14, lead ? CSS.gold : CSS.ink));
      this.add.text(x + 426, y + 16 + k * 17, `${r.wins}  ·  ${r.best}`, body(14, CSS.ink)).setOrigin(1, 0);
    });
  }

  /** Arcade cleared: confetti in the champion's colours. */
  private celebrate(color: number, accent: number): void {
    sfx(this, 'super', 0.7);
    const colors = [color, accent, 0xffffff, 0xffc23d];
    for (let i = 0; i < 70; i += 1) {
      const bit = this.add.rectangle(Math.random() * VIEW_W, -20 - Math.random() * VIEW_H, 6 + Math.random() * 6, 10 + Math.random() * 8, colors[i % colors.length]);
      bit.setAngle(Math.random() * 360).setAlpha(0.9);
      this.tweens.add({
        targets: bit,
        y: VIEW_H + 30,
        x: bit.x + (Math.random() - 0.5) * 160,
        angle: bit.angle + 360 + Math.random() * 360,
        duration: 2600 + Math.random() * 2200,
        repeat: -1,
        delay: Math.random() * 1500,
      });
    }
  }

  update(_t: number, delta: number): void {
    this.clock += delta;
    if (this.sprite) {
      const art = artFor(this.hero);
      const t = Math.floor(this.clock / (1000 / 60));
      this.sprite.setFrame(frameName('win', art.win[Math.min(art.win.length - 1, Math.floor(t / 7))]));
    }
    controls.poll();
    for (const e of controls.take()) this.menu.handle(e.action);
  }
}
