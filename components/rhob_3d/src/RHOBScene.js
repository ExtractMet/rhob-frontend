// Three.js scene for the RH-OB twin: renderer, camera, controls, lights, cutaway clipping,
// labels, click inspection, and state-driven updates of steel levels / heat shading.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AnimationController } from "./AnimationController.js";
import { buildEquipment, tempColor, wallColor } from "./EquipmentGeometry.js";

const INFO = {
  ladle_steel: (s) => [["Liquid steel (ladle)", ""], ["T", `${(s.T_l_K - 273.15).toFixed(1)} °C`], ["C", `${s.C_bulk_ppm?.toFixed(1)} ppm`], ["O", `${s.O_bulk_ppm?.toFixed(1)} ppm`], ["H / N", `${s.H_bulk_ppm?.toFixed(2)} / ${s.N_bulk_ppm?.toFixed(1)} ppm`], ["Al", `${s.Al_bulk_ppm?.toFixed(0)} ppm`], ["Level drop", `${(s.ladle_level_drop_m * 1000).toFixed(0)} mm`]],
  ladle_slag: (s) => [["Ladle slag", ""], ["T slag (lumped)", `${(s.T_slag_K - 273.15).toFixed(0)} °C`], ["Role", "reoxidation source (FeO), inclusion sink"]],
  ladle_lining: (s) => [["Ladle working lining", "MgO-C"], ["Hot face", `${(s.T_ladle_hotface_K - 273.15).toFixed(0)} °C`], ["Shell", `${(s.T_ladle_shell_K - 273.15).toFixed(0)} °C`]],
  ladle_shell: (s) => [["Ladle shell", ""], ["Shell T", `${(s.T_ladle_shell_K - 273.15).toFixed(0)} °C`]],
  ladle_bottom: (s) => [["Ladle bottom", "MgO-C / castable"]],
  ladle_lift: () => [["Hydraulic ladle lift", "position & immersion: plant PLC (read-only)"]],
  upleg: (s) => [["Up-leg snorkel", "Ar gas lift"], ["Circulation", `${s.q_circ_t_min?.toFixed(0)} t/min`], ["Ar", `${s.argon_NL_min?.toFixed(0)} NL/min`]],
  downleg: (s) => [["Down-leg snorkel", "return to ladle"], ["Velocity", `${s.u_downleg_m_s?.toFixed(2)} m/s`], ["Mixing t95", s.mixing_time_95_s ? `${s.mixing_time_95_s.toFixed(0)} s` : "—"]],
  ar_nozzles: (s) => [["Ar lift nozzles", ""], ["Flow", `${s.argon_NL_min?.toFixed(0)} NL/min (normal)`]],
  vessel_lower: (s) => [["Lower vacuum vessel", "MgO-Cr lining"], ["Hot face", `${(s.T_vlow_hotface_K - 273.15).toFixed(0)} °C`], ["Shell", `${(s.T_vlow_shell_K - 273.15).toFixed(0)} °C`]],
  vessel_upper: (s) => [["Upper vessel / freeboard", ""], ["Hot face", `${(s.T_vup_hotface_K - 273.15).toFixed(0)} °C`], ["x_CO", `${(100 * (s.x_CO || 0)).toFixed(1)} %`]],
  vessel_bottom: () => [["Vessel bottom", "snorkel ports"]],
  vessel_bath: (s) => [["Vessel bath (reaction zone)", ""], ["Depth", `${(s.vessel_depth_m * 1000).toFixed(0)} mm`], ["T", `${(s.T_v_K - 273.15).toFixed(1)} °C`], ["P", `${(s.P_Pa / 100).toFixed(2)} mbar`], ["Surface factor", s.surface_factor?.toFixed(1)], ["CO site depth", `${(s.inner_site_depth_m * 1000).toFixed(0)} mm`]],
  o2_tuyere: (s) => [["RH-OB O₂ tuyere", "submerged"], ["O₂", `${s.oxygen_Nm3_h?.toFixed(0)} Nm³/h`], ["Absorption", `${((s.o2_abs_eff || 0) * 100).toFixed(0)} %`]],
  o2_train: (s) => [["Oxygen train", "valves owned by plant PLC"], ["Flow", `${s.oxygen_Nm3_h?.toFixed(0)} Nm³/h`]],
  offgas_duct: (s) => [["Off-gas duct", ""], ["CO", `${s.offgas_CO_Nm3_h?.toFixed(0)} Nm³/h`], ["x_CO", `${(100 * (s.x_CO || 0)).toFixed(1)} %`]],
  gas_cooler: () => [["Gas cooler / dust catcher", ""]],
  ejector: (s, u) => [[`Steam ejector stage ${u.stage}`, ""], ["Throttle", `${((s.pump_throttle || 0) * 100).toFixed(0)} %`], ["P suction", `${(s.P_Pa / 100).toFixed(2)} mbar`]],
  condenser: () => [["Inter-condenser", ""]],
  stack: () => [["Exhaust stack", ""]],
  alloy_hopper: () => [["Vacuum alloy hopper", "Al, FeTi, FeSi, FeMn …"]],
};

