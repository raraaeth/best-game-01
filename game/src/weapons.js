// VEILPOINT ARENA — weapons.js: the Warden's two original armaments and the
// hitscan that fires them. The Dawnline is the workhorse automatic rifle; the
// Gunblade is a semi-auto carbine with a fixed side blade — its shots hit a
// little softer per round, but its slash is the strongest thing in the yard.
// Damage, spread and recoil are per-weapon; spread grows while moving, so the
// game rewards stopping to aim. Ammunition in the arena is plentiful: magazines
// are limited, the reserve is not.
import * as THREE from 'three';

export const WEAPONS = {
  dawnline: {
    name: 'Dawnline', kind: 'rifle', dmg: 34, head: 2.0, rof: 0.115, mag: 30,
    reload: 1.5, spread: 0.009, moveSpread: 0.02, auto: true, kick: 0.6,
    range: 85, tracer: 0xffe9a8,
  },
  gunblade: {
    name: 'Gunblade', kind: 'hybrid', dmg: 30, head: 2.0, rof: 0.17, mag: 8,
    reload: 1.4, spread: 0.012, moveSpread: 0.018, auto: false, kick: 0.55,
    range: 60, meleeDmg: 60, meleeRange: 2.5, tracer: 0xffd27a,
  },
};

// The rifle's butt strike: weaker than the Gunblade's blade, always available.
export const BUTT_STRIKE = { dmg: 40, range: 2.2, rof: 0.45 };

export function newLoadout() {
  return {
    current: 'dawnline',
    mag: WEAPONS.dawnline.mag,
    cooldown: 0,
    meleeCooldown: 0,
    reloading: false,
    reloadT: 0,
  };
}

// One hitscan shot. ctx: { raycaster, walls, targetMeshes, fx, onHit(agent, dmg,
// head, attacker), attacker, origin, dir, def, spread }. The nearest of wall or
// target takes the bullet; a head mesh (userData.head) pays the head multiplier.
export function shootHitscan(ctx) {
  const def = ctx.def;
  const dir = ctx.dir.clone();
  dir.x += (Math.random() - 0.5) * 2 * ctx.spread;
  dir.y += (Math.random() - 0.5) * 2 * ctx.spread;
  dir.z += (Math.random() - 0.5) * 2 * ctx.spread;
  dir.normalize();
  const rc = ctx.raycaster;
  rc.set(ctx.origin, dir);
  rc.far = def.range;
  const wallHit = rc.intersectObjects(ctx.walls, false)[0] || null;
  const targetHit = rc.intersectObjects(ctx.targetMeshes, false)[0] || null;
  if (targetHit && (!wallHit || targetHit.distance < wallHit.distance)) {
    const end = targetHit.point.clone();
    ctx.fx.tracer(ctx.origin, end, def.tracer);
    const head = !!targetHit.object.userData.head;
    ctx.onHit(targetHit.object.userData.agent, Math.round(def.dmg * (head ? def.head : 1)), head, ctx.attacker);
    ctx.fx.impact(targetHit.point, head);
    return { hit: true, head };
  }
  if (wallHit) {
    const end = wallHit.point.clone();
    ctx.fx.tracer(ctx.origin, end, def.tracer);
    ctx.fx.impact(wallHit.point, false);
    return { hit: false, wall: true };
  }
  const end = ctx.origin.clone().addScaledVector(dir, def.range);
  ctx.fx.tracer(ctx.origin, end, def.tracer);
  return { hit: false, wall: false };
}

// Melee swing: a short-range cone check against live targets in front of the
// swinger. ctx: { origin, dir, range, dmg, targets: [agent...], fx, onHit }.
export function meleeSwing(ctx) {
  let best = null;
  let bestD = ctx.range;
  for (const agent of ctx.targets) {
    if (!agent.alive) continue;
    const dx = agent.pos.x - ctx.origin.x;
    const dz = agent.pos.z - ctx.origin.z;
    const d = Math.hypot(dx, dz);
    if (d > ctx.range) continue;
    const dot = (dx * ctx.dir.x + dz * ctx.dir.z) / (d || 1);
    if (dot < 0.5) continue;
    if (d < bestD) { bestD = d; best = agent; }
  }
  ctx.fx.slash(ctx.origin, ctx.dir);
  if (best) {
    ctx.onHit(best, ctx.dmg, false, ctx.attacker);
    return true;
  }
  return false;
}

// ---- Viewmodels: small original guns built from boxes, attached to the camera. ----
const _steel = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.5, metalness: 0.35 });
const _accent = new THREE.MeshStandardMaterial({ color: 0xe07b2e, roughness: 0.5, metalness: 0.4 });
const _blade = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.2, metalness: 0.9 });
const _grip = new THREE.MeshStandardMaterial({ color: 0x3a2f26, roughness: 0.85, metalness: 0.05 });

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function createViewmodel(camera) {
  const group = new THREE.Group();
  group.position.set(0.34, -0.32, -0.62);
  camera.add(group);
  return { group, current: null };
}

export function setViewmodel(vm, defId) {
  if (vm.current === defId) return;
  vm.current = defId;
  while (vm.group.children.length) vm.group.remove(vm.group.children[0]);
  const g = vm.group;
  if (defId === 'gunblade') {
    // Compact carbine body, grip, and the namesake blade along its right side.
    g.add(box(0.07, 0.11, 0.36, _steel, 0, 0.02, -0.1));
    g.add(box(0.06, 0.16, 0.09, _grip, 0, -0.09, 0.04));
    g.add(box(0.05, 0.05, 0.12, _accent, 0, 0.09, -0.16));
    const blade = box(0.012, 0.05, 0.34, _blade, 0.05, -0.01, -0.14);
    g.add(blade);
  } else {
    // Dawnline: long receiver, heat shroud in accent orange, box magazine.
    g.add(box(0.07, 0.1, 0.58, _steel, 0, 0.03, -0.14));
    g.add(box(0.06, 0.14, 0.08, _grip, 0, -0.08, 0.05));
    g.add(box(0.055, 0.16, 0.07, _steel, 0, -0.1, -0.12));
    g.add(box(0.02, 0.05, 0.3, _accent, 0, 0.1, -0.2));
    g.add(box(0.03, 0.03, 0.1, _accent, 0, 0.02, -0.44));
  }
}

// Bob while walking, recoil kick after a shot, and the melee swing arc. kick
// and swingT are 0..1-ish envelopes the caller decays.
export function updateViewmodel(vm, t, moving, kick, swingT) {
  const g = vm.group;
  const bob = moving ? Math.sin(t * 9) * 0.008 : 0;
  g.position.y = -0.32 + bob;
  g.position.x = 0.34 + (moving ? Math.cos(t * 9) * 0.005 : 0);
  g.position.z = -0.62 + kick * 0.09;
  g.rotation.x = kick * 0.14;
  if (swingT > 0) {
    const s = Math.sin((1 - swingT / 0.45) * Math.PI);
    g.rotation.z = -s * 1.05;
    g.rotation.x = kick * 0.14 - s * 0.45;
  } else {
    g.rotation.z = 0;
  }
}
