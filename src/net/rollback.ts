// Rollback netcode. Each side runs the whole match itself; the only thing sent is each player's
// input bits. A missing remote input is predicted (the last one known); when the real one arrives
// and differs, the match is rewound to that frame and re-run with the truth. `step` is a pure
// function of (state, inputs), so the re-run lands exactly where the other side is.
//
// No Phaser here: the fight scene drives it once per tick and draws `state`.
import { hashState, step, type GameState } from '../sim';

/** Local inputs are played this many frames after they are pressed, which hides most lag. */
export const INPUT_DELAY = 2;
/** How far ahead of the last confirmed remote input we may run before waiting. */
export const MAX_ROLLBACK = 10;
/** Inputs sent per message: older ones repeat, so a dropped message costs nothing. */
const WINDOW = 40;
/** Frames between desync checks. */
const CHECK_EVERY = 60;

/** What one side sends, every tick (it is absolute: the newest one replaces the last). */
export interface NetFrame {
  /** Frame of the newest local input in `i`. */
  f: number;
  /** Local inputs for frames f - len + 1 .. f, two hex digits each. */
  i: string;
  /** The sender's current frame, and how far it was running ahead of us, for time sync. */
  n: number;
  l: number;
  /** A confirmed frame and the state hash there, to catch a desync. */
  hf: number;
  h: string;
}

export class Rollback {
  /** Frames simulated so far: `state` is the state before frame `frame`. */
  frame = 0;
  state: GameState;
  /** Highest frame for which every remote input up to it is known. */
  confirmed = INPUT_DELAY - 1;
  rollbacks = 0;
  /** Set once both sides disagree about a confirmed state. */
  desynced = false;
  private readonly states = new Map<number, GameState>();
  private readonly local: number[] = [];
  private readonly remote: number[] = [];
  private readonly used: number[] = [];
  private mismatch = -1;
  private remoteFrame = 0;
  private remoteLead = 0;
  private readonly hashes = new Map<number, string>();
  private theirHash: { f: number; h: string } | null = null;
  /** Every input played, both players, for replays: [p1, p2] per frame. */
  readonly log: Array<[number, number]> = [];

  constructor(
    initial: GameState,
    /** Which player this side controls. */
    readonly me: 0 | 1,
  ) {
    this.state = initial;
    this.states.set(0, initial);
    for (let f = 0; f < INPUT_DELAY; f += 1) {
      this.local[f] = 0;
      this.remote[f] = 0;
    }
  }

  /** Queue this tick's local input; it plays INPUT_DELAY frames from now. */
  addLocal(bits: number): void {
    const f = this.frame + INPUT_DELAY;
    if (this.local[f] === undefined) this.local[f] = bits & 0xff;
  }

  /** The message to send now. */
  outgoing(): NetFrame {
    const top = this.local.length - 1;
    const from = Math.max(0, top - WINDOW + 1);
    let i = '';
    for (let f = from; f <= top; f += 1) i += (this.local[f] ?? 0).toString(16).padStart(2, '0');
    let hf = -1;
    let h = '';
    for (const [k, v] of this.hashes) {
      if (k > hf) {
        hf = k;
        h = v;
      }
    }
    return { f: top, i, n: this.frame, l: this.frame - this.remoteFrame, hf, h };
  }

  /** Take the other side's latest message. */
  receive(m: NetFrame): void {
    if (typeof m?.f !== 'number' || typeof m.i !== 'string') return;
    const len = m.i.length >> 1;
    const from = m.f - len + 1;
    for (let k = 0; k < len; k += 1) {
      const f = from + k;
      if (f < 0 || this.remote[f] !== undefined) continue;
      const bits = parseInt(m.i.slice(k * 2, k * 2 + 2), 16) & 0xff;
      this.remote[f] = bits;
      if (f < this.frame && this.used[f] !== bits && (this.mismatch < 0 || f < this.mismatch)) this.mismatch = f;
    }
    while (this.remote[this.confirmed + 1] !== undefined) this.confirmed += 1;
    if (m.n > this.remoteFrame) {
      this.remoteFrame = m.n;
      this.remoteLead = m.l;
    }
    if (m.hf >= 0) this.theirHash = { f: m.hf, h: m.h };
    this.checkHash();
  }

  /** Whether this side may simulate another frame now (false: too far ahead of the remote inputs). */
  canAdvance(): boolean {
    return this.frame - this.confirmed <= MAX_ROLLBACK;
  }

  /**
   * Time sync: when this side runs ahead of the other (it has been simulating sooner), skip a
   * tick now and then so the two clocks meet.
   */
  shouldWait(): boolean {
    const mine = this.frame - this.remoteFrame;
    const advantage = (mine - this.remoteLead) >> 1;
    return advantage >= 2 && this.frame % 6 === 0;
  }

  private predict(f: number): number {
    const r = this.remote[f];
    if (r !== undefined) return r;
    return this.remote[this.confirmed] ?? 0;
  }

  private run(s: GameState, f: number): GameState {
    const mine = this.local[f] ?? 0;
    const theirs = this.predict(f);
    this.used[f] = theirs;
    const pair: [number, number] = this.me === 0 ? [mine, theirs] : [theirs, mine];
    this.log[f] = pair;
    return step(s, pair[0], pair[1]);
  }

  /**
   * Rewind and re-run if a prediction was wrong (no effects: the caller only sees the result),
   * then step one new frame. Returns the visible step, for sound and effects.
   */
  advance(): { prev: GameState; next: GameState } {
    if (this.mismatch >= 0) {
      let s = this.states.get(this.mismatch);
      if (s) {
        this.rollbacks += 1;
        for (let f = this.mismatch; f < this.frame; f += 1) {
          s = this.run(s, f);
          this.states.set(f + 1, s);
        }
        this.state = s;
      }
      this.mismatch = -1;
    }
    const prev = this.state;
    const next = this.run(prev, this.frame);
    this.frame += 1;
    this.state = next;
    this.states.set(this.frame, next);
    // Only frames after the confirmed one can still be rewound to: drop the older ones.
    const keep = Math.min(this.confirmed + 1, this.frame);
    for (const k of this.states.keys()) if (k < keep) this.states.delete(k);
    // A frame whose inputs are all known is final: hash it now and then for the desync check.
    const done = Math.min(this.confirmed + 1, this.frame);
    if (done > 0 && done % CHECK_EVERY === 0 && !this.hashes.has(done)) {
      const st = this.states.get(done);
      if (st && this.mismatch < 0) {
        this.hashes.set(done, hashState(st));
        for (const k of this.hashes.keys()) if (k < done - CHECK_EVERY * 4) this.hashes.delete(k);
        this.checkHash();
      }
    }
    return { prev, next };
  }

  private checkHash(): void {
    if (!this.theirHash) return;
    const mine = this.hashes.get(this.theirHash.f);
    if (mine !== undefined && mine !== this.theirHash.h) this.desynced = true;
  }
}
