/* RH-OB operator desk - shared client runtime (no framework). All data via /bff -> FastAPI backend. */
(function () {
  const R = (window.RHOB = {});
  R.state = { sim: null, summary: null, records: [], plant: null, listeners: [], polling: null, busy: false, scenarios: {} };
  const $ = (s, el = document) => el.querySelector(s);
  R.$ = $;
  R.$$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // ------------------------------------------------------------------ API
  R.api = async function (path, opts = {}) {
    const init = { method: opts.method || "GET", headers: {} };
    if (opts.body !== undefined) { init.headers["content-type"] = "application/json"; init.body = JSON.stringify(opts.body); }
    if (opts.idem) init.headers["idempotency-key"] = opts.idem;
    let url = "/bff/" + path.replace(/^\//, "");
    if (opts.params) url += "?" + new URLSearchParams(opts.params).toString();
    const r = await fetch(url, init);
    const ct = r.headers.get("content-type") || "";
    const data = ct.includes("json") ? await r.json() : await r.text();
    if (!r.ok) {
      const msg = (data && (data.title || data.error || data.detail)) || r.statusText;
      const det = data && data.details ? " " + JSON.stringify(data.details).slice(0, 400) : "";
      const e = new Error(`${r.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}${det}`);
      e.status = r.status; e.data = data; throw e;
    }
    return data;
  };
  R.toast = function (msg, kind = "") {
    const d = document.createElement("div"); d.className = kind; d.textContent = msg;
    $("#toast").appendChild(d); setTimeout(() => d.remove(), kind === "err" ? 9000 : 4500);
  };
  R.poll = async function (jobPath, onProgress, interval = 1500) {
    for (;;) {
      const j = await R.api(jobPath);
      onProgress && onProgress(j);
      if (j.status === "done" || j.status === "failed") return j;
      await new Promise((r) => setTimeout(r, interval));
    }
  };

  // ------------------------------------------------------------------ units
  const UNITS = {
    si_c: { T: ["°C", (k) => k - 273.15], P: ["mbar", (p) => p / 100], gas: ["Nm³/h", (q) => q], ar: ["NL/min", (q) => q], comp: ["ppm", (x) => x] },
    si_k: { T: ["K", (k) => k], P: ["Pa", (p) => p], gas: ["NL/min", (q) => (q * 1000) / 60], ar: ["NL/min", (q) => q], comp: ["ppm", (x) => x] },
    kpa: { T: ["°C", (k) => k - 273.15], P: ["kPa", (p) => p / 1000], gas: ["Nm³/h", (q) => q], ar: ["Nm³/h", (q) => (q * 60) / 1000], comp: ["wt%", (x) => x / 1e4] },
  };
  R.unitSys = (function () { try { return localStorage.getItem("rhob.units") || "si_c"; } catch (e) { return "si_c"; } })();
  R.U = function (kind, v) { const u = UNITS[R.unitSys][kind]; return v == null ? null : u[1](v); };
  R.UL = (kind) => UNITS[R.unitSys][kind][0];
  R.fmt = function (v, d = 1) {
    if (v == null || Number.isNaN(v)) return "—";
    if (typeof v !== "number") return String(v);
    const a = Math.abs(v);
    if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(2);
    return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  // ------------------------------------------------------------------ stage palette
  R.STAGE_COLORS = {
    ARRIVAL_CHECKS: "#5a6775", IMMERSION: "#6b7f92", PUMP_DOWN: "#3d6f9a", NATURAL_DECARB: "#2f8fa3", OB_DECARB: "#d0682b",
    DEEP_VACUUM: "#245b80", DEOXIDATION: "#7e5bc2", CHEMICAL_HEATING: "#c2402f", ALLOYING: "#9a7a28", HOMOGENIZATION: "#3e8a62",
    FINAL_SAMPLING: "#6f8f3a", VACUUM_BREAK: "#8a4b4b", ABORT_VACUUM_BREAK: "#b02a2a", DISPATCH: "#4d4d5a",
  };

  // ------------------------------------------------------------------ simulation selection & data
  function urlSim() { const u = new URL(location.href); return u.searchParams.get("sim"); }
  R.getSimId = function () { let s = urlSim(); if (!s) { try { s = localStorage.getItem("rhob.sim"); } catch (e) {} } return s; };
  R.setSimId = function (id) {
    try { localStorage.setItem("rhob.sim", id); } catch (e) {}
    const u = new URL(location.href); u.searchParams.set("sim", id); history.replaceState(null, "", u);
    R.$$(".side a").forEach((a) => { a.href = "/page/" + a.dataset.slug + "?sim=" + id; });
  };
  R.onData = function (fn) { R.state.listeners.push(fn); if (R.state.summary) safeCall(fn); };
  function safeCall(fn) { try { fn(R.state.summary, R.state.records); } catch (e) { console.error(e); R.toast("render error: " + e.message, "err"); } }
  function emit() { R.state.listeners.forEach(safeCall); }

  R.load = async function (full = false) {
    const id = R.state.sim;
    if (!id) return;
    const s = await R.api(`api/v1/simulations/${id}`);
    const since = full ? 0 : R.state.records.length;
    let recs = R.state.records;
    if (full || s.version !== (R.state.summary && R.state.summary.version) || since === 0) {
      const tr = await R.api(`api/v1/simulations/${id}/trajectory`, { params: { since_index: full ? 0 : since } });
      if (full || since === 0) recs = tr.records; else recs = recs.concat(tr.records);
      if (tr.n_total < recs.length) { const t2 = await R.api(`api/v1/simulations/${id}/trajectory`); recs = t2.records; }
      R.state.events = tr.events;
    }
    R.state.summary = s; R.state.records = recs;
    updateChrome(s);
    emit();
    managePolling(s);
  };
  R.reloadFull = () => R.load(true);
  R.plantTruth = async function () {
    if (!R.state.sim) return [];
    const tr = await R.api(`api/v1/simulations/${R.state.sim}/trajectory`, { params: { kind: "plant", fields: "C_bulk_ppm,O_bulk_ppm,T_bulk_K,H_bulk_ppm,N_bulk_ppm,Al_bulk_ppm" } });
    return tr.records;
  };

  function managePolling(s) {
    const live = s.playing && !s.paused && s.status !== "completed" && s.status !== "failed";
    if (live && !R.state.polling) R.state.polling = setInterval(() => R.load(false).catch(() => {}), 2500);
    if (!live && R.state.polling) { clearInterval(R.state.polling); R.state.polling = null; }
  }

  function updateChrome(s) {
    const last = R.state.records[R.state.records.length - 1] || {};
    $("#chipHeat").textContent = s.heat_id; $("#chipGrade").textContent = s.grade_id || "—"; $("#chipMode").textContent = s.mode;
    $("#chipTime").textContent = (s.sim_time_s / 60).toFixed(1) + " / " + (s.t_end_schedule_s / 60).toFixed(0) + " min";
    $("#chipStage").textContent = last.stage || "—";
    const cs = $("#chipStatus"); cs.className = "chip st-" + s.status; cs.innerHTML = "Status <b>" + s.status + "</b>";
    $("#advInhibit").textContent = s.advisory_inhibited ? "ADVISORY_INHIBITED" : "";
    const st = s.status, paused = s.paused, done = st === "completed" || st === "failed";
    const dis = (id, v) => { const b = $(id); if (b) b.disabled = v; };
    dis("#btnRun", done || paused || R.state.busy); dis("#btnStep", done || paused || R.state.busy);
    dis("#btnPlay", done || paused || s.playing || R.state.busy); dis("#btnPause", done || paused);
    dis("#btnResume", !paused); dis("#btnReset", R.state.busy);
    const pend = (s.lab_results || []).filter((l) => l.available && !l.applied);
    dis("#btnLab", pend.length === 0 || paused); $("#btnLab").textContent = pend.length ? `Apply lab result (${pend.length})` : "Apply lab result";
    dis("#btnExport", false); dis("#btnOpt", false); dis("#btnCompare", false);
    $("#statusLine").textContent = `mass closure ${R.fmt(s.mass_balance_relative_error, 0)} · energy closure ${R.fmt(s.energy_balance_relative_error, 0)} · quality ${s.quality} · v${s.version}`;
  }

  async function refreshList(selectId) {
    const sel = $("#simSel");
    const lst = await R.api("api/v1/simulations", { params: { limit: 40 } });
    sel.innerHTML = '<option value="">— none —</option>' + lst.items.map((i) =>
      `<option value="${i.simulation_id}">${i.heat_id} · ${i.scenario_name} · ${i.status} (${i.simulation_id})</option>`).join("");
    if (selectId) sel.value = selectId;
    return lst.items;
  }

  async function busy(label, fn) {
    R.state.busy = true; $("#statusLine").textContent = label + " …";
    R.$$("#ctrlbar .btn").forEach((b) => (b.disabled = true));
    try { return await fn(); } catch (e) { R.toast(e.message, "err"); }
    finally { R.state.busy = false; if (R.state.summary) updateChrome(R.state.summary); else enableBasic(); }
  }
  function enableBasic() { ["#btnNew", "#btnValidate", "#btnRefreshList"].forEach((i) => ($(i).disabled = false)); }

  R.createSim = async function (scenario, runToEnd, extra = {}) {
    const res = await R.api("api/v1/simulations", { method: "POST", body: Object.assign({ scenario, run_to_end: runToEnd }, extra) });
    R.state.sim = res.simulation_id; R.setSimId(res.simulation_id); R.state.records = []; R.state.summary = null;
    await refreshList(res.simulation_id); await R.load(true);
    return res;
  };
  R.createFromRequest = async function (request, runToEnd, capacity) {
    const body = { request, run_to_end: runToEnd }; if (capacity) body.capacity_t = capacity;
    const res = await R.api("api/v1/simulations", { method: "POST", body });
    R.state.sim = res.simulation_id; R.setSimId(res.simulation_id); R.state.records = []; R.state.summary = null;
    await refreshList(res.simulation_id); await R.load(true);
    return res;
  };

  // ------------------------------------------------------------------ controls
  function wire() {
    $("#themeBtn").onclick = () => {
      const t = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = t; try { localStorage.setItem("rhob.theme", t); } catch (e) {}
      emit();
    };
    $("#unitsSel").value = R.unitSys;
    $("#unitsSel").onchange = (e) => { R.unitSys = e.target.value; try { localStorage.setItem("rhob.units", R.unitSys); } catch (x) {} emit(); };
    $("#simSel").onchange = async (e) => { if (!e.target.value) return; R.state.sim = e.target.value; R.setSimId(R.state.sim); R.state.records = []; await R.load(true); };
    $("#btnRefreshList").onclick = () => refreshList(R.state.sim);
    $("#btnNew").onclick = () => busy("creating heat", () => R.createSim($("#scenarioSel").value, false));
    $("#btnValidate").onclick = () => busy("validating", async () => {
      const req = await R.api(`api/v1/config/scenarios/${$("#scenarioSel").value}`);
      const v = await R.api("api/v1/simulations/validate", { method: "POST", body: req });
      R.toast(v.valid ? `Inputs valid (${v.issues.length} notes)` : "INVALID: " + v.issues.map((i) => i.message).join("; "), v.valid ? "ok" : "err");
      v.issues.slice(0, 4).forEach((i) => R.toast(`${i.severity}: ${i.message}`, i.severity === "error" ? "err" : ""));
    });
    $("#btnRun").onclick = () => busy("integrating heat (stiff BDF solver)", async () => {
      await R.api(`api/v1/simulations/${R.state.sim}/step`, { method: "POST", body: { to_s: R.state.summary.t_end_schedule_s } });
      await R.load(false); R.toast("Heat simulated to end of schedule", "ok");
    });
    $("#btnStep").onclick = () => busy("stepping 60 s", async () => {
      await R.api(`api/v1/simulations/${R.state.sim}/step`, { method: "POST", body: { dt_s: 60 } }); await R.load(false);
    });
    $("#btnPlay").onclick = () => busy("starting play", async () => {
      await R.api(`api/v1/simulations/${R.state.sim}/resume`, { method: "POST", body: { speed: +$("#speedSel").value } }); await R.load(false);
    });
    $("#btnPause").onclick = () => busy("pausing", async () => { await R.api(`api/v1/simulations/${R.state.sim}/pause`, { method: "POST" }); await R.load(false); R.toast("Simulation clock frozen"); });
    $("#btnResume").onclick = () => busy("resuming", async () => { await R.api(`api/v1/simulations/${R.state.sim}/resume`, { method: "POST", body: { speed: 0 } }); await R.load(false); });
    $("#btnReset").onclick = () => { if (confirm("Reset this simulation to t = 0? (request and seed are kept)")) busy("resetting", async () => { await R.api(`api/v1/simulations/${R.state.sim}/reset`, { method: "POST" }); await R.load(true); }); };
    $("#btnLab").onclick = () => busy("assimilating lab result", async () => {
      const pend = R.state.summary.lab_results.filter((l) => l.available && !l.applied);
      const lr = pend[pend.length - 1];
      const vals = {};
      Object.entries(lr.values).forEach(([k, v]) => { if (["C_ppm", "O_ppm", "H_ppm", "N_ppm", "Al_ppm", "T_K"].includes(k)) vals[k] = v; });
      const res = await R.api(`api/v1/simulations/${R.state.sim}/lab-results`, { method: "POST", body: { t_sample_s: lr.t_sample_s, values: vals, source: "LAB ANALYZED (synthetic plant)" } });
      const fb = res.forecast_before.rh_end_state, fa = res.forecast_after.rh_end_state;
      R.toast(`Lab @${(lr.t_sample_s / 60).toFixed(1)} min applied. Forecast C_end ${R.fmt(fb.C_bulk_ppm)} → ${R.fmt(fa.C_bulk_ppm)} ppm; T_end ${R.fmt(fb.T_bulk_K - 273.15)} → ${R.fmt(fa.T_bulk_K - 273.15)} °C`, "ok");
      await R.load(true);
    });
    $("#btnOpt").onclick = () => (location.href = "/page/optimizer?sim=" + R.state.sim + "&run=1");
    $("#btnCompare").onclick = () => (location.href = "/page/whatif?sim=" + R.state.sim);
    $("#btnExport").onclick = () => {
      const f = $("#exportSel").value, s = R.state.summary;
      if (!s) return;
      window.open(`/bff/api/v1/reports/${encodeURIComponent(s.heat_id)}?simulation_id=${s.simulation_id}&format=${f}`, "_blank");
    };
  }

  async function boot() {
    wire();
    try {
      const sc = await R.api("api/v1/config/scenarios"); R.state.scenarios = sc;
      $("#scenarioSel").innerHTML = Object.entries(sc).map(([k, v]) => `<option value="${k}" title="${v}">${k.replace(/_/g, " ")}</option>`).join("");
      $("#scenarioSel").value = "S2_RHOB_OXYGEN_ASSISTED";
      $("#conn").textContent = "backend connected"; $("#conn").className = "conn up";
    } catch (e) { $("#conn").textContent = "backend unreachable"; $("#conn").className = "conn down"; R.toast("Backend unreachable: " + e.message, "err"); return; }
    const items = await refreshList();
    let id = R.getSimId();
    if (id && !items.find((i) => i.simulation_id === id)) {
      try { await R.api(`api/v1/simulations/${id}`); } catch (e) { id = null; }
    }
    if (!id && items.length) id = items[0].simulation_id;
    if (!id) {
      await busy("first visit: simulating demo heat S2 (RH-OB oxygen-assisted)", () => R.createSim("S2_RHOB_OXYGEN_ASSISTED", true));
      return;
    }
    R.state.sim = id; R.setSimId(id); $("#simSel").value = id;
    try { await R.load(true); } catch (e) { R.toast(e.message, "err"); }
  }
  document.addEventListener("DOMContentLoaded", boot);

  // ------------------------------------------------------------------ small UI helpers
  R.tiles = function (el, items) {
    el.innerHTML = items.map((t) => `<div class="tile ${t.cls || ""}" title="${t.title || ""}"><div class="k">${t.k}</div>
      <div class="v">${t.v}<small>${t.u || ""}</small></div><div class="s">${t.s || ""}</div></div>`).join("");
  };
  R.table = function (el, rows, cols, opts = {}) {
    if (!rows || !rows.length) { el.innerHTML = '<div class="empty">no data</div>'; return; }
    cols = cols || Object.keys(rows[0]).map((k) => ({ k, h: k }));
    let sortK = null, asc = true, filt = "";
    const render = () => {
      let rs = rows.filter((r) => !filt || JSON.stringify(r).toLowerCase().includes(filt));
      if (sortK) rs = rs.slice().sort((a, b) => ((a[sortK] > b[sortK] ? 1 : -1) * (asc ? 1 : -1)));
      const head = cols.map((c) => `<th data-k="${c.k}">${c.h}${sortK === c.k ? (asc ? " ▲" : " ▼") : ""}</th>`).join("");
      const body = rs.map((r) => `<tr class="${opts.rowClass ? opts.rowClass(r) : ""}">` + cols.map((c) => {
        const v = c.f ? c.f(r[c.k], r) : r[c.k];
        return `<td class="${typeof r[c.k] === "number" ? "num" : ""}">${v == null ? "—" : typeof v === "number" ? R.fmt(v, c.d ?? 2) : v}</td>`;
      }).join("") + "</tr>").join("");
      el.querySelector(".tblwrap").innerHTML = `<table class="t"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
      el.querySelectorAll("th").forEach((th) => (th.onclick = () => { if (sortK === th.dataset.k) asc = !asc; else { sortK = th.dataset.k; asc = true; } render(); }));
    };
    el.innerHTML = `<div style="display:flex;gap:6px"><input class="tblfilter" placeholder="filter…" aria-label="filter table">
      <button class="btn sm dl">CSV</button></div><div class="tblwrap" style="max-height:${opts.maxH || 420}px"></div>`;
    el.querySelector(".tblfilter").oninput = (e) => { filt = e.target.value.toLowerCase(); render(); };
    el.querySelector(".dl").onclick = () => R.downloadCSV(rows, (opts.name || "table") + ".csv");
    render();
  };
  R.downloadCSV = function (rows, name) {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== "object" || rows[0][k] === null);
    const lines = ["# SYNTHETIC DATA - ENGINEERING DEMONSTRATION - NOT VALIDATED FOR PLANT OPERATION", keys.join(",")]
      .concat(rows.map((r) => keys.map((k) => (r[k] == null ? "" : JSON.stringify(r[k]))).join(",")));
    R.download(lines.join("\n"), name, "text/csv");
  };
  R.download = function (text, name, type = "application/json") {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  R.stageBar = function (el, summary, records) {
    if (!summary) return;
    const tEnd = summary.t_end_schedule_s, now = summary.sim_time_s;
    el.innerHTML = summary.phase_table.map((p) => {
      const w = ((p.t_end - p.t_start) / tEnd) * 100;
      return `<div style="width:${w}%;background:${R.STAGE_COLORS[p.stage] || "#555"};${p.t_end <= now ? "" : "opacity:.45"}" title="${p.stage} ${(p.t_start / 60).toFixed(1)}-${(p.t_end / 60).toFixed(1)} min${p.blocked ? " BLOCKED: " + p.block_reason : ""}">${w > 6 ? p.stage.replace(/_/g, " ") : ""}${p.blocked ? " ⛔" : ""}</div>`;
    }).join("");
  };
  R.last = () => R.state.records[R.state.records.length - 1] || {};
  R.rhEnd = function (records) {
    const i = records.findIndex((r) => r.stage === "VACUUM_BREAK" || r.stage === "ABORT_VACUUM_BREAK");
    return i > 0 ? records[i - 1] : records[records.length - 1] || {};
  };
})();
