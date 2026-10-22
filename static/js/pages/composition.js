// 08 Decarburization sites, C-O equilibrium, H/N degassing
const R = window.RHOB, C = R.C;
R.onData((s, recs) => {
  const ppmMin = (k) => (r) => ((r[k] || 0) * 0.012011 / (r.M_total_kg || 3e5)) * 1e6 * 60;
  C.ts("pSites", recs, [["r_C_surface_mol_s", "free surface + splash"], ["r_C_inner_mol_s", "in-bath CO nucleation"], ["r_C_bubble_mol_s", "Ar bubble surface"], ["r_C_jet_mol_s", "O₂ jet (direct)"]]
    .map(([k, n]) => ({ fn: ppmMin(k), name: n, stack: "s", fill: "tonexty" })), { yTitle: "ppm C / min" });
  C.ts("pCum", recs, ["surface", "inner", "bubble", "jet"].map((k) => ({ key: `cum_dC_${k}_kg`, name: k })), { yTitle: "kg C removed" });
  C.ts("pCeq", recs, [{ key: "C_bulk_ppm", name: "[C]" }, { key: "O_bulk_ppm", name: "[O]" }, { key: "C_eq_surface_ppm", name: "C_eq at surface p_CO", dash: "dot" }, { fn: (r) => r.p_CO_eq_bulk_Pa, name: "p_CO,eq bulk (Pa)", yaxis: "y2", dash: "dash" }],
    { yTitle: "ppm", ylog: true, y2: "Pa", yaxis2: { type: "log" } });
  // C-O path vs equilibrium lines log[C][O] = log(pCO) - log K (f=1), at T of the bath
  const T = R.last().T_bulk_K || 1873, K = Math.pow(10, 1160 / T + 2.003);
  const cs = Array.from({ length: 60 }, (_, i) => Math.pow(10, -4 + (i * 2.4) / 59));
  const lines = [101325, 10000, 1000, 100].map((p) => ({ x: cs.map((c) => c * 1e4), y: cs.map((c) => ((p / 101325) / (K * c)) * 1e4), mode: "lines", name: `eq. p_CO = ${p >= 1000 ? p / 1000 + " kPa" : p + " Pa"}`, line: { dash: "dot", width: 1 } }));
  C.plot("pPath", [...lines, { x: recs.map((r) => r.C_bulk_ppm), y: recs.map((r) => r.O_bulk_ppm), name: "heat path", mode: "lines+markers", marker: { size: 4, color: recs.map((r) => r.t_s), colorscale: "Viridis" }, line: { color: "#46c1d6" } }],
    { xTitle: "[C] ppm", yTitle: "[O] ppm", hovermode: "closest", raw: { xaxis: { type: "log", title: { text: "[C] ppm" }, range: [0, 3.2] }, yaxis: { type: "log", title: { text: "[O] ppm" }, range: [0, 3.3] } } });
  C.ts("pK", recs, [{ key: "K_app_1_min", name: "K_app (1/min) = (Q/W)·ρak/(Q+ρak)" }, { key: "surface_area_m2", name: "reactive surface (m²)", yaxis: "y2" }, { fn: (r) => 1000 * (r.inner_site_depth_m || 0), name: "CO nucleation depth (mm)", yaxis: "y2", dash: "dot" }], { yTitle: "1/min", y2: "m² · mm" });
  const kgmin = (k) => (r) => ((r[k] || 0) / (r.M_total_kg || 3e5)) * 1e6 * 60;
  C.ts("pH", recs, [{ key: "H_bulk_ppm", name: "[H]" }, { key: "H_eq_ppm", name: "H_eq (Sieverts, p_H2 vessel)", dash: "dot" }, { fn: kgmin("r_H_surface_kg_s"), name: "surface removal ppm/min", yaxis: "y2" }, { fn: kgmin("r_H_bubble_kg_s"), name: "bubble removal ppm/min", yaxis: "y2" }],
    { yTitle: "ppm", y2: "ppm/min", extra: [C.labTrace(s, "H_ppm", "lab H")] });
  C.ts("pN", recs, [{ key: "N_bulk_ppm", name: "[N]" }, { key: "N_eq_ppm", name: "N_eq (Sieverts, p_N2 vessel)", dash: "dot" }, { key: "k_r_N", name: "k_r (mol/m²·s·atm) — poisoned by O,S", yaxis: "y2" }],
    { yTitle: "ppm", y2: "k_r", extra: [C.labTrace(s, "N_ppm", "lab N")], hlines: s.endpoint_current_trajectory?.checks ? [{ y: (s.endpoint_current_trajectory.checks.find((c) => c.target === "N") || {}).max, label: "grade N max" }] : [] });
  C.ts("pZone", recs, [{ key: "C_ladle_ppm", name: "C ladle" }, { key: "C_vessel_ppm", name: "C vessel", dash: "dot" }, { key: "O_ladle_ppm", name: "O ladle" }, { key: "O_vessel_ppm", name: "O vessel", dash: "dot" }], { yTitle: "ppm", ylog: true });
  const e = R.rhEnd(recs);
  const els = ["C", "O", "H", "N", "Al", "Si", "Mn", "Ti", "S", "P", "Cr", "Ni", "Nb", "V", "Cu", "Mo"];
  R.table(R.$("#compTbl"), els.map((x) => ({ element: x, arrival: recs[0][`${x}_bulk_ppm`], rh_end_bulk: e[`${x}_bulk_ppm`], ladle: e[`${x}_ladle_ppm`], vessel: e[`${x}_vessel_ppm`], caster: R.last()[`${x}_bulk_ppm`],
    tracking: ["C", "O", "H", "N", "Al", "Si", "Mn", "Ti"].includes(x) ? "reactive (kinetics)" : "passive (dilution/addition)" })), null, { name: "composition" });
});
