// Phone party lobby, for the TV: a QR code and a room code; everyone who scans it joins with their
// phone as the controller. Start from the TV or any phone: one phone fights the CPU, two or more
// play winner-stays-on (the two up hold the controllers, the rest wait their turn on their phones).
import Phaser from 'phaser';
import qrcode from 'qrcode-generator';
import { controls } from '../../input/controls';
import { MAX_PHONES, phones } from '../../input/phones';
import type { PhonePlayer } from '../../input/phones';
import type { PhoneView } from '../../net/padproto';
import { playMusic, sfx } from '../audio';
import { C, CSS, VIEW_H, VIEW_W } from '../config';
import type { PartyState } from '../config';
import { newParty } from '../party';
import { Menu, backdrop, body, display, goTo, goldFill } from '../ui';

const QR_KEY = 'phone_qr';
const QR_SIZE = 236;

export class PhonesScene extends Phaser.Scene {
  private menu!: Menu;
  private qr: Phaser.GameObjects.Image | null = null;
  private qrFor = '';
  private codeText!: Phaser.GameObjects.Text;
  private urlText!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private list!: Phaser.GameObjects.Container;
  private stamp = -1;
  private welcomed: PhonePlayer | null = null;
  private clock = 0;
  private cardG!: Phaser.GameObjects.Graphics;

  constructor() {
    super('phones');
  }

  create(): void {
    (this as unknown as { leaving: boolean }).leaving = false;
    this.cameras.main.fadeIn(220, 5, 6, 12);
    playMusic(this, 'menu');
    backdrop(this, 'stage_concert', 0.74);
    this.stamp = -1;
    this.qr = null;
    this.qrFor = '';
    this.welcomed = phones.joined;
    phones.seat(null, null);

    const title = this.add.text(40, 26, 'PHONE PARTY', display(38, '#ffffff', 8));
    goldFill(title);
    this.add.text(42, 74, 'The game plays on this screen. Everyone uses their phone as the controller.', body(15, CSS.muted));

    // The join card: QR code, room code, address.
    this.cardG = this.add.graphics();
    this.cardG.fillStyle(C.panel, 0.94).fillRoundedRect(36, 104, 368, 412, 16);
    this.cardG.lineStyle(2, C.gold, 0.9).strokeRoundedRect(36, 104, 368, 412, 16);
    this.cardG.fillStyle(0xffffff, 1).fillRoundedRect(220 - QR_SIZE / 2 - 12, 124, QR_SIZE + 24, QR_SIZE + 24, 12);
    this.add.text(220, 404, 'SCAN WITH YOUR PHONE CAMERA', display(14, CSS.gold, 3)).setOrigin(0.5);
    this.codeText = this.add.text(220, 446, '', display(40, '#ffffff', 7)).setOrigin(0.5);
    this.urlText = this.add.text(220, 490, '', body(13, CSS.muted)).setOrigin(0.5).setWordWrapWidth(340).setAlign('center');
    this.status = this.add.text(220, 254, '', body(16, '#120c02')).setOrigin(0.5).setWordWrapWidth(QR_SIZE - 10).setAlign('center');

    // Who is in.
    const g = this.add.graphics();
    g.fillStyle(C.panel, 0.9).fillRoundedRect(430, 104, 494, 268, 16);
    g.lineStyle(2, C.panelEdge, 1).strokeRoundedRect(430, 104, 494, 268, 16);
    this.add.text(452, 118, 'PLAYERS', display(16, CSS.gold, 4));
    this.countText = this.add.text(902, 120, '', body(14, CSS.muted)).setOrigin(1, 0);
    this.list = this.add.container(0, 0);

    this.menu = new Menu(
      this,
      430,
      410,
      [
        { label: 'START', value: () => this.startLabel(), onSelect: () => this.start() },
        { label: 'CLEAR PLAYERS WHO LEFT', onSelect: () => phones.dropAway() },
        { label: 'BACK', onSelect: () => goTo(this, 'title', { skipIntro: true }) },
      ],
      494,
      42,
      20,
    );
    this.hint = this.add.text(VIEW_W / 2 + 196, VIEW_H - 10, '', body(13, CSS.muted)).setOrigin(0.5, 1);

    void phones.start();
    controls.take();
  }

  private startLabel(): string {
    const n = phones.connected().length;
    return n === 0 ? 'WAITING FOR PHONES' : n === 1 ? 'VS CPU' : n === 2 ? '1 VS 1' : 'WINNER STAYS ON';
  }

  /** One phone fights the CPU; two or more play winner-stays-on, with a scoreboard. */
  start(): void {
    const ps = phones.connected();
    if (ps.length === 0) {
      sfx(this, 'ui_move', 0.8);
      this.hint.setText(phones.open ? 'Scan the code with a phone first (or open the address and type the code).' : 'Waiting for the room to open…');
      return;
    }
    sfx(this, 'ui_confirm');
    if (ps.length === 1) {
      phones.seat(ps[0].id, null);
      goTo(this, 'select', { mode: 'cpu', cpuLevel: (this.registry.get('cpuLevel') as number | undefined) ?? 1, simple: [ps[0].simple, false] });
      return;
    }
    const party: PartyState = { ...newParty(ps.map((p) => p.name)), phones: ps.map((p) => p.id) };
    phones.seatFor({ party });
    goTo(this, 'select', { mode: 'versus', cpuLevel: 1, party });
  }

