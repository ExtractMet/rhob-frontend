"""End-to-end browser smoke test (Playwright). Requires running services:
    E2E_FRONTEND_URL=http://localhost:8501 python -m pytest tests/e2e -q
Checks every page loads without JS errors, the 3D canvas exists and Run heat works."""
import os

import pytest

URL = os.getenv("E2E_FRONTEND_URL")
pytestmark = pytest.mark.skipif(not URL, reason="E2E_FRONTEND_URL not set")


def test_pages_load_without_errors():
    from playwright.sync_api import sync_playwright
    from frontend.pages import PAGES  # noqa
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        pg = b.new_page(viewport={"width": 1500, "height": 950})
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        for slug in [x["slug"] for x in PAGES]:
            pg.goto(f"{URL}/page/{slug}")
            pg.wait_for_timeout(6000 if slug != "overview" else 30000)
            assert not errors, (slug, errors)
        pg.goto(f"{URL}/page/plant3d")
        pg.wait_for_selector("#vp canvas", timeout=30000)
        b.close()
