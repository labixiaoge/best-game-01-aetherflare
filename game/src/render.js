// Everything the eye sees: the neon arena, the Heartstar beacon, the Warden
// and the Void, the HUD, the wave banners and every menu screen. The renderer
// owns the canvas transform (a fixed 1280x720 logical field scaled to the
// window) and records the clickable rectangles of the screen it just drew so
// the loop can answer mouse clicks on buttons and upgrade cards.

import { BEACON, FIELD, FONT, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

function makeStars() {
  // Deterministic starfield (its own fixed seed, so the backdrop never jumps).
  let seed = 1337;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const stars = [];
  for (let i = 0; i < 150; i += 1) {
    stars.push({
      x: next() * FIELD.width,
      y: next() * FIELD.height,
      r: 0.6 + next() * 1.7,
      phase: next() * Math.PI * 2,
      speed: 0.4 + next() * 1.2,
    });
  }
  return stars;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGlowCircle(ctx, x, y, radius, color, alpha) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawStar(ctx, x, y, radius, color, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * 0.38;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Attach to a canvas and return the renderer. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const stars = makeStars();
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let viewWidth = 1280;
  let viewHeight = 720;

  const renderer = {
    /** Clickable rectangles of the last drawn screen, in logical coordinates. */
    ui: { start: null, cards: [], restart: null, continue: null },
  };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    viewWidth = width;
    viewHeight = height;
    scale = Math.min(width / FIELD.width, height / FIELD.height);
    offsetX = (width - FIELD.width * scale) / 2;
    offsetY = (height - FIELD.height * scale) / 2;
  }

  window.addEventListener('resize', resize);
  resize();

  /** Convert a canvas CSS-pixel point to logical arena coordinates. */
  renderer.screenToWorld = function screenToWorld(x, y) {
    return { x: (x - offsetX) / scale, y: (y - offsetY) / scale };
  };

  function drawBackground(state, time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.backdropTop);
    gradient.addColorStop(1, PALETTE.backdropBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Twinkling stars.
    for (const star of stars) {
      const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#cfc8ff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Faint grid.
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 80) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
    }
    ctx.stroke();
    // Arena edge.
    ctx.strokeStyle = PALETTE.arenaEdge;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, FIELD.width - 8, FIELD.height - 8);
    ctx.globalAlpha = 1;
  }

  function drawBeacon(state) {
    const pulse = 1 + 0.1 * Math.sin(state.beaconPulse * 2.4);
    drawGlowCircle(ctx, BEACON.x, BEACON.y, BEACON.radius * 2.1 * pulse, 'rgba(255, 214, 10, 0.35)', 0.55);
    ctx.strokeStyle = 'rgba(255, 214, 10, 0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(BEACON.x, BEACON.y, BEACON.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    drawStar(ctx, BEACON.x, BEACON.y, 26 * pulse, PALETTE.beaconCore, state.beaconPulse * 0.4);
    ctx.fillStyle = PALETTE.beaconGlow;
    ctx.font = `600 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.85;
    ctx.fillText('HEARTSTAR — stand in its light to heal', BEACON.x, BEACON.y + BEACON.radius + 20);
    ctx.globalAlpha = 1;
  }

  function drawEnemy(enemy, time) {
    const flash = enemy.flash > 0;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    drawGlowCircle(ctx, 0, 0, enemy.radius * 2.1, enemy.color, flash ? 0.7 : 0.3);
    ctx.fillStyle = flash ? '#ffffff' : enemy.color;
    ctx.strokeStyle = flash ? '#ffffff' : enemy.color;
    ctx.lineWidth = 2;
    if (enemy.kind === 'mote') {
      drawStar(ctx, 0, 0, enemy.radius, enemy.color, time * 1.5 + enemy.wobble);
      ctx.fillStyle = '#1a0b2e';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'spitter') {
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0b2e';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'splitter') {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + time * 0.6;
        const px = Math.cos(a) * enemy.radius;
        const py = Math.sin(a) * enemy.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a0b2e';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'mini') {
      ctx.rotate(time * 3);
      ctx.fillRect(-enemy.radius * 0.7, -enemy.radius * 0.7, enemy.radius * 1.4, enemy.radius * 1.4);
    } else if (enemy.kind === 'dasher') {
      const aiming = enemy.state === 'aim';
      if (aiming) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 24);
        ctx.strokeStyle = '#ffe14d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(enemy.angle) * 120, Math.sin(enemy.angle) * 120);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.rotate(enemy.state === 'lunge' ? Math.atan2(enemy.vy, enemy.vx) : time * 0.8);
      ctx.beginPath();
      ctx.moveTo(enemy.radius + 6, 0);
      ctx.lineTo(-enemy.radius, enemy.radius * 0.8);
      ctx.lineTo(-enemy.radius * 0.4, 0);
      ctx.lineTo(-enemy.radius, -enemy.radius * 0.8);
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'herald') {
      ctx.rotate(time * 0.5);
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        ctx.moveTo(Math.cos(a) * enemy.radius * 0.8, Math.sin(a) * enemy.radius * 0.8);
        ctx.lineTo(Math.cos(a) * enemy.radius * 1.25, Math.sin(a) * enemy.radius * 1.25);
      }
      ctx.stroke();
      ctx.rotate(-time * 0.5);
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0b2e';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8fa3';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Health bar for hurt enemies and the boss.
    if (enemy.hp < enemy.maxHp) {
      const w = enemy.radius * 2;
      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w, 5);
      ctx.fillStyle = enemy.kind === 'herald' ? PALETTE.danger : '#7dffb2';
      ctx.fillRect(enemy.x - w / 2, enemy.y - enemy.radius - 12, w * ratio, 5);
    }
  }

  function drawPlayer(state, time) {
    const player = state.player;
    if (!player) return;
    const build = state.build;
    const blink = player.invuln > 0 && Math.sin(time * 30) > 0;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (!blink) {
      drawGlowCircle(ctx, 0, 0, 46, 'rgba(77, 232, 255, 0.5)', 0.8);
      // Aim line toward the mouse.
      const aimAngle = Math.atan2(player.aimY - player.y, player.aimX - player.x);
      ctx.rotate(aimAngle);
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-12, -11);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 11);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.playerCore;
      ctx.beginPath();
      ctx.arc(2, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      // Engine flame while moving.
      if (player.moving || player.dashTime > 0) {
        ctx.fillStyle = '#ffb703';
        ctx.beginPath();
        ctx.moveTo(-12, -5);
        ctx.lineTo(-26 - Math.random() * 10, 0);
        ctx.lineTo(-12, 5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.rotate(-aimAngle);
    }
    ctx.restore();
    // Aim reticle at the mouse.
    ctx.strokeStyle = 'rgba(142, 246, 255, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(player.aimX, player.aimY, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(player.aimX - 16, player.aimY);
    ctx.lineTo(player.aimX - 7, player.aimY);
    ctx.moveTo(player.aimX + 7, player.aimY);
    ctx.lineTo(player.aimX + 16, player.aimY);
    ctx.moveTo(player.aimX, player.aimY - 16);
    ctx.lineTo(player.aimX, player.aimY - 7);
    ctx.moveTo(player.aimX, player.aimY + 7);
    ctx.lineTo(player.aimX, player.aimY + 16);
    ctx.stroke();
    // Nova ready ring.
    if (state.novaCooldown <= 0) {
      ctx.strokeStyle = 'rgba(255, 214, 10, 0.7)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, 34 + Math.sin(time * 4) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Overcharge aura.
    if (state.overchargeTimer > 0) {
      ctx.strokeStyle = 'rgba(255, 225, 77, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 24, 0, Math.PI * 2);
      ctx.stroke();
    }
    void build;
  }

  function drawWorld(state, screen) {
    const time = state.time;
    drawBackground(state, time);
    if (screen !== SCREEN_TITLE) drawBeacon(state);
    // Pickups.
    for (const pickup of state.pickups) {
      const bob = Math.sin(pickup.bob) * 3;
      const blink = pickup.life < 3 ? (Math.sin(time * 12) > 0 ? 1 : 0.3) : 1;
      ctx.globalAlpha = blink;
      if (pickup.kind === 'shard') {
        drawGlowCircle(ctx, pickup.x, pickup.y + bob, 18, 'rgba(125, 255, 178, 0.6)', 0.8);
        drawStar(ctx, pickup.x, pickup.y + bob, 9, PALETTE.shard, time);
      } else if (pickup.kind === 'heart') {
        drawGlowCircle(ctx, pickup.x, pickup.y + bob, 18, 'rgba(255, 93, 143, 0.6)', 0.8);
        ctx.fillStyle = PALETTE.heart;
        ctx.font = `20px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('♥', pickup.x, pickup.y + bob + 7);
      } else {
        drawGlowCircle(ctx, pickup.x, pickup.y + bob, 20, 'rgba(255, 225, 77, 0.7)', 0.9);
        ctx.fillStyle = PALETTE.overcharge;
        ctx.font = `bold 18px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('⚡', pickup.x, pickup.y + bob + 6);
      }
      ctx.globalAlpha = 1;
    }
    for (const enemy of state.enemies) drawEnemy(enemy, time);
    // Enemy orbs.
    for (const orb of state.enemyBullets) {
      drawGlowCircle(ctx, orb.x, orb.y, 20, 'rgba(255, 122, 89, 0.55)', 0.9);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    if (screen !== SCREEN_TITLE) drawPlayer(state, time);
    // Player bullets: glowing streaks.
    ctx.strokeStyle = PALETTE.bullet;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const bullet of state.bullets) {
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.016, bullet.y - bullet.vy * 0.016);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Particles.
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Floating score text.
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    for (const t of state.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best) {
    const player = state.player;
    const build = state.build;
    ctx.textAlign = 'left';
    // Top-left: score.
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText(`SCORE ${state.score.toLocaleString('en-US')}`, 20, 40);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`BEST ${Math.max(best, state.score).toLocaleString('en-US')}   •   KILLS ${state.kills}`, 21, 62);
    // Top-centre: wave and enemies left.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(`WAVE ${Math.max(1, state.wave)} / ${10}`, FIELD.width / 2, 38);
    const remaining = state.spawnQueue.length + state.enemies.length;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `14px ${FONT}`;
    ctx.fillText(state.phase === 'wave' ? `${remaining} voidborn remain` : '', FIELD.width / 2, 60);
    // Boss bar.
    if (state.boss) {
      const ratio = Math.max(0, state.boss.hp / state.boss.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, FIELD.width / 2 - 220, 70, 440, 16, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.danger;
      roundRect(ctx, FIELD.width / 2 - 220, 70, 440 * ratio, 16, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillText('VOID HERALD', FIELD.width / 2, 104);
    }
    // Top-right: combo and timer.
    ctx.textAlign = 'right';
    const multiplier = 1 + Math.min(state.combo, 40) * 0.05;
    ctx.fillStyle = state.combo >= 8 ? PALETTE.gold : PALETTE.text;
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(state.combo > 1 ? `COMBO x${multiplier.toFixed(2)}  (${state.combo})` : 'COMBO —', FIELD.width - 20, 38);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60).toString().padStart(2, '0');
    ctx.fillText(`${minutes}:${seconds}`, FIELD.width - 20, 62);
    // Bottom-left: HP bar.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText('HULL', 20, FIELD.height - 52);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, 20, FIELD.height - 44, 260, 18, 9);
    ctx.fill();
    const hpRatio = Math.max(0, player.hp / build.maxHp);
    ctx.fillStyle = hpRatio > 0.5 ? '#37e08b' : hpRatio > 0.25 ? '#ffb703' : PALETTE.danger;
    roundRect(ctx, 20, FIELD.height - 44, 260 * hpRatio, 18, 9);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(`${Math.ceil(player.hp)} / ${build.maxHp}`, 290, FIELD.height - 30);
    // Bottom-right: dash and nova cooldowns.
    ctx.textAlign = 'right';
    const dashRatio = player.dashCooldown <= 0 ? 1 : 1 - player.dashCooldown / build.dashCooldown;
    const novaRatio = state.novaCooldown <= 0 ? 1 : 1 - state.novaCooldown / build.novaCooldown;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText('SPACE dash', FIELD.width - 20, FIELD.height - 52);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, FIELD.width - 140, FIELD.height - 44, 120, 10, 5);
    ctx.fill();
    ctx.fillStyle = dashRatio >= 1 ? PALETTE.player : '#2a7f9e';
    roundRect(ctx, FIELD.width - 140, FIELD.height - 44, 120 * dashRatio, 10, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('CLICK nova blast', FIELD.width - 20, FIELD.height - 24);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, FIELD.width - 140, FIELD.height - 16, 120, 10, 5);
    ctx.fill();
    ctx.fillStyle = novaRatio >= 1 ? PALETTE.gold : '#8a6d00';
    roundRect(ctx, FIELD.width - 140, FIELD.height - 16, 120 * novaRatio, 10, 5);
    ctx.fill();
    if (state.overchargeTimer > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.overcharge;
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillText(`OVERCHARGE ${state.overchargeTimer.toFixed(1)}s`, FIELD.width / 2, FIELD.height - 24);
    }
    // Wave banner.
    if (state.banner.timer > 0) {
      const alpha = Math.min(1, state.banner.timer);
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 44px ${FONT}`;
      ctx.fillText(state.banner.text, FIELD.width / 2, 190);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `18px ${FONT}`;
      ctx.fillText(state.banner.sub, FIELD.width / 2, 222);
      ctx.globalAlpha = 1;
    }
  }

  function dimOverlay(alpha) {
    ctx.fillStyle = `rgba(2, 1, 12, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 14);
    ctx.stroke();
  }

  function drawTitle(state, best) {
    drawWorld(state, SCREEN_TITLE);
    dimOverlay(0.45);
    ctx.textAlign = 'center';
    const pulse = 1 + 0.04 * Math.sin(state.time * 2);
    ctx.save();
    ctx.translate(FIELD.width / 2, 150);
    ctx.scale(pulse, pulse);
    const gradient = ctx.createLinearGradient(-260, 0, 260, 0);
    gradient.addColorStop(0, '#4de8ff');
    gradient.addColorStop(0.5, '#b388ff');
    gradient.addColorStop(1, '#ff4d8d');
    ctx.fillStyle = gradient;
    ctx.font = `bold 84px ${FONT}`;
    ctx.fillText('AETHERFLARE', 0, 0);
    ctx.restore();
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText('DEFEND THE HEARTSTAR  •  SURVIVE THE VOID', FIELD.width / 2, 196);
    panel(FIELD.width / 2 - 330, 232, 660, 196);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `17px ${FONT}`;
    const lines = [
      'WASD / ARROWS — fly the Warden      MOUSE — aim your sparks (auto-fire)',
      'SPACE — dash through danger      CLICK — Nova Blast (clears nearby foes)',
      'Stand in the Heartstar’s golden light to heal. Clear wave 10 to win.',
      'Between waves, pick 1 of 3 upgrades. A Void Herald boss waits every 5 waves.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 268 + i * 30));
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('P pause    •    M mute    •    R restart', FIELD.width / 2, 452);
    if (best > 0) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText(`BEST SCORE  ${best.toLocaleString('en-US')}`, FIELD.width / 2, 492);
    }
    // Start button.
    const bw = 340;
    const bh = 64;
    const bx = FIELD.width / 2 - bw / 2;
    const by = 520;
    const glow = 0.6 + 0.4 * Math.sin(state.time * 3);
    ctx.save();
    ctx.shadowColor = '#4de8ff';
    ctx.shadowBlur = 24 * glow;
    ctx.fillStyle = '#123a4d';
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.stroke();
    ctx.fillStyle = '#eafcff';
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText('▶  START THE DEFENCE', FIELD.width / 2, by + 41);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('or press ENTER', FIELD.width / 2, by + 92);
    renderer.ui.start = { x: bx, y: by, w: bw, h: bh };
  }

  function drawUpgrade(state) {
    drawWorld(state, SCREEN_PLAY);
    drawHud(state, 0);
    dimOverlay(0.62);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillText(`WAVE ${state.wave} CLEARED!`, FIELD.width / 2, 130);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `19px ${FONT}`;
    ctx.fillText('Choose an upgrade — click a card or press 1, 2 or 3', FIELD.width / 2, 166);
    const cardW = 300;
    const cardH = 250;
    const gap = 28;
    const totalW = cardW * 3 + gap * 2;
    const startX = (FIELD.width - totalW) / 2;
    const y = 220;
    renderer.ui.cards = [];
    state.upgradeChoices.forEach((choice, i) => {
      const x = startX + i * (cardW + gap);
      panel(x, y, cardW, cardH);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillText(`PRESS ${i + 1}`, x + cardW / 2, y + 34);
      ctx.fillStyle = '#b388ff';
      ctx.font = `44px ${FONT}`;
      ctx.fillText(choice.icon, x + cardW / 2, y + 96);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillText(choice.name, x + cardW / 2, y + 138);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `16px ${FONT}`;
      wrapText(choice.desc, x + cardW / 2, y + 172, cardW - 36, 24);
      renderer.ui.cards.push({ x, y, w: cardW, h: cardH, id: choice.id });
    });
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(`Score ${state.score.toLocaleString('en-US')}  •  Next: wave ${state.wave + 1}`, FIELD.width / 2, y + cardH + 40);
  }

  function wrapText(text, cx, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lineY = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, cx, lineY);
        line = word;
        lineY += lineHeight;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, cx, lineY);
  }

  function drawPaused() {
    dimOverlay(0.6);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 52px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `19px ${FONT}`;
    ctx.fillText('Press P or click to resume — R restarts the run', FIELD.width / 2, FIELD.height / 2 + 32);
  }

  function drawStats(state, best, y) {
    const accuracy = state.stats.shotsFired > 0
      ? Math.round((state.stats.shotsHit / state.stats.shotsFired) * 100)
      : 0;
    const rows = [
      ['FINAL SCORE', state.score.toLocaleString('en-US')],
      ['BEST SCORE', Math.max(best, state.score).toLocaleString('en-US')],
      ['WAVE REACHED', String(Math.max(1, state.wave))],
      ['VOIDBORN DESTROYED', String(state.kills)],
      ['SPARK ACCURACY', `${accuracy}%`],
    ];
    ctx.font = `20px ${FONT}`;
    rows.forEach((row, i) => {
      const rowY = y + i * 34;
      ctx.textAlign = 'right';
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(row[0], FIELD.width / 2 - 12, rowY);
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(row[1], FIELD.width / 2 + 12, rowY);
    });
    return y + rows.length * 34;
  }

  function drawOver(state, best) {
    drawWorld(state, SCREEN_OVER);
    dimOverlay(0.66);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `bold 56px ${FONT}`;
    ctx.fillText('THE LIGHT FADES', FIELD.width / 2, 150);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    ctx.fillText('The Void overruns the Heartstar… this time.', FIELD.width / 2, 188);
    const afterStats = drawStats(state, best, 250);
    const bw = 360;
    const bh = 62;
    const bx = FIELD.width / 2 - bw / 2;
    const by = afterStats + 26;
    ctx.save();
    ctx.shadowColor = '#ff2e63';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#3d0f24';
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = PALETTE.danger;
    ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.stroke();
    ctx.fillStyle = '#ffe3ec';
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText('↻  PLAY AGAIN', FIELD.width / 2, by + 40);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('or press R / ENTER', FIELD.width / 2, by + 90);
    renderer.ui.restart = { x: bx, y: by, w: bw, h: bh };
  }

  function drawVictory(state, best) {
    drawWorld(state, SCREEN_VICTORY);
    dimOverlay(0.55);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `bold 56px ${FONT}`;
    ctx.fillText('THE VOID RECEDES!', FIELD.width / 2, 140);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    ctx.fillText('Wave 10 is clear — the Heartstar burns bright again. You win!', FIELD.width / 2, 178);
    const afterStats = drawStats(state, best, 232);
    const bw = 360;
    const bh = 60;
    const bx = FIELD.width / 2 - bw / 2;
    const by = afterStats + 22;
    ctx.fillStyle = '#123a4d';
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, bh, 12);
    ctx.stroke();
    ctx.fillStyle = '#eafcff';
    ctx.font = `bold 23px ${FONT}`;
    ctx.fillText('ENDLESS MODE — KEEP FIGHTING', FIELD.width / 2, by + 39);
    renderer.ui.continue = { x: bx, y: by, w: bw, h: bh };
    const rb = { x: bx, y: by + 78, w: bw, h: 52 };
    ctx.fillStyle = '#2a1430';
    roundRect(ctx, rb.x, rb.y, rb.w, rb.h, 12);
    ctx.fill();
    ctx.strokeStyle = '#b388ff';
    roundRect(ctx, rb.x, rb.y, rb.w, rb.h, 12);
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillText('↻  RESTART RUN  (R)', FIELD.width / 2, rb.y + 35);
    renderer.ui.restart = rb;
  }

  /** Paint the current frame. `screen` is one of the SCREEN_* constants. */
  renderer.draw = function draw(state, screen, best) {
    resize();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#020108';
    ctx.fillRect(0, 0, viewWidth, viewHeight);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
    if (state.shake > 0) {
      const s = state.shake;
      ctx.translate((Math.random() * 2 - 1) * s * 0.5, (Math.random() * 2 - 1) * s * 0.5);
    }
    renderer.ui = { start: null, cards: [], restart: null, continue: null };
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
    } else if (screen === SCREEN_UPGRADE) {
      drawUpgrade(state);
    } else if (screen === SCREEN_OVER) {
      drawOver(state, best);
    } else if (screen === SCREEN_VICTORY) {
      drawVictory(state, best);
    } else {
      drawWorld(state, screen);
      drawHud(state, best);
      if (screen === SCREEN_PAUSED) drawPaused();
    }
  };

  return renderer;
}
