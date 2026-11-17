// VEILPOINT ARENA — hud.js: every DOM readout and overlay. The simulation
// writes numbers into state.js; this module is the only one that touches the
// HUD DOM, and it writes a node only when its value actually changed, so the
// per-frame update stays cheap.
import { S, accuracyPercent, formatRunTime } from './state.js';
import { TOTAL_WAVES } from './config.js';
import { WEAPONS } from './weapons.js';

function el(id) { return document.getElementById(id); }

export function createHud() {
  return {
    root: el('hud'),
    health: el('health-num'), healthBar: el('health-bar'),
    wave: el('wave-label'), enemies: el('enemies-left'), score: el('score-num'),
    ammoMag: el('ammo-mag'), ammoName: el('ammo-name'), feed: el('killfeed'),
    cross: el('crosshair'), hit: el('hitmarker'), popups: el('popups'),
    banner: el('banner'), bannerTitle: el('banner-title'), bannerSub: el('banner-sub'),
    vignette: el('vignette'), hint: el('hint'),
    title: el('title-overlay'), startBtn: el('start-btn'),
    end: el('end-overlay'), endTitle: el('end-title'), endSub: el('end-sub'),
    endStats: el('end-stats'), restartBtn: el('restart-btn'),
    paused: el('paused-note'),
    _cache: {},
    _bannerTimer: 0,
  };
}

function setText(h, key, node, value) {
  if (h._cache[key] !== value) {
    h._cache[key] = value;
    node.textContent = value;
  }
}

export function updateHud(h, loadout) {
  const def = WEAPONS[loadout.current];
  const hp = Math.max(0, Math.ceil(S.health));
  setText(h, 'hp', h.health, String(hp));
  h.healthBar.style.width = `${hp}%`;
  h.healthBar.style.background = hp > 50 ? '#39c2c9' : hp > 25 ? '#e07b2e' : '#d23b2e';
  setText(h, 'wave', h.wave, S.wave > 0 ? `WAVE ${S.wave} / ${TOTAL_WAVES}` : 'STANDBY');
  setText(h, 'enemies', h.enemies, `${S.enemiesLeft} RAIDERS LEFT`);
  setText(h, 'score', h.score, `SCORE ${S.score}`);
  setText(h, 'mag', h.ammoMag, loadout.reloading ? '——' : String(loadout.mag));
  setText(h, 'weapon', h.ammoName, loadout.reloading ? 'RELOADING' : `${def.name} · ∞ RESERVE`);
  const feed = S.feed.slice(-5).map((k) => k.text).join('\n');
  setText(h, 'feed', h.feed, feed);
  const inFight = S.phase === 'live' || S.phase === 'waveclear';
  h.cross.style.opacity = inFight ? '1' : '0';
  h.hint.style.opacity = inFight ? '1' : '0';
  // Behind the title overlay the whole HUD cluster stays out of the way.
  h.root.style.opacity = S.phase === 'menu' ? '0' : '1';
}

export function showHitmarker(h, head) {
  h.hit.classList.add('on');
  h.hit.style.setProperty('--hm', head ? '#ff5a4d' : '#f0a830');
  clearTimeout(h._hitTimer);
  h._hitTimer = setTimeout(() => h.hit.classList.remove('on'), 110);
}

// A kill's points, floating up from the crosshair and fading: the score made
// visible at the moment it is earned, not just in the corner readout.
export function showScorePopup(h, gained, head) {
  if (!h.popups) return;
  const node = document.createElement('div');
  node.className = head ? 'score-popup head' : 'score-popup';
  node.textContent = `+${gained}`;
  node.style.left = `${46 + Math.random() * 8}%`;
  node.style.top = `${41 - h.popups.children.length * 5}%`; // rapid kills stack upward
  h.popups.appendChild(node);
  while (h.popups.children.length > 6) h.popups.removeChild(h.popups.firstChild);
  setTimeout(() => node.remove(), 1600);
}

export function flashDamage(h) {
  h.vignette.classList.add('on');
  clearTimeout(h._vigTimer);
  h._vigTimer = setTimeout(() => h.vignette.classList.remove('on'), 130);
}

export function showBanner(h, title, sub, ms) {
  h.bannerTitle.textContent = title;
  h.bannerSub.textContent = sub || '';
  h.banner.hidden = false;
  clearTimeout(h._bannerTimer);
  h._bannerTimer = setTimeout(() => { h.banner.hidden = true; }, ms || 2800);
}

export function setTitleVisible(h, show) {
  h.title.hidden = !show;
}

export function setPausedVisible(h, show) {
  h.paused.hidden = !show;
}

// The results screen, shared by the win and the loss: same stat rows, the
// title and the closing line carry which way the run went.
export function showEndScreen(h, won) {
  h.endTitle.innerHTML = won ? 'ARENA <span>HELD</span>' : 'THE ARENA <span>FALLS</span>';
  h.endSub.textContent = won
    ? 'All six waves broken. The Duskworks yard is quiet again — and it is yours.'
    : `The raiders overran the yard on wave ${S.wave}. The Warden will be back at dawn.`;
  const rows = [
    ['FINAL SCORE', String(S.score)],
    ['WAVE REACHED', `${S.wave} / ${TOTAL_WAVES}`],
    ['RAIDERS DOWN', String(S.kills)],
    ['HEADSHOTS', String(S.headshots)],
    ['ACCURACY', `${accuracyPercent()}%`],
    ['TIME IN THE YARD', formatRunTime(S.timePlayed)],
  ];
  h.endStats.innerHTML = rows
    .map(([k, v]) => `<div class="stat"><span class="stat-k">${k}</span><span class="stat-v">${v}</span></div>`)
    .join('');
  h.end.hidden = false;
}

export function hideEndScreen(h) {
  h.end.hidden = true;
}
