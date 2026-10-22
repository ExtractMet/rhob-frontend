// 15 Economics, consumption, material inputs/outputs
const R = window.RHOB, C = R.C;
let heavy = null, hv = null;
R.onData(async (s, recs) => {
  if (hv !== s.version + s.simulation_id) { heavy = await R.api(`api/v1/simulations/${s.simulation_id}`, { params: { heavy: true } }); hv = s.version + s.simulation_id; }
  const k = heavy.kpis, io = heavy.material_io;
  R.tiles(R.$("#etiles"), [
    { k: "Cost total (illustr.)", v: R.fmt(k.cost_total, 0), u: k.currency, cls: "info" }, { k: "Cost per tonne", v: R.fmt(k.cost_per_t, 1), u: k.currency + "/t", cls: "info" },
    { k: "Treatment time", v: R.fmt(k.treatment_time_min, 1), u: "min", cls: "info" }, { k: "Oxygen", v: R.fmt(k.oxygen_Nm3, 1), u: "Nm³", s: R.fmt(k.oxygen_Nm3 / (io.inputs.liquid_steel_t || 1), 2) + " Nm³/t", cls: "info" },
    { k: "Argon", v: R.fmt(k.argon_Nm3, 1), u: "Nm³", s: R.fmt(k.argon_Nm3 / (io.inputs.liquid_steel_t || 1), 3) + " Nm³/t", cls: "info" }, { k: "Steam", v: R.fmt(k.steam_t, 2), u: "t", s: R.fmt(k.steam_kg_per_t, 1) + " kg/t", cls: "info" },
    { k: "Metal yield", v: R.fmt(k.metal_yield_pct, 2), u: "%", cls: "info" }, { k: "Removal C / H / N", v: `${R.fmt(k.C_removal_pct, 0)}/${R.fmt(k.H_removal_pct, 0)}/${R.fmt(k.N_removal_pct, 0)}`, u: "%", cls: "info" },
  ]);
  const cb = k.cost_breakdown;
  C.plot("pCost", [{ type: "pie", labels: Object.keys(cb), values: Object.values(cb), hole: 0.45, textinfo: "label+percent" }], { raw: { showlegend: false, margin: { l: 10, r: 10, t: 10, b: 10 } } });
  const ak = Object.keys(k.alloys_kg || {});
  C.bar("pCons", ["O₂ (Nm³)", "Ar (Nm³)", "steam (100 kg)", ...ak.map((a) => a + " (kg)")], [{ name: "consumption", y: [k.oxygen_Nm3, k.argon_Nm3, k.steam_t * 10, ...ak.map((a) => k.alloys_kg[a])] }], { yTitle: "", xTitle: "" });
  const ci = io.inputs.steel_composition_ppm, co = io.outputs.steel_composition_ppm;
  R.table(R.$("#inTbl"), [{ item: "Liquid steel", amount: io.inputs.liquid_steel_t, unit: "t" }, { item: "Steel temperature", amount: io.inputs.steel_T_C, unit: "°C" }, { item: "Oxygen (tuyeres + leak)", amount: io.inputs.oxygen_Nm3, unit: "Nm³" }, { item: "Argon", amount: io.inputs.argon_Nm3, unit: "Nm³" },
    ...Object.entries(io.inputs.slag_kg).map(([o, v]) => ({ item: "slag " + o, amount: v, unit: "kg" })), ...io.inputs.additions.map((a) => ({ item: `addition ${a.material} @${(a.t_s / 60).toFixed(1)} min`, amount: a.mass_kg, unit: "kg" })),
    ...Object.entries(ci).map(([e, v]) => ({ item: "steel [" + e + "]", amount: v, unit: "ppm" }))], null, { name: "inputs" });
  R.table(R.$("#outTbl"), [{ item: "Liquid steel", amount: io.outputs.liquid_steel_t, unit: "t" }, { item: "Steel temperature", amount: io.outputs.steel_T_C, unit: "°C" }, { item: "Total O (predicted)", amount: io.outputs.total_O_ppm_predicted, unit: "ppm" },
    ...Object.entries(io.outputs.slag_kg).map(([o, v]) => ({ item: "slag " + o, amount: v, unit: "kg" })), ...Object.entries(io.outputs.offgas_kg).map(([g, v]) => ({ item: "off-gas " + g, amount: v, unit: "kg" })),
    ...Object.entries(co).map(([e, v]) => ({ item: "steel [" + e + "]", amount: v, unit: "ppm" }))], null, { name: "outputs" });
  const els = Object.keys(ci).filter((e) => (ci[e] || 0) > 0 || (co[e] || 0) > 0);
  C.bar("pComp", els, [{ name: "arrival", y: els.map((e) => ci[e]) }, { name: "caster arrival", y: els.map((e) => co[e]) }], { yTitle: "ppm", ylog: true, xTitle: "" });
  const ox = Object.keys(io.inputs.slag_kg);
  C.bar("pSlag", ox, [{ name: "in", y: ox.map((o) => io.inputs.slag_kg[o]) }, { name: "out", y: ox.map((o) => io.outputs.slag_kg[o]) }], { yTitle: "kg", xTitle: "" });
  const L = io.element_ledger_kg, cols = ["Fe", "C", "O", "H", "N", "Al", "Si", "Mn", "Ti"];
  R.table(R.$("#ledger"), Object.entries(L).map(([r, d]) => ({ reservoir: r, ...Object.fromEntries(cols.map((c) => [c, d[c]])) })), [{ k: "reservoir", h: "Reservoir" }, ...cols.map((c) => ({ k: c, h: c, d: 3 }))], { name: "element_ledger" });
});
