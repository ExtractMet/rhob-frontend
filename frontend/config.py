"""Frontend settings (environment variables only; no secrets in code)."""
from __future__ import annotations

import os
import secrets
from functools import lru_cache
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
APP_TITLE = "RH-OB Process Control & Digital Twin"
FRONTEND_VERSION = "1.0.0-demo"


class Settings:
    def __init__(self):
        self.api_base_url = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
        self.session_secret = os.getenv("FRONTEND_SESSION_SECRET") or secrets.token_hex(32)
        self.default_demo_account = os.getenv("DEMO_DEFAULT_ACCOUNT", "engineer")
        self.request_timeout_s = float(os.getenv("API_TIMEOUT_S", "180"))
        self.https_only_cookies = os.getenv("COOKIE_SECURE", "false").lower() == "true"
        self.plant_brand = os.getenv("PLANT_BRAND", "INDUSTRY-X")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
