// The simulation: one fixed-step world holding the player, the enemies, the
// bullets, the pickups and the particles. It knows nothing about the screen or
// the keyboard — the loop feeds it an input each step and reads back events.
// Waves grow in size and speed; every fifth wave a Void Herald boss arrives;
// clearing wave 10 wins the run.

import { BEACON, COMBO_WINDOW, DROPS, ENEMY_BULLET, FIELD, NOVA, PLAYER, VICTORY_WAVE, WAVE } from './config.js';
import { heraldWantsSummon, spawnEnemy, steerEnemy } from './enemies.js';
import { createBuild, drawUpgradeChoices } from './upgrades.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_WAVE_CLEAR = 4;
export const EVENT_BOSS = 8;
export const EVENT_OVER = 16;
export const EVENT_VICTORY = 32;
export const EVENT_PICKUP = 64;
export const EVENT_NOVA = 128;
export const EVENT_DASH = 256;

const TAU = Math.PI * 2;

/** The wave's spawn list: minions by wave, the Herald slipped in mid-wave. */
export function buildWaveQueue(random, wave) {
  const count = WAVE.baseCount + wave * WAVE.perWave;
  const queue = [];
  for (let i = 0; i < count; i += 1) {
    const roll = random.next();
    let kind = 'mote';
    if (wave >= 4 && roll > 0.86) kind = 'dasher';
    else if (wave >= 3 && roll > 0.68) kind = 'splitter';
    else if (wave >= 2 && roll > 0.48) kind = 'spitter';
    queue.push(kind);
  }
  if (wave % 5 === 0) queue.splice(Math.floor(queue.length / 3), 0, 'herald');
  return queue;
}

function addParticles(state, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    if (state.particles.length >= 420) return;
    const angle = Math.random() * TAU;
    const v = speed * (0.3 + Math.random() * 0.7);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: life * (0.6 + Math.random() * 0.4),
      maxLife: life,
      color,
      size: size * (0.6 + Math.random() * 0.8),
    });
  }
}

