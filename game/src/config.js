// AETHERFLARE — every tuning number and colour in one place.
// The arena is a fixed 1280x720 logical field; the renderer scales it to the
// window, so no rule below depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

export const FIELD = { width: 1280, height: 720 };

/** The Heartstar beacon at the arena's heart: standing in its light heals you. */
export const BEACON = { x: 640, y: 360, radius: 84, healPerSecond: 5 };

export const PLAYER = {
  radius: 14,
  speed: 305,
  maxHp: 100,
  fireInterval: 0.26,
  bulletSpeed: 760,
  bulletDamage: 12,
  bulletRadius: 5,
  dashSpeed: 940,
  dashTime: 0.16,
  dashCooldown: 2.1,
  dashInvuln: 0.35,
  pickupRadius: 26,
};

export const NOVA = {
  radius: 230,
  damage: 55,
  cooldown: 6,
  knockback: 520,
};

export const COMBO_WINDOW = 3;
export const VICTORY_WAVE = 10;

/** Enemy kinds, their base stats and score values. */
export const ENEMY_KINDS = {
  mote: { radius: 15, hp: 22, speed: 118, damage: 10, score: 50, color: '#ff4d8d' },
  spitter: { radius: 17, hp: 34, speed: 88, damage: 12, score: 80, color: '#ff9f1c' },
  splitter: { radius: 24, hp: 60, speed: 72, damage: 14, score: 100, color: '#b388ff' },
  mini: { radius: 9, hp: 10, speed: 185, damage: 7, score: 20, color: '#e0aaff' },
  dasher: { radius: 16, hp: 40, speed: 105, damage: 16, score: 120, color: '#ffe14d' },
  herald: { radius: 48, hp: 950, speed: 52, damage: 22, score: 2000, color: '#ff2e63' },
};

export const ENEMY_BULLET = { radius: 7, speed: 235, damage: 12 };

/** How a wave is built: base count plus per-wave growth, and when each kind joins. */
export const WAVE = {
  baseCount: 7,
  perWave: 3,
  spawnInterval: 0.72,
  spawnIntervalMin: 0.26,
  hpScalePerWave: 0.13,
  speedScalePerWave: 0.028,
  speedScaleMax: 0.45,
};

/** Drop chances on a kill (roll once per kill, first match wins). */
export const DROPS = { shard: 0.13, heart: 0.05, overcharge: 0.035 };

export const PALETTE = {
  backdropTop: '#0b0620',
  backdropBottom: '#020108',
  grid: 'rgba(124, 92, 255, 0.07)',
  arenaEdge: '#7c5cff',
  beaconCore: '#fff3b0',
  beaconGlow: '#ffd60a',
  player: '#4de8ff',
  playerCore: '#eafcff',
  bullet: '#8ef6ff',
  enemyBullet: '#ff7a59',
  shard: '#7dffb2',
  heart: '#ff5d8f',
  overcharge: '#ffe14d',
  text: '#f2f0ff',
  muted: '#9d94c9',
  panel: 'rgba(16, 10, 42, 0.82)',
  panelEdge: '#6c5ce7',
  danger: '#ff2e63',
  gold: '#ffd60a',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'aetherflare.best';
