// VEILPOINT ARENA — player.js: first-person movement. Acceleration-based, so
// stopping to aim pays: speed bleeds off over about a quarter of a second, and
// weapon spread is read from ground speed. Shift sprints, at the cost of that
// same spread. There is no jump — the yard fight stays on the ground.
import * as THREE from 'three';
import { moveCircle } from './arena.js';
import { PLAYER_SPAWN } from './config.js';

const WALK = 5.5; // m/s
const SPRINT = 7.6; // m/s with Shift held
const ACCEL = 44; // m/s^2
const FRICTION = 11; // 1/s exponential damp when no input
const EYE = 1.62; // standing eye height
const EYE_DOWN = 0.5; // eye height once the Warden is down (lose camera)
const RADIUS = 0.38;

export function createPlayer() {
  return {
    pos: { x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z },
    vel: { x: 0, z: 0 },
    yaw: 0, // facing north (-z) into the yard
    pitch: 0,
    eye: EYE,
    moving: false,
    sprinting: false,
    groundSpeed: 0,
    hp: 100,
    alive: true,
    lastHurtT: -99, // sim time of the last damage taken (drives regeneration)
    kind: 'player',
    name: 'You',
    _eyeV: new THREE.Vector3(),
    _dirV: new THREE.Vector3(),
  };
}

export function resetPlayer(p) {
  p.pos.x = PLAYER_SPAWN.x;
  p.pos.z = PLAYER_SPAWN.z;
  p.vel.x = 0;
  p.vel.z = 0;
  p.yaw = 0;
  p.pitch = 0;
  p.eye = EYE;
  p.hp = 100;
  p.alive = true;
  p.lastHurtT = -99;
}

export function updatePlayer(p, dt, input, colliders) {
  if (!p.alive) return;
  // Look.
  p.yaw -= input.lookX;
  p.pitch -= input.lookY;
  const lim = 1.55;
  if (p.pitch > lim) p.pitch = lim;
  if (p.pitch < -lim) p.pitch = -lim;
  input.lookX = 0;
  input.lookY = 0;
  // Wish direction from keys, rotated by yaw.
  const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const r = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const sin = Math.sin(p.yaw);
  const cos = Math.cos(p.yaw);
  let wx = -sin * f + cos * r;
  let wz = -cos * f - sin * r;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx /= wl; wz /= wl; }
  p.sprinting = !!input.sprint && wl > 0;
  const maxSpeed = p.sprinting ? SPRINT : WALK;
  p.vel.x += wx * ACCEL * dt;
  p.vel.z += wz * ACCEL * dt;
  if (wl === 0) {
    const damp = Math.max(0, 1 - FRICTION * dt);
    p.vel.x *= damp;
    p.vel.z *= damp;
  }
  const sp = Math.hypot(p.vel.x, p.vel.z);
  if (sp > maxSpeed) { p.vel.x *= maxSpeed / sp; p.vel.z *= maxSpeed / sp; }
  moveCircle(p.pos, p.vel.x * dt, p.vel.z * dt, RADIUS, colliders);
  p.groundSpeed = Math.hypot(p.vel.x, p.vel.z);
  p.moving = p.groundSpeed > 0.6;
  // Eye height settles back to standing after the downed camera of a loss.
  p.eye += (EYE - p.eye) * Math.min(1, dt * 6);
}

export function eyePos(p, out) {
  out.set(p.pos.x, p.eye, p.pos.z);
  return out;
}

export function aimDir(p, out) {
  const cp = Math.cos(p.pitch);
  out.set(-Math.sin(p.yaw) * cp, Math.sin(p.pitch), -Math.cos(p.yaw) * cp);
  return out;
}

export { EYE_DOWN };
