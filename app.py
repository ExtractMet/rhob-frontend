"""rhob-frontend: Python web server for the RH-OB operator desk (HTML + CSS + Three.js + Plotly.js).

* Renders page shells with Jinja2 (Python), styles with hand-written CSS, 3D with Three.js.
* Backend-for-frontend (BFF) proxy at /bff/... forwards to API_BASE_URL server-to-server and
  attaches the user's backend token from the signed session cookie. Only allow-listed backend
  paths are proxied. There is no plant command path.

Start (Render / local):
    uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000}
"""
from __future__ import annotations

import os

for _v in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS"):
    os.environ.setdefault(_v, "1")

import httpx
from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

from frontend import auth
from frontend.api_client import ApiClient, allowed_path
from frontend.config import APP_TITLE, BASE_DIR, FRONTEND_VERSION, get_settings
from frontend.health import backend_status
from frontend.pages import PAGES, SLUGS

settings = get_settings()
app = FastAPI(title="RH-OB Operator Desk (frontend)", version=FRONTEND_VERSION, docs_url=None, redoc_url=None)
app.add_middleware(SessionMiddleware, secret_key=settings.session_secret, same_site="lax",
                   https_only=settings.https_only_cookies, max_age=12 * 3600)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
client = ApiClient()


async def ensure_login(request: Request):
    if not request.session.get("token"):
        try:
            data = await client.login(settings.default_demo_account)
            auth.set_login(request, data)
        except Exception:
            pass  # backend down: pages still render and show the connectivity banner


def ctx(request: Request, page: dict, **kw):
    u = auth.current(request)
    return {"request": request, "pages": PAGES, "page": page, "title": APP_TITLE, "user": u["user"], "role": u["role"],
            "logged_in": bool(u["token"]), "version": FRONTEND_VERSION, "brand": settings.plant_brand, **kw}


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return RedirectResponse("/page/overview")


@app.get("/page/{slug}", response_class=HTMLResponse)
async def page(slug: str, request: Request):
    p = SLUGS.get(slug)
    if p is None:
        return HTMLResponse("page not found", status_code=404)
    await ensure_login(request)
    return templates.TemplateResponse(request, f"{slug}.html", ctx(request, p))


@app.post("/login")
async def login(request: Request, account: str = Form(...), next: str = Form("/page/overview")):
    if account not in auth.DEMO_ACCOUNTS:
        return PlainTextResponse("unknown demo account", status_code=400)
    try:
        data = await client.login(account)
    except httpx.HTTPStatusError as exc:
        return PlainTextResponse(f"login rejected by backend: {exc.response.text}", status_code=403)
    except Exception as exc:
        return PlainTextResponse(f"backend unreachable: {exc}", status_code=502)
    auth.set_login(request, data)
    return RedirectResponse(next if next.startswith("/") else "/", status_code=303)


@app.post("/logout")
async def logout(request: Request):
    auth.logout(request)
    return RedirectResponse("/page/overview", status_code=303)


@app.get("/whoami")
async def whoami(request: Request):
    u = auth.current(request)
    return {"user": u["user"], "role": u["role"], "logged_in": bool(u["token"])}


@app.get("/healthz")
async def healthz():
    return {"status": "ok", "component": "rhob-frontend", "version": FRONTEND_VERSION}


@app.get("/readyz")
async def readyz():
    b = await backend_status(client)
    return JSONResponse({"frontend": "ok", "backend": b, "api_base_url": settings.api_base_url},
                        status_code=200 if b.get("reachable") else 503)


@app.api_route("/bff/{path:path}", methods=["GET", "POST", "DELETE"])
async def bff(path: str, request: Request):
    """Backend-for-frontend proxy (allow-listed, token attached server-side)."""
    if not allowed_path(path):
        return JSONResponse({"error": "path not allowed"}, status_code=403)
    token = request.session.get("token")
    params = dict(request.query_params)
    if path.startswith("api/v1/stream/"):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        if request.headers.get("last-event-id"):
            headers["Last-Event-ID"] = request.headers["last-event-id"]
        cl = httpx.AsyncClient(base_url=settings.api_base_url, timeout=None)
        req = cl.build_request("GET", "/" + path, headers=headers, params=params)
        r = await cl.send(req, stream=True)

        async def relay():
            try:
                async for chunk in r.aiter_raw():
                    yield chunk
            finally:
                await r.aclose()
                await cl.aclose()
        return StreamingResponse(relay(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
    body = None
    if request.method == "POST":
        raw = await request.body()
        body = None if not raw else (await request.json())
    hdrs = {}
    for h in ("idempotency-key", "if-match"):
        if request.headers.get(h):
            hdrs[h] = request.headers[h]
    try:
        r = await client.request(request.method, path, token=token, json=body, params=params, headers=hdrs)
    except httpx.HTTPError as exc:
        return JSONResponse({"error": "backend unreachable", "detail": str(exc), "api_base_url": settings.api_base_url},
                            status_code=502)
    out_headers = {k: v for k, v in r.headers.items() if k.lower() in ("etag", "content-disposition", "idempotent-replay")}
    return Response(content=r.content, status_code=r.status_code, media_type=r.headers.get("content-type", "application/json"),
                    headers=out_headers)


@app.get("/api-docs")
async def api_docs():
    """Swagger UI lives on the backend service (it loads its own /openapi.json)."""
    return RedirectResponse(settings.api_base_url + "/docs")


@app.get("/docs-view/{name}", response_class=HTMLResponse)
async def docs_view(name: str, request: Request):
    """Render bundled markdown documentation (frontend docs folder)."""
    import html
    safe = {p.stem: p for p in (BASE_DIR / "docs").glob("*.md")}
    if name not in safe:
        return HTMLResponse("not found", status_code=404)
    txt = safe[name].read_text(encoding="utf-8")
    return HTMLResponse(f"<html><head><link rel='stylesheet' href='/static/css/style.css'></head><body class='doc'>"
                        f"<pre class='md'>{html.escape(txt)}</pre></body></html>")
