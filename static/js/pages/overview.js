// 01 Operational overview
const R = window.RHOB, C = R.C, W = R.W;
let geo = null;
R.onData(async (s, recs) => {
  W.stateTiles(R.$("#tiles"), s, recs);
  R.stageBar(R.$("#stagebar"), s, recs);
  if (!geo || geo._sim !== s.simulation_id) { const v = await R.api(`api/v1/simulations/${s.simulation_id}/visual`, { params: { stride: 50 } }); geo = v.geometry; geo._sim = s.simulation_id; }
  R.schematic(R.$("#schem"), geo, R.last());
  W.endpointTable(R.$("#endpoint"), s);
  const T = (k) => (r) => R.U("T", r[k]);
  C.ts("pCO", recs, [{ key: "C_bulk_ppm", name: "[C] bulk", unit: "ppm" }, { key: "O_bulk_ppm", name: "[O] bulk", unit: "ppm" }, { key: "C_vessel_ppm", name: "[C] vessel", dash: "dot", unit: "ppm" }],
    { yTitle: "ppm", ylog: true, extra: [C.labTrace(s, "C_ppm", "lab C")] });
  C.ts("pT", recs, [{ fn: T("T_l_K"), name: "ladle" }, { fn: T("T_v_K"), name: "vessel bath", dash: "dot" }, { fn: T("T_bulk_K"), name: "bulk (mass-avg.)", width: 2.5 }],
    { yTitle: R.UL("T"), extra: [C.labTrace(s, "T_K", "dip T", (v) => R.U("T", v))] });
  C.ts("pP", recs, [{ fn: (r) => R.U("P", r.P_Pa), name: "vessel P" }, { fn: (r) => R.U("P", r.P_sp_Pa), name: "set-point", dash: "dash" }], { yTitle: R.UL("P") + " (abs)", ylog: true });
  C.ts("pQ", recs, [{ fn: (r) => R.U("ar", r.argon_NL_min), name: "Ar lift (" + R.UL("ar") + ")" }, { key: "oxygen_Nm3_h", name: "O₂ (Nm³/h)" }, { key: "q_circ_t_min", name: "circulation (t/min)", yaxis: "y2" }],
    { yTitle: "gas flow", y2: "t/min" });
  W.advisories(R.$("#adv"), s.advisories, s.simulation_id);
  W.alarms(R.$("#alarms"), s.alarms, s.simulation_id);
  W.events(R.$("#events"), s.events);
});
