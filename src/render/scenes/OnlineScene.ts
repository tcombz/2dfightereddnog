// Online lobby: host a room (get a code) or join one, then both players pick a fighter and ready up.
// The host plays player 1 and picks the stage. The fight itself runs on rollback (src/net/rollback.ts).
import Phaser from 'phaser';
import { controls } from '../../input/controls';
import { cleanCode, newCode, openLink } from '../../net/link';
import { online, sendMine, setOnline, theirs, type Lobby } from '../../net/session';
import { HEROES } from '../../sim';
import { sfx, playMusic } from '../audio';
import { C, CSS, VIEW_H, VIEW_W, type MatchSetup } from '../config';
import { artFor, feetOrigin, frameName, menuScale } from '../heroArt';
import { heroInfo } from '../heroInfo';
import { menuHint } from '../prompts';
import { STAGES } from '../stages';
import { Menu, backdrop, body, display, goTo, goldFill } from '../ui';

type Mode = 'menu' | 'join' | 'connecting' | 'lobby';

export class OnlineScene extends Phaser.Scene {
  private mode: Mode = 'menu';
  private menu!: Menu;
  private status!: Phaser.GameObjects.Text;
  private codeText!: Phaser.GameObjects.Text;
  private box?: HTMLInputElement;
  private entry = '';
  private sides: Array<{ img: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; tag: Phaser.GameObjects.Text; ready: Phaser.GameObjects.Text }> = [];
  private stageText!: Phaser.GameObjects.Text;
  private lobbyObjs: Phaser.GameObjects.GameObject[] = [];
  private beat = 0;
  private beatAt = 0;
  private clock = 0;

  constructor() {
    super('online');
  }

  create(data: { notice?: string } = {}): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.cameras.main.fadeIn(200, 5, 6, 12);
    backdrop(this, 'stage_helipad', 0.78);
    playMusic(this, 'menu');
    const title = this.add.text(VIEW_W / 2, 40, 'ONLINE', display(36, '#ffffff', 7)).setOrigin(0.5);
    goldFill(title);
    this.status = this.add.text(VIEW_W / 2, 84, data.notice ?? 'Play a friend anywhere. One of you hosts and shares the code.', body(15, CSS.muted)).setOrigin(0.5);
    this.codeText = this.add.text(VIEW_W / 2, 150, '', display(44, CSS.gold, 7)).setOrigin(0.5);
    this.add.text(VIEW_W / 2, VIEW_H - 16, menuHint(), body(13, CSS.muted)).setOrigin(0.5, 1);

