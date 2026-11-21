// Phones as controllers: the TV page hosts a room, each phone connects to it over every route at
// once: a direct WebRTC link (fastest; when the network lets it open), a relay through the public
// PeerJS broker, and free public MQTT brokers (other providers, for when PeerJS is out of reach).
// `?net=local` uses a BroadcastChannel instead, so tabs of one browser can try it.
//
// Messages are small JSON objects. The data channel is reliable but unordered (no message waits
// behind a lost one); the phone numbers its input messages so the TV can ignore stale ones.

import { Mqtt } from './mqtt';

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
  // The build stamp makes the address new for every release, so phones never open a cached old page.
  return `${base}?pad=${code}&b=${__BUILD__}${local() ? '&net=local' : ''}`;
}

// ---------- the broker ----------

const RELAY_PREFIX = 'afterhours-tvr-';

/** Testing against a local PeerJS server: `?broker=localhost:9000`. */
function broker(): { host: string; port: number; secure: boolean; path: string } | null {
  const b = new URLSearchParams(location.search).get('broker');
  if (!b) return null;
  const [host, port] = b.split(':');
  return { host, port: Number(port) || 9000, secure: false, path: '/' };
}

/** Testing one route on its own: `?route=relay` or `?route=direct`. */
const onlyRoute = (): string => new URLSearchParams(location.search).get('route') ?? '';

function rid(): string {
  return Math.random().toString(36).slice(2, 12);
}

/**
 * A relay through the broker: both ends keep a WebSocket to it and pass their messages as the
 * broker's "candidate" messages, which it forwards to the id named. Every message goes via the
 * broker, so it is a little slower than a direct link, but it works wherever the broker can be
 * reached: phones on mobile data, guest Wi-Fi that keeps devices apart, strict routers. This is
 * what makes joining reliable; the direct link takes over whenever it manages to open.
 */
class Relay {
  private ws: WebSocket | null = null;
  private beat = 0;
  private readonly handlers: Array<(src: string, m: Record<string, unknown>) => void> = [];
  private readonly expired: Array<(dst: string) => void> = [];
  private readonly closers: Array<() => void> = [];
  closed = false;

  private constructor(readonly id: string) {}

  static open(id: string, waitMs = 10000): Promise<Relay> {
    const r = new Relay(id);
    const b = broker();
    const url = `${b ? `ws://${b.host}:${b.port}` : 'wss://0.peerjs.com'}/peerjs?key=peerjs&id=${encodeURIComponent(id)}&token=${rid()}&version=1.5.5`;
    return new Promise<Relay>((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        reject(new Error('no relay'));
        return;
      }
      r.ws = ws;
      let opened = false;
      const timer = setTimeout(() => {
        if (opened) return;
        ws.close();
        reject(new Error('timeout'));
      }, waitMs);
      ws.onmessage = (e: MessageEvent) => {
        let m: { type?: string; src?: string; payload?: { ah?: number; m?: Record<string, unknown> } };
        try {
          m = JSON.parse(String(e.data));
        } catch {
          return;
        }
        if (m.type === 'OPEN') {
          opened = true;
          clearTimeout(timer);
          r.beat = window.setInterval(() => r.raw({ type: 'HEARTBEAT' }), 5000);
          resolve(r);
        } else if (m.type === 'ID-TAKEN' || m.type === 'INVALID-KEY' || m.type === 'ERROR') {
          if (!opened) {
            clearTimeout(timer);
            ws.close();
            reject(new Error(m.type === 'ID-TAKEN' ? 'taken' : 'error'));
          }
        } else if (m.type === 'EXPIRE' && m.src) {
          for (const f of r.expired) f(m.src);
        } else if (m.type === 'CANDIDATE' && m.src && m.payload?.ah === 1 && m.payload.m && typeof m.payload.m === 'object') {
          for (const f of r.handlers) f(m.src, m.payload.m);
        }
      };
      ws.onclose = () => {
        clearTimeout(timer);
        if (!opened) reject(new Error('closed'));
        r.end();
      };
      ws.onerror = () => undefined;
    });
  }

  private raw(o: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(o));
  }

  send(dst: string, m: unknown): void {
    this.raw({ type: 'CANDIDATE', dst, payload: { ah: 1, m } });
  }

  onMessage(f: (src: string, m: Record<string, unknown>) => void): void {
    this.handlers.push(f);
  }

  /** The broker could not deliver to this id (nobody there). */
  onExpire(f: (dst: string) => void): void {
    this.expired.push(f);
  }

  onClose(f: () => void): void {
    this.closers.push(f);
  }

  private end(): void {
    if (this.closed) return;
    this.closed = true;
    window.clearInterval(this.beat);
    for (const f of this.closers) f();
  }

  close(): void {
    this.ws?.close();
    this.end();
  }
}

