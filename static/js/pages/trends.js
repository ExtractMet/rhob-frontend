// 04 Live trends, lab reconciliation, forecast bands, SSE live packets
const R = window.RHOB, C = R.C;
let forecast = null, plant = null, es = null, esSim = null;
async function render(s, recs) {
  const logC = R.$("#logC").checked;
  const ext = (key, name, f) => (forecast && forecast.trajectory.length ? [{ x: forecast.trajectory.map((r) => r.t_s / 60), y: forecast.trajectory.map((r) => (f ? f(r[key]) : r[key])), name: name + " forecast", mode: "lines", line: { dash: "dash", color: "#c9d36a", width: 2 } }] : []);
  const band = (lo, hi, name, f) => (forecast ? [{ x: forecast.bands.t_s.map((t) => t / 60), y: forecast.bands[hi].map((v) => (f ? f(v) : v)), mode: "lines", line: { width: 0 }, showlegend: false, hoverinfo: "skip" },
    { x: forecast.bands.t_s.map((t) => t / 60), y: forecast.bands[lo].map((v) => (f ? f(v) : v)), mode: "lines", line: { width: 0 }, fill: "tonexty", fillcolor: "rgba(201,211,106,.18)", name: name + " 90 % band" }] : []);
  const pl = (key, name, f) => (plant ? [{ x: plant.map((r) => r.t_s / 60), y: plant.map((r) => (f ? f(r[key]) : r[key])), name: name + " (synthetic plant truth)", mode: "lines", line: { dash: "dot", color: "#9b86d9" } }] : []);
  C.ts("pC", recs, [{ key: "C_bulk_ppm", name: "[C] model (soft-sensed)", width: 2.4 }, { key: "C_vessel_ppm", name: "[C] vessel zone", dash: "dot" }],
    { yTitle: "ppm", ylog: logC, extra: [...band("C_lo", "C_hi", "C"), ...ext("C_bulk_ppm", "C"), ...pl("C_bulk_ppm", "C"), C.labTrace(s, "C_ppm", "lab C")] });
  C.ts("pO", recs, [{ key: "O_bulk_ppm", name: "[O] dissolved" }, { key: "Al_bulk_ppm", name: "[Al]", yaxis: "y2" }], { yTitle: "O ppm", y2: "Al ppm", ylog: logC, extra: [...pl("O_bulk_ppm", "O"), C.labTrace(s, "O_ppm", "O-probe")] });
  C.ts("pT", recs, [{ fn: (r) => R.U("T", r.T_bulk_K), name: "T bulk" }, { fn: (r) => R.U("T", r.T_l_K), name: "T ladle", dash: "dot" }, { fn: (r) => R.U("T", r.T_v_K), name: "T vessel", dash: "dot" }],
    { yTitle: R.UL("T"), extra: [...band("T_lo", "T_hi", "T", (v) => R.U("T", v)), ...ext("T_bulk_K", "T", (v) => R.U("T", v)), ...pl("T_bulk_K", "T", (v) => R.U("T", v)), C.labTrace(s, "T_K", "dip T", (v) => R.U("T", v))] });
  C.ts("pHN", recs, [{ key: "H_bulk_ppm", name: "[H]" }, { key: "N_bulk_ppm", name: "[N]", yaxis: "y2" }], { yTitle: "H ppm", y2: "N ppm", extra: [C.labTrace(s, "H_ppm", "lab H"), Object.assign(C.labTrace(s, "N_ppm", "lab N"), { yaxis: "y2" })] });
  C.ts("pP", recs, [{ fn: (r) => R.U("P", r.P_Pa), name: "P vessel" }, { fn: (r) => R.U("P", r.P_sp_Pa), name: "set-point", dash: "dash" }], { yTitle: R.UL("P"), ylog: true });
  C.ts("pG", recs, [{ fn: (r) => R.U("ar", r.argon_NL_min), name: "Ar " + R.UL("ar") }, { key: "oxygen_Nm3_h", name: "O₂ Nm³/h", yaxis: "y2" }], { yTitle: R.UL("ar"), y2: "Nm³/h" });
  C.ts("pQ", recs, [{ key: "q_circ_t_min", name: "circulation t/min" }, { key: "mixing_time_95_s", name: "t95 (s)", yaxis: "y2" }], { yTitle: "t/min", y2: "s" });
  C.ts("pOG", recs, ["CO", "CO2", "H2", "N2", "Ar"].map((g) => ({ key: `offgas_${g}_Nm3_h`, name: g })), { yTitle: "Nm³/h" });
  C.ts("pRes", recs, [{ key: "mass_balance_relative_error", name: "element closure (rel.)" }, { key: "energy_balance_relative_error", name: "energy closure (rel.)" }], { yTitle: "relative residual", ylog: true, hlines: [{ y: 1e-6, label: "mass tolerance" }, { y: 1e-4, label: "energy tolerance", color: "#e3a83b" }] });
  const fh = s.forecasts || [];
  C.plot("pFH", [{ x: fh.map((f) => f.t_from_s / 60), y: fh.map((f) => f.endpoint.C), name: "forecast C_end (ppm)", mode: "lines+markers" },
    { x: fh.map((f) => f.t_from_s / 60), y: fh.map((f) => f.endpoint.T - 273.15), name: "forecast T_end (°C)", yaxis: "y2", mode: "lines+markers" }],
  { yTitle: "C_end ppm", y2: "T_end °C", xTitle: "forecast issued at (min)", hovermode: "closest" });
  const labs = (s.lab_results || []).map((l) => ({ sampled_min: l.t_sample_s / 60, available_min: l.t_available_s / 60, status: l.applied ? "APPLIED" : l.available ? "AVAILABLE" : "IN LAB",
    ...Object.fromEntries(Object.entries(l.values).map(([k, v]) => [k, v])), source: l.source }));
  R.table(R.$("#labs"), labs, null, { name: "lab_results", maxH: 300 });
  manageSSE(s);
}
function manageSSE(s) {
  const want = s.playing && !s.paused && s.status !== "completed";
  if (want && (!es || esSim !== s.simulation_id)) {
    if (es) es.close();
    es = new EventSource(`/bff/api/v1/stream/${s.simulation_id}`); esSim = s.simulation_id;
    const box = R.$("#live"); box.innerHTML = '<table class="t"><thead><tr><th>id</th><th>t min</th><th>stage</th><th>P mbar</th><th>T °C</th><th>C ppm</th><th>q t/min</th></tr></thead><tbody></tbody></table>';
    es.addEventListener("record", (e) => {
      const r = JSON.parse(e.data); const tb = box.querySelector("tbody");
      tb.insertAdjacentHTML("afterbegin", `<tr><td>${e.lastEventId}</td><td class="num">${(r.t_s / 60).toFixed(2)}</td><td>${r.stage}</td><td class="num">${(r.P_Pa / 100).toFixed(2)}</td><td class="num">${(r.T_bulk_K - 273.15).toFixed(1)}</td><td class="num">${r.C_bulk_ppm.toFixed(1)}</td><td class="num">${r.q_circ_t_min.toFixed(0)}</td></tr>`);
      while (tb.children.length > 60) tb.lastChild.remove();
    });
    es.addEventListener("status", (e) => { const d = JSON.parse(e.data); R.$("#sseState").textContent = `stream: ${d.status} · t=${(d.sim_time_s / 60).toFixed(1)} min${d.stale ? " · STALE DATA" : ""}`; });
    es.addEventListener("end", () => { R.$("#sseState").textContent = "stream ended (simulation complete)"; es.close(); es = null; });
    es.onerror = () => { R.$("#sseState").textContent = "stream reconnecting (Last-Event-ID resume)…"; };
    R.$("#sseState").textContent = "live stream connected";
  }
  if (!want && es) { es.close(); es = null; R.$("#sseState").textContent = "live stream idle (play the heat to stream)"; }
}
R.$("#fcBtn").onclick = async () => {
  try { R.$("#fcBtn").disabled = true; forecast = await R.api(`api/v1/simulations/${R.state.sim}/forecast`); R.toast("Forecast computed from current twin state", "ok"); await R.load(false); render(R.state.summary, R.state.records); }
  catch (e) { R.toast(e.message, "err"); } finally { R.$("#fcBtn").disabled = false; }
};
R.$("#showPlant").onchange = async (e) => { plant = e.target.checked ? await R.plantTruth() : null; render(R.state.summary, R.state.records); };
R.$("#logC").onchange = () => render(R.state.summary, R.state.records);
R.onData(render);
