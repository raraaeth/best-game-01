// VEILPOINT ARENA — fx.js: tracers, impact sparks and the muzzle flash. Every
// effect is pooled and reused — fixed buffers, recycled slots — so the render
// loop allocates nothing per frame. Effects are cosmetic only: they read the
// sim's results, never feed back into it.
import * as THREE from 'three';

const MAX_TRACERS = 28;
const MAX_SPARKS = 240;

export function createFx(scene) {
  // Tracers: one LineSegments with a slot per live tracer.
  const tracerGeo = new THREE.BufferGeometry();
  const tracerPos = new Float32Array(MAX_TRACERS * 6);
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(tracerPos, 3));
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const tracers = new THREE.LineSegments(tracerGeo, tracerMat);
  tracers.frustumCulled = false;
  scene.add(tracers);
  // Sparks: one Points cloud, slots recycled round-robin.
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(MAX_SPARKS * 3);
  for (let i = 0; i < MAX_SPARKS; i++) sparkPos[i * 3 + 1] = -100;
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffc46b, size: 0.09, transparent: true, opacity: 0.95 }));
  sparks.frustumCulled = false;
  scene.add(sparks);
  // Muzzle flash: a small additive disc at the camera, flashed by main. A disc,
  // not a quad — a square flash reads as a rendering glitch in a still frame.
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const flash = new THREE.Mesh(new THREE.CircleGeometry(0.085, 20), flashMat);
  flash.position.set(0.34, -0.26, -0.85);
  flash.visible = false;
  const fx = {
    scene, tracers, tracerPos, tracerLife: new Float32Array(MAX_TRACERS), tracerNext: 0,
    sparks, sparkPos, sparkLife: new Float32Array(MAX_SPARKS),
    sparkVel: new Float32Array(MAX_SPARKS * 3), sparkNext: 0,
    flash, flashMat,
  };
  // The method shape weapons.js and the bots call.
  fx.tracer = (from, to, color) => tracer(fx, from, to, color);
  fx.impact = (point, head) => impact(fx, point, head);
  fx.slash = (origin, dir) => slash(fx, origin, dir);
  fx.burst = (point) => burst(fx, point);
  fx.muzzleFlash = () => muzzleFlash(fx);
  return fx;
}

export function tracer(fx, from, to, color) {
  const i = fx.tracerNext;
  fx.tracerNext = (fx.tracerNext + 1) % MAX_TRACERS;
  fx.tracerPos[i * 6] = from.x; fx.tracerPos[i * 6 + 1] = from.y; fx.tracerPos[i * 6 + 2] = from.z;
  fx.tracerPos[i * 6 + 3] = to.x; fx.tracerPos[i * 6 + 4] = to.y; fx.tracerPos[i * 6 + 5] = to.z;
  fx.tracerLife[i] = 0.09;
  fx.tracers.geometry.attributes.position.needsUpdate = true;
  fx.tracers.material.color.setHex(color || 0xffe9a8);
}

function spawnSparks(fx, point, count, spread, up) {
  for (let n = 0; n < count; n++) {
    const i = fx.sparkNext;
    fx.sparkNext = (fx.sparkNext + 1) % MAX_SPARKS;
    fx.sparkPos[i * 3] = point.x; fx.sparkPos[i * 3 + 1] = point.y; fx.sparkPos[i * 3 + 2] = point.z;
    fx.sparkVel[i * 3] = (Math.random() - 0.5) * spread;
    fx.sparkVel[i * 3 + 1] = Math.random() * up;
    fx.sparkVel[i * 3 + 2] = (Math.random() - 0.5) * spread;
    fx.sparkLife[i] = 0.35;
  }
  fx.sparks.geometry.attributes.position.needsUpdate = true;
}

export function impact(fx, point, head) {
  spawnSparks(fx, point, head ? 9 : 6, 3, 2.5);
}

export function burst(fx, point) {
  // A raider going down: a bigger, slower puff of sparks at body height.
  spawnSparks(fx, point, 16, 4.5, 3.2);
}

export function slash(fx, origin, dir) {
  const p = origin.clone().addScaledVector(dir, 1.4);
  spawnSparks(fx, p, 5, 2, 1.5);
}

export function muzzleFlash(fx) {
  fx.flash.visible = true;
  fx.flashMat.opacity = 0.7;
}

export function updateFx(fx, dt) {
  for (let i = 0; i < MAX_TRACERS; i++) {
    if (fx.tracerLife[i] > 0) {
      fx.tracerLife[i] -= dt;
      if (fx.tracerLife[i] <= 0) {
        // Collapse the dead tracer onto its start point so it draws nothing.
        fx.tracerPos[i * 6 + 3] = fx.tracerPos[i * 6];
        fx.tracerPos[i * 6 + 4] = fx.tracerPos[i * 6 + 1];
        fx.tracerPos[i * 6 + 5] = fx.tracerPos[i * 6 + 2];
        fx.tracers.geometry.attributes.position.needsUpdate = true;
      }
    }
  }
  let anySpark = false;
  for (let i = 0; i < MAX_SPARKS; i++) {
    if (fx.sparkLife[i] > 0) {
      anySpark = true;
      fx.sparkLife[i] -= dt;
      fx.sparkPos[i * 3] += fx.sparkVel[i * 3] * dt;
      fx.sparkPos[i * 3 + 1] += fx.sparkVel[i * 3 + 1] * dt;
      fx.sparkPos[i * 3 + 2] += fx.sparkVel[i * 3 + 2] * dt;
      fx.sparkVel[i * 3 + 1] -= 6 * dt;
      if (fx.sparkLife[i] <= 0) fx.sparkPos[i * 3 + 1] = -100;
    }
  }
  if (anySpark) fx.sparks.geometry.attributes.position.needsUpdate = true;
  if (fx.flash.visible) {
    fx.flashMat.opacity -= dt * 9;
    if (fx.flashMat.opacity <= 0) fx.flash.visible = false;
  }
}
