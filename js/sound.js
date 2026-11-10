(() => {
  const TARGET = 0.5;
  const AMBIENT = 0.1;
  const btn = document.getElementById('sound-toggle');
  const title = document.querySelector('h1');
  let muted = false, hum = null, ramped = false;

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const ambient = ctx.createGain();
  ambient.gain.value = AMBIENT;

  // Ambient pad: soft Am9 chord, slow-swelling detuned sines + echo
  (function buildAmbient() {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.55;
    const fb = ctx.createGain();
    fb.gain.value = 0.45;
    delay.connect(fb);
    fb.connect(delay);
    ambient.connect(lp);
    lp.connect(master);
    lp.connect(delay);
    delay.connect(master);
    [110, 164.81, 220, 246.94, 329.63].forEach((f, i) => {
      [-5, 5].forEach((d) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        o.detune.value = d;
        const g = ctx.createGain();
        g.gain.value = 0.5;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.04 + i * 0.013;
        const lg = ctx.createGain();
        lg.gain.value = 0.4;
        lfo.connect(lg);
        lg.connect(g.gain);
        o.connect(g);
        g.connect(ambient);
        o.start();
        lfo.start();
      });
    });
  })();

  function fadeIn() {
    if (ramped || ctx.state !== 'running') return;
    ramped = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(muted ? 0 : TARGET, ctx.currentTime + 3);
    render();
  }
  ctx.onstatechange = fadeIn;

  // Hover layer: vocal-style "mmm" hum (sawtooth through formant filters) plus a bell ping.
  // Different timbre and register from the pad, and the pad ducks while it plays.
  function ping() {
    const t = ctx.currentTime;
    [[880, 0.3], [1318.5, 0.18], [1760, 0.1]].forEach(([f, a]) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 1);
    });
  }

  function startHum() {
    if (ctx.state !== 'running' || hum) return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(1.1, t + 0.1);
    out.connect(master);
    const src = ctx.createGain();
    src.gain.value = 1;
    [[300, 6, 1], [900, 8, 0.6], [2400, 10, 0.25]].forEach(([f, q, a]) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = q;
      const bg = ctx.createGain();
      bg.gain.value = a;
      src.connect(bp);
      bp.connect(bg);
      bg.connect(out);
    });
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const nodes = [vib];
    [[196, 'sawtooth', -8], [196, 'sawtooth', 8], [98, 'sine', 0]].forEach(([f, type, d]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = d;
      const vg = ctx.createGain();
      vg.gain.value = 4;
      vib.connect(vg);
      vg.connect(o.frequency);
      const og = ctx.createGain();
      og.gain.value = type === 'sine' ? 0.5 : 0.4;
      o.connect(og);
      og.connect(src);
      o.start();
      nodes.push(o);
    });
    vib.start();
    ambient.gain.setTargetAtTime(AMBIENT * 0.2, t, 0.05); // duck the pad
    ping();
    hum = { out, nodes };
  }

  function stopHum() {
    if (!hum) return;
    const { out, nodes } = hum;
    hum = null;
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0, t + 0.2);
    ambient.gain.setTargetAtTime(AMBIENT, t, 0.1);
    nodes.forEach((n) => n.stop(t + 0.25));
  }

  function render() {
    const on = ctx.state === 'running';
    btn.textContent = !on ? '♪ tap for sound' : muted ? '♪ off' : '♪ on';
    btn.setAttribute('aria-pressed', String(on && !muted));
  }

  btn.addEventListener('click', () => {
    if (ctx.state !== 'running') return ctx.resume();
    muted = !muted;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(muted ? 0 : TARGET, ctx.currentTime, 0.2);
    render();
  });

  // Try to start immediately; if the browser blocks it, any click/key/touch starts it.
  ctx.resume().catch(() => {});
  const unlock = (e) => {
    if (btn.contains(e.target)) return;
    ctx.resume();
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
    document.addEventListener(ev, unlock, { once: true }));

  title.addEventListener('mouseenter', startHum);
  title.addEventListener('mouseleave', stopHum);
  render();
  fadeIn();
})();
