(function () {
  "use strict";
  const CFG = window.REGALIA_CONFIG || {};
  const app = document.getElementById("app");
  const TOKEN_KEY = "regalia_token";
  const ADMIN_KEY = "regalia_organizer";

  // ---------- language ----------
  const LANG_KEY = "regalia_lang";
  let lang = "en";
  try { if (localStorage.getItem(LANG_KEY) === "es") lang = "es"; } catch (e) {}
  const ES = window.REGALIA_ES || {};
  function tr(s) { return lang === "es" && typeof s === "string" && ES[s] != null ? ES[s] : s; }
  function L(en, es) { return lang === "es" ? es : en; }
  function applyStaticLang() {
    document.documentElement.lang = lang;
    const b = document.getElementById("langBtn");
    if (b) {
      b.textContent = tr(lang === "es" ? "🌐 English" : "🌐 Traducir");
      b.setAttribute("aria-label", lang === "es" ? "Show the page in English" : "Ver la página en español");
    }
    const tag = document.getElementById("tagline");
    if (tag && tag.dataset.en) tag.textContent = tr(tag.dataset.en);
  }
  function setTagline(en) { const t = document.getElementById("tagline"); t.dataset.en = en; t.textContent = tr(en); }

  // ---------- small helpers ----------
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "text") e.textContent = tr(v);
      else if (k === "placeholder" || k === "aria-label") e.setAttribute(k, tr(v));
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(tr(String(k))));
    return e;
  }
  const store = {
    get(k, s) { try { return (s ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set(k, v, s) { try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} },
    del(k, s) { try { (s ? sessionStorage : localStorage).removeItem(k); } catch (e) {} },
  };
  function fmtDate(s) {
    if (!s) return "";
    const d = new Date(s + "T12:00:00");
    return isNaN(d) ? s : d.toLocaleDateString(lang === "es" ? "es" : undefined, { weekday: "long", month: "long", day: "numeric" });
  }
  function firstName(n) { return (n || "").trim().split(/\s+/)[0] || "there"; }

  async function rpc(fn, args) {
    if (!CFG.url || !CFG.anonKey) throw Object.assign(new Error("not_configured"), { code: "not_configured" });
    const r = await fetch(CFG.url.replace(/\/$/, "") + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.anonKey, Authorization: "Bearer " + CFG.anonKey },
      body: JSON.stringify(args || {}),
    });
    const t = await r.text();
    let j = null;
    try { j = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) {
      const code = (j && j.message) || "request_failed";
      throw Object.assign(new Error(code), { code });
    }
    return j;
  }

  function daysUntil(s) {
    if (!s) return null;
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((new Date(y, m - 1, d) - today) / 86400000);
  }
  let giftDayCelebrated = false;
  function renderCountdown(ev) {
    const cd = document.getElementById("countdown");
    if (!cd) return;
    const days = daysUntil(ev && ev.exchange_date);
    if (days == null || days < 0) { cd.hidden = true; return; }
    cd.hidden = false;
    cd.className = "countdown" + (days === 0 ? " today" : "");
    cd.replaceChildren();
    if (days === 0) {
      cd.textContent = L("🎉 It's gift day! Merry Christmas!", "🎉 ¡Hoy es el día del regalo! ¡Feliz Navidad!");
      if (!giftDayCelebrated) { giftDayCelebrated = true; setTimeout(() => FX.celebrate(), 700); }
    } else if (days === 1) {
      cd.textContent = L("🎁 Tomorrow is gift day!", "🎁 ¡Mañana es el día del regalo!");
    } else {
      cd.append(L("🎄 ", "🎄 ¡Faltan "), h("b", null, String(days)), L(" days until gift day!", " días para el día del regalo!"));
    }
  }

  function renderEvent(ev, count) {
    renderCountdown(ev);
    const box = document.getElementById("eventChips");
    box.replaceChildren();
    if (ev && ev.budget) box.append(h("span", { class: "chip", text: L("Budget: ", "Presupuesto: ") + ev.budget }));
    if (ev && ev.exchange_date) box.append(h("span", { class: "chip", text: L("Gift day: ", "Día del regalo: ") + fmtDate(ev.exchange_date) }));
    if (count != null) box.append(h("span", { class: "chip berry", text: count + (count === 1 ? L(" person", " persona") : L(" people", " personas")) }));
  }

  function showError(title, msg) {
    app.replaceChildren(h("section", { class: "card" }, h("h2", { text: title }), h("p", { class: "note", text: msg })));
  }

  // ---------- routing ----------
  function route() {
    const hash = location.hash.slice(1);
    const params = new URLSearchParams(hash);
    if (params.get("k")) {
      store.set(TOKEN_KEY, params.get("k"));
      return personView(params.get("k"));
    }
    if (hash === "organizer") return organizerView();
    const saved = store.get(TOKEN_KEY);
    if (saved) return personView(saved);
    welcomeView();
  }
  window.addEventListener("hashchange", route);

  function welcomeView() {
    renderEvent(null, null);
    app.replaceChildren(
      h("section", { class: "card" },
        h("h2", { text: "Welcome to our family Secret Santa!" }),
        h("p", { text: "To join, open the personal link the organizer sent you by text or WhatsApp. It takes you straight to your own page." }),
        h("p", { class: "note", text: "Don't have a link yet? Ask the organizer to send you one." })
      )
    );
  }

  // ---------- family member page ----------
  let personData = null, personToken = null, revealed = false, spinning = false;

  async function personView(token) {
    personToken = token;
    // keep the personal link in the address so "Add to Home Screen" saves the right page
    try { if (!location.hash.includes(token)) history.replaceState(null, "", "#k=" + token); } catch (e) {}
    try {
      const data = await rpc("regalia_me", { p_token: token });
      if (!data) {
        store.del(TOKEN_KEY);
        return showError("This link isn't working", "Ask the organizer to send you your personal link again.");
      }
      personData = data;
      renderPerson();
    } catch (e) {
      showError("Can't load right now", e.code === "not_configured"
        ? "The website isn't connected to its database yet."
        : "Check your internet connection, then refresh the page.");
    }
  }

  function renderPerson() {
    if (spinning) return;
    const { me, match, event, everyone } = personData;
    renderEvent(event, everyone.length);
    const drawn = !!(event && event.drawn_at);
    setTagline("Our family's Secret Santa.");

    const steps = h("ol", { class: "steps", "aria-label": "How it works" },
      h("li", { class: me.joined ? "done" : "" }, h("span", { class: "num", text: me.joined ? "✓" : "1" }),
        h("span", null, h("b", { text: "Fill in your wish card" }), h("span", { class: "hint", text: "Your sizes and gift ideas. Then press the red Save button." }))),
      h("li", { class: drawn ? "done" : "" }, h("span", { class: "num", text: drawn ? "✓" : "2" }),
        h("span", null, h("b", { text: "Wait for the names to be drawn" }), h("span", { class: "hint", text: "The organizer does this when everyone is ready." }))),
      h("li", null, h("span", { class: "num", text: "3" }),
        h("span", null, h("b", { text: "Spin the wheel" }), h("span", { class: "hint", text: "It shows who you're buying a gift for. Keep it a secret!" })))
    );

    const matchBox = h("div", { class: "match empty" });
    fillMatch(matchBox, drawn, match, everyone, me);

    app.replaceChildren(
      h("p", { class: "hello", text: L("Hi, ", "¡Hola, ") + firstName(me.name) + "! 👋" }),
      steps,
      h("section", null, h("h2", { text: "Who I'm buying for" }), matchBox),
      wishForm(me),
      h("section", null,
        h("h2", { text: "Who's in" }),
        h("ul", { class: "family" }, everyone.map(p =>
          h("li", null,
            h("span", { class: "name" }, p.name, p.id === me.id ? h("span", { class: "you", text: "you" }) : null),
            h("span", { class: "tick " + (p.joined ? "yes" : "no"), text: p.joined ? "✓ Card filled in" : "Not yet" }))))
      )
    );
  }

  function fillMatch(box, drawn, match, everyone, me) {
    box.replaceChildren();
    if (!drawn || !match) {
      box.className = "match empty";
      box.append(
        h("span", { class: "label", text: drawn ? "Not in this draw" : "Not drawn yet" }),
        h("p", { class: "note", text: drawn
          ? "Names were drawn before you were added. Ask the organizer to draw again."
          : "Come back after the organizer draws names. Your wheel will be right here." })
      );
      return;
    }
    if (!revealed) return buildWheel(box, match, everyone, me);
    box.className = "match";
    box.append(h("span", { class: "label", text: "You're buying a gift for" }), h("p", { class: "who", text: match.name }));
    box.append(h("div", { class: "sizes" },
      [["Shirt", match.shirt], ["Pants", match.pants], ["Shoes", match.shoes]].map(([k, v]) =>
        h("div", { class: "size" }, h("span", { class: "label", text: k }), h("b", { text: v || "—" })))));
    const w = (match.wishes || []).filter(Boolean);
    box.append(h("span", { class: "label", text: "Gifts they would love" }));
    box.append(w.length ? h("ol", { class: "wishes" }, w.map(x => h("li", { text: x })))
                        : h("p", { style: "margin:0", text: "They haven't added gift ideas yet. Check back later." }));
    box.append(h("button", { type: "button", class: "light small", text: "Hide", onclick: () => { revealed = false; renderPerson(); } }));
  }

  function buildWheel(box, match, everyone, me) {
    box.className = "match spin";
    box.append(h("span", { class: "label", text: "Drag the wheel or tap the button!" }));
    const people = everyone.filter(p => p.id !== me.id);
    if (!people.some(p => p.id === match.id)) people.push({ id: match.id, name: match.name });
    const names = people.map(p => p.name || "Someone");
    const target = people.findIndex(p => p.id === match.id);
    const n = people.length, seg = (Math.PI * 2) / n, TAU = Math.PI * 2, TOP = -Math.PI / 2;
    const css = getComputedStyle(document.documentElement);
    const red = "#a51c30", green = css.getPropertyValue("--pine").trim(), gold = css.getPropertyValue("--gold-2").trim(), ring = css.getPropertyValue("--gold").trim();
    const colors = names.map((_, i) => (n % 2 === 1 && i === n - 1 && n > 1) ? gold : (i % 2 ? green : red));
    const cv = h("canvas", { role: "img", "aria-label": "Prize wheel with family names" });
    const pointer = h("div", { class: "pointer" });
    const wrap = h("div", { class: "wheelwrap" }, pointer, cv);
    box.append(wrap);
    const size = 320, dpr = window.devicePixelRatio || 1;
    cv.width = size * dpr; cv.height = size * dpr;
    const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
    const R = size / 2 - 10, C = size / 2;
    function draw(rot, hi) {
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath(); ctx.arc(C, C, R + 6, 0, TAU); ctx.fillStyle = "#0b2c21"; ctx.fill();
      // little lights around the rim
      for (let i = 0; i < 24; i++) {
        const a = rot * 0.5 + (i * TAU) / 24;
        ctx.beginPath(); ctx.arc(C + Math.cos(a) * (R + 3), C + Math.sin(a) * (R + 3), 2.2, 0, TAU);
        ctx.fillStyle = i % 2 ? ring : "#fff7e0"; ctx.fill();
      }
      for (let i = 0; i < n; i++) {
        const a0 = rot + i * seg;
        ctx.beginPath(); ctx.moveTo(C, C); ctx.arc(C, C, R - 2, a0, a0 + seg); ctx.closePath();
        ctx.fillStyle = colors[i]; ctx.fill();
        if (hi === i) { ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = ring; ctx.stroke(); }
        else { ctx.strokeStyle = "rgba(233,211,154,.55)"; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.save(); ctx.translate(C, C); ctx.rotate(a0 + seg / 2);
        ctx.fillStyle = colors[i] === gold ? green : "#fff";
        ctx.font = "700 " + (n > 10 ? 12 : 15) + "px Figtree, system-ui, sans-serif";
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        const label = names[i].length > 14 ? names[i].slice(0, 13) + "…" : names[i];
        ctx.fillText(label, R - 16, 0); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(C, C, 28, 0, TAU); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = ring; ctx.stroke();
      ctx.font = "24px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🎁", C, C + 1);
    }
    function segAt(r) { let a = (TOP - r) % TAU; if (a < 0) a += TAU; return Math.floor(a / seg) % n; }
    let rot = TOP - seg / 2, lastSeg = segAt(rot);
    function flick() { pointer.classList.remove("flick"); void pointer.offsetWidth; pointer.classList.add("flick"); }
    function setRot(r, hi) {
      rot = r; draw(rot, hi);
      const s = segAt(rot);
      if (s !== lastSeg) { lastSeg = s; FX.sound.tick(); flick(); }
    }
    draw(rot);

    const b = h("button", { type: "button", class: "big spinbtn", text: "🎡 Spin the wheel" });
    box.append(b);

    function animate(from, to, dur, ease, done) {
      const t0 = performance.now();
      (function frame(t) {
        const p = Math.min(1, (t - t0) / dur);
        setRot(from + (to - from) * ease(p));
        if (p < 1) requestAnimationFrame(frame); else done();
      })(t0);
    }

    function spin(dir, speed) {
      if (spinning) return;
      spinning = true; b.disabled = true; b.textContent = tr("Spinning…");
      wrap.classList.add("spinning"); FX.sound.whoosh(); FX.buzz(25);
      const jitter = (Math.random() - 0.5) * seg * 0.7;
      let end = TOP - (target + 0.5) * seg + jitter;
      const turns = FX.reduce ? 1 : Math.min(9, 4 + Math.round((speed || 0.012) * 250));
      if (dir >= 0) { while (end < rot) end += TAU; end += turns * TAU; }
      else { while (end > rot) end -= TAU; end -= turns * TAU; }
      const dur = FX.reduce ? 800 : 3800 + turns * 180;
      animate(rot, end, dur, p => 1 - Math.pow(1 - p, 4), () => {
        wrap.classList.remove("spinning");
        // flash the winning slice with a drumroll
        FX.sound.drumroll(900);
        let k = 0;
        const blink = setInterval(() => {
          draw(rot, k % 2 ? -1 : target); k++;
          if (k > 7) {
            clearInterval(blink); draw(rot, target);
            showReveal(match.name, () => { spinning = false; revealed = true; renderPerson(); });
          }
        }, 120);
      });
    }

    b.addEventListener("click", () => {
      if (spinning) return;
      if (FX.reduce) return spin(1, 0.012);
      // a little wind-up before it goes
      b.disabled = true;
      animate(rot, rot - 0.35, 280, p => p * (2 - p), () => { b.disabled = false; spin(1, 0.012); });
    });

    // drag / flick the wheel with a finger or the mouse
    cv.style.touchAction = "none";
    let dragging = false, lastAng = 0, lastT = 0, vel = 0;
    const angleAt = e => { const r = cv.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
    cv.addEventListener("pointerdown", e => {
      if (spinning) return;
      dragging = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      lastAng = angleAt(e); lastT = performance.now(); vel = 0; wrap.classList.add("grab");
    });
    cv.addEventListener("pointermove", e => {
      if (!dragging) return;
      const a = angleAt(e); let d = a - lastAng;
      if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
      const t = performance.now();
      vel = 0.6 * vel + 0.4 * (d / Math.max(8, t - lastT));
      lastAng = a; lastT = t; setRot(rot + d);
    });
    const release = () => {
      if (!dragging) return;
      dragging = false; wrap.classList.remove("grab");
      if (performance.now() - lastT > 120) vel = 0;
      if (Math.abs(vel) > 0.003) spin(Math.sign(vel), Math.abs(vel));
    };
    cv.addEventListener("pointerup", release);
    cv.addEventListener("pointercancel", release);
  }

  function showReveal(name, done) {
    const nameEl = h("p", { class: "reveal-name" });
    let li = 0;
    name.trim().split(/\s+/).forEach((word, wi) => {
      if (wi) nameEl.append(" ");
      const w = h("span", { class: "word" });
      [...word].forEach(ch => { w.append(h("span", { class: "ch", style: "animation-delay:" + (1.15 + li * 0.06).toFixed(2) + "s" }, ch)); li++; });
      nameEl.append(w);
    });
    const btn = h("button", { type: "button", class: "big", text: "See their wish list 🎄" });
    const ov = h("div", { class: "reveal-ov", role: "dialog", "aria-modal": "true", "aria-label": "Your Secret Santa match" },
      h("div", { class: "reveal-card" },
        h("div", { class: "giftbox", "aria-hidden": "true" }, h("span", { class: "gb" }, "🎁"), h("span", { class: "burst" })),
        h("p", { class: "reveal-kicker", text: "You're buying a gift for…" }),
        nameEl,
        h("p", { class: "reveal-sub", text: "Keep it secret! 🤫" }),
        btn));
    document.body.append(ov);
    requestAnimationFrame(() => ov.classList.add("show"));
    setTimeout(() => { FX.sound.fanfare(); FX.celebrate(); FX.buzz([60, 40, 120]); }, FX.reduce ? 100 : 950);
    const close = () => {
      ov.classList.remove("show"); ov.classList.add("hide");
      setTimeout(() => { ov.remove(); done(); }, 300);
    };
    btn.addEventListener("click", close);
    ov.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
    setTimeout(() => btn.focus(), 1700);
  }

  // wraps the wish card like a present, then unwraps it
  function giftWrap(form) {
    if (!form) return;
    form.classList.add("wrapping");
    const r = form.getBoundingClientRect();
    const y = Math.max(70, Math.min(r.height - 70, innerHeight / 2 - r.top));
    const bowWrap = document.createElement("div");
    bowWrap.innerHTML =
      '<svg class="bow" viewBox="0 0 150 88" style="top:' + y + 'px" aria-hidden="true">' +
      '<defs><linearGradient id="bowGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f7e7b4"/><stop offset=".5" stop-color="#d9b25c"/><stop offset="1" stop-color="#a9792f"/></linearGradient></defs>' +
      '<path class="tail l" pathLength="1" d="M75 44 C68 58 60 70 48 84"/>' +
      '<path class="tail r" pathLength="1" d="M75 44 C82 58 90 70 102 84"/>' +
      '<path class="loop l" pathLength="1" d="M75 44 C58 10 14 6 16 34 C18 52 50 52 75 44 Z"/>' +
      '<path class="loop r" pathLength="1" d="M75 44 C92 10 136 6 134 34 C132 52 100 52 75 44 Z"/>' +
      '<circle pathLength="1" cx="75" cy="44" r="6"/></svg>';
    const tag = h("div", { class: "gtag", style: "top:" + y + "px" }, h("i", null, "✓"), h("span", { text: "Saved!" }));
    const fx = h("div", { class: "wrapfx", "aria-hidden": "true" },
      h("div", { class: "paper" }),
      h("div", { class: "rib-v" }), h("div", { class: "rib-h", style: "top:" + y + "px" }),
      h("div", { class: "sheen" }),
      bowWrap.firstChild, tag);
    form.append(fx);
    FX.sound.whoosh();
    setTimeout(() => {
      FX.sound.chime(); FX.buzz(40);
      const r2 = form.getBoundingClientRect();
      FX.confetti({ x: r2.left + r2.width / 2, y: r2.top + y, count: 46, power: 7, spread: Math.PI * 2,
        colors: ["#f5e2a8", "#e3b341", "#ffffff", "#c8283f", "#e8384f"], shapes: ["star", "circle"] });
    }, FX.reduce ? 50 : 1550);
    setTimeout(() => fx.classList.add("leave"), FX.reduce ? 1000 : 3100);
    setTimeout(() => { fx.remove(); form.classList.remove("wrapping"); }, FX.reduce ? 1100 : 3750);
  }

  function wishForm(me) {
    const w = me.wishes || [];
    const f = (id, label, val, ph) => h("div", { class: "field" },
      h("label", { for: id, text: label }), h("input", { id, maxlength: "20", value: val || "", placeholder: ph, autocomplete: "off" }));
    const status = h("p", { class: "status", role: "status" });
    const saveBtn = h("button", { type: "submit", class: "big red", text: "Save my wish card" });
    const form = h("form", { novalidate: true },
      h("div", { class: "field" },
        h("label", { for: "fName", text: "My name" }),
        h("input", { id: "fName", maxlength: "40", value: me.name || "", autocomplete: "off" })),
      h("div", { class: "grid3" },
        f("fShirt", "Shirt size", me.shirt, "M"),
        f("fPants", "Pants size", me.pants, "32 x 30"),
        f("fShoes", "Shoe size", me.shoes, "8.5")),
      h("div", { class: "field" },
        h("span", { class: "flabel" }, "Gifts I would love ", h("span", { class: "hint", style: "display:inline;font-weight:400", text: "(optional, add 1, 2 or 3)" })),
        h("div", { class: "wishlist" }, [0, 1, 2].map(i =>
          h("div", { class: "wishrow" }, h("span", { class: "n", text: String(i + 1) }),
            h("input", { id: "fW" + (i + 1), maxlength: "80", value: w[i] || "", "aria-label": L("Gift idea ", "Idea de regalo ") + (i + 1),
              placeholder: ["A cozy robe", "Coffee", "A good book"][i], autocomplete: "off" }))))),
      saveBtn, status
    );
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const v = id => document.getElementById(id).value.trim();
      if (!v("fName")) { status.className = "status err"; status.textContent = tr("Please type your name."); document.getElementById("fName").focus(); return; }
      saveBtn.disabled = true; status.className = "status"; status.textContent = tr("Saving…");
      try {
        await rpc("regalia_save", { p_token: personToken, p_name: v("fName"), p_shirt: v("fShirt"), p_pants: v("fPants"),
          p_shoes: v("fShoes"), p_wishes: [v("fW1"), v("fW2"), v("fW3")] });
        const fresh = await rpc("regalia_me", { p_token: personToken });
        if (fresh) personData = fresh;
        renderPerson();
        const st = app.querySelector("form .status");
        if (st) { st.className = "status ok pop"; st.textContent = tr("✓ Saved! You're all set. You can change it anytime."); }
        giftWrap(app.querySelector("form"));
      } catch (e) {
        saveBtn.disabled = false;
        status.className = "status err";
        status.textContent = tr("It didn't save. Check your internet and press Save again.");
      }
    });
    return h("section", null,
      h("h2", { text: "My wish card" }),
      h("p", { class: "note", text: "The person who gets your name will see this. Only your name is needed. Fill in what you can." }),
      form);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && personToken && personData && !spinning && !document.activeElement.matches("input")) {
      rpc("regalia_me", { p_token: personToken }).then(d => { if (d) { personData = d; renderPerson(); } }).catch(() => {});
    }
  });

  // ---------- organizer page ----------
  let adminCode = null, adminData = null;

  async function organizerView() {
    personToken = null;
    setTagline("Organizer page");
    adminCode = store.get(ADMIN_KEY, true);
    if (adminCode) {
      try { adminData = await rpc("regalia_admin_state", { p_code: adminCode }); return renderAdmin(); }
      catch (e) { adminCode = null; store.del(ADMIN_KEY, true); }
    }
    let status;
    try { status = await rpc("regalia_admin_status", {}); }
    catch (e) { return showError("Can't load right now", "Check your internet connection, then refresh the page."); }
    renderEvent(null, null);
    const setup = status && status.needs_setup;
    const msg = h("p", { class: "status", role: "status" });
    const input = h("input", { id: "oCode", type: "password", autocomplete: setup ? "new-password" : "current-password" });
    const form = h("form", { class: "card", novalidate: true },
      h("h2", { text: setup ? "Choose an organizer code" : "Organizer sign in" }),
      h("p", { class: "note", text: setup
        ? "This code protects the organizer page. Pick something only you know, at least 6 characters. You'll type it each time you open this page."
        : "Type your organizer code." }),
      h("div", { class: "field" }, h("label", { for: "oCode", text: "Organizer code" }), input),
      h("button", { type: "submit", class: "big", text: setup ? "Save code" : "Open organizer page" }), msg);
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const code = input.value;
      msg.className = "status"; msg.textContent = tr("One moment…");
      try {
        if (setup) await rpc("regalia_admin_setup", { p_code: code });
        adminData = await rpc("regalia_admin_state", { p_code: code });
        adminCode = code; store.set(ADMIN_KEY, code, true);
        renderAdmin();
      } catch (e) {
        msg.className = "status err";
        msg.textContent = tr(e.code === "code_too_short" ? "Use at least 6 characters."
          : e.code === "wrong_code" ? "That code isn't right. Try again." : "Something went wrong. Try again.");
      }
    });
    app.replaceChildren(form);
    input.focus();
  }

  async function refreshAdmin() {
    adminData = await rpc("regalia_admin_state", { p_code: adminCode });
    renderAdmin();
  }

  function personLink(token) { return location.origin + location.pathname + "#k=" + token; }

  function renderAdmin() {
    const { event, people } = adminData;
    renderEvent(event, people.length);
    const drawn = !!event.drawn_at;

    // add people
    const addMsg = h("p", { class: "status", role: "status" });
    const addInput = h("input", { id: "oAdd", maxlength: "40", placeholder: "e.g. Abuela Carmen", autocomplete: "off" });
    const addForm = h("form", { novalidate: true },
      h("div", { class: "field" }, h("label", { for: "oAdd", text: "Add a family member" }), addInput),
      h("button", { type: "submit", class: "green", text: "+ Add person" }), addMsg);
    addForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!addInput.value.trim()) { addMsg.className = "status err"; addMsg.textContent = tr("Type a name first."); return; }
      try { await rpc("regalia_admin_add", { p_code: adminCode, p_name: addInput.value }); await refreshAdmin(); document.getElementById("oAdd").focus(); }
      catch (e) { addMsg.className = "status err"; addMsg.textContent = tr("Couldn't add. Try again."); }
    });

    // people list with links
    const list = h("div", null, people.length ? null : h("p", { class: "note", text: "Nobody added yet. Add yourself first, then everyone else." }),
      people.map(p => {
        const link = personLink(p.token);
        const text = L(
          "Hi " + firstName(p.name) + "! 🎄 This is your link for our family Secret Santa. Tap it, fill in your sizes and gift ideas, and later spin the wheel to see who you're buying for: ",
          "¡Hola " + firstName(p.name) + "! 🎄 Este es tu enlace para nuestro Amigo Secreto familiar. Tócalo, llena tus tallas e ideas de regalo, y después gira la ruleta para ver a quién le vas a comprar: "
        ) + link;
        const copyMsg = h("span", { class: "status", role: "status" });
        let sure = false;
        const removeBtn = h("button", { type: "button", class: "ghost small", text: "Remove" });
        removeBtn.addEventListener("click", async () => {
          if (!sure) { sure = true; removeBtn.textContent = tr("Tap again to remove"); return; }
          removeBtn.disabled = true;
          try { await rpc("regalia_admin_remove", { p_code: adminCode, p_id: p.id }); await refreshAdmin(); }
          catch (e) { removeBtn.disabled = false; removeBtn.textContent = tr("Couldn't remove"); }
        });
        return h("div", { class: "personrow" },
          h("div", { class: "top" },
            h("span", { class: "name", style: "font-weight:700;flex:1;min-width:8em" }, p.name),
            h("span", { class: "tick " + (p.joined ? "yes" : "no"), text: p.joined ? "✓ Card filled in" : "Not yet" }),
            drawn && !p.has_match ? h("span", { class: "tick no", text: "Not in draw" }) : null),
          h("div", { class: "linkbox", text: link }),
          h("div", { class: "row" },
            h("button", { type: "button", class: "small", text: "Copy message", onclick: async () => {
              try { await navigator.clipboard.writeText(text); copyMsg.className = "status ok"; copyMsg.textContent = tr("✓ Copied. Paste it in a text."); }
              catch (e) { copyMsg.className = "status"; copyMsg.textContent = tr("Press and hold the link above to copy it."); }
            } }),
            h("a", { class: "btn green small", href: "https://wa.me/?text=" + encodeURIComponent(text), target: "_blank", rel: "noopener", text: "WhatsApp" }),
            h("a", { class: "btn ghost small", href: "sms:?&body=" + encodeURIComponent(text), text: "Text message" }),
            h("a", { class: "btn ghost small", href: link, text: "Open" }),
            removeBtn),
          copyMsg);
      }));

    // event details
    const evMsg = h("p", { class: "status", role: "status" });
    const budget = h("input", { id: "oBudget", maxlength: "20", value: event.budget || "", placeholder: "$50" });
    const date = h("input", { id: "oDate", type: "date", value: event.exchange_date || "" });
    const evForm = h("form", { novalidate: true },
      h("div", { class: "grid3" },
        h("div", { class: "field" }, h("label", { for: "oBudget", text: "Budget" }), budget),
        h("div", { class: "field" }, h("label", { for: "oDate", text: "Gift day" }), date)),
      h("button", { type: "submit", class: "ghost", text: "Save details" }), evMsg);
    evForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      try { await rpc("regalia_admin_event", { p_code: adminCode, p_budget: budget.value, p_date: date.value || null }); await refreshAdmin(); }
      catch (e) { evMsg.className = "status err"; evMsg.textContent = tr("Couldn't save. Try again."); }
    });

    // draw
    const drawMsg = h("p", { class: "status", role: "status",
      text: drawn ? L("Names were drawn on ", "El sorteo se hizo el ") + new Date(event.drawn_at).toLocaleDateString(lang === "es" ? "es" : undefined) + "." : "" });
    const notReady = people.filter(p => !p.joined).length;
    const confirmBox = h("div", { class: "confirm", hidden: true });
    const drawBtn = h("button", { type: "button", class: "big red", text: drawn ? "Draw names again" : "🎁 Draw names" });
    drawBtn.addEventListener("click", () => {
      if (people.length < 3) { drawMsg.className = "status err"; drawMsg.textContent = tr("You need at least 3 people to draw names."); return; }
      confirmBox.replaceChildren(
        h("p", { text: (drawn ? L("This replaces everyone's current match. ", "Esto reemplaza lo que le tocó a cada quien. ") : "") +
          L("Draw names for all " + people.length + " people now?", "¿Sortear los nombres de las " + people.length + " personas ahora?") +
          (notReady ? L(" (" + notReady + (notReady === 1 ? " person hasn't" : " people haven't") + " filled in their card yet. That's okay, they can still do it after.)",
                        " (" + notReady + (notReady === 1 ? " persona todavía no llena su tarjeta" : " personas todavía no llenan su tarjeta") + ". No pasa nada, pueden hacerlo después.)") : "") }),
        h("div", { class: "row" },
          h("button", { type: "button", text: "Yes, draw names", onclick: async () => {
            confirmBox.hidden = true; drawBtn.disabled = true; drawMsg.className = "status"; drawMsg.textContent = tr("Drawing…");
            try { await rpc("regalia_admin_draw", { p_code: adminCode }); await refreshAdmin();
              const s = app.querySelector("#drawStatus"); if (s) { s.className = "status ok pop"; s.textContent = tr("✓ Done! Everyone can now open their link and spin the wheel."); }
              FX.sound.fanfare(); FX.celebrate(); FX.buzz([60, 40, 120]); }
            catch (e) { drawBtn.disabled = false; drawMsg.className = "status err"; drawMsg.textContent = tr("The draw didn't work. Try again."); }
          } }),
          h("button", { type: "button", class: "ghost", text: "Cancel", onclick: () => { confirmBox.hidden = true; } })));
      confirmBox.hidden = false;
    });
    drawMsg.id = "drawStatus";

    app.replaceChildren(
      h("section", null, h("h2", { text: "1. Add your family" }),
        h("p", { class: "note", text: "Each person gets their own link. Send it to them, and they tap it. No sign up needed." }),
        addForm, list),
      h("section", null, h("h2", { text: "2. Set the details" }), evForm),
      h("section", null, h("h2", { text: "3. Draw names" }),
        h("p", { class: "note", text: "The website picks for everyone. Nobody gets themselves, and not even you can see who got who." }),
        drawBtn, confirmBox, drawMsg),
      h("p", { class: "note" }, "Want to see your own page? Tap “Open” next to your name. ",
        h("button", { type: "button", class: "ghost small", text: "Sign out of organizer page", onclick: () => { store.del(ADMIN_KEY, true); adminCode = null; organizerView(); } }))
    );
  }

  const langBtn = document.getElementById("langBtn");
  if (langBtn) langBtn.addEventListener("click", () => {
    if (spinning) return;
    lang = lang === "es" ? "en" : "es";
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    applyStaticLang();
    if (personToken && personData) renderPerson();
    else if (adminData && adminCode) renderAdmin();
    else route();
  });
  const soundBtn = document.getElementById("soundBtn");
  function paintSound() {
    if (!soundBtn) return;
    soundBtn.textContent = FX.soundOn ? "🔊" : "🔇";
    soundBtn.setAttribute("aria-label", tr(FX.soundOn ? "Turn sound off" : "Turn sound on"));
    soundBtn.setAttribute("aria-pressed", FX.soundOn ? "true" : "false");
  }
  if (soundBtn) soundBtn.addEventListener("click", () => { FX.setSound(!FX.soundOn); paintSound(); });
  if (langBtn) langBtn.addEventListener("click", paintSound);
  // little "pop" on every button press
  document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("button, .btn"); if (b && b !== soundBtn && !b.classList.contains("spinbtn")) FX.sound.pop(); });

  // music button
  const musicBtn = document.getElementById("musicBtn");
  function paintMusic() {
    if (!musicBtn) return;
    musicBtn.classList.toggle("on", FX.music.on);
    musicBtn.setAttribute("aria-pressed", FX.music.on ? "true" : "false");
    musicBtn.setAttribute("aria-label", tr(FX.music.on ? "Stop Christmas music" : "Play Christmas music"));
  }
  if (musicBtn) musicBtn.addEventListener("click", () => { if (FX.music.on) FX.music.stop(); else FX.music.start(); paintMusic(); });
  if (langBtn) langBtn.addEventListener("click", paintMusic);

  // twinkling lights across the top
  function buildLights() {
    const el = document.getElementById("lights");
    if (!el) return;
    el.replaceChildren();
    const colors = ["#fff1c9", "#e8384f", "#ffd56a", "#fff1c9", "#c8283f", "#f7c95c"];
    const n = Math.ceil(innerWidth / 44) + 1;
    for (let i = 0; i < n; i++) {
      const b = document.createElement("span");
      b.className = "bulb";
      b.style.left = (22 + i * 44 - 5.5) + "px";
      b.style.setProperty("--c", colors[i % colors.length]);
      b.style.setProperty("--d", (0.9 + Math.random() * 1.4).toFixed(2) + "s");
      b.style.setProperty("--delay", (-Math.random() * 2).toFixed(2) + "s");
      el.append(b);
    }
  }
  let lightsTimer = null;
  window.addEventListener("resize", () => { clearTimeout(lightsTimer); lightsTimer = setTimeout(buildLights, 200); });
  buildLights();
  paintMusic();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  paintSound();
  FX.snow();
  applyStaticLang();
  route();
})();
