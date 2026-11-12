// Keyboard and gamepad input for both players. Produces the sim's input bitmask per player and
// edge-triggered menu events. Not part of the sim.
//
// Gamepads: any controller the browser can see, wired or Bluetooth. Each pad gets a player slot
// when it connects (and keeps it until it disconnects). Pads the browser maps as "standard" (Xbox,
// PlayStation, Switch Pro and most modern pads) work straight away; others start from a best guess
// (sticks, d-pad buttons, d-pad axes or a hat switch) and can be remapped on the Controllers screen.
// Remaps are saved per controller name in this browser.
import { Input } from '../sim';

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause';

export interface MenuEvent {
  /** 0 or 1 for a player's own keys or pad, -1 for shared keys (Enter, Escape). */
  player: number;
  action: MenuAction;
}

type Binding = Record<string, number>;

/** What a keyboard key can be bound to: the eight sim buttons, plus one-key throw, super and Heat. */
export type KeyAction = 'up' | 'down' | 'left' | 'right' | 'light' | 'heavy' | 'special' | 'block' | 'throw' | 'super' | 'heat';
export type KeyMap = Record<KeyAction, string[]>;

/** The actions the key settings list, in order, with their labels. */
export const KEY_ACTIONS: Array<[KeyAction, string]> = [
  ['up', 'UP / JUMP'],
  ['down', 'DOWN / CROUCH'],
  ['left', 'LEFT'],
  ['right', 'RIGHT'],
  ['light', 'LIGHT'],
  ['heavy', 'HEAVY'],
  ['special', 'SPECIAL'],
  ['block', 'BLOCK'],
  ['throw', 'THROW (LIGHT + HEAVY)'],
  ['super', 'SUPER (HEAVY + SPECIAL)'],
  ['heat', 'HEAT (LIGHT + SPECIAL)'],
];

const KEY_BIT: Record<KeyAction, number> = {
  up: Input.Up,
  down: Input.Down,
  left: Input.Left,
  right: Input.Right,
  light: Input.Light,
  heavy: Input.Heavy,
  special: Input.Special,
  block: Input.Block,
  throw: Input.Light | Input.Heavy,
  super: Input.Heavy | Input.Special,
  heat: Input.Light | Input.Special,
};

/** Keys the menus own: never bindable. */
const RESERVED = new Set(['Enter', 'NumpadEnter', 'Escape', 'Backspace', 'Tab', 'F1', 'F2', 'F3', 'F4', 'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight']);

/** Player 1: WASD with F G H R, or J K L and Space. Player 2: arrows with U I O P, or the number pad. */
export const DEFAULT_KEYS: [KeyMap, KeyMap] = [
  {
    up: ['KeyW'],
    down: ['KeyS'],
    left: ['KeyA'],
    right: ['KeyD'],
    light: ['KeyF', 'KeyJ'],
    heavy: ['KeyG', 'KeyK'],
    special: ['KeyH', 'KeyL'],
    block: ['KeyR', 'Space'],
    throw: [],
    super: [],
    heat: [],
  },
  {
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    light: ['KeyU', 'Numpad1'],
    heavy: ['KeyI', 'Numpad2'],
    special: ['KeyO', 'Numpad3'],
    block: ['KeyP', 'Numpad0'],
    throw: [],
    super: [],
    heat: [],
  },
];

const KEYS_STORE = 'afterhours.keys';

function copyKeys(k: KeyMap): KeyMap {
  const out = {} as KeyMap;
  for (const [a] of KEY_ACTIONS) out[a] = [...(k[a] ?? [])];
  return out;
}

function loadKeys(): [KeyMap, KeyMap] {
  const maps: [KeyMap, KeyMap] = [copyKeys(DEFAULT_KEYS[0]), copyKeys(DEFAULT_KEYS[1])];
  try {
    const raw = localStorage.getItem(KEYS_STORE);
    const saved = raw ? (JSON.parse(raw) as Array<Partial<KeyMap>>) : null;
    if (Array.isArray(saved)) {
      saved.slice(0, 2).forEach((m, i) => {
        for (const [a] of KEY_ACTIONS) {
          const v = m?.[a];
          if (Array.isArray(v) && v.every((c) => typeof c === 'string')) maps[i][a] = v.filter((c) => !RESERVED.has(c));
        }
      });
    }
  } catch {
    // Defaults apply.
  }
  return maps;
}

