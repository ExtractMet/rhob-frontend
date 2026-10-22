"""Frontend health: own liveness + backend reachability (reported, not required for liveness)."""
from __future__ import annotations

import time

from .api_client import ApiClient

STARTED = time.time()


async def backend_status(client: ApiClient) -> dict:
    t0 = time.time()
    try:
        r = await client.get("readyz", retries=0)
        return {"reachable": True, "status_code": r.status_code, "body": r.json(), "latency_ms": (time.time() - t0) * 1e3}
    except Exception as exc:
        return {"reachable": False, "error": str(exc), "latency_ms": (time.time() - t0) * 1e3}
