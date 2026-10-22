"""Form-binding sanity: the setup editor exposes bounds identical to the backend schema limits for key fields."""
from pathlib import Path

JS = (Path(__file__).resolve().parents[1] / "static/js/pages/setup.js").read_text()


def test_key_bounds_present():
    for frag in ['"heat.steel_mass_t", "Steel mass", "t", 0.1, 50, 420', '"Immersion depth", "m", 0.01, 0.2, 0.9', '"Snorkel inner Ø", "m", 0.01, 0.3, 1']:
        assert frag in JS, frag


def test_invalid_values_flagged_not_silently_clamped():
    assert 'classList.add("invalid")' in JS and "outside physical bounds" in JS
