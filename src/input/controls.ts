// Keyboard and gamepad input for both players. Produces the sim's input bitmask per player
// and edge-triggered menu events. Not part of the sim.
import { Input } from '../sim';

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'pause';

export interface MenuEvent {
  /** 0 or 1 for a player's own keys or pad, -1 for shared keys (Enter, Escape). */
  player: number;
  action: MenuAction;
}

type Binding = Record<string, number>;

/** Player 1: WASD with F G H R, or J K L and Space, so one player can sit on the right-hand keys too. */
const P1: Binding = {
  KeyA: Input.Left,
  KeyD: Input.Right,
  KeyW: Input.Up,
  KeyS: Input.Down,
  KeyF: Input.Light,
  KeyG: Input.Heavy,
  KeyH: Input.Special,
  KeyR: Input.Block,
  KeyJ: Input.Light,
  KeyK: Input.Heavy,
  KeyL: Input.Special,
  Space: Input.Block,
};

/** Player 2: arrow keys with U I O P, or the number pad. */
const P2: Binding = {
  ArrowLeft: Input.Left,
  ArrowRight: Input.Right,
  ArrowUp: Input.Up,
  ArrowDown: Input.Down,
  KeyU: Input.Light,
  KeyI: Input.Heavy,
  KeyO: Input.Special,
  KeyP: Input.Block,
  Numpad1: Input.Light,
  Numpad2: Input.Heavy,
  Numpad3: Input.Special,
  Numpad0: Input.Block,
};

const MENU_FROM_BITS: Array<[number, MenuAction]> = [
  [Input.Up, 'up'],
  [Input.Down, 'down'],
  [Input.Left, 'left'],
  [Input.Right, 'right'],
  [Input.Light, 'confirm'],
  [Input.Heavy, 'back'],
];

/** Standard gamepad mapping: A or X light, Y heavy, B special, bumpers and triggers block or macros. */
function padBits(p: Gamepad): number {
  const b = (i: number): boolean => p.buttons[i]?.pressed ?? false;
  const ax = p.axes[0] ?? 0;
  const ay = p.axes[1] ?? 0;
  let bits = 0;
  if (b(14) || ax < -0.5) bits |= Input.Left;
  if (b(15) || ax > 0.5) bits |= Input.Right;
  if (b(12) || ay < -0.5) bits |= Input.Up;
  if (b(13) || ay > 0.5) bits |= Input.Down;
  if (b(0) || b(2)) bits |= Input.Light;
  if (b(3)) bits |= Input.Heavy;
  if (b(1)) bits |= Input.Special;
  if (b(4) || b(6)) bits |= Input.Block;
  if (b(5)) bits |= Input.Light | Input.Heavy; // throw
  if (b(7)) bits |= Input.Heavy | Input.Special; // super
  return bits;
}

export class Controls {
  private readonly held = new Set<string>();
  private events: MenuEvent[] = [];
  private padPrev: [number, number] = [0, 0];
  /** Previous A, B and Start states per pad, for menu edges. */
  private padButtonsPrev: [boolean[], boolean[]] = [[false, false, false], [false, false, false]];
  private padBitsNow: [number, number] = [0, 0];

  constructor() {
    window.addEventListener('keydown', (e) => {
      const p1 = P1[e.code];
      const p2 = P2[e.code];
      if (p1 !== undefined || p2 !== undefined || e.code === 'Enter' || e.code === 'Escape' || e.code === 'Backspace') {
        e.preventDefault();
      }
      if (e.repeat) return;
      this.held.add(e.code);
      if (p1 !== undefined) this.pushFromBits(0, p1);
      if (p2 !== undefined) this.pushFromBits(1, p2);
      if (e.code === 'Enter' || e.code === 'NumpadEnter') this.events.push({ player: -1, action: 'confirm' });
      if (e.code === 'Escape') this.events.push({ player: -1, action: 'pause' });
      if (e.code === 'Backspace') this.events.push({ player: -1, action: 'back' });
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
  }

  private pushFromBits(player: number, bits: number): void {
    for (const [bit, action] of MENU_FROM_BITS) if (bits & bit) this.events.push({ player, action });
  }

  /** Call once per frame before reading: polls gamepads and turns their presses into menu events. */
  poll(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const connected = Array.from(pads).filter((p): p is Gamepad => p !== null && p.connected);
    for (let i = 0; i < 2; i += 1) {
      const pad = connected[i];
      const bits = pad ? padBits(pad) : 0;
      // Menus on a pad: stick or d-pad to move, A to confirm, B to go back, Start to pause.
      const fresh = bits & ~this.padPrev[i] & (Input.Left | Input.Right | Input.Up | Input.Down);
      this.pushFromBits(i, fresh);
      const now = [0, 1, 9].map((b) => (pad ? (pad.buttons[b]?.pressed ?? false) : false));
      const actions: MenuAction[] = ['confirm', 'back', 'pause'];
      now.forEach((down, k) => {
        if (down && !this.padButtonsPrev[i][k]) this.events.push({ player: i, action: actions[k] });
      });
      this.padButtonsPrev[i] = now;
      this.padPrev[i] = bits;
      this.padBitsNow[i] = bits;
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
    const map = player === 0 ? P1 : P2;
    let b = this.padBitsNow[player];
    for (const code of this.held) b |= map[code] ?? 0;
    return b;
  }

  padsConnected(): number {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    return Array.from(pads).filter((p) => p !== null && p.connected).length;
  }
}

/** One shared instance for the whole game. */
export const controls = new Controls();
