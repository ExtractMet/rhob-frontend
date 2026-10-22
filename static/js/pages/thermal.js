// 10 Thermal management & refractory
const R = window.RHOB, C = R.C;
R.onData((s, recs) => {
  const k = s.kpis || {}, e = R.rhEnd(recs);
  R.tiles(R.$("#ttiles"), [
    { k: "T arrival", v: R.fmt(R.U("T", recs[0].T_bulk_K), 1), u: R.UL("T"), cls: "info" }, { k: "T RH end", v: R.fmt(R.U("T", e.T_bulk_K), 1), u: R.UL("T"), cls: "info" },
    { k: "T caster arrival", v: R.fmt(R.U("T", R.last().T_bulk_K), 1), u: R.UL("T"), cls: "info" }, { k: "Mean drop (vacuum hold)", v: R.fmt(k.T_drop_rate_K_min, 2), u: "K/min", cls: "info" },
    { k: "Superheat at caster", v: R.fmt(R.last().superheat_K, 1), u: "K", cls: "info" }, { k: "Heat to ladle wall", v: R.fmt(e.E_int_to_ladle_wall_MJ, 0), u: "MJ", cls: "info" },
    { k: "Heat to vessel walls", v: R.fmt((e.E_int_to_vlow_wall_MJ || 0) + (e.E_int_to_vup_wall_MJ || 0), 0), u: "MJ", cls: "info" }, { k: "Reaction heat", v: R.fmt(["rxn_O2_to_O", "rxn_C_O_CO", "rxn_Al2O3", "rxn_SiO2", "rxn_MnO", "rxn_TiO2", "rxn_FeO_form", "rxn_FeO_diss", "rxn_solution", "rxn_degas_HN", "rxn_slag_reox"].reduce((a, x) => a + (e[`E_${x}_MJ`] || 0), 0), 0), u: "MJ", cls: "info" },
  ]);
  const T = (key) => (r) => R.U("T", r[key]);
  C.ts("pTemps", recs, [{ fn: T("T_bulk_K"), name: "steel bulk", width: 2.5 }, { fn: T("T_l_K"), name: "ladle active" }, { fn: T("T_d_K"), name: "ladle slow zone", dash: "dot" }, { fn: T("T_v_K"), name: "vessel bath", dash: "dot" }, { fn: T("T_slag_K"), name: "slag (lumped)", yaxis: "y2" }, { fn: T("T_gas_K"), name: "freeboard gas", yaxis: "y2", dash: "dash" }],
    { yTitle: "steel " + R.UL("T"), y2: "slag/gas " + R.UL("T"), extra: [C.labTrace(s, "T_K", "dip T", (v) => R.U("T", v))] });
  const MW = (key) => (r) => (r[key] || 0) / 1e6;
  C.ts("pLoss", recs, [["q_ladle_wall_W", "→ ladle refractory"], ["q_vlow_wall_W", "→ lower vessel/snorkels"], ["q_vup_wall_W", "→ upper vessel (radiation)"], ["q_steel_slag_W", "→ slag"], ["q_gas_sensible_W", "gas sensible"], ["q_ladle_shell_W", "ladle shell loss"], ["q_vlow_shell_W", "vessel shell loss (lower)"], ["q_vup_shell_W", "vessel shell loss (upper)"], ["q_slag_top_W", "slag top radiation"]]
    .map(([k, n]) => ({ fn: MW(k), name: n, stack: "l", fill: "tonexty" })), { yTitle: "MW" });
  C.ts("pWall", recs, [{ fn: T("T_ladle_hotface_K"), name: "ladle hot face" }, { fn: T("T_vlow_hotface_K"), name: "lower vessel hot face" }, { fn: T("T_vup_hotface_K"), name: "upper vessel hot face" }, { fn: T("T_ladle_shell_K"), name: "ladle shell", yaxis: "y2" }, { fn: T("T_vlow_shell_K"), name: "vessel shell (lower)", yaxis: "y2" }, { fn: T("T_vup_shell_K"), name: "vessel shell (upper)", yaxis: "y2" }],
    { yTitle: "hot face " + R.UL("T"), y2: "shell " + R.UL("T") });
  const n = (recs[0].Tw_ladle_K || []).length;
  C.plot("pHeat", [{ type: "heatmap", x: recs.map((r) => r.t_s / 60), y: Array.from({ length: n }, (_, i) => `node ${i + 1}`), z: Array.from({ length: n }, (_, i) => recs.map((r) => R.U("T", r.Tw_ladle_K[i]))), colorscale: "Inferno", colorbar: { title: R.UL("T") } }],
    { yTitle: "hot face (node 1) → shell", hovermode: "closest" });
  const sl = R.$("#tSel"); sl.max = recs.length - 1; if (!sl.dataset.init) { sl.value = Math.floor(recs.length / 2); sl.dataset.init = 1; }
  const prof = () => {
    const r = recs[+sl.value] || recs[recs.length - 1];
    C.plot("pProf", ["Tw_ladle_K", "Tw_vlow_K", "Tw_vup_K"].map((k, i) => ({ x: r[k].map((_, j) => j + 1), y: r[k].map((v) => R.U("T", v)), name: ["ladle wall", "lower vessel + snorkels", "upper vessel"][i], mode: "lines+markers" })),
      { xTitle: `node (1 = hot face) at t = ${(r.t_s / 60).toFixed(1)} min`, yTitle: R.UL("T"), hovermode: "closest" });
  };
  sl.oninput = prof; prof();
  C.ts("pSH", recs, [{ key: "superheat_K", name: "superheat (K)" }, { fn: T("liquidus_K"), name: "liquidus", yaxis: "y2", dash: "dot" }], { yTitle: "K", y2: R.UL("T") });
});
