// VEILPOINT ARENA — config.js: every tuning number of the game in one place, so the
// balance of a run can be read (and changed) without hunting through the simulation.
// The arena is a square dusk-industrial yard; six waves of Jackal raiders enter
// through its four gates and the lone Warden — the player — has to stop them all.

export const ARENA_HALF = 30; // the yard runs from -30 to +30 on both axes (metres)
export const WALL_HEIGHT = 5;
export const TOTAL_WAVES = 6;
export const MAX_BOTS_ALIVE = 9; // spawn pacing never puts more than this on the field

// Scoring: a kill pays, a headshot kill pays a bonus on top, and clearing a wave
// pays a bonus that grows with the wave number.
export const SCORE = {
  kill: 100,
  headshotBonus: 50,
  waveBonusPerWave: 100,
};

// The player: full health, and a slow regeneration that only starts after a few
// quiet seconds, so cover matters but one bad fight is not the whole run.
export const PLAYER_TUNING = {
  maxHp: 100,
  regenDelay: 4, // seconds without taking damage before regeneration starts
  regenRate: 9, // hit points per second once it starts
};

// The three raider archetypes. Every wave stat in waveSpec is the standard
// Jackal's; an archetype scales it. The Rusher is a fast, fragile skirmisher
// that closes to point-blank before it fires; the Brute is a slow wall of
// health that hits hard and towers over the others. Colour and scale are part
// of the definition, so a type reads at a glance across the yard.
export const ARCHETYPES = {
  jackal: {
    label: 'Jackal', hpMul: 1, speedMul: 1, dmgMul: 1, rangeMul: 1,
    scale: 1, color: 0x8a4d1d, // the standard raider's burnt orange
  },
  rusher: {
    label: 'Rusher', hpMul: 0.55, speedMul: 1.55, dmgMul: 0.7, rangeMul: 0.5,
    scale: 0.82, color: 0xd94f1e, // red-orange, smaller and quicker
  },
  brute: {
    label: 'Brute', hpMul: 3.2, speedMul: 0.62, dmgMul: 1.5, rangeMul: 1.05,
    scale: 1.35, color: 0x7a4fd0, // purple, larger and much tougher
  },
};

// Who comes through the gates, wave by wave. Wave 1 is pure Jackals while the
// Warden learns the yard; Rushers join from wave 2 and Brutes from wave 4.
// The counts still climb 5, 7, 9, 11, 13, 15 — 60 raiders across the run.
const WAVE_MIX = [
  { jackal: 5 },
  { jackal: 5, rusher: 2 },
  { jackal: 6, rusher: 3 },
  { jackal: 6, rusher: 3, brute: 2 },
  { jackal: 7, rusher: 4, brute: 2 },
  { jackal: 7, rusher: 5, brute: 3 },
];

// One wave of the raid. Counts, health, speed and damage all climb; the spawn
// interval shrinks, so late waves feel crowded as well as dangerous. `range` is
// how close a standard Jackal likes to get before it stops and shoots; each
// archetype scales it. `mix` is the wave's composition by archetype, and
// `count` is its total.
export function waveSpec(wave) {
  const mix = WAVE_MIX[wave - 1] || WAVE_MIX[WAVE_MIX.length - 1];
  const count = Object.values(mix).reduce((sum, n) => sum + n, 0);
  return {
    wave,
    mix,
    count, // 5, 7, 9, 11, 13, 15 — 60 raiders across the run
    hp: 55 + (wave - 1) * 16, // 55 on wave 1 up to 135 on wave 6
    speed: 3.1 + (wave - 1) * 0.28,
    damage: 6 + Math.round((wave - 1) * 1.6), // per raider hit on the player
    spawnEvery: Math.max(0.7, 1.6 - (wave - 1) * 0.18),
    range: 13 + (wave % 3), // preferred shooting distance, varies a little per wave
  };
}

// The four gates the raiders enter through: gaps in the middle of each wall.
export const GATES = [
  { name: 'north', x: 0, z: -28 },
  { name: 'east', x: 28, z: 0 },
  { name: 'south', x: 0, z: 28 },
  { name: 'west', x: -28, z: 0 },
];

export const PLAYER_SPAWN = { x: 0, z: 19 };
