// TESTING ONLY: both players on one machine (one or two keyboards plugged into it).
// Not part of the sim. Real input sources (netcode, gamepads) implement InputSource instead.
import { Input } from '../sim';

export interface InputSource {
  /** Returns this tick's input bitmasks for [P1, P2]. */
  read(): [number, number];
}

type Binding = Record<string, number>;

const P1: Binding = {
  KeyA: Input.Left,
  KeyD: Input.Right,
  KeyW: Input.Up,
  KeyS: Input.Down,
  KeyF: Input.Light,
  KeyG: Input.Heavy,
  KeyH: Input.Special,
  KeyT: Input.Down | Input.Heavy, // kick shortcut (same as holding down and pressing heavy)
  KeyR: Input.Block,
};

const P2: Binding = {
  ArrowLeft: Input.Left,
  ArrowRight: Input.Right,
  ArrowUp: Input.Up,
  ArrowDown: Input.Down,
  KeyU: Input.Light,
  KeyI: Input.Heavy,
  KeyO: Input.Special,
  KeyY: Input.Down | Input.Heavy,
  KeyP: Input.Block,
  Numpad1: Input.Light,
  Numpad2: Input.Heavy,
  Numpad3: Input.Special,
  Numpad0: Input.Block,
};

export class LocalKeyboard implements InputSource {
  private readonly held = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.code in P1 || e.code in P2) {
        this.held.add(e.code);
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());
  }

  read(): [number, number] {
    let a = 0;
    let b = 0;
    for (const code of this.held) {
      a |= P1[code] ?? 0;
      b |= P2[code] ?? 0;
    }
    return [a, b];
  }
}
