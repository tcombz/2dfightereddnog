// Connections between two players' browsers. Every link carries one thing: each side's latest
// "presence", an absolute object (lobby picks plus the newest NetFrame) that replaces the last.
// Dropped or merged messages cost nothing, since the next one says everything again.
//
//  - The shared claude.ai page's room, when this viewer is admitted to it (signed-in members of the
//    artifact's organization and invited guests; anyone else is silently left out).
//  - A direct WebRTC link through the public PeerJS broker (GitHub Pages, local dev, and as a
//    second route on the claude.ai page).
//  Both are tried at once and both carry every message, so the two players meet on whichever
//  route works for both of them.
//  - `?net=local`: two tabs of one browser, for testing.

export type Presence = Record<string, unknown>;

export interface Link {
  /** Which routes are live, for the lobby: 'room', 'direct', 'room + direct' or 'local'. */
  readonly kind: string;
  /** Replace this side's presence. Cheap: call it every tick. */
  set(p: Presence): void;
  /** The other side's newest presence, or null while nobody is there. */
  other(): Presence | null;
  /** Milliseconds since the other side's presence last changed (Infinity: never). */
  quietFor(): number;
  close(): void;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newCode(): string {
  let s = '';
  for (let i = 0; i < 4; i += 1) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function cleanCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

class Base {
  protected theirs: Presence | null = null;
  protected heard = 0;
  other(): Presence | null {
    return this.theirs;
  }
  quietFor(): number {
    return this.heard === 0 ? Infinity : performance.now() - this.heard;
  }
  protected hear(p: Presence | null): void {
    this.theirs = p;
    if (p) this.heard = performance.now();
  }
}

// ---------- the claude.ai page room ----------

interface RoomPeer {
  sameTab: boolean;
  kind: string;
  presence: Presence;
}
interface NamedRoom {
  presence(patch: Record<string, unknown>): Promise<void>;
  connected(): boolean;
  onConnection(fn: (connected: boolean) => void): () => void;
  peers(): readonly RoomPeer[];
  onPeers(fn: (c: { peers: readonly RoomPeer[] }) => void): () => void;
  leave(): Promise<void>;
}
interface RoomApi {
  join(name: string): Promise<NamedRoom>;
}

class RoomLink extends Base implements Link {
  readonly kind = 'room';
  private last: Presence | null = null;
  private unsub: () => void;
  constructor(private readonly room: NamedRoom) {
    super();
    const look = (peers: readonly RoomPeer[]): void => {
      // Whoever else is here (your own other tab counts, for trying it alone).
      const o = peers.find((p) => !p.sameTab && p.kind === 'viewer' && p.presence && typeof p.presence.d === 'object');
      const d = (o?.presence.d as Presence | undefined) ?? null;
      if (d !== this.last) {
        this.last = d;
        this.hear(d);
      }
    };
    this.unsub = room.onPeers((c) => look(c.peers));
  }
  set(p: Presence): void {
    this.room.presence({ d: p as Record<string, unknown> }).catch(() => undefined);
  }
  close(): void {
    this.unsub();
    this.room.leave().catch(() => undefined);
  }
}

async function roomApi(): Promise<RoomApi | null> {
  const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (!c?.use) return null;
  try {
    const r = await Promise.race([c.use('room'), new Promise((res) => setTimeout(() => res(null), 6000))]);
    return (r as RoomApi | null) ?? null;
  } catch {
    return null;
  }
}

// ---------- two tabs, one browser ----------

class LocalLink extends Base implements Link {
  readonly kind = 'local';
  private readonly ch: BroadcastChannel;
  private readonly id = Math.random().toString(36).slice(2);
  constructor(code: string) {
    super();
    this.ch = new BroadcastChannel(`afterhours-${code}`);
    this.ch.onmessage = (e: MessageEvent<{ from: string; p: Presence }>) => {
      if (e.data?.from !== this.id) this.hear(e.data.p);
    };
  }
  set(p: Presence): void {
    this.ch.postMessage({ from: this.id, p });
  }
  close(): void {
    this.ch.close();
  }
}

// ---------- WebRTC through PeerJS ----------

interface PeerConn {
  open: boolean;
  send(d: unknown): void;
  on(ev: string, fn: (d?: unknown) => void): void;
  close(): void;
}

class PeerLink extends Base implements Link {
  readonly kind = 'direct';
  private conn: PeerConn | null = null;
  constructor(private readonly peer: { destroy(): void }) {
    super();
  }
  attach(c: PeerConn): void {
    if (this.conn && this.conn.open) {
      c.close();
      return;
    }
    this.conn = c;
    c.on('data', (d) => this.hear(d as Presence));
    c.on('close', () => {
      if (this.conn === c) {
        this.conn = null;
        this.hear(null);
      }
    });
  }
  set(p: Presence): void {
    if (this.conn?.open) this.conn.send(p);
  }
  close(): void {
    this.conn?.close();
    this.peer.destroy();
  }
}

async function peerLink(code: string, host: boolean): Promise<Link> {
  const { Peer } = await import('peerjs');
  const id = `afterhours-game-${code.toLowerCase()}`;
  return new Promise<Link>((resolve, reject) => {
    const peer = host ? new Peer(id) : new Peer();
    const link = new PeerLink(peer);
    const timer = setTimeout(() => reject(new Error('Could not reach the matchmaking server.')), 12000);
    peer.on('error', (e: { type?: string }) => {
      clearTimeout(timer);
      if (e.type === 'unavailable-id') reject(new Error('That room code is taken. Try again.'));
      else if (e.type === 'peer-unavailable') reject(new Error('No room with that code.'));
      else reject(new Error('Connection failed.'));
    });
    peer.on('open', () => {
      clearTimeout(timer);
      if (host) {
        peer.on('connection', (c) => link.attach(c as unknown as PeerConn));
        resolve(link);
      } else {
        const c = peer.connect(id, { reliable: false, serialization: 'json' }) as unknown as PeerConn;
        c.on('open', () => {
          link.attach(c);
          resolve(link);
        });
      }
    });
  });
}

/** Every route at once: sends on all of them and hears whichever brings news first. */
class MultiLink implements Link {
  private readonly links: Link[] = [];
  get kind(): string {
    return this.links.map((l) => l.kind).join(' + ') || 'none';
  }
  add(l: Link): void {
    this.links.push(l);
  }
  set(p: Presence): void {
    for (const l of this.links) l.set(p);
  }
  other(): Presence | null {
    let best: Link | null = null;
    for (const l of this.links) if (l.other() && (!best || l.quietFor() < best.quietFor())) best = l;
    return best?.other() ?? null;
  }
  quietFor(): number {
    return Math.min(Infinity, ...this.links.map((l) => l.quietFor()));
  }
  close(): void {
    for (const l of this.links) l.close();
    this.links.length = 0;
  }
}

/** The page room, only if this viewer is actually admitted (it connects within a few seconds). */
async function roomLink(code: string): Promise<Link> {
  const api = await roomApi();
  if (!api) throw new Error('no room');
  const room = await api.join(`afterhours-${code.toLowerCase()}`);
  if (!room.connected()) {
    const ok = await new Promise<boolean>((res) => {
      const timer = setTimeout(() => {
        off();
        res(false);
      }, 5000);
      const off = room.onConnection((c) => {
        if (!c) return;
        clearTimeout(timer);
        off();
        res(true);
      });
    });
    if (!ok) {
      room.leave().catch(() => undefined);
      throw new Error('not admitted to the room');
    }
  }
  return new RoomLink(room);
}

/**
 * Open the link for a room code. `host`: the side that made the code. Resolves as soon as one route
 * is up; the other keeps trying and joins in when it connects.
 */
export async function openLink(code: string, host: boolean): Promise<Link> {
  if (new URLSearchParams(location.search).get('net') === 'local') return new LocalLink(code);
  const multi = new MultiLink();
  const errors: string[] = [];
  let pending = 2;
  return new Promise<Link>((resolve, reject) => {
    let done = false;
    const up = (l: Link): void => {
      multi.add(l);
      if (!done) {
        done = true;
        resolve(multi);
      }
    };
    const failed = (e: unknown): void => {
      errors.push((e as Error)?.message ?? String(e));
      pending -= 1;
      if (pending === 0 && !done) reject(new Error(errors.find((m) => m !== 'no room' && m !== 'not admitted to the room') ?? 'Could not connect.'));
    };
    roomLink(code).then(up, failed);
    peerLink(code, host).then(up, failed);
  });
}
