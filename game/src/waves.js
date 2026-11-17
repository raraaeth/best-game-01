// VEILPOINT ARENA — waves.js: the wave director and the one place combat is
// resolved. It owns the run's flow — start a run, start a wave, pace the
// spawns through the gates, call the breather between waves, and declare the
// win or the loss — and every point of damage passes through here, so score,
// feed, HUD and sounds can never disagree about what just happened.
import { S, resetRun, addFeed } from './state.js';
import { GATES, SCORE, TOTAL_WAVES, PLAYER_TUNING, waveSpec, MAX_BOTS_ALIVE } from './config.js';
import { spawnRaider, clearBots, aliveBots } from './bots.js';
import { resetPlayer } from './player.js';
import { WEAPONS } from './weapons.js';
import { showBanner, showHitmarker, flashDamage, showEndScreen, hideEndScreen, setTitleVisible } from './hud.js';

const BREATHER_SECONDS = 3.5; // between one wave's last raider and the next wave

export function startRun(ctx) {
  resetRun();
  clearBots(ctx.bots);
  resetPlayer(ctx.player);
  ctx.loadout.current = 'dawnline';
  ctx.loadout.mag = WEAPONS.dawnline.mag;
  ctx.loadout.cooldown = 0;
  ctx.loadout.reloading = false;
  ctx.setViewmodel('dawnline');
  hideEndScreen(ctx.hud);
  setTitleVisible(ctx.hud, false);
  ctx.nameCursor = 0;
  startWave(ctx, 1);
}

export function startWave(ctx, wave) {
  const spec = waveSpec(wave);
  S.wave = wave;
  S.spawnedThisWave = 0;
  S.queuedThisWave = spec.count;
  S.enemiesLeft = spec.count;
  S.spawnT = 0.4; // the first raider is through the gate almost at once
  S.phase = 'live';
  showBanner(ctx.hud,
    wave === 1 ? 'WAVE 1 — THEY ARE COMING' : `WAVE ${wave}`,
    wave === TOTAL_WAVES ? 'The last wave. Hold the yard.' : `${spec.count} raiders through the gates.`,
    2600);
  ctx.audio.waveStart(wave);
}

export function updateWaves(ctx, dt) {
  if (S.phase === 'live') {
    S.timePlayed += dt;
    const spec = waveSpec(S.wave);
    // Spawn pacing: drip the queue through random gates while the field has room.
    if (S.queuedThisWave > 0) {
      S.spawnT -= dt;
      const alive = aliveBots(ctx.bots).length;
      if (S.spawnT <= 0 && alive < MAX_BOTS_ALIVE) {
        const gate = GATES[Math.floor(Math.random() * GATES.length)];
        const bot = spawnRaider(ctx.bots, spec, gate, ctx.nameCursor);
        if (bot) {
          ctx.nameCursor++;
          S.spawnedThisWave++;
          S.queuedThisWave--;
          S.spawnT = spec.spawnEvery;
        } else {
          S.spawnT = 0.3; // pool momentarily dry; try again shortly
        }
      }
    }
    // Health regeneration after a quiet spell.
    const p = ctx.player;
    if (p.alive && p.hp > 0 && p.hp < PLAYER_TUNING.maxHp && S.time - p.lastHurtT > PLAYER_TUNING.regenDelay) {
      p.hp = Math.min(PLAYER_TUNING.maxHp, p.hp + PLAYER_TUNING.regenRate * dt);
      S.health = p.hp;
    }
    // Wave cleared: queue empty and nobody left standing.
    if (S.queuedThisWave === 0 && aliveBots(ctx.bots).length === 0) {
      const bonus = SCORE.waveBonusPerWave * S.wave;
      S.score += bonus;
      if (S.wave >= TOTAL_WAVES) {
        winRun(ctx);
      } else {
        S.phase = 'waveclear';
        S.clearT = BREATHER_SECONDS;
        showBanner(ctx.hud, `WAVE ${S.wave} BROKEN`, `+${bonus} wave bonus — breathe, reload, reposition.`, 2400);
        ctx.audio.waveClear();
      }
    }
  } else if (S.phase === 'waveclear') {
    S.clearT -= dt;
    if (S.clearT <= 0) startWave(ctx, S.wave + 1);
  }
}

function winRun(ctx) {
  S.phase = 'won';
  showEndScreen(ctx.hud, true);
  ctx.audio.win();
  ctx.exitLock();
}

function loseRun(ctx) {
  S.phase = 'lost';
  S.health = 0;
  showEndScreen(ctx.hud, false);
  ctx.audio.lose();
  ctx.exitLock();
}

// A raider takes damage. Called by the hitscan and the melee swing, whoever
// swung or fired; only the player's hits score, flash the marker and feed.
export function damageBot(ctx, bot, dmg, head, attacker) {
  if (!bot.alive || S.phase === 'won' || S.phase === 'lost') return;
  bot.hp -= dmg;
  bot.flashT = 0.14;
  const byPlayer = attacker === ctx.player;
  if (byPlayer) {
    S.shotsHit++;
    showHitmarker(ctx.hud, head);
    if (head) ctx.audio.headshot(); else ctx.audio.hit();
  }
  if (bot.hp > 0) return;
  bot.alive = false;
  bot.hp = 0;
  bot.deadT = 0;
  S.enemiesLeft = Math.max(0, S.enemiesLeft - 1);
  ctx.fx.burst({ x: bot.pos.x, y: 1.1, z: bot.pos.z });
  ctx.audio.raiderDown(bot.pos, ctx.player.pos);
  if (byPlayer) {
    S.kills++;
    if (head) S.headshots++;
    const gained = SCORE.kill + (head ? SCORE.headshotBonus : 0);
    S.score += gained;
    addFeed(`You ▸ ${bot.name}${head ? ' (headshot)' : ''} +${gained}`);
    ctx.audio.kill();
  } else {
    addFeed(`${bot.name} went down`);
  }
}

// The Warden takes damage from a raider's carbine.
export function damagePlayer(ctx, dmg, attacker) {
  const p = ctx.player;
  if (!p.alive || S.phase !== 'live') return;
  p.hp -= dmg;
  p.lastHurtT = S.time;
  S.health = Math.max(0, p.hp);
  flashDamage(ctx.hud);
  ctx.audio.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    addFeed(`${attacker ? attacker.name : 'A raider'} ▸ You`);
    loseRun(ctx);
  }
}
