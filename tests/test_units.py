import pytest

from frontend import units as u


def test_conversions():
    assert u.k_to_c(1873.15) == pytest.approx(1600.0)
    assert u.pa_to_mbar(6700) == pytest.approx(67.0)
    assert u.nl_min_to_nm3h(2500) == pytest.approx(150.0)
    assert u.nm3h_to_nl_min(150) == pytest.approx(2500.0)
    assert u.ppm_to_wtpct(400) == pytest.approx(0.04)
    assert u.kg_s_to_t_min(3333.3) == pytest.approx(200.0, rel=1e-4)


def test_js_mirror_has_same_factors():
    js = (__import__("pathlib").Path(__file__).resolve().parents[1] / "static/js/common.js").read_text()
    assert "(q * 1000) / 60" in js and "p / 100" in js and "x / 1e4" in js and "k - 273.15" in js
