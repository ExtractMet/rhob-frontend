// Procedural, original RH-OB equipment geometry (metres, y up; ladle steel level at y = 0).
// No third-party CAD/assets: everything is generated from the backend geometry packet.
import * as THREE from "three";

export function tempColor(K) {
  // 1700 K dark red -> 1850 K orange -> 1950 K yellow-white (qualitative heat shading)
  const t = Math.min(Math.max(((K || 1850) - 1700) / 250, 0), 1);
  const c = new THREE.Color();
  if (t < 0.6) c.setRGB(0.55 + 0.75 * t, 0.08 + 0.35 * t, 0.0);
  else c.setRGB(1.0, 0.29 + 0.9 * (t - 0.6), 0.02 + 0.5 * (t - 0.6));
  return c;
}
export function wallColor(K) {
  const t = Math.min(Math.max(((K || 600) - 400) / 1400, 0), 1);
  return new THREE.Color().setRGB(0.26 + 0.24 * t, 0.2 + 0.08 * t, 0.18 - 0.06 * t);
}

function tube(rIn, rOut, y0, y1, mat, seg = 48) {
  // hollow cylinder via lathe profile (shows lining thickness in cutaway)
  const pts = [new THREE.Vector2(rIn, y0), new THREE.Vector2(rOut, y0), new THREE.Vector2(rOut, y1), new THREE.Vector2(rIn, y1), new THREE.Vector2(rIn, y0)];
  return new THREE.Mesh(new THREE.LatheGeometry(pts, seg), mat);
}
function disc(r, y, thick, mat, seg = 48) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thick, seg), mat);
  m.position.y = y - thick / 2;
  return m;
}

