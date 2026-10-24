// Master Clock — the single source of time for the Sine Garden.
//
// Everything that changes over time is a pure function of one number, the
// scene clock (in seconds at 1× speed): the time of day, the season, the
// weather, rainbows, and which creatures are out. Because it's all built
// from sine waves, the clock can look ahead as easily as it reads the
// present, which is what powers the forecast and the "goings on" list.
//
// The clock runs itself (its own animation loop). Pages read the current
// moment from MasterClock.state, set MasterClock.speed to change how fast
// time runs, and can mount the circular dial with MasterClock.mountDial().
// Pages open at the same time from the same site (garden.html, clock.html)
// keep one shared clock between them over a BroadcastChannel.
//
// The dial, from the outside in:
//   year ring      – the seasons blended around the circle (summer at top)
//   day ring       – sky colour through one day, sun and moon on it (noon at top)
//   forecast       – rain/snow bars for the next full day, clockwise from the sun
//   rainbow marks  – where a rainbow is due in that next day
//   centre         – day number, season, and what it's like right now

(function () {
  const { sin, PI } = Math;
  const TAU = PI * 2;
  const cos = (x) => sin(x + PI / 2);

  const smooth = (a, b, x) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };

  // --- Time model -----------------------------------------------------------
  const CYCLE = 90;               // seconds per day
  const YEAR = CYCLE * 4;         // four days per year
  const DAY_START = PI * 0.8;     // late afternoon, just before sunset
  const SEASON_START = PI * 0.35; // late spring

  // Two sine waves with unrelated periods add into an uneven "weather" wave;
  // only its tallest crests become showers, so they come irregularly
  function rainAt(c) {
    const weather = 0.6 * sin(((c + 60) * TAU) / 75 + 1.2) + 0.4 * sin(((c + 60) * TAU) / 31 + 2);
    return smooth(0.4, 0.8, weather);
  }

  const SEASONS = ["spring", "summer", "autumn", "winter"];

  // Everything about one moment in the garden
  function at(c) {
    // Day: the sun's height is sin(θ) — +1 noon, 0 sunrise/sunset, −1 midnight
    const theta = DAY_START + (c / CYCLE) * TAU;
    const sunH = sin(theta);
    const day = smooth(-0.25, 0.35, sunH);
    // cos²θ peaks whenever the sun touches the horizon; a high power keeps
    // the golden-hour band narrow
    const dusk = Math.pow(cos(theta) ** 2, 6);
    const night = smooth(0.05, -0.35, sunH);

    // Year: spring at φ = 0, summer π/2, autumn π, winter 3π/2. Each season's
    // weight is sin² or cos² on its half of the circle, and sin² + cos² = 1,
    // so the four always add up to exactly 1
    const phi = SEASON_START + (c / YEAR) * TAU;
    const s = sin(phi), co = cos(phi);
    const season = { spring: co > 0 ? co * co : 0, summer: s > 0 ? s * s : 0, autumn: co < 0 ? co * co : 0, winter: s < 0 ? s * s : 0 };
    const seasonName = SEASONS.reduce((a, b) => (season[a] >= season[b] ? a : b));

    // Weather. Rainbow: the air is still wet from the last ~20 s of rain, it
    // isn't raining now, and the sun is low but up
    const rain = rainAt(c);
    let wet = 0;
    for (let k = 1; k <= 7; k++) wet = Math.max(wet, rainAt(c - k * 3));
    const snow = smooth(0.3, 0.7, season.winter); // share of rain falling as snow
    // (snowflakes don't make rainbows)
    const rainbow = smooth(0, 1, wet - rain * 1.5) * smooth(0, 0.15, sunH) * smooth(0.85, 0.55, sunH) * (1 - snow);
    const ice = smooth(0.45, 0.85, season.winter);

    // Goings on
    const butterflies = (1 - night) * (1 - rain) * smooth(0.1, 0.5, sin(phi + 0.5));
    const fireflies = night * (season.summer + 0.6 * season.spring + 0.3 * season.autumn);
    const birdsong = (1 - night) * (season.spring + season.summer + 0.3 * season.autumn) * (1 - rain);

    return {
      clock: c, dayNumber: Math.floor(theta / TAU) + 1,
      theta, sunH, day, dusk, night,
      phi, season, seasonName,
      rain, rainbow, snow, ice,
      butterflies, fireflies, birdsong,
    };
  }

  // The next time each kind of event happens, scanning ahead through sine
  // time. One entry per kind, soonest first.
  function upcoming(from, horizon = YEAR) {
    const step = 0.5;
    const found = new Map();
    const hit = (key, label, time) => { if (!found.has(key)) found.set(key, { key, label, time }); };
    let prev = at(from);
    for (let c = from + step; c <= from + horizon; c += step) {
      const s = at(c);
      if (prev.sunH < 0 && s.sunH >= 0) hit("sunrise", "sunrise", c);
      if (prev.sunH >= 0 && s.sunH < 0) hit("sunset", "sunset", c);
      if (prev.rain < 0.3 && s.rain >= 0.3) hit("shower", s.snow > 0.5 ? "snowfall" : "rain shower", c);
      if (prev.rainbow < 0.3 && s.rainbow >= 0.3) hit("rainbow", "rainbow", c);
      if (s.seasonName !== prev.seasonName) hit("season", `${s.seasonName} begins`, c);
      if (prev.ice < 0.5 && s.ice >= 0.5) hit("ice", "pond freezes", c);
      if (prev.ice >= 0.5 && s.ice < 0.5) hit("ice", "pond thaws", c);
      prev = s;
    }
    return [...found.values()].sort((a, b) => a.time - b.time);
  }

  // --- The running clock ----------------------------------------------------
  // Scene time is read off the wall clock from an anchor: "at wall time W the
  // scene was at T, running at speed S". Every page holding the same anchor
  // shows the same moment, even a background tab that hasn't drawn for a
  // while. Changing the time or speed re-anchors and tells the other pages.
  let anchor = { time: 0, wall: Date.now(), speed: 1 };
  const nowTime = () => anchor.time + ((Date.now() - anchor.wall) / 1000) * anchor.speed;
  let time = 0, state = at(0);
  const dials = [];
  const listeners = [];

  // Pages from the same site share one channel. A new page asks for the
  // current anchor; any page already open answers.
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("sine-garden-clock") : null;
  function reanchor(t, speed) {
    anchor = { time: t, wall: Date.now(), speed };
    if (channel) channel.postMessage({ type: "anchor", anchor });
    for (const fn of listeners) fn(anchor);
  }
  if (channel) {
    channel.onmessage = ({ data }) => {
      if (data.type === "hello") channel.postMessage({ type: "anchor", anchor });
      if (data.type === "anchor") {
        anchor = data.anchor;
        for (const fn of listeners) fn(anchor);
      }
    };
    channel.postMessage({ type: "hello" });
  }

  function loop() {
    time = nowTime();
    state = at(time);
    for (const d of dials) d.draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // --- The dial -------------------------------------------------------------
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const rgb = (c, alpha = 1) => `rgba(${c.map(Math.round).join(", ")}, ${alpha})`;
  const SEASON_COLOR = { spring: hex("#8fbf7a"), summer: hex("#5f9a6e"), autumn: hex("#c98a4b"), winter: hex("#a9b8c8") };
  const SKY_NIGHT = hex("#1c2948"), SKY_DAY = hex("#9cc6e4"), SKY_GOLD = hex("#f0b98a");
  const spectrum = (a) => [0, 2.1, 4.2].map((p) => 255 * (0.5 + 0.5 * cos(a - p)));

  // Both rings put their peak at the top: θ = π/2 (noon) and φ = π/2 (summer)
  // land on canvas angle −π/2, and time runs clockwise
  const ringAngle = (a) => a - PI;

  const STYLE = `
    .master-clock {
      position: fixed; left: 16px; top: 64px; width: 240px; box-sizing: border-box;
      padding: 10px 12px 12px; border-radius: 16px;
      background: rgba(10, 20, 24, 0.6); backdrop-filter: blur(6px);
      color: rgba(255, 245, 230, 0.85); font: 11px/1.35 system-ui, sans-serif; letter-spacing: 0.03em;
    }
    .master-clock[hidden] { display: none; }
    .master-clock.inline { position: static; width: auto; padding: 0; background: none; backdrop-filter: none; }
    .master-clock canvas { display: block; margin: 0 auto; cursor: default; }
    .master-clock h2 { margin: 8px 0 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6; }
    .master-clock ul { list-style: none; margin: 0; padding: 0; }
    .master-clock li { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
    .master-clock li span:last-child { opacity: 0.65; font-variant-numeric: tabular-nums; }
    .master-clock .now { opacity: 0.8; }
  `;

  // size: the dial's width in CSS pixels. inline: sit in the page's layout
  // instead of floating over it.
  function mountDial(parent = document.body, { size = 216, inline = false } = {}) {
    if (!document.getElementById("master-clock-style")) {
      const style = document.createElement("style");
      style.id = "master-clock-style";
      style.textContent = STYLE;
      document.head.append(style);
    }
    const panel = document.createElement("section");
    panel.className = inline ? "master-clock inline" : "master-clock";
    panel.setAttribute("aria-label", "Master clock");
    panel.innerHTML = `<canvas></canvas><div class="now"></div><h2>Coming up</h2><ul></ul>`;
    parent.append(panel);

    const canvas = panel.querySelector("canvas");
    const nowLine = panel.querySelector(".now");
    const list = panel.querySelector("ul");
    // The dial is designed on a 216-unit square and scaled to fit
    const S = 216;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = canvas.style.height = `${size}px`;
    canvas.width = canvas.height = Math.round(size * dpr);
    const g = canvas.getContext("2d");
    g.scale((size * dpr) / S, (size * dpr) / S);
    const cx = S / 2, cy = S / 2;

    // The forecast and event list are recomputed a few times a second
    let forecast = [], events = [], lastScan = -Infinity, lastAnchor = null;

    function scan() {
      forecast = [];
      for (let k = 0; k <= 120; k++) forecast.push(at(time + (k / 120) * CYCLE));
      events = upcoming(time);
      lastScan = performance.now();
      lastAnchor = anchor;
    }

    const arc = (r, a0, a1, width, color) => {
      g.beginPath();
      g.arc(cx, cy, r, a0, a1);
      g.lineWidth = width;
      g.strokeStyle = color;
      g.stroke();
    };

    function draw() {
      if (panel.hidden) return;
      if (performance.now() - lastScan > 400 || anchor !== lastAnchor) scan(); // rescan at once after a jump
      const st = state;
      g.clearRect(0, 0, S, S);

      // Year ring: each step around the circle coloured by its season blend
      const N = 180;
      for (let i = 0; i < N; i++) {
        const p = (i / N) * TAU;
        const s = sin(p), c = cos(p);
        const w = [c > 0 ? c * c : 0, s > 0 ? s * s : 0, c < 0 ? c * c : 0, s < 0 ? s * s : 0];
        const col = SEASONS.reduce((acc, k, j) => acc.map((v, n) => v + SEASON_COLOR[k][n] * w[j]), [0, 0, 0]);
        arc(100, ringAngle(p), ringAngle(p + TAU / N) + 0.01, 12, rgb(col, 0.9));
      }
      g.font = "600 7.5px system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "rgba(10, 20, 24, 0.75)";
      for (const [k, p] of [["spring", 0], ["summer", PI / 2], ["autumn", PI], ["winter", PI * 1.5]]) {
        const a = ringAngle(p);
        g.save();
        g.translate(cx + 100 * cos(a), cy + 100 * sin(a));
        g.rotate(a + PI / 2 + (sin(a) > 0.5 ? PI : 0)); // keep the bottom label upright
        g.fillText(k, 0, 0);
        g.restore();
      }

      // Day ring: sky colour through one day, gold at sunrise and sunset
      for (let i = 0; i < N; i++) {
        const th = (i / N) * TAU;
        const h = sin(th);
        let col = lerp(SKY_NIGHT, SKY_DAY, smooth(-0.25, 0.35, h));
        col = lerp(col, SKY_GOLD, Math.pow(cos(th) ** 2, 6) * 0.9);
        arc(80, ringAngle(th), ringAngle(th + TAU / N) + 0.01, 14, rgb(col));
      }

      // Horizon: sunrise on the left, sunset on the right
      g.setLineDash([2, 3]);
      g.beginPath();
      g.moveTo(cx - 88, cy);
      g.lineTo(cx + 88, cy);
      g.strokeStyle = "rgba(255, 245, 230, 0.2)";
      g.lineWidth = 1;
      g.stroke();
      g.setLineDash([]);

      // Forecast for the next day, clockwise from the sun: rain/snow bars,
      // fading a little the further ahead they look
      for (let k = 0; k < forecast.length - 1; k++) {
        const f = forecast[k];
        const a0 = ringAngle(f.theta), a1 = ringAngle(forecast[k + 1].theta) + 0.01;
        const fade = 1 - 0.5 * (k / forecast.length);
        if (f.rain > 0.02) {
          const col = lerp([140, 170, 210], [245, 248, 255], f.snow);
          const len = 6 + 26 * f.rain;
          arc(36 + len / 2, a0, a1, len, rgb(col, 0.85 * fade));
        }
        if (f.rainbow > 0.15) {
          for (let b = 0; b < 4; b++) arc(66 + b * 1.5, a0, a1, 1.5, rgb(spectrum(4.2 - b * 1.4), f.rainbow * fade));
        }
      }

      // Hands: a line to the sun on the day ring, a dot on the year ring
      const sa = ringAngle(st.theta);
      g.beginPath();
      g.moveTo(cx + 33 * cos(sa), cy + 33 * sin(sa));
      g.lineTo(cx + 72 * cos(sa), cy + 72 * sin(sa));
      g.strokeStyle = "rgba(255, 245, 230, 0.5)";
      g.lineWidth = 1;
      g.stroke();
      const dot = (r, a, size, fill) => {
        g.beginPath();
        g.arc(cx + r * cos(a), cy + r * sin(a), size, 0, TAU);
        g.fillStyle = fill;
        g.fill();
        g.lineWidth = 1.5;
        g.strokeStyle = "rgba(10, 20, 24, 0.7)";
        g.stroke();
      };
      dot(80, sa, 6, "#fff1d0");                // sun
      dot(80, sa + PI, 4.5, "#dfe6f5");         // moon
      dot(100, ringAngle(st.phi), 4.5, "#fffaf0"); // today in the year

      // Centre: day number, season, conditions
      g.beginPath();
      g.arc(cx, cy, 31, 0, TAU);
      g.fillStyle = "rgba(10, 20, 24, 0.55)";
      g.fill();
      const rising = cos(st.theta) > 0;
      const part = st.dusk > 0.4 ? (rising ? "dawn" : "dusk") : st.night > 0.5 ? "night" : "day";
      const sky = st.rain > 0.3 ? (st.snow > 0.5 ? "snow" : "rain") : st.rainbow > 0.3 ? "rainbow" : "clear";
      g.fillStyle = "rgba(255, 245, 230, 0.6)";
      g.font = "9px system-ui, sans-serif";
      g.fillText(`day ${st.dayNumber}`, cx, cy - 13);
      g.fillStyle = "rgba(255, 245, 230, 0.95)";
      g.font = "600 12px system-ui, sans-serif";
      g.fillText(st.seasonName, cx, cy);
      g.fillStyle = "rgba(255, 245, 230, 0.7)";
      g.font = "9px system-ui, sans-serif";
      g.fillText(`${part} · ${sky}`, cx, cy + 13);

      // Text: what's out now, and what's coming up
      const out = [
        st.birdsong > 0.3 && "birdsong",
        st.butterflies > 0.3 && "butterflies",
        st.fireflies > 0.3 && "fireflies",
        st.ice > 0.5 && "pond frozen",
      ].filter(Boolean);
      const nowText = `Now: ${out.length ? out.join(" · ") : "quiet"}`;
      if (nowLine.textContent !== nowText) nowLine.textContent = nowText;

      const html = events.slice(0, 6).map((e) => `<li><span>${e.label}</span><span>${eta(e.time - time)}</span></li>`).join("");
      if (list.innerHTML !== html) list.innerHTML = html;
    }

    // Real seconds until a scene time, at the current speed
    function eta(sceneSeconds) {
      if (anchor.speed === 0) return "paused";
      const s = Math.max(0, Math.round(sceneSeconds / anchor.speed));
      return s < 60 ? `in ${s}s` : `in ${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
    }

    const dial = { panel, draw, show: (on) => (panel.hidden = !on) };
    dials.push(dial);
    return dial;
  }

  window.MasterClock = {
    CYCLE, YEAR, TAU,
    smooth, rainAt, at, upcoming, mountDial,
    get state() { return state; },
    get time() { return nowTime(); },
    set time(v) { reanchor(v, anchor.speed); time = v; state = at(v); },
    get speed() { return anchor.speed; },
    set speed(v) { reanchor(nowTime(), v); },
    // Called with the new anchor whenever time or speed changes, here or in
    // another open page — e.g. to move a speed slider to match
    onChange(fn) { listeners.push(fn); },
  };
})();
