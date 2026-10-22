import sys
from pathlib import Path

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def fake_backend(request: httpx.Request) -> httpx.Response:
    p = request.url.path
    if p == "/api/v1/auth/demo-login":
        acc = __import__("json").loads(request.content)["account"]
        roles = {"viewer": "Viewer", "operator": "Operator", "engineer": "ProcessEngineer", "metallurgist": "Metallurgist", "admin": "Admin"}
        return httpx.Response(200, json={"token": f"tok-{acc}", "user": acc, "role": roles[acc]})
    if p == "/readyz":
        return httpx.Response(200, json={"ready": True})
    if p == "/api/v1/echo-auth" or p.startswith("/api/v1/metadata"):
        return httpx.Response(200, json={"auth": request.headers.get("authorization"), "banner": "SYNTHETIC"})
    return httpx.Response(404, json={"title": "not found"})


@pytest.fixture()
def client(monkeypatch):
    import app as frontend_app
    from frontend.api_client import ApiClient
    monkeypatch.setattr(frontend_app, "client", ApiClient(base_url="http://backend.test", transport=httpx.MockTransport(fake_backend)))
    from fastapi.testclient import TestClient
    return TestClient(frontend_app.app)
