// Generates the hero JSON files in src/heroes/ from the compact specs below.
// The JSON files are what the game loads; edit the specs here and rerun `npm run gen:heroes`
// (rerunning overwrites hand edits to the JSON).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'heroes');
mkdirSync(outDir, { recursive: true });

const Guard = { Mid: 0, Low: 1, High: 2, Throw: 3 };
const Kind = { Normal: 0, Special: 1, Super: 2, Throw: 3 };
const Cancel = { Normal: 1, Special: 2, Super: 4 };
const ALL = Cancel.Normal | Cancel.Special | Cancel.Super;
const SP = Cancel.Special | Cancel.Super;

function move(bodies, spec) {
  const m = {
    name: spec.name,
    kind: spec.kind ?? Kind.Normal,
    guard: spec.guard ?? Guard.Mid,
    startup: spec.startup,
    active: spec.active,
    recovery: spec.recovery,
    damage: spec.damage ?? 0,
    chipDamage: spec.chip ?? 0,
    hitstun: spec.hitstun ?? 0,
    blockstun: spec.blockstun ?? 0,
    knockback: { x: spec.kb?.[0] ?? 0, y: spec.kb?.[1] ?? 0 },
    knockdown: spec.knockdown ?? false,
    hitstop: spec.hitstop ?? 0,
    advance: spec.advance ?? 0,
    hits: spec.hits ?? 1,
    rehit: spec.rehit ?? 0,
    cancel: spec.cancel ?? 0,
    invuln: spec.invuln ?? 0,
    air: spec.air ?? false,
    juggle: spec.juggle ?? 0,
    counter: spec.counter ?? 0,
    armor: spec.armor ?? 0,
    teleport: spec.teleport ?? 0,
    meterCost: spec.meterCost ?? 0,
    projectile: spec.projectile
      ? {
          spawnTick: spec.startup,
          x: spec.projectile.x,
          y: spec.projectile.y,
          w: spec.projectile.w,
          h: spec.projectile.h,
          speed: spec.projectile.speed,
          life: spec.projectile.life,
          damage: spec.projectile.damage,
          chipDamage: spec.projectile.chip,
          hitstun: spec.projectile.hitstun,
          blockstun: spec.projectile.blockstun,
          knockback: { x: spec.projectile.kb[0], y: spec.projectile.kb[1] },
          knockdown: spec.projectile.knockdown ?? false,
          hitstop: spec.projectile.hitstop,
        }
      : null,
    frames: [],
  };
  const body = bodies[spec.body ?? 'stand'];
  const total = spec.startup + spec.active + spec.recovery;
  const hitbox = spec.hitbox ?? null;
  // While the limb is out (active frames and the first half of recovery) it can be hit too.
  const limb = hitbox && spec.limb !== false ? { x: hitbox.x, y: hitbox.y, w: Math.max(10, hitbox.w - 25), h: hitbox.h } : null;
  for (let i = 0; i < total; i++) {
    const active = i >= spec.startup && i < spec.startup + spec.active;
    const extended = limb && i >= spec.startup && i < spec.startup + spec.active + (spec.recovery >> 1);
    m.frames.push({
      hitboxes: active && hitbox ? [hitbox] : [],
      hurtboxes: extended ? [body, limb] : [body],
    });
  }
  return m;
}

function hero({ id, name, color, stats, bodies, moves }) {
  const out = { id, name, color, stats, hurtboxes: { stand: [bodies.stand], crouch: [bodies.crouch], air: [bodies.air] }, moves: {} };
  for (const [key, spec] of Object.entries(moves)) out.moves[key] = move(bodies, spec);
  return out;
}