export function buildEquipment(g, clip) {
  const grp = new THREE.Group();
  const parts = {};
  const clipping = clip ? [clip] : [];
  const M = (opts) => new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, clippingPlanes: clipping, ...opts });
  const mats = {
    shell: M({ color: 0x59626c, metalness: 0.65, roughness: 0.45, transparent: true, opacity: 1 }),
    ladleLining: M({ color: 0x8a5a3c, roughness: 0.9 }),
    vesselLining: M({ color: 0x8c6a55, roughness: 0.9 }),
    safety: M({ color: 0xb58d62, roughness: 0.95 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xff7a2f, emissive: 0xc2410c, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide, clippingPlanes: clipping }),
    slag: M({ color: 0x4a443c, roughness: 1.0 }),
    duct: M({ color: 0x6d7782, metalness: 0.6, roughness: 0.5 }),
    pump: M({ color: 0x3e6e96, metalness: 0.5, roughness: 0.4 }),
    o2: M({ color: 0xdfe6ee, metalness: 0.8, roughness: 0.25 }),
    ar: M({ color: 0x46c1d6, metalness: 0.4, roughness: 0.4 }),
    hopper: M({ color: 0x9a7a28, metalness: 0.4, roughness: 0.6 }),
    lift: M({ color: 0x33393f, metalness: 0.7, roughness: 0.4 }),
  };
  const Rl = g.ladle_D / 2, tl = g.ladle_lining, H = g.ladle_bath_depth, fb = g.freeboard;
  const Rv = g.vessel_D / 2, tv = g.vessel_lining, hvb = g.h_vb0, VH = g.vessel_H, LH = g.vessel_lower_H;
  const rs = g.snorkel_D / 2, rso = rs + g.snorkel_wall;
  let sx = Math.min(Rv * 0.55, Rl - rso - 0.12);
  sx = Math.max(sx, rso + 0.06);
  g.sx = sx;
  // ---------------- ladle
  const ladle = new THREE.Group();
  const yb = -H - 0.35;
  const lin = tube(Rl, Rl + tl * 0.72, yb + 0.3, fb, mats.ladleLining); lin.userData = { pick: "ladle_lining" }; ladle.add(lin);
  ladle.add(tube(Rl + tl * 0.72, Rl + tl, yb + 0.3, fb, mats.safety));
  const sh = tube(Rl + tl, Rl + tl + 0.04, yb, fb, mats.shell); sh.userData = { pick: "ladle_shell" }; ladle.add(sh);
  const bot = disc(Rl + tl + 0.04, yb + 0.35, 0.35, mats.ladleLining); bot.userData = { pick: "ladle_bottom" }; ladle.add(bot);
  // trunnions & lift
  [-1, 1].forEach((s) => {
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 20), mats.shell); tr.rotation.z = Math.PI / 2; tr.position.set(s * (Rl + tl + 0.25), fb - 0.9, 0); ladle.add(tr);
  });
  const car = new THREE.Mesh(new THREE.BoxGeometry(2 * Rl + 1.6, 0.35, 2 * Rl + 0.6), mats.lift); car.position.y = yb - 0.55; car.userData = { pick: "ladle_lift" }; ladle.add(car);
  [-1, 1].forEach((s) => [-1, 1].forEach((t) => {
    const j = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 16), mats.lift); j.position.set(s * (Rl + 0.4), yb - 1.4, t * (Rl * 0.6)); ladle.add(j);
  }));
  grp.add(ladle); parts.ladle = ladle;
  // steel bath & slag (dynamic level)
  const bath = new THREE.Mesh(new THREE.CylinderGeometry(Rl - 0.005, Rl - 0.03, H, 64), mats.steel);
  bath.userData = { pick: "ladle_steel" }; grp.add(bath); parts.bath = bath; parts.bathH = H; parts.yb = -H;
  const slag = new THREE.Mesh(new THREE.CylinderGeometry(Rl - 0.005, Rl - 0.005, 0.1, 64), mats.slag); slag.userData = { pick: "ladle_slag" };
  grp.add(slag); parts.slag = slag;
  // ---------------- snorkels
  parts.snorkels = [];
  [-1, 1].forEach((s, i) => {
    const sn = new THREE.Group();
    const wall = tube(rs, rso, -g.immersion, hvb, mats.vesselLining, 36); wall.userData = { pick: i === 0 ? "upleg" : "downleg" }; sn.add(wall);
    const ring = tube(rso, rso + 0.03, -g.immersion + 0.25, hvb, mats.shell, 36); sn.add(ring);
    sn.position.x = s * sx; grp.add(sn);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(rs - 0.01, rs - 0.01, 1, 32), mats.steel); col.position.x = s * sx; col.userData = { pick: i === 0 ? "upleg" : "downleg" };
    grp.add(col); parts.snorkels.push(col);
  });
  // argon nozzles (ring in up-leg)
  const ny = -g.immersion + g.nozzle_h;
  for (let k = 0; k < g.nozzles; k++) {
    const a = (k / g.nozzles) * Math.PI * 2;
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, g.snorkel_wall + 0.15, 8), mats.ar);
    n.position.set(-sx + Math.cos(a) * (rs + g.snorkel_wall / 2), ny, Math.sin(a) * (rs + g.snorkel_wall / 2));
    n.rotation.z = Math.PI / 2; n.rotation.y = -a; n.userData = { pick: "ar_nozzles" }; grp.add(n);
  }
  // argon ring main
  const arRing = new THREE.Mesh(new THREE.TorusGeometry(rso + 0.12, 0.035, 8, 40), mats.ar); arRing.rotation.x = Math.PI / 2; arRing.position.set(-sx, ny + 0.05, 0);
  arRing.userData = { pick: "ar_nozzles" }; grp.add(arRing);
  // ---------------- vacuum vessel
  const ves = new THREE.Group();
  const vl = tube(Rv, Rv + tv, hvb, hvb + LH, mats.vesselLining); vl.userData = { pick: "vessel_lower" }; ves.add(vl);
  const vls = tube(Rv + tv, Rv + tv + 0.035, hvb - 0.05, hvb + LH, mats.shell); vls.userData = { pick: "vessel_lower" }; ves.add(vls);
  const vb = disc(Rv + tv + 0.035, hvb, 0.32, mats.vesselLining); vb.userData = { pick: "vessel_bottom" }; ves.add(vb);
  // snorkel holes are implicit (bottom disc drawn under the bath; steel columns pass through visually)
  const Ru = Rv * 0.92;
  const vu = tube(Ru, Ru + tv * 0.8, hvb + LH, hvb + VH - 0.6, mats.vesselLining); vu.userData = { pick: "vessel_upper" }; ves.add(vu);
  const vus = tube(Ru + tv * 0.8, Ru + tv * 0.8 + 0.035, hvb + LH, hvb + VH - 0.6, mats.shell); vus.userData = { pick: "vessel_upper" }; ves.add(vus);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.7, Ru + tv * 0.8 + 0.035, 0.9, 48, 1, true), mats.shell); cone.position.y = hvb + VH - 0.15; ves.add(cone);
  grp.add(ves); parts.vessel = ves;
  const vbath = new THREE.Mesh(new THREE.CylinderGeometry(Rv - 0.01, Rv - 0.01, 1, 48), mats.steel); vbath.userData = { pick: "vessel_bath" };
  grp.add(vbath); parts.vbath = vbath;
  // O2 tuyeres (RH-OB): through lower vessel wall
  parts.tuyeres = [];
  for (let k = 0; k < g.tuyere_count; k++) {
    const a = Math.PI / 2 + (k * Math.PI * 2) / Math.max(g.tuyere_count, 1);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, tv + 0.6, 12), mats.o2);
    const r = Rv + tv / 2 + 0.15;
    t.position.set(Math.cos(a) * r, hvb + g.tuyere_h, Math.sin(a) * r); t.rotation.z = Math.PI / 2; t.rotation.y = -a;
    t.userData = { pick: "o2_tuyere" }; grp.add(t); parts.tuyeres.push({ mesh: t, a });
  }
  // ---------------- off-gas duct, cooler, ejectors, condensers
  const yTop = hvb + VH - 1.0;
  const duct = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3.2, 28), mats.duct); duct.rotation.z = Math.PI / 2; duct.position.set(Ru + tv + 1.8, yTop, 0);
  duct.userData = { pick: "offgas_duct" }; grp.add(duct);
  const cooler = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.4, 1.6), mats.duct); cooler.position.set(Ru + tv + 4.0, yTop - 1.2, 0); cooler.userData = { pick: "gas_cooler" }; grp.add(cooler);
  const dd = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.2, 24), mats.duct); dd.rotation.z = Math.PI / 2; dd.position.set(Ru + tv + 5.9, yTop - 2.2, 0); grp.add(dd);
  parts.ejectors = [];
  const ejx0 = Ru + tv + 7.2;
  for (let k = 0; k < 5; k++) {
    const r = 0.5 - k * 0.07;
    const e = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r, 1.7, 24), mats.pump); e.rotation.z = Math.PI / 2;
    e.position.set(ejx0 + k * 1.55, yTop - 2.2 - k * 0.55, 0); e.userData = { pick: "ejector", stage: k + 1 }; grp.add(e); parts.ejectors.push(e);
    if (k < 4) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.4, 20), mats.duct); c.position.set(ejx0 + k * 1.55 + 0.8, yTop - 3.2 - k * 0.55, 0); c.userData = { pick: "condenser" }; grp.add(c); }
  }
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 16), mats.duct); stack.position.set(ejx0 + 5 * 1.55 + 0.4, yTop - 0.5, 0); stack.userData = { pick: "stack" }; grp.add(stack);
  parts.ductPath = [new THREE.Vector3(0, yTop, 0), new THREE.Vector3(Ru + tv + 3.4, yTop, 0), new THREE.Vector3(Ru + tv + 4.0, yTop - 2.2, 0),
    new THREE.Vector3(ejx0 + 6.5, yTop - 4.5, 0), new THREE.Vector3(ejx0 + 8.1, yTop + 2.5, 0)];
  // ---------------- alloy hopper & chute
  const hop = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.3, 1.6, 20), mats.hopper); hop.position.set(-(Ru + tv + 1.5), hvb + VH + 0.6, 0); hop.userData = { pick: "alloy_hopper" }; grp.add(hop);
  const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 10), mats.hopper); ch.position.set(-(Ru + tv + 0.6), hvb + VH - 0.4, 0); ch.rotation.z = -0.9; grp.add(ch);
  parts.hopperPos = new THREE.Vector3(-(Ru * 0.6), hvb + VH - 1.2, 0);
  // gas trains (labels anchors)
  const o2line = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 8), mats.o2); o2line.position.set(0, hvb + g.tuyere_h, Rv + tv + 0.75); o2line.rotation.z = Math.PI / 2; o2line.userData = { pick: "o2_train" }; grp.add(o2line);
  const arline = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, Math.max(hvb + g.immersion + 1, 1), 8), mats.ar); arline.position.set(-sx - rso - 0.15, (ny + hvb) / 2 + 0.3, 0); grp.add(arline);
  parts.mats = mats;
  parts.anchors = {
    "Ladle (steel + slag)": new THREE.Vector3(Rl + tl + 0.3, -H * 0.4, 0), "Slag layer": new THREE.Vector3(Rl * 0.6, 0.15, Rl * 0.6),
    "Up-leg snorkel (Ar lift)": new THREE.Vector3(-sx - rso - 0.2, -0.2, 0.6), "Down-leg snorkel": new THREE.Vector3(sx + rso + 0.2, -0.2, 0.6),
    "Lower vacuum vessel": new THREE.Vector3(-(Rv + tv + 0.2), hvb + LH * 0.5, 0), "Upper vessel / freeboard": new THREE.Vector3(-(Ru + tv + 0.2), hvb + LH + (VH - LH) * 0.5, 0),
    "O₂ tuyeres (RH-OB)": new THREE.Vector3(0, hvb + g.tuyere_h, Rv + tv + 1.2), "Off-gas duct": new THREE.Vector3(Ru + tv + 1.8, yTop + 0.8, 0),
    "Gas cooler": new THREE.Vector3(Ru + tv + 4.0, yTop + 0.8, 0), "Steam ejectors + condensers": new THREE.Vector3(ejx0 + 3, yTop - 1.2, 0),
    "Alloy hopper": new THREE.Vector3(-(Ru + tv + 1.5), hvb + VH + 1.6, 0), "Ladle lift": new THREE.Vector3(0, yb - 1.0, Rl + 0.5),
    "Ar nozzle ring": new THREE.Vector3(-sx, ny, rso + 0.4),
  };
  return { group: grp, parts };
}
