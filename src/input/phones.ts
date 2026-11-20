// The TV side of phone controllers. Every phone that joins becomes a player with a name and a
// colour. Two of them hold the player 1 and player 2 seats; their buttons feed the same input
// bitmask as the keyboard and gamepads (see `controls`), their menu buttons drive the menus, and
// the rest wait their turn. Each phone is told what to show (fight pad, roster, remote, waiting)
// whenever that changes. Not part of the sim.
import type Phaser from 'phaser';
import type { PartyState } from '../render/config';
import { STAGES } from '../render/stages';
import { HEROES } from '../sim';
import { openPadServer, phoneUrl } from '../net/padlink';
import type { PadConn, PadServer } from '../net/padlink';
import { PAD_VERSION } from '../net/padproto';
import type { PadHello, PhoneView } from '../net/padproto';
import { controls, notify } from './controls';
import type { MenuAction, MenuEvent, RemoteInput } from './controls';

const COLORS = ['#3d8bff', '#ff6a3d', '#2ee6a6', '#ffc23d', '#b06bff', '#ff4fa3', '#4fd8ff', '#c8ff4f', '#ff9d4f', '#9fa8ff', '#ff6b6b', '#6bffb8'];
export const MAX_PHONES = 12;
/** A tap shorter than a frame still reaches the game: a press stays on at least this long. */
const LATCH_MS = 40;
/** A phone that goes quiet this long lets go of everything (no stuck buttons when Wi-Fi drops). */
const STALE_MS = 450;
/** A phone silent this long is taken as gone (it sends something at least every second). */
const GONE_MS = 8000;
const MENU_ACTIONS = new Set<MenuAction>(['up', 'down', 'left', 'right', 'confirm', 'back', 'pause', 'alt']);

export interface PhonePlayer {
  /** The phone's own id, kept in its browser, so a reconnect gets the same player back. */
  id: string;
  name: string;
  color: string;
  conn: PadConn | null;
  /** When the phone last said anything (performance.now). */
  heard: number;
  held: number;
  latch: number;
  latchUntil: number;
  /** Newest input message and press seen. */
  q: number;
  n: number;
  /** Simple specials (one direction + special): on by default for phones. */
  simple: boolean;
  /** The last view sent, as JSON, so it is only sent again when it changes. */
  sent: string;
  lastBuzz: number;
  /** When the TV last pinged this phone (performance.now). */
  pinged: number;
}

/** Scenes describe what phones should show, and take commands from them (all optional). */
export interface PhoneAware {
  phoneView?(seat: number, p: PhonePlayer): Partial<PhoneView> | null;
  phoneCommand?(seat: number, cmd: string, v: unknown, p: PhonePlayer): void;
}

/** Screens of a match in progress: only the two seated phones drive these. */
const MATCH_SCENES = new Set(['select', 'versus', 'fight', 'result']);

class PhoneHub implements RemoteInput {
  private server: PadServer | null = null;
  private opening: Promise<void> | null = null;
  error = '';
  readonly players: PhonePlayer[] = [];
  /** The phone (by id) in each player seat. */
  seats: [string | null, string | null] = [null, null];
  /** The party running now, for queue positions. */
  private party: PartyState | null = null;
  private events: MenuEvent[] = [];
  private game: Phaser.Game | null = null;
  /** Goes up whenever the player list changes, so the lobby knows to redraw. */
  stamp = 0;
  /** The newest join, for the lobby's welcome. */
  joined: PhonePlayer | null = null;

  attach(game: Phaser.Game): void {
    this.game = game;
  }

  get code(): string {
    return this.server?.code ?? '';
  }

  get url(): string {
    return this.code ? phoneUrl(this.code) : '';
  }

  get open(): boolean {
    return this.server !== null;
  }

  /** Can new phones find the TV right now? */
  reachable(): boolean {
    return this.server?.online() ?? false;
  }

  /** Open the room (once; again after a failure). */
  start(): Promise<void> {
    if (this.server) return Promise.resolve();
    if (this.opening) return this.opening;
    this.error = '';
    this.opening = openPadServer().then(
      (s) => {
        this.server = s;
        this.opening = null;
        controls.remote = this;
        s.onConnection((c) => this.greet(c));
        this.stamp += 1;
      },
      (e: unknown) => {
        this.opening = null;
        this.error = (e as Error)?.message ?? 'Could not open a room.';
        this.stamp += 1;
      },
    );
    return this.opening;
  }

  get starting(): boolean {
    return this.opening !== null;
  }

  connected(): PhonePlayer[] {
    return this.players.filter((p) => p.conn !== null);
  }

