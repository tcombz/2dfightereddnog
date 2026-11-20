// Phones as controllers: the TV page hosts a room, each phone connects to it. WebRTC through the
// public PeerJS broker (it only makes the introduction; on one Wi-Fi the data then goes straight
// across the room). `?net=local` uses a BroadcastChannel instead, so tabs of one browser can try it.
//
// Messages are small JSON objects. The data channel is reliable but unordered (no message waits
// behind a lost one); the phone numbers its input messages so the TV can ignore stale ones.

export interface PadConn {
  send(msg: unknown): void;
  onData(fn: (msg: Record<string, unknown>) => void): void;
  onClose(fn: () => void): void;
  close(): void;
}

export interface PadServer {
  readonly code: string;
  onConnection(fn: (c: PadConn) => void): void;
  /** False while the TV has lost the broker (it keeps trying); phones already in stay connected. */
  online(): boolean;
  close(): void;
}

/** No 0/O or 1/I: the code is read off a TV across a room. */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PREFIX = 'afterhours-tv-';
/** Where phones go when this page has no address of its own to share (claude.ai, localhost). */
export const PUBLIC_URL = 'https://tcombz.github.io/2dfightereddnog/';

export function padCode(): string {
  let s = '';
  for (let i = 0; i < 4; i += 1) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

export function cleanPadCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}

const local = (): boolean => new URLSearchParams(location.search).get('net') === 'local';

/** The address a phone opens to join: this site when it has a shareable address, else the public one. */
export function phoneUrl(code: string): string {
  const embedded = !!(window as unknown as { claude?: unknown }).claude || window.top !== window.self;
  const h = location.hostname;
  const shareable = !embedded && location.protocol.startsWith('http') && h !== 'localhost' && h !== '127.0.0.1' && h !== '';
  const base = shareable || local() ? `${location.origin}${location.pathname}` : PUBLIC_URL;
  return `${base}?pad=${code}${local() ? '&net=local' : ''}`;
}

// ---------- PeerJS ----------

interface PeerDataConn {
  open: boolean;
  send(d: unknown): void;
  on(ev: string, fn: (d?: unknown) => void): void;
  close(): void;
}

function wrap(c: PeerDataConn): PadConn {
  const data: Array<(m: Record<string, unknown>) => void> = [];
  const closed: Array<() => void> = [];
  let done = false;
  const end = (): void => {
    if (done) return;
    done = true;
    for (const f of closed) f();
  };
  c.on('data', (d) => {
    if (d && typeof d === 'object') for (const f of data) f(d as Record<string, unknown>);
  });
  c.on('close', end);
  c.on('error', end);
  return {
    send: (m) => {
      if (c.open && !done) {
        try {
          c.send(m);
        } catch {
          end();
        }
      }
    },
    onData: (f) => void data.push(f),
    onClose: (f) => void closed.push(f),
    close: () => {
      end();
      c.close();
    },
  };
}

/** The TV keeps its code across a refresh, so phones that were in find it again by themselves. */
function savedCode(code?: string): string {
  try {
    if (code) localStorage.setItem('afterhours.tvCode', code);
    return cleanPadCode(localStorage.getItem('afterhours.tvCode') ?? '');
  } catch {
    return '';
  }
}

async function peerServer(): Promise<PadServer> {
  const { Peer } = await import('peerjs');
  const last = savedCode();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = attempt === 0 && last.length === 4 ? last : padCode();
    const peer = new Peer(`${PREFIX}${code.toLowerCase()}`);
    const ok = await new Promise<string>((res) => {
      const timer = setTimeout(() => res('timeout'), 12000);
      peer.once('open', () => {
        clearTimeout(timer);
        res('ok');
      });
      peer.once('error', (e: { type?: string }) => {
        clearTimeout(timer);
        res(e.type === 'unavailable-id' ? 'taken' : 'error');
      });
    });
    if (ok === 'taken') {
      peer.destroy();
      continue;
    }
    if (ok !== 'ok') {
      peer.destroy();
      throw new Error('Could not reach the connection service. Check the internet connection and try again.');
    }
    savedCode(code);
    const listeners: Array<(c: PadConn) => void> = [];
    let up = true;
    peer.on('connection', (c) => {
      const dc = c as unknown as PeerDataConn;
      const ready = (): void => {
        const pc = wrap(dc);
        for (const f of listeners) f(pc);
      };
      if (dc.open) ready();
      else dc.on('open', ready);
    });
    // Losing the broker only stops new phones from finding the TV: keep asking to be let back in.
    peer.on('disconnected', () => {
      up = false;
      const retry = (): void => {
        if (peer.destroyed) return;
        if (!peer.disconnected) {
          up = true;
          return;
        }
        try {
          peer.reconnect();
        } catch {
          // Tried again below.
        }
        setTimeout(retry, 3000);
      };
      setTimeout(retry, 1000);
    });
    peer.on('open', () => {
      up = true;
    });
    peer.on('error', () => undefined);
    return {
      code,
      onConnection: (f) => void listeners.push(f),
      online: () => up && !peer.disconnected,
      close: () => peer.destroy(),
    };
  }
  throw new Error('Could not get a room code. Try again.');
}

