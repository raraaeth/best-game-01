// VEILPOINT ARENA — main.js: boot and the one loop. A fixed 60 Hz simulation
// feeds rendering at the display rate. Input lives here and nowhere else: the
// keyboard and mouse write an input state, the step reads it. ?shot=title|play|
// win|lose&seed=N stages a deterministic frame for a screenshot instead of
// starting the interactive loop.
import * as THREE from 'three';
import { S } from './state.js';
import { buildArena } from './arena.js';
import { createPlayer, updatePlayer, eyePos, aimDir, EYE_DOWN } from './player.js';
import { createBots, updateBots, aliveBots } from './bots.js';
import { WEAPONS, BUTT_STRIKE, newLoadout, shootHitscan, meleeSwing, createViewmodel, setViewmodel, updateViewmodel } from './weapons.js';
import { createFx, updateFx } from './fx.js';
import { createAudio } from './audio.js';
import { createHud, updateHud, setTitleVisible, setPausedVisible } from './hud.js';
import { startRun, updateWaves, damageBot, damagePlayer } from './waves.js';
import { stageShot } from './shots.js';
import { seedMathRandom } from './random.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
if (shot) seedMathRandom(seed);
S.shot = shot;

// ---- Debug surface for headless checks (also catches window errors). ----
const debugEl = document.getElementById('debug');
function debug(obj) { if (debugEl) debugEl.textContent = JSON.stringify(obj); }
window.addEventListener('error', (e) => debug({ error: String(e.message) }));

// ---- Renderer / scene. ----
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
document.getElementById('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1a26);
scene.fog = new THREE.Fog(0x1c1a26, 42, 115);
const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 180);
scene.add(camera);
// A small warm light riding with the camera so the viewmodel never reads black.
const camLight = new THREE.PointLight(0xffe0b8, 1.4, 4, 1.2);
camLight.position.set(0.3, 0.1, -0.4);
camera.add(camLight);

const arena = buildArena(scene);
const fx = createFx(scene);
camera.add(fx.flash);
const audio = createAudio();
const hud = createHud();
const player = createPlayer();
const bots = createBots(scene);
const loadout = newLoadout();
const vm = createViewmodel(camera);
setViewmodel(vm, loadout.current);
const raycaster = new THREE.Raycaster();

// The player's own hitbox: two boxes the raiders' hitscan can strike. The
// material is never drawn (material.visible is false) but the meshes raycast.
const hitMat = new THREE.MeshBasicMaterial();
hitMat.visible = false;
const playerBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.36), hitMat);
playerBody.position.y = 0.95;
const playerHead = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.34), hitMat);
playerHead.position.y = 1.62;
playerHead.userData.head = true;
playerBody.userData.agent = player;
playerHead.userData.agent = player;
const playerHitbox = new THREE.Group();
playerHitbox.add(playerBody, playerHead);
scene.add(playerHitbox);
const playerMeshes = [playerHead, playerBody];

// ---- Input. ----
const input = {
  forward: false, back: false, left: false, right: false, sprint: false,
  lookX: 0, lookY: 0, firing: false,
};
let locked = false;
let kick = 0;
let swingT = 0;
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _tmp = new THREE.Vector3();

function targetMeshes() {
  const out = [];
  for (const b of bots) if (b.active && b.alive) out.push(b.headMesh, b.bodyMesh);
  return out;
}

const ctx = {
  scene, player, bots, arena, hud, audio, fx, loadout,
  raycaster, walls: arena.wallMeshes, playerMeshes,
  input, nameCursor: 0,
  time: 0,
  setViewmodel: (id) => setViewmodel(vm, id),
  onDamagePlayer: (dmg, attacker) => damagePlayer(ctx, dmg, attacker),
  exitLock: () => { if (document.pointerLockElement) document.exitPointerLock(); },
  step: (dt) => step(dt),
  playerShoot: () => playerShoot(),
};

function botCtx() {
  return {
    arena, player, raycaster, walls: arena.wallMeshes, playerMeshes,
    fx, audio, time: S.time,
    onDamagePlayer: (dmg, attacker) => damagePlayer(ctx, dmg, attacker),
  };
}

