// 07 Oxygen blowing, argon lift, circulation, mixing
const R = window.RHOB, C = R.C;
let mixV = null;
R.onData(async (s, recs) => {
  const e = R.rhEnd(recs);
  const ob = recs.filter((r) => r.oxygen_Nm3_h > 0);
  const mean = (a, k) => (a.length ? a.reduce((x, r) => x + (r[k] || 0), 0) / a.length : null);
  R.tiles(R.$("#otiles"), [
    { k: "O₂ blown (RH)", v: R.fmt(e.cum_O2_Nm3, 1), u: "Nm³", cls: "info" }, { k: "Mean absorption", v: ob.length ? R.fmt(100 * mean(ob, "o2_abs_eff"), 0) : "—", u: "%", s: "η = 1 − exp(−λ h_sub)", cls: "info" },
    { k: "C removed at jet", v: R.fmt(e.cum_dC_jet_kg, 1), u: "kg", cls: "info" }, { k: "Mean circulation", v: R.fmt(mean(recs.filter((r) => r.q_circ_t_min > 0), "q_circ_t_min"), 0), u: "t/min", cls: "info" },
    { k: "Recirculation no.", v: R.fmt(e.recirculation_number, 2), u: "", s: "Σ circulated / M", cls: "info" }, { k: "Ar used (RH)", v: R.fmt(e.cum_Ar_Nm3, 1), u: "Nm³", cls: "info" },
    { k: "Mixing t95 (min)", v: R.fmt(Math.min(...recs.filter((r) => r.mixing_time_95_s).map((r) => r.mixing_time_95_s)), 0), u: "s", cls: "info" }, { k: "Hold-up M_v", v: R.fmt((e.M_v_kg || 0) / 1000, 1), u: "t", cls: "info" },
  ]);
  C.ts("pO2", recs, [{ key: "oxygen_Nm3_h", name: "O₂ flow Nm³/h" }, { fn: (r) => 100 * (r.o2_abs_eff || 0), name: "absorption %", yaxis: "y2" }, { key: "cum_O2_Nm3", name: "cumulative Nm³", dash: "dot" }], { yTitle: "Nm³/h · Nm³", y2: "%" });
  const jet = [["jet_O_to_C_mol_s", "→ CO (direct)", 1], ["jet_O_to_FeO_mol_s", "→ FeO", 1], ["jet_Al_mol_s", "→ Al₂O₃", 1.5], ["jet_Si_mol_s", "→ SiO₂", 2], ["jet_Mn_mol_s", "→ MnO", 1], ["jet_Ti_mol_s", "→ TiO₂", 2]];
  C.ts("pJet", recs, [...jet.map(([k, n, f]) => ({ fn: (r) => (r[k] || 0) * f, name: n, stack: "j", fill: "tonexty" })), { fn: (r) => 2 * (r.o2_slip_mol_s || 0), name: "slip O (to freeboard)", dash: "dot" }], { yTitle: "mol O / s" });
  C.ts("pFeO", recs, [{ key: "feo_pool_kg", name: "FeO pool (kg)" }, { fn: (r) => (r.feo_diss_kg_s || 0) * 60, name: "FeO dissolving (kg/min)" }, { key: "pc_CO_mol_s", name: "post-combustion CO (mol/s)", yaxis: "y2" }], { yTitle: "kg · kg/min", y2: "mol/s" });
  C.ts("pCirc", recs, [{ key: "q_circ_t_min", name: "circulation (saturated, calibrated)" }, { key: "q_raw_t_min", name: "Kuwabara raw", dash: "dot" }, { fn: (r) => r.argon_NL_min, name: "Ar NL/min", yaxis: "y2" }], { yTitle: "t/min", y2: "NL/min" });
  C.ts("pHold", recs, [{ fn: (r) => r.M_v_kg / 1000, name: "M_v (t)" }, { fn: (r) => r.M_v_eq_kg / 1000, name: "M_v,eq (t)", dash: "dot" }, { fn: (r) => 1000 * r.vessel_depth_m, name: "vessel bath (mm)", yaxis: "y2" }, { fn: (r) => 1000 * r.ladle_level_drop_m, name: "ladle level drop (mm)", yaxis: "y2" }], { yTitle: "t", y2: "mm" });
  C.ts("pMix", recs, [{ key: "mixing_time_95_s", name: "t95 (s)" }, { key: "recirculation_number", name: "recirculation number", yaxis: "y2" }, { fn: (r) => 100 * (r.gas_holdup_upleg || 0), name: "up-leg gas hold-up %", dash: "dot" }], { yTitle: "s · %", y2: "-" });
  try {
    mixV = await R.api(`api/v1/simulations/${s.simulation_id}/mixing`);
    if (mixV.available) C.plot("pRTD", [{ x: mixV.tracer.t_s, y: mixV.tracer.ladle_norm, name: "bulk ladle c/c∞" }, { x: mixV.tracer.t_s, y: mixV.tracer.vessel_norm, name: "vessel c/c∞" }],
      { xTitle: "time after pulse (s)", yTitle: "normalized concentration", hovermode: "x unified", raw: { shapes: [{ type: "rect", xref: "paper", x0: 0, x1: 1, y0: 0.95, y1: 1.05, fillcolor: "rgba(85,192,127,.12)", line: { width: 0 } }],
        title: { text: `t95 = ${R.fmt(mixV.mixing_time_95_s, 0)} s (95 % CI ${mixV.mixing_time_95_CI_s.map((v) => v.toFixed(0)).join("–")} s) at t = ${(mixV.t_s / 60).toFixed(1)} min`, font: { size: 11 } } } });
  } catch (e) {}
  const pts = recs.filter((r) => r.q_circ_t_min > 0);
  C.plot("pQvsG", [{ x: pts.map((r) => r.argon_NL_min), y: pts.map((r) => r.q_circ_t_min), mode: "markers", name: "operating points", marker: { color: pts.map((r) => Math.log10(r.P_Pa)), colorscale: "Portland", showscale: true, colorbar: { title: "log P" }, size: 6 } }],
    { xTitle: "Ar lift (NL/min)", yTitle: "circulation (t/min)", hovermode: "closest" });
});
