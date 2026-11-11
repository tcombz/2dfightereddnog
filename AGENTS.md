# AGENTS.md

2D 1v1 browser fighting game. Stack: TypeScript, Phaser 3, Vite. Tests: Vitest.

## Hard rules

1. **Simulation is fully separate from rendering.** Everything in `src/sim/` must not import
   Phaser, the DOM, or anything from `src/render/` or `src/dev/`. The renderer reads sim state;
   it never writes it.
2. **The sim is a pure function:** `step(state, p1Input, p2Input) -> state`. It never mutates its
   argument and has no hidden state. Hero data (`HEROES`) is immutable constant data.
3. **Fixed 60 ticks per second.** The renderer runs an accumulator and calls `step` once per
   1/60 s. Nothing in the sim knows about wall-clock time.
4. **Integer math only in the sim.** No floats, no `/` division (use shifts), no decimal
   literals. No `Math.random`, no `Date`, no `performance`. Only `Math.abs`, `Math.min`,
   `Math.max`, `Math.imul` are allowed. `tests/sim.test.ts` scans `src/sim/` to enforce this.
5. **Inputs are a bitmask per tick:** left=1, right=2, up=4, down=8, light=16, heavy=32,
   special=64, block=128 (see `src/sim/input.ts`).
6. **Fighters are data driven.** Each hero is one JSON file in `src/heroes/`: stats plus per-move
   frame data (startup, active, recovery, damage, hitstun, blockstun, knockback, and hitbox and
   hurtbox rects for every frame). No hero-specific logic in code.

## Layout

- `src/sim/` deterministic simulation (`step.ts`, `types.ts`, `constants.ts`, `hash.ts`, `heroes.ts`)
- `src/heroes/*.json` hero data. The JSON is the source of truth. `scripts/gen-heroes.mjs`
  scaffolded the placeholders and overwrites hand edits if rerun.
- `src/render/` Phaser scene: placeholder rectangles, HUD, debug overlay
- `src/dev/localKeyboard.ts` two-players-on-one-machine input, for testing only
- `tests/sim.test.ts` determinism, full-match, purity and hero-data tests

## Sim conventions

- Units are whole pixels and pixels per tick. `x` is the fighter's feet centre, `y` is height
  above the floor (up is positive). Stage is `0..STAGE_WIDTH` with walls at both ends.
- Rects in hero JSON are fighter-local: `x` = forward offset of the near edge (mirrored by
  facing), `y` = bottom edge above the feet, `w`, `h`.
- `frames.length` of a move must equal `startup + active + recovery`; hitboxes only on active frames.
- Any new field on the state must be added to `cloneState` and `hashState`.

## Commands

- `npm run dev` play locally
- `npm test` run the tests (must pass before finishing any change)
- `npm run build` typecheck and bundle

## Done criteria for sim changes

The determinism test must pass. If you change sim behaviour on purpose, the golden hash in
`tests/sim.test.ts` changes: update it with `npx vitest run -u` and say so.
