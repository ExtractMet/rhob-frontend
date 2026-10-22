import asyncio

import httpx

from frontend.api_client import ApiClient, allowed_path


def test_allowlist():
    assert allowed_path("api/v1/simulations")
    assert allowed_path("healthz")
    assert not allowed_path("admin/secret")
    assert not allowed_path("api/v1/../../etc/passwd")


def test_token_attached_server_side():
    seen = {}

    def h(req):
        seen["auth"] = req.headers.get("authorization")
        return httpx.Response(200, json={})
    c = ApiClient(base_url="http://x", transport=httpx.MockTransport(h))
    asyncio.run(c.request("GET", "api/v1/metadata", token="abc"))
    assert seen["auth"] == "Bearer abc"
