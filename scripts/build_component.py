"""Reproducible build of the Three.js component: copies components/rhob_3d/src/*.js|css into
static/js/rhob3d/ (served as native ES modules; no bundler needed). Run after editing src.
`python scripts/build_component.py --check` exits 1 if the built copy is stale (used in CI)."""
from __future__ import annotations

import filecmp
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "components" / "rhob_3d" / "src"
DST = ROOT / "static" / "js" / "rhob3d"


def main():
    check = "--check" in sys.argv
    DST.mkdir(parents=True, exist_ok=True)
    stale = []
    for f in sorted(SRC.iterdir()):
        if f.suffix not in (".js", ".css"):
            continue
        d = DST / f.name
        if not d.exists() or not filecmp.cmp(f, d, shallow=False):
            stale.append(f.name)
            if not check:
                shutil.copy2(f, d)
    vendor = ROOT / "static" / "vendor"
    for need in ["three/three.module.min.js", "three/addons/controls/OrbitControls.js", "plotly.min.js"]:
        if not (vendor / need).exists():
            print(f"missing vendor file {need}: run `npm ci && npm run vendor` in components/rhob_3d")
            sys.exit(1)
    if check and stale:
        print("stale component build:", stale)
        sys.exit(1)
    print("component build OK" + (f" (updated {stale})" if stale and not check else ""))


if __name__ == "__main__":
    main()
