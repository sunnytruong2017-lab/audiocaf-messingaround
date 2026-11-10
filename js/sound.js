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

  // Hover layer: warm, audible hum (A3 + E4 + A4 with slight beating and vibrato)
  function startHum() {
    if (ctx.state !== 'running' || hum) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    lp.connect(g);
    g.connect(master);
    ambient.gain.setTargetAtTime(AMBIENT * 0.35, t, 0.08); // duck pad so hum stands out
    const nodes = [
      [220, 'sine', 1, 0], [220, 'sine', 0.8, 6],
      [329.63, 'sine', 0.6, 0], [440, 'triangle', 0.25, 0], [440, 'sine', 0.4, -7],
    ].flatMap(([f, type, amp, detune]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      const og = ctx.createGain();
      og.gain.value = amp * 0.5;
      const v = ctx.createOscillator();
      v.frequency.value = 5;
      const vg = ctx.createGain();
      vg.gain.value = f * 0.006;
      v.connect(vg);
      vg.connect(o.frequency);
      o.connect(og);
      og.connect(lp);
      o.start();
      v.start();
      return [o, v];
    });
    hum = { g, nodes };
  }

  function stopHum() {
    if (!hum) return;
    const { g, nodes } = hum;
    hum = null;
    const t = ctx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + 0.2);
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
