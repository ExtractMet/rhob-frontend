"""Display-unit conversions (mirrored in static/js/common.js for client-side rendering).
SI internal; operator display options: degC, mbar(abs), kPa(abs), Nm3/h, NL/min, ppm, wt%, t/min.
Normal conditions: 0 degC, 101.325 kPa."""
from __future__ import annotations

MOLAR_VOLUME_NORMAL_L = 22.414


def k_to_c(t: float) -> float:
    return t - 273.15


def pa_to_mbar(p: float) -> float:
    return p / 100.0


def pa_to_kpa(p: float) -> float:
    return p / 1000.0


def nl_min_to_nm3h(q: float) -> float:
    return q * 60.0 / 1000.0


def nm3h_to_nl_min(q: float) -> float:
    return q * 1000.0 / 60.0


def ppm_to_wtpct(x: float) -> float:
    return x / 1e4


def kg_s_to_t_min(q: float) -> float:
    return q * 0.06


UNIT_OPTIONS = {
    "temperature": ["degC", "K"],
    "pressure": ["mbar", "Pa", "kPa"],
    "gas": ["Nm3/h", "NL/min"],
    "composition": ["ppm", "wt%"],
}