function lookupFor(m: KeyMap): Binding {
  const b: Binding = {};
  for (const [a] of KEY_ACTIONS) for (const code of m[a]) b[code] = (b[code] ?? 0) | KEY_BIT[a];
  return b;
}

/** A short label for a key code: KeyF -> F, ArrowLeft -> ←, Numpad1 -> NUM 1. */
export function keyLabel(code: string | undefined): string {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `NUM ${code.slice(6)}`;
  const named: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Space: 'SPACE',
    ShiftLeft: 'L-SHIFT',
    ShiftRight: 'R-SHIFT',
    ControlLeft: 'L-CTRL',
    ControlRight: 'R-CTRL',
    AltLeft: 'L-ALT',
    AltRight: 'R-ALT',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Minus: '-',
    Equal: '=',
    Backquote: '`',
    CapsLock: 'CAPS',
  };
  return named[code] ?? code.toUpperCase();
}

const MENU_FROM_BITS: Array<[number, MenuAction]> = [
  [Input.Up, 'up'],
  [Input.Down, 'down'],
  [Input.Left, 'left'],
  [Input.Right, 'right'],
  [Input.Light, 'confirm'],
  [Input.Heavy, 'back'],
];

// ---------- gamepad mapping ----------

/** Everything a pad can be asked to do. */
export type PadAction = 'up' | 'down' | 'left' | 'right' | 'light' | 'heavy' | 'special' | 'block' | 'throw' | 'super' | 'heat' | 'start';

/** Where an action comes from on a pad: a button, one direction of an axis, or a hat-switch direction. */
export type PadSource =
  | { kind: 'button'; index: number }
  | { kind: 'axis'; index: number; dir: 1 | -1 }
  | { kind: 'hat'; index: number; dirs: number };

export type PadMap = Partial<Record<PadAction, PadSource[]>>;

/** The actions the Controllers screen asks for, in order, with what to tell the player. */
export const REMAP_STEPS: Array<[PadAction, string]> = [
  ['light', 'LIGHT attack'],
  ['heavy', 'HEAVY attack'],
  ['special', 'SPECIAL'],
  ['block', 'BLOCK'],
  ['throw', 'THROW (light + heavy)'],
  ['super', 'SUPER (heavy + special)'],
  ['heat', 'HEAT (light + special)'],
  ['start', 'START / pause'],
  ['up', 'UP on the d-pad'],
  ['down', 'DOWN on the d-pad'],
  ['left', 'LEFT on the d-pad'],
  ['right', 'RIGHT on the d-pad'],
];

const BIT: Record<PadAction, number> = {
  up: Input.Up,
  down: Input.Down,
  left: Input.Left,
  right: Input.Right,
  light: Input.Light,
  heavy: Input.Heavy,
  special: Input.Special,
  block: Input.Block,
  throw: Input.Light | Input.Heavy,
  super: Input.Heavy | Input.Special,
  heat: Input.Light | Input.Special,
  start: 0,
};

const btn = (index: number): PadSource => ({ kind: 'button', index });
const axis = (index: number, dir: 1 | -1): PadSource => ({ kind: 'axis', index, dir });

/** Hat switch bits: up 1, right 2, down 4, left 8. */
const HAT_UP = 1;
const HAT_RIGHT = 2;
const HAT_DOWN = 4;
const HAT_LEFT = 8;
/** A hat axis reports one of 8 positions from -1 (up) clockwise in steps of 2/7, and about 1.29 at rest. */
const HAT_POSITIONS = [HAT_UP, HAT_UP | HAT_RIGHT, HAT_RIGHT, HAT_RIGHT | HAT_DOWN, HAT_DOWN, HAT_DOWN | HAT_LEFT, HAT_LEFT, HAT_LEFT | HAT_UP];

