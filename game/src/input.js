// Keyboard and mouse state, read once per frame by the game loop.
// Movement keys give a normalised direction; the mouse gives an aim point in
// canvas pixels; edge-triggered actions (confirm, pause, dash, nova, mute,
// upgrade picks) are taken once via takeActions() and then cleared.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_NOVA = 8;
export const ACTION_MUTE = 16;
export const ACTION_RESTART = 32;

const MOVE_KEYS = {
  KeyW: [-0, -1],
  ArrowUp: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/** Attach listeners to the window/canvas and return the input state. */
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: null,
    upgradePick: 0,
    actions: 0,
  };

  function onKeyDown(event) {
    if (event.repeat) {
      if (MOVE_KEYS[event.code]) event.preventDefault();
      return;
    }
    keys.add(event.code);
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
    switch (event.code) {
      case 'Space':
        // Space both dashes in play and confirms on menus; the loop uses
        // whichever fits the screen it is on.
        input.actions |= ACTION_CONFIRM | ACTION_DASH;
        break;
      case 'Enter':
        input.actions |= ACTION_CONFIRM;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        input.actions |= ACTION_DASH;
        break;
      case 'KeyP':
      case 'Escape':
        input.actions |= ACTION_PAUSE;
        break;
      case 'KeyM':
        input.actions |= ACTION_MUTE;
        break;
      case 'KeyR':
        input.actions |= ACTION_RESTART;
        break;
      case 'Digit1':
        input.upgradePick = 1;
        break;
      case 'Digit2':
        input.upgradePick = 2;
        break;
      case 'Digit3':
        input.upgradePick = 3;
        break;
      default:
        break;
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  }

  function onMouseDown(event) {
    onMouseMove(event);
    input.mouseDown = true;
    if (event.button === 0) input.actions |= ACTION_NOVA;
  }

  function onMouseUp() {
    input.mouseDown = false;
  }

  function onClick(event) {
    const rect = canvas.getBoundingClientRect();
    input.clicked = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('click', onClick);
  window.addEventListener('blur', () => keys.clear());

  /** The movement direction this frame, normalised (0,0) when no key is held. */
  input.direction = function direction() {
    let x = 0;
    let y = 0;
    keys.forEach((code) => {
      const delta = MOVE_KEYS[code];
      if (delta) {
        x += delta[0];
        y += delta[1];
      }
    });
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const length = Math.hypot(x, y);
    return { x: x / length, y: y / length };
  };

  /** Edge-triggered actions since the last call; clears them. */
  input.takeActions = function takeActions() {
    const taken = input.actions;
    input.actions = 0;
    return taken;
  };

  /** The upgrade pick (1-3) pressed since the last call; clears it. */
  input.takeUpgradePick = function takeUpgradePick() {
    const pick = input.upgradePick;
    input.upgradePick = 0;
    return pick;
  };

  /** The last click position since the last call; clears it. */
  input.takeClick = function takeClick() {
    const click = input.clicked;
    input.clicked = null;
    return click;
  };

  return input;
}