async function peerConnect(code: string, waitMs: number): Promise<PadConn> {
  const { Peer } = await import('peerjs');
  const peer = new Peer();
  return new Promise<PadConn>((resolve, reject) => {
    let settled = false;
    const fail = (msg: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      peer.destroy();
      reject(new Error(msg));
    };
    const timer = setTimeout(() => fail('No answer from the TV. Check the code on the TV screen.'), waitMs);
    peer.on('error', (e: { type?: string }) => {
      if (e.type === 'peer-unavailable') fail('No game with that code. Check the code on the TV screen.');
      else if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') fail('Could not reach the connection service. Check your internet connection.');
      else fail('Could not connect. Try again.');
    });
    peer.on('open', () => {
      const dc = peer.connect(`${PREFIX}${code.toLowerCase()}`, { reliable: false, serialization: 'json' }) as unknown as PeerDataConn;
      dc.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        // Matched: the broker is not needed any more.
        peer.disconnect();
        const pc = wrap(dc);
        pc.onClose(() => peer.destroy());
        resolve(pc);
      });
    });
  });
}

// ---------- two tabs, one browser ----------

interface LocalMsg {
  from: string;
  to: string;
  kind: 'open' | 'ack' | 'data' | 'close';
  d?: Record<string, unknown>;
}

function localPair(ch: BroadcastChannel, me: string, them: string): PadConn {
  const data: Array<(m: Record<string, unknown>) => void> = [];
  const closed: Array<() => void> = [];
  let done = false;
  const end = (): void => {
    if (done) return;
    done = true;
    for (const f of closed) f();
  };
  ch.addEventListener('message', (e: MessageEvent<LocalMsg>) => {
    const m = e.data;
    if (m?.to !== me || m.from !== them) return;
    if (m.kind === 'data' && m.d) for (const f of data) f(m.d);
    if (m.kind === 'close') end();
  });
  return {
    send: (d) => {
      if (!done) ch.postMessage({ from: me, to: them, kind: 'data', d: d as Record<string, unknown> } satisfies LocalMsg);
    },
    onData: (f) => void data.push(f),
    onClose: (f) => void closed.push(f),
    close: () => {
      if (!done) ch.postMessage({ from: me, to: them, kind: 'close' } satisfies LocalMsg);
      end();
    },
  };
}

function localServer(): PadServer {
  const last = savedCode();
  const code = last.length === 4 ? last : padCode();
  savedCode(code);
  const ch = new BroadcastChannel(`afterhours-pads-${code}`);
  const listeners: Array<(c: PadConn) => void> = [];
  ch.addEventListener('message', (e: MessageEvent<LocalMsg>) => {
    const m = e.data;
    if (m?.to !== 'tv' || m.kind !== 'open') return;
    const pc = localPair(ch, 'tv', m.from);
    ch.postMessage({ from: 'tv', to: m.from, kind: 'ack' } satisfies LocalMsg);
    for (const f of listeners) f(pc);
  });
  return { code, onConnection: (f) => void listeners.push(f), online: () => true, close: () => ch.close() };
}

function localConnect(code: string, waitMs: number): Promise<PadConn> {
  const ch = new BroadcastChannel(`afterhours-pads-${code}`);
  const me = Math.random().toString(36).slice(2);
  return new Promise<PadConn>((resolve, reject) => {
    const timer = setTimeout(() => {
      ch.close();
      reject(new Error('No game with that code. Check the code on the TV screen.'));
    }, waitMs);
    const onAck = (e: MessageEvent<LocalMsg>): void => {
      if (e.data?.to !== me || e.data.kind !== 'ack') return;
      clearTimeout(timer);
      ch.removeEventListener('message', onAck);
      resolve(localPair(ch, me, 'tv'));
    };
    ch.addEventListener('message', onAck);
    ch.postMessage({ from: me, to: 'tv', kind: 'open' } satisfies LocalMsg);
  });
}

/** The TV: open a room and get its code. */
export function openPadServer(): Promise<PadServer> {
  return local() ? Promise.resolve(localServer()) : peerServer();
}

/** A phone: connect to the TV with this code. */
export function connectPad(code: string, waitMs = 15000): Promise<PadConn> {
  return local() ? localConnect(code, waitMs) : peerConnect(code, waitMs);
}