  byId(id: string | null | undefined): PhonePlayer | null {
    return (id && this.players.find((p) => p.id === id)) || null;
  }

  seatOf(id: string): number {
    return this.seats[0] === id ? 0 : this.seats[1] === id ? 1 : -1;
  }

  /** The phone in a seat, if it is connected. */
  phoneAt(seat: number): PhonePlayer | null {
    const p = this.byId(this.seats[seat]);
    return p && p.conn ? p : null;
  }

  /** Seat the two players a match is for: a phone party's sides, else whoever was seated. */
  seatFor(setup: { party?: PartyState }): void {
    const party = setup.party;
    this.party = party ?? null;
    if (party?.phones) this.seats = [party.phones[party.sides[0]] ?? null, party.phones[party.sides[1]] ?? null];
  }

  seat(a: string | null, b: string | null): void {
    this.seats = [a, b];
    this.party = null;
  }

  /** A phone party with everyone who joined since it started added to the back of the queue. */
  withLatecomers(party: PartyState): PartyState {
    const ids = party.phones;
    if (!ids) return party;
    const fresh = this.connected().filter((p) => !ids.includes(p.id));
    if (fresh.length === 0) return party;
    const next: PartyState = { ...party, names: [...party.names], queue: [...party.queue], wins: [...party.wins], best: [...party.best], phones: [...ids] };
    for (const p of fresh) {
      next.queue.push(next.names.length);
      next.names.push(p.name);
      next.wins.push(0);
      next.best.push(0);
      next.phones!.push(p.id);
    }
    return next;
  }

  /** Forget phones that have gone (they can join again as new players). */
  dropAway(): void {
    for (let i = this.players.length - 1; i >= 0; i -= 1) if (!this.players[i].conn) this.players.splice(i, 1);
    this.stamp += 1;
  }

  // ---------- phones joining ----------

  private greet(c: PadConn): void {
    let me: PhonePlayer | null = null;
    c.onData((m) => {
      if (m.t === 'hi') {
        me = this.hello(c, m);
        return;
      }
      if (me && me.conn === c) this.hear(me, m);
    });
    c.onClose(() => {
      if (me && me.conn === c) {
        me.conn = null;
        me.held = 0;
        me.latch = 0;
        this.stamp += 1;
        notify(`${me.name} disconnected`);
      }
    });
  }

  private hello(c: PadConn, m: Record<string, unknown>): PhonePlayer | null {
    const id = typeof m.id === 'string' ? m.id.slice(0, 40) : '';
    if (!id) return null;
    let p = this.byId(id);
    if (!p) {
      if (this.players.length >= MAX_PHONES) {
        c.send({ t: 'full' });
        setTimeout(() => c.close(), 300);
        return null;
      }
      const used = new Set(this.players.map((q) => q.color));
      p = {
        id,
        name: cleanName(m.name) || `PLAYER ${this.players.length + 1}`,
        color: COLORS.find((col) => !used.has(col)) ?? COLORS[this.players.length % COLORS.length],
        conn: null,
        heard: 0,
        held: 0,
        latch: 0,
        latchUntil: 0,
        q: 0,
        n: 0,
        simple: true,
        sent: '',
        lastBuzz: 0,
        pinged: 0,
      };
      this.players.push(p);
      this.joined = p;
      if (this.activeKey() !== 'phones') notify(`${p.name} joined: they play next`);
    } else {
      // The same phone back again (screen locked, Wi-Fi blip): it keeps its seat.
      if (p.conn && p.conn !== c) p.conn.close();
      const name = cleanName(m.name);
      if (name) p.name = name;
      notify(`${p.name} is back`);
    }
    p.conn = c;
    p.heard = performance.now();
    p.q = 0;
    p.n = typeof m.n === 'number' ? m.n : 0;
    p.sent = '';
    const hello: PadHello = { t: 'hello', v: PAD_VERSION, roster: HEROES.map((h) => h.id), stages: STAGES.map((s) => ({ id: s.id, name: s.name })), name: p.name, color: p.color };
    c.send(hello);
    this.stamp += 1;
    return p;
  }

