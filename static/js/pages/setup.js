// 03 Heat setup & configuration: typed request editor bound to the backend schema
const R = window.RHOB;
let req = null, grades = [], refr = {}, mats = {};
const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const set = (o, p, v) => { const ks = p.split("."); let a = o; ks.slice(0, -1).forEach((k) => (a = a[k] = a[k] ?? {})); a[ks[ks.length - 1]] = v; };
function num(path, label, unit, step = "any", min = "", max = "") {
  const v = get(req, path);
  return `<label class="f">${label} <span class="u">${unit}</span><input type="number" data-path="${path}" step="${step}" ${min !== "" ? `min="${min}"` : ""} ${max !== "" ? `max="${max}"` : ""} value="${v ?? ""}"></label>`;
}
function txt(path, label) { return `<label class="f">${label}<input type="text" data-path="${path}" value="${get(req, path) ?? ""}"></label>`; }
function chk(path, label) { return `<label class="f">${label}<input type="checkbox" data-path="${path}" data-type="bool" ${get(req, path) ? "checked" : ""}></label>`; }
function sel(path, label, opts) { const v = get(req, path); return `<label class="f">${label}<select data-path="${path}" data-type="str">${opts.map((o) => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select></label>`; }
function bind(root) {
  root.querySelectorAll("[data-path]").forEach((el) => {
    el.onchange = () => {
      const p = el.dataset.path;
      let v = el.type === "checkbox" ? el.checked : el.dataset.type === "str" || el.type === "text" ? el.value : el.value === "" ? null : +el.value;
      if (el.type === "number" && el.value !== "" && ((el.min !== "" && v < +el.min) || (el.max !== "" && v > +el.max))) { el.classList.add("invalid"); R.toast(`${p}: outside physical bounds [${el.min}, ${el.max}]`, "err"); return; }
      el.classList.remove("invalid"); set(req, p, v); derived();
    };
  });
}
function renderAll() {
  const h = req.heat;
  R.$("#heatForm").innerHTML = `<div class="formgrid">${txt("heat.heat_id", "Heat ID")}<label class="f">Grade<select id="gradeSel">${grades.map((g) => `<option ${g.grade_id === h.grade_id ? "selected" : ""}>${g.grade_id}</option>`).join("")}</select></label>
    ${num("heat.steel_mass_t", "Steel mass", "t", 0.1, 50, 420)}${num("heat.T_arrival_K", "T arrival", "K", 0.1, 1800, 1973)}${num("heat.slag_mass_t", "Slag mass", "t", 0.1, 0, 20)}
    ${sel("heat.assay_confidence", "Assay confidence", ["high", "medium", "low"])}</div>
    <fieldset><legend>Arrival chemistry (ppm by mass)</legend><div class="formgrid">${Object.keys(h.composition_ppm).map((e) => num(`heat.composition_ppm.${e}`, `[${e}]`, "ppm", "any", 0, 200000)).join("")}</div></fieldset>
    <fieldset><legend>Ladle slag (wt%, Σ≈100)</legend><div class="formgrid">${Object.keys(h.slag_composition_wtpct).map((o) => num(`heat.slag_composition_wtpct.${o}`, o, "wt%", 0.1, 0, 100)).join("")}</div></fieldset>`;
  R.$("#gradeSel").onchange = (e) => { req.heat.grade_id = e.target.value; req.grade = JSON.parse(JSON.stringify(grades.find((g) => g.grade_id === e.target.value))); renderAll(); };
  if (!req.grade) req.grade = JSON.parse(JSON.stringify(grades.find((g) => g.grade_id === h.grade_id) || grades[0]));
  R.$("#gradeForm").innerHTML = `<div class="note">${req.grade.description || ""}</div><div class="formgrid">${num("grade.C_max_ppm", "C max", "ppm", 0.1, 0)}${num("grade.N_max_ppm", "N max", "ppm", 0.1, 0)}${num("grade.H_max_ppm", "H max", "ppm", 0.01, 0)}
    ${num("grade.O_diss_max_after_deox_ppm", "O after deox max", "ppm", 0.1, 0)}${num("grade.Al_min_wtpct", "Al min", "wt%", 0.001, 0)}${num("grade.Al_max_wtpct", "Al max", "wt%", 0.001, 0)}
    ${num("grade.T_end_min_K", "T RH-end min", "K", 0.5)}${num("grade.T_end_max_K", "T RH-end max", "K", 0.5)}${num("grade.caster_superheat_target_K", "Superheat target", "K", 0.5)}
    ${num("grade.transfer_to_caster_s", "Transfer to caster", "s", 1, 0)}${num("grade.max_treatment_time_s", "Max treatment", "s", 1, 300)}${num("grade.total_oxygen_max_ppm", "T.O. indicator max", "ppm", 0.5, 0)}${chk("grade.rh_ob_suitable", "O₂ blowing permitted")}</div>`;
  const L = "plant.limits", V = "plant.vacuum";
  R.$("#plantForm").innerHTML = `<div class="formgrid">${chk("plant.chemical_heating_enabled", "Chemical heating enabled")}${chk(L + ".oxygen_safety_prerequisites_confirmed", "O₂ prerequisites confirmed (SIMULATED)")}
    ${num(L + ".argon_min_NL_min", "Ar min", "NL/min", 1, 0)}${num(L + ".argon_max_NL_min", "Ar max", "NL/min", 1, 100)}${num(L + ".oxygen_max_Nm3_h", "O₂ max", "Nm³/h", 1, 0)}${num(L + ".oxygen_max_total_Nm3", "O₂ per heat max", "Nm³", 1, 0)}
    ${num(L + ".oxygen_min_vessel_depth_m", "Min vessel bath for O₂", "m", 0.01, 0.05, 1)}${num(L + ".oxygen_max_vessel_pressure_Pa", "O₂ permitted below", "Pa(a)", 100, 1000)}${num(L + ".max_treatment_time_s", "Max RH occupancy", "s", 1, 300)}
    ${num(L + ".temperature_min_K", "T low alarm", "K", 1)}${num(L + ".temperature_max_K", "T high alarm", "K", 1)}${num("plant.atmospheric_pressure_Pa", "Barometric P", "Pa(a)", 10, 85000, 106000)}
    ${num(V + ".pump_health", "Pump health factor", "-", 0.01, 0, 1.2)}${num(V + ".air_leak_kg_h", "Air leak", "kg/h", 1, 0, 500)}${sel(V + ".vent_gas", "Vacuum-break gas", ["N2", "Ar", "air"])}${num(V + ".suction_temperature_K", "Suction gas T", "K", 1, 280, 450)}</div>
    <details><summary>Ejector capacity curve (Pa abs → kg/h air-eq.)</summary><div class="small mono">${req.plant.vacuum.pump_curve.map((c) => `${c[0]} Pa → ${c[1].toFixed(0)} kg/h`).join("<br>")}</div></details>`;
  const G = "plant.geometry";
  R.$("#geoForm").innerHTML = `<div class="formgrid">${num(G + ".capacity_t", "Ladle capacity", "t", 1, 60, 420)}${num(G + ".ladle_inner_diameter_m", "Ladle inner Ø", "m", 0.01, 2, 5)}${num(G + ".ladle_freeboard_m", "Freeboard", "m", 0.01, 0.1, 1.5)}
    ${num(G + ".snorkel_inner_diameter_m", "Snorkel inner Ø", "m", 0.01, 0.3, 1)}${num(G + ".snorkel_length_m", "Snorkel length", "m", 0.01, 0.8, 2.5)}${num(G + ".snorkel_wall_thickness_m", "Snorkel wall", "m", 0.01, 0.1, 0.45)}
    ${num(G + ".immersion_depth_m", "Immersion depth", "m", 0.01, 0.2, 0.9)}${num(G + ".lift_nozzle_count", "Ar nozzles", "-", 1, 2, 24)}${num(G + ".lift_nozzle_height_above_tip_m", "Nozzle height", "m", 0.01, 0.05, 0.6)}
    ${num(G + ".vessel_inner_diameter_m", "Vessel inner Ø", "m", 0.01, 1.6, 3.8)}${num(G + ".vessel_lower_height_m", "Lower vessel H", "m", 0.1, 1.5, 4)}${num(G + ".vessel_height_m", "Vessel internal H", "m", 0.1, 6, 14)}
    ${num(G + ".duct_and_cooler_volume_m3", "Duct+cooler volume", "m³", 1, 10, 300)}${num(G + ".oxygen_tuyere_count", "O₂ tuyeres", "-", 1, 0, 8)}${num(G + ".oxygen_tuyere_height_above_bottom_m", "Tuyere height", "m", 0.01, 0.05, 0.6)}</div>`;
  renderRefr(); renderKin(); renderAdds(); renderSched(); derived();
  ["#heatForm", "#gradeForm", "#plantForm", "#geoForm", "#kinForm"].forEach((id) => bind(R.$(id)));
  R.$("#variant").value = req.plant.variant; R.$("#mode").value = req.mode;
}
function renderRefr() {
  const G = req.plant.geometry, names = Object.keys(refr);
  const block = (key, title) => {
    const layers = G[key];
    const Rsum = layers.reduce((a, l) => a + l.thickness_m / (refr[l.material] || { k: 1 }).k, 0);
    const q = (1600 - 250) / (Rsum + 1 / 25);
    return `<fieldset><legend>${title}</legend><table class="t"><thead><tr><th>#</th><th>Material</th><th>Thickness (m)</th><th>k W/mK</th><th>ρ kg/m³</th><th>c_p J/kgK</th><th></th></tr></thead><tbody>
      ${layers.map((l, i) => `<tr><td>${i + 1}${i === 0 ? " (hot)" : i === layers.length - 1 ? " (shell)" : ""}</td><td><select data-ref="${key}" data-i="${i}" data-f="material">${names.map((n) => `<option ${n === l.material ? "selected" : ""}>${n}</option>`).join("")}</select></td>
      <td><input type="number" step="0.005" min="0.002" max="0.6" data-ref="${key}" data-i="${i}" data-f="thickness_m" value="${l.thickness_m}"></td><td class="num">${refr[l.material]?.k}</td><td class="num">${refr[l.material]?.rho}</td><td class="num">${refr[l.material]?.cp}</td>
      <td><button class="btn sm" data-del="${key}" data-i="${i}">✕</button></td></tr>`).join("")}</tbody></table>
      <button class="btn sm" data-add="${key}">+ layer</button> <span class="note">Σδ = ${layers.reduce((a, l) => a + l.thickness_m, 0).toFixed(3)} m · R = ${Rsum.toFixed(3)} m²K/W · steady flux estimate (1600 °C hot face) ≈ ${(q / 1000).toFixed(1)} kW/m²</span></fieldset>`;
  };
  R.$("#refForm").innerHTML = block("ladle_wall_layers", "Ladle wall & bottom") + block("vessel_wall_layers", "Lower vessel + snorkels") + block("upper_vessel_wall_layers", "Upper vessel");
  R.$("#refForm").querySelectorAll("[data-ref]").forEach((el) => (el.onchange = () => { const L = G[el.dataset.ref][+el.dataset.i]; L[el.dataset.f] = el.dataset.f === "material" ? el.value : +el.value; renderRefr(); }));
  R.$("#refForm").querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => { G[b.dataset.del].splice(+b.dataset.i, 1); renderRefr(); }));
  R.$("#refForm").querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => { const a = G[b.dataset.add]; a.splice(a.length - 1, 0, { material: "Insulating board", thickness_m: 0.02 }); renderRefr(); }));
}
function renderKin() {
  const K = "plant.kinetics", T = "plant.thermal";
  R.$("#kinForm").innerHTML = `<fieldset><legend>Thermal state & heat transfer</legend><div class="formgrid">${num(T + ".ladle_hot_face_initial_K", "Ladle hot face at arrival", "K", 1, 900, 1873)}${num(T + ".ladle_shell_initial_K", "Ladle shell", "K", 1, 300, 800)}
    ${num(T + ".vessel_preheat_K", "Vessel preheat", "K", 1, 800, 1773)}${num(T + ".slag_thickness_m", "Slag thickness", "m", 0.01, 0, 0.4)}${num(T + ".h_steel_ladle_wall_W_m2K", "h steel→ladle wall", "W/m²K", 10)}
    ${num(T + ".h_steel_vessel_wall_W_m2K", "h steel→vessel wall", "W/m²K", 10)}${num(T + ".emissivity_steel", "ε steel", "-", 0.01, 0.05, 0.95)}${num(T + ".emissivity_slag", "ε slag", "-", 0.01, 0.1, 1)}
    ${num(T + ".view_factor_ladle_top", "View factor ladle top", "-", 0.01, 0, 1)}${num(T + ".ambient_temperature_K", "Ambient", "K", 1, 250, 340)}${num(T + ".h_shell_convection_W_m2K", "h shell", "W/m²K", 1, 2, 60)}</div></fieldset>
    <fieldset><legend>Kinetics & calibration (ProcessEngineer)</legend><div class="formgrid">${sel(K + ".circulation_model", "Circulation model", ["kuwabara", "energy_balance"])}${num(K + ".circulation_multiplier", "Circulation factor c_Q", "-", 0.01, 0.3, 2)}
    ${num(K + ".lift_nozzle_fouling", "Nozzle fouling θ", "-", 0.01, 0, 1)}${num(K + ".k_C_surface_m_s", "k_C surface", "m/s", 0.0001, 0.00001, 0.005)}${num(K + ".splash_enhancement_max", "Max surface factor", "-", 0.5, 1, 30)}
    ${num(K + ".bubble_equilibrium_approach", "Bubble ε", "-", 0.01, 0, 1)}${num(K + ".k_H_m_s", "k_H", "m/s", 0.0001)}${num(K + ".k_N_m_s", "k_N", "m/s", 0.0001)}${num(K + ".k_r0_N_mol_m2_s_atm", "k_r0 (N₂)", "mol/m²s·atm", 0.01)}
    ${num(K + ".jet_mass_transfer_capacity_m3_s", "Jet kA", "m³/s", 0.01, 0, 2)}${num(K + ".o2_absorption_lambda", "O₂ absorption λ", "1/m", 0.1, 0.1, 30)}${num(K + ".post_combustion_fraction", "Post-combustion", "-", 0.01, 0, 1)}
    ${num(K + ".deox_rate_1_s", "Deox rate", "1/s", 0.001, 0.001, 1)}${num(K + ".dead_zone_fraction", "Slow-zone fraction", "-", 0.01, 0, 0.5)}${chk(K + ".three_zone", "Three-zone ladle")}</div></fieldset>`;
}
function renderAdds() {
  const A = req.schedule.additions, names = Object.keys(mats);
  R.$("#addForm").innerHTML = `<div class="tblwrap"><table class="t"><thead><tr><th>t (s)</th><th>Material</th><th>Mass (kg)</th><th>Purpose</th><th>Auto Al target (ppm)</th><th></th></tr></thead><tbody>${A.map((a, i) => `<tr>
    <td><input type="number" data-a="${i}" data-f="t_s" value="${a.t_s}" min="0"></td><td><select data-a="${i}" data-f="material">${names.map((n) => `<option ${n === a.material ? "selected" : ""}>${n}</option>`).join("")}</select></td>
    <td><input type="number" data-a="${i}" data-f="mass_kg" value="${a.mass_kg}" min="0" max="20000"></td><td><input type="text" data-a="${i}" data-f="purpose" value="${a.purpose}"></td>
    <td><input type="number" data-a="${i}" data-f="auto_target_Al_ppm" value="${a.auto_target_Al_ppm ?? ""}" placeholder="off"></td><td><button class="btn sm" data-adel="${i}">✕</button></td></tr>`).join("")}</tbody></table></div>
    <button class="btn sm" id="addAdd">+ addition</button><div class="note">Auto Al target: the deoxidizer mass is computed at addition time from the O-probe reading (yield-corrected).</div>`;
  R.$("#addForm").querySelectorAll("[data-a]").forEach((el) => (el.onchange = () => { const a = A[+el.dataset.a]; const f = el.dataset.f; a[f] = f === "material" || f === "purpose" ? el.value : el.value === "" ? null : +el.value; }));
  R.$("#addForm").querySelectorAll("[data-adel]").forEach((b) => (b.onclick = () => { A.splice(+b.dataset.adel, 1); renderAdds(); }));
  R.$("#addAdd").onclick = () => { A.push({ t_s: 1200, material: "LC_FeMn", mass_kg: 100, purpose: "trim", yield_override: null, auto_target_Al_ppm: null }); renderAdds(); };
}
const STAGES = ["ARRIVAL_CHECKS", "IMMERSION", "PUMP_DOWN", "NATURAL_DECARB", "OB_DECARB", "DEEP_VACUUM", "DEOXIDATION", "CHEMICAL_HEATING", "ALLOYING", "HOMOGENIZATION", "FINAL_SAMPLING", "VACUUM_BREAK", "DISPATCH"];
function renderSched() {
  const P = req.schedule.phases;
  let t = 0;
  const tot = P.reduce((a, p) => a + p.duration_s, 0);
  R.$("#schedBar").innerHTML = P.map((p) => `<div style="width:${(100 * p.duration_s) / tot}%;background:${R.STAGE_COLORS[p.stage]}" title="${p.stage}">${p.duration_s / tot > 0.06 ? p.stage.replace(/_/g, " ") : ""}</div>`).join("");
  R.$("#schedForm").innerHTML = `<div class="tblwrap" style="max-height:none"><table class="t"><thead><tr><th>#</th><th>start (min)</th><th>Stage</th><th>Duration (s)</th><th>P set start (Pa a)</th><th>P set end (Pa a)</th><th>Ar (NL/min)</th><th>O₂ (Nm³/h)</th><th>Pumps</th><th>Immersed</th><th>Vent</th><th></th></tr></thead><tbody>
    ${P.map((p, i) => { const s0 = t; t += p.duration_s; return `<tr><td>${i + 1}</td><td class="num">${(s0 / 60).toFixed(1)}</td><td><select data-p="${i}" data-f="stage">${STAGES.map((s) => `<option ${s === p.stage ? "selected" : ""}>${s}</option>`).join("")}</select></td>
      <td><input type="number" data-p="${i}" data-f="duration_s" value="${p.duration_s}" min="0" max="7200"></td><td><input type="number" data-p="${i}" data-f="pressure_setpoint_Pa" value="${p.pressure_setpoint_Pa}" min="10" max="110000"></td>
      <td><input type="number" data-p="${i}" data-f="pressure_setpoint_end_Pa" value="${p.pressure_setpoint_end_Pa ?? p.pressure_setpoint_Pa}" min="10" max="110000"></td><td><input type="number" data-p="${i}" data-f="argon_NL_min" value="${p.argon_NL_min}" min="0" max="20000"></td>
      <td><input type="number" data-p="${i}" data-f="oxygen_Nm3_h" value="${p.oxygen_Nm3_h}" min="0" max="10000"></td><td><input type="checkbox" data-p="${i}" data-f="vacuum_pump_on" ${p.vacuum_pump_on ? "checked" : ""}></td>
      <td><input type="checkbox" data-p="${i}" data-f="snorkels_immersed" ${p.snorkels_immersed ? "checked" : ""}></td><td><input type="checkbox" data-p="${i}" data-f="vent" ${p.vent ? "checked" : ""}></td>
      <td><button class="btn sm" data-up="${i}">↑</button><button class="btn sm" data-pdel="${i}">✕</button></td></tr>`; }).join("")}</tbody></table></div>
    <button class="btn sm" id="phAdd">+ phase</button> <span class="note">Total ${(tot / 60).toFixed(1)} min · O₂ scheduled ${P.reduce((a, p) => a + (p.oxygen_Nm3_h * p.duration_s) / 3600, 0).toFixed(0)} Nm³. Transitions are validated against the configured state machine; guards (e.g. O₂ permissives) are re-checked at run time.</span>`;
  R.$("#schedForm").querySelectorAll("[data-p]").forEach((el) => (el.onchange = () => { const p = P[+el.dataset.p]; const f = el.dataset.f; p[f] = el.type === "checkbox" ? el.checked : f === "stage" ? el.value : +el.value; renderSched(); }));
  R.$("#schedForm").querySelectorAll("[data-pdel]").forEach((b) => (b.onclick = () => { P.splice(+b.dataset.pdel, 1); renderSched(); }));
  R.$("#schedForm").querySelectorAll("[data-up]").forEach((b) => (b.onclick = () => { const i = +b.dataset.up; if (i > 0) { [P[i - 1], P[i]] = [P[i], P[i - 1]]; renderSched(); } }));
  R.$("#phAdd").onclick = () => { P.splice(P.length - 2, 0, { stage: "HOMOGENIZATION", duration_s: 120, pressure_setpoint_Pa: 100, pressure_setpoint_end_Pa: 100, argon_NL_min: 2000, oxygen_Nm3_h: 0, oxygen_ramp_s: 20, vacuum_pump_on: true, snorkels_immersed: true, vent: false, note: "" }); renderSched(); };
}
function derived() {
  const g = req.plant.geometry, M = req.heat.steel_mass_t * 1000;
  const A = (Math.PI * g.ladle_inner_diameter_m ** 2) / 4, H = M / 7000 / A, hvb = g.snorkel_length_m - g.immersion_depth_m;
  const hb = (req.plant.atmospheric_pressure_Pa - 100) / (7000 * 9.80665);
  R.$("#geoDerived").innerHTML = `Derived: ladle bath depth <b>${H.toFixed(2)} m</b> · vessel bottom above ladle level <b>${hvb.toFixed(2)} m</b> · barometric lift at 100 Pa <b>${hb.toFixed(3)} m</b> ·
    expected vessel bath ≈ <b>${Math.max(hb - hvb - 0.25, 0).toFixed(2)} m</b> (after ~0.25 m ladle level drop) · snorkel area ${(Math.PI * g.snorkel_inner_diameter_m ** 2 / 4).toFixed(3)} m² · vessel volume ${(Math.PI * g.vessel_inner_diameter_m ** 2 / 4 * g.vessel_height_m).toFixed(0)} m³`;
}
async function loadTemplate(name) {
  req = await R.api(`api/v1/config/scenarios/${name}`);
  renderAll(); R.toast(`Template ${name} loaded into the editor`, "ok");
}
async function init() {
  const sc = await R.api("api/v1/config/scenarios");
  R.$("#tplScenario").innerHTML = Object.keys(sc).map((k) => `<option>${k}</option>`).join("");
  R.$("#tplScenario").value = "S2_RHOB_OXYGEN_ASSISTED";
  grades = (await R.api("api/v1/config/grades")).grades; refr = await R.api("api/v1/config/refractories"); mats = await R.api("api/v1/config/materials");
  await loadTemplate("S2_RHOB_OXYGEN_ASSISTED");
}
R.$("#loadTpl").onclick = () => loadTemplate(R.$("#tplScenario").value);
R.$("#variant").onchange = (e) => (req.plant.variant = e.target.value);
R.$("#mode").onchange = (e) => (req.mode = e.target.value);
R.$("#applyPreset").onclick = async () => {
  const cap = R.$("#capacity").value; if (!cap) return;
  const p = (await R.api("api/v1/config/plant", { params: { capacity_t: cap } })).plant;
  const keepLayers = { ladle_wall_layers: req.plant.geometry.ladle_wall_layers, vessel_wall_layers: req.plant.geometry.vessel_wall_layers, upper_vessel_wall_layers: req.plant.geometry.upper_vessel_wall_layers };
  Object.assign(req.plant.geometry, p.geometry, keepLayers);
  req.plant.vacuum.pump_curve = p.vacuum.pump_curve; req.plant.limits.oxygen_max_Nm3_h = p.limits.oxygen_max_Nm3_h; req.plant.limits.argon_max_NL_min = p.limits.argon_max_NL_min;
  req.heat.steel_mass_t = +cap;
  const arN = Math.min(p.limits.argon_max_NL_min, 8.3 * cap);
  req.schedule.phases.forEach((ph) => { if (["NATURAL_DECARB", "OB_DECARB", "DEEP_VACUUM", "DEOXIDATION", "ALLOYING", "CHEMICAL_HEATING"].includes(ph.stage)) ph.argon_NL_min = Math.round(arN); if (ph.oxygen_Nm3_h > p.limits.oxygen_max_Nm3_h) ph.oxygen_Nm3_h = p.limits.oxygen_max_Nm3_h; });
  R.$("#presetNote").textContent = `Applied ${cap} t preset: geometry, ejector curve (scaled), O₂/Ar limits, lift-gas schedule; refractory layers kept.`;
  renderAll();
};
R.$("#exportReq").onclick = () => R.download(JSON.stringify(req, null, 2), `${req.heat.heat_id}_request.json`);
R.$("#importReq").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { req = JSON.parse(await f.text()); renderAll(); R.toast("request imported", "ok"); } catch (x) { R.toast("invalid JSON: " + x.message, "err"); } };
async function validate() {
  const v = await R.api("api/v1/simulations/validate", { method: "POST", body: req });
  R.$("#issues").innerHTML = (v.issues.length ? v.issues : [{ severity: "ok", message: "no issues" }]).map((i) => `<li class="${i.severity}">${i.severity.toUpperCase()}: ${i.message}</li>`).join("");
  return v;
}
R.$("#validate").onclick = async () => { try { const v = await validate(); R.toast(v.valid ? "inputs valid" : "inputs INVALID", v.valid ? "ok" : "err"); } catch (e) { R.$("#issues").innerHTML = `<li class="error">${e.message}</li>`; R.toast(e.message, "err"); } };
async function create(run) {
  try { const v = await validate(); if (!v.valid) return R.toast("fix validation errors first", "err");
    R.toast(run ? "creating and integrating heat…" : "creating heat…");
    await R.createFromRequest(req, run); R.toast(`created ${R.state.sim}`, "ok"); }
  catch (e) { R.$("#issues").innerHTML += `<li class="error">${e.message}</li>`; R.toast(e.message, "err"); }
}
R.$("#createRun").onclick = () => create(true);
R.$("#createStep").onclick = () => create(false);
init();
