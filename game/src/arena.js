// VEILPOINT ARENA — arena.js: the Duskworks yard, rebuilt as one open arena.
// One data table drives the visible geometry, the AABB colliders and the waypoint
// graph, so the three can never disagree. Units are metres; y is up; the yard is
// 60 x 60 with a gate gap in the middle of each wall, a pillar cross at the
// centre, teal machine-houses on the east and west, and crate cover scattered
// symmetrically so every approach has somewhere to break line of sight.
import * as THREE from 'three';
import { ARENA_HALF, WALL_HEIGHT, GATES } from './config.js';

// Palette: dusk industrial — orange sun against teal shade, warm concrete, dark steel.
export const PAL = {
  ground: 0x3a332b, groundLine: 0x4a4238, wall: 0x554a41, wallDark: 0x3e3831,
  teal: 0x2e5f63, tealDark: 0x1d3f43, orange: 0xe07b2e, crate: 0x5a4a38,
  crateDark: 0x463a2c, sky: 0x1c1a26, gateGlow: 0xff8c3a,
};

const H = ARENA_HALF; // 30
const WH = WALL_HEIGHT;

// [cx, cz, w, d, h, colorKey] — every solid thing in the yard, walls included.
const BOXES = [
  // Perimeter walls, each side split by a 6 m gate gap at its centre.
  [-16.5, -H, 27, 1, WH, 'wall'], [16.5, -H, 27, 1, WH, 'wall'],
  [-16.5, H, 27, 1, WH, 'wall'], [16.5, H, 27, 1, WH, 'wall'],
  [-H, -16.5, 1, 27, WH, 'wall'], [-H, 16.5, 1, 27, WH, 'wall'],
  [H, -16.5, 1, 27, WH, 'wall'], [H, 16.5, 1, 27, WH, 'wall'],
  // Centre cross: four pillars and two low walls around the emblem ring.
  [-5, -5, 1.8, 1.8, 3.4, 'wallDark'], [5, -5, 1.8, 1.8, 3.4, 'wallDark'],
  [-5, 5, 1.8, 1.8, 3.4, 'wallDark'], [5, 5, 1.8, 1.8, 3.4, 'wallDark'],
  [0, -8.5, 7, 1.2, 1.6, 'teal'], [0, 8.5, 7, 1.2, 1.6, 'teal'],
  // Machine-houses: long teal blocks east and west, with a crate stacked on each.
  [-15, 0, 1.4, 12, 3.4, 'teal'], [15, 0, 1.4, 12, 3.4, 'teal'],
  [-15, -3, 2.6, 2.6, 1.2, 'crate'], [15, 3, 2.6, 2.6, 1.2, 'crate'],
  // North and south barriers: chest-high walls that guard the long lanes.
  [-11, -15, 9, 1.2, 2.2, 'wall'], [11, -15, 9, 1.2, 2.2, 'wall'],
  [-11, 15, 9, 1.2, 2.2, 'wall'], [11, 15, 9, 1.2, 2.2, 'wall'],
  // Crate cover, mirrored across both axes so no quadrant is bare.
  [-21, -9, 3, 3, 1.3, 'crate'], [21, -9, 3, 3, 1.3, 'crateDark'],
  [-21, 9, 3, 3, 1.3, 'crateDark'], [21, 9, 3, 3, 1.3, 'crate'],
  [-9, -21, 3, 3, 1.3, 'crate'], [9, -21, 3, 3, 1.3, 'crate'],
  [-9, 21, 3, 3, 1.3, 'crateDark'], [9, 21, 3, 3, 1.3, 'crateDark'],
  [-23, -22, 2.4, 2.4, 1.1, 'crate'], [23, -22, 2.4, 2.4, 1.1, 'crate'],
  [-23, 22, 2.4, 2.4, 1.1, 'crate'], [23, 22, 2.4, 2.4, 1.1, 'crate'],
];

