// 11 What-if & batch scenario comparison + ensemble uncertainty
const R = window.RHOB, C = R.C;
let last = null;
function list() {
  const sc = R.state.scenarios || {};
  R.$("#cmpList").innerHTML = `<div class="small" style="margin-bottom:4px">Include current simulation <b>${R.state.sim || "—"}</b>: <input type="checkbox" id="incCur" checked></div>` +
    Object.entries(sc).map(([k, v]) => `<label class="small" style="display:block;margin:3px 0"><input type="checkbox" class="sc" value="${k}" ${["S1_RH_BASELINE_O2_OFF", "S2_RHOB_OXYGEN_ASSISTED"].includes(k) ? "checked" : ""}> <b>${k}</b> — ${v}</label>`).join("");
}
function draw(res) {
  const runs = res.comparison;
  const series = (key, f) => runs.map((r, i) => ({ x: r.trajectory.map((q) => q.t_s / 60), y: r.trajectory.map((q) => (f ? f(q[key]) : q[key])), name: r.name, mode: "lines", line: { color: C.PAL[i % 10] } }));
  C.plot("cC", series("C_bulk_ppm"), { yTitle: "C ppm", ylog: true }); C.plot("cT", series("T_bulk_K", (v) => R.U("T", v)), { yTitle: R.UL("T") });
  C.plot("cN", series("N_bulk_ppm"), { yTitle: "N ppm" }); C.plot("cP", series("P_Pa", (v) => R.U("P", v)), { yTitle: R.UL("P"), ylog: true }); C.plot("cTO", series("total_O_ppm"), { yTitle: "T.O. ppm" });
  const rows = runs.map((r) => {
    const st = r.endpoint.rh_end_state || {}, k = r.kpis || {};
    return { scenario: r.name, feasible: r.endpoint.feasible ? "YES" : "NO", C_end: st.C_bulk_ppm, N_end: st.N_bulk_ppm, H_end: st.H_bulk_ppm, Al_end: st.Al_bulk_ppm, T_end_C: st.T_bulk_K - 273.15, T_caster_C: k.T_caster_arrival_C,
      time_min: k.treatment_time_min, O2_Nm3: k.oxygen_Nm3, Ar_Nm3: k.argon_Nm3, steam_t: k.steam_t, cost_per_t: k.cost_per_t, mass_closure: r.closure.mass, energy_closure: r.closure.energy, sim: r.simulation_id,
      reasons: (r.endpoint.infeasibility_reasons || []).map((x) => x.target).join(",") };
  });
  R.table(R.$("#cmpTbl"), rows, null, { name: "scenario_comparison", maxH: 380 });
}
R.$("#cmpRun").onclick = async () => {
  const scen = R.$$(".sc").filter((c) => c.checked).map((c) => c.value);
  const sims = R.$("#incCur").checked && R.state.sim ? [R.state.sim] : [];
  if (scen.length + sims.length < 2) return R.toast("select at least two", "err");
  try {
    const j = await R.api("api/v1/scenarios/compare", { method: "POST", body: { scenarios: scen, simulation_ids: sims } });
    R.$("#cmpMsg").textContent = `job ${j.job_id} accepted (202)`;
    const res = await R.poll(j.poll.replace("/api", "api"), (s) => { R.$("#cmpProg").style.width = `${100 * (s.progress || 0)}%`; R.$("#cmpMsg").textContent = `${s.status} ${s.message || ""}`; });
    if (res.status === "failed") throw new Error(res.message);
    last = res.result; draw(last); R.toast("comparison complete", "ok");
  } catch (e) { R.toast(e.message, "err"); }
};
R.$("#ensRun").onclick = async () => {
  try {
    const j = await R.api(`api/v1/simulations/${R.state.sim}/ensemble`, { method: "POST", params: { n: 8 } });
    const res = await R.poll(j.poll.replace("/api", "api"), (s) => { R.$("#cmpProg").style.width = `${100 * (s.progress || 0)}%`; R.$("#cmpMsg").textContent = `ensemble ${s.status} ${s.message || ""}`; });
    if (res.status === "failed") throw new Error(res.message);
    const e = res.result, x = e.t_s.map((t) => t / 60);
    const band = (k, name, color, f = (v) => v) => [{ x, y: e[k].p95.map(f), mode: "lines", line: { width: 0 }, showlegend: false }, { x, y: e[k].p05.map(f), mode: "lines", fill: "tonexty", line: { width: 0 }, fillcolor: color, name: name + " 5–95 %" }, { x, y: e[k].p50.map(f), mode: "lines", name: name + " median" }];
    C.plot("cEns", [...band("C_bulk_ppm", "C ppm", "rgba(70,193,214,.25)"), ...band("N_bulk_ppm", "N ppm", "rgba(227,168,59,.25)")], { yTitle: "ppm", ylog: true });
    R.toast(`ensemble of ${e.n} members (seed ${e.seed}) complete`, "ok");
  } catch (e) { R.toast(e.message, "err"); }
};
R.onData(() => { if (!R.$("#cmpList").innerHTML) list(); if (last) draw(last); });
setTimeout(list, 1500);