    this.menu = new Menu(
      this,
      VIEW_W / 2 - 170,
      240,
      [
        { label: 'HOST A MATCH', onSelect: () => this.connect(newCode(), true) },
        { label: 'JOIN WITH A CODE', onSelect: () => this.startJoin() },
        { label: 'BACK', onSelect: () => this.leave() },
      ],
      340,
      54,
      24,
    );
    this.buildLobby();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.box?.remove());

    const o = online();
    if (o) {
      // Back from a match: straight to the lobby, everyone un-readied.
      sendMine({ ready: false, start: null, g: null });
      this.enterLobby();
      if (o.last) this.status.setText(`${o.last.winner === o.me ? 'YOU WON' : 'YOU LOST'} ${o.last.wins[o.me]}-${o.last.wins[1 - o.me]}  ·  Ready up for a rematch`);
      if (data.notice) this.status.setText(data.notice);
    } else this.setMode('menu');
    controls.take();
  }

  private setMode(m: Mode): void {
    this.mode = m;
    this.menu.setVisible(m === 'menu');
    for (const o of this.lobbyObjs) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(m === 'lobby');
    if (m !== 'join') this.box?.remove();
    if (m === 'menu') this.codeText.setText('');
  }

  // ---------- joining ----------

  private startJoin(): void {
    this.setMode('join');
    this.entry = '';
    this.status.setText('Type the code from your friend, then press Enter.  (Controller: up / down picks letters)');
    const el = document.createElement('input');
    el.type = 'text';
    el.maxLength = 4;
    el.placeholder = 'CODE';
    el.autocapitalize = 'characters';
    el.style.cssText =
      'position:fixed;box-sizing:border-box;text-align:center;letter-spacing:0.3em;font-weight:700;font-family:system-ui,sans-serif;' +
      'border-radius:8px;border:2px solid #ffc23d;background:#0b0e1c;color:#ffc23d;z-index:5;outline:none';
    const place = (): void => {
      const r = this.game.canvas.getBoundingClientRect();
      const k = r.width / VIEW_W;
      Object.assign(el.style, { left: `${r.left + (VIEW_W / 2 - 110) * k}px`, top: `${r.top + 120 * k}px`, width: `${220 * k}px`, height: `${60 * k}px`, fontSize: `${Math.max(14, 34 * k)}px` });
    };
    place();
    window.addEventListener('resize', place);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('resize', place));
    el.addEventListener('input', () => {
      this.entry = cleanCode(el.value);
      el.value = this.entry;
    });
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && this.entry.length === 4) this.connect(this.entry, false);
      else if (e.key === 'Escape') this.setMode('menu');
    });
    document.body.appendChild(el);
    this.box = el;
    window.setTimeout(() => el.focus(), 50);
  }

  /** Controller code entry: up/down change the last letter, right adds one, left removes one. */
  private padEntry(action: string): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    if (action === 'confirm' && this.entry.length === 4) return void this.connect(this.entry, false);
    if (action === 'back') return void this.setMode('menu');
    if (this.entry.length === 0 && action !== 'left') this.entry = 'A';
    else if (action === 'up' || action === 'down') {
      const last = this.entry[this.entry.length - 1];
      const k = (chars.indexOf(last) + (action === 'up' ? 1 : -1) + chars.length) % chars.length;
      this.entry = this.entry.slice(0, -1) + chars[k];
    } else if (action === 'right' && this.entry.length < 4) this.entry += 'A';
    else if (action === 'left') this.entry = this.entry.slice(0, -1);
    if (this.box) this.box.value = this.entry;
    sfx(this, 'ui_move', 0.6);
  }

  private async connect(code: string, host: boolean): Promise<void> {
    this.setMode('connecting');
    this.codeText.setText(code);
    this.status.setText(host ? 'Opening a room…' : 'Joining…');
    try {
      const link = await openLink(code, host);
      if (!this.scene.isActive()) return void link.close();
      const simple = (this.registry.get('simple') as boolean | undefined) ?? false;
      const mine: Lobby = { hero: host ? 0 : 1, simple, ready: false, stage: 0, start: null, g: null, wins: [0, 0] };
      setOnline({ link, code, host, me: host ? 0 : 1, mine, played: 0 });
      sendMine();
      this.enterLobby();
    } catch (e) {
      this.setMode('menu');
      this.status.setText((e as Error).message || 'Could not connect.');
    }
  }

  // ---------- the lobby ----------

  private buildLobby(): void {
    [0, 1].forEach((i) => {
      const x = i === 0 ? 220 : VIEW_W - 220;
      const g = this.add.graphics();
      g.fillStyle(C.panel, 0.85).fillRoundedRect(x - 170, 190, 340, 300, 12);
      g.lineStyle(2, i === 0 ? 0x3d8bff : 0xff6a3d, 1).strokeRoundedRect(x - 170, 190, 340, 300, 12);
      const tag = this.add.text(x, 210, '', display(16, i === 0 ? CSS.p1 : CSS.p2, 4)).setOrigin(0.5);
      const art = artFor(0);
      const img = this.add.image(x, 420, art.key, frameName('idle', 0)).setFlipX(i === 1);
      const name = this.add.text(x, 440, '', display(18, CSS.ink, 5)).setOrigin(0.5, 0);
      const ready = this.add.text(x, 470, '', display(16, CSS.gold, 4)).setOrigin(0.5, 0);
      this.sides.push({ img, name, tag, ready });
      this.lobbyObjs.push(g, tag, img, name, ready);
    });
    this.stageText = this.add.text(VIEW_W / 2, 214, '', body(15, CSS.ink)).setOrigin(0.5);
    const help = this.add
      .text(VIEW_W / 2, 330, '◀ ▶  fighter\n▲ ▼  stage (host)\nCONFIRM  ready\nBACK  leave', body(14, CSS.muted))
      .setOrigin(0.5)
      .setAlign('center')
      .setLineSpacing(6);
    this.lobbyObjs.push(this.stageText, help);
  }

  private enterLobby(): void {
    const o = online();
    if (!o) return;
    this.setMode('lobby');
    this.codeText.setText(o.code);
    this.status.setText(o.host ? 'Share this code with your friend.' : 'Connected. Pick your fighter.');
  }

  private lobbyInput(action: string): void {
    const o = online();
    if (!o) return;
    const m = o.mine;
    if (action === 'back') {
      if (m.ready) return void sendMine({ ready: false });
      return this.leave();
    }
    if (m.ready && action !== 'confirm') return;
    if (action === 'left' || action === 'right') {
      sendMine({ hero: (m.hero + (action === 'left' ? -1 : 1) + HEROES.length) % HEROES.length });
      sfx(this, 'ui_move', 0.7);
    } else if ((action === 'up' || action === 'down') && o.host) {
      sendMine({ stage: (m.stage + (action === 'up' ? -1 : 1) + STAGES.length) % STAGES.length });
      sfx(this, 'ui_move', 0.7);
    } else if (action === 'confirm') {
      sendMine({ ready: !m.ready });
      sfx(this, 'ui_confirm');
    }
  }

  private drawLobby(): void {
    const o = online();
    if (!o) return;
    const t = theirs();
    const here = t !== null && o.link.quietFor() < 6000;
    const bySlot: Array<Partial<Lobby> | null> = o.me === 0 ? [o.mine, here ? t : null] : [here ? t : null, o.mine];
    bySlot.forEach((p, i) => {
      const v = this.sides[i];
      const mine = i === o.me;
      v.tag.setText(`P${i + 1}  ·  ${mine ? 'YOU' : 'OPPONENT'}`);
      if (!p || typeof p.hero !== 'number' || p.hero < 0 || p.hero >= HEROES.length) {
        v.img.setVisible(false);
        v.name.setText(mine ? '' : 'WAITING FOR A PLAYER…');
        v.ready.setText('');
        return;
      }
      const art = artFor(p.hero);
      const n = art.idle.length;
      v.img
        .setVisible(true)
        .setTexture(art.key, frameName('idle', art.idle[Math.floor(this.clock / 150) % n]))
        .setOrigin(...feetOrigin(art, i === 1))
        .setScale(menuScale(art, 1.5));
      v.name.setText(heroInfo(HEROES[p.hero].id).title);
      v.ready.setText(p.ready ? '✔ READY' : '');
    });
    const stage = o.host ? o.mine.stage : (t?.stage ?? 0);
    this.stageText.setText(`STAGE: ${STAGES[Math.max(0, Math.min(STAGES.length - 1, stage | 0))].name.toUpperCase()}`);

    // Start: the host gives the order once both are ready; the guest follows it.
    const next = o.played + 1;
    if (o.host && here && o.mine.ready && t?.ready && !o.mine.start) {
      sendMine({ start: { m: next, p1: o.mine.hero, p2: t.hero as number, stage: o.mine.stage, s1: o.mine.simple, s2: !!t.simple } });
    }
    const start = o.host ? o.mine.start : here && o.mine.ready ? t?.start : null;
    if (start && start.m === next) this.begin(start);
  }

  private begin(start: NonNullable<Lobby['start']>): void {
    const o = online();
    if (!o) return;
    o.played = start.m;
    const setup: MatchSetup = {
      mode: 'online',
      p1: start.p1,
      p2: start.p2,
      stage: Math.max(0, Math.min(STAGES.length - 1, start.stage | 0)),
      cpuLevel: 0,
      simple: [!!start.s1, !!start.s2],
      online: { me: o.me, match: start.m },
    };
    goTo(this, 'versus', setup, 300);
  }

  private leave(): void {
    setOnline(null);
    goTo(this, 'title', { skipIntro: true });
  }

  update(_t: number, delta: number): void {
    this.clock += delta;
    controls.poll();
    for (const e of controls.take()) {
      if (this.mode === 'menu') {
        if (e.action === 'back') this.leave();
        else this.menu.handle(e.action);
      } else if (this.mode === 'join') this.padEntry(e.action);
      else if (this.mode === 'lobby') this.lobbyInput(e.action);
    }
    if (this.mode === 'lobby') {
      // A heartbeat, so each side can tell the other is still there.
      if (this.clock - this.beatAt > 500) {
        this.beatAt = this.clock;
        this.beat += 1;
        sendMine({ beat: this.beat } as Partial<Lobby>);
      }
      this.drawLobby();
    }
  }
}
