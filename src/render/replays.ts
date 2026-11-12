// Replays. The sim is deterministic, so a whole match is its starting setup plus both players'
// input bits each frame. Inputs are run-length encoded ("hhhh" = p1 p2 in hex, then a base-36
// repeat count), which makes a full match a few kilobytes. The last few matches are kept in this
// browser.

export type InputLog = ArrayLike<readonly [number, number] | undefined>;

export function encodeInputs(log: InputLog, frames = log.length): string {
  const out: string[] = [];
  let prev = -1;
  let run = 0;
  const flush = (): void => {
    if (run > 0) out.push(prev.toString(16).padStart(4, '0') + (run > 1 ? run.toString(36) : '') + '.');
  };
  for (let f = 0; f < frames; f += 1) {
    const p = log[f];
    const v = p ? ((p[0] & 0xff) << 8) | (p[1] & 0xff) : 0;
    if (v === prev) run += 1;
    else {
      flush();
      prev = v;
      run = 1;
    }
  }
  flush();
  return out.join('');
}

export function decodeInputs(s: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const part of s.split('.')) {
    if (part.length < 4) continue;
    const v = parseInt(part.slice(0, 4), 16);
    const n = part.length > 4 ? parseInt(part.slice(4), 36) : 1;
    if (!Number.isFinite(v) || !Number.isFinite(n) || n < 1 || n > 1e6) continue;
    for (let k = 0; k < n; k += 1) out.push([(v >> 8) & 0xff, v & 0xff]);
  }
  return out;
}

export interface SavedReplay {
  at: number;
  p1: number;
  p2: number;
  stage: number;
  simple: [boolean, boolean];
  winner: number;
  wins: [number, number];
  /** How it was played: 'cpu', 'versus', 'online' ... */
  mode: string;
  inputs: string;
}

const KEY = 'afterhours.replays';
const KEEP = 10;

export function savedReplays(): SavedReplay[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as SavedReplay[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && typeof r.inputs === 'string') : [];
  } catch {
    return [];
  }
}

export function saveReplay(r: SavedReplay): void {
  try {
    const list = [r, ...savedReplays()].slice(0, KEEP);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Kept for this visit only (storage full or blocked).
  }
}
