// Mount the RH-OB 3D twin into a container. Exports mountRHOB(container, {geometry, packets, ...}).
// Lifecycle: mount -> setPackets (from backend /visual) -> playback scrubber/timeline -> dispose.
// WebGL check with 2D fallback callback; keyboard: Space play/pause, ←/→ scrub, C cutaway, L labels.
import { RHOBScene } from "./RHOBScene.js";
import { StateBridge } from "./StateBridge.js";

export function webglAvailable() {
  try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl"))); }
  catch (e) { return false; }
}

export function mountRHOB(container, cfg) {
  if (!webglAvailable()) { cfg.onFallback && cfg.onFallback(); return null; }
  const scene = new RHOBScene(container, cfg.geometry, cfg);
  const bridge = new StateBridge(cfg.geometry, cfg.packets);
  const ui = buildOverlay(container);
  let idx = 0, playing = false, speed = cfg.speed || 30, follow = true, lastT = performance.now();
  const additions = cfg.additions || [];
  scene.onInspect = (rows) => {
    if (!rows) { ui.inspect.style.display = "none"; return; }
    ui.inspect.style.display = "block";
    ui.inspect.innerHTML = `<h5>${rows[0][0]}</h5><div class="small" style="color:#93a1b0">${rows[0][1] || ""}</div>` +
      rows.slice(1).map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:12px"><span>${k}</span><b style="font-family:monospace">${v}</b></div>`).join("") +
      '<div style="margin-top:4px;color:#6a7887;font-size:10px">values bound to model state at the scrubber time</div>';
  };
  function show(i) {
    const s = bridge.at(i);
    if (!s) return;
    const v = bridge.visual(s);
    scene.alloyDrop = additions.some((a) => s.t_s >= a.t_s && s.t_s < a.t_s + 25);
    scene.apply(s, v);
    ui.stage.textContent = (s.stage || "").replace(/_/g, " ");
    ui.stage.style.borderColor = (cfg.stageColors || {})[s.stage] || "#e3a83b";
    const C = (k) => (k == null ? "—" : (k - 273.15).toFixed(1) + " °C");
    ui.hud.innerHTML = [
      ["t", (s.t_s / 60).toFixed(2) + " min"], ["P vessel", (s.P_Pa / 100).toFixed(2) + " mbar(a)"], ["Ar lift", s.argon_NL_min?.toFixed(0) + " NL/min"],
      ["O₂ tuyeres", s.oxygen_Nm3_h?.toFixed(0) + " Nm³/h"], ["Circulation", s.q_circ_t_min?.toFixed(0) + " t/min"], ["T ladle", C(s.T_l_K)], ["T vessel", C(s.T_v_K)],
      ["[C]", s.C_bulk_ppm?.toFixed(1) + " ppm"], ["[O]", s.O_bulk_ppm?.toFixed(1) + " ppm"], ["[H] / [N]", `${s.H_bulk_ppm?.toFixed(2)} / ${s.N_bulk_ppm?.toFixed(1)} ppm`],
      ["Vessel bath", (s.vessel_depth_m * 1000).toFixed(0) + " mm"], ["CO off-gas", s.offgas_CO_Nm3_h?.toFixed(0) + " Nm³/h"],
    ].map(([k, v]) => `<div class="r"><span>${k}</span><b>${v}</b></div>`).join("");
    ui.slider.value = i; ui.time.textContent = (s.t_s / 60).toFixed(1) + " min";
    if (cfg.onShow) cfg.onShow(s);
  }
  function tick() {
    const now = performance.now(), dt = (now - lastT) / 1000; lastT = now;
    if (playing && bridge.length > 1) {
      const dtRec = Math.max((bridge.packets[1].t_s - bridge.packets[0].t_s), 1);
      idx += (dt * speed) / dtRec;
      if (idx >= bridge.length - 1) { idx = bridge.length - 1; playing = false; ui.play.textContent = "▶"; }
      show(idx);
    }
    scene.paused = !playing && !cfg.alwaysAnimate ? false : false;
    requestAnimationFrame(tick);
  }
  ui.slider.oninput = (e) => { idx = +e.target.value; follow = false; show(idx); };
  ui.play.onclick = () => { playing = !playing; if (playing && idx >= bridge.length - 1) idx = 0; ui.play.textContent = playing ? "❚❚" : "▶"; };
  ui.speed.onchange = (e) => (speed = +e.target.value);
  ui.live.onclick = () => { follow = true; idx = bridge.length - 1; show(idx); };
  container.tabIndex = 0;
  container.addEventListener("keydown", (e) => {
    if (e.key === " ") { ui.play.click(); e.preventDefault(); }
    if (e.key === "ArrowRight") { idx = Math.min(idx + 1, bridge.length - 1); show(idx); }
    if (e.key === "ArrowLeft") { idx = Math.max(idx - 1, 0); show(idx); }
    if (e.key === "c") scene.setCutaway(!scene.clipOn);
    if (e.key === "l") scene.setLabels(!scene.labelsOn);
  });
  const api = {
    scene,
    setPackets(p, keepLive = true) { bridge.setPackets(p); ui.slider.max = Math.max(p.length - 1, 0); if (follow && keepLive) idx = p.length - 1; show(idx); },
    seekStage(stages, offset = 60) {
      const k = bridge.packets.findIndex((q) => stages.includes(q.stage));
      if (k >= 0) { const t0 = bridge.packets[k].t_s + offset; this.seekTime(t0); }
    },
    seekTime(t) { const k = bridge.packets.findIndex((q) => q.t_s >= t); idx = k < 0 ? bridge.length - 1 : k; follow = false; show(idx); },
    play(on = true) { playing = on; ui.play.textContent = on ? "❚❚" : "▶"; },
    setAdditions(a) { additions.splice(0, additions.length, ...a); },
  };
  api.setPackets(cfg.packets || []);
  requestAnimationFrame(tick);
  return api;
}

function buildOverlay(c) {
  const hud = document.createElement("div"); hud.className = "hud"; c.appendChild(hud);
  const stage = document.createElement("div"); stage.className = "stagebadge"; c.appendChild(stage);
  const inspect = document.createElement("div"); inspect.className = "inspect"; c.appendChild(inspect);
  const disc = document.createElement("div"); disc.className = "disclaimer";
  disc.textContent = "Schematic visualization bound to model state packets — not a CFD volume render. Click equipment to inspect.";
  c.appendChild(disc);
  const bar = document.createElement("div"); bar.className = "player";
  bar.innerHTML = `<button class="btn sm" data-a="play" aria-label="play">▶</button>
    <input type="range" min="0" max="0" step="0.01" value="0" aria-label="playback scrubber">
    <span class="mono small" data-a="time">0 min</span>
    <select data-a="speed" aria-label="time compression"><option value="10">×10</option><option value="30" selected>×30</option><option value="60">×60</option><option value="120">×120</option></select>
    <button class="btn sm" data-a="live">⇥ latest</button>`;
  c.appendChild(bar);
  return { hud, stage, inspect, slider: bar.querySelector("input"), play: bar.querySelector('[data-a="play"]'), time: bar.querySelector('[data-a="time"]'),
    speed: bar.querySelector('[data-a="speed"]'), live: bar.querySelector('[data-a="live"]') };
}