// ---- Firing and swinging. ----
function playerShoot() {
  const def = WEAPONS[loadout.current];
  if (!def || loadout.cooldown > 0 || loadout.reloading) return;
  if (loadout.mag <= 0) {
    audio.dryFire();
    startReload();
    loadout.cooldown = 0.25;
    return;
  }
  loadout.mag--;
  loadout.cooldown = def.rof;
  S.shotsFired++;
  const spread = def.spread + (player.groundSpeed > 0.6 ? def.moveSpread : 0);
  eyePos(player, _origin);
  aimDir(player, _dir);
  shootHitscan({
    origin: _origin, dir: _dir, def, spread,
    raycaster, walls: arena.wallMeshes, targetMeshes: targetMeshes(),
    fx, attacker: player,
    onHit: (agent, dmg, head) => damageBot(ctx, agent, dmg, head, player),
  });
  audio.shot(player.pos, def, true, player.pos);
  fx.muzzleFlash();
  player.pitch += def.kick * 0.011;
  kick = Math.min(1, kick + def.kick * 0.35);
  if (loadout.mag === 0) startReload();
}

function playerMelee() {
  const def = WEAPONS[loadout.current];
  if (loadout.meleeCooldown > 0) return;
  const blade = def.kind === 'hybrid';
  loadout.meleeCooldown = blade ? def.rof + 0.28 : BUTT_STRIKE.rof;
  swingT = 0.45;
  eyePos(player, _origin);
  aimDir(player, _dir);
  meleeSwing({
    origin: _origin, dir: _dir, attacker: player,
    range: blade ? def.meleeRange : BUTT_STRIKE.range,
    dmg: blade ? def.meleeDmg : BUTT_STRIKE.dmg,
    targets: aliveBots(bots),
    fx,
    onHit: (agent, dmg, head) => damageBot(ctx, agent, dmg, head, player),
  });
  audio.swing();
}

function startReload() {
  const def = WEAPONS[loadout.current];
  if (!def || loadout.reloading || loadout.mag >= def.mag) return;
  loadout.reloading = true;
  loadout.reloadT = def.reload;
  audio.reload();
}

function switchWeapon(id) {
  if (!WEAPONS[id] || loadout.current === id) return;
  loadout.current = id;
  loadout.mag = WEAPONS[id].mag;
  loadout.cooldown = 0;
  loadout.reloading = false;
  setViewmodel(vm, id);
  audio.click();
}

// ---- Pointer lock and controls. ----
function requestLock() {
  try {
    const r = renderer.domElement.requestPointerLock();
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch { /* headless or refused: the game still runs */ }
}
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (!locked && !shot && (S.phase === 'live' || S.phase === 'waveclear')) setPausedVisible(hud, true);
  if (locked) setPausedVisible(hud, false);
});
document.addEventListener('mousemove', (e) => {
  if (!locked) return;
  input.lookX += e.movementX * 0.0022;
  input.lookY += e.movementY * 0.0022;
});
renderer.domElement.addEventListener('mousedown', (e) => {
  if (!locked) return;
  if (e.button === 0) input.firing = true;
  if (e.button === 2 && WEAPONS[loadout.current].kind === 'hybrid') playerMelee();
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.firing = false;
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('click', () => {
  if (!locked && !shot && (S.phase === 'live' || S.phase === 'waveclear')) requestLock();
});
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') input.forward = true;
  if (k === 's' || k === 'arrowdown') input.back = true;
  if (k === 'a' || k === 'arrowleft') input.left = true;
  if (k === 'd' || k === 'arrowright') input.right = true;
  if (k === 'shift') input.sprint = true;
  if (k === 'r') startReload();
  if (k === '1') switchWeapon('dawnline');
  if (k === '2') switchWeapon('gunblade');
  if (k === 'q') switchWeapon(loadout.current === 'dawnline' ? 'gunblade' : 'dawnline');
  if (k === 'v') playerMelee();
  if (k === ' ') e.preventDefault();
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') input.forward = false;
  if (k === 's' || k === 'arrowdown') input.back = false;
  if (k === 'a' || k === 'arrowleft') input.left = false;
  if (k === 'd' || k === 'arrowright') input.right = false;
  if (k === 'shift') input.sprint = false;
});
hud.startBtn.addEventListener('click', () => {
  audio.unlock();
  audio.click();
  setTitleVisible(hud, false);
  startRun(ctx);
  requestLock();
});
hud.restartBtn.addEventListener('click', () => {
  audio.unlock();
  audio.click();
  startRun(ctx);
  requestLock();
});

