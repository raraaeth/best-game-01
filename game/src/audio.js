// VEILPOINT ARENA — audio.js: every sound is synthesised with WebAudio; the
// game ships no audio assets at all. The context is created lazily on the
// first user gesture so browser autoplay policies stay happy, and every call
// is safe before that (it simply stays silent).

export function createAudio() {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function noiseBurst(dur, freq, gain, type) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
  }

  function tone(freq, dur, gain, type, slideTo, delay) {
    if (!ensure()) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Distance attenuation for world sounds: full volume to 8 m, fading after.
  function dist(pos, listener) {
    if (!listener || !pos) return 1;
    const d = Math.hypot(pos.x - listener.x, pos.z - listener.z);
    return Math.max(0.08, 1 - Math.max(0, d - 8) / 40);
  }

  return {
    unlock: ensure,
    shot(pos, def, own, listener) {
      const g = (own ? 0.45 : 0.28) * dist(pos, listener);
      noiseBurst(0.09, def && def.kind === 'hybrid' ? 2000 : 2400, g);
      if (own) tone(150, 0.06, 0.16, 'square', 70);
    },
    dryFire() { tone(1200, 0.03, 0.12, 'square'); },
    reload() {
      tone(700, 0.05, 0.14, 'square');
      tone(520, 0.05, 0.14, 'square', undefined, 0.16);
      tone(860, 0.04, 0.12, 'square', undefined, 0.3);
    },
    swing() { noiseBurst(0.11, 1500, 0.22, 'bandpass'); },
    hit() { tone(1900, 0.04, 0.18, 'sine'); },
    headshot() {
      tone(2400, 0.06, 0.22, 'sine');
      tone(1200, 0.08, 0.13, 'sine');
    },
    kill() { tone(520, 0.09, 0.2, 'triangle', 780); },
    hurt() { tone(220, 0.12, 0.22, 'sawtooth', 110); },
    raiderDown(pos, listener) { noiseBurst(0.25, 500, 0.35 * dist(pos, listener)); },
    waveStart(wave) {
      tone(440, 0.12, 0.2, 'sine');
      tone(554, 0.12, 0.2, 'sine', undefined, 0.11);
      tone(659, 0.18, 0.2, 'sine', undefined, 0.22);
    },
    waveClear() {
      [523, 659, 784].forEach((f, i) => tone(f, 0.16, 0.2, 'sine', undefined, i * 0.12));
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.24, 0.22, 'sine', undefined, i * 0.15));
    },
    lose() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.26, 0.2, 'sine', undefined, i * 0.17));
    },
    click() { tone(990, 0.06, 0.15, 'sine'); },
  };
}
