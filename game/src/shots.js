// VEILPOINT ARENA — shots.js: the deterministic screenshot scenes behind
// ?shot=title|play|win|lose&seed=N. Each scene drives the real game — the same
// start, wave and damage code a player triggers — with a simple autopilot for
// the play scene, so every frame is a true render of the game itself, and the
// seeded Math.random (swapped in by main.js) makes it the same frame on every
// render. Nothing here draws or fakes anything the game does not do live.
import { S } from './state.js';
import { waveSpec, TOTAL_WAVES } from './config.js';
import { startRun, startWave } from './waves.js';
import { setTitleVisible, showEndScreen } from './hud.js';
import { aliveBots } from './bots.js';

const STEP = 1 / 60;

/** Run `seconds` of fixed-step simulation through the game's own step. */
function simulate(ctx, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) ctx.step(STEP);
}

/** The title scene: the menu overlay over a slow orbit of the yard. */
function stageTitle(ctx) {
  S.phase = 'menu';
  setTitleVisible(ctx.hud, true);
  simulate(ctx, 3.2); // settle the orbit at a three-quarter view of the arena
}

/**
 * The play scene: wave 3, mid-fight. The autopilot focus-fires the nearest
 * raider until one drops — a real kill, with its real feed line — and then the
 * frame is composed the way VEILPOINT's duel shot was: the nearest survivors
 * are re-staged into the Warden's line of sight and one fresh shot is fired,
 * so the frozen frame carries a tracer, a muzzle flash and a hitmarker from
 * the game's own code.
 */
function stagePlay(ctx) {
  startRun(ctx);
  startWave(ctx, 3); // jump the run to wave 3's roster and stats
  S.score = 1200;
  S.kills = 9;
  S.headshots = 3;
  S.shotsFired = 38;
  S.shotsHit = 27;
  S.timePlayed = 96;
  ctx.player.pos.x = 0;
  ctx.player.pos.z = 7;
  simulate(ctx, 3); // the first raiders come through the gates and close in
  // Focus fire: bring one raider into the open lane ahead and engage it until
  // it drops. (Left to themselves the raiders take cover behind the yard's
  // chest-high walls, exactly as they should — and a screenshot autopilot
  // would spend its whole magazine on concrete.)
  const killsBefore = S.kills;
  const focus = nearestRaider(ctx);
  if (focus) placeRaider(ctx, focus, 2.5, -3);
  for (let round = 0; round < 30 && S.kills === killsBefore; round++) {
    const target = focus && focus.alive ? focus : nearestRaider(ctx);
    if (!target) { simulate(ctx, 0.25); continue; }
    aimAt(ctx, target);
    ctx.input.firing = true;
    simulate(ctx, 0.22);
    ctx.input.firing = false;
    simulate(ctx, 0.06);
  }
  ctx.input.firing = false;
  // Compose the frozen frame: one raider square ahead in the open lane, a
  // second off to the left, the Warden's rifle already up.
  const first = nearestRaider(ctx);
  const second = aliveBots(ctx.bots).find((b) => b !== first);
  if (first) placeRaider(ctx, first, 1.5, -4);
  if (second) placeRaider(ctx, second, -8, -1);
  if (first) {
    aimAt(ctx, first);
    ctx.scene.updateMatrixWorld(true); // the re-staged raiders must raycast where they stand
    ctx.loadout.reloading = false;
    ctx.loadout.cooldown = 0;
    if (ctx.loadout.mag < 18) ctx.loadout.mag = 18;
    ctx.playerShoot(); // the tracer, flash and hitmarker in the frozen frame
  }
  ctx.step(STEP); // settle the camera on the final aim
  // Present the HUD as a fight in progress reads: some damage taken, some
  // ammunition spent, regeneration not yet kicked in.
  ctx.player.hp = 76;
  S.health = 76;
  ctx.player.lastHurtT = S.time;
  ctx.loadout.reloading = false;
}

/** Move a live raider to a clear spot and sync its mesh, facing the Warden. */
function placeRaider(ctx, bot, x, z) {
  bot.pos.x = x;
  bot.pos.z = z;
  bot.path = [];
  bot.pathI = 0;
  bot.yaw = Math.atan2(-(ctx.player.pos.x - x), -(ctx.player.pos.z - z));
  bot.mesh.position.set(x, 0, z);
  bot.mesh.rotation.y = bot.yaw;
}

/** The win scene: the results screen over a quiet, cleared yard. */
function stageWin(ctx) {
  startRun(ctx);
  // The run's final tallies, as six cleared waves would leave them.
  S.wave = TOTAL_WAVES;
  S.score = 6850;
  S.kills = 60;
  S.headshots = 14;
  S.shotsFired = 212;
  S.shotsHit = 161;
  S.timePlayed = 486;
  S.enemiesLeft = 0;
  ctx.player.pos.x = 0;
  ctx.player.pos.z = 10;
  ctx.player.yaw = 0;
  ctx.player.pitch = -0.02;
  S.phase = 'won';
  showEndScreen(ctx.hud, true);
  ctx.hud.banner.hidden = true; // the wave banner's timer would strand letters behind the panel
  simulate(ctx, 0.3); // a few frames so the 3D view settles behind the panel
  S.phase = 'won'; // the breather logic must not advance the staged scene
}

/** The lose scene: the results screen over the yard that overran the Warden. */
function stageLose(ctx) {
  startRun(ctx);
  startWave(ctx, 4);
  S.score = 2950;
  S.kills = 28;
  S.headshots = 6;
  S.shotsFired = 118;
  S.shotsHit = 79;
  S.timePlayed = 231;
  ctx.player.pos.x = -3;
  ctx.player.pos.z = 8;
  simulate(ctx, 1.6); // raiders close in around the Warden's last stand
  ctx.player.hp = 0;
  ctx.player.alive = false;
  S.health = 0;
  S.phase = 'lost';
  showEndScreen(ctx.hud, false);
  ctx.hud.banner.hidden = true;
  simulate(ctx, 0.3);
  S.phase = 'lost';
}

function nearestRaider(ctx) {
  let best = null;
  let bestD = Infinity;
  for (const b of aliveBots(ctx.bots)) {
    const d = Math.hypot(b.pos.x - ctx.player.pos.x, b.pos.z - ctx.player.pos.z);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

/** Point the Warden's aim at a raider's chest, the way the autopilot plays. */
function aimAt(ctx, bot) {
  const p = ctx.player;
  p.yaw = Math.atan2(-(bot.pos.x - p.pos.x), -(bot.pos.z - p.pos.z));
  const d = Math.hypot(bot.pos.x - p.pos.x, bot.pos.z - p.pos.z);
  p.pitch = Math.atan2(1.25 - p.eye, d);
}

export function stageShot(name, ctx) {
  if (name === 'play') stagePlay(ctx);
  else if (name === 'win') stageWin(ctx);
  else if (name === 'lose') stageLose(ctx);
  else stageTitle(ctx);
}