// Waypoint nodes (x, z): gates, lane mouths, ring points around the centre and
// the open quadrants. Every node sits in open space, never inside a box.
const NODES = [
  [0, -26], [0, 26], [-26, 0], [26, 0],
  [0, -14], [0, 14], [-14, 0], [14, 0],
  [-8, -8], [8, -8], [-8, 8], [8, 8],
  [-19, -14], [19, -14], [-19, 14], [19, 14],
  [-13, -24], [13, -24], [-13, 24], [13, 24],
  [-24, -6], [24, -6], [-24, 6], [24, 6],
  [0, 0], [-4, 20], [4, -20],
];

export function buildArena(scene) {
  const colliders = [];
  const wallMeshes = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const mats = {};
  for (const key of Object.keys(PAL)) {
    if (typeof PAL[key] === 'number') mats[key] = new THREE.MeshStandardMaterial({ color: PAL[key], roughness: 0.92, metalness: 0.04 });
  }
  // Ground, plus a slightly raised apron outside the walls so the gates read
  // as openings in a yard, not holes in the world.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(62, 62), mats.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mats.wallDark);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  scene.add(apron);
  // Lane striping on the ground: two crossing guide lines and the gate lanes.
  const stripeMat = new THREE.MeshStandardMaterial({ color: PAL.groundLine, roughness: 1 });
  const stripeGeo = new THREE.PlaneGeometry(1, 1);
  for (const [sx, sz, w, d] of [[0, 0, 0.35, 56], [0, 0, 56, 0.35], [0, -22, 4.4, 0.35], [0, 22, 4.4, 0.35], [-22, 0, 0.35, 4.4], [22, 0, 0.35, 4.4]]) {
    const s = new THREE.Mesh(stripeGeo, stripeMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(sx, 0.02, sz);
    s.scale.set(w, d, 1);
    s.receiveShadow = true;
    scene.add(s);
  }
  // The centre emblem: a glowing ring the whole fight revolves around.
  const emblem = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.0, 40),
    new THREE.MeshBasicMaterial({ color: PAL.orange, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  emblem.rotation.x = -Math.PI / 2;
  emblem.position.set(0, 0.03, 0);
  scene.add(emblem);
  // Gate markers: a glowing lintel over each gap, so a spawn reads at a glance.
  for (const gate of GATES) {
    const lintel = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: PAL.gateGlow, emissive: 0x903c00, roughness: 0.5 }));
    const across = gate.x === 0;
    lintel.scale.set(across ? 6.4 : 0.8, 0.5, across ? 0.8 : 6.4);
    lintel.position.set(gate.x === 0 ? 0 : gate.x * 1.0, WH - 0.4, gate.z === 0 ? 0 : gate.z * 1.0);
    if (gate.x !== 0) lintel.position.x = gate.x > 0 ? H : -H;
    if (gate.z !== 0) lintel.position.z = gate.z > 0 ? H : -H;
    scene.add(lintel);
  }
  // Boxes -> meshes + colliders.
  for (const [cx, cz, w, d, h, colorKey] of BOXES) {
    const mesh = new THREE.Mesh(boxGeo, mats[colorKey]);
    mesh.position.set(cx, h / 2, cz);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    wallMeshes.push(mesh);
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY: 0, maxY: h, mesh });
  }
  // Dusk sun, sky fill and two warm work-lights over the yard.
  const sun = new THREE.DirectionalLight(0xff9a4d, 3.0);
  sun.position.set(-26, 28, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -38; sun.shadow.camera.right = 38;
  sun.shadow.camera.top = 38; sun.shadow.camera.bottom = -38;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x9fb8c9, 0x3a2c20, 1.6));
  const fill = new THREE.DirectionalLight(0x8fb8ff, 0.8);
  fill.position.set(22, 18, -18);
  scene.add(fill);
  const centreLight = new THREE.PointLight(0xff8c3a, 14, 22, 1.6);
  centreLight.position.set(0, 6, 0);
  scene.add(centreLight);

  // Waypoint graph: an edge joins nodes closer than 17 m with clear sight at
  // eye height (1.5 m), so low crates (<= 1.3 m) never sever the graph.
  const nodes = NODES.map(([x, z]) => ({ x, z, edges: [] }));
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = a.x - b.x, dz = a.z - b.z;
      if (dx * dx + dz * dz > 17 * 17) continue;
      if (segmentBlocked(a.x, 1.5, a.z, b.x, 1.5, b.z, colliders)) continue;
      a.edges.push(j);
      b.edges.push(i);
    }
  }
  return { colliders, wallMeshes, nodes };
}

