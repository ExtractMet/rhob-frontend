import re

from frontend.pages import PAGES


def test_all_pages_render_with_safety_banner(client):
    for p in PAGES:
        r = client.get(f"/page/{p['slug']}")
        assert r.status_code == 200, p
        html = r.text
        assert "NOT CONNECTED TO PLANT CONTROLS" in html
        assert f"/static/js/pages/{p['slug']}.js" in html
        assert 'importmap' in html and "three.module.min.js" in html


def test_page_scripts_and_template_ids_exist(client):
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    for p in PAGES:
        assert (root / "static/js/pages" / f"{p['slug']}.js").exists()
        tpl = (root / "templates" / f"{p['slug']}.html").read_text()
        js = (root / "static/js/pages" / f"{p['slug']}.js").read_text()
        ids = set(re.findall(r'id="([A-Za-z0-9_]+)"', tpl)) | set(re.findall(r'id="([A-Za-z0-9_]+)"', js))
        used = set(re.findall(r'R\.\$\("#([A-Za-z0-9_]+)"\)', js)) | set(re.findall(r'C\.(?:ts|plot|bar)\("([A-Za-z0-9_]+)"', js))
        missing = {u for u in used if u not in ids} - {"vp", "fb2d"} if p["slug"] != "plant3d" else {u for u in used if u not in ids}
        assert not missing, (p["slug"], missing)


def test_health_endpoints(client):
    assert client.get("/healthz").json()["status"] == "ok"
    assert client.get("/readyz").status_code == 200


def test_vendor_assets_served(client):
    assert client.get("/static/vendor/three/three.module.min.js").status_code == 200
    assert client.get("/static/js/rhob3d/index.js").status_code == 200
    assert client.get("/static/vendor/plotly.min.js").status_code == 200
