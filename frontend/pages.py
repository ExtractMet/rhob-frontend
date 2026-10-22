"""Page registry: navigation order, titles, templates, required role, page script."""
from __future__ import annotations

PAGES = [
    {"slug": "overview", "n": "01", "title": "Operational Overview", "icon": "◉", "min_role": "Viewer"},
    {"slug": "plant3d", "n": "02", "title": "3D RH-OB Plant & Schematic", "icon": "⬢", "min_role": "Viewer"},
    {"slug": "setup", "n": "03", "title": "Heat Setup & Configuration", "icon": "⚙", "min_role": "Viewer"},
    {"slug": "trends", "n": "04", "title": "Live Trends & Reconciliation", "icon": "∿", "min_role": "Viewer"},
    {"slug": "physics", "n": "05", "title": "Model & Balance Ledger", "icon": "∑", "min_role": "Viewer"},
    {"slug": "vacuum", "n": "06", "title": "Vacuum, Pumps & Off-gas", "icon": "◌", "min_role": "Viewer"},
    {"slug": "oxygen", "n": "07", "title": "Oxygen, Argon & Circulation", "icon": "↻", "min_role": "Viewer"},
    {"slug": "composition", "n": "08", "title": "Decarburization & H/N Degassing", "icon": "C", "min_role": "Viewer"},
    {"slug": "cleanliness", "n": "09", "title": "Deoxidation, Alloying & Cleanliness", "icon": "◇", "min_role": "Viewer"},
    {"slug": "thermal", "n": "10", "title": "Thermal Management & Refractory", "icon": "♨", "min_role": "Viewer"},
    {"slug": "whatif", "n": "11", "title": "What-if & Batch Scenarios", "icon": "⇄", "min_role": "Viewer"},
    {"slug": "optimizer", "n": "12", "title": "Optimizer & Recommendations", "icon": "★", "min_role": "Viewer"},
    {"slug": "alarms", "n": "13", "title": "Alarms, Interlocks & Events", "icon": "⚠", "min_role": "Viewer"},
    {"slug": "history", "n": "14", "title": "History, Estimation & Validation", "icon": "⌚", "min_role": "Viewer"},
    {"slug": "economics", "n": "15", "title": "Economics, Consumption & Material I/O", "icon": "₹", "min_role": "Viewer"},
    {"slug": "admin", "n": "16", "title": "Admin, Connectivity & Docs", "icon": "☰", "min_role": "Viewer"},
]
SLUGS = {p["slug"]: p for p in PAGES}
