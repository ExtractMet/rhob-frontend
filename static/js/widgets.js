/* Reusable operator widgets: KPI tiles, endpoint checks, advisory cards, alarms, events. */
(function () {
  const R = window.RHOB;
  const W = (R.W = {});
  const f = R.fmt;

  W.stateTiles = function (el, s, recs) {
    const L = R.last();
    const end = s.endpoint_current_trajectory || {};
    const k = s.kpis || {};
    const chk = (name) => (end.checks || []).find((c) => c.target === name);
    const cls = (name) => { const c = chk(name); return c ? (c.ok ? "ok" : "bad") : "info"; };
    R.tiles(el, [
      { k: "Steel temperature", v: f(R.U("T", L.T_bulk_K), 1), u: R.UL("T"), s: "PREDICTED · ±6 K (95 %)", cls: cls("T_RH_end") },
      { k: "Vessel pressure", v: f(R.U("P", L.P_Pa), 2), u: R.UL("P") + "(a)", s: `set-point ${f(R.U("P", L.P_sp_Pa), 1)}`, cls: "info" },
      { k: "Carbon [C]", v: f(R.U("comp", L.C_bulk_ppm), R.unitSys === "kpa" ? 4 : 1), u: R.UL("comp"), s: `SOFT-SENSED · grade ≤ ${s.grade_id ? f((chk("C") || {}).max, 0) : "—"} ppm`, cls: cls("C") },
      { k: "Dissolved [O]", v: f(R.U("comp", L.O_bulk_ppm), R.unitSys === "kpa" ? 4 : 1), u: R.UL("comp"), s: "PREDICTED", cls: "info" },
      { k: "Hydrogen [H]", v: f(L.H_bulk_ppm, 2), u: "ppm", s: "PREDICTED (Sieverts kinetics)", cls: cls("H") },
      { k: "Nitrogen [N]", v: f(L.N_bulk_ppm, 1), u: "ppm", s: "PREDICTED (2nd order, S/O poisoned)", cls: cls("N") },
      { k: "Soluble [Al]", v: f(R.U("comp", L.Al_bulk_ppm), R.unitSys === "kpa" ? 4 : 0), u: R.UL("comp"), s: "PREDICTED", cls: cls("Al") },
      { k: "Circulation", v: f(L.q_circ_t_min, 0), u: "t/min", s: `u_down ${f(L.u_downleg_m_s, 2)} m/s`, cls: "info" },
      { k: "Mixing time t95", v: L.mixing_time_95_s ? f(L.mixing_time_95_s, 0) : "—", u: "s", s: `recirc. no. ${f(L.recirculation_number, 2)}`, cls: "info" },
      { k: "O₂ blown (cum.)", v: f(R.U("gas", L.cum_O2_Nm3), 1), u: R.unitSys === "si_k" ? "NL·h/min" : "Nm³", s: `now ${f(L.oxygen_Nm3_h, 0)} Nm³/h`, cls: "info" },
      { k: "Argon (cum.)", v: f(L.cum_Ar_Nm3, 1), u: "Nm³", s: `now ${f(R.U("ar", L.argon_NL_min), 0)} ${R.UL("ar")}`, cls: "info" },
      { k: "Total O (pred.)", v: f(L.total_O_ppm, 1), u: "ppm", s: "inclusion model, low confidence", cls: cls("total_O_predicted") },
      { k: "Superheat", v: f(L.superheat_K, 1), u: "K", s: `liquidus ${f(R.U("T", L.liquidus_K), 1)} ${R.UL("T")}`, cls: cls("caster_superheat") },
      { k: "Cost / t (illustr.)", v: f(k.cost_per_t, 0), u: k.currency || "", s: `total ${f(k.cost_total, 0)}`, cls: "info" },
      { k: "Mass closure", v: f(s.mass_balance_relative_error, 0), u: "rel.", s: `worst ${s.closure_worst_element || "—"}`, cls: s.mass_balance_relative_error < 1e-6 ? "ok" : "bad" },
      { k: "Energy closure", v: f(s.energy_balance_relative_error, 0), u: "rel.", s: "stored Δ vs ledger", cls: s.energy_balance_relative_error < 1e-4 ? "ok" : "bad" },
    ]);
  };

  W.endpointTable = function (el, s) {
    const e = s.endpoint_current_trajectory || {};
    if (!e.checks) { el.innerHTML = '<div class="empty">run the heat to evaluate the endpoint</div>'; return; }
    const rows = e.checks.map((c) => ({ target: c.target, value: c.value, min: c.min, max: c.max, unit: c.unit, priority: c.priority, status: c.ok ? "OK" : "NOT MET" }));
    R.table(el, rows, [{ k: "target", h: "Target" }, { k: "value", h: "Value", d: 4 }, { k: "min", h: "Min", d: 4 }, { k: "max", h: "Max", d: 4 }, { k: "unit", h: "Unit" },
      { k: "priority", h: "Class" }, { k: "status", h: "Status", f: (v) => `<span class="badge ${v === "OK" ? "ok" : "bad"}">${v}</span>` }], { name: "endpoint_checks", maxH: 330 });
    if (e.infeasibility_reasons && e.infeasibility_reasons.length) {
      const d = document.createElement("div"); d.className = "note"; d.style.marginTop = "6px";
      d.innerHTML = "<b style='color:var(--red)'>Infeasible:</b> " + e.infeasibility_reasons.map((r) => `${r.target}: ${r.why}`).join("; ");
      el.appendChild(d);
    }
  };

  W.advisories = function (el, cards, simId) {
    if (!cards || !cards.length) { el.innerHTML = '<div class="empty">advisories appear when the heat forecast is complete (Run heat)</div>'; return; }
    el.innerHTML = `<div class="cards">${cards.map((c, i) => `<div class="card ${c.feasible === false ? "infeasible" : "feasible"}">
      <h4>${c.title}</h4>
      <div class="row"><span>Recommended action</span><span>${c.action}</span></div>
      <div class="row"><span>Expected response</span><span>${c.expected_response}</span></div>
      <div class="row"><span>Uncertainty</span><span>${c.uncertainty}</span></div>
      <div class="row"><span>Affected targets</span><span>${(c.affected_targets || []).join(", ") || "—"}</span></div>
      <div class="row"><span>Limiting constraint</span><span>${c.limiting_constraint}</span></div>
      <div class="row"><span>Assumptions</span><span>${c.assumptions}</span></div>
      <div class="row"><span>Actuator authority</span><span>${c.actuator_authority}</span></div>
      <div class="row"><span>Approval</span><span>${c.approval}</span></div>
      <div class="row"><span>Feasible</span><span>${c.feasible ? '<span class="badge ok">yes</span>' : '<span class="badge bad">no</span>'}</span></div>
      <div class="acts"><button class="btn sm go" data-i="${i}" data-d="accepted">Acknowledge &amp; accept</button><button class="btn sm" data-i="${i}" data-d="deferred">Defer</button><button class="btn sm danger" data-i="${i}" data-d="rejected">Reject</button></div>
    </div>`).join("")}</div><div class="note">Advisory only: accepting records the decision in the audit log — no plant command is issued.</div>`;
    el.querySelectorAll("button[data-d]").forEach((b) => (b.onclick = async () => {
      const c = cards[+b.dataset.i];
      const reason = b.dataset.d === "rejected" ? prompt("Reason for rejection (logged):", "") || "" : "";
      try { await R.api("api/v1/advice/decision", { method: "POST", body: { simulation_id: simId, title: c.title, decision: b.dataset.d, reason } }); R.toast(`Decision '${b.dataset.d}' logged`, "ok"); }
      catch (e) { R.toast(e.message, "err"); }
    }));
  };

  W.alarms = function (el, alarms, simId) {
    const rows = (alarms || []).map((a) => ({ t_min: a.t_s / 60, id: a.id, severity: a.severity, name: a.name, message: a.message, response: a.manual_response,
      owner: a.interlock_owner, inhibit: a.inhibit, value: typeof a.value === "number" ? a.value : null, _t: a.t_s }));
    R.table(el, rows, [{ k: "t_min", h: "t (min)", d: 1 }, { k: "id", h: "ID" }, { k: "severity", h: "Severity", f: (v) => `<span class="badge ${v === "alarm" ? "bad" : v === "warning" ? "warn" : ""}">${v}</span>` },
      { k: "name", h: "Hazard" }, { k: "message", h: "Operator message" }, { k: "value", h: "Value", d: 3 }, { k: "response", h: "Manual response" }, { k: "owner", h: "Interlock owner" }, { k: "inhibit", h: "Inhibit rule" },
      { k: "id", h: "Ack", f: (v, r) => `<button class="btn sm" onclick="RHOB.W.ack('${simId}','${v}',${r._t})">ack</button>` }],
    { name: "alarms", rowClass: (r) => "sev-" + r.severity });
  };
  W.ack = async function (sim, id, t) {
    try { await R.api("api/v1/alarms/ack", { method: "POST", body: { simulation_id: sim, hazard_id: id, t_s: t, comment: "acknowledged from operator desk" } }); R.toast(`Alarm ${id} acknowledged (logged)`, "ok"); }
    catch (e) { R.toast(e.message, "err"); }
  };
  W.events = function (el, events) {
    const rows = (events || []).map((e) => ({ t_min: e.t_s / 60, kind: e.kind, severity: e.severity, source: e.source, message: e.message }));
    R.table(el, rows, [{ k: "t_min", h: "t (min)", d: 2 }, { k: "kind", h: "Event" }, { k: "severity", h: "Severity" }, { k: "source", h: "Source" }, { k: "message", h: "Message" }],
      { name: "events", rowClass: (r) => "sev-" + r.severity });
  };
})();
