/** One input per player per tick, packed into a bitmask. */
export const Input = {
  Left: 1,
  Right: 2,
  Up: 4,
  Down: 8,
  Light: 16,
  Heavy: 32,
  Special: 64,
  Block: 128,
} as const;

export const INPUT_MASK = 255;

/**
 * Direction in numpad notation relative to facing:
 * 7 8 9 / 4 5 6 / 1 2 3, where 6 is toward the opponent and 2 is down.
 */
export function numpad(input: number, facing: number): number {
  const fwd = facing === 1 ? Input.Right : Input.Left;
  const back = facing === 1 ? Input.Left : Input.Right;
  const h = (input & fwd ? 1 : 0) - (input & back ? 1 : 0);
  const v = (input & Input.Up ? 1 : 0) - (input & Input.Down ? 1 : 0);
  return 5 + h + v * 3;
}
