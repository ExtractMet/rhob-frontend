// Particle animation bound to state: Ar lift bubbles (gas), steel circulation tracers (liquid),
// CO bubbles + splash in the vessel, O2 jets at tuyeres, off-gas flow in the duct, alloy drops.
// Gas and liquid use different shapes/colours so bubble motion is distinguishable from steel flow.
import * as THREE from "three";

const tmpM = new THREE.Matrix4(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

class Pool {
  constructor(scene, n, geo, mat) {
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.n = n; this.items = []; scene.add(this.mesh);
  }
  spawn(o) { if (this.items.length < this.n) this.items.push(o); }
  flush() {
    let i = 0;
    for (const p of this.items) {
      tmpS.setScalar(p.r || 0.05); tmpM.compose(p.pos, tmpQ, tmpS); this.mesh.setMatrixAt(i++, tmpM);
    }
    for (; i < this.n; i++) { tmpS.setScalar(0); tmpM.compose(tmpV.set(0, -999, 0), tmpQ, tmpS); this.mesh.setMatrixAt(i, tmpM); }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export class AnimationController {
  constructor(scene, eq, g, clip) {
    this.g = g; this.eq = eq;
    const sph = new THREE.SphereGeometry(1, 10, 8);
    const cl = clip ? [clip] : [];
    this.bubbles = new Pool(scene, 420, sph, new THREE.MeshStandardMaterial({ color: 0xbfefff, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.0, emissive: 0x2a6f80, clippingPlanes: cl }));
    this.tracers = new Pool(scene, 260, new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffe08a, clippingPlanes: cl }));
    this.co = new Pool(scene, 260, sph, new THREE.MeshStandardMaterial({ color: 0xf5f2c8, transparent: true, opacity: 0.45, emissive: 0x6a5a20, clippingPlanes: cl }));
    this.splash = new Pool(scene, 220, sph, new THREE.MeshBasicMaterial({ color: 0xffb347, clippingPlanes: cl }));
    this.jet = new Pool(scene, 260, sph, new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.85 }));
    this.gas = new Pool(scene, 260, sph, new THREE.MeshBasicMaterial({ color: 0x9aa7b4, transparent: true, opacity: 0.7 }));
    this.alloy = new Pool(scene, 60, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.8, roughness: 0.3 }));
    this.acc = { b: 0, t: 0, c: 0, s: 0, j: 0, g: 0 };
    this.buildPath();
    for (let i = 0; i < 160; i++) this.tracers.spawn({ u: Math.random(), pos: new THREE.Vector3(), r: 0.045 });
    this.duct = new THREE.CatmullRomCurve3(eq.parts.ductPath);
  }

  buildPath() {
    const g = this.g, sx = g.sx, H = g.ladle_bath_depth;
    this.loop = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-sx, -H * 0.55, 0.3), new THREE.Vector3(-sx, -g.immersion - 0.05, 0), new THREE.Vector3(-sx, g.h_vb0 - 0.2, 0),
      new THREE.Vector3(-sx * 0.6, g.h_vb0 + 0.15, 0.2), new THREE.Vector3(sx * 0.6, g.h_vb0 + 0.15, -0.2), new THREE.Vector3(sx, g.h_vb0 - 0.2, 0),
      new THREE.Vector3(sx, -g.immersion - 0.1, 0), new THREE.Vector3(sx * 1.1, -H * 0.6, 0.4), new THREE.Vector3(0, -H * 0.85, -g.ladle_D * 0.25),
      new THREE.Vector3(-sx * 1.2, -H * 0.7, 0.5)], true);
    this.loopLen = this.loop.getLength();
  }

  update(dt, v, opts = {}) {
    const g = this.g, sx = g.sx, rs = g.snorkel_D / 2;
    const levelY = -v.levelDrop;
    const vesselTop = g.h_vb0 + v.vesselDepth;
    const topUp = v.lifted ? vesselTop : levelY;
    dt = Math.min(dt, 0.05) * (opts.paused ? 0 : 1);
    // ---- Ar lift bubbles (rate ~ argon, growth ~ expansion)
    this.acc.b += dt * (v.argon / 2500) * 140;
    while (this.acc.b > 1) { this.acc.b -= 1; const a = Math.random() * Math.PI * 2, rr = rs * 0.85;
      this.bubbles.spawn({ pos: new THREE.Vector3(-sx + Math.cos(a) * rr, -g.immersion + g.nozzle_h, Math.sin(a) * rr), r0: 0.035, r: 0.035, vy: 1.2 + Math.random() * 0.5 }); }
    this.bubbles.items = this.bubbles.items.filter((p) => {
      p.pos.y += p.vy * dt * (1 + 1.5 * v.expansion); p.pos.x += (-sx - p.pos.x) * 0.6 * dt;
      const h = (p.pos.y - (-g.immersion)) / Math.max(topUp + g.immersion, 0.1);
      p.r = p.r0 * (1 + 3.5 * v.expansion * Math.max(h, 0));
      if (v.lifted && p.pos.y > g.h_vb0) { p.pos.x += (Math.random() - 0.4) * dt * 1.2; }
      return p.pos.y < topUp + 0.02;
    });
    // ---- steel tracers along the circulation loop (speed ~ circulation rate)
    const speed = (v.circ / 200) * 0.09 + 0.002;
    for (const p of this.tracers.items) {
      p.u = (p.u + speed * dt * (0.8 + 0.4 * ((p.u * 997) % 1))) % 1;
      this.loop.getPointAt(p.u, p.pos);
      p.pos.z += Math.sin(p.u * 40) * 0.15;
      p.r = v.circ > 1 ? 0.05 : 0.03;
    }
    // ---- CO bubbles in vessel bath (rate ~ CO off-gas, inner site depth)
    const Rv = g.vessel_D / 2;
    if (v.lifted) {
      this.acc.c += dt * Math.min(v.co / 900, 3) * 90;
      while (this.acc.c > 1) { this.acc.c -= 1; const r = Math.sqrt(Math.random()) * (Rv - 0.15), a = Math.random() * 6.283;
        const d = Math.max(v.innerSite, 0.05);
        this.co.spawn({ pos: new THREE.Vector3(Math.cos(a) * r, vesselTop - Math.random() * Math.min(d, v.vesselDepth), Math.sin(a) * r), r: 0.03 + Math.random() * 0.04, vy: 0.7 }); }
      // splash droplets (rate ~ surface enhancement x argon)
      this.acc.s += dt * v.splash * (v.argon / 2500) * 6;
      while (this.acc.s > 1) { this.acc.s -= 1; const r = Math.random() * (Rv - 0.2), a = Math.random() * 6.283;
        this.splash.spawn({ pos: new THREE.Vector3(Math.cos(a) * r - sx * 0.6, vesselTop, Math.sin(a) * r), vel: new THREE.Vector3((Math.random() - 0.5) * 1.5, 2 + Math.random() * 3 * v.expansion, (Math.random() - 0.5) * 1.5), r: 0.03 }); }
    }
    this.co.items = this.co.items.filter((p) => { p.pos.y += p.vy * dt; p.r *= 1 + dt * 0.8; return v.lifted && p.pos.y < vesselTop; });
    this.splash.items = this.splash.items.filter((p) => { p.vel.y -= 9.8 * dt; p.pos.addScaledVector(p.vel, dt); return p.pos.y > vesselTop - 0.05; });
    // ---- O2 jets from tuyeres
    if (v.o2 > 0 && v.lifted) {
      this.acc.j += dt * (v.o2 / 2000) * 160;
      while (this.acc.j > 1) { this.acc.j -= 1; const t = this.eq.parts.tuyeres[Math.floor(Math.random() * this.eq.parts.tuyeres.length)]; if (!t) break;
        const dir = new THREE.Vector3(-Math.cos(t.a), 0.15 + Math.random() * 0.2, -Math.sin(t.a)).normalize();
        this.jet.spawn({ pos: new THREE.Vector3(Math.cos(t.a) * Rv, g.h_vb0 + g.tuyere_h, Math.sin(t.a) * Rv), vel: dir.multiplyScalar(2.5 + Math.random()), r: 0.06, life: 0.6 }); }
    }
    this.jet.items = this.jet.items.filter((p) => { p.pos.addScaledVector(p.vel, dt); p.life -= dt; p.r = 0.03 + 0.08 * p.life; return p.life > 0; });
    // ---- off-gas through duct (rate ~ CO + Ar flow, slowed by throttle)
    const gasRate = (v.co + v.argon * 0.06 + 20) / 600 * (0.3 + v.pumpThrottle);
    this.acc.g += dt * Math.min(gasRate, 4) * 40;
    while (this.acc.g > 1) { this.acc.g -= 1; this.gas.spawn({ u: 0, pos: new THREE.Vector3(), r: 0.07 + 0.05 * Math.random() }); }
    this.gas.items = this.gas.items.filter((p) => { p.u += dt * 0.18 * (0.5 + Math.min(gasRate, 2)); if (p.u >= 1) return false; this.duct.getPointAt(p.u, p.pos); return true; });
    // ---- alloy lumps
    if (opts.alloyDrop) { this.acc.al = (this.acc.al || 0) + dt * 25; while (this.acc.al > 1) { this.acc.al -= 1;
      const s = this.eq.parts.hopperPos; this.alloy.spawn({ pos: s.clone().add(new THREE.Vector3(Math.random() * 0.4, 0, Math.random() * 0.4)), vy: 0, r: 0.08 }); } }
    this.alloy.items = this.alloy.items.filter((p) => { p.vy -= 9.8 * dt; p.pos.y += p.vy * dt; p.pos.x += 0.6 * dt; return p.pos.y > vesselTop; });
    [this.bubbles, this.tracers, this.co, this.splash, this.jet, this.gas, this.alloy].forEach((pl) => pl.flush());
  }
}