function hatBits(v: number): number {
  if (v < -1.1 || v > 1.1) return 0;
  return HAT_POSITIONS[Math.max(0, Math.min(7, Math.round((v + 1) * 3.5)))];
}

/**
 * The browser's standard layout: A/Cross light, X/Square light, Y/Triangle heavy, B/Circle special,
 * LB/L1 block, LT/L2 Heat, RB/R1 throw, RT/R2 super, Start pause, d-pad and left stick to move.
 */
const STANDARD: PadMap = {
  up: [btn(12), axis(1, -1)],
  down: [btn(13), axis(1, 1)],
  left: [btn(14), axis(0, -1)],
  right: [btn(15), axis(0, 1)],
  light: [btn(0), btn(2)],
  heavy: [btn(3)],
  special: [btn(1)],
  block: [btn(4)],
  heat: [btn(6)],
  throw: [btn(5)],
  super: [btn(7)],
  start: [btn(9)],
};

/** A best guess for a pad the browser could not map: left stick, every way a d-pad can show up. */
function guessMap(p: Gamepad): PadMap {
  const m: PadMap = {
    up: [axis(1, -1)],
    down: [axis(1, 1)],
    left: [axis(0, -1)],
    right: [axis(0, 1)],
    light: [btn(0), btn(2)],
    heavy: [btn(3)],
    special: [btn(1)],
    block: [btn(4)],
    heat: [btn(6)],
    throw: [btn(5)],
    super: [btn(7)],
    start: [btn(9)],
  };
  if (p.buttons.length > 15) {
    m.up!.push(btn(12));
    m.down!.push(btn(13));
    m.left!.push(btn(14));
    m.right!.push(btn(15));
  }
  // Many generic pads report the d-pad as a hat switch on axis 9, or as axes 6 and 7.
  if (p.axes.length > 9) {
    for (const [k, bit] of [['up', HAT_UP], ['down', HAT_DOWN], ['left', HAT_LEFT], ['right', HAT_RIGHT]] as Array<[PadAction, number]>) {
      m[k]!.push({ kind: 'hat', index: 9, dirs: bit });
    }
  } else if (p.axes.length >= 8) {
    m.up!.push(axis(7, -1));
    m.down!.push(axis(7, 1));
    m.left!.push(axis(6, -1));
    m.right!.push(axis(6, 1));
  }
  return m;
}

const STORE_KEY = 'afterhours.pads';

function loadMaps(): Record<string, PadMap> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PadMap>) : {};
  } catch {
    return {};
  }
}

/** Which button labels a pad has, from the browser's id string (names and USB vendor ids). */
export type PadFamily = 'xbox' | 'ps' | 'switch' | 'generic';

export function padFamily(p: Gamepad): PadFamily {
  const id = p.id.toLowerCase();
  if (/playstation|dualshock|dualsense|sony|054c|wireless controller/.test(id)) return 'ps';
  if (/nintendo|pro controller|joy-con|057e|switch/.test(id)) return 'switch';
  if (/xbox|xinput|microsoft|045e/.test(id)) return 'xbox';
  // Most other standard-mapped pads (8BitDo, Logitech, PowerA) print Xbox letters.
  return p.mapping === 'standard' ? 'xbox' : 'generic';
}

/** A short readable name for a pad, from the browser's id string. */
export function padName(p: Gamepad | null): string {
  if (!p) return 'none';
  const id = p.id.replace(/\(.*?(Vendor|STANDARD).*?\)/gi, '').replace(/[0-9a-f]{4}-[0-9a-f]{4}-/i, '').trim();
  return (id || 'Controller').slice(0, 40);
}

// ---------- the controls ----------

