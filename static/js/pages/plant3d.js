// 02 Interactive 3D RH-OB plant (Three.js) + process schematic bound to the same state packet
import { mountRHOB, webglAvailable } from "/static/js/rhob3d/index.js";
const R = window.RHOB;
let viz = null, vis = null, curSim = null, source = "twin";

function geoTable(g) {
  const rows = [
    ["Ladle capacity", g.capacity_t, "t"], ["Ladle inner diameter", g.ladle_D, "m"], ["Ladle bath depth (nominal)", g.ladle_bath_depth, "m"], ["Ladle lining (total)", g.ladle_lining, "m"],
    ["Freeboard", g.freeboard, "m"], ["Snorkel inner diameter", g.snorkel_D, "m"], ["Snorkel length", g.snorkel_L, "m"], ["Snorkel wall", g.snorkel_wall, "m"],
    ["Immersion depth", g.immersion, "m"], ["Vessel bottom above ladle level", g.h_vb0, "m"], ["Vessel inner diameter", g.vessel_D, "m"], ["Vessel internal height", g.vessel_H, "m"],
    ["Lower vessel height", g.vessel_lower_H, "m"], ["Vessel lining (total)", g.vessel_lining, "m"], ["Ar lift nozzles", g.nozzles, "-"], ["Nozzle height above tip", g.nozzle_h, "m"],
    ["O₂ tuyeres", g.tuyere_count, "-"], ["Tuyere height above bottom", g.tuyere_h, "m"], ["Variant", g.variant, ""]];
  R.table(R.$("#geo"), rows.map(([k, v, u]) => ({ item: k, value: v, unit: u })), [{ k: "item", h: "Dimension" }, { k: "value", h: "Value", d: 3 }, { k: "unit", h: "Unit" }], { name: "geometry", maxH: 520 });
}
async function packetsFor(sim) {
  const v = await R.api(`api/v1/simulations/${sim}/visual`);
  if (source === "plant") {
    const tr = await R.api(`api/v1/simulations/${sim}/trajectory`, { params: { kind: "plant" } });
    const keys = Object.keys(v.packets[0] || {});
    v.packets = tr.records.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])));
  }
  return v;
}
R.onData(async (s) => {
  if (!webglAvailable()) {
    R.$("#vp").style.display = "none"; const fb = R.$("#fb2d"); fb.style.display = "block";
    R.toast("WebGL unavailable - showing 2D schematic fallback", "err");
  }
  if (curSim !== s.simulation_id || !vis) {
    vis = await packetsFor(s.simulation_id); curSim = s.simulation_id;
    geoTable(vis.geometry);
    if (!viz && webglAvailable()) {
      viz = mountRHOB(R.$("#vp"), { geometry: vis.geometry, packets: vis.packets, stageColors: R.STAGE_COLORS, additions: s.applied_additions || [],
        onShow: (st) => R.schematic(R.$("#schem"), vis.geometry, st), onFallback: () => {} });
      wireToolbar();
      viz.seekStage(["OB_DECARB", "NATURAL_DECARB"], 90);
    } else if (viz) { viz.setPackets(vis.packets); viz.setAdditions(s.applied_additions || []); }
    else { R.schematic(R.$("#fb2d"), vis.geometry, vis.packets[vis.packets.length - 1]); R.schematic(R.$("#schem"), vis.geometry, vis.packets[vis.packets.length - 1]); }
  } else {
    vis = await packetsFor(s.simulation_id);
    if (viz) { viz.setPackets(vis.packets); viz.setAdditions(s.applied_additions || []); }
  }
});
function wireToolbar() {
  const sc = viz.scene;
  R.$("#cut").onchange = (e) => sc.setCutaway(e.target.checked);
  R.$("#lbl").onchange = (e) => sc.setLabels(e.target.checked);
  R.$("#rot").onchange = (e) => (sc.autoRotate = e.target.checked);
  R.$("#shell").oninput = (e) => sc.setShellOpacity(+e.target.value);
  R.$("#preset").onchange = (e) => sc.setPreset(e.target.value);
  R.$("#resetView").onclick = () => sc.resetView();
  R.$("#source").onchange = async (e) => { source = e.target.value; vis = await packetsFor(curSim); viz.setPackets(vis.packets); R.toast(source === "plant" ? "Showing SYNTHETIC plant truth packets" : "Showing digital-twin model packets"); };
}
