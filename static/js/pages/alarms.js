// 13 Alarms, interlocks (simulated, read-only), state machine, events
const R = window.RHOB, C = R.C, W = R.W;
let haz = null, sm = null;
R.onData(async (s, recs) => {
  W.alarms(R.$("#alarms"), s.alarms, s.simulation_id);
  W.events(R.$("#events"), s.events);
  const kinds = [...new Set(s.events.map((e) => e.kind))];
  C.plot("pEv", kinds.map((k, i) => { const ev = s.events.filter((e) => e.kind === k); return { x: ev.map((e) => e.t_s / 60), y: ev.map(() => k), mode: "markers", name: k, text: ev.map((e) => e.message), marker: { size: 11, color: C.PAL[i % 10] }, hovertemplate: "%{text}<extra>%{y}</extra>" }; })
    .concat((s.alarms || []).length ? [{ x: s.alarms.map((a) => a.t_s / 60), y: s.alarms.map((a) => "ALARM " + a.id), mode: "markers", name: "alarms", marker: { size: 12, color: "#e2534f", symbol: "x" }, text: s.alarms.map((a) => a.message), hovertemplate: "%{text}<extra></extra>" }] : []),
  { hovermode: "closest", yTitle: "", raw: { margin: { l: 150, r: 10, t: 10, b: 40 }, showlegend: false } });
  if (!haz) { haz = await R.api("api/v1/config/hazards"); sm = await R.api("api/v1/config/state-machine"); }
  R.table(R.$("#haz"), haz, [{ k: "id", h: "ID" }, { k: "name", h: "Hazard" }, { k: "severity", h: "Severity" }, { k: "source", h: "Source" }, { k: "detection", h: "Detection" }, { k: "operator_message", h: "Operator message" }, { k: "manual_response", h: "Manual response" }, { k: "interlock_owner", h: "Interlock owner" }, { k: "inhibit", h: "Inhibit rule" }], { name: "hazard_registry" });
  const blocked = s.phase_table.filter((p) => p.blocked);
  R.$("#sm").innerHTML = `<div class="small" style="margin-bottom:6px">${blocked.length ? "<b style='color:var(--red)'>Blocked transitions:</b> " + blocked.map((p) => `${p.stage} (${p.block_reason}: ${sm.reason_codes[p.block_reason] || ""})`).join("; ") : "No guarded transition blocked in this heat."}</div><div id="smT"></div><div id="rcT" style="margin-top:8px"></div>`;
  R.table(R.$("#smT"), Object.entries(sm.stages).map(([k, v]) => ({ stage: k, description: v, next: (sm.allowed_transitions[k] || []).join(", ") })), null, { name: "state_machine", maxH: 260 });
  R.table(R.$("#rcT"), Object.entries(sm.reason_codes).map(([k, v]) => ({ reason_code: k, meaning: v })), null, { name: "reason_codes", maxH: 220 });
});
