// VEILPOINT ARENA — bots.js: the Jackal raiders. A fixed pool of raider bodies is
// created once and recycled across waves; the wave director activates them at
// the gates with the wave's stats. A raider hunts the Warden: it paths through
// the yard's waypoint graph until it has line of sight, closes to its preferred
// range, then strafes and fires in bursts. Its aim is honest — the same hitscan
// the player uses, with a wider cone — so cover genuinely protects you.
import * as THREE from 'three';
import { moveCircle, segmentBlocked, findPath } from './arena.js';
import { shootHitscan } from './weapons.js';
import { MAX_BOTS_ALIVE } from './config.js';

export const BOT_POOL_SIZE = 15; // wave 6 fields 15 raiders in total
const BOT_RADIUS = 0.38;
const SIGHT_RANGE = 44;
const REACT_TIME = 0.4;
const BURST_PAUSE_MIN = 0.7;
const BURST_PAUSE_MAX = 1.3;

// The raiders' callsigns, in spawn order across the whole run.
export const RAIDER_NAMES = [
  'Vex', 'Nox', 'Rook', 'Sable', 'Ivo', 'Juno', 'Kaito', 'Mira',
  'Orin', 'Pax', 'Quill', 'Rune', 'Sef', 'Tova', 'Umbra', 'Wren',
  'Yara', 'Zev', 'Ash', 'Bram', 'Cleo', 'Dara', 'Ember', 'Falk',
  'Gia', 'Hald', 'Ines', 'Joren', 'Kira', 'Lars', 'Mina', 'Nils',
  'Odile', 'Petr', 'Rhea', 'Sten', 'Tilda', 'Ulf', 'Vera', 'Wido',
  'Xan', 'Yves', 'Zola', 'Arno', 'Bibi', 'Cato', 'Demi', 'Elif',
  'Femi', 'Gord', 'Hana', 'Ilya', 'Jada', 'Kofi', 'Lena', 'Marek',
  'Nia', 'Oskar', 'Pia', 'Rafi',
];

// The raider's own carbine: player-weapon shape, tuned by the wave's damage.
const RAIDER_GUN = {
  name: 'Raider carbine', kind: 'rifle', dmg: 10, head: 1.5, rof: 0.16,
  spread: 0.03, range: 55, tracer: 0xff9a5a,
};

let _geoBody, _geoHead, _geoGun, _geoVisor;
let _matHead, _matGun, _matVisor;
function sharedParts() {
  if (_geoBody) return;
  _geoBody = new THREE.BoxGeometry(0.62, 0.95, 0.36);
  _geoHead = new THREE.BoxGeometry(0.36, 0.34, 0.34);
  _geoGun = new THREE.BoxGeometry(0.09, 0.12, 0.72);
  _geoVisor = new THREE.BoxGeometry(0.3, 0.07, 0.02);
  _matHead = new THREE.MeshStandardMaterial({ color: 0xc9a37e, roughness: 0.85 });
  _matGun = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.45, metalness: 0.6 });
  _matVisor = new THREE.MeshStandardMaterial({ color: 0xe07b2e, roughness: 0.2, metalness: 0.4, emissive: 0x3d1a05 });
}

function makeRaiderMesh() {
  sharedParts();
  const group = new THREE.Group();
  // The body material is per-raider so a hit can flash it without flashing all.
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a4d1d, roughness: 0.8, emissive: 0x000000 });
  const body = new THREE.Mesh(_geoBody, bodyMat);
  body.position.y = 0.95;
  body.castShadow = true;
  const head = new THREE.Mesh(_geoHead, _matHead);
  head.position.y = 1.62;
  head.castShadow = true;
  head.userData.head = true;
  const visor = new THREE.Mesh(_geoVisor, _matVisor);
  visor.position.set(0, 1.66, 0.18);
  const gun = new THREE.Mesh(_geoGun, _matGun);
  gun.position.set(0.28, 1.15, 0.3);
  group.add(body, head, visor, gun);
  group.visible = false;
  return { group, head, body, bodyMat };
}

