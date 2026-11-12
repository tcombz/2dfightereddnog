// Saved replays: the last few matches played in this browser, ready to watch again.
import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { HEROES } from '../../sim';
import { CSS, VIEW_H, VIEW_W, type MatchSetup } from '../config';
import { heroInfo } from '../heroInfo';
import { menuHint } from '../prompts';
import { savedReplays } from '../replays';
import { STAGES } from '../stages';
import { Menu, backdrop, body, display, goTo, goldFill } from '../ui';

const MODES: Record<string, string> = { cpu: 'VS CPU', versus: 'VS PLAYER', online: 'ONLINE' };

export class ReplaysScene extends Phaser.Scene {
  private menu!: Menu;

  constructor() {
    super('replays');
  }

  create(): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.cameras.main.fadeIn(200, 5, 6, 12);
    backdrop(this, 'stage_alley', 0.8);
    const title = this.add.text(VIEW_W / 2, 40, 'REPLAYS', display(36, '#ffffff', 7)).setOrigin(0.5);
    goldFill(title);
    const list = savedReplays().filter((r) => r.p1 >= 0 && r.p1 < HEROES.length && r.p2 >= 0 && r.p2 < HEROES.length);
    this.add
      .text(VIEW_W / 2, 80, list.length ? 'Your last matches in this browser. Confirm speeds a replay up.' : 'No replays yet: every match you finish is saved here.', body(15, CSS.muted))
      .setOrigin(0.5);
    this.add.text(VIEW_W / 2, VIEW_H - 16, menuHint(), body(13, CSS.muted)).setOrigin(0.5, 1);
    const name = (h: number): string => heroInfo(HEROES[h].id).short;
    const items = list.map((r) => {
      const when = new Date(r.at);
      const date = `${when.getMonth() + 1}/${when.getDate()} ${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
      const won = r.winner === 0 ? '◀' : r.winner === 1 ? '▶' : '=';
      return {
        label: `${name(r.p1)} ${won} ${name(r.p2)}`,
        value: () => `${MODES[r.mode] ?? ''}  ${r.wins[0]}-${r.wins[1]}  ${date}`,
        onSelect: () => {
          const setup: MatchSetup = {
            mode: 'replay',
            p1: r.p1,
            p2: r.p2,
            stage: Math.max(0, Math.min(STAGES.length - 1, r.stage | 0)),
            cpuLevel: 0,
            simple: r.simple,
            replay: { inputs: r.inputs, back: { scene: 'replays' } },
          };
          goTo(this, 'fight', setup);
        },
      };
    });
    items.push({ label: 'BACK', value: () => '', onSelect: () => goTo(this, 'title', { skipIntro: true }) });
    this.menu = new Menu(this, VIEW_W / 2 - 330, 124, items, 660, 36, 18);
    controls.take();
  }

  update(): void {
    controls.poll();
    for (const e of controls.take()) {
      if (e.action === 'back') goTo(this, 'title', { skipIntro: true });
      else this.menu.handle(e.action);
    }
  }
}