/** The TV's end of the relay: each phone that writes to it becomes a connection. */
function relayHost(code: string, listeners: Array<(c: PadConn) => void>): { up(): boolean; close(): void } {
  const id = `${RELAY_PREFIX}${code.toLowerCase()}`;
  let relay: Relay | null = null;
  let stopped = false;
  const conns = new Map<string, { deliver(m: Record<string, unknown>): void; end(): void }>();
  const connect = async (): Promise<void> => {
    if (stopped) return;
    try {
      const r = await Relay.open(id);
      if (stopped) {
        r.close();
        return;
      }
      relay = r;
      r.onMessage((src, m) => {
        // A phone checking that the TV is here.
        if (m.__probe === 1) {
          r.send(src, { __probe: 2 });
          return;
        }
        let c = conns.get(src);
        if (!c) {
          const data: Array<(m: Record<string, unknown>) => void> = [];
          const closed: Array<() => void> = [];
          let done = false;
          const end = (): void => {
            if (done) return;
            done = true;
            conns.delete(src);
            for (const f of closed) f();
          };
          const pc: PadConn = {
            send: (msg) => {
              if (!done) relay?.send(src, msg);
            },
            onData: (f) => void data.push(f),
            onClose: (f) => void closed.push(f),
            // Just forget this phone's relay: it may still be using it for another route's sake.
            close: end,
          };
          c = { deliver: (msg) => data.forEach((f) => f(msg)), end };
          conns.set(src, c);
          for (const f of listeners) f(pc);
        }
        c.deliver(m);
      });
      r.onClose(() => {
        relay = null;
        for (const c of [...conns.values()]) c.end();
        if (!stopped) window.setTimeout(() => void connect(), 2000);
      });
    } catch {
      // The broker is out of reach, or our id is still held by a page that just closed.
      if (!stopped) window.setTimeout(() => void connect(), 3000);
    }
  };
  void connect();
  return {
    up: () => relay !== null && !relay.closed,
    close: () => {
      stopped = true;
      relay?.close();
    },
  };
}

// ---------- direct links (WebRTC through PeerJS) ----------

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

// ---------- backup: public MQTT brokers ----------

/**
 * Free public MQTT brokers, from different providers. The TV listens on all of them; a phone
 * knocks on all of them and uses the first where the TV answers. They carry the game whenever the
 * PeerJS broker cannot be reached. `?mqtt=ws://host:port` (comma separated) for testing.
 */
function mqttBrokers(): string[] {
  const t = new URLSearchParams(location.search).get('mqtt');
  if (t) return t.split(',').filter(Boolean);
  return ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
}

const topicBase = (code: string): string => `afterhours-pad/v1/${code.toLowerCase()}`;

/** The TV's end on every MQTT broker: each phone that writes to it becomes a connection. */
function mqttHost(code: string, listeners: Array<(c: PadConn) => void>): { up(): boolean; close(): void } {
  const base = topicBase(code);
  let stopped = false;
  const live = new Set<Mqtt>();
  const conns = new Map<string, { deliver(m: Record<string, unknown>): void; end(): void }>();
  const start = async (url: string): Promise<void> => {
    if (stopped) return;
    let mq: Mqtt;
    try {
      mq = await Mqtt.connect(url);
    } catch {
      if (!stopped) window.setTimeout(() => void start(url), 6000);
      return;
    }
    if (stopped) {
      mq.close();
      return;
    }
    live.add(mq);
    mq.subscribe(`${base}/tv`);
    mq.onMessage((_topic, payload) => {
      let msg: { f?: string; m?: Record<string, unknown> };
      try {
        msg = JSON.parse(payload);
      } catch {
        return;
      }
      const from = typeof msg.f === 'string' ? msg.f.slice(0, 40) : '';
      const m = msg.m;
      if (!from || !m || typeof m !== 'object') return;
      const to = `${base}/p/${from}`;
      if (m.__probe === 1) {
        mq.publish(to, JSON.stringify({ m: { __probe: 2 } }));
        return;
      }
      const key = `${url}|${from}`;
      let c = conns.get(key);
      if (!c) {
        const data: Array<(m: Record<string, unknown>) => void> = [];
        const closed: Array<() => void> = [];
        let done = false;
        const end = (): void => {
          if (done) return;
          done = true;
          conns.delete(key);
          for (const f of closed) f();
        };
        const pc: PadConn = {
          send: (out) => {
            if (!done && !mq.closed) mq.publish(to, JSON.stringify({ m: out }));
          },
          onData: (f) => void data.push(f),
          onClose: (f) => void closed.push(f),
          close: end,
        };
        c = { deliver: (x) => data.forEach((f) => f(x)), end };
        conns.set(key, c);
        for (const f of listeners) f(pc);
      }
      c.deliver(m);
    });
    mq.onClose(() => {
      live.delete(mq);
      for (const [key, c] of [...conns.entries()]) if (key.startsWith(`${url}|`)) c.end();
      if (!stopped) window.setTimeout(() => void start(url), 3000);
    });
  };
  for (const url of mqttBrokers()) void start(url);
  return {
    up: () => live.size > 0,
    close: () => {
      stopped = true;
      for (const mq of live) mq.close();
    },
  };
}

