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
      maxHealth: 950, walkSpeed: 6, backWalkSpeed: 5, jumpVelocity: 22, jumpSpeedX: 7, gravity: 1,
      width: 70, height: 228, crouchHeight: 150, dashSpeed: 14, dashTicks: 14, backdashSpeed: 12, backdashTicks: 16,
    },
    bodies: {
      stand: { x: -35, y: 0, w: 70, h: 228 },
      crouch: { x: -40, y: 0, w: 80, h: 150 },
      air: { x: -35, y: 30, w: 70, h: 180 },
    },
    moves: {
      light: { name: 'Jab', startup: 4, active: 3, recovery: 7, damage: 30, hitstun: 15, blockstun: 11, kb: [6, 0], hitstop: 7, cancel: ALL, hitbox: { x: 15, y: 158, w: 78, h: 30 } },
      heavy: { name: 'Straight', startup: 8, active: 4, recovery: 18, damage: 80, hitstun: 24, blockstun: 17, kb: [10, 0], hitstop: 11, advance: 3, cancel: SP, hitbox: { x: 15, y: 132, w: 108, h: 40 } },
      kick: { name: 'High Kick', startup: 10, active: 4, recovery: 17, damage: 72, hitstun: 22, blockstun: 15, kb: [12, 0], hitstop: 10, cancel: SP, hitbox: { x: 20, y: 146, w: 120, h: 56 } },
      crouchLight: { name: 'Low Jab', guard: Guard.Low, body: 'crouch', startup: 4, active: 3, recovery: 8, damage: 24, hitstun: 14, blockstun: 10, kb: [5, 0], hitstop: 7, cancel: ALL, hitbox: { x: 20, y: 112, w: 100, h: 52 } },
      sweep: { name: 'Sweep', guard: Guard.Low, body: 'crouch', startup: 9, active: 4, recovery: 24, damage: 70, knockdown: true, blockstun: 14, kb: [7, 6], hitstop: 10, cancel: Cancel.Super, hitbox: { x: 10, y: 0, w: 110, h: 80 } },
      jumpAttack: { name: 'Flying Kick', guard: Guard.High, body: 'air', air: true, startup: 5, active: 14, recovery: 4, damage: 68, hitstun: 20, blockstun: 14, kb: [6, 0], hitstop: 10, hitbox: { x: 10, y: 50, w: 125, h: 120 } },
      throw: { name: 'Throw', kind: Kind.Throw, guard: Guard.Throw, limb: false, startup: 4, active: 2, recovery: 24, damage: 110, knockdown: true, kb: [14, 14], hitstop: 14, hitbox: { x: 10, y: 60, w: 70, h: 120 } },
      special: { name: 'Storm Palm', kind: Kind.Special, startup: 12, active: 6, recovery: 24, damage: 110, chip: 18, hitstun: 24, blockstun: 18, kb: [12, 16], knockdown: true, hitstop: 14, cancel: Cancel.Super, hitbox: { x: 20, y: 60, w: 120, h: 150 } },
      projectile: {
        name: 'Arc Bolt', kind: Kind.Special, startup: 12, active: 1, recovery: 28,
        projectile: { x: 70, y: 150, w: 70, h: 44, speed: 10, life: 110, damage: 70, chip: 12, hitstun: 20, blockstun: 16, kb: [10, 0], hitstop: 8 },
      },
      rising: { name: 'Rising Volt', kind: Kind.Special, startup: 4, active: 10, recovery: 30, invuln: 7, damage: 120, chip: 16, hitstun: 30, blockstun: 20, kb: [6, 22], knockdown: true, hitstop: 12, hitbox: { x: 0, y: 100, w: 90, h: 180 } },
      super: { name: 'Thunder Rush', kind: Kind.Super, meterCost: 1000, startup: 6, active: 24, recovery: 24, hits: 5, rehit: 5, advance: 10, invuln: 14, damage: 55, chip: 20, hitstun: 30, blockstun: 20, kb: [3, 20], knockdown: true, hitstop: 6, hitbox: { x: 0, y: 30, w: 150, h: 200 } },
    },
  }),
  hero({
    id: 'jetsetter',
    name: 'The Jetsetter',
    color: '#e0b030',
    stats: {
      maxHealth: 1050, walkSpeed: 5, backWalkSpeed: 4, jumpVelocity: 21, jumpSpeedX: 6, gravity: 1,
      width: 72, height: 232, crouchHeight: 150, dashSpeed: 12, dashTicks: 16, backdashSpeed: 10, backdashTicks: 18,
    },
    bodies: {
      stand: { x: -36, y: 0, w: 72, h: 232 },
      crouch: { x: -40, y: 0, w: 80, h: 150 },
      air: { x: -36, y: 30, w: 72, h: 180 },
    },
    moves: {
      light: { name: 'Smooth Jab', startup: 4, active: 3, recovery: 8, damage: 34, hitstun: 15, blockstun: 11, kb: [7, 0], hitstop: 7, cancel: ALL, hitbox: { x: 15, y: 158, w: 75, h: 30 } },
      heavy: { name: 'Power Strike', startup: 9, active: 4, recovery: 20, damage: 88, hitstun: 24, blockstun: 17, kb: [11, 0], hitstop: 12, cancel: SP, hitbox: { x: 15, y: 130, w: 125, h: 60 } },
      kick: { name: 'Step Kick', startup: 10, active: 4, recovery: 18, damage: 78, hitstun: 22, blockstun: 15, kb: [12, 0], hitstop: 11, cancel: SP, hitbox: { x: 20, y: 110, w: 110, h: 80 } },
      crouchLight: { name: 'Low Jab', guard: Guard.Low, body: 'crouch', startup: 4, active: 3, recovery: 9, damage: 26, hitstun: 14, blockstun: 10, kb: [5, 0], hitstop: 7, cancel: ALL, hitbox: { x: 20, y: 108, w: 82, h: 52 } },
      sweep: { name: 'Floor Sweep', guard: Guard.Low, body: 'crouch', startup: 10, active: 4, recovery: 25, damage: 80, knockdown: true, blockstun: 15, kb: [7, 6], hitstop: 11, cancel: Cancel.Super, hitbox: { x: 10, y: 0, w: 115, h: 96 } },
      jumpAttack: { name: 'Aerial Style', guard: Guard.High, body: 'air', air: true, startup: 6, active: 14, recovery: 4, damage: 76, hitstun: 20, blockstun: 14, kb: [6, 0], hitstop: 11, hitbox: { x: 10, y: 50, w: 110, h: 120 } },
      throw: { name: 'Throw', kind: Kind.Throw, guard: Guard.Throw, limb: false, startup: 4, active: 2, recovery: 24, damage: 120, knockdown: true, kb: [14, 14], hitstop: 14, hitbox: { x: 10, y: 60, w: 70, h: 120 } },
      special: { name: 'Smash Step', kind: Kind.Special, startup: 13, active: 6, recovery: 25, advance: 14, damage: 120, chip: 18, hitstun: 24, blockstun: 18, kb: [11, 16], knockdown: true, hitstop: 14, cancel: Cancel.Super, hitbox: { x: 10, y: 40, w: 140, h: 120 } },
      projectile: {
        name: 'Hot Record', kind: Kind.Special, startup: 14, active: 1, recovery: 30,
        projectile: { x: 60, y: 120, w: 56, h: 56, speed: 8, life: 140, damage: 76, chip: 13, hitstun: 21, blockstun: 16, kb: [10, 0], hitstop: 9 },
      },
      rising: { name: 'Encore', kind: Kind.Special, startup: 5, active: 9, recovery: 32, invuln: 7, damage: 130, chip: 16, hitstun: 30, blockstun: 20, kb: [6, 22], knockdown: true, hitstop: 12, hitbox: { x: 0, y: 100, w: 95, h: 180 } },
      super: { name: 'Crowd Pleaser', kind: Kind.Super, meterCost: 1000, startup: 8, active: 24, recovery: 30, hits: 4, rehit: 6, invuln: 16, damage: 75, chip: 22, hitstun: 32, blockstun: 20, kb: [5, 22], knockdown: true, hitstop: 8, hitbox: { x: -30, y: 0, w: 300, h: 260 } },
    },
  }),
];

for (const h of heroes) {
  writeFileSync(join(outDir, `${h.id}.json`), JSON.stringify(h, null, 1) + '\n');
  console.log('wrote', h.id);
}
