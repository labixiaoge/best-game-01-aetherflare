[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/labixiaoge/best-game-01-aetherflare/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/labixiaoge/best-game-01-aetherflare/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# AETHERFLARE — Defend the Heartstar

A neon twin-stick arena survival game for make.fun's **best-game-01**
competition. You are the Warden, a spark of living light, defending the
Heartstar — the last warm star — against waves of the Void.

## How to play

Serve `game/` with any static server and open `index.html` in desktop Chrome:

```sh
node serve.ts        # then open http://localhost:8080
```

No build step, no network requests, no libraries. All sound is synthesised
with WebAudio.

| Control | Action |
| --- | --- |
| WASD / Arrow keys | Fly the Warden |
| Mouse | Aim your sparks (auto-fire) |
| Space / Shift | Dash (brief invulnerability) |
| Click | Nova Blast — damages and knocks back nearby foes |
| 1 / 2 / 3 or click | Pick an upgrade between waves |
| P / Esc | Pause · M mute · R restart · Enter start |

## The game

- **Goal:** clear **wave 10** to win. Survive, and the run continues in
  endless mode.
- **The Heartstar:** the golden beacon at the arena's heart heals you while
  you stand in its light — but the fight comes to you anyway.
- **Enemies:** Motes (chasers), Spitters (ranged), Splitters (burst into
  minis), Dashers (telegraphed lunges), and a **Void Herald boss** every
  5 waves with radial bullet bursts and summoned minions.
- **Between waves:** pick 1 of 3 upgrades (fire rate, damage, multishot,
  piercing, speed, vitality, magnet, dash, nova, score) and build your run.
- **Scoring:** kills chain a combo multiplier; star shards, hearts and
  overcharge pickups drop from the fallen. Best score is kept locally.
- **Lose:** your hull hits 0 and the light fades — the game-over screen
  shows your score, wave, kills and accuracy, with one-click restart.

## Files

- `game/index.html` — the page; `game/src/` — the game, one job per file:
  `config.js` (tuning + palette), `random.js` (seeded RNG), `audio.js`
  (WebAudio synth SFX + music), `input.js` (keyboard + mouse),
  `enemies.js` (enemy steering + boss patterns), `upgrades.js` (upgrade
  pool), `world.js` (simulation: waves, collisions, pickups, scoring),
  `render.js` (canvas drawing, HUD, menus), `shots.js` (deterministic
  screenshot scenes + autopilot), `main.js` (boot + fixed-step loop).
- `screenshots/` — real renders of the game's own code at 1280x800:
  title, mid-game, boss fight, game over.
- `shots.json` — the `?shot=` scenes each screenshot was taken from.
- `main.ts` — the entry program: copies `game/` + `screenshots/` to
  `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json` with
  `vendor/makefun-game.ts` (the kit's copy, unchanged).
- `serve.ts` — a tiny static server for local play-testing.

## Verify locally

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # build the dossier
node tools/verify.mjs                                  # play-test + screenshots (see below)
```

`shots.json` lists the deterministic scenes; the screenshot script loads
each `?shot=…&seed=7` URL in headless Chromium and captures it once
`window.__shotReady` is set.

## License

MIT — see `LICENSE`.
