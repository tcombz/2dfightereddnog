// On-screen prompts that match what each player holds: controller buttons (Xbox, PlayStation,
// Switch or numbered, read through the player's own mapping, so remaps show up) or keyboard keys.
import { controls, padFamily } from '../input/controls';
import type { PadAction, PadFamily } from '../input/controls';

/** Labels for the browser's standard button indices, per family. */
const NAMES: Record<Exclude<PadFamily, 'generic'>, Record<number, string>> = {
  xbox: { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'View', 9: 'Menu', 10: 'LS', 11: 'RS', 12: 'D↑', 13: 'D↓', 14: 'D←', 15: 'D→' },
  ps: { 0: '✕', 1: '○', 2: '□', 3: '△', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 8: 'Share', 9: 'Options', 10: 'L3', 11: 'R3', 12: 'D↑', 13: 'D↓', 14: 'D←', 15: 'D→' },
  // Nintendo letters by position: bottom B, right A, left Y, top X.
  switch: { 0: 'B', 1: 'A', 2: 'Y', 3: 'X', 4: 'L', 5: 'R', 6: 'ZL', 7: 'ZR', 8: '−', 9: '+', 10: 'LS', 11: 'RS', 12: 'D↑', 13: 'D↓', 14: 'D←', 15: 'D→' },
};

const FAMILY_NAME: Record<PadFamily, string> = { xbox: 'Xbox', ps: 'PlayStation', switch: 'Switch', generic: 'controller' };

/** The pad a prompt should describe: the player's own, else any connected pad. */
function padOf(player: number): Gamepad | null {
  if (player >= 0) {
    const p = controls.pad(player);
    if (p) return p;
  }
  return controls.pad(0) ?? controls.pad(1);
}

/** Is this player (or, for -1, whoever pressed something last) on a controller right now? */
export function onPad(player: number): boolean {
  const p = player < 0 ? controls.lastPlayer : player;
  const dev = player < 0 ? controls.lastDevice : controls.device[p];
  return dev === 'pad' && padOf(p) !== null;
}

export function familyName(player: number): string {
  const p = padOf(player);
  return p ? FAMILY_NAME[padFamily(p)] : 'controller';
}

/** The button (or buttons) a pad action sits on, e.g. "A", "○", "RT", "B3". */
export function padButton(action: PadAction, player: number): string {
  const p = padOf(player);
  if (!p) return action.toUpperCase();
  const family = padFamily(p);
  const remapped = controls.hasRemap(p);
  const names = family === 'generic' || (p.mapping !== 'standard' && !remapped) ? null : NAMES[family];
  const out: string[] = [];
  for (const src of controls.mapFor(p)[action] ?? []) {
    if (src.kind === 'button') out.push(names?.[src.index] ?? `B${src.index + 1}`);
    else if (src.kind === 'hat') out.push('D-pad');
    else out.push('Stick');
    if (out.length === 1) break;
  }
  return out[0] ?? action.toUpperCase();
}

const KEYS = [
  { light: 'F', heavy: 'G', special: 'H', block: 'R' },
  { light: 'U', heavy: 'I', special: 'O', block: 'P' },
];

/**
 * Move-list and trial text for this player: on a controller, attack words become that pad's
 * buttons ("↓↘→ + SPECIAL" reads "↓↘→ + B"); on the keyboard the words stay.
 */
export function inputText(text: string, player: number): string {
  if (!onPad(player)) return text;
  const b = (a: PadAction): string => padButton(a, player);
  return text
    .replace(/LIGHT \+ HEAVY/g, b('throw'))
    .replace(/HEAVY \+ SPECIAL/g, b('super'))
    .replace(/\bLIGHT\b/g, b('light'))
    .replace(/\bHEAVY\b/g, b('heavy'))
    .replace(/\bSPECIAL\b/g, b('special'))
    .replace(/\bBLOCK\b/g, b('block'));
}

/** "Confirm: A · Back: B" on a pad, "Confirm: Enter · Back: Esc" on the keyboard. */
export function menuHint(): string {
  if (onPad(-1)) return `Confirm: ${padButton('light', -1)}  ·  Back: ${padButton('special', -1)}`;
  return 'Confirm: Enter or F  ·  Back: Esc or G';
}

export function backHint(): string {
  return onPad(-1) ? `Back: ${padButton('special', -1)}` : 'Back: Esc or G';
}

/** A player's keyboard key for an attack, for the controls page. */
export function keyFor(action: 'light' | 'heavy' | 'special' | 'block', player: number): string {
  return KEYS[player][action];
}
