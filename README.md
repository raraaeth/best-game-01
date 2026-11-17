# best-game-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/raraaeth/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/raraaeth/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**VEILPOINT ARENA** is a single-player wave-defense FPS built with Three.js. Night has fallen on the Duskworks yard, and Jackal raiders are coming over the walls in six waves. You are the last Warden on shift — hold the yard until dawn, or fall trying.

Play it with **WASD + mouse** — click to fire, **1 / 2 / Q** to swap between the Dawnline rifle and the Gunblade, **V** for a melee slash, **R** to reload, and **Shift** to sprint. Every kill scores; headshots pay a bonus. Survive all six waves to win — if your HP hits zero, the yard falls and the run ends. Between waves the yard breathes for a few seconds, so reload, reposition, and watch the gates.

- Six escalating waves, 60 raiders in all, across three enemy types: the standard Jackal, the fast and fragile Rusher that closes to point-blank, and the slow, towering Brute that soaks up fire
- Two weapons with different rhythms: the Dawnline hitscan rifle and the Gunblade's slash-and-shot combo
- Score chase with headshot bonuses, floating score popups, a kill feed, and win/lose results screens with restart

The game is plain static files under `game/` — Three.js is vendored, there is no build step, and it runs fully offline in a desktop browser. The entry program `main.ts` (Node, standard library only) hands it in: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `buildDossier` library.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

To play it locally, run `node serve.ts` and open http://localhost:8080.

---

<sub>Entered on [make.fun](https://make.fun/?ref=bright-sparrow-83&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