export class Controls {
  private readonly held = new Set<string>();
  private events: MenuEvent[] = [];
  /** Gamepad index in each player slot (null: no pad). */
  readonly slots: [number | null, number | null] = [null, null];
  private padPrev: [number, number] = [0, 0];
  private menuPrev: [boolean[], boolean[]] = [[false, false, false], [false, false, false]];
  private padBitsNow: [number, number] = [0, 0];
  private maps: Record<string, PadMap> = loadMaps();
  /** While the Controllers screen listens for a button, pads do not drive menus. */
  capturing = false;
  rumbleOn = true;
  /** What each player last pressed something on, so on-screen prompts can show the right buttons. */
  readonly device: ['keys' | 'pad', 'keys' | 'pad'] = ['keys', 'keys'];
  /** The device and player behind the most recent press (shared screens follow whoever touched last). */
  lastDevice: 'keys' | 'pad' = 'keys';
  lastPlayer = 0;
  /** Goes up whenever the above change, so scenes know to redraw their prompts. */
  deviceStamp = 0;
  /** Keyboard bindings per player, and the key-code lookups built from them. */
  private keyMaps: [KeyMap, KeyMap] = loadKeys();
  private lookup: [Binding, Binding] = [lookupFor(this.keyMaps[0]), lookupFor(this.keyMaps[1])];
  /** While set, the next key press goes here (the key settings are listening) instead of the game. */
  private keyCapture: ((code: string | null) => void) | null = null;

