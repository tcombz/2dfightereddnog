// Scaffolds the placeholder hero JSON files in src/heroes/.
// The JSON files are the source of truth: rerunning this overwrites hand edits.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'heroes');
mkdirSync(outDir, { recursive: true });

function move(body, spec) {
  const { hitbox, ...rest } = spec;
  const frames = [];
  const total = spec.startup + spec.active + spec.recovery;
  for (let i = 0; i < total; i++) {
    const active = i >= spec.startup && i < spec.startup + spec.active;
    // While the limb is out it can be hit too.
    const limb = { x: hitbox.x, y: hitbox.y, w: hitbox.w - 20, h: hitbox.h };
    frames.push({
      hitboxes: active ? [hitbox] : [],
      hurtboxes: active ? [body, limb] : [body],
    });
  }
  return { advance: 0, ...rest, frames };
}

function hero({ id, name, color, stats, moves }) {
  const half = stats.width >> 1;
  const stand = { x: -half, y: 0, w: stats.width, h: stats.height };
  const crouch = { x: -half, y: 0, w: stats.width, h: stats.crouchHeight };
  const air = { x: -half, y: 10, w: stats.width, h: stats.height - 30 };
  return {
    id,
    name,
    color,
    stats,
    hurtboxes: { stand: [stand], crouch: [crouch], air: [air] },
    moves: {
      light: move(stand, moves.light),
      heavy: move(stand, moves.heavy),
      special: move(stand, moves.special),
      kick: move(stand, moves.kick),
    },
  };
}

const heroes = [
  hero({
    id: 'brawler',
    name: 'Brawler',
    color: '#d9534f',
    stats: { maxHealth: 1000, walkSpeed: 4, backWalkSpeed: 3, jumpVelocity: 18, jumpSpeedX: 4, gravity: 1, width: 60, height: 120, crouchHeight: 70 },
    moves: {
      light: { startup: 4, active: 3, recovery: 8, damage: 40, chipDamage: 4, hitstun: 14, blockstun: 9, knockback: { x: 6, y: 0 }, knockdown: false, hitbox: { x: 20, y: 75, w: 70, h: 20 } },
      heavy: { startup: 9, active: 4, recovery: 18, damage: 90, chipDamage: 10, hitstun: 20, blockstun: 14, knockback: { x: 10, y: 0 }, knockdown: false, hitbox: { x: 20, y: 45, w: 95, h: 30 } },
      special: { startup: 14, active: 6, recovery: 26, damage: 140, chipDamage: 20, hitstun: 24, blockstun: 16, knockback: { x: 9, y: 14 }, knockdown: true, hitbox: { x: 10, y: 30, w: 110, h: 70 } },
      kick: { startup: 7, active: 4, recovery: 15, damage: 60, chipDamage: 6, hitstun: 16, blockstun: 11, knockback: { x: 9, y: 0 }, knockdown: false, hitbox: { x: 20, y: 50, w: 85, h: 26 } },
    },
  }),
  hero({
    id: 'striker',
    name: 'Striker',
    color: '#4f8fd9',
    stats: { maxHealth: 900, walkSpeed: 5, backWalkSpeed: 4, jumpVelocity: 19, jumpSpeedX: 5, gravity: 1, width: 54, height: 116, crouchHeight: 66 },
    moves: {
      light: { startup: 3, active: 3, recovery: 7, damage: 32, chipDamage: 3, hitstun: 12, blockstun: 8, knockback: { x: 5, y: 0 }, knockdown: false, hitbox: { x: 18, y: 78, w: 66, h: 18 } },
      heavy: { startup: 7, active: 4, recovery: 16, damage: 75, chipDamage: 8, hitstun: 18, blockstun: 12, knockback: { x: 9, y: 0 }, knockdown: false, hitbox: { x: 18, y: 20, w: 100, h: 26 } },
      special: { startup: 11, active: 8, recovery: 24, damage: 120, chipDamage: 16, hitstun: 22, blockstun: 15, knockback: { x: 11, y: 12 }, knockdown: true, hitbox: { x: 10, y: 40, w: 125, h: 40 } },
      kick: { startup: 6, active: 4, recovery: 14, damage: 52, chipDamage: 5, hitstun: 16, blockstun: 11, knockback: { x: 9, y: 0 }, knockdown: false, hitbox: { x: 18, y: 50, w: 88, h: 24 } },
    },
  }),
  // Sprite heroes: art in assets/heroes/<id>/ is drawn at 2x, so these bodies are about 240 px tall.
  hero({
    id: 'rogue',
    name: 'The Rogue',
    color: '#2f7bff',
    stats: { maxHealth: 900, walkSpeed: 6, backWalkSpeed: 5, jumpVelocity: 28, jumpSpeedX: 7, gravity: 2, width: 70, height: 230, crouchHeight: 150 },
    moves: {
      light: { startup: 3, active: 3, recovery: 7, damage: 32, chipDamage: 3, hitstun: 12, blockstun: 8, knockback: { x: 6, y: 0 }, knockdown: false, hitbox: { x: 20, y: 150, w: 75, h: 30 } },
      heavy: { advance: 5, startup: 8, active: 4, recovery: 16, damage: 78, chipDamage: 8, hitstun: 18, blockstun: 12, knockback: { x: 10, y: 0 }, knockdown: false, hitbox: { x: 20, y: 140, w: 105, h: 36 } },
      special: { startup: 12, active: 8, recovery: 24, damage: 120, chipDamage: 16, hitstun: 22, blockstun: 15, knockback: { x: 12, y: 16 }, knockdown: true, hitbox: { x: 20, y: 50, w: 130, h: 160 } },
      kick: { startup: 6, active: 4, recovery: 14, damage: 60, chipDamage: 6, hitstun: 16, blockstun: 11, knockback: { x: 9, y: 0 }, knockdown: false, hitbox: { x: 20, y: 150, w: 105, h: 40 } },
    },
  }),
  hero({
    id: 'jetsetter',
    name: 'The Jetsetter',
    color: '#e0b030',
    stats: { maxHealth: 1000, walkSpeed: 5, backWalkSpeed: 4, jumpVelocity: 28, jumpSpeedX: 6, gravity: 2, width: 72, height: 234, crouchHeight: 150 },
    moves: {
      light: { startup: 4, active: 3, recovery: 8, damage: 40, chipDamage: 4, hitstun: 14, blockstun: 9, knockback: { x: 7, y: 0 }, knockdown: false, hitbox: { x: 20, y: 150, w: 78, h: 30 } },
      heavy: { startup: 9, active: 4, recovery: 18, damage: 90, chipDamage: 10, hitstun: 20, blockstun: 14, knockback: { x: 11, y: 0 }, knockdown: false, hitbox: { x: 20, y: 115, w: 115, h: 70 } },
      special: { advance: 14, startup: 13, active: 6, recovery: 25, damage: 135, chipDamage: 18, hitstun: 24, blockstun: 16, knockback: { x: 11, y: 16 }, knockdown: true, hitbox: { x: 10, y: 60, w: 140, h: 100 } },
      kick: { startup: 7, active: 4, recovery: 15, damage: 68, chipDamage: 7, hitstun: 16, blockstun: 11, knockback: { x: 9, y: 0 }, knockdown: false, hitbox: { x: 20, y: 150, w: 110, h: 40 } },
    },
  }),
];

for (const h of heroes) {
  writeFileSync(join(outDir, `${h.id}.json`), JSON.stringify(h, null, 1) + '\n');
  console.log('wrote', h.id);
}
