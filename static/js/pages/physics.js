// 05 Model equations, energy & element ledgers, closure, thermochemistry
const R = window.RHOB, C = R.C;
let led = null, ledSim = null, ledVer = null;
const SRC = ["rxn_O2_to_O", "rxn_C_O_CO", "rxn_Al2O3", "rxn_SiO2", "rxn_MnO", "rxn_TiO2", "rxn_FeO_form", "rxn_FeO_diss", "rxn_solution", "rxn_degas_HN", "rxn_slag_reox", "pc_to_bath"];
const SNK = ["gas_sensible_out", "loss_ladle_shell", "loss_vlow_shell", "loss_vup_shell", "loss_slag_top"];
const INT = ["int_to_ladle_wall", "int_to_vlow_wall", "int_to_vup_wall", "int_steel_to_slag"];
R.onData(async (s, recs) => {
  if (ledSim !== s.simulation_id || ledVer !== s.version) { led = await R.api(`api/v1/simulations/${s.simulation_id}/ledger`); ledSim = s.simulation_id; ledVer = s.version; }
  C.ts("pLed", recs, [...SRC.map((k) => ({ key: `E_${k}_MJ`, name: "+ " + k.replace("rxn_", "") })), ...SNK.map((k) => ({ fn: (r) => -(r[`E_${k}_MJ`] || 0), name: "− " + k })),
    { key: "E_stored_change_MJ", name: "Δ stored (steel+slag+walls)", width: 3, color: "#ffffff", dash: "dash" }], { yTitle: "MJ (cumulative)" });
  C.ts("pRate", recs, [...SRC.map((k) => ({ fn: (r) => (r[`Q_${k}_W`] || 0) / 1e6, name: k.replace("rxn_", "") })), ...SNK.map((k) => ({ fn: (r) => -(r[`Q_${k}_W`] || 0) / 1e6, name: "− " + k })),
    ...INT.map((k) => ({ fn: (r) => -(r[`Q_${k}_W`] || 0) / 1e6, name: "→ " + k.replace("int_", ""), dash: "dot" }))], { yTitle: "MW (+ into steel, − out)" });
  C.ts("pClos", recs, [{ key: "mass_balance_relative_error", name: "elements (worst)" }, { key: "energy_balance_relative_error", name: "energy" }, { fn: (r) => Math.abs(r.argon_balance_residual_mol || 0) / 1e4 + 1e-18, name: "argon |res|/1e4 mol" }], { yTitle: "relative residual", ylog: true });
  const e = R.rhEnd(recs);
  const lab = [...SRC, ...SNK];
  C.bar("pTot", lab.map((k) => k.replace("rxn_", "")), [{ name: "MJ to RH end", y: lab.map((k) => (SNK.includes(k) ? -1 : 1) * (e[`E_${k}_MJ`] || 0)), unit: "MJ" }], { h: true, yTitle: "MJ (+ source, − sink)" });
  const L = led.element_ledger_kg;
  const els = ["Fe", "C", "O", "H", "N", "Al", "Si", "Mn", "Ti", "S", "P", "Cr", "Ni", "Nb", "V", "Cu", "Mo", "Ca", "Mg"];
  const rows = Object.entries(L).map(([res, d]) => ({ reservoir: res, ...Object.fromEntries(els.map((x) => [x, d[x]])) }));
  const inv = {}; Object.entries(L).forEach(([res, d]) => { if (!res.startsWith("INPUT") && !res.startsWith("INITIAL")) els.forEach((x) => (inv[x] = (inv[x] || 0) + d[x])); });
  rows.push({ reservoir: "Σ inventory", ...inv });
  rows.push({ reservoir: "RESIDUAL (Σ inv − initial − inputs)", ...Object.fromEntries(els.map((x) => [x, inv[x] - L["INITIAL inventory"][x] - L["INPUT: gases (O2, leak, vent)"][x] - L["INPUT: additions charged"][x]])) });
  R.table(R.$("#elLed"), rows, [{ k: "reservoir", h: "Reservoir" }, ...els.map((x) => ({ k: x, h: x, d: 4 }))], { name: "element_ledger", maxH: 520 });
  const T = R.last().T_bulk_K || 1873;
  const th = await R.api("api/v1/config/thermo", { params: { T } });
  R.table(R.$("#thermo"), Object.entries(th.reactions).map(([k, v]) => ({ reaction: k, log10K: v.log10K, dG_kJ: v.dG_J_per_mol / 1e3, dH_kJ: v.dH_J_per_mol / 1e3, A: v.A, B: v.B, source: v.source })), null, { name: "thermo", maxH: 300 });
  R.table(R.$("#layout"), led.state_layout.map((b) => ({ block: b.name, start: b.start, size: b.size })).concat([{ block: "SOLVER: segments / nfev / njev / LU", start: s.solver_stats.segments, size: `${s.solver_stats.nfev} / ${s.solver_stats.njev} / ${s.solver_stats.nlu}` }]),
    [{ k: "block", h: "State block" }, { k: "start", h: "index", d: 0 }, { k: "size", h: "size", d: 0 }], { name: "state_layout", maxH: 300 });
});
R.$("#eqs").innerHTML = [
  ["Two/three-zone species balance [6.1]", "d(M_l w_i,l)/dt = q_c (w_i,v − w_i,l) − q_h w_i,donor + q_ex (w_i,d − w_i,l) + R_i,l\nd(M_v w_i,v)/dt = q_c (w_i,l − w_i,v) + q_h w_i,donor + ṁ_i,add + R_i,v   (R includes all reaction sinks/sources; gas stoichiometry once)"],
  ["Hold-up (barometric) [6.1b]", "h_b = (P_atm − P_v)/(ρ g);  M_v,eq = ρ[2A_sn(h_imm + min(h_b,h_vb)) + A_v max(h_b − h_vb, 0)];  dM_v/dt = (M_v,eq − M_v)/τ_h  (ladle level drop iterated)"],
  ["Circulation (Kuwabara 1988) [6.2]", "Q[t/min] = 11.4 G^(1/3) D^(4/3) [ln(P1/Pv)]^(1/3) · θ_fouling · c_Q ;  saturation Q/(1+(Q/Q_max)^4)^(1/4) ;  alt.: η n_g R T ln(P1/Pv) = ½ ζ ρ u² Q/ρ"],
  ["C–O equilibrium [6.3]", "log K = 1160/T + 2.003,  K = p_CO/(f_C[C] f_O[O]);  2Al+3O=Al₂O₃ ΔG° = −1 202 000 + 386.3 T;  Wagner: log f_i = Σ e_i^j [j]"],
  ["Mixed-control decarburization (all sites) [6.4]", "k_C(C − C_i) = (M_C/M_O) k_O(O − O_i),  C_i·O_i = p_CO,i/(K f_C f_O)  ⇒ quadratic for C_i;  r = ρ k_C A (C − C_i)/100 ≥ 0, → 0 at equilibrium\nsites: free surface (A·splash factor), in-bath CO nucleation (z* where p_eq > P_v + ρgz + ΔP_nuc), Ar bubbles (ε n_Ar p_eq/(P_b − Σp_eq))"],
  ["RH-OB oxygen [6.5]", "η_abs = 1 − exp(−λ h_sub);  jet: O to Al > Ti > Si > C (transport-limited), Mn vs Fe by K_MnFe[Mn], rest → FeO pool;  FeO → Fe + [O] at k(1 − O/O_sat);  slip O₂ → post-combustion / off-gas"],
  ["H & N [6.6]", "[%H]_eq = 10^(−1905/T − 1.591) √p_H2 / f_H ;  J_H = ρ k_H A (H − H_eq)\nJ_N2 = k_r (p_N2,i − p_N2,gas),  k_r = k_r0/(1 + K_O a_O + K_S a_S)² ;  series with liquid mass transfer (quadratic)"],
  ["Vacuum gas [6.7]", "dn_i/dt = ṅ_gen + ṅ_inj + ṅ_leak − x_i ṅ_exh ;  P = n R/(V_free/T_g + V_duct/T_duct) ;  ṅ_exh = W_air(P)/M_air √(M_air/M) · health · ½[1 + tanh((P − P_sp)/(β P_sp + 5))]"],
  ["Energy [6.8]", "dH_z/dt = Σ ṁh (transport) + Σ(−ΔH_r) r − Σ ṅ c_p (T − 298) − q_wall − q_slag ;  walls: ρc_p V dT_k/dt = G(T_{k−1} − T_k) − G(T_k − T_{k+1}) ;  shell: h(T−T_a) + εσ(T⁴ − T_a⁴)\nclosure: E_stored(t) − E_stored(0) = Σ sources − Σ sinks  (checked every record; run FAILS if residual > tolerance)"],
  ["Numerics [7]", "scipy.integrate.solve_ivp(method='BDF', rtol=1e-6, per-state atol, max_step ≤ 10 s); segments split at phases/additions/samples; no clipping (negativity logged)"],
].map(([h, e]) => `<details open><summary>${h}</summary><div class="eq">${e}</div></details>`).join("");