// ---------- the TV's room ----------

/** Try to take this code on the PeerJS broker: the peer, 'taken', or null (broker out of reach). */
async function peerFor(code: string, waitMs: number): Promise<{ destroy(): void; disconnected: boolean; destroyed: boolean; reconnect(): void; on(ev: string, f: (...a: unknown[]) => void): void } | 'taken' | null> {
  const { Peer } = await import('peerjs');
  const peer = new Peer(`${PREFIX}${code.toLowerCase()}`, broker() ?? {});
  const ok = await new Promise<string>((res) => {
    const timer = setTimeout(() => res('timeout'), waitMs);
    peer.once('open', () => {
      clearTimeout(timer);
      res('ok');
    });
    peer.once('error', (e: { type?: string }) => {
      clearTimeout(timer);
      res(e.type === 'unavailable-id' ? 'taken' : 'error');
    });
  });
  if (ok === 'ok') return peer as never;
  peer.destroy();
  return ok === 'taken' ? 'taken' : null;
}

async function peerServer(): Promise<PadServer> {
  const listeners: Array<(c: PadConn) => void> = [];
  const last = savedCode();
  let code = last.length === 4 ? last : padCode();
  // The PeerJS broker (direct links and its relay) when it can be reached; it also makes sure
  // nobody else holds this code. If it is out of reach, the MQTT brokers carry everything.
  let peer: Awaited<ReturnType<typeof peerFor>> = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    peer = await peerFor(code, 7000).catch(() => null);
    if (peer !== 'taken') break;
    code = padCode();
  }
  if (peer === 'taken') peer = null;
  savedCode(code);
  const mqtt = mqttHost(code, listeners);
  let relay: { up(): boolean; close(): void } | null = null;
  let peerUp = false;
  let stopped = false;
  const adopt = (p: NonNullable<Exclude<typeof peer, 'taken'>>): void => {
    peerUp = true;
    p.on('connection', (c: unknown) => {
      const dc = c as PeerDataConn;
      const ready = (): void => {
        const pc = wrap(dc);
        for (const f of listeners) f(pc);
      };
      if (dc.open) ready();
      else dc.on('open', ready);
    });
    // Losing the broker only stops new phones from finding the TV this way: keep asking back in.
    p.on('disconnected', () => {
      peerUp = false;
      const retry = (): void => {
        if (p.destroyed || stopped) return;
        if (!p.disconnected) {
          peerUp = true;
          return;
        }
        try {
          p.reconnect();
        } catch {
          // Tried again below.
        }
        setTimeout(retry, 3000);
      };
      setTimeout(retry, 1000);
    });
    p.on('open', () => {
      peerUp = true;
    });
    p.on('error', () => undefined);
    relay = relayHost(code, listeners);
  };
  if (peer) adopt(peer);
  else {
    // Keep trying the PeerJS broker in the background; it is faster when it comes back.
    const again = async (): Promise<void> => {
      if (stopped || peerUp) return;
      const p = await peerFor(code, 7000).catch(() => null);
      if (p && p !== 'taken') {
        if (stopped) p.destroy();
        else {
          peer = p;
          adopt(p);
        }
      } else if (!stopped) setTimeout(() => void again(), 20000);
    };
    setTimeout(() => void again(), 20000);
  }
  // Open once any route is up.
  const t0 = Date.now();
  while (!peerUp && !mqtt.up() && Date.now() - t0 < 10000) await new Promise((r) => setTimeout(r, 200));
  if (!peerUp && !mqtt.up()) {
    stopped = true;
    mqtt.close();
    throw new Error('Could not reach any connection service. Check the laptop is online, then try again.');
  }
  return {
    code,
    onConnection: (f) => void listeners.push(f),
    online: () => peerUp || mqtt.up() || (relay?.up() ?? false),
    close: () => {
      stopped = true;
      mqtt.close();
      relay?.close();
      if (peer && peer !== 'taken') peer.destroy();
    },
  };
}

