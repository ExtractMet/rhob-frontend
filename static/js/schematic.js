/* 2D process schematic (P&ID-style SVG) of the complete RH-OB station with live values.
   Also the WebGL-free fallback of the 3D view. All numbers come from the selected state packet. */
(function () {
  const R = window.RHOB;
  function tcol(K) {
    const t = Math.min(Math.max(((K || 1850) - 1700) / 250, 0), 1);
    const r = Math.round(255 * Math.min(0.45 + 0.9 * t, 1)), g = Math.round(255 * (t < 0.6 ? 0.06 + 0.45 * t : Math.min(0.33 + 1.2 * (t - 0.6), 1))), b = Math.round(255 * (t < 0.6 ? 0.02 : 0.05 + 1.6 * (t - 0.6)));
    return `rgb(${r},${g},${b})`;
  }
  const f = (v, d = 1) => (v == null || Number.isNaN(v) || v < -200 ? "—" : Number(v).toFixed(d));
  const fc = (K, d = 1) => (K == null ? "—" : (K - 273.15).toFixed(d));
  function tag(x, y, id, label, val, unit, cls = "") {
    return `<g transform="translate(${x},${y})" class="tagbox ${cls}"><rect width="128" height="38" rx="4" fill="var(--panel2)" stroke="var(--line2)"/>
      <text x="6" y="13" font-size="9.5" fill="var(--muted)">${id} · ${label}</text>
      <text x="6" y="31" font-size="15" font-weight="600" fill="var(--text)" font-family="monospace">${val}<tspan font-size="10" fill="var(--muted)"> ${unit}</tspan></text></g>`;
  }
  function inst(x, y, code) { return `<g><circle cx="${x}" cy="${y}" r="13" fill="var(--panel)" stroke="var(--cyan)"/><text x="${x}" y="${y + 3.5}" font-size="9" text-anchor="middle" fill="var(--cyan)">${code}</text></g>`; }

  R.schematic = function (el, geo, s, opts = {}) {
    if (!el || !s) return;
    const W = 1240, Hh = 640;
    const level = 430, ladTop = 330, ladBot = 600, ladL = 120, ladR = 470;
    const drop = (s.ladle_level_drop_m || 0) * 60;
    const lv = level + drop;
    const vesBot = 255, vesTop = 40, vesL = 210, vesR = 380;
    const vdepth = Math.min((s.vessel_depth_m || 0) * 110, 90);
    const lifted = (s.M_v_kg || 0) > 100 && vdepth > 1;
    const upX = 250, dnX = 340, snW = 30;
    const steel = tcol(s.T_l_K || s.T_bulk_K), vsteel = tcol(s.T_v_K || s.T_bulk_K);
    const o2on = (s.oxygen_Nm3_h || 0) > 0;
    const circ = s.q_circ_t_min || 0;
    const anim = circ > 1 ? `<animate attributeName="stroke-dashoffset" from="40" to="0" dur="${Math.max(0.4, 120 / circ)}s" repeatCount="indefinite"/>` : "";
    const bubbles = Array.from({ length: Math.min(Math.round((s.argon_NL_min || 0) / 180), 18) }, (_, i) => {
      const y0 = lv + 70, y1 = lifted ? vesBot - vdepth : lv;
      return `<circle cx="${upX + ((i * 7) % 18) - 9}" cy="${y0}" r="${2 + (i % 3)}" fill="#bfefff" opacity=".8"><animate attributeName="cy" from="${y0}" to="${y1}" dur="${1.2 + (i % 5) * 0.25}s" begin="${i * 0.13}s" repeatCount="indefinite"/></circle>`;
    }).join("");
    const svg = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="RH-OB process schematic">
      <defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--amber)"/></marker>
      <marker id="ahc" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--cyan)"/></marker>
      <pattern id="brick" width="14" height="8" patternUnits="userSpaceOnUse"><rect width="14" height="8" fill="#7d533a"/><path d="M0 0H14M0 4H14M7 0V4M0 4V8" stroke="#5e3b28" stroke-width=".8"/></pattern></defs>
      <rect x="0" y="0" width="${W}" height="${Hh}" fill="none"/>
      <!-- ladle -->
      <path d="M${ladL - 22} ${ladTop} L${ladR + 22} ${ladTop} L${ladR + 6} ${ladBot + 20} L${ladL - 6} ${ladBot + 20} Z" fill="url(#brick)" stroke="var(--metal)" stroke-width="3"/>
      <path d="M${ladL} ${lv} L${ladR} ${lv} L${ladR - 12} ${ladBot} L${ladL + 12} ${ladBot} Z" fill="${steel}"/>
      <rect x="${ladL}" y="${lv - 10}" width="${ladR - ladL}" height="10" fill="#4a443c"/>
      <text x="${ladL + 8}" y="${ladBot - 12}" font-size="12" fill="#fff" font-weight="600">LADLE ${f(geo.capacity_t, 0)} t · ${f((s.T_l_K || 0) - 273.15, 1)} °C</text>
      <text x="${ladL + 8}" y="${lv - 14}" font-size="10" fill="var(--muted)">slag · level drop ${f((s.ladle_level_drop_m || 0) * 1000, 0)} mm</text>
      <!-- snorkels -->
      <rect x="${upX - snW / 2 - 9}" y="${vesBot}" width="${snW + 18}" height="${lv + 70 - vesBot}" fill="url(#brick)"/>
      <rect x="${dnX - snW / 2 - 9}" y="${vesBot}" width="${snW + 18}" height="${lv + 70 - vesBot}" fill="url(#brick)"/>
      <rect x="${upX - snW / 2}" y="${lifted ? vesBot : lv}" width="${snW}" height="${lv + 70 - (lifted ? vesBot : lv)}" fill="${steel}"/>
      <rect x="${dnX - snW / 2}" y="${lifted ? vesBot : lv}" width="${snW}" height="${lv + 70 - (lifted ? vesBot : lv)}" fill="${steel}"/>
      ${bubbles}
      <line x1="${upX}" y1="${lv + 100}" x2="${upX}" y2="${lv + 74}" stroke="var(--amber)" stroke-width="3" marker-end="url(#ah)"/>
      <line x1="${dnX}" y1="${lv + 74}" x2="${dnX}" y2="${lv + 104}" stroke="var(--amber)" stroke-width="3" marker-end="url(#ah)"/>
      <path d="M${upX} ${lv + 60} L${upX} ${vesBot - vdepth / 2} L${dnX} ${vesBot - vdepth / 2} L${dnX} ${lv + 60}" fill="none" stroke="#ffe08a" stroke-width="2" stroke-dasharray="6 10" opacity="${circ > 1 ? 0.9 : 0.2}">${anim}</path>
      <text x="${upX - 60}" y="${lv + 118}" font-size="10.5" fill="var(--amber)">UP-LEG ↑ (Ar lift)</text><text x="${dnX + 6}" y="${lv + 118}" font-size="10.5" fill="var(--amber)">DOWN-LEG ↓</text>
      <!-- argon -->
      <path d="M40 ${lv + 52} L${upX - snW / 2 - 9} ${lv + 52}" stroke="var(--cyan)" stroke-width="3" marker-end="url(#ahc)"/>
      ${inst(70, lv + 52, "FT")}<text x="40" y="${lv + 40}" font-size="10" fill="var(--cyan)">Ar lift gas</text>
      <!-- vessel -->
      <path d="M${vesL - 16} ${vesBot + 14} L${vesL - 16} ${vesTop + 30} Q${(vesL + vesR) / 2} ${vesTop - 22} ${vesR + 16} ${vesTop + 30} L${vesR + 16} ${vesBot + 14} Z" fill="url(#brick)" stroke="var(--metal)" stroke-width="3"/>
      <path d="M${vesL} ${vesBot} L${vesL} ${vesTop + 36} Q${(vesL + vesR) / 2} ${vesTop - 4} ${vesR} ${vesTop + 36} L${vesR} ${vesBot} Z" fill="var(--bg)"/>
      ${lifted ? `<rect x="${vesL}" y="${vesBot - vdepth}" width="${vesR - vesL}" height="${vdepth}" fill="${vsteel}"/>` : ""}
      <text x="${vesL + 8}" y="${vesTop + 70}" font-size="12" fill="var(--text)" font-weight="600">VACUUM VESSEL</text>
      <text x="${vesL + 8}" y="${vesTop + 86}" font-size="10" fill="var(--muted)">freeboard · x_CO ${f(100 * (s.x_CO || 0), 1)} %</text>
      <text x="${vesL + 8}" y="${vesBot - vdepth - 6}" font-size="10" fill="var(--muted)">bath ${f((s.vessel_depth_m || 0) * 1000, 0)} mm · ${fc(s.T_v_K)} °C</text>
      <!-- O2 tuyeres -->
      <path d="M${vesR + 120} ${vesBot - 14} L${vesR + 2} ${vesBot - 14}" stroke="${o2on ? "#ffd27a" : "var(--dim)"}" stroke-width="${o2on ? 4 : 2}" marker-end="url(#ah)"/>
      ${o2on ? `<path d="M${vesR} ${vesBot - 14} l-40 -8 l0 16z" fill="#fff1d6" opacity=".8"><animate attributeName="opacity" values=".4;.95;.4" dur=".6s" repeatCount="indefinite"/></path>` : ""}
      ${inst(vesR + 90, vesBot - 14, "FT")}<text x="${vesR + 40}" y="${vesBot - 26}" font-size="10" fill="${o2on ? "#ffd27a" : "var(--dim)"}">RH-OB O₂ tuyeres ×${geo.tuyere_count}</text>
      <!-- hopper -->
      <path d="M${vesL - 70} ${vesTop - 30} l50 0 l-15 30 l-20 0 z" fill="var(--amber)" opacity=".75"/><line x1="${vesL - 45}" y1="${vesTop}" x2="${vesL + 10}" y2="${vesTop + 30}" stroke="var(--amber)" stroke-width="3"/>
      <text x="${vesL - 98}" y="${vesTop - 36}" font-size="10" fill="var(--amber)">Vacuum alloy hopper</text>
      <!-- off-gas train -->
      <path d="M${vesR + 16} ${vesTop + 50} L560 ${vesTop + 50} L560 120" fill="none" stroke="var(--metal)" stroke-width="12"/>
      ${inst(470, vesTop + 22, "PT")}${inst(510, vesTop + 22, "AT")}
      <rect x="540" y="120" width="60" height="120" rx="6" fill="var(--panel2)" stroke="var(--metal)" stroke-width="2"/><text x="570" y="185" font-size="10" fill="var(--muted)" text-anchor="middle">cooler</text>
      <path d="M600 220 L660 220" stroke="var(--metal)" stroke-width="10"/>
      ${[0, 1, 2, 3, 4].map((k) => `<g><path d="M${660 + k * 92} ${220 + k * 18} l60 -12 l0 24 z" fill="${(s.pump_throttle || 0) > 0.05 ? "#3e6e96" : "#3a4756"}" stroke="var(--steel)"/>
        <text x="${690 + k * 92}" y="${250 + k * 18}" font-size="9.5" fill="var(--muted)" text-anchor="middle">E${k + 1}</text>
        ${k < 4 ? `<rect x="${722 + k * 92}" y="${236 + k * 18}" width="22" height="40" rx="4" fill="var(--panel2)" stroke="var(--metal)"/><path d="M${720 + k * 92} ${220 + k * 18} L${752 + k * 92} ${238 + k * 18}" stroke="var(--metal)" stroke-width="5"/>` : ""}</g>`).join("")}
      <path d="M1128 300 L1150 300 L1150 120" stroke="var(--metal)" stroke-width="8" fill="none"/><text x="1158" y="130" font-size="10" fill="var(--muted)">stack</text>
      <text x="660" y="198" font-size="10.5" fill="var(--steel)">Steam ejectors + condensers (throttle ${f(100 * (s.pump_throttle || 0), 0)} %)</text>
      ${tag(980, 40, "PT101", "Vessel pressure", f((s.P_Pa || 0) / 100, 2), "mbar(a)")}
      ${tag(980, 84, "AT401", "Off-gas CO", f(s.offgas_CO_Nm3_h, 0), "Nm³/h")}
      ${tag(830, 40, "FT201", "Ar lift", f(s.argon_NL_min, 0), "NL/min")}
      ${tag(830, 84, "FT301", "O₂ tuyeres", f(s.oxygen_Nm3_h, 0), "Nm³/h", o2on ? "on" : "")}
      ${tag(680, 40, "QC", "Circulation", f(circ, 0), "t/min")}
      ${tag(680, 84, "t95", "Mixing time", s.mixing_time_95_s ? f(s.mixing_time_95_s, 0) : "—", "s")}
      ${tag(560, 330, "TE501", "Steel T", f((s.T_bulk_K || 0) - 273.15, 1), "°C")}
      ${tag(700, 330, "[C]", "soft-sensed", f(s.C_bulk_ppm, 1), "ppm")}
      ${tag(840, 330, "[O]", "dissolved", f(s.O_bulk_ppm, 1), "ppm")}
      ${tag(980, 330, "[Al]", "soluble", f(s.Al_bulk_ppm, 0), "ppm")}
      ${tag(560, 378, "[H]", "predicted", f(s.H_bulk_ppm, 2), "ppm")}
      ${tag(700, 378, "[N]", "predicted", f(s.N_bulk_ppm, 1), "ppm")}
      ${tag(840, 378, "T.O.", "predicted", f(s.total_O_ppm, 1), "ppm")}
      ${tag(980, 378, "ΔT_sh", "superheat", f(s.superheat_K, 1), "K")}
      ${tag(560, 426, "HF-L", "ladle hot face", f((s.T_ladle_hotface_K || 0) - 273.15, 0), "°C")}
      ${tag(700, 426, "SH-L", "ladle shell", f((s.T_ladle_shell_K || 0) - 273.15, 0), "°C")}
      ${tag(840, 426, "HF-V", "vessel hot face", f((s.T_vlow_hotface_K || 0) - 273.15, 0), "°C")}
      ${tag(980, 426, "STAGE", "process stage", (s.stage || "").slice(0, 13), "")}
      ${inst(ladR + 30, lv + 30, "TE")}<text x="${ladR + 48}" y="${lv + 34}" font-size="10" fill="var(--muted)">dip T / sample / O-probe</text>
      <rect x="${ladL - 40}" y="${ladBot + 22}" width="${ladR - ladL + 80}" height="12" fill="#33393f"/><text x="${ladL - 40}" y="${ladBot + 50}" font-size="10" fill="var(--muted)">hydraulic ladle lift (immersion ${f(geo.immersion, 2)} m)</text>
      <text x="560" y="${Hh - 18}" font-size="10" fill="var(--dim)">Schematic, not to scale. Values: model state (SYNTHETIC) at t = ${f((s.t_s || 0) / 60, 1)} min.</text>
    </svg>`;
    el.innerHTML = svg;
  };
})();
