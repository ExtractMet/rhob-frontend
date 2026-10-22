// 06 Vacuum, pumps, off-gas
const R = window.RHOB, C = R.C;
let plantCfg = null;
R.onData(async (s, recs) => {
  if (!plantCfg) plantCfg = (await R.api("api/v1/config/plant")).plant;
  const L = R.last(), e = R.rhEnd(recs);
  const minP = Math.min(...recs.map((r) => r.P_Pa));
  R.tiles(R.$("#vtiles"), [
    { k: "Vessel P now", v: R.fmt(R.U("P", L.P_Pa), 2), u: R.UL("P") + "(a)", cls: "info" }, { k: "Lowest P attained", v: R.fmt(R.U("P", minP), 2), u: R.UL("P"), cls: minP < 150 ? "ok" : "warn" },
    { k: "Pump capacity @P", v: R.fmt(L.pump_w_air_kg_h, 0), u: "kg/h air-eq.", cls: "info" }, { k: "Throttle", v: R.fmt(100 * (L.pump_throttle || 0), 0), u: "%", cls: "info" },
    { k: "Gas pumped (RH)", v: R.fmt(e.cum_exhaust_kg, 0), u: "kg", s: "all species", cls: "info" }, { k: "Steam (est.)", v: R.fmt((s.kpis || {}).steam_t, 2), u: "t", s: `${R.fmt((s.kpis || {}).steam_kg_per_t, 1)} kg/t (illustr.)`, cls: "info" },
    { k: "Mean gas M", v: R.fmt(1000 * (L.gas_molar_mass || 0), 1), u: "g/mol", cls: "info" }, { k: "Actual speed S", v: R.fmt(L.pump_S_actual_m3_s, 0), u: "m³/s", s: "at suction", cls: "info" },
  ]);
  C.ts("pP", recs, [{ fn: (r) => R.U("P", r.P_Pa), name: "vessel P" }, { fn: (r) => R.U("P", r.P_sp_Pa), name: "set-point", dash: "dash" }, { fn: (r) => R.U("P", r.P_bubble_Pa), name: "log-mean bubble P", dash: "dot" }], { yTitle: R.UL("P") + " abs", ylog: true });
  C.ts("pPump", recs, [{ key: "pump_w_air_kg_h", name: "capacity (kg/h air-eq.)" }, { fn: (r) => 100 * (r.pump_throttle || 0), name: "throttle %", yaxis: "y2" }], { yTitle: "kg/h", y2: "%" });
  C.ts("pFlows", recs, ["CO", "CO2", "Ar", "N2", "O2", "H2"].map((g) => ({ key: `offgas_${g}_Nm3_h`, name: g, stack: "g", fill: "tonexty" })), { yTitle: "Nm³/h (exhaust)" });
  C.ts("pX", recs, ["CO", "CO2", "Ar", "N2", "O2", "H2"].map((g) => ({ key: `x_${g}`, name: g })), { yTitle: "mole fraction" });
  const cur = plantCfg.vacuum.pump_curve;
  C.plot("pCurve", [{ x: cur.map((c) => c[0]), y: cur.map((c) => c[1]), name: "ejector curve (config)", mode: "lines+markers" },
    { x: recs.map((r) => r.P_Pa), y: recs.map((r) => (r.exhaust_mol_s || 0) * (r.gas_molar_mass || 0.029) * 3600 / Math.sqrt(0.02896 / (r.gas_molar_mass || 0.029))), name: "operating points (pumped, air-eq.)", mode: "markers", marker: { size: 5, color: recs.map((r) => r.t_s), colorscale: "Viridis", showscale: true, colorbar: { title: "t s" } } }],
  { xTitle: "suction pressure (Pa abs)", yTitle: "kg/h (dry-air equivalent)", raw: { xaxis: { type: "log", title: { text: "suction pressure (Pa abs)" } } }, hovermode: "closest" });
  C.ts("pS", recs, [{ key: "pump_S_actual_m3_s", name: "actual volumetric speed (m³/s)" }, { key: "cum_exhaust_kg", name: "cumulative pumped gas (kg)", yaxis: "y2" }], { yTitle: "m³/s", y2: "kg" });
});
