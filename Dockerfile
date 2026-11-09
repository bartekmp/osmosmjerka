FROM python:3.15-slim@sha256:94d3426f1def7db4a106a232ac121bfd975393e5dfd40a619b955fae45fe7913 AS backend
WORKDIR /app
COPY backend/ backend/
COPY pyproject.toml pyproject.toml

# Copy .env if it exists (for local builds to override env vars)
# Note: This requires .env to exist.
# COPY .env backend/.env

FROM node:26-slim@sha256:e4db4c914bf8ad241bd24804fc25d272d89bad97e68cdc8a1414862790a02c39 AS frontend
WORKDIR /app
COPY frontend/ frontend/
WORKDIR /app/frontend
COPY frontend/public public/
RUN npm ci

# Accept VERSION build arg and expose it to Vite
ARG VERSION
ENV NODE_ENV=production
ENV VITE_BASE_PATH=/static/
ENV VITE_APP_VERSION=${VERSION}
RUN npm run build

FROM python:3.15-slim@sha256:94d3426f1def7db4a106a232ac121bfd975393e5dfd40a619b955fae45fe7913
LABEL maintainer="bartekmp"
LABEL description="Dockerfile for a Python backend with a Node.js frontend wordsearch game app called Osmosmjerka with PostgreSQL."

WORKDIR /app
COPY --from=backend /app/backend /app/backend/
COPY --from=backend /app/pyproject.toml /app/
COPY --from=frontend /app/frontend/build /app/backend/static

ARG VERSION
ENV SETUPTOOLS_SCM_PRETEND_VERSION=$VERSION

RUN apt-get update && apt-get install -y \
    build-essential gcc python3-dev libpq-dev libssl-dev pkg-config libffi-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN pip install .

# Ensure DEVELOPMENT_MODE is false in production
ENV DEVELOPMENT_MODE=false

# Numeric uid so Kubernetes can enforce runAsNonRoot.
RUN useradd --create-home --uid 10001 osmosmjerka
USER 10001

# If using HTTP or reverse proxy
EXPOSE 8085
WORKDIR /app/backend
CMD ["uvicorn", "osmosmjerka.app:app", "--host", "0.0.0.0", "--port", "8085"]

# If using HTTPS
# Add privkey.pem and cert.pem to the ./backend directory before building the image
# EXPOSE 443
# CMD ["uvicorn", "osmosmjerka.app:app", "--host", "0.0.0.0", "--port", "443", "--ssl-keyfile=/app/privkey.pem", "--ssl-certfile=/app/cert.pem"]