  // ---------- phones ----------

  phoneView(_seat: number, p: PhonePlayer): Partial<PhoneView> {
    const n = phones.connected().length;
    return {
      screen: 'lobby',
      say: "YOU'RE IN!",
      sub: n < 2 ? 'Waiting for more players. Press START to fight the CPU now.' : 'Anyone can press START once everyone is in.',
      players: phones.players.map((q) => ({ name: q.name, color: q.color, on: q.conn !== null, me: q.id === p.id })),
      start: n === 0 ? '' : `START: ${this.startLabel()}`,
    };
  }

  phoneCommand(_seat: number, c: string): void {
    if (c === 'start') this.start();
  }

  // ---------- drawing ----------

  private drawQr(): void {
    const url = phones.url;
    if (!url || url === this.qrFor) return;
    this.qrFor = url;
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    const n = q.getModuleCount();
    if (this.textures.exists(QR_KEY)) this.textures.remove(QR_KEY);
    const tex = this.textures.createCanvas(QR_KEY, n, n);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, n, n);
    ctx.fillStyle = '#05060c';
    for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (q.isDark(r, c)) ctx.fillRect(c, r, 1, 1);
    tex.refresh();
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.qr?.destroy();
    this.qr = this.add.image(220, 124 + 12 + QR_SIZE / 2, QR_KEY).setDisplaySize(QR_SIZE, QR_SIZE);
    this.qr.setScale(this.qr.scaleX * 0.2).setAlpha(0);
    this.tweens.add({ targets: this.qr, scaleX: QR_SIZE / n, scaleY: QR_SIZE / n, alpha: 1, duration: 300, ease: 'Back.easeOut' });
    this.codeText.setText(`CODE  ${phones.code}`);
    goldFill(this.codeText);
    this.urlText.setText(url.replace(/^https?:\/\//, '').replace(/[?&]net=local/, ''));
    this.status.setText('');
  }

  private drawList(): void {
    this.list.removeAll(true);
    const ps = phones.players;
    const on = phones.connected().length;
    this.countText.setText(`${on} / ${MAX_PHONES}`);
    if (ps.length === 0) {
      this.list.add(this.add.text(677, 238, 'Nobody yet.\nScan the code to join.', body(18, CSS.muted)).setOrigin(0.5).setAlign('center'));
      return;
    }
    ps.forEach((p, k) => {
      const col = k % 2;
      const row = Math.floor(k / 2);
      const x = 452 + col * 236;
      const y = 150 + row * 36;
      const color = Phaser.Display.Color.HexStringToColor(p.color).color;
      const g = this.add.graphics();
      g.fillStyle(0x0b0e1c, 0.95).fillRoundedRect(x, y, 224, 30, 8);
      g.lineStyle(2, p.conn ? color : 0x3a4170, 1).strokeRoundedRect(x, y, 224, 30, 8);
      g.fillStyle(color, p.conn ? 1 : 0.35).fillCircle(x + 17, y + 15, 7);
      const t = this.add.text(x + 32, y + 15, p.name, display(14, p.conn ? CSS.ink : CSS.muted, 3)).setOrigin(0, 0.5);
      const parts: Phaser.GameObjects.GameObject[] = [g, t];
      if (!p.conn) parts.push(this.add.text(x + 214, y + 15, 'LEFT', body(11, CSS.muted)).setOrigin(1, 0.5));
      this.list.add(parts);
      if (p === phones.joined && p !== this.welcomed) {
        // The newest arrival slams in.
        this.welcomed = p;
        for (const o of parts) {
          const obj = o as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha;
          obj.setAlpha(0);
          this.tweens.add({ targets: obj, alpha: 1, duration: 260 });
        }
        sfx(this, 'ui_confirm');
        sfx(this, 'crowd', 0.35);
        this.cameras.main.flash(120, 255, 220, 120);
      }
    });
  }

  update(_t: number, delta: number): void {
    this.clock += delta;
    controls.poll();
    if (phones.stamp !== this.stamp) {
      this.stamp = phones.stamp;
      this.drawQr();
      this.drawList();
      this.menu.redraw();
    }
    if (!phones.open) {
      this.status.setText(phones.starting ? 'Opening a room…' : phones.error ? `${phones.error}\n\nPress START to try again.` : '');
    }
    const n = phones.connected().length;
    this.hint.setText(
      !phones.open
        ? ''
        : !phones.reachable()
          ? 'Reconnecting to the join service… phones already in can keep playing.'
          : n === 0
            ? 'Point a phone camera at the code. Same Wi-Fi is best.'
            : 'Start from here, or anyone can press START on their phone.',
    );
    for (const e of controls.take()) {
      if (e.action === 'back' || e.action === 'pause') {
        goTo(this, 'title', { skipIntro: true });
        return;
      }
      if (e.action === 'confirm' && !phones.open && !phones.starting && this.menu.index === 0) {
        void phones.start();
        continue;
      }
      this.menu.handle(e.action);
    }
  }
}