function addText(state, x, y, text, color) {
  if (state.texts.length > 24) state.texts.shift();
  state.texts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

/** A fresh world. Call reset() then beginWave(1) to start a run. */
export function createWorld(random) {
  const state = {
    time: 0,
    wave: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    phase: 'idle',
    player: null,
    build: createBuild(),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    texts: [],
    pickups: [],
    spawnQueue: [],
    spawnTimer: 0,
    boss: null,
    shake: 0,
    banner: { text: '', sub: '', timer: 0 },
    upgradeChoices: [],
    overchargeTimer: 0,
    novaCooldown: 0,
    stats: { shotsFired: 0, shotsHit: 0 },
    nextId: 1,
    beaconPulse: 0,
  };

  function resetPlayer() {
    state.build = createBuild();
    state.player = {
      x: FIELD.width / 2,
      y: FIELD.height - 140,
      vx: 0,
      vy: 0,
      hp: state.build.maxHp,
      radius: PLAYER.radius,
      fireCooldown: 0,
      dashCooldown: 0,
      dashTime: 0,
      dashX: 0,
      dashY: 1,
      invuln: 0,
      aimX: FIELD.width / 2,
      aimY: 0,
      moving: false,
    };
  }

  function reset() {
    state.time = 0;
    state.wave = 0;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.kills = 0;
    state.phase = 'idle';
    state.enemies = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.particles = [];
    state.texts = [];
    state.pickups = [];
    state.spawnQueue = [];
    state.spawnTimer = 0;
    state.boss = null;
    state.shake = 0;
    state.banner = { text: '', sub: '', timer: 0 };
    state.upgradeChoices = [];
    state.overchargeTimer = 0;
    state.novaCooldown = 0;
    state.stats = { shotsFired: 0, shotsHit: 0 };
    state.nextId = 1;
    resetPlayer();
  }

  function beginWave(wave) {
    state.wave = wave;
    state.phase = 'wave';
    state.spawnQueue = buildWaveQueue(random, wave);
    state.spawnTimer = 1.1;
    const bossWave = wave % 5 === 0;
    state.banner = {
      text: bossWave ? `WAVE ${wave} — THE VOID HERALD` : `WAVE ${wave}`,
      sub: bossWave ? 'Something vast is coming. Hold the light.' : 'The Void stirs. Defend the Heartstar.',
      timer: 2.4,
    };
  }

  function chooseUpgrade(id) {
    const choice = state.upgradeChoices.find((entry) => entry.id === id);
    if (!choice || state.phase !== 'upgrade') return false;
    choice.apply(state.build);
    state.player.hp = Math.min(state.build.maxHp, state.player.hp);
    state.upgradeChoices = [];
    beginWave(state.wave + 1);
    return true;
  }

  function killEnemy(enemy, index) {
    const player = state.player;
    state.enemies.splice(index, 1);
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO_WINDOW;
    const multiplier = (1 + Math.min(state.combo, 40) * 0.05) * (1 + state.build.scoreBonus);
    const gained = Math.round(enemy.score * multiplier);
    state.score += gained;
    addText(state, enemy.x, enemy.y - 10, `+${gained}`, '#ffd60a');
    addParticles(state, enemy.x, enemy.y, enemy.color, enemy.kind === 'herald' ? 60 : 26, 260, 0.6, 4);
    addParticles(state, enemy.x, enemy.y, '#ffffff', 10, 160, 0.35, 3);
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 3; i += 1) {
        const mini = spawnEnemy(random, 'mini', state.wave, player);
        mini.x = enemy.x + (i - 1) * 22;
        mini.y = enemy.y;
        state.enemies.push(mini);
      }
    }
    if (enemy.kind === 'herald') {
      state.boss = null;
      state.shake = Math.max(state.shake, 14);
      addParticles(state, enemy.x, enemy.y, '#ff2e63', 80, 420, 1.1, 6);
      addParticles(state, enemy.x, enemy.y, '#ffd60a', 40, 300, 0.9, 5);
    }
    // One drop roll per kill.
    const roll = random.next();
    let drop = null;
    if (roll < DROPS.shard) drop = 'shard';
    else if (roll < DROPS.shard + DROPS.heart) drop = 'heart';
    else if (roll < DROPS.shard + DROPS.heart + DROPS.overcharge) drop = 'overcharge';
    if (drop) {
      state.pickups.push({
        kind: drop, x: enemy.x, y: enemy.y, vx: 0, vy: 0, life: 12, bob: random.range(0, TAU),
      });
    }
    return gained;
  }

  function hurtPlayer(amount, fromX, fromY) {
    const player = state.player;
    if (player.invuln > 0 || player.dashTime > 0 || state.phase !== 'wave') return 0;
    player.hp -= amount;
    player.invuln = 0.9;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = Math.max(state.shake, 9);
    const dx = player.x - fromX;
    const dy = player.y - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    player.vx += (dx / dist) * 260;
    player.vy += (dy / dist) * 260;
    addParticles(state, player.x, player.y, '#ff2e63', 14, 240, 0.5, 4);
    return EVENT_HIT;
  }

  function fireVolley() {
    const player = state.player;
    const build = state.build;
    const aimDx = player.aimX - player.x;
    const aimDy = player.aimY - player.y;
    const baseAngle = Math.atan2(aimDy, aimDx);
    const count = build.projectiles;
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * 0.14;
      const angle = baseAngle + offset;
      state.bullets.push({
        x: player.x + Math.cos(angle) * 20,
        y: player.y + Math.sin(angle) * 20,
        vx: Math.cos(angle) * PLAYER.bulletSpeed,
        vy: Math.sin(angle) * PLAYER.bulletSpeed,
        damage: build.bulletDamage,
        pierce: build.pierce,
        radius: PLAYER.bulletRadius,
        hit: new Set(),
        life: 1.4,
      });
    }
    state.stats.shotsFired += count;
    addParticles(state, player.x + Math.cos(baseAngle) * 22, player.y + Math.sin(baseAngle) * 22, '#8ef6ff', 3, 90, 0.18, 2);
  }

  function novaBlast() {
    const player = state.player;
    const build = state.build;
    state.novaCooldown = build.novaCooldown;
    state.shake = Math.max(state.shake, 12);
    addParticles(state, player.x, player.y, '#ffd60a', 46, 520, 0.7, 5);
    addParticles(state, player.x, player.y, '#4de8ff', 30, 380, 0.5, 4);
    let events = EVENT_NOVA;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist < NOVA.radius + enemy.radius) {
        const nx = dist > 1 ? (enemy.x - player.x) / dist : 0;
        const ny = dist > 1 ? (enemy.y - player.y) / dist : 0;
        enemy.x += nx * 26;
        enemy.y += ny * 26;
        enemy.hp -= build.novaDamage;
        enemy.flash = 0.15;
        if (enemy.hp <= 0) {
          killEnemy(enemy, i);
          events |= EVENT_KILL;
        }
      }
    }
    return events;
  }

  /**
   * Advance the world one fixed step. `input` is { moveX, moveY, aimX, aimY,
   * dash, nova } in arena coordinates; in attract mode the world plays itself
   * behind the title screen. Returns an events bitmask for sounds and screens.
   */
  function step(dt, input, attract) {
    state.time += dt;
    state.beaconPulse += dt;
    if (state.banner.timer > 0) state.banner.timer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
    if (state.overchargeTimer > 0) state.overchargeTimer -= dt;
    if (state.novaCooldown > 0) state.novaCooldown -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) state.texts.splice(i, 1);
    }

    if (attract) {
      // Title backdrop: motes drift across the arena and fade at the edges.
      if (state.enemies.length < 9 && random.next() < dt * 1.2) {
        const mote = spawnEnemy(random, 'mote', 1, { x: FIELD.width / 2, y: FIELD.height / 2 });
        mote.speed *= 0.5;
        state.enemies.push(mote);
      }
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
        const e = state.enemies[i];
        e.x += Math.cos(e.wobble + state.time * 0.4) * e.speed * dt * 0.4;
        e.y += Math.sin(e.wobble * 1.3 + state.time * 0.3) * e.speed * dt * 0.4;
        if (e.x < -40 || e.x > FIELD.width + 40 || e.y < -40 || e.y > FIELD.height + 40) state.enemies.splice(i, 1);
      }
      if (random.next() < dt * 2) {
        addParticles(state, random.range(0, FIELD.width), random.range(0, FIELD.height), '#7c5cff', 1, 12, 1.6, 2);
      }
      return 0;
    }

    if (state.phase !== 'wave') return 0;
    const player = state.player;
    const build = state.build;
    let events = 0;

    // The Heartstar heals anyone standing in its light.
    const beaconDist = Math.hypot(player.x - BEACON.x, player.y - BEACON.y);
    if (beaconDist < BEACON.radius && player.hp < build.maxHp) {
      player.hp = Math.min(build.maxHp, player.hp + BEACON.healPerSecond * dt);
      if (random.next() < dt * 6) {
        addParticles(state, player.x + random.range(-12, 12), player.y + random.range(-12, 12), '#ffd60a', 1, 30, 0.5, 2);
      }
    }

    // --- Player movement and dash ---
    if (player.invuln > 0) player.invuln -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (input.dash && player.dashCooldown <= 0) {
      const moving = input.moveX !== 0 || input.moveY !== 0;
      const dx = moving ? input.moveX : Math.cos(Math.atan2(player.aimY - player.y, player.aimX - player.x));
      const dy = moving ? input.moveY : Math.sin(Math.atan2(player.aimY - player.y, player.aimX - player.x));
      player.dashX = dx;
      player.dashY = dy;
      player.dashTime = PLAYER.dashTime;
      player.dashCooldown = build.dashCooldown;
      player.invuln = Math.max(player.invuln, PLAYER.dashInvuln);
      events |= EVENT_DASH;
      addParticles(state, player.x, player.y, '#4de8ff', 10, 200, 0.35, 3);
    }
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      player.vx = player.dashX * PLAYER.dashSpeed;
      player.vy = player.dashY * PLAYER.dashSpeed;
    } else {
      player.vx = input.moveX * build.speed;
      player.vy = input.moveY * build.speed;
    }
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + player.vy * dt));
    player.aimX = input.aimX;
    player.aimY = input.aimY;
    player.moving = input.moveX !== 0 || input.moveY !== 0;

    // --- Firing (always on, aimed at the mouse) ---
    player.fireCooldown -= dt;
    if (player.fireCooldown <= 0) {
      fireVolley();
      player.fireCooldown = build.fireInterval * (state.overchargeTimer > 0 ? 0.5 : 1);
    }
    if (input.nova && state.novaCooldown <= 0) events |= novaBlast();

    // --- Spawning ---
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const kind = state.spawnQueue.shift();
        const enemy = spawnEnemy(random, kind, state.wave, player);
        state.enemies.push(enemy);
        if (kind === 'herald') {
          state.boss = enemy;
          events |= EVENT_BOSS;
          state.shake = Math.max(state.shake, 10);
        }
        const interval = Math.max(WAVE.spawnIntervalMin, WAVE.spawnInterval * Math.pow(0.97, state.wave - 1));
        state.spawnTimer = interval;
      }
    }

    // --- Enemies ---
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      if (enemy.flash > 0) enemy.flash -= dt;
      const orbs = steerEnemy(enemy, dt, player, random, state.time);
      for (const orb of orbs) {
        state.enemyBullets.push({ ...orb, radius: ENEMY_BULLET.radius, damage: ENEMY_BULLET.damage, life: 6 });
      }
      if (heraldWantsSummon(enemy)) {
        for (let k = 0; k < 3; k += 1) {
          const mote = spawnEnemy(random, 'mote', state.wave, player);
          mote.x = enemy.x + (k - 1) * 60;
          mote.y = enemy.y + 40;
          state.enemies.push(mote);
        }
        addParticles(state, enemy.x, enemy.y, '#ff2e63', 20, 200, 0.6, 4);
      }
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.x = Math.min(FIELD.width - enemy.radius, Math.max(enemy.radius, enemy.x));
      enemy.y = Math.min(FIELD.height - enemy.radius, Math.max(enemy.radius, enemy.y));
      // Touch damage.
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist < enemy.radius + player.radius) {
        events |= hurtPlayer(enemy.damage, enemy.x, enemy.y);
        enemy.x += ((enemy.x - player.x) / (dist || 1)) * 18;
        enemy.y += ((enemy.y - player.y) / (dist || 1)) * 18;
      }
    }
    // Keep enemies from stacking on each other.
    for (let i = 0; i < state.enemies.length; i += 1) {
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const a = state.enemies[i];
        const b = state.enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (dist > 0 && dist < min) {
          const push = (min - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }

    // --- Player bullets ---
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      let dead = bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20;
      if (!dead) {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = state.enemies[j];
          if (bullet.hit.has(enemy)) continue;
          const dist = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
          if (dist < enemy.radius + bullet.radius) {
            bullet.hit.add(enemy);
            enemy.hp -= bullet.damage;
            enemy.flash = 0.12;
            state.stats.shotsHit += 1;
            addParticles(state, bullet.x, bullet.y, '#8ef6ff', 4, 140, 0.3, 3);
            if (enemy.hp <= 0) {
              killEnemy(enemy, j);
              events |= EVENT_KILL;
            }
            if (bullet.pierce > 0) {
              bullet.pierce -= 1;
            } else {
              dead = true;
            }
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }

    // --- Enemy bullets ---
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const orb = state.enemyBullets[i];
      orb.life -= dt;
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      let dead = orb.life <= 0 || orb.x < -20 || orb.x > FIELD.width + 20 || orb.y < -20 || orb.y > FIELD.height + 20;
      if (!dead) {
        const dist = Math.hypot(orb.x - player.x, orb.y - player.y);
        if (dist < orb.radius + player.radius) {
          events |= hurtPlayer(orb.damage, orb.x, orb.y);
          dead = true;
        }
      }
      if (dead) state.enemyBullets.splice(i, 1);
    }

    // --- Pickups ---
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = state.pickups[i];
      pickup.life -= dt;
      pickup.bob += dt * 4;
      const dist = Math.hypot(player.x - pickup.x, player.y - pickup.y);
      if (dist < build.pickupRadius) {
        const pull = 340 * dt;
        pickup.x += ((player.x - pickup.x) / (dist || 1)) * pull;
        pickup.y += ((player.y - pickup.y) / (dist || 1)) * pull;
      }
      if (dist < player.radius + 16) {
        if (pickup.kind === 'shard') {
          const gained = Math.round(25 * (1 + state.build.scoreBonus));
          state.score += gained;
          addText(state, pickup.x, pickup.y - 8, `+${gained}`, '#7dffb2');
        } else if (pickup.kind === 'heart') {
          player.hp = Math.min(build.maxHp, player.hp + 20);
          addText(state, pickup.x, pickup.y - 8, '+20 HP', '#ff5d8f');
        } else {
          state.overchargeTimer = 8;
          addText(state, pickup.x, pickup.y - 8, 'OVERCHARGE!', '#ffe14d');
        }
        events |= EVENT_PICKUP;
        state.pickups.splice(i, 1);
        continue;
      }
      if (pickup.life <= 0) state.pickups.splice(i, 1);
    }

    // --- Wave clear / victory / death ---
    if (player.hp <= 0) {
      player.hp = 0;
      state.phase = 'over';
      state.shake = 16;
      addParticles(state, player.x, player.y, '#4de8ff', 70, 420, 1, 5);
      addParticles(state, player.x, player.y, '#ffffff', 30, 300, 0.8, 4);
      return events | EVENT_OVER;
    }
    if (state.spawnQueue.length === 0 && state.enemies.length === 0) {
      if (state.wave === VICTORY_WAVE) {
        state.phase = 'victory';
        return events | EVENT_VICTORY;
      }
      state.phase = 'upgrade';
      state.upgradeChoices = drawUpgradeChoices(random);
      return events | EVENT_WAVE_CLEAR;
    }
    return events;
  }

  return { state, reset, beginWave, chooseUpgrade, step };
}
