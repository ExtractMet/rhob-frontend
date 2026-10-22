// Binds backend state packets (GET /api/v1/simulations/{id}/visual) to visual parameters.
// Every animated quantity is derived from a model state value - no decorative randomness.
export class StateBridge {
  constructor(geometry, packets) { this.g = geometry; this.packets = packets || []; this.idx = 0; }
  setPackets(p) { this.packets = p || []; this.idx = Math.min(this.idx, Math.max(this.packets.length - 1, 0)); }
  get length() { return this.packets.length; }
  at(i) {
    const n = this.packets.length;
    if (!n) return null;
    const k = Math.min(Math.max(i, 0), n - 1);
    const p = this.packets[Math.floor(k)];
    const q = this.packets[Math.min(Math.floor(k) + 1, n - 1)];
    const f = k - Math.floor(k);
    const lerp = (a, b) => (a == null ? b : b == null ? a : a + (b - a) * f);
    const out = {};
    for (const key in p) out[key] = typeof p[key] === "number" ? lerp(p[key], q[key]) : p[key];
    return out;
  }
  visual(s) {
    // map physical state -> visual drivers (qualitative scaling, documented on screen)
    if (!s) return null;
    const P = s.P_Pa || 101325;
    return {
      levelDrop: s.ladle_level_drop_m || 0,
      vesselDepth: s.vessel_depth_m || 0,
      lifted: (s.M_v_kg || 0) > 100,
      circ: s.q_circ_t_min || 0,                        // t/min -> tracer speed
      argon: s.argon_NL_min || 0,                       // -> bubble emission rate
      expansion: Math.min(Math.log(Math.max(101325 / P, 1)) / Math.log(2000), 1), // bubble growth with vacuum
      o2: s.oxygen_Nm3_h || 0,                          // -> jet particles
      co: s.offgas_CO_Nm3_h || 0,                       // -> CO bubbles / duct flow
      splash: s.surface_factor || 0,
      innerSite: s.inner_site_depth_m || 0,
      TL: s.T_l_K || s.T_bulk_K, TV: s.T_v_K || s.T_bulk_K,
      hotLadle: s.T_ladle_hotface_K, hotVessel: s.T_vlow_hotface_K, slagT: s.T_slag_K,
      pumpThrottle: s.pump_throttle || 0, P,
    };
  }
}
