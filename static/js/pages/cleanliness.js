// 09 Deoxidation, alloying, slag, inclusions (PREDICTED)
const R = window.RHOB, C = R.C;
R.onData((s, recs) => {
  C.ts("pAl", recs, [{ key: "Al_bulk_ppm", name: "[Al]" }, { key: "O_bulk_ppm", name: "[O] dissolved" }, { key: "O_eq_Al_ppm", name: "O_eq(Al) (Al₂O₃ saturation)", dash: "dot" }], { yTitle: "ppm", ylog: true, extra: [C.labTrace(s, "Al_ppm", "lab Al")] });
  const bins = ["2.5 µm", "7.5 µm", "20 µm", "50 µm"];
  C.ts("pInc", recs, bins.map((b, i) => ({ fn: (r) => (r.inclusion_bins_ppm || [])[i], name: b, stack: "i", fill: "tonexty" })), { yTitle: "ppm Al₂O₃ (PREDICTED)" });
  C.ts("pTO", recs, [{ key: "total_O_ppm", name: "T.O. predicted" }, { key: "O_bulk_ppm", name: "dissolved O" }], { yTitle: "ppm", ylog: true,
    hlines: [{ y: (s.grade_id && (s.endpoint_current_trajectory.checks || []).find((c) => c.target === "total_O_predicted") || {}).max || 30, label: "grade T.O. indicator", color: "#e3a83b" }] });
  C.ts("pAlloy", recs, ["Ti", "Mn", "Si", "Nb", "V", "Cr"].map((x) => ({ key: `${x}_bulk_ppm`, name: x })), { yTitle: "ppm" });
  C.ts("pSlag", recs, ["FeO", "MnO", "SiO2", "Al2O3", "CaO", "MgO", "TiO2"].map((x) => ({ key: `slag_${x}_kg`, name: x, stack: "sl", fill: "tonexty" })), { yTitle: "kg" });
  C.ts("pReox", recs, [{ fn: (r) => (r.slag_metal_O_kg_s || 0) * 3600, name: "slag → steel O (kg/h)" }, { fn: (r) => 100 * (r.slag_FeO_kg || 0) / Math.max(r.slag_mass_kg || 1, 1), name: "slag FeO (wt%)", yaxis: "y2" }], { yTitle: "kg O / h", y2: "wt%" });
  R.table(R.$("#adds"), (s.applied_additions || []).map((a) => ({ t_min: a.t_s / 60, material: a.material, mass_kg: a.mass_kg, purpose: a.purpose, auto_Al_target_ppm: a.auto_target_Al_ppm, yield_override: a.yield_override })), null, { name: "additions" });
  R.table(R.$("#avail"), [
    ["Dissolved O, Al, Si, Mn, Ti", "PREDICTED (kinetics + equilibrium)", "medium"], ["Al₂O₃ inclusion size classes", "PREDICTED (aggregation, flotation, bubble capture)", "low — uncalibrated"],
    ["Total oxygen", "PREDICTED = dissolved + inclusion O", "low"], ["Slag FeO/MnO reoxidation", "PREDICTED", "low"], ["Exogenous inclusions (slag/refractory entrapment)", "UNAVAILABLE", "—"],
    ["Inclusion composition (spinel, Ca-aluminates)", "UNAVAILABLE", "—"], ["Nozzle-clogging index", "UNAVAILABLE", "—"], ["Cleanliness certification", "NOT PROVIDED — requires plant sampling", "—"],
  ].map(([o, st, c]) => ({ output: o, status: st, confidence: c })), null, { name: "availability" });
});
