// Enemy behaviour: how each kind moves, attacks and dies. The world owns the
// lists; this file owns the per-kind steering and the boss's attack patterns.

import { ENEMY_BULLET, ENEMY_KINDS, FIELD } from './config.js';

/** Build one enemy of `kind` at the arena edge, scaled to `wave`. */
export function spawnEnemy(random, kind, wave, player) {
  const base = ENEMY_KINDS[kind];
  const hpScale = 1 + (wave - 1) * 0.13;
  const speedScale = 1 + Math.min(0.45, (wave - 1) * 0.028);
  // Spawn on a random edge, at least 260px from the player.
  let x = 0;
  let y = 0;
  for (let tries = 0; tries < 12; tries += 1) {
    const edge = random.int(0, 3);
    if (edge === 0) {
      x = random.range(30, FIELD.width - 30);
      y = 26;
    } else if (edge === 1) {
      x = random.range(30, FIELD.width - 30);
      y = FIELD.height - 26;
    } else if (edge === 2) {
      x = 26;
      y = random.range(30, FIELD.height - 30);
    } else {
      x = FIELD.width - 26;
      y = random.range(30, FIELD.height - 30);
    }
    if (Math.hypot(x - player.x, y - player.y) > 260) break;
  }
  const enemy = {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: base.radius,
    hp: base.hp * hpScale,
    maxHp: base.hp * hpScale,
    speed: base.speed * speedScale * random.range(0.9, 1.1),
    damage: base.damage,
    score: base.score,
    color: base.color,
    flash: 0,
    state: 'chase',
    timer: random.range(0, 1),
    fireTimer: random.range(1.2, 2.4),
    burstTimer: 2.2,
    summonTimer: 5,
    angle: random.range(0, Math.PI * 2),
    wobble: random.range(0, Math.PI * 2),
  };
  return enemy;
}

/** Steer one enemy for `dt` seconds. Returns orbs it fired (for spitters and the boss). */
export function steerEnemy(enemy, dt, player, random, time) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  const orbs = [];
  enemy.timer -= dt;
  enemy.fireTimer -= dt;

  if (enemy.kind === 'mote' || enemy.kind === 'mini') {
    // A wobbling chase: never a perfectly straight line, so dodging feels alive.
    enemy.wobble += dt * 3;
    const wob = Math.sin(enemy.wobble) * 0.35;
    const px = -ny * wob;
    const py = nx * wob;
    enemy.vx = (nx + px) * enemy.speed;
    enemy.vy = (ny + py) * enemy.speed;
  } else if (enemy.kind === 'spitter') {
    // Keep a firing distance and strafe sideways; shoot when in range.
    const want = 260;
    const radial = dist > want + 40 ? 1 : dist < want - 40 ? -0.7 : 0;
    const strafe = Math.sin(time * 0.9 + enemy.wobble) > 0 ? 1 : -1;
    enemy.vx = (nx * radial + -ny * strafe * 0.8) * enemy.speed;
    enemy.vy = (ny * radial + nx * strafe * 0.8) * enemy.speed;
    if (enemy.fireTimer <= 0 && dist < 520) {
      enemy.fireTimer = 2.3;
      orbs.push({ x: enemy.x, y: enemy.y, vx: nx * ENEMY_BULLET.speed, vy: ny * ENEMY_BULLET.speed });
    }
  } else if (enemy.kind === 'splitter') {
    enemy.vx = nx * enemy.speed;
    enemy.vy = ny * enemy.speed;
  } else if (enemy.kind === 'dasher') {
    if (enemy.state === 'chase') {
      enemy.vx = nx * enemy.speed;
      enemy.vy = ny * enemy.speed;
      if (dist < 250 && enemy.timer <= 0) {
        enemy.state = 'aim';
        enemy.timer = 0.55;
        enemy.angle = Math.atan2(dy, dx);
      }
    } else if (enemy.state === 'aim') {
      // Telegraph: stand still and glow before the lunge.
      enemy.vx = 0;
      enemy.vy = 0;
      if (enemy.timer <= 0) {
        enemy.state = 'lunge';
        enemy.timer = 0.42;
        enemy.vx = Math.cos(enemy.angle) * 720;
        enemy.vy = Math.sin(enemy.angle) * 720;
      }
    } else if (enemy.state === 'lunge') {
      if (enemy.timer <= 0) {
        enemy.state = 'chase';
        enemy.timer = 1.6;
      }
    }
  } else if (enemy.kind === 'herald') {
    // The Void Herald drifts toward the player, fires radial bursts and
    // calls motes to its side.
    enemy.vx = nx * enemy.speed;
    enemy.vy = ny * enemy.speed;
    enemy.burstTimer -= dt;
    enemy.summonTimer -= dt;
    if (enemy.burstTimer <= 0) {
      enemy.burstTimer = 2.7;
      const count = 12;
      for (let i = 0; i < count; i += 1) {
        const a = (i / count) * Math.PI * 2 + random.range(-0.1, 0.1);
        orbs.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(a) * ENEMY_BULLET.speed * 0.85,
          vy: Math.sin(a) * ENEMY_BULLET.speed * 0.85,
        });
      }
    }
  }
  return orbs;
}

/** Boss summon: true when the herald is ready to call motes. */
export function heraldWantsSummon(enemy) {
  if (enemy.kind !== 'herald') return false;
  if (enemy.summonTimer <= 0) {
    enemy.summonTimer = 7;
    return true;
  }
  return false;
}