/**
 * A phone's link to the TV over every route at once: the direct link (fastest, when the network
 * lets it open), the PeerJS relay, and the MQTT brokers. Messages go over the best route open;
 * the phone's greeting is sent again whenever the route changes, so the TV follows it.
 */
type Route = 'direct' | 'relay' | 'mqtt';
const ROUTE_ORDER: Route[] = ['direct', 'relay', 'mqtt'];

class Routes implements PadConn {
  private readonly routes = new Map<Route, { send(m: unknown): void; close(): void }>();
  private readonly data: Array<(m: Record<string, unknown>) => void> = [];
  private readonly closed: Array<() => void> = [];
  private done = false;
  private hi: unknown = null;
  private using = '';

  add(kind: Route, r: { send(m: unknown): void; close(): void }): void {
    if (this.done) {
      r.close();
      return;
    }
    const old = this.routes.get(kind);
    this.routes.set(kind, r);
    if (old && old !== r) old.close();
    this.pick();
  }

  /** A route has closed: forget it, if it is still the one in use for its kind. */
  drop(kind: Route, r?: { send(m: unknown): void; close(): void }): void {
    if (r && this.routes.get(kind) !== r) return;
    if (!this.routes.delete(kind)) return;
    if (this.routes.size === 0) this.end();
    else this.pick();
  }

  private best(): { send(m: unknown): void } | null {
    for (const k of ROUTE_ORDER) {
      const r = this.routes.get(k);
      if (r) return r;
    }
    return null;
  }

  private pick(): void {
    const k = ROUTE_ORDER.find((r) => this.routes.has(r)) ?? '';
    if (k === this.using) return;
    const was = this.using;
    this.using = k;
    if (was && this.hi) this.best()?.send(this.hi);
  }

  deliver(m: Record<string, unknown>): void {
    for (const f of this.data) f(m);
  }

  send(m: unknown): void {
    if (m && typeof m === 'object' && (m as { t?: unknown }).t === 'hi') this.hi = m;
    this.best()?.send(m);
  }

  onData(f: (m: Record<string, unknown>) => void): void {
    this.data.push(f);
  }

  onClose(f: () => void): void {
    this.closed.push(f);
  }

  private end(): void {
    if (this.done) return;
    this.done = true;
    for (const f of this.closed) f();
  }

  close(): void {
    const all = [...this.routes.values()];
    this.routes.clear();
    this.end();
    for (const r of all) r.close();
  }
}

