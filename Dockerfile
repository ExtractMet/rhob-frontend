# rhob-frontend container: Python (FastAPI + Jinja2) serving HTML/CSS/Three.js operator desk.
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=10000
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN python scripts/build_component.py --check && useradd -m rhob && chown -R rhob /srv
USER rhob
EXPOSE 10000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers"]