export class RHOBScene {
  constructor(container, geometry, opts = {}) {
    this.el = container; this.g = { ...geometry };
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxPixelRatio || 1.5));
    this.renderer.localClippingEnabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    const g = this.g;
    this.target = new THREE.Vector3(2.0, g.h_vb0 + 1.2, 0);
    this.camera.position.set(11, 7.5, 15);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.target); this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3; this.controls.maxDistance = 60;
    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x2a2018, 0.55));
    const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(8, 16, 10); this.scene.add(d);
    const d2 = new THREE.DirectionalLight(0x88aaff, 0.4); d2.position.set(-10, 5, -8); this.scene.add(d2);
    this.glow = new THREE.PointLight(0xff7a2f, 2, 7, 2); this.glow.position.set(0, 0.6, 0); this.scene.add(this.glow);
    const grid = new THREE.GridHelper(60, 60, 0x2c3743, 0x1a222b); grid.position.y = -g.ladle_bath_depth - 2.3; this.scene.add(grid);
    this.clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0);
    this.clipOn = true;
    this.eq = buildEquipment(this.g, this.clip);
    this.scene.add(this.eq.group);
    this.anim = new AnimationController(this.scene, this.eq, this.g, this.clip);
    this.arrows = [];
    const mkArrow = (from, to, color) => { const dir = to.clone().sub(from); const a = new THREE.ArrowHelper(dir.clone().normalize(), from, dir.length(), color, 0.35, 0.22); this.scene.add(a); this.arrows.push(a); };
    mkArrow(new THREE.Vector3(-g.sx, -g.immersion - 0.9, 0.0), new THREE.Vector3(-g.sx, -g.immersion - 0.1, 0.0), 0xffb347);
    mkArrow(new THREE.Vector3(g.sx, -g.immersion - 0.1, 0.0), new THREE.Vector3(g.sx, -g.immersion - 0.9, 0.0), 0xffb347);
    mkArrow(new THREE.Vector3(-g.sx * 0.5, g.h_vb0 + 0.55, 0), new THREE.Vector3(g.sx * 0.5, g.h_vb0 + 0.55, 0), 0xffb347);
    // labels
    this.labelEls = [];
    Object.entries(this.eq.parts.anchors).forEach(([name, pos]) => {
      const e = document.createElement("div"); e.className = "label3d"; e.textContent = name; container.appendChild(e); this.labelEls.push({ e, pos });
    });
    this.labelsOn = true;
    // picking
    this.ray = new THREE.Raycaster(); this.mouse = new THREE.Vector2();
    this.renderer.domElement.addEventListener("click", (ev) => this.pick(ev));
    this.state = null; this.autoRotate = false; this.paused = false; this.clock = new THREE.Clock();
    this.resize(); new ResizeObserver(() => this.resize()).observe(container);
    document.addEventListener("visibilitychange", () => { this.hidden = document.hidden; });
    this.fitView();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  fitView(dir = new THREE.Vector3(-0.55, 0.22, 1)) {
    // frame the reactor (ladle + snorkels + lower vessel); the off-gas train stays partly in view
    const g = this.g;
    const box = new THREE.Box3(new THREE.Vector3(-g.ladle_D / 2 - 0.6, -g.ladle_bath_depth - 0.8, -g.ladle_D / 2),
      new THREE.Vector3(g.vessel_D / 2 + 3.5, g.h_vb0 + g.vessel_lower_H + 2.5, g.ladle_D / 2));
    const sph = box.getBoundingSphere(new THREE.Sphere());
    const dist = sph.radius / Math.sin((this.camera.fov * Math.PI) / 360) * 0.95;
    this.target.copy(sph.center);
    this.controls.target.copy(sph.center);
    this.camera.position.copy(sph.center).addScaledVector(dir.normalize(), dist);
    this.home = this.camera.position.clone();
  }
  resize() { const w = this.el.clientWidth, h = this.el.clientHeight; this.renderer.setSize(w, h); this.camera.aspect = w / Math.max(h, 1); this.camera.updateProjectionMatrix(); }
  setCutaway(on) { this.clipOn = on; this.clip.constant = on ? 0 : 1e4; }
  setShellOpacity(o) { const m = this.eq.parts.mats.shell; m.opacity = o; m.depthWrite = o > 0.9; }
  setLabels(on) { this.labelsOn = on; this.labelEls.forEach((l) => (l.e.style.display = on ? "" : "none")); }
  resetView() { this.fitView(); }
  setPreset(name) {
    const g = this.g;
    const P = { vessel: [[-3, g.h_vb0 + 3, 8], [0, g.h_vb0 + 0.8, 0]], snorkels: [[-2.5, 0.8, 7.5], [0, -0.3, 0]], offgas: [[g.vessel_D + 6, g.h_vb0 + 6, 14], [g.vessel_D + 6, g.h_vb0 + 6, 0]], overview: null }[name];
    if (P === null) { this.fitView(); return; }
    if (!P) return; this.camera.position.set(...P[0]); this.controls.target.set(...P[1]);
  }
  apply(s, v) {
    this.state = s; this.vis = v;
    if (!s || !v) return;
    const g = this.g, p = this.eq.parts;
    const level = -v.levelDrop, H = g.ladle_bath_depth;
    const bh = Math.max(H - v.levelDrop, 0.1);
    p.bath.scale.y = bh / H; p.bath.position.y = -H + bh / 2 + 0.0 - 0.0;
    p.bath.position.y = level - bh / 2;
    p.slag.position.y = level + 0.05;
    const tl = tempColor(v.TL), tv = tempColor(v.TV || v.TL);
    p.mats.steel.color.copy(tl); p.mats.steel.emissive.copy(tl).multiplyScalar(0.95); p.mats.steel.emissiveIntensity = 1.1;
    p.mats.slag.color.copy(wallColor(v.slagT ? v.slagT - 500 : 900)).multiplyScalar(0.55);
    p.mats.ladleLining.color.copy(wallColor(v.hotLadle));
    p.mats.vesselLining.color.copy(wallColor(v.hotVessel));
    const topCol = v.lifted ? g.h_vb0 + v.vesselDepth : level;
    p.snorkels.forEach((c) => { const y0 = -g.immersion, h = Math.max(topCol - y0, 0.02); c.scale.y = h; c.position.y = y0 + h / 2; });
    const vd = Math.max(v.vesselDepth, 0.001);
    p.vbath.visible = v.lifted && v.vesselDepth > 0.01;
    p.vbath.scale.y = vd; p.vbath.position.y = g.h_vb0 + vd / 2;
    this.glow.intensity = 1 + 3 * Math.min(Math.max((v.TL - 1750) / 200, 0), 1);
    this.glow.position.y = v.lifted ? g.h_vb0 + 0.6 : level + 0.4;
    this.arrows.forEach((a) => (a.visible = v.circ > 1));
    p.ejectors.forEach((e, k) => e.material.emissive?.setRGB(0, 0.12 * v.pumpThrottle * (k < 3 ? 1 : 0.5), 0.25 * v.pumpThrottle));
  }
  pick(ev) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.camera);
    const hits = this.ray.intersectObjects(this.eq.group.children, true).filter((h) => h.object.userData && h.object.userData.pick);
    if (!hits.length || !this.state) { this.onInspect && this.onInspect(null); return; }
    const ud = hits[0].object.userData;
    const f = INFO[ud.pick];
    this.onInspect && this.onInspect(f ? f(this.state, ud) : [[ud.pick, ""]]);
  }
  loop() {
    requestAnimationFrame(this.loop);
    if (this.hidden) return;
    const dt = this.clock.getDelta();
    this.controls.autoRotate = this.autoRotate; this.controls.autoRotateSpeed = 0.6; this.controls.update();
    if (this.vis) this.anim.update(dt, this.vis, { paused: this.paused, alloyDrop: this.alloyDrop });
    this.renderer.render(this.scene, this.camera);
    if (this.labelsOn) {
      const w = this.el.clientWidth, h = this.el.clientHeight;
      this.labelEls.forEach(({ e, pos }) => {
        const q = pos.clone().project(this.camera);
        e.style.left = ((q.x + 1) / 2) * w + "px"; e.style.top = ((1 - q.y) / 2) * h + "px";
        e.style.display = q.z < 1 ? "" : "none";
      });
    }
  }
}
