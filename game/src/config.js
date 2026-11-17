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

// One wave of the raid. Counts, health, speed and damage all climb; the spawn
// interval shrinks, so late waves feel crowded as well as dangerous. `range` is
// how close a raider likes to get before it stops and shoots.
export function waveSpec(wave) {
  return {
    wave,
    count: 3 + wave * 2, // 5, 7, 9, 11, 13, 15 — 60 raiders across the run
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