  private hear(p: PhonePlayer, m: Record<string, unknown>): void {
    const now = performance.now();
    p.heard = now;
    if (m.t === 'in') {
      const q = Number(m.q);
      if (!(q > p.q)) return;
      p.q = q;
      p.held = Number(m.b) & 255;
      if (Array.isArray(m.p)) {
        let newest = p.n;
        for (const e of m.p as unknown[]) {
          if (!Array.isArray(e)) continue;
          const n = Number(e[0]);
          if (n > p.n) {
            p.latch |= Number(e[1]) & 255;
            p.latchUntil = now + LATCH_MS;
            newest = Math.max(newest, n);
          }
        }
        p.n = newest;
      }
    } else if (m.t === 'm' && MENU_ACTIONS.has(m.a as MenuAction)) {
      const seat = this.seatOf(p.id);
      const scene = this.activeKey();
      if (seat >= 0) this.events.push({ player: seat, action: m.a as MenuAction });
      else if (!MATCH_SCENES.has(scene) || !this.seats.some((s) => this.byId(s)?.conn)) this.events.push({ player: 0, action: m.a as MenuAction });
    } else if (m.t === 'cmd' && typeof m.c === 'string') {
      const scene = this.activeScene() as (Phaser.Scene & PhoneAware) | null;
      const seat = this.seatOf(p.id);
      scene?.phoneCommand?.(seat, m.c, m.v, p);
    } else if (m.t === 'name') {
      const name = cleanName(m.v);
      if (name) {
        p.name = name;
        p.sent = '';
        if (this.party?.phones) {
          const k = this.party.phones.indexOf(p.id);
          if (k >= 0) this.party.names[k] = name;
        }
        this.stamp += 1;
      }
    }
  }

  // ---------- each frame ----------

  private activeScene(): Phaser.Scene | null {
    const list = this.game?.scene.getScenes(true) ?? [];
    return list[list.length - 1] ?? null;
  }

  private activeKey(): string {
    return this.activeScene()?.scene.key ?? '';
  }

  poll(now: number): void {
    for (const p of this.players) {
      if (now - p.heard > STALE_MS) {
        p.held = 0;
        p.latch = 0;
      }
      if (now > p.latchUntil) p.latch = 0;
      if (!p.conn) continue;
      // A phone silent this long has gone (screen locked, out of range): it can come back.
      if (now - p.heard > GONE_MS) {
        const c = p.conn;
        p.conn = null;
        c.close();
        this.stamp += 1;
        continue;
      }
      if (now - p.pinged > 1000) {
        p.pinged = now;
        p.conn.send({ t: 'p' });
      }
    }
    if (!this.game) return;
    const scene = this.activeScene() as (Phaser.Scene & PhoneAware) | null;
    for (const p of this.players) {
      if (!p.conn) continue;
      const v = JSON.stringify(this.viewFor(p, scene));
      if (v !== p.sent) {
        p.sent = v;
        p.conn.send({ t: 'view', v: JSON.parse(v) as PhoneView });
      }
    }
  }

  private viewFor(p: PhonePlayer, scene: (Phaser.Scene & PhoneAware) | null): PhoneView {
    const seat = this.seatOf(p.id);
    const key = scene?.scene.key ?? '';
    const base: PhoneView = { screen: 'remote', say: 'USE THE TV MENU', sub: 'Move with the pad, OK to choose.', seat };
    const someoneSeated = this.seats.some((s) => this.byId(s)?.conn);
    if (seat < 0 && MATCH_SCENES.has(key) && someoneSeated) {
      const party = this.party;
      const k = party?.phones?.indexOf(p.id) ?? -1;
      const pos = party && k >= 0 ? party.queue.indexOf(k) : -1;
      const now = party ? `${party.names[party.sides[0]]}  vs  ${party.names[party.sides[1]]}` : '';
      return {
        screen: 'wait',
        seat,
        say: pos === 0 ? "YOU'RE UP NEXT" : pos > 0 ? `#${pos + 1} IN LINE` : 'YOU JOIN NEXT ROUND',
        sub: now ? `On now: ${now}` : 'Watch the TV.',
      };
    }
    const custom = scene?.phoneView?.(seat, p);
    return custom ? { ...base, ...custom, seat } : base;
  }

  bits(player: number): number {
    const p = this.byId(this.seats[player]);
    if (!p || !p.conn) return 0;
    return p.held | p.latch;
  }

  take(): MenuEvent[] {
    if (this.events.length === 0) return this.events;
    const out = this.events;
    this.events = [];
    return out;
  }

  buzz(player: number, strength: number, ms: number): void {
    const p = this.byId(this.seats[player]);
    if (!p?.conn) return;
    const now = performance.now();
    if (now - p.lastBuzz < 70) return;
    p.lastBuzz = now;
    p.conn.send({ t: 'buzz', ms: Math.round(Math.min(400, ms * Math.max(0.3, strength))) });
  }
}

export function cleanName(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v
    .toUpperCase()
    .replace(/[^A-Z0-9 .!?'_-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
}

/** The one hub for the whole game. */
export const phones = new PhoneHub();
