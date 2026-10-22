// Copy pinned vendor libraries from node_modules into ../../static/vendor (licences included).
import { copyFileSync, mkdirSync } from "node:fs";
const out = new URL("../../../static/vendor/", import.meta.url).pathname;
const nm = new URL("../node_modules/", import.meta.url).pathname;
mkdirSync(out + "three/addons/controls", { recursive: true });
copyFileSync(nm + "three/build/three.module.min.js", out + "three/three.module.min.js");
copyFileSync(nm + "three/examples/jsm/controls/OrbitControls.js", out + "three/addons/controls/OrbitControls.js");
copyFileSync(nm + "three/LICENSE", out + "three/LICENSE");
copyFileSync(nm + "plotly.js-dist-min/plotly.min.js", out + "plotly.min.js");
copyFileSync(nm + "plotly.js-dist-min/LICENSE", out + "PLOTLY_LICENSE");
console.log("vendored three@0.160.0 and plotly.js-dist-min@2.35.2 into", out);