  constructor() {
    try {
      this.rumbleOn = localStorage.getItem('afterhours.rumble') !== '0';
    } catch {
      // Defaults apply.
    }
    window.addEventListener('keydown', (e) => {
      // Typing in a text box (party names) is not game input.
      if (e.target instanceof HTMLInputElement) return;
      if (this.keyCapture) {
        e.preventDefault();
        if (e.repeat) return;
        const done = this.keyCapture;
        this.keyCapture = null;
        done(e.code === 'Escape' ? null : RESERVED.has(e.code) ? '' : e.code);
        return;
      }
      const p1 = this.lookup[0][e.code];
      const p2 = this.lookup[1][e.code];
      if (p1 !== undefined || p2 !== undefined || e.code === 'Enter' || e.code === 'Escape' || e.code === 'Backspace') {
        e.preventDefault();
      }
      if (e.repeat) return;
      this.held.add(e.code);
      if (p1 !== undefined) this.use(0, 'keys');
      else if (p2 !== undefined) this.use(1, 'keys');
      else if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Backspace') this.use(this.lastPlayer, 'keys');
      if (p1 !== undefined) this.pushFromBits(0, p1);
      if (p2 !== undefined) this.pushFromBits(1, p2);
      if (e.code === 'Enter' || e.code === 'NumpadEnter') this.events.push({ player: -1, action: 'confirm' });
      if (e.code === 'Escape') this.events.push({ player: -1, action: 'pause' });
      if (e.code === 'Backspace') this.events.push({ player: -1, action: 'back' });
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
    window.addEventListener('gamepadconnected', (e) => this.attach((e as GamepadEvent).gamepad));
    window.addEventListener('gamepaddisconnected', (e) => this.detach((e as GamepadEvent).gamepad));
  }

  private use(player: number, dev: 'keys' | 'pad'): void {
    if (this.device[player] === dev && this.lastDevice === dev && this.lastPlayer === player) return;
    this.device[player] = dev;
    this.lastDevice = dev;
    this.lastPlayer = player;
    this.deviceStamp += 1;
  }

  private pushFromBits(player: number, bits: number): void {
    for (const [bit, action] of MENU_FROM_BITS) if (bits & bit) this.events.push({ player, action });
  }

  private pads(): Array<Gamepad | null> {
    try {
      return typeof navigator.getGamepads === 'function' ? Array.from(navigator.getGamepads()) : [];
    } catch {
      return [];
    }
  }

  /** The pad in a player slot right now, if it is still there. */
  pad(slot: number): Gamepad | null {
    const index = this.slots[slot];
    if (index === null) return null;
    const p = this.pads()[index];
    return p && p.connected ? p : null;
  }

  private attach(p: Gamepad): void {
    if (this.slots.includes(p.index)) return;
    const free = this.slots.indexOf(null);
    if (free < 0) return;
    this.slots[free] = p.index;
    notify(`Player ${free + 1}: ${padName(p)}${p.mapping === 'standard' ? '' : ' (set it up under Controllers if buttons feel wrong)'}`);
    this.rumble(free, 0.5, 120);
  }

  private detach(p: Gamepad): void {
    const slot = this.slots.indexOf(p.index);
    if (slot < 0) return;
    this.slots[slot] = null;
    this.padPrev[slot] = 0;
    this.padBitsNow[slot] = 0;
    notify(`Player ${slot + 1} controller disconnected`);
    this.events.push({ player: slot, action: 'pause' });
  }

  swapSlots(): void {
    const [a, b] = this.slots;
    this.slots[0] = b;
    this.slots[1] = a;
  }

  /** The mapping in use for a pad: its saved remap, else the standard layout, else a guess. */
  mapFor(p: Gamepad): PadMap {
    return this.maps[p.id] ?? (p.mapping === 'standard' ? STANDARD : guessMap(p));
  }

  hasRemap(p: Gamepad): boolean {
    return this.maps[p.id] !== undefined;
  }

  saveRemap(p: Gamepad, map: PadMap): void {
    this.maps[p.id] = map;
    this.persist();
  }

  clearRemap(p: Gamepad): void {
    delete this.maps[p.id];
    this.persist();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.maps));
    } catch {
      // Not saved; the remap still applies for this visit.
    }
  }

  setRumble(on: boolean): void {
    this.rumbleOn = on;
    try {
      localStorage.setItem('afterhours.rumble', on ? '1' : '0');
    } catch {
      // Applies for this visit.
    }
  }

  /** Is this source pressed on this pad? */
  static active(p: Gamepad, s: PadSource): boolean {
    if (s.kind === 'button') {
      const b = p.buttons[s.index];
      return !!b && (b.pressed || b.value > 0.5);
    }
    const v = p.axes[s.index];
    if (v === undefined) return false;
    if (s.kind === 'hat') return (hatBits(v) & s.dirs) !== 0;
    return s.dir > 0 ? v > 0.5 : v < -0.5;
  }

  private actionOn(p: Gamepad, map: PadMap, a: PadAction): boolean {
    return (map[a] ?? []).some((s) => Controls.active(p, s));
  }

  private padBits(p: Gamepad): number {
    const map = this.mapFor(p);
    let bits = 0;
    for (const a of Object.keys(BIT) as PadAction[]) if (this.actionOn(p, map, a)) bits |= BIT[a];
    // Pressing opposite directions at once (a worn stick, a hat glitch) cancels them.
    if ((bits & (Input.Left | Input.Right)) === (Input.Left | Input.Right)) bits &= ~(Input.Left | Input.Right);
    if ((bits & (Input.Up | Input.Down)) === (Input.Up | Input.Down)) bits &= ~(Input.Up | Input.Down);
    return bits;
  }

  /** Call once per frame before reading: polls gamepads and turns their presses into menu events. */
  poll(): void {
    // Some browsers only report a pad after its first button press, without a connect event.
    for (const p of this.pads()) if (p && p.connected && !this.slots.includes(p.index)) this.attach(p);
    for (let i = 0; i < 2; i += 1) {
      const pad = this.pad(i);
      if (!pad && this.slots[i] !== null) this.slots[i] = null;
      const bits = pad ? this.padBits(pad) : 0;
      if (!this.capturing) {
        // Menus on a pad: stick or d-pad to move, light (A) confirms, special (B) goes back, Start pauses.
        const fresh = bits & ~this.padPrev[i] & (Input.Left | Input.Right | Input.Up | Input.Down);
        this.pushFromBits(i, fresh);
        const map = pad ? this.mapFor(pad) : {};
        const now = pad ? (['light', 'special', 'start'] as PadAction[]).map((a) => this.actionOn(pad, map, a)) : [false, false, false];
        const actions: MenuAction[] = ['confirm', 'back', 'pause'];
        now.forEach((down, k) => {
          if (down && !this.menuPrev[i][k]) this.events.push({ player: i, action: actions[k] });
        });
        this.menuPrev[i] = now;
        if (bits !== 0 || now.some((d) => d)) this.use(i, 'pad');
      }
      this.padPrev[i] = bits;
      this.padBitsNow[i] = this.capturing ? 0 : bits;
    }
  }

  /** Menu events since the last call. */
  take(): MenuEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** The sim input bitmask for a player right now. */
  bits(player: number): number {
    const map = this.lookup[player === 0 ? 0 : 1];
    let b = this.padBitsNow[player];
    for (const code of this.held) b |= map[code] ?? 0;
    return b;
  }

  // ---------- keyboard bindings ----------

  /** The keys bound to an action for a player (first one is the main key). */
  keysFor(player: number, action: KeyAction): string[] {
    return this.keyMaps[player === 1 ? 1 : 0][action];
  }

  /** Listen for the next key press (null: cancelled with Escape, '': a key the menus own). */
  captureKey(done: (code: string | null) => void): void {
    this.keyCapture = done;
    this.held.clear();
  }

  cancelCapture(): void {
    this.keyCapture = null;
  }

  /** Bind a key to an action for a player. The key leaves whatever it did before, for both players. */
  bindKey(player: number, action: KeyAction, code: string): void {
    for (const m of this.keyMaps) for (const [a] of KEY_ACTIONS) m[a] = m[a].filter((c) => c !== code);
    const m = this.keyMaps[player === 1 ? 1 : 0];
    m[action] = [code];
    this.saveKeys();
  }

  resetKeys(player: number): void {
    const i = player === 1 ? 1 : 0;
    const fresh = copyKeys(DEFAULT_KEYS[i]);
    // Keys the other player took over stay with them.
    const other = this.keyMaps[1 - i];
    for (const [a] of KEY_ACTIONS) fresh[a] = fresh[a].filter((c) => !KEY_ACTIONS.some(([b]) => other[b].includes(c)));
    this.keyMaps[i] = fresh;
    this.saveKeys();
  }

  private saveKeys(): void {
    this.lookup = [lookupFor(this.keyMaps[0]), lookupFor(this.keyMaps[1])];
    this.deviceStamp += 1;
    try {
      localStorage.setItem(KEYS_STORE, JSON.stringify(this.keyMaps));
    } catch {
      // Applies for this visit.
    }
  }

  padsConnected(): number {
    return this.slots.filter((s) => s !== null).length;
  }

  /** Shake a player's pad (where the browser and pad support it). Strength 0 to 1. */
  rumble(player: number, strength: number, ms: number): void {
    if (!this.rumbleOn) return;
    const pad = this.pad(player) as (Gamepad & { vibrationActuator?: { playEffect?: (t: string, p: object) => Promise<unknown> } }) | null;
    const act = pad?.vibrationActuator;
    if (!act || typeof act.playEffect !== 'function') return;
    const s = Math.max(0, Math.min(1, strength));
    act.playEffect('dual-rumble', { duration: ms, strongMagnitude: s, weakMagnitude: Math.min(1, s * 1.3) }).catch(() => undefined);
  }
}

// ---------- notices ----------

let toast: HTMLDivElement | null = null;
let toastTimer = 0;

/** A small notice over the game (controller connected or lost), whatever scene is showing. */
export function notify(text: string): void {
  if (typeof document === 'undefined') return;
  if (!toast) {
    toast = document.createElement('div');
    toast.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);padding:10px 18px;border-radius:10px;' +
      'background:rgba(8,10,22,0.92);color:#f3f1ff;font:600 15px system-ui,sans-serif;border:1px solid #ffc23d;' +
      'z-index:10;pointer-events:none;transition:opacity 0.3s;opacity:0;max-width:90vw;text-align:center';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.style.opacity = '1';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (toast) toast.style.opacity = '0';
  }, 3200);
}

/** One shared instance for the whole game. */
export const controls = new Controls();