export function createBots(scene) {
  const bots = [];
  for (let i = 0; i < BOT_POOL_SIZE; i++) {
    const { group, head, body, bodyMat } = makeRaiderMesh();
    scene.add(group);
    const bot = {
      id: i, kind: 'bot', name: RAIDER_NAMES[i % RAIDER_NAMES.length],
      active: false, alive: false,
      pos: { x: 0, z: 0 }, yaw: 0,
      hp: 1, maxHp: 1, speed: 3, damage: 6, prefRange: 14,
      path: [], pathI: 0, repathT: 0,
      seenT: -10, reactT: 0, shootT: 0, burstLeft: 0, pauseT: 0,
      strafeDir: 1, flashT: 0, deadT: 0,
      mesh: group, headMesh: head, bodyMesh: body, bodyMat,
    };
    head.userData.agent = bot;
    body.userData.agent = bot;
    bots.push(bot);
  }
  return bots;
}

/** Activate a pooled raider at a gate with the wave's stats. Null if pool dry. */
export function spawnRaider(bots, spec, gate, nameIndex) {
  const bot = bots.find((b) => !b.active);
  if (!bot) return null;
  bot.active = true;
  bot.alive = true;
  bot.name = RAIDER_NAMES[nameIndex % RAIDER_NAMES.length];
  bot.pos.x = gate.x + (Math.random() - 0.5) * 3;
  bot.pos.z = gate.z + (Math.random() - 0.5) * 3;
  bot.yaw = Math.atan2(-(0 - bot.pos.x), -(0 - bot.pos.z));
  bot.hp = spec.hp;
  bot.maxHp = spec.hp;
  bot.speed = spec.speed * (0.92 + Math.random() * 0.16);
  bot.damage = spec.damage;
  bot.prefRange = spec.range + (Math.random() * 4 - 2);
  bot.path = [];
  bot.pathI = 0;
  bot.repathT = Math.random() * 0.3;
  bot.seenT = -10;
  bot.reactT = 0;
  bot.shootT = 0;
  bot.burstLeft = 0;
  bot.pauseT = 0.4 + Math.random() * 0.5;
  bot.strafeDir = Math.random() < 0.5 ? -1 : 1;
  bot.flashT = 0;
  bot.deadT = 0;
  bot.mesh.visible = true;
  bot.mesh.rotation.set(0, bot.yaw, 0);
  bot.mesh.position.set(bot.pos.x, 0, bot.pos.z);
  return bot;
}

export function clearBots(bots) {
  for (const b of bots) {
    b.active = false;
    b.alive = false;
    b.mesh.visible = false;
  }
}

export function aliveBots(bots) {
  return bots.filter((b) => b.active && b.alive);
}

function followPath(b, tx, tz, arena, dt) {
  if (!b.path.length || b.pathI >= b.path.length) {
    b.path = findPath(arena.nodes, b.pos.x, b.pos.z, tx, tz);
    b.pathI = 0;
  }
  const wp = b.path[b.pathI];
  const dx = wp.x - b.pos.x;
  const dz = wp.z - b.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.9) {
    b.pathI++;
    if (b.pathI >= b.path.length) return [0, 0];
    return followPath(b, tx, tz, arena, dt);
  }
  return [dx / d, dz / d];
}

function raiderShoot(b, dt, ctx) {
  // Bursts: a few shots at carbine rate, then a human-length pause.
  if (b.pauseT > 0) {
    b.pauseT -= dt;
    if (b.pauseT <= 0) b.burstLeft = 3 + Math.floor(Math.random() * 3);
    return;
  }
  b.shootT -= dt;
  if (b.shootT > 0) return;
  b.shootT = RAIDER_GUN.rof;
  b.burstLeft--;
  if (b.burstLeft <= 0) b.pauseT = BURST_PAUSE_MIN + Math.random() * (BURST_PAUSE_MAX - BURST_PAUSE_MIN);
  const p = ctx.player;
  const d = Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
  const spread = RAIDER_GUN.spread + d * 0.0012 + (p.groundSpeed > 1 ? 0.012 : 0);
  const origin = new THREE.Vector3(b.pos.x, 1.5, b.pos.z);
  const dir = new THREE.Vector3(p.pos.x - b.pos.x, p.eye - 0.25 - 1.5, p.pos.z - b.pos.z).normalize();
  const def = { ...RAIDER_GUN, dmg: b.damage };
  shootHitscan({
    origin, dir, def, spread,
    raycaster: ctx.raycaster, walls: ctx.walls, targetMeshes: ctx.playerMeshes,
    fx: ctx.fx, attacker: b,
    onHit: (agent, dmg, head, attacker) => ctx.onDamagePlayer(dmg, attacker),
  });
  ctx.audio.shot(b.pos, def, false, p.pos);
}

