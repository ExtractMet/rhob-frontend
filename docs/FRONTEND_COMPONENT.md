# Three.js RH-OB 3D component (`components/rhob_3d`)

Source: `components/rhob_3d/src/` (native ES modules) → copied unchanged to `static/js/rhob3d/` by
`python scripts/build_component.py` (no bundler; `--check` fails CI if the copy is stale). Vendored libraries:
three.js r160 (`static/vendor/three/three.module.min.js`, OrbitControls addon) and plotly.js 2.35.2, pinned in
`components/rhob_3d/package.json` / `package-lock.json`; `npm ci && npm run vendor` re-vendors them.

| Module | Responsibility |
|---|---|
| `EquipmentGeometry.js` | original procedural geometry from the backend geometry packet (ladle with lining layers & lift, snorkels, Ar nozzle ring, lower/upper vessel, tuyeres, duct, cooler, ejectors, condensers, stack, hopper); heat-shading colour maps |
| `StateBridge.js` | binds `/api/v1/simulations/{id}/visual` packets to visual drivers (level drop, vessel depth, circulation, argon, expansion ∝ ln(P_atm/P), O₂, CO, splash, temperatures, throttle); interpolation between packets |
| `AnimationController.js` | instanced particles: Ar bubbles (gas, spheres), steel tracers (liquid, octahedra), CO bubbles, splash, O₂ jets, off-gas, alloy lumps — all rates from state |
| `RHOBScene.js` | renderer (clipping-plane cutaway, pixel-ratio cap), camera fit & presets, OrbitControls, lights, arrows, HTML labels, ray-cast inspection, visibility throttling |
| `index.js` | `mountRHOB(container, cfg)` lifecycle, HUD, stage badge, inspection panel, playback scrubber, time compression, keyboard, WebGL check → `onFallback` |

Lifecycle: page script fetches `/visual` → `mountRHOB` → `setPackets()` on every refresh (follows the latest
packet unless the user scrubbed) → `seekTime/seekStage`. Rendering pauses when the tab is hidden.
Disclaimer shown on screen: schematic visualization bound to model state, not a CFD volume render.
