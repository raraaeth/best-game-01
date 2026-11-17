// VEILPOINT ARENA — state.js: the one central store. Every module reads and writes
// run state through this object only; rendering never owns simulation data, so the
// HUD, the wave director and the bots can never drift apart.

export const S = {
  // Flow: 'menu' (title overlay) -> 'live' (a wave is fighting) -> 'waveclear'
  // (a short breather) -> 'live' again ... -> 'won' or 'lost' (end overlay).
  phase: 'menu',
  wave: 0, // current wave, 1..6 once the run starts
  score: 0,
  kills: 0,
  headshots: 0,
  shotsFired: 0,
  shotsHit: 0,
  timePlayed: 0, // seconds of live play in this run (menu and breather excluded)
  health: 100, // mirrors player.hp, kept here so the HUD reads one place
  enemiesLeft: 0, // raiders alive plus raiders still queued to spawn
  spawnedThisWave: 0,
  queuedThisWave: 0,
  spawnT: 0, // countdown to the next queued spawn
  clearT: 0, // countdown during the waveclear breather
  time: 0, // sim clock, seconds, fixed-step
  feed: [], // kill feed lines: { text, t }, newest last, capped at 5
  shot: null, // 'title' | 'play' | 'win' | 'lose' when ?shot= is present
};

export function resetRun() {
  S.phase = 'live';
  S.wave = 0;
  S.score = 0;
  S.kills = 0;
  S.headshots = 0;
  S.shotsFired = 0;
  S.shotsHit = 0;
  S.timePlayed = 0;
  S.health = 100;
  S.enemiesLeft = 0;
  S.spawnedThisWave = 0;
  S.queuedThisWave = 0;
  S.spawnT = 0;
  S.clearT = 0;
  S.feed.length = 0;
}

export function addFeed(text) {
  S.feed.push({ text, t: S.time });
  if (S.feed.length > 5) S.feed.shift();
}

/** Accuracy as a whole percentage; a run with no shots fired reads 0. */
export function accuracyPercent() {
  if (S.shotsFired === 0) return 0;
  return Math.round((S.shotsHit / S.shotsFired) * 100);
}

/** Run time as m:ss for the results screen. */
export function formatRunTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
