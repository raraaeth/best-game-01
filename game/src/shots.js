// VEILPOINT ARENA — shots.js: the deterministic screenshot scenes behind
// ?shot=title|play|win|lose&seed=N. Each scene drives the real game — the same
// start, wave and damage code a player triggers — with a simple autopilot for
// the play scene, so every frame is a true render of the game itself, and the
// seeded Math.random (swapped in by main.js) makes it the same frame on every
// render. Nothing here draws or fakes anything the game does not do live.
import { S } from './state.js';
import { GATES, waveSpec, TOTAL_WAVES } from './config.js';
import { startRun, startWave } from './waves.js';
import { setTitleVisible, showEndScreen } from './hud.js';
import { aliveBots, spawnRaider } from './bots.js';

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
 * The play scene: wave 4, mid-fight — the first wave that fields all three
 * archetypes at once. The autopilot focus-fires the nearest raider until one
 * drops — a real kill, with its real feed line — and then the frame is
 * composed densely: a Brute looming left of the lane, a Rusher closing on the
 * right, a Jackal behind it, and one raider square ahead whose health is
 * staged low so the final shot is a kill — the frozen frame carries a tracer,
 * a muzzle flash, a hitmarker and the kill's floating score popup, all from
 * the game's own code.
 */
function stagePlay(ctx) {
  startRun(ctx);
  startWave(ctx, 4); // jump the run to wave 4's roster and stats
  S.score = 2400;
  S.kills = 17;
  S.headshots = 5;
  S.shotsFired = 71;
  S.shotsHit = 49;
  S.timePlayed = 168;
  ctx.player.pos.x = 0;
  ctx.player.pos.z = 5;
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
  // Compose the frozen frame: one of each archetype in the Warden's view, and
  // the kill target square ahead. A type still waiting in the spawn queue is
  // brought through the north gate by the game's own spawn code, so what the
  // frame shows is exactly what the wave fields.
  const hero = nearestRaider(ctx);
  const brute = ensureType(ctx, 'brute', hero);
  const rusher = ensureType(ctx, 'rusher', hero);
  const jackal = aliveBots(ctx.bots).find((b) => b.type === 'jackal' && b !== hero && b !== brute && b !== rusher)
    || aliveBots(ctx.bots).find((b) => b !== hero && b !== brute && b !== rusher);
  if (brute) placeRaider(ctx, brute, -3.4, -4.5);
  if (rusher) placeRaider(ctx, rusher, 4.6, -1.4);
  if (jackal) placeRaider(ctx, jackal, 6.8, -6);
  if (hero) {
    hero.hp = 20; // the composed shot finishes this one: popup, burst and all
    placeRaider(ctx, hero, 1.0, -0.6);
    aimAt(ctx, hero);
    ctx.scene.updateMatrixWorld(true); // the re-staged raiders must raycast where they stand
    ctx.loadout.reloading = false;
    ctx.loadout.cooldown = 0;
    if (ctx.loadout.mag < 18) ctx.loadout.mag = 18;
    ctx.step(STEP); // settle the camera on the final aim
    ctx.playerShoot(); // the tracer, flash, hitmarker and score popup in the frozen frame
  }
  // Present the HUD as a fight in progress reads: some damage taken, some
  // ammunition spent, regeneration not yet kicked in.
  ctx.player.hp = 76;
  S.health = 76;
  ctx.player.lastHurtT = S.time;
  ctx.loadout.reloading = false;
}

/**
 * A live raider of the wanted archetype, or null. If the wave has not sent
 * one through the gates yet, the next of its kind in the spawn queue is
 * activated at the north gate with the game's own spawn code (the queue and
 * the HUD's raiders-left count stay honest: one fewer queued, one more alive).
 */
function ensureType(ctx, type, exclude) {
  const alive = aliveBots(ctx.bots).find((b) => b.type === type && b !== exclude);
  if (alive) return alive;
  const qi = S.spawnQueue.indexOf(type);
  if (qi === -1) return null;
  S.spawnQueue.splice(qi, 1);
  S.queuedThisWave = S.spawnQueue.length;
  const bot = spawnRaider(ctx.bots, waveSpec(S.wave), GATES[0], ctx.nameCursor, type);
  if (bot) ctx.nameCursor++;
  return bot;
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
