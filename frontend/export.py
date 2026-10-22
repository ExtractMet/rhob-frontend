"""Server-side export helpers (CSV of trajectory records with the synthetic banner)."""
from __future__ import annotations

import csv
import io

BANNER = "SYNTHETIC DATA - ENGINEERING DEMONSTRATION - NOT VALIDATED FOR PLANT OPERATION"


def records_csv(records: list[dict], meta: dict | None = None) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([f"# {BANNER}"])
    if meta:
        w.writerow([f"# {k}={v}" for k, v in meta.items()])
    if not records:
        return buf.getvalue()
    keys = [k for k, v in records[0].items() if not isinstance(v, (dict, list))]
    w.writerow(keys)
    for r in records:
        w.writerow([r.get(k) for k in keys])
    return buf.getvalue()
