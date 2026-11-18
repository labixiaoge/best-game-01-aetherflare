// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the
// real rules forward from a fresh world for a fixed amount of simulated time,
// steered by a simple autopilot (kite away from the nearest foe, heal at the
// Heartstar when hurt, aim at the closest enemy, dash out of trouble, nova
// when surrounded), so every frame is what a real game looks like and the same
// seed always gives the same frame. No wall clock is used anywhere here.
import { BEACON, FIELD, STEP } from './config.js';
import { EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 10;
const BOSS_WAIT_SECONDS = 40;
const BOSS_FIGHT_SECONDS = 5;
const END_LIMIT_SECONDS = 120;

/** The autopilot's input for one step: kite, heal, aim, dash, nova. */
export function autopilotInput(state, skilled) {
  const player = state.player;
  let nearest = null;
  let nearestDist = Infinity;
  let nearCount = 0;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = enemy;
    }
    if (dist < 230) nearCount += 1;
  }
  let moveX = 0;
  let moveY = 0;
  // Flee the nearest foe when it closes in; drift toward the arena centre.
  if (nearest && nearestDist < 170) {
    moveX += (player.x - nearest.x) / nearestDist;
    moveY += (player.y - nearest.y) / nearestDist;
  }
  moveX += (FIELD.width / 2 - player.x) / FIELD.width * 0.9;
  moveY += (FIELD.height / 2 - player.y) / FIELD.height * 0.9;
  // Hurt? Head for the Heartstar's healing light.
  const beaconDist = Math.hypot(player.x - BEACON.x, player.y - BEACON.y);
  if (player.hp < 55 && beaconDist > BEACON.radius * 0.7) {
    moveX += (BEACON.x - player.x) / beaconDist * 1.4;
    moveY += (BEACON.y - player.y) / beaconDist * 1.4;
  }
  // Chase the nearest pickup when it is close and safe.
  let pickup = null;
  let pickupDist = Infinity;
  for (const item of state.pickups) {
    const dist = Math.hypot(item.x - player.x, item.y - player.y);
    if (dist < pickupDist) {
      pickupDist = dist;
      pickup = item;
    }
  }
  if (pickup && pickupDist < 220 && (!nearest || nearestDist > 120)) {
    moveX += (pickup.x - player.x) / pickupDist;
    moveY += (pickup.y - player.y) / pickupDist;
  }
  const length = Math.hypot(moveX, moveY);
  if (length > 0) {
    moveX /= length;
    moveY /= length;
  }
  const aimX = nearest ? nearest.x : FIELD.width / 2;
  const aimY = nearest ? nearest.y : 0;
  return {
    moveX,
    moveY,
    aimX,
    aimY,
    dash: skilled && nearest !== null && nearestDist < 75 && player.dashCooldown <= 0,
    nova: skilled && nearCount >= 4 && state.novaCooldown <= 0,
  };
}

/** Run the world forward with the autopilot until `seconds` pass or it ends. */
function simulate(world, seconds, skilled) {
  const steps = Math.floor(seconds / STEP);
  let events = 0;
  for (let i = 0; i < steps; i += 1) {
    events = world.step(STEP, autopilotInput(world.state, skilled), false);
    if (events & EVENT_OVER) return events;
    if (events & EVENT_VICTORY) return events;
    if (events & EVENT_WAVE_CLEAR) {
      // Take the first upgrade card and keep playing.
      const choice = world.state.upgradeChoices[0];
      if (choice) world.chooseUpgrade(choice.id);
    }
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    // Wave 4, caught early while the spawn queue is still feeding foes in:
    // the frame shows a full, busy arena instead of the tail of a wave.
    world.beginWave(4);
    simulate(world, PLAY_SECONDS, true);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'boss') {
    world.beginWave(5);
    // Play until the Herald arrives, then a few seconds into the fight so
    // its radial bursts and summoned motes are on screen.
    for (let t = 0; t < BOSS_WAIT_SECONDS; t += STEP) {
      const events = world.step(STEP, autopilotInput(world.state, true), false);
      if (events & EVENT_WAVE_CLEAR) {
        const choice = world.state.upgradeChoices[0];
        if (choice) world.chooseUpgrade(choice.id);
      }
      if (world.state.boss) break;
      if (events & EVENT_OVER) break;
    }
    if (world.state.boss) simulate(world, BOSS_FIGHT_SECONDS, true);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    world.beginWave(2);
    // A careless pilot, already battered: it aims but never dashes, never
    // novas, never heals, and barely moves — the Void catches it.
    world.state.player.hp = 35;
    const steps = Math.floor(END_LIMIT_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      const input = autopilotInput(world.state, false);
      input.moveX *= 0.3;
      input.moveY *= 0.3;
      input.dash = false;
      input.nova = false;
      const events = world.step(STEP, input, false);
      if (events & EVENT_WAVE_CLEAR) {
        const choice = world.state.upgradeChoices[0];
        if (choice) world.chooseUpgrade(choice.id);
      }
      if (events & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // start (and anything else): the title over a living, drifting arena.
  for (let i = 0; i < Math.floor(START_SECONDS / STEP); i += 1) {
    world.step(STEP, null, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
