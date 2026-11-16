// AETHERFLARE — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between six
// screens: title, play, upgrade, paused, game over and victory.
//
// ?seed=N fixes the spawn pattern. ?shot=start|play|boss|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  initAudio,
  isMuted,
  playBoss,
  playDash,
  playGameOver,
  playKill,
  playNova,
  playPickup,
  playPlayerHurt,
  playShoot,
  playUpgrade,
  playVictory,
  playWaveClear,
  toggleMute,
} from './audio.js';
import { createWorld, EVENT_BOSS, EVENT_DASH, EVENT_KILL, EVENT_NOVA, EVENT_OVER, EVENT_PICKUP, EVENT_VICTORY, EVENT_WAVE_CLEAR, EVENT_HIT } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_NOVA, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Test and screenshot hooks: the live state, never used by the game itself.
  window.__aether = {
    world,
    get screen() {
      return screen;
    },
    start: startGame,
  };

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    initAudio();
    world.reset();
    world.beginWave(1);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Defend the Heartstar. Clear wave 10 to win.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    playGameOver();
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function winGame() {
    screen = SCREEN_VICTORY;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    playVictory();
    announce(`Victory! Score ${world.state.score}.`);
  }

  function inside(rect, point) {
    return rect && point && point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
  }

  function handleClick(point) {
    if (!point) return;
    const worldPoint = renderer.screenToWorld(point.x, point.y);
    const ui = renderer.ui;
    if (screen === SCREEN_TITLE && inside(ui.start, worldPoint)) startGame();
    else if (screen === SCREEN_UPGRADE) {
      for (const card of ui.cards) {
        if (inside(card, worldPoint)) {
          if (world.chooseUpgrade(card.id)) {
            playUpgrade();
            screen = SCREEN_PLAY;
            announce(`Upgrade taken. Wave ${world.state.wave}.`);
          }
          break;
        }
      }
    } else if (screen === SCREEN_OVER && inside(ui.restart, worldPoint)) startGame();
    else if (screen === SCREEN_VICTORY) {
      if (inside(ui.continue, worldPoint)) {
        world.beginWave(world.state.wave + 1);
        screen = SCREEN_PLAY;
        announce('Endless mode. The Void returns.');
      } else if (inside(ui.restart, worldPoint)) startGame();
    } else if (screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const muted = toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) startGame();
    else if (actions & ACTION_CONFIRM && screen === SCREEN_VICTORY) {
      world.beginWave(world.state.wave + 1);
      screen = SCREEN_PLAY;
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, null, true);
      return;
    }
    const aim = renderer.screenToWorld(input.mouseX, input.mouseY);
    const move = input.direction();
    const shotsBefore = world.state.stats.shotsFired;
    const events = world.step(
      STEP,
      {
        moveX: move.x,
        moveY: move.y,
        aimX: aim.x,
        aimY: aim.y,
        dash: Boolean(actions & ACTION_DASH),
        nova: Boolean(actions & ACTION_NOVA),
      },
      false,
    );
    if (world.state.stats.shotsFired > shotsBefore) playShoot();
    if (events & EVENT_HIT) playPlayerHurt();
    if (events & EVENT_KILL) playKill();
    if (events & EVENT_PICKUP) playPickup();
    if (events & EVENT_NOVA) playNova();
    if (events & EVENT_DASH) playDash();
    if (events & EVENT_BOSS) {
      playBoss();
      announce('The Void Herald has arrived!');
    }
    if (events & EVENT_WAVE_CLEAR) {
      playWaveClear();
      screen = SCREEN_UPGRADE;
      announce(`Wave ${world.state.wave} cleared. Choose an upgrade.`);
    }
    if (events & EVENT_VICTORY) winGame();
    else if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions(input.takeActions());
    const pick = input.takeUpgradePick();
    if (pick >= 1 && pick <= 3 && screen === SCREEN_UPGRADE) {
      const choice = world.state.upgradeChoices[pick - 1];
      if (choice && world.chooseUpgrade(choice.id)) {
        playUpgrade();
        screen = SCREEN_PLAY;
        announce(`Upgrade taken. Wave ${world.state.wave}.`);
      }
    }
    handleClick(input.takeClick());
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
      // A dash or nova pressed while the loop was catching up still fires once.
      if (screen === SCREEN_PLAY && accumulator < STEP) {
        // (actions are edge-triggered and were consumed by the steps above)
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the Void win unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Aetherflare. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
