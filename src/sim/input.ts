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