export function updateBots(bots, dt, ctx) {
  const { arena, player } = ctx;
  for (const b of bots) {
    if (!b.active) continue;
    if (!b.alive) {
      // Corpse: tip over, rest a moment, then leave the field.
      b.deadT += dt;
      if (b.deadT < 0.25) b.mesh.rotation.x = -Math.PI / 2 * (b.deadT / 0.25);
      if (b.deadT > 1.1) {
        b.active = false;
        b.mesh.visible = false;
      }
      continue;
    }
    // Hit flash decay.
    if (b.flashT > 0) {
      b.flashT -= dt;
      b.bodyMat.emissive.setRGB(b.flashT * 2.4, b.flashT * 0.7, b.flashT * 0.4);
      if (b.flashT <= 0) b.bodyMat.emissive.setRGB(0, 0, 0);
    }
    const dx = player.pos.x - b.pos.x;
    const dz = player.pos.z - b.pos.z;
    const dist = Math.hypot(dx, dz);
    const seesPlayer = player.alive && dist < SIGHT_RANGE
      && !segmentBlocked(b.pos.x, 1.5, b.pos.z, player.pos.x, 1.5, player.pos.z, arena.colliders);
    if (seesPlayer) {
      // Reacquiring after a real break in contact costs a fresh reaction delay.
      if (ctx.time - b.seenT > 1.5) b.reactT = REACT_TIME;
      b.seenT = ctx.time;
    }
    const engaged = player.alive && ctx.time - b.seenT < 1.5;
    let moveX = 0;
    let moveZ = 0;
    if (engaged) {
      // Face the Warden; shoot once the reaction delay is spent.
      b.yaw = Math.atan2(-dx, -dz);
      if (b.reactT > 0) b.reactT -= dt;
      else if (seesPlayer) raiderShoot(b, dt, ctx);
      if (dist > b.prefRange + 2) {
        const mv = followPath(b, player.pos.x, player.pos.z, arena, dt);
        moveX = mv[0]; moveZ = mv[1];
      } else if (dist < b.prefRange - 5) {
        // Too close: back off toward the nearest gate side while firing.
        moveX = -dx / (dist || 1); moveZ = -dz / (dist || 1);
      } else {
        // In the pocket: strafe across the Warden's aim, flipping now and then.
        if (Math.random() < dt * 0.25) b.strafeDir *= -1;
        moveX = Math.cos(b.yaw) * b.strafeDir;
        moveZ = -Math.sin(b.yaw) * b.strafeDir;
      }
    } else {
      // Hunting: path to the Warden's current position, repathing as it moves.
      b.repathT -= dt;
      if (b.repathT <= 0) {
        b.repathT = 0.5;
        b.path = findPath(arena.nodes, b.pos.x, b.pos.z, player.pos.x, player.pos.z);
        b.pathI = 0;
      }
      const mv = followPath(b, player.pos.x, player.pos.z, arena, dt);
      moveX = mv[0]; moveZ = mv[1];
    }
    const ml = Math.hypot(moveX, moveZ);
    if (ml > 0.01) {
      const sp = b.speed * (engaged && dist <= b.prefRange + 2 ? 0.5 : 1);
      moveCircle(b.pos, (moveX / ml) * sp * dt, (moveZ / ml) * sp * dt, BOT_RADIUS, arena.colliders);
      if (!engaged) b.yaw = Math.atan2(-moveX / ml, -moveZ / ml);
    }
    b.mesh.position.set(b.pos.x, Math.abs(Math.sin(ctx.time * 9 + b.id)) * (ml > 0.01 ? 0.03 : 0), b.pos.z);
    b.mesh.rotation.y = b.yaw;
  }
}

export { MAX_BOTS_ALIVE };
