// Between-wave upgrades: the pool of cards the Warden picks from when a wave
// clears. Each upgrade has a name, a short description and an apply() that
// mutates the player's build. The world draws three distinct cards per wave.

export const UPGRADES = [
  {
    id: 'rapid',
    name: 'Rapid Caster',
    icon: '»»',
    desc: '+22% fire rate. Your sparks fly faster.',
    apply(build) {
      build.fireInterval *= 0.82;
    },
  },
  {
    id: 'heavy',
    name: 'Heavy Sparks',
    icon: '◆',
    desc: '+30% bullet damage. Fewer shots per kill.',
    apply(build) {
      build.bulletDamage *= 1.3;
    },
  },
  {
    id: 'twin',
    name: 'Twin Shot',
    icon: '⇉',
    desc: '+1 projectile per volley.',
    apply(build) {
      build.projectiles += 1;
    },
  },
  {
    id: 'pierce',
    name: 'Piercing Light',
    icon: '→',
    desc: 'Bullets pass through +1 enemy.',
    apply(build) {
      build.pierce += 1;
    },
  },
  {
    id: 'swift',
    name: 'Swift Boots',
    icon: '≫',
    desc: '+12% move speed.',
    apply(build) {
      build.speed *= 1.12;
    },
  },
  {
    id: 'vitality',
    name: 'Vitality',
    icon: '♥',
    desc: '+25 max HP and heal 25 now.',
    apply(build) {
      build.maxHp += 25;
      build.hp = Math.min(build.maxHp, build.hp + 25);
    },
  },
  {
    id: 'magnet',
    name: 'Star Magnet',
    icon: '◎',
    desc: 'Pickups fly to you from much further.',
    apply(build) {
      build.pickupRadius *= 1.8;
    },
  },
  {
    id: 'dash',
    name: 'Blink Dash',
    icon: '✦',
    desc: 'Dash recharges 35% faster.',
    apply(build) {
      build.dashCooldown *= 0.65;
    },
  },
  {
    id: 'nova',
    name: 'Nova Heart',
    icon: '✺',
    desc: 'Nova Blast recharges 40% faster and hits 30% harder.',
    apply(build) {
      build.novaCooldown *= 0.6;
      build.novaDamage *= 1.3;
    },
  },
  {
    id: 'greed',
    name: 'Greed of Stars',
    icon: '★',
    desc: '+50% score from every kill.',
    apply(build) {
      build.scoreBonus += 0.5;
    },
  },
];

/** The player's build: base stats plus everything upgrades changed. */
export function createBuild() {
  return {
    speed: 305,
    maxHp: 100,
    hp: 100,
    fireInterval: 0.26,
    bulletDamage: 12,
    projectiles: 1,
    pierce: 0,
    pickupRadius: 120,
    dashCooldown: 2.1,
    novaCooldown: 6,
    novaDamage: 55,
    scoreBonus: 0,
  };
}

/** Draw three distinct upgrade cards, using the world's random generator. */
export function drawUpgradeChoices(random) {
  const pool = UPGRADES.slice();
  const choices = [];
  while (choices.length < 3 && pool.length > 0) {
    const index = Math.floor(random.next() * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  return choices;
}

/** Find an upgrade by id (for the screenshot autopilot and tests). */
export function upgradeById(id) {
  return UPGRADES.find((entry) => entry.id === id) || null;
}
