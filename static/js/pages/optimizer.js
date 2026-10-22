// 12 Optimizer & recommendations
const R = window.RHOB, C = R.C, W = R.W;
let res = null;
function draw(r) {
  if (!r.baseline) { R.$("#optMsg").textContent = `${r.status}: ${r.message || ""}`; return; }
  const b = r.baseline, o = r.optimized, v = r.verification;
  R.tiles(R.$("#optTiles"), [
    { k: "Status", v: r.status.replace(/_/g, " "), cls: r.status === "FEASIBLE_PLAN" ? "ok" : "bad" }, { k: "Limiting constraint", v: r.limiting_constraint, cls: "warn" },
    { k: "Cost baseline → opt.", v: `${R.fmt(b.cost, 0)} → ${R.fmt(o.cost, 0)}`, u: "INR", cls: "info" }, { k: "Time", v: `${R.fmt(b.end.t_s / 60, 1)} → ${R.fmt(o.end.t_s / 60, 1)}`, u: "min", cls: "info" },
    { k: "C_end", v: `${R.fmt(b.end.C_bulk_ppm, 1)} → ${R.fmt(v.end.C_bulk_ppm, 1)}`, u: "ppm", cls: "info" }, { k: "T_end", v: `${R.fmt(b.end.T_bulk_K - 273.15, 1)} → ${R.fmt(v.end.T_bulk_K - 273.15, 1)}`, u: "°C", cls: "info" },
    { k: "Horizon", v: r.from_sim_time_s ? "receding" : "whole heat", s: r.horizon, cls: "info" },
    { k: "Evaluations", v: r.n_evaluations, s: `${R.fmt(r.wall_time_s, 0)} s wall · ${r.cobyla}`.slice(0, 60), cls: "info" }, { k: "Verification", v: v.violation <= 1e-9 ? "FEASIBLE" : "VIOLATION", s: `closure ok: ${v.closure_ok}`, cls: v.violation <= 1e-9 ? "ok" : "bad" },
  ]);
  const keys = Object.keys(o.x);
  const rows = keys.map((k) => ({ decision: k, baseline: b.x[k], optimized: o.x[k], unit: k.includes("O2") ? "Nm³" : k.includes("argon") ? "NL/min" : "s" }));
  ["C_bulk_ppm", "H_bulk_ppm", "N_bulk_ppm", "O_bulk_ppm", "Al_bulk_ppm", "T_bulk_K", "t_s"].forEach((k) => rows.push({ decision: "endpoint " + k, baseline: b.end[k], optimized: v.end[k], unit: k.endsWith("K") ? "K" : k === "t_s" ? "s" : "ppm" }));
  rows.push({ decision: "economic cost", baseline: b.cost, optimized: o.cost, unit: "INR (illustr.)" });
  if (o.chem) rows.push({ decision: "chemical heating Al / O₂ / s", baseline: 0, optimized: `${o.chem[0].toFixed(0)} kg / ${o.chem[1].toFixed(0)} Nm³/h / ${o.chem[2].toFixed(0)} s`, unit: "" });
  R.table(R.$("#optTbl"), rows, null, { name: "optimization_decisions" });
  const gk = Object.keys(o.g);
  C.bar("pMarg", gk, [{ name: "baseline", y: gk.map((k) => b.g[k]) }, { name: "optimized", y: gk.map((k) => o.g[k]) }], { yTitle: "normalized margin (≥0 ok)", xTitle: "" });
  const vt = r.verification_trajectory;
  const base = R.state.records;
  C.plot("pOC", [{ x: base.map((q) => q.t_s / 60), y: base.map((q) => q.C_bulk_ppm), name: "baseline (current schedule)" }, { x: vt.map((q) => q.t_s / 60), y: vt.map((q) => q.C_bulk_ppm), name: "optimized (verified run)", line: { dash: "dash" } }], { yTitle: "C ppm", ylog: true });
  C.plot("pOT", [{ x: base.map((q) => q.t_s / 60), y: base.map((q) => R.U("T", q.T_bulk_K)), name: "baseline" }, { x: vt.map((q) => q.t_s / 60), y: vt.map((q) => R.U("T", q.T_bulk_K)), name: "optimized", line: { dash: "dash" } }], { yTitle: R.UL("T") });
  const fr = r.frontier;
  C.plot("pFront", [{ x: fr.map((p) => p.t_treat_min), y: fr.map((p) => p.cost), mode: "markers", name: "evaluated plans", text: fr.map((p) => `C=${p.C_end.toFixed(1)} ppm, T=${(p.T_end - 273.15).toFixed(1)} °C`),
    marker: { size: 10, color: fr.map((p) => (p.feasible ? "#55c07f" : "#e2534f")), symbol: fr.map((p) => (p.feasible ? "circle" : "x")) } }], { xTitle: "treatment time to RH end (min)", yTitle: "cost (INR, illustrative)", hovermode: "closest" });
  R.table(R.$("#sens"), Object.entries(r.sensitivity || {}).map(([k, v]) => ({ decision: k, step: v.step, dC_per_unit: v.dC_ppm_per_unit, dT_per_unit: v.dT_K_per_unit, dcost_per_unit: v.dcost_per_unit, still_feasible: v.still_feasible ? "yes" : "NO" })), null, { name: "sensitivity" });
  R.table(R.$("#plan"), r.plan.phases.map((p) => ({ stage: p.stage, start_min: p.t_start / 60, end_min: p.t_end / 60, P_sp_Pa: p.pressure_setpoint_Pa, P_end_Pa: p.pressure_setpoint_end_Pa, Ar_NL_min: p.argon_NL_min, O2_Nm3_h: p.oxygen_Nm3_h })), null, { name: "optimized_plan" });
  R.$("#alt").innerHTML = (r.alternatives.length ? "<ul>" + r.alternatives.map((a) => `<li>${a}</li>`).join("") + "</ul>" : '<div class="note">Plan feasible — no alternatives required.</div>') +
    `<div class="kv small"><span>Method</span><span>${r.method}</span><span>Approval</span><span>${r.approval_required}</span><span>Actuator authority</span><span>${Object.entries(r.actuator_authority).map(([k, v]) => k + ": " + v).join("; ")}</span><span>Note</span><span>${r.note}</span><span>Solver</span><span>${JSON.stringify(r.solver_settings)}</span></div>`;
}
async function run() {
  try {
    R.$("#optRun").disabled = true;
    const j = await R.api("api/v1/optimization", { method: "POST", body: { simulation_id: R.state.sim, budget_s: +R.$("#budget").value, max_iter: +R.$("#maxit").value } });
    R.$("#optMsg").textContent = `job ${j.job_id} accepted (202 Accepted)`;
    const out = await R.poll(j.poll.replace("/api", "api"), (s) => { R.$("#optProg").style.width = `${100 * (s.progress || 0)}%`; R.$("#optMsg").textContent = `${s.status} · ${s.message || ""}`; }, 2000);
    if (out.status === "failed") throw new Error(out.message);
    res = out.result; try { localStorage.setItem("rhob.opt." + R.state.sim, JSON.stringify(res)); } catch (e) {}
    draw(res); R.toast(`optimization: ${res.status}`, res.status === "FEASIBLE_PLAN" ? "ok" : "err");
  } catch (e) { R.toast(e.message, "err"); } finally { R.$("#optRun").disabled = false; }
}
R.$("#optRun").onclick = run;
R.onData((s) => {
  W.advisories(R.$("#adv"), s.advisories, s.simulation_id);
  if (!res) { try { const c = localStorage.getItem("rhob.opt." + s.simulation_id); if (c) { res = JSON.parse(c); draw(res); } } catch (e) {} }
  if (new URL(location.href).searchParams.get("run") === "1" && !R.state._optStarted) { R.state._optStarted = true; run(); }
});
