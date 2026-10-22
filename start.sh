#!/usr/bin/env sh
# Render-safe start: bind 0.0.0.0:$PORT (default 10000)
set -e
exec uvicorn app:app --host 0.0.0.0 --port "${PORT:-10000}" --proxy-headers
