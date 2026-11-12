// Connections between two players' browsers. Every link carries one thing: each side's latest
// "presence", an absolute object (lobby picks plus the newest NetFrame) that replaces the last.
// Dropped or merged messages cost nothing, since the next one says everything again.
//
//  - On the shared claude.ai page: the page's room (no server of our own).
//  - Anywhere else (GitHub Pages, local dev): a direct WebRTC link through the public PeerJS broker.
//  - `?net=local`: two tabs of one browser, for testing.

export type Presence = Record<string, unknown>;

export interface Link {
  readonly kind: 'room' | 'peer' | 'local';
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
  peers(): readonly RoomPeer[];
  onPeers(fn: (c: { peers: readonly RoomPeer[] }) => void): () => void;
  leave(): Promise<void>;
}
interface RoomApi {
  join(name: string): Promise<NamedRoom>;
}

class RoomLink extends Base implements Link {
  readonly kind = 'room' as const;
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
  readonly kind = 'local' as const;
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
  readonly kind = 'peer' as const;
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

/** Open the link for a room code. `host`: the side that made the code. */
export async function openLink(code: string, host: boolean): Promise<Link> {
  if (new URLSearchParams(location.search).get('net') === 'local') return new LocalLink(code);
  const api = await roomApi();
  if (api) {
    try {
      return new RoomLink(await api.join(`afterhours-${code.toLowerCase()}`));
    } catch {
      // Rooms not offered to this viewer: fall through to WebRTC.
    }
  }
  return peerLink(code, host);
}
