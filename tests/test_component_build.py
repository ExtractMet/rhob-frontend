import subprocess
import sys
from pathlib import Path


def test_component_build_is_current():
    root = Path(__file__).resolve().parents[1]
    r = subprocess.run([sys.executable, str(root / "scripts/build_component.py"), "--check"], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