async function peerConnect(code: string, waitMs: number): Promise<PadConn> {
  const link = new Routes();
  const only = onlyRoute();
  const kinds = (['relay', 'direct', 'mqtt'] as const).filter((k) => !only || only === k);
  return new Promise<PadConn>((resolve, reject) => {
    let settled = false;
    let failures = 0;
    let reason = '';
    let reachedService = false;
    const fail = (msg: string): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      link.close();
      reject(new Error(msg));
    };
    const timer = setTimeout(
      () =>
        fail(
          reason ||
            (reachedService
              ? 'Online, but the TV did not answer. On the laptop: reload the game page, open PHONE PARTY, check the code.'
              : 'No answer from the TV. Check the code on the TV screen, and that the TV is on the PHONE PARTY screen.'),
        ),
      waitMs,
    );
    const up = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(link);
    };
    const failed = (): void => {
      failures += 1;
      if (failures >= kinds.length) {
        fail(reason || (reachedService ? 'Online, but the TV did not answer. On the laptop: reload the game page and open PHONE PARTY.' : 'Could not reach any connection service. Check this phone is online (Wi-Fi or mobile data).'));
      }
    };

    if (kinds.includes('mqtt')) {
      // Knock on every MQTT broker; the first where the TV answers carries the link.
      const me = `p${rid()}`;
      const base = topicBase(code);
      const urls = mqttBrokers();
      let pending = urls.length;
      let won = false;
      const lose = (): void => {
        pending -= 1;
        if (pending === 0 && !won) failed();
      };
      for (const url of urls) {
        Mqtt.connect(url).then(
          (mq) => {
            reachedService = true;
            mq.subscribe(`${base}/p/${me}`);
            const send = (m: unknown): void => mq.publish(`${base}/tv`, JSON.stringify({ f: me, m }));
            let confirmed = false;
            /** This broker is the one carrying the link (the others are closed when they answer). */
            let mine = false;
            const route = { send, close: () => mq.close() };
            const knock = (): void => send({ __probe: 1 });
            // The subscription settles first, then knock until the TV answers.
            const knocking = window.setInterval(knock, 1500);
            window.setTimeout(knock, 150);
            mq.onMessage((_t, payload) => {
              let msg: { m?: Record<string, unknown> };
              try {
                msg = JSON.parse(payload);
              } catch {
                return;
              }
              const m = msg.m;
              if (!m || typeof m !== 'object') return;
              if (m.__probe === 2) {
                if (confirmed) return;
                confirmed = true;
                window.clearInterval(knocking);
                if (won) {
                  // Another broker got there first.
                  mq.close();
                  return;
                }
                won = true;
                mine = true;
                link.add('mqtt', route);
                up();
                return;
              }
              if (mine) link.deliver(m);
            });
            mq.onClose(() => {
              window.clearInterval(knocking);
              if (mine) link.drop('mqtt', route);
              else if (!confirmed) lose();
            });
            window.setTimeout(() => {
              if (!confirmed) {
                window.clearInterval(knocking);
                mq.close();
              }
            }, waitMs);
          },
          () => lose(),
        );
      }
    }

    if (kinds.includes('relay')) {
      Relay.open(`afterhours-p-${rid()}`, 7000).then(
        (relay) => {
          reachedService = true;
          const tv = `${RELAY_PREFIX}${code.toLowerCase()}`;
          let confirmed = false;
          const relayRoute = { send: (msg: unknown) => relay.send(tv, msg), close: () => relay.close() };
          // Knock until the TV answers (the first knock can race the TV's own connection).
          const knock = (): void => relay.send(tv, { __probe: 1 });
          knock();
          const knocking = window.setInterval(knock, 1500);
          relay.onMessage((src, m) => {
            if (src !== tv) return;
            if (m.__probe === 2) {
              if (confirmed) return;
              confirmed = true;
              window.clearInterval(knocking);
              link.add('relay', relayRoute);
              up();
              return;
            }
            link.deliver(m);
          });
          relay.onClose(() => {
            window.clearInterval(knocking);
            if (confirmed) link.drop('relay', relayRoute);
            else failed();
          });
          // Never answered: give up on this route (another may still come through).
          window.setTimeout(() => {
            if (!confirmed) {
              window.clearInterval(knocking);
              relay.close();
            }
          }, waitMs);
        },
        () => failed(),
      );
    }

    if (kinds.includes('direct')) {
      void import('peerjs').then(({ Peer }) => {
        const peer = new Peer(broker() ?? {});
        let opened = false;
        let gaveUp = false;
        const giveUp = (): void => {
          if (opened || gaveUp) return;
          gaveUp = true;
          peer.destroy();
          failed();
        };
        peer.on('error', () => giveUp());
        peer.on('open', () => {
          reachedService = true;
          const dc = peer.connect(`${PREFIX}${code.toLowerCase()}`, { reliable: false, serialization: 'json' }) as unknown as PeerDataConn;
          dc.on('open', () => {
            if (opened || gaveUp) return;
            opened = true;
            // Linked: the broker is not needed for this route any more.
            peer.disconnect();
            const pc = wrap(dc);
            const directRoute = { send: (m: unknown) => pc.send(m), close: () => pc.close() };
            pc.onData((m) => link.deliver(m));
            pc.onClose(() => {
              link.drop('direct', directRoute);
              peer.destroy();
            });
            link.add('direct', directRoute);
            up();
          });
        });
        // A direct link that has not opened in this long will not: stop trying.
        window.setTimeout(giveUp, Math.max(waitMs, 20000));
      }, () => failed());
    }
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
