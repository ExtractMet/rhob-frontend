/* Plotly wrappers: themed layout, stage bands, event markers, lab overlays, shared time cursor. */
(function () {
  const R = window.RHOB;
  const C = (R.C = {});
  const PAL = ["#46c1d6", "#e3a83b", "#55c07f", "#e2534f", "#9b86d9", "#4f86b8", "#e2793a", "#3fae9c", "#c9d36a", "#d07fb6"];
  C.PAL = PAL;
  const registry = new Set();
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

  C.layout = function (opts = {}) {
    const text = css("--text"), grid = css("--line"), muted = css("--muted");
    const L = {
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: text, size: 11 },
      margin: { l: 58, r: opts.y2 ? 58 : 16, t: opts.title ? 28 : 10, b: 38 },
      title: opts.title ? { text: opts.title, font: { size: 12 }, x: 0.01 } : undefined,
      xaxis: { title: { text: opts.xTitle || "time (min)", font: { size: 10.5, color: muted } }, gridcolor: grid, zerolinecolor: grid, linecolor: grid, ...(opts.xaxis || {}) },
      yaxis: { title: { text: opts.yTitle || "", font: { size: 10.5, color: muted } }, gridcolor: grid, zerolinecolor: grid, linecolor: grid, ...(opts.yaxis || {}) },
      legend: { orientation: "h", y: -0.22, font: { size: 10 } }, hovermode: opts.hovermode || "x unified",
      shapes: [], annotations: [{ text: "SYNTHETIC", xref: "paper", yref: "paper", x: 0.99, y: 0.98, showarrow: false,
        font: { size: 10, color: "rgba(226,83,79,.55)" }, xanchor: "right" }],
    };
    if (opts.y2) L.yaxis2 = { title: { text: opts.y2, font: { size: 10.5, color: muted } }, overlaying: "y", side: "right", gridcolor: "rgba(0,0,0,0)", ...(opts.yaxis2 || {}) };
    if (opts.ylog) L.yaxis.type = "log";
    return L;
  };
  C.config = { responsive: true, displaylogo: false, toImageButtonOptions: { format: "png", scale: 2 }, modeBarButtonsToRemove: ["lasso2d", "select2d"] };

  function stageShapes(summary) {
    if (!summary) return [];
    return summary.phase_table.map((p) => ({ type: "rect", xref: "x", yref: "paper", x0: p.t_start / 60, x1: p.t_end / 60, y0: 0, y1: 1,
      fillcolor: R.STAGE_COLORS[p.stage] || "#444", opacity: 0.07, line: { width: 0 }, layer: "below" }));
  }
  function eventMarks(summary) {
    if (!summary) return { shapes: [], ann: [] };
    const shapes = [], ann = [];
    const add = (t, label, color) => {
      shapes.push({ type: "line", xref: "x", yref: "paper", x0: t / 60, x1: t / 60, y0: 0, y1: 1, line: { color, width: 1, dash: "dot" } });
      ann.push({ x: t / 60, y: 1, xref: "x", yref: "paper", text: label, showarrow: false, textangle: -90, xanchor: "right", yanchor: "top", font: { size: 8.5, color } });
    };
    summary.phase_table.forEach((p, i) => {
      const prev = summary.phase_table[i - 1];
      if (p.oxygen_Nm3_h > 0 && !p.blocked) { add(p.t_start, "O₂ ON", "#e2793a"); add(p.t_end, "O₂ OFF", "#e2793a"); }
      if (p.stage === "VACUUM_BREAK" || p.stage === "ABORT_VACUUM_BREAK") add(p.t_start, "vac. break", "#e2534f");
      if (p.stage === "PUMP_DOWN") add(p.t_start, "pump-down", "#4f86b8");
    });
    (summary.applied_additions || []).forEach((a) => add(a.t_s, `${a.material} ${Math.round(a.mass_kg)}kg`, "#9b86d9"));
    (summary.events || []).filter((e) => e.kind === "SAMPLE").forEach((e) => add(e.t_s, "sample", "#55c07f"));
    return { shapes, ann };
  }

  /* series: [{key, name, f (value transform), color, yaxis:'y2', dash, width, fill, fn(record)}] */
  C.ts = function (div, records, series, opts = {}) {
    if (typeof div === "string") div = document.getElementById(div);
    if (!div) return;
    const x = records.map((r) => r.t_s / 60);
    const traces = series.map((s, i) => ({
      x, y: records.map((r) => { const v = s.fn ? s.fn(r) : r[s.key]; return v == null ? null : s.f ? s.f(v) : v; }),
      name: s.name || s.key, type: "scatter", mode: s.mode || "lines", yaxis: s.yaxis || "y",
      line: { color: s.color || PAL[i % PAL.length], width: s.width || 1.8, dash: s.dash || "solid", shape: s.shape || "linear" },
      fill: s.fill, stackgroup: s.stack, hovertemplate: `%{y:.${s.d ?? 2}f} ${s.unit || ""}<extra>${s.name || s.key}</extra>`,
    }));
    (opts.extra || []).forEach((t) => traces.push(t));
    const L = C.layout(opts);
    const sum = R.state.summary;
    if (opts.bands !== false) L.shapes = L.shapes.concat(stageShapes(sum));
    if (opts.events !== false) { const em = eventMarks(sum); L.shapes = L.shapes.concat(em.shapes); L.annotations = L.annotations.concat(em.ann); }
    if (opts.now !== false && sum) L.shapes.push({ type: "line", xref: "x", yref: "paper", x0: sum.sim_time_s / 60, x1: sum.sim_time_s / 60, y0: 0, y1: 1, line: { color: "#46c1d6", width: 1.5 } });
    (opts.hlines || []).forEach((h) => {
      L.shapes.push({ type: "line", xref: "paper", yref: h.yref || "y", x0: 0, x1: 1, y0: h.y, y1: h.y, line: { color: h.color || "#e2534f", width: 1.2, dash: "dash" } });
      L.annotations.push({ xref: "paper", yref: h.yref || "y", x: 0.005, y: h.y, text: h.label, showarrow: false, xanchor: "left", yanchor: "bottom", font: { size: 9.5, color: h.color || "#e2534f" } });
    });
    Plotly.react(div, traces, L, C.config);
    if (!registry.has(div)) {
      registry.add(div);
      div.on("plotly_hover", (ev) => {
        const xv = ev.points[0].x;
        registry.forEach((d) => { if (d !== div && d.isConnected && d.data) { try { Plotly.Fx.hover(d, { xval: xv }); } catch (e) {} } });
      });
      div.on("plotly_unhover", () => registry.forEach((d) => { if (d !== div && d.isConnected) try { Plotly.Fx.unhover(d); } catch (e) {} }));
    }
  };

  /* lab sample overlay markers (LAB ANALYZED synthetic plant values; applied ones hollow) */
  C.labTrace = function (summary, key, name, f) {
    const labs = (summary.lab_results || []).filter((l) => l.values && l.values[key] != null);
    return {
      x: labs.map((l) => l.t_sample_s / 60), y: labs.map((l) => (f ? f(l.values[key]) : l.values[key])), name: name || "lab (synthetic plant)",
      mode: "markers", type: "scatter",
      marker: { size: 10, symbol: labs.map((l) => (l.applied ? "diamond-open" : "diamond")), color: labs.map((l) => (l.available ? "#55c07f" : "#6a7887")), line: { width: 2 } },
      text: labs.map((l) => `sample ${(l.t_sample_s / 60).toFixed(1)} min · result at ${(l.t_available_s / 60).toFixed(1)} min${l.applied ? " · applied" : ""}`),
      hovertemplate: "%{y:.2f} (%{text})<extra>LAB</extra>",
    };
  };

  C.bar = function (div, x, ys, opts = {}) {
    if (typeof div === "string") div = document.getElementById(div);
    const traces = ys.map((s, i) => ({ x, y: s.y, name: s.name, type: "bar", marker: { color: s.color || PAL[i % PAL.length] }, orientation: opts.h ? "h" : "v",
      hovertemplate: `%{y:.3g} ${s.unit || ""}<extra>${s.name}</extra>` }));
    const L = C.layout({ ...opts, hovermode: "closest" });
    L.barmode = opts.barmode || "group";
    if (opts.h) { traces.forEach((t) => { t.x = t.y; t.y = x; t.hovertemplate = `%{x:.3g} ${ys[0].unit || ""}<extra>%{y}</extra>`; }); L.xaxis.title.text = opts.yTitle || ""; L.yaxis.title.text = ""; L.margin.l = opts.lmargin || 170; }
    Plotly.react(div, traces, L, C.config);
  };
  C.plot = function (div, traces, opts = {}) {
    if (typeof div === "string") div = document.getElementById(div);
    const L = C.layout(opts);
    Object.assign(L, opts.raw || {});
    Plotly.react(div, traces, L, C.config);
  };
})();
