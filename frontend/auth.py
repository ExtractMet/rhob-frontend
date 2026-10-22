"""Session helpers. The backend token is stored server-side in the signed session cookie and
attached by the BFF proxy; the browser never needs the token. Role checks are ALSO enforced
by the backend (frontend hiding alone is insufficient)."""
from __future__ import annotations

from fastapi import Request

ROLES = ["Viewer", "Operator", "Metallurgist", "ProcessEngineer", "Admin"]
DEMO_ACCOUNTS = {"viewer": "Viewer", "operator": "Operator", "metallurgist": "Metallurgist",
                 "engineer": "ProcessEngineer", "admin": "Admin"}


def current(request: Request) -> dict:
    return {"user": request.session.get("user", "anonymous"), "role": request.session.get("role", "Viewer"),
            "token": request.session.get("token")}


def set_login(request: Request, data: dict):
    request.session["user"] = data["user"]
    request.session["role"] = data["role"]
    request.session["token"] = data["token"]


def logout(request: Request):
    request.session.clear()


def role_at_least(role: str, needed: str) -> bool:
    return ROLES.index(role) >= ROLES.index(needed) if role in ROLES else False
