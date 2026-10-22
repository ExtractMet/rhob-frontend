"""Server-to-server client for the rhob-backend FastAPI contract.

The frontend NEVER imports backend Python modules: everything crosses the HTTP API.
Retries are limited to idempotent GETs; POSTs carry an Idempotency-Key when given.
"""
from __future__ import annotations

import asyncio
from typing import Any, Optional

import httpx

from .config import get_settings

ALLOWED_PREFIXES = ("api/v1/", "healthz", "readyz", "docs", "openapi.json")


def allowed_path(path: str) -> bool:
    return path.startswith(ALLOWED_PREFIXES) and ".." not in path


class ApiClient:
    def __init__(self, base_url: Optional[str] = None, timeout: Optional[float] = None, transport=None):
        s = get_settings()
        self.base = (base_url or s.api_base_url).rstrip("/")
        self.timeout = timeout or s.request_timeout_s
        self._transport = transport

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.base, timeout=self.timeout, transport=self._transport)

    async def get(self, path: str, token: Optional[str] = None, params: Optional[dict] = None, retries: int = 2) -> httpx.Response:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        last = None
        for i in range(retries + 1):
            try:
                async with self._client() as c:
                    return await c.get("/" + path.lstrip("/"), headers=headers, params=params)
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.RemoteProtocolError) as exc:
                last = exc
                await asyncio.sleep(0.5 * (i + 1))
        raise last

    async def request(self, method: str, path: str, token: Optional[str] = None, json: Any = None,
                      params: Optional[dict] = None, headers: Optional[dict] = None) -> httpx.Response:
        h = dict(headers or {})
        if token:
            h["Authorization"] = f"Bearer {token}"
        async with self._client() as c:
            return await c.request(method, "/" + path.lstrip("/"), headers=h, json=json, params=params)

    async def login(self, account: str) -> dict:
        r = await self.request("POST", "api/v1/auth/demo-login", json={"account": account})
        r.raise_for_status()
        return r.json()
