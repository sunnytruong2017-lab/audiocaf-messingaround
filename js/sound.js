(() => {
  const TARGET = 0.5;
  const btn = document.getElementById('sound-toggle');
  const title = document.querySelector('h1');
  let ctx, master, hum, muted = false;

  function startAmbient() {
    const bus = ctx.createGain();
    bus.gain.value = 0.1;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.55;
    const fb = ctx.createGain();
    fb.gain.value = 0.45;
    delay.connect(fb);
    fb.connect(delay);
    bus.connect(lp);
    lp.connect(master);
    lp.connect(delay);
    delay.connect(master);

    // Soft Am9 pad: slow-swelling detuned sines
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
        g.connect(bus);
        o.start();
        lfo.start();
      });
    });
  }

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    startAmbient();
    ctx.resume();
    master.gain.linearRampToValueAtTime(TARGET, ctx.currentTime + 4);
    render();
  }

  function startHum() {
    if (!ctx || hum) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.connect(g);
    g.connect(master);
    const nodes = [[130.81, 'sine', 1], [196, 'sine', 0.5], [261.63, 'triangle', 0.15]]
      .flatMap(([f, type, amp]) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        const og = ctx.createGain();
        og.gain.value = amp;
        const v = ctx.createOscillator();
        v.frequency.value = 4.5;
        const vg = ctx.createGain();
        vg.gain.value = f * 0.004;
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
    g.gain.linearRampToValueAtTime(0, t + 0.9);
    nodes.forEach((n) => n.stop(t + 1));
  }

  function render() {
    btn.textContent = !ctx ? '♪ tap for sound' : muted ? '♪ off' : '♪ on';
    btn.setAttribute('aria-pressed', String(!!ctx && !muted));
  }

  btn.addEventListener('click', () => {
    if (!ctx) return init();
    muted = !muted;
    master.gain.setTargetAtTime(muted ? 0 : TARGET, ctx.currentTime, 0.3);
    render();
  });

  // Browsers block audio until a user gesture: any click/key/touch unlocks it.
  const unlock = (e) => {
    if (btn.contains(e.target)) return;
    init();
  };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });

  title.addEventListener('mouseenter', startHum);
  title.addEventListener('mouseleave', stopHum);
  render();
})();
