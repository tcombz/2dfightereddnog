// TESTING ONLY: on-screen buttons for player 1 on touch devices. Not part of the sim.
import { Input } from '../sim';

const BUTTONS: Array<{ label: string; bit: number; side: 'left' | 'right'; col: number; row: number }> = [
  { label: '◀', bit: Input.Left, side: 'left', col: 1, row: 2 },
  { label: '▶', bit: Input.Right, side: 'left', col: 3, row: 2 },
  { label: '▲', bit: Input.Up, side: 'left', col: 2, row: 1 },
  { label: '▼', bit: Input.Down, side: 'left', col: 2, row: 2 },
  { label: 'L', bit: Input.Light, side: 'right', col: 1, row: 2 },
  { label: 'H', bit: Input.Heavy, side: 'right', col: 2, row: 1 },
  { label: 'S', bit: Input.Special, side: 'right', col: 3, row: 1 },
  { label: 'BLK', bit: Input.Block, side: 'right', col: 2, row: 2 },
];

export const isTouchDevice = (): boolean => window.matchMedia('(pointer: coarse)').matches;

export class TouchControls {
  private bits = 0;

  constructor(parent: HTMLElement) {
    for (const side of ['left', 'right'] as const) {
      const pad = document.createElement('div');
      pad.className = `pad pad-${side}`;
      for (const b of BUTTONS.filter((x) => x.side === side)) {
        const el = document.createElement('button');
        el.textContent = b.label;
        el.style.gridColumn = String(b.col);
        el.style.gridRow = String(b.row);
        const set = (on: boolean) => (e: Event) => {
          e.preventDefault();
          this.bits = on ? this.bits | b.bit : this.bits & ~b.bit;
          el.classList.toggle('held', on);
        };
        el.addEventListener('pointerdown', set(true));
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, set(false));
        el.addEventListener('contextmenu', (e) => e.preventDefault());
        pad.appendChild(el);
      }
      parent.appendChild(pad);
    }
  }

  read(): number {
    return this.bits;
  }
}