// ---- The fixed-step simulation. ----
function step(dt) {
  S.time += dt;
  ctx.time = S.time;
  if (S.phase === 'menu') {
    // Slow orbit over the yard behind the title overlay.
    const a = S.time * 0.07;
    camera.position.set(Math.sin(a) * 25, 15, Math.cos(a) * 25);
    camera.lookAt(0, 0.5, 0);
    updateFx(fx, dt);
    return;
  }
  if (S.phase === 'live' || S.phase === 'waveclear') {
    // Keep world matrices current for the hitscan: a render does this every
    // frame in live play, but screenshot staging runs the sim unrendered.
    scene.updateMatrixWorld(true);
    updatePlayer(player, dt, input, arena.colliders);
    // Cooldowns and reload.
    if (loadout.cooldown > 0) loadout.cooldown -= dt;
    if (loadout.meleeCooldown > 0) loadout.meleeCooldown -= dt;
    if (swingT > 0) swingT -= dt;
    if (loadout.reloading) {
      loadout.reloadT -= dt;
      if (loadout.reloadT <= 0) {
        loadout.mag = WEAPONS[loadout.current].mag;
        loadout.reloading = false;
      }
    }
    // Firing: held for the automatic rifle, per-click for the Gunblade
    // (its cooldown gates the rate either way).
    if (input.firing && player.alive) playerShoot();
    updateBots(bots, dt, botCtx());
    updateWaves(ctx, dt);
  } else if (S.phase === 'lost') {
    // The yard keeps moving around the fallen Warden.
    updateBots(bots, dt, botCtx());
    player.eye += (EYE_DOWN - player.eye) * Math.min(1, dt * 3);
  }
  // The hitbox follows the Warden; the camera rides the eye.
  playerHitbox.position.set(player.pos.x, 0, player.pos.z);
  playerHitbox.rotation.y = player.yaw;
  eyePos(player, _tmp);
  camera.position.copy(_tmp);
  camera.rotation.set(player.pitch, player.yaw, S.phase === 'lost' ? 0.3 : 0, 'YXZ');
  kick = Math.max(0, kick - dt * 5);
  updateViewmodel(vm, S.time, player.moving, kick, Math.max(0, swingT));
  updateFx(fx, dt);
}

// ---- Render loop. ----
let lastTime = performance.now();
let accumulator = 0;
let frozen = false;
let frames = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (frozen) return;
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += dt;
  let n = 0;
  while (accumulator >= FIXED_STEP && n < 5) {
    step(FIXED_STEP);
    accumulator -= FIXED_STEP;
    n++;
  }
  updateHud(hud, loadout);
  renderer.render(scene, camera);
  frames++;
  if (frames % 60 === 0) {
    debug({ phase: S.phase, wave: S.wave, score: S.score, left: S.enemiesLeft, hp: Math.ceil(S.health), frames });
  }
}

// ---- Boot: interactive loop, or one staged frame for a screenshot. ----
if (shot) {
  stageShot(shot, ctx);
  if (debugEl) debugEl.style.display = 'none'; // the capture needs no debug text in frame
  updateHud(hud, loadout);
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  frozen = true;
  debug({ phase: S.phase, wave: S.wave, shot, score: S.score, left: S.enemiesLeft, hp: Math.ceil(S.health), frames });
  window.__shotReady = true;
} else {
  setTitleVisible(hud, true);
  requestAnimationFrame(frame);
}

// Debug/test handle (read-only state plus the input, for headless play tests).
window.__arena = { S, player, bots, loadout, input };
