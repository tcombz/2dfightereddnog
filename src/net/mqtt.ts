// A minimal MQTT 3.1.1 client over WebSocket: connect, subscribe, publish (QoS 0), keep-alive.
// Enough to pass small JSON messages through the free public MQTT brokers, which the phone
// controllers use as a backup route to the TV when the PeerJS broker cannot be reached.

const enc = new TextEncoder();
const dec = new TextDecoder();

function str(s: string): number[] {
  const b = enc.encode(s);
  return [b.length >> 8, b.length & 255, ...b];
}

function packet(type: number, body: number[] | Uint8Array): Uint8Array {
  const len: number[] = [];
  let n = body.length;
  do {
    let d = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) d |= 128;
    len.push(d);
  } while (n > 0);
  const out = new Uint8Array(1 + len.length + body.length);
  out[0] = type;
  out.set(len, 1);
  out.set(body, 1 + len.length);
  return out;
}

export class Mqtt {
  private ws: WebSocket | null = null;
  private buf = new Uint8Array(0);
  private ping = 0;
  private pid = 1;
  private readonly handlers: Array<(topic: string, payload: string) => void> = [];
  private readonly closers: Array<() => void> = [];
  closed = false;

  private constructor(readonly url: string) {}

  static connect(url: string, waitMs = 8000): Promise<Mqtt> {
    const c = new Mqtt(url);
    return new Promise<Mqtt>((resolve, reject) => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(url, 'mqtt');
      } catch {
        reject(new Error('no socket'));
        return;
      }
      ws.binaryType = 'arraybuffer';
      c.ws = ws;
      let ready = false;
      const timer = setTimeout(() => {
        if (ready) return;
        ws.close();
        reject(new Error('timeout'));
      }, waitMs);
      ws.onopen = () => {
        const id = `ah${Math.random().toString(36).slice(2, 12)}`;
        // Protocol "MQTT" level 4, clean session, keep-alive 30 s.
        ws.send(packet(0x10, [...str('MQTT'), 4, 0x02, 0, 30, ...str(id)]));
      };
      ws.onmessage = (e: MessageEvent) => {
        c.take(new Uint8Array(e.data as ArrayBuffer), (rc) => {
          if (ready) return;
          ready = true;
          clearTimeout(timer);
          if (rc !== 0) {
            ws.close();
            reject(new Error(`refused ${rc}`));
            return;
          }
          c.ping = window.setInterval(() => c.raw(new Uint8Array([0xc0, 0])), 20000);
          resolve(c);
        });
      };
      ws.onclose = () => {
        clearTimeout(timer);
        if (!ready) reject(new Error('closed'));
        c.end();
      };
      ws.onerror = () => undefined;
    });
  }

  /** Read whole packets out of the bytes received so far. */
  private take(bytes: Uint8Array, connack: (rc: number) => void): void {
    const all = new Uint8Array(this.buf.length + bytes.length);
    all.set(this.buf);
    all.set(bytes, this.buf.length);
    let p = 0;
    while (p + 2 <= all.length) {
      const type = all[p];
      let len = 0;
      let mul = 1;
      let q = p + 1;
      let complete = false;
      while (q < all.length) {
        const d = all[q];
        len += (d & 127) * mul;
        mul *= 128;
        q += 1;
        if ((d & 128) === 0) {
          complete = true;
          break;
        }
      }
      if (!complete || q + len > all.length) break;
      const body = all.subarray(q, q + len);
      const kind = type & 0xf0;
      if (kind === 0x20) connack(body[1] ?? 255);
      else if (kind === 0x30) {
        const qos = (type >> 1) & 3;
        const tl = (body[0] << 8) | body[1];
        const topic = dec.decode(body.subarray(2, 2 + tl));
        const start = 2 + tl + (qos > 0 ? 2 : 0);
        const payload = dec.decode(body.subarray(start));
        for (const f of this.handlers) f(topic, payload);
      }
      p = q + len;
    }
    this.buf = all.slice(p);
  }

  private raw(b: Uint8Array): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(b);
  }

  subscribe(topic: string): void {
    const id = this.pid++ & 0xffff || 1;
    this.raw(packet(0x82, [id >> 8, id & 255, ...str(topic), 0]));
  }

  publish(topic: string, payload: string): void {
    const t = str(topic);
    const p = enc.encode(payload);
    const body = new Uint8Array(t.length + p.length);
    body.set(t);
    body.set(p, t.length);
    this.raw(packet(0x30, body));
  }

  onMessage(f: (topic: string, payload: string) => void): void {
    this.handlers.push(f);
  }

  onClose(f: () => void): void {
    this.closers.push(f);
  }

  private end(): void {
    if (this.closed) return;
    this.closed = true;
    window.clearInterval(this.ping);
    for (const f of this.closers) f();
  }

  close(): void {
    try {
      this.raw(new Uint8Array([0xe0, 0]));
      this.ws?.close();
    } catch {
      // Already gone.
    }
    this.end();
  }
}