// Axis-separated circle-vs-AABB slide. pos is {x, z}; moves by (dx, dz) with
// radius r. A collider the circle already overlaps before an axis move is
// skipped for that axis: pushing out of a box you spawn inside would teleport
// you to its far side, so the circle walks out instead.
export function moveCircle(pos, dx, dz, r, colliders) {
  const ox = pos.x, oz = pos.z;
  pos.x += dx;
  for (const c of colliders) {
    if (ox + r <= c.minX || ox - r >= c.maxX || oz + r <= c.minZ || oz - r >= c.maxZ) {
      if (pos.z + r > c.minZ && pos.z - r < c.maxZ && pos.x + r > c.minX && pos.x - r < c.maxX) {
        if (dx > 0) pos.x = c.minX - r; else if (dx < 0) pos.x = c.maxX + r;
      }
    }
  }
  pos.z += dz;
  for (const c of colliders) {
    if (pos.x + r <= c.minX || pos.x - r >= c.maxX || oz + r <= c.minZ || oz - r >= c.maxZ) {
      if (pos.x + r > c.minX && pos.x - r < c.maxX && pos.z + r > c.minZ && pos.z - r < c.maxZ) {
        if (dz > 0) pos.z = c.minZ - r; else if (dz < 0) pos.z = c.maxZ + r;
      }
    }
  }
}

// 3D segment vs AABB slab test. Returns true when the segment hits any collider.
export function segmentBlocked(ax, ay, az, bx, by, bz, colliders) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  for (const c of colliders) {
    let t0 = 0, t1 = 1, ok = true;
    const axes = [[ax, dx, c.minX, c.maxX], [ay, dy, c.minY, c.maxY], [az, dz, c.minZ, c.maxZ]];
    for (const [o, d, mn, mx] of axes) {
      if (Math.abs(d) < 1e-9) {
        if (o < mn || o > mx) { ok = false; break; }
      } else {
        let ta = (mn - o) / d, tb = (mx - o) / d;
        if (ta > tb) { const t = ta; ta = tb; tb = t; }
        if (ta > t0) t0 = ta;
        if (tb < t1) t1 = tb;
        if (t0 > t1) { ok = false; break; }
      }
    }
    if (ok) return true;
  }
  return false;
}

export function nearestNode(nodes, x, z) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < nodes.length; i++) {
    const dx = nodes[i].x - x, dz = nodes[i].z - z, d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// BFS over the waypoint graph. Returns an array of {x, z} waypoints that ends
// at the target point itself (excluding the start node).
export function findPath(nodes, sx, sz, tx, tz) {
  const start = nearestNode(nodes, sx, sz);
  const goal = nearestNode(nodes, tx, tz);
  if (start === goal) return [{ x: tx, z: tz }];
  const prev = new Int16Array(nodes.length).fill(-1);
  const queue = [start];
  prev[start] = start;
  for (let qi = 0; qi < queue.length; qi++) {
    const n = queue[qi];
    if (n === goal) break;
    for (const e of nodes[n].edges) {
      if (prev[e] === -1) { prev[e] = n; queue.push(e); }
    }
  }
  if (prev[goal] === -1) return [{ x: tx, z: tz }];
  const path = [];
  let cur = goal;
  while (cur !== start) { path.push({ x: nodes[cur].x, z: nodes[cur].z }); cur = prev[cur]; }
  path.reverse();
  path.push({ x: tx, z: tz });
  return path;
}
