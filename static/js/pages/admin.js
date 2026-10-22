// 16 Admin, connectivity, docs
const R = window.RHOB;
R.onData(async (s) => {
  const who = await fetch("/whoami").then((r) => r.json());
  R.$("#who").innerHTML = `<div class="kv"><span>User</span><span>${who.user}</span><span>Role</span><span>${who.role}</span><span>Token</span><span>${who.logged_in ? "held server-side (session cookie)" : "none"}</span></div>`;
  const meta = await R.api("api/v1/metadata"); const ready = await fetch("/readyz").then((r) => r.json());
  R.$("#meta").innerHTML = `<div class="kv small">${Object.entries(meta).map(([k, v]) => `<span>${k}</span><span>${Array.isArray(v) ? v.join(", ") : v}</span>`).join("")}<span>frontend → backend</span><span>${ready.api_base_url} · ${ready.backend.reachable ? "reachable" : "DOWN"} · ${R.fmt(ready.backend.latency_ms, 0)} ms</span></div>`;
  const ad = await R.api("api/v1/live/sources");
  R.table(R.$("#adapters"), Object.entries(ad).filter(([k]) => typeof ad[k] === "object").map(([k, v]) => ({ adapter: k, enabled: String(v.enabled), write: String(v.write_capability ?? v.publish_capability ?? false), note: v.note || v.file || "" })), null, { name: "adapters" });
  try { const au = await R.api("api/v1/audit", { params: { limit: 200 } }); R.table(R.$("#audit"), au.items.map((a) => ({ ts: a.ts, user: a.user, role: a.role, action: a.action, target: a.target, detail: JSON.stringify(a.detail).slice(0, 120) })), null, { name: "audit" }); }
  catch (e) { R.$("#audit").innerHTML = `<div class="empty">${e.message} — switch role to Metallurgist or higher</div>`; }
  try { const ss = await R.api("api/v1/admin/sessions"); R.table(R.$("#sess"), ss, null, { name: "sessions" }); }
  catch (e) { R.$("#sess").innerHTML = `<div class="empty">${e.message}</div>`; }
  R.$("#docs").innerHTML = `<div class="kv"><span>API (OpenAPI / Swagger)</span><span><a href="/api-docs" target="_blank">backend /docs (Swagger UI)</a> · <a href="/bff/openapi.json" target="_blank">openapi.json</a></span>
    <span>Operator manual</span><span><a href="/docs-view/OPERATOR_MANUAL" target="_blank">OPERATOR_MANUAL.md</a></span><span>3D component</span><span><a href="/docs-view/FRONTEND_COMPONENT" target="_blank">FRONTEND_COMPONENT.md</a></span>
    <span>Accessibility</span><span><a href="/docs-view/ACCESSIBILITY" target="_blank">ACCESSIBILITY.md</a></span><span>Troubleshooting</span><span><a href="/docs-view/TROUBLESHOOTING" target="_blank">TROUBLESHOOTING.md</a></span>
    <span>Licences</span><span>three.js r160 (MIT) · plotly.js 2.35.2 (MIT) · original procedural 3D geometry · © Extractmet Private Limited</span></div>`;
});
