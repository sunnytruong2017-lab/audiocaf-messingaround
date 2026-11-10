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

  // Hover layer: soft hum on the same notes as the pad (A, E, A), so it blends in harmonically.
  // Sine + a little triangle through a low-pass keeps it warm; louder than the pad (which ducks) so it's noticeable.
  function startHum() {
    if (ctx.state !== 'running' || hum) return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(1.3, t + 0.15);
    out.connect(master);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    const trem = ctx.createGain(); // gentle amplitude wobble
    trem.gain.value = 0.8;
    lp.connect(trem);
    trem.connect(out);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 3;
    const lg = ctx.createGain();
    lg.gain.value = 0.15;
    lfo.connect(lg);
    lg.connect(trem.gain);
    lfo.start();

    const nodes = [lfo];
    [[110, 'sine', 0, 1], [110, 'triangle', 4, 0.35], [164.81, 'sine', 0, 0.7], [220, 'sine', 0, 0.5], [55, 'sine', 0, 0.6]]
      .forEach(([f, type, d, a]) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = d;
        const og = ctx.createGain();
        og.gain.value = a;
        o.connect(og);
        og.connect(lp);
        o.start();
        nodes.push(o);
      });
    ambient.gain.setTargetAtTime(AMBIENT * 0.3, t, 0.05); // duck the pad
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
