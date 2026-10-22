# rhob-frontend — RH-OB Operator Desk (Python + CSS + Three.js)

Industrial Level-2-style operator desk for the **RH-OB Process Control and Digital Twin** by
**Extractmet Private Limited**. Engineering demonstration — **not connected to plant controls**.

* **Python** (FastAPI + Jinja2) web server renders 16 pages and proxies all API calls server-to-server (`/bff/*`, allow-listed; the backend token stays in a signed session cookie).
* **CSS** industrial theme (dark/light), responsive grids, tiles, tables, advisory cards.
* **Three.js** interactive 3D RH-OB plant (cutaway, state-bound particles, playback, inspection) + **Plotly.js** trends.
* Talks only to the backend repository: <https://github.com/<org>/rhob-backend> (set `API_BASE_URL`).

## Pages
01 Overview · 02 3D Plant & Schematic · 03 Heat Setup (capacity presets 100–350 t, dimensions, refractory, schedule) ·
04 Live Trends & Reconciliation · 05 Model & Balance Ledger · 06 Vacuum/Off-gas · 07 Oxygen/Argon/Circulation ·
08 Decarburization & H/N · 09 Deoxidation/Alloying/Cleanliness · 10 Thermal & Refractory · 11 What-if ·
12 Optimizer · 13 Alarms & Events · 14 History/EKF/ML validation · 15 Economics & Material I/O · 16 Admin & Docs.

## Run locally
```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
API_BASE_URL=http://localhost:8000 uvicorn app:app --host 0.0.0.0 --port 8501
```
Tests: `pip install -r requirements-dev.txt && pytest -q tests` (e2e: `E2E_FRONTEND_URL=http://localhost:8501 pytest tests/e2e`).

## Deploy on Render
Web Service (Python, **not** a static site) — `render.yaml` provided. Build `pip install -r requirements.txt &&
python scripts/build_component.py --check`, start `./start.sh`, health `/healthz`, env `API_BASE_URL`,
`FRONTEND_SESSION_SECRET`, `COOKIE_SECURE=true`. Full guide: `RHOB_Deployment_Guide` in the release.

## Layout
```
app.py                     FastAPI server (pages, login, BFF proxy, health)
frontend/                  api_client, auth, config, pages registry, units, export, health
templates/                 base.html, _controls.html, 16 page templates
static/css/style.css       theme
static/js/                 common.js (runtime), charts.js, widgets.js, schematic.js, pages/*.js, rhob3d/ (built component)
static/vendor/             three.js r160, plotly.js 2.35.2 (MIT licences included)
components/rhob_3d/        Three.js component source, package.json/lock, vendor script
config/                    ui_theme.yaml, frontend_schema.json
docs/                      OPERATOR_MANUAL, FRONTEND_COMPONENT, ACCESSIBILITY, TROUBLESHOOTING
tests/                     unit/integration tests + Playwright e2e smoke
```
Note: the original brief specified Streamlit; per the client's instruction the GUI is Python + CSS + Three.js.
© 2026 Extractmet Private Limited — see LICENSE.
