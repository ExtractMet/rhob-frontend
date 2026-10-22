// 14 History & replay, EKF soft sensor, lab assimilation, ML validation
const R = window.RHOB, C = R.C;
let ml = null, ds = null, drift = null;
R.onData(async (s, recs) => {
  const lst = await R.api("api/v1/simulations", { params: { limit: 100 } });
  R.table(R.$("#sims"), lst.items.map((i) => ({ ...i, open: i.simulation_id })), [{ k: "created_at", h: "Created (UTC)" }, { k: "heat_id", h: "Heat" }, { k: "scenario_name", h: "Scenario" }, { k: "mode", h: "Mode" }, { k: "status", h: "Status" },
    { k: "sim_time_s", h: "t (s)", d: 0 }, { k: "result_checksum", h: "Result checksum" }, { k: "open", h: "Replay", f: (v) => `<a href="/page/trends?sim=${v}">open</a> · <a href="/page/plant3d?sim=${v}">3D</a>` }], { name: "simulations", maxH: 260 });
  const est = await R.api(`api/v1/simulations/${s.simulation_id}/estimator`);
  if (est.available) {
    const tr = est.trace, x = tr.map((q) => q.t_s / 60);
    C.plot("pEkfC", [{ x, y: tr.map((q) => q.C_ppm + 2 * q.C_sd), line: { width: 0 }, showlegend: false, hoverinfo: "skip" }, { x, y: tr.map((q) => Math.max(q.C_ppm - 2 * q.C_sd, 0.1)), fill: "tonexty", line: { width: 0 }, fillcolor: "rgba(70,193,214,.2)", name: "EKF ±2σ" },
      { x, y: tr.map((q) => q.C_ppm), name: "EKF soft sensor (SOFT-SENSED)", line: { color: "#46c1d6", width: 2.5 } },
      { x: recs.map((r) => r.t_s / 60), y: recs.map((r) => r.C_bulk_ppm), name: "open-loop twin", line: { dash: "dot", color: "#e3a83b" } },
      { x: est.plant_truth.map((r) => r.t_s / 60), y: est.plant_truth.map((r) => r.C_ppm), name: "synthetic plant truth", line: { color: "#9b86d9", dash: "dash" } },
      { x: est.measurements.C_lab.map((m) => m[0] / 60), y: est.measurements.C_lab.map((m) => m[2]), mode: "markers", name: "lab C (sample time)", marker: { size: 10, symbol: "diamond", color: "#55c07f" } }],
    { yTitle: "C ppm", ylog: true });
    C.plot("pEkfT", [{ x, y: tr.map((q) => R.U("T", q.T_K)), name: "EKF T" }, { x: est.plant_truth.map((r) => r.t_s / 60), y: est.plant_truth.map((r) => R.U("T", r.T_K)), name: "plant truth T", line: { dash: "dash" } },
      { x: est.measurements.T.map((m) => m[0] / 60), y: est.measurements.T.map((m) => R.U("T", m[1])), mode: "markers", name: "thermocouple", marker: { size: 9, color: "#55c07f" } },
      { x, y: tr.map((q) => q.theta), name: "θ kinetic multiplier", yaxis: "y2" }, { x, y: tr.map((q) => q.theta + 2 * q.theta_sd), yaxis: "y2", name: "θ +2σ", line: { dash: "dot", width: 1 } }],
    { yTitle: R.UL("T"), y2: "θ (-)" });
    R.table(R.$("#ekfLog"), est.log.map((l) => ({ sample_min: l.t_sample_s / 60, available_min: l.t_available_s / 60, lab_C: l.lab_C_ppm, pre_C: l.pre_C_ppm, post_C: l.post_C_ppm, pre_bias: l.pre_bias_ppm, post_bias: l.post_bias_ppm, theta: l.theta_post })), null, { name: "ekf_log" });
  }
  const as = (s.assimilations || []).flatMap((a) => a.entries.map((e) => ({ applied_min: e.t_applied_s / 60, sample_min: e.t_sample_s / 60, kind: e.kind, lab: e.lab_value, model_at_sample: e.model_at_sample, innovation: e.innovation, gain: e.gain, correction_now: e.correction_now,
    fc_C_before: a.forecast_before.rh_end_state.C_bulk_ppm, fc_C_after: a.forecast_after.rh_end_state.C_bulk_ppm })));
  R.table(R.$("#assim"), as, null, { name: "assimilations" });
  if (!ml) { ml = await R.api("api/v1/ml/model"); ds = await R.api("api/v1/ml/dataset"); drift = await R.api("api/v1/ml/drift"); }
  const rep = ml.report;
  R.$("#mlRep").innerHTML = `<div class="note" style="color:var(--amber)">${rep.label}</div><div class="kv small" style="margin:6px 0"><span>Heats</span><span>${rep.n_heats} (train ${rep.split.train} / val ${rep.split.validation} / test ${rep.split.test}) — ${rep.split_method}</span><span>Model</span><span>${rep.meta.version} · status <b>${rep.meta.status}</b> (approval required before use)</span></div>` +
    Object.entries(rep.targets).map(([t, v]) => `<div class="kv small" style="margin-top:6px"><span><b>${t}</b></span><span></span><span>test MAE physics-only</span><span>${v.test_MAE_physics_only.toFixed(4)}</span><span>test MAE hybrid</span><span>${v.test_MAE_hybrid.toFixed(4)} (95 % CI ${v.test_MAE_hybrid_CI95.map((q) => q.toFixed(4)).join("–")})</span><span>90 % PI coverage (test)</span><span>${(100 * v.PI90_coverage_test).toFixed(0)} %</span><span>Validation gate</span><span style="color:${v.validation_gate.startsWith("PASSED") ? "var(--green)" : "var(--red)"}">${v.validation_gate}</span></div>`).join("");
  const imp = rep.targets.resid_T_K.permutation_importance_validation;
  C.bar("pImp", imp.map((q) => q[0]), [{ name: "Δscore (resid T)", y: imp.map((q) => q[1]) }], { h: true, yTitle: "permutation importance" });
  const rows = ds.rows;
  const grp = (sp) => rows.filter((r) => r.split === sp);
  const hold = grp("holdout");
  C.plot("pMl", [{ x: rows.map((r) => r.plant_T_end_K - 273.15), y: rows.map((r) => r.twin_T_end_K - 273.15), mode: "markers", name: "physics-only twin T_end", marker: { color: "#e3a83b", size: 7 } },
    { x: hold.map((r) => r.plant_T_end_K - 273.15), y: hold.map((r) => r.hybrid_T_K - 273.15), mode: "markers", name: "hybrid T_end (holdout)", marker: { color: "#46c1d6", size: 10, symbol: "diamond" } },
    { x: [1560, 1630], y: [1560, 1630], mode: "lines", name: "parity", line: { dash: "dot", color: "#93a1b0" } }],
  { xTitle: "synthetic plant T at RH end (°C)", yTitle: "predicted (°C)", hovermode: "closest" });
  const df = Object.entries(drift.features);
  C.bar("pDrift", df.map((d) => d[0]), [{ name: "PSI", y: df.map((d) => d[1].psi), color: "#9b86d9" }], { h: true, yTitle: "PSI (>0.25 drift, >0.1 watch)" });
});
