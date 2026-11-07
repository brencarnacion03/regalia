// Regalía effects: sounds, confetti, snow and little haptics.
window.FX = (function () {
  "use strict";
  const reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const COLORS = ["#123f30", "#1f5e46", "#c9a24f", "#e9d39a", "#a51c30", "#c8283f", "#f5e2a8"];
  let soundOn = true;
  try { soundOn = localStorage.getItem("regalia_sound") !== "off"; } catch (e) {}

  // ---------- sound (made in the browser, no files) ----------
  let ac = null;
  function audio() {
    if (!soundOn) return null;
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
    } catch (e) { return null; }
    return ac;
  }
  function tone(freq, dur, opts) {
    const a = audio(); if (!a) return;
    const o = Object.assign({ type: "sine", vol: 0.12, when: 0, slide: 0 }, opts || {});
    const t = a.currentTime + o.when;
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(freq * o.slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  const sound = {
    tick() { tone(1500, 0.04, { type: "square", vol: 0.035 }); },
    whoosh() { tone(220, 0.35, { type: "sawtooth", vol: 0.03, slide: 3 }); },
    chime() { tone(1046, 0.25, { type: "triangle", vol: 0.1 }); tone(1568, 0.4, { type: "triangle", vol: 0.08, when: 0.12 }); },
    pop() { tone(600, 0.08, { type: "sine", vol: 0.1, slide: 1.8 }); },
    drumroll(ms) {
      const n = Math.floor(ms / 45);
      for (let i = 0; i < n; i++) tone(140 + Math.random() * 30, 0.04, { type: "triangle", vol: 0.04 + 0.05 * (i / n), when: i * 0.045 });
    },
    fanfare() {
      const notes = [523, 659, 784, 1046];
      notes.forEach((f, i) => tone(f, 0.22, { type: "triangle", vol: 0.12, when: i * 0.11 }));
      [1046, 1318, 1568].forEach(f => tone(f, 0.9, { type: "triangle", vol: 0.07, when: 0.48 }));
      // sleigh bells
      for (let i = 0; i < 10; i++) tone(2600 + Math.random() * 900, 0.08, { type: "square", vol: 0.015, when: 0.5 + i * 0.07 });
    },
  };
  // ---------- Christmas music: a gentle music-box "Jingle Bells" (public domain, 1857) ----------
  const N = { G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784, C4: 261.6, G3: 196, F3: 174.6, D4: 293.7 };
  const SONG = [
    ["E5",1],["E5",1],["E5",2], ["E5",1],["E5",1],["E5",2], ["E5",1],["G5",1],["C5",1.5],["D5",.5], ["E5",4],
    ["F5",1],["F5",1],["F5",1.5],["F5",.5], ["F5",1],["E5",1],["E5",1],["E5",.5],["E5",.5], ["E5",1],["D5",1],["D5",1],["E5",1], ["D5",2],["G5",2],
    ["E5",1],["E5",1],["E5",2], ["E5",1],["E5",1],["E5",2], ["E5",1],["G5",1],["C5",1.5],["D5",.5], ["E5",4],
    ["F5",1],["F5",1],["F5",1],["F5",1], ["F5",1],["E5",1],["E5",1],["E5",.5],["E5",.5], ["G5",1],["G5",1],["F5",1],["D5",1], ["C5",4],
  ];
  const BASS = ["C4","G3","C4","G3", "C4","G3","C4","G3", "F3","C4","C4","G3", "G3","D4","G3","G3",
                "C4","G3","C4","G3", "C4","G3","C4","G3", "F3","C4","C4","G3", "G3","G3","C4","C4"];
  let musicOn = false, musicGain = null, musicTimer = null;
  function bell(a, dest, freq, t, dur, vol) {
    [[1, vol], [2, vol * 0.25], [3.01, vol * 0.08]].forEach(([m, v]) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.value = freq * m;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.35, dur * 1.6));
      o.connect(g).connect(dest); o.start(t); o.stop(t + Math.max(0.4, dur * 1.7));
    });
  }
  function playLoop() {
    if (!musicOn) return;
    let a;
    try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); a = ac; } catch (e) { return; }
    const beat = 0.32;
    let t = a.currentTime + 0.1, total = 0;
    SONG.forEach(([n, b]) => { bell(a, musicGain, N[n], t + total * beat, b * beat, 0.09); total += b; });
    BASS.forEach((n, i) => bell(a, musicGain, N[n], t + i * 2 * beat, beat, 0.05));
    musicTimer = setTimeout(playLoop, (total + 2) * beat * 1000);
  }
  const music = {
    get on() { return musicOn; },
    start() {
      if (musicOn) return;
      try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); } catch (e) { return; }
      musicOn = true;
      musicGain = ac.createGain(); musicGain.gain.value = 0.9; musicGain.connect(ac.destination);
      playLoop();
    },
    stop() {
      musicOn = false; clearTimeout(musicTimer);
      if (musicGain && ac) { const g = musicGain; g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.15); setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 800); }
      musicGain = null;
    },
  };
  document.addEventListener("visibilitychange", () => {
    if (!ac) return;
    if (document.visibilityState === "hidden" && musicOn) ac.suspend();
    else if (document.visibilityState === "visible" && musicOn) ac.resume();
  });

  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function setSound(on) {
    soundOn = on;
    try { localStorage.setItem("regalia_sound", on ? "on" : "off"); } catch (e) {}
    if (on) sound.pop();
  }

  // ---------- confetti ----------
  let cCanvas = null, cCtx = null, parts = [], cRunning = false;
  function ensureConfetti() {
    if (cCanvas) return;
    cCanvas = document.createElement("canvas");
    cCanvas.className = "fx-confetti";
    cCanvas.setAttribute("aria-hidden", "true");
    document.body.append(cCanvas);
    cCtx = cCanvas.getContext("2d");
    const fit = () => { const d = window.devicePixelRatio || 1; cCanvas.width = innerWidth * d; cCanvas.height = innerHeight * d; cCtx.setTransform(d, 0, 0, d, 0, 0); };
    fit(); addEventListener("resize", fit);
  }
  function confetti(opts) {
    const o = Object.assign({ x: innerWidth / 2, y: innerHeight / 2, count: 140, spread: Math.PI * 2, angle: -Math.PI / 2, power: 11, rain: false }, opts || {});
    ensureConfetti();
    const count = reduce ? Math.min(30, o.count) : o.count;
    for (let i = 0; i < count; i++) {
      const a = o.rain ? Math.PI / 2 : o.angle + (Math.random() - 0.5) * o.spread;
      const v = o.rain ? 1 + Math.random() * 2 : o.power * (0.45 + Math.random() * 0.75);
      parts.push({
        x: o.rain ? Math.random() * innerWidth : o.x, y: o.rain ? -20 - Math.random() * innerHeight * 0.6 : o.y,
        vx: Math.cos(a) * v + (o.rain ? (Math.random() - 0.5) * 2 : 0), vy: Math.sin(a) * v,
        r: 4 + Math.random() * 6, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.35,
        shape: o.shapes ? o.shapes[(Math.random() * o.shapes.length) | 0] : (Math.random() < 0.15 ? "star" : Math.random() < 0.55 ? "rect" : "circle"),
        color: (o.colors || COLORS)[(Math.random() * (o.colors || COLORS).length) | 0], life: 0, tilt: Math.random() * 6.28,
      });
    }
    if (!cRunning) { cRunning = true; requestAnimationFrame(stepConfetti); }
  }
  function star(ctx, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const a = (i * Math.PI) / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  function stepConfetti() {
    cCtx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.y < innerHeight + 40 && p.life < 420);
    for (const p of parts) {
      p.life++; p.vy += 0.22; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.tilt += 0.1;
      cCtx.save(); cCtx.translate(p.x, p.y); cCtx.rotate(p.rot); cCtx.fillStyle = p.color;
      if (p.shape === "rect") { cCtx.scale(1, Math.cos(p.tilt)); cCtx.fillRect(-p.r / 2, -p.r, p.r, p.r * 2); }
      else if (p.shape === "circle") { cCtx.beginPath(); cCtx.arc(0, 0, p.r / 2, 0, 6.28); cCtx.fill(); }
      else star(cCtx, p.r);
      cCtx.restore();
    }
    if (parts.length) requestAnimationFrame(stepConfetti);
    else { cRunning = false; cCtx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function burstFrom(el, count) {
    const r = el.getBoundingClientRect();
    confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: count || 60, power: 9, spread: Math.PI * 1.2 });
  }
  function celebrate() {
    confetti({ x: innerWidth * 0.15, y: innerHeight * 0.85, angle: -Math.PI / 3, spread: 0.9, power: 17, count: 110 });
    confetti({ x: innerWidth * 0.85, y: innerHeight * 0.85, angle: (-2 * Math.PI) / 3, spread: 0.9, power: 17, count: 110 });
    setTimeout(() => confetti({ rain: true, count: 120 }), 450);
  }

  // ---------- gentle background snow ----------
  function snow() {
    if (reduce) return;
    const cv = document.createElement("canvas");
    cv.className = "fx-snow"; cv.setAttribute("aria-hidden", "true");
    document.body.prepend(cv);
    const ctx = cv.getContext("2d");
    let W, H, flakes = [];
    const fit = () => { const d = window.devicePixelRatio || 1; W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    fit(); addEventListener("resize", fit);
    const N = Math.min(60, Math.round(innerWidth / 18));
    for (let i = 0; i < N; i++) flakes.push({ x: Math.random() * W, y: Math.random() * H, r: 1.5 + Math.random() * 3, s: 0.3 + Math.random() * 0.8, d: Math.random() * 6.28 });
    let last = 0;
    function step(t) {
      if (document.visibilityState === "visible" && t - last > 30) {
        last = t; ctx.clearRect(0, 0, W, H); ctx.fillStyle = "rgba(160,185,200,.55)";
        for (const f of flakes) {
          f.y += f.s; f.d += 0.01; f.x += Math.sin(f.d) * 0.4;
          if (f.y > H + 5) { f.y = -5; f.x = Math.random() * W; }
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.28); ctx.fill();
        }
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  return { sound, music, buzz, confetti, burstFrom, celebrate, snow, reduce, get soundOn() { return soundOn; }, setSound };
})();