// Sprites are drawn at 2x, so these bodies are about 240 px tall. Rects: x = forward offset of the
// near edge from the feet centre, y = bottom edge above the floor.
const heroes = [
  hero({
    id: 'rogue',
    name: 'The Rogue',
    color: '#2f7bff',
    stats: {
      maxHealth: 980, walkSpeed: 6, backWalkSpeed: 5, jumpVelocity: 22, jumpSpeedX: 7, gravity: 1,
      width: 70, height: 228, crouchHeight: 150, dashSpeed: 14, dashTicks: 14, backdashSpeed: 12, backdashTicks: 16,
    },
    bodies: {
      stand: { x: -35, y: 0, w: 70, h: 228 },
      crouch: { x: -40, y: 0, w: 80, h: 150 },
      air: { x: -35, y: 30, w: 70, h: 180 },
    },
    moves: {
      light: { name: 'Jab', startup: 4, active: 3, recovery: 7, damage: 30, hitstun: 15, blockstun: 11, kb: [3, 0], hitstop: 7, cancel: ALL, hitbox: { x: 15, y: 158, w: 86, h: 30 } },
      heavy: { name: 'Devastating Strike', startup: 8, active: 4, recovery: 18, damage: 80, hitstun: 24, blockstun: 17, kb: [10, 0], hitstop: 11, advance: 3, cancel: SP, hitbox: { x: 15, y: 132, w: 108, h: 40 } },
      // Spinning hook kick: the fastest kick in the cast, high and long.
      kick: { name: 'High Kick', startup: 9, active: 4, recovery: 17, damage: 70, hitstun: 22, blockstun: 15, kb: [12, 0], hitstop: 10, cancel: SP, hitbox: { x: 20, y: 140, w: 132, h: 62 } },
      crouchLight: { name: 'Low Jab', guard: Guard.Low, body: 'crouch', startup: 4, active: 3, recovery: 8, damage: 24, hitstun: 14, blockstun: 10, kb: [3, 0], hitstop: 7, cancel: ALL, hitbox: { x: 20, y: 112, w: 108, h: 52 } },
      sweep: { name: 'Sweep', guard: Guard.Low, body: 'crouch', startup: 8, active: 5, recovery: 24, damage: 70, knockdown: true, blockstun: 14, kb: [7, 6], hitstop: 10, cancel: Cancel.Super, hitbox: { x: 10, y: 0, w: 110, h: 80 } },
      jumpAttack: { name: 'Strike From Above', guard: Guard.High, body: 'air', air: true, startup: 5, active: 14, recovery: 4, damage: 68, hitstun: 20, blockstun: 14, kb: [6, 0], hitstop: 10, hitbox: { x: 10, y: 50, w: 125, h: 120 } },
      throw: { name: 'Throw', kind: Kind.Throw, guard: Guard.Throw, limb: false, startup: 4, active: 2, recovery: 24, damage: 110, knockdown: true, kb: [14, 14], hitstop: 14, hitbox: { x: 10, y: 60, w: 70, h: 120 } },
      // Rogue's Rift: blinks in (invulnerable while he vanishes), strikes, and blinks back out on a hit.
      special: { name: "Rogue's Rift", kind: Kind.Special, startup: 12, active: 5, recovery: 22, invuln: 11, teleport: 220, damage: 105, chip: 16, hitstun: 24, blockstun: 18, kb: [12, 16], knockdown: true, hitstop: 14, cancel: Cancel.Super, hitbox: { x: 10, y: 60, w: 125, h: 150 } },
      projectile: {
        name: 'Arc Bolt', kind: Kind.Special, startup: 12, active: 1, recovery: 28,
        projectile: { x: 70, y: 150, w: 70, h: 44, speed: 10, life: 110, damage: 70, chip: 12, hitstun: 20, blockstun: 16, kb: [10, 0], hitstop: 8 },
      },
      rising: { name: 'Rising Volt', kind: Kind.Special, juggle: 1, cancel: Cancel.Super, startup: 4, active: 10, recovery: 30, invuln: 7, damage: 120, chip: 16, hitstun: 30, blockstun: 20, kb: [6, 22], knockdown: true, hitstop: 12, hitbox: { x: 0, y: 100, w: 90, h: 180 } },
      super: { name: 'Financial Freedom', kind: Kind.Super, juggle: 1, meterCost: 1000, startup: 6, active: 24, recovery: 24, hits: 5, rehit: 5, advance: 10, invuln: 14, damage: 55, chip: 20, hitstun: 30, blockstun: 20, kb: [3, 20], knockdown: true, hitstop: 6, hitbox: { x: 0, y: 30, w: 150, h: 200 } },
    },
  }),
  hero({
    id: 'jetsetter',
    name: 'The Jetsetter',
    color: '#e0b030',
    stats: {
      maxHealth: 1050, walkSpeed: 5, backWalkSpeed: 4, jumpVelocity: 21, jumpSpeedX: 7, gravity: 1,
      width: 72, height: 232, crouchHeight: 150, dashSpeed: 15, dashTicks: 13, backdashSpeed: 12, backdashTicks: 15,
    },
    bodies: {
      stand: { x: -36, y: 0, w: 72, h: 232 },
      crouch: { x: -40, y: 0, w: 80, h: 150 },
      air: { x: -36, y: 30, w: 72, h: 180 },
    },
    moves: {
      light: { name: 'Smooth Jab', startup: 4, active: 3, recovery: 8, damage: 34, hitstun: 15, blockstun: 11, kb: [3, 0], hitstop: 7, cancel: ALL, hitbox: { x: 15, y: 158, w: 83, h: 30 } },
      heavy: { name: 'Power Strike', startup: 9, active: 4, recovery: 20, damage: 88, hitstun: 24, blockstun: 17, kb: [11, 0], hitstop: 12, cancel: SP, hitbox: { x: 15, y: 130, w: 125, h: 60 } },
      // Skipping roundhouse: steps in as it swings.
      kick: { name: 'Step Kick', startup: 11, active: 4, recovery: 17, advance: 9, damage: 78, hitstun: 22, blockstun: 15, kb: [12, 0], hitstop: 11, cancel: SP, hitbox: { x: 20, y: 110, w: 110, h: 80 } },
      crouchLight: { name: 'Low Jab', guard: Guard.Low, body: 'crouch', startup: 4, active: 3, recovery: 9, damage: 26, hitstun: 14, blockstun: 10, kb: [3, 0], hitstop: 7, cancel: ALL, hitbox: { x: 20, y: 108, w: 90, h: 52 } },
      // Breakdance spin: two sweeping hits, the second knocks down.
      sweep: { name: 'Floor Sweep', guard: Guard.Low, body: 'crouch', startup: 10, active: 9, recovery: 22, damage: 44, hits: 2, rehit: 5, knockdown: true, blockstun: 15, kb: [7, 6], hitstop: 11, cancel: Cancel.Super, hitbox: { x: 10, y: 0, w: 115, h: 96 } },
      jumpAttack: { name: 'Aerial Style', guard: Guard.High, body: 'air', air: true, startup: 6, active: 14, recovery: 4, damage: 76, hitstun: 20, blockstun: 14, kb: [6, 0], hitstop: 11, hitbox: { x: 10, y: 50, w: 110, h: 120 } },
      throw: { name: 'Throw', kind: Kind.Throw, guard: Guard.Throw, limb: false, startup: 4, active: 2, recovery: 24, damage: 120, knockdown: true, kb: [14, 14], hitstop: 14, hitbox: { x: 10, y: 60, w: 70, h: 120 } },
      special: { name: 'Smash Step', kind: Kind.Special, startup: 13, active: 6, recovery: 25, advance: 14, damage: 120, chip: 18, hitstun: 24, blockstun: 18, kb: [11, 16], knockdown: true, hitstop: 14, cancel: Cancel.Super, hitbox: { x: 10, y: 40, w: 140, h: 120 } },
      projectile: {
        name: 'Hot Record', kind: Kind.Special, startup: 14, active: 1, recovery: 30,
        projectile: { x: 60, y: 120, w: 56, h: 56, speed: 8, life: 140, damage: 76, chip: 13, hitstun: 21, blockstun: 16, kb: [10, 0], hitstop: 9 },
      },
      rising: { name: 'Encore', kind: Kind.Special, juggle: 1, cancel: Cancel.Super, startup: 5, active: 9, recovery: 32, invuln: 7, damage: 130, chip: 16, hitstun: 30, blockstun: 20, kb: [6, 22], knockdown: true, hitstop: 12, hitbox: { x: 0, y: 100, w: 95, h: 180 } },
      super: { name: 'Crowd Pleaser', kind: Kind.Super, juggle: 1, meterCost: 1000, startup: 8, active: 24, recovery: 30, hits: 4, rehit: 6, invuln: 16, damage: 75, chip: 22, hitstun: 32, blockstun: 20, kb: [5, 22], knockdown: true, hitstop: 8, hitbox: { x: -30, y: 0, w: 300, h: 260 } },
    },
  }),
  hero({
    id: 'chris',
    name: 'Chris "The Diplomat"',
    color: '#b8323f',
    // Short in stature: a smaller body, so some high attacks sail over him.
    stats: {
      maxHealth: 1000, walkSpeed: 6, backWalkSpeed: 5, jumpVelocity: 21, jumpSpeedX: 6, gravity: 1,
      width: 64, height: 208, crouchHeight: 138, dashSpeed: 13, dashTicks: 15, backdashSpeed: 11, backdashTicks: 16,
    },
    bodies: {
      stand: { x: -32, y: 0, w: 64, h: 208 },
      crouch: { x: -36, y: 0, w: 72, h: 138 },
      air: { x: -32, y: 30, w: 64, h: 165 },
    },
    moves: {
      light: { name: 'Make Your Point', startup: 4, active: 3, recovery: 7, damage: 30, hitstun: 15, blockstun: 11, kb: [3, 0], hitstop: 7, cancel: ALL, hitbox: { x: 15, y: 138, w: 82, h: 30 } },
      heavy: { name: 'The Final Vote', startup: 9, active: 4, recovery: 19, damage: 90, hitstun: 24, blockstun: 17, kb: [11, 0], hitstop: 12, cancel: SP, hitbox: { x: 15, y: 118, w: 112, h: 46 } },
      // Axe kick: the heel comes down from above, so it must be blocked standing (an overhead).
      kick: { name: 'Gavel Kick', guard: Guard.High, startup: 17, active: 4, recovery: 16, damage: 80, hitstun: 24, blockstun: 14, kb: [10, 0], hitstop: 12, cancel: SP, hitbox: { x: 20, y: 60, w: 112, h: 150 } },
      crouchLight: { name: 'Fine Print', guard: Guard.Low, body: 'crouch', startup: 4, active: 3, recovery: 8, damage: 24, hitstun: 14, blockstun: 10, kb: [3, 0], hitstop: 7, cancel: ALL, hitbox: { x: 20, y: 96, w: 100, h: 50 } },
      // A kneeling low kick that keeps them standing: cancels into specials instead of knocking down.
      sweep: { name: 'Low Blow', guard: Guard.Low, body: 'crouch', startup: 8, active: 4, recovery: 20, damage: 62, hitstun: 21, blockstun: 12, kb: [8, 0], hitstop: 10, cancel: SP, hitbox: { x: 10, y: 0, w: 112, h: 80 } },
      jumpAttack: { name: 'Take to the Skies', guard: Guard.High, body: 'air', air: true, startup: 5, active: 14, recovery: 4, damage: 70, hitstun: 20, blockstun: 14, kb: [6, 0], hitstop: 10, hitbox: { x: 10, y: 40, w: 116, h: 110 } },
      throw: { name: 'Backroom Deal', kind: Kind.Throw, guard: Guard.Throw, limb: false, startup: 4, active: 2, recovery: 24, damage: 110, knockdown: true, kb: [14, 14], hitstop: 14, hitbox: { x: 10, y: 60, w: 70, h: 110 } },
      // Counter stance: an opponent's strike during the active frames is deflected and answered.
      special: { name: 'The Diplomacy', kind: Kind.Special, counter: 1, startup: 3, active: 22, recovery: 20, damage: 145, chip: 0, hitstun: 26, blockstun: 18, kb: [10, 18], knockdown: true, hitstop: 16, cancel: Cancel.Super },
      projectile: {
        name: 'Wild Card', kind: Kind.Special, startup: 12, active: 1, recovery: 26,
        projectile: { x: 60, y: 120, w: 52, h: 36, speed: 14, life: 82, damage: 66, chip: 10, hitstun: 19, blockstun: 15, kb: [9, 0], hitstop: 8 },
      },
      rising: { name: 'Checkmate', kind: Kind.Special, juggle: 1, cancel: Cancel.Super, startup: 4, active: 9, recovery: 30, invuln: 7, damage: 118, chip: 16, hitstun: 30, blockstun: 20, kb: [6, 22], knockdown: true, hitstop: 12, hitbox: { x: 0, y: 90, w: 88, h: 170 } },
      super: { name: 'World Stage', kind: Kind.Super, juggle: 1, meterCost: 1000, startup: 8, active: 26, recovery: 28, hits: 5, rehit: 5, invuln: 18, damage: 62, chip: 22, hitstun: 32, blockstun: 20, kb: [4, 22], knockdown: true, hitstop: 8, hitbox: { x: -60, y: 0, w: 320, h: 270 } },
    },
  }),
  hero({
    id: 'leader',
    name: 'The Leader',
    color: '#d4a017',
    stats: {
      maxHealth: 980, walkSpeed: 5, backWalkSpeed: 4, jumpVelocity: 21, jumpSpeedX: 6, gravity: 1,
      width: 76, height: 236, crouchHeight: 152, dashSpeed: 12, dashTicks: 15, backdashSpeed: 10, backdashTicks: 18,
    },
    bodies: {
      stand: { x: -38, y: 0, w: 76, h: 236 },
      crouch: { x: -42, y: 0, w: 84, h: 152 },
      air: { x: -38, y: 30, w: 76, h: 185 },
    },
    moves: {
      light: { name: 'Lead the Charge', startup: 5, active: 3, recovery: 8, damage: 35, hitstun: 15, blockstun: 11, kb: [3, 0], hitstop: 8, cancel: ALL, hitbox: { x: 15, y: 156, w: 88, h: 32 } },
      heavy: { name: 'Set the Tone', startup: 10, active: 4, recovery: 21, damage: 92, hitstun: 25, blockstun: 18, kb: [12, 0], hitstop: 13, advance: 4, cancel: SP, hitbox: { x: 15, y: 130, w: 122, h: 50 } },
      // Push kick: shoves them back to his range, hit or blocked.
      kick: { name: 'Front Line', startup: 11, active: 4, recovery: 18, damage: 76, hitstun: 22, blockstun: 17, kb: [22, 0], hitstop: 11, cancel: SP, hitbox: { x: 20, y: 96, w: 128, h: 70 } },
      crouchLight: { name: 'Check In', guard: Guard.Low, body: 'crouch', startup: 5, active: 3, recovery: 9, damage: 30, hitstun: 14, blockstun: 10, kb: [3, 0], hitstop: 8, cancel: ALL, hitbox: { x: 20, y: 108, w: 98, h: 52 } },
      // Sliding kick: covers ground along the floor.
      sweep: { name: 'Keep Your Ground', guard: Guard.Low, body: 'crouch', startup: 10, active: 6, recovery: 24, advance: 11, damage: 84, knockdown: true, blockstun: 15, kb: [8, 6], hitstop: 11, cancel: Cancel.Super, hitbox: { x: 10, y: 0, w: 118, h: 90 } },
      jumpAttack: { name: 'Take the High Ground', guard: Guard.High, body: 'air', air: true, startup: 6, active: 14, recovery: 4, damage: 82, hitstun: 20, blockstun: 14, kb: [6, 0], hitstop: 11, hitbox: { x: 10, y: 50, w: 118, h: 120 } },
      throw: { name: 'Family Business', kind: Kind.Throw, guard: Guard.Throw, limb: false, startup: 4, active: 2, recovery: 24, damage: 130, knockdown: true, kb: [15, 14], hitstop: 15, hitbox: { x: 10, y: 60, w: 74, h: 130 } },
      // The crew charges across the screen: a wide projectile that knocks down.
      special: {
        name: 'The Crew Call', kind: Kind.Special, startup: 18, active: 1, recovery: 32,
        projectile: { x: 20, y: 0, w: 130, h: 180, speed: 10, life: 70, damage: 88, chip: 16, hitstun: 24, blockstun: 18, kb: [12, 14], knockdown: true, hitstop: 12 },
      },
      projectile: {
        name: 'Golden Rule', kind: Kind.Special, startup: 13, active: 1, recovery: 28,
        projectile: { x: 70, y: 130, w: 74, h: 60, speed: 9, life: 120, damage: 72, chip: 13, hitstun: 21, blockstun: 16, kb: [10, 0], hitstop: 9 },
      },
      rising: { name: 'Rise Up', kind: Kind.Special, juggle: 1, cancel: Cancel.Super, startup: 5, active: 9, recovery: 32, invuln: 7, damage: 135, chip: 16, hitstun: 30, blockstun: 20, kb: [6, 22], knockdown: true, hitstop: 13, hitbox: { x: 0, y: 100, w: 96, h: 185 } },
      super: { name: 'Main Character Energy', kind: Kind.Super, juggle: 1, meterCost: 1000, startup: 7, active: 26, recovery: 28, hits: 5, rehit: 5, advance: 9, invuln: 16, damage: 68, chip: 22, hitstun: 32, blockstun: 20, kb: [4, 22], knockdown: true, hitstop: 8, hitbox: { x: 0, y: 0, w: 170, h: 250 } },
    },
  }),
  // Eddnog "The Tank": the biggest, slowest, toughest. Armor on his big moves lets him walk through pokes.
  hero({
    id: 'eddnog',
    name: 'Eddnog',
    color: '#e0a526',
    stats: {
      maxHealth: 1150, walkSpeed: 4, backWalkSpeed: 3, jumpVelocity: 20, jumpSpeedX: 5, gravity: 1,
      width: 86, height: 246, crouchHeight: 160, dashSpeed: 11, dashTicks: 15, backdashSpeed: 9, backdashTicks: 17,
    },
    bodies: {
      stand: { x: -43, y: 0, w: 86, h: 246 },
      crouch: { x: -46, y: 0, w: 92, h: 160 },
      air: { x: -43, y: 30, w: 86, h: 196 },
    },
    moves: {
      light: { name: 'Keep the Pressure', startup: 5, active: 3, recovery: 9, damage: 40, hitstun: 15, blockstun: 11, kb: [3, 0], hitstop: 8, cancel: ALL, hitbox: { x: 15, y: 160, w: 92, h: 34 } },
      heavy: { name: 'Bring the Hammer Down', startup: 12, active: 4, recovery: 22, armor: 1, damage: 104, hitstun: 26, blockstun: 19, kb: [13, 0], hitstop: 14, advance: 3, cancel: SP, hitbox: { x: 15, y: 120, w: 124, h: 70 } },
      // Shoulder tackle: steps in behind the pauldron and soaks one hit.
      kick: { name: 'Shoulder Check', startup: 13, active: 4, recovery: 19, advance: 8, armor: 1, damage: 86, hitstun: 22, blockstun: 15, kb: [15, 0], hitstop: 12, cancel: SP, hitbox: { x: 20, y: 110, w: 110, h: 100 } },
      crouchLight: { name: 'Low Jab', guard: Guard.Low, body: 'crouch', startup: 5, active: 3, recovery: 10, damage: 32, hitstun: 14, blockstun: 10, kb: [3, 0], hitstop: 8, cancel: ALL, hitbox: { x: 20, y: 110, w: 100, h: 54 } },
      sweep: { name: 'Sweep the Leg', guard: Guard.Low, body: 'crouch', startup: 11, active: 4, recovery: 27, damage: 92, knockdown: true, blockstun: 15, kb: [8, 6], hitstop: 12, cancel: Cancel.Super, hitbox: { x: 10, y: 0, w: 122, h: 90 } },
      jumpAttack: { name: 'Crush From Above', guard: Guard.High, body: 'air', air: true, startup: 6, active: 14, recovery: 4, damage: 90, hitstun: 21, blockstun: 15, kb: [7, 0], hitstop: 13, hitbox: { x: 0, y: 20, w: 130, h: 130 } },
      throw: { name: 'Bear Hug', kind: Kind.Throw, guard: Guard.Throw, limb: false, startup: 5, active: 3, recovery: 26, damage: 150, knockdown: true, kb: [16, 14], hitstop: 16, hitbox: { x: 10, y: 60, w: 104, h: 140 } },
      // Bulwark Rush: a shoulder-first charge behind a gold shield that soaks two hits.
      special: { name: 'Bulwark Rush', kind: Kind.Special, startup: 12, active: 16, recovery: 26, armor: 2, advance: 10, damage: 118, chip: 18, hitstun: 26, blockstun: 20, kb: [14, 16], knockdown: true, hitstop: 15, cancel: Cancel.Super, hitbox: { x: 10, y: 40, w: 110, h: 190 } },
      projectile: {
        name: 'Ground Breaker', kind: Kind.Special, startup: 15, active: 1, recovery: 30,
        projectile: { x: 50, y: 0, w: 96, h: 70, speed: 9, life: 60, damage: 82, chip: 14, hitstun: 22, blockstun: 17, kb: [10, 12], knockdown: true, hitstop: 11 },
      },
      rising: { name: 'Shield Uppercut', kind: Kind.Special, juggle: 1, cancel: Cancel.Super, startup: 6, active: 9, recovery: 32, invuln: 8, damage: 130, chip: 16, hitstun: 30, blockstun: 20, kb: [6, 21], knockdown: true, hitstop: 14, hitbox: { x: 0, y: 100, w: 100, h: 190 } },
      super: { name: 'Titan Smash', kind: Kind.Super, juggle: 1, meterCost: 1000, startup: 8, active: 24, recovery: 30, hits: 4, rehit: 6, advance: 7, invuln: 18, damage: 78, chip: 24, hitstun: 32, blockstun: 22, kb: [4, 24], knockdown: true, hitstop: 10, hitbox: { x: 0, y: 0, w: 180, h: 240 } },
    },
  }),
  // Malcolm "The Captain": tactical support. A fast suppressing round, a squadmate who breaches at
  // mid-range, and a breach kick that holds the line. Plays the space between the Rogue and the Leader.
  hero({
    id: 'malcolm',
    name: 'Malcolm',
    color: '#2f7bff',
    stats: {
      maxHealth: 1000, walkSpeed: 5, backWalkSpeed: 4, jumpVelocity: 21, jumpSpeedX: 6, gravity: 1,
      width: 74, height: 236, crouchHeight: 150, dashSpeed: 13, dashTicks: 14, backdashSpeed: 11, backdashTicks: 16,
    },
    bodies: {
      stand: { x: -37, y: 0, w: 74, h: 236 },
      crouch: { x: -41, y: 0, w: 82, h: 150 },
      air: { x: -37, y: 30, w: 74, h: 186 },
    },
    moves: {
      light: { name: 'Quick Strike', startup: 4, active: 3, recovery: 8, damage: 32, hitstun: 15, blockstun: 11, kb: [3, 0], hitstop: 7, cancel: ALL, hitbox: { x: 15, y: 156, w: 90, h: 32 } },
      heavy: { name: 'Suppress', startup: 9, active: 4, recovery: 19, damage: 86, hitstun: 25, blockstun: 18, kb: [11, 0], hitstop: 12, advance: 2, cancel: SP, hitbox: { x: 15, y: 128, w: 118, h: 60 } },
      // Breach kick: a door-kick that holds the line, safe when blocked.
      kick: { name: 'Breach Kick', startup: 11, active: 4, recovery: 16, damage: 76, hitstun: 22, blockstun: 19, kb: [16, 0], hitstop: 11, cancel: SP, hitbox: { x: 20, y: 90, w: 124, h: 70 } },
      crouchLight: { name: 'Low Check', guard: Guard.Low, body: 'crouch', startup: 4, active: 3, recovery: 9, damage: 26, hitstun: 14, blockstun: 10, kb: [3, 0], hitstop: 7, cancel: ALL, hitbox: { x: 20, y: 104, w: 98, h: 52 } },
      sweep: { name: 'Sweep the Ground', guard: Guard.Low, body: 'crouch', startup: 10, active: 4, recovery: 25, damage: 78, knockdown: true, blockstun: 14, kb: [8, 6], hitstop: 11, cancel: Cancel.Super, hitbox: { x: 10, y: 0, w: 132, h: 84 } },
      jumpAttack: { name: 'From Above', guard: Guard.High, body: 'air', air: true, startup: 5, active: 14, recovery: 4, damage: 74, hitstun: 20, blockstun: 14, kb: [6, 0], hitstop: 10, hitbox: { x: 10, y: 40, w: 122, h: 120 } },
      throw: { name: 'Takedown', kind: Kind.Throw, guard: Guard.Throw, limb: false, startup: 4, active: 2, recovery: 24, damage: 118, knockdown: true, kb: [14, 14], hitstop: 14, hitbox: { x: 10, y: 60, w: 74, h: 124 } },
      // Gear Up: a squadmate breaches in at mid-range and holds there for a moment.
      special: {
        name: 'Gear Up', kind: Kind.Special, startup: 19, active: 1, recovery: 32,
        projectile: { x: 140, y: 0, w: 150, h: 160, speed: 0, life: 16, damage: 84, chip: 10, hitstun: 24, blockstun: 14, kb: [12, 14], knockdown: true, hitstop: 12 },
      },
      // Suppressing fire: a quick, light round, paid for with a long recovery so it cannot be spammed.
      projectile: {
        name: 'Suppressing Fire', kind: Kind.Special, startup: 13, active: 1, recovery: 32,
        projectile: { x: 70, y: 146, w: 60, h: 26, speed: 13, life: 80, damage: 50, chip: 8, hitstun: 18, blockstun: 12, kb: [7, 0], hitstop: 7 },
      },
      rising: { name: 'Get Back Up', kind: Kind.Special, juggle: 1, cancel: Cancel.Super, startup: 5, active: 9, recovery: 31, invuln: 7, damage: 124, chip: 16, hitstun: 30, blockstun: 20, kb: [6, 22], knockdown: true, hitstop: 12, hitbox: { x: 0, y: 100, w: 92, h: 180 } },
      super: { name: 'Operation: Backup', kind: Kind.Super, juggle: 1, meterCost: 1000, startup: 7, active: 30, recovery: 28, hits: 6, rehit: 5, invuln: 18, damage: 56, chip: 20, hitstun: 32, blockstun: 20, kb: [4, 22], knockdown: true, hitstop: 8, hitbox: { x: -40, y: 0, w: 330, h: 260 } },
    },
  }),
];

for (const h of heroes) {
  writeFileSync(join(outDir, `${h.id}.json`), JSON.stringify(h, null, 1) + '\n');
  console.log('wrote', h.id);
}
