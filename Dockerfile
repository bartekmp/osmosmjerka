FROM python:3.14-slim@sha256:6a27522252aef8432841f224d9baaa6e9fce07b07584154fa0b9a96603af7456 AS backend
WORKDIR /app
COPY backend/ backend/
COPY pyproject.toml pyproject.toml

# Copy .env if it exists (for local builds to override env vars)
# Note: This requires .env to exist.
# COPY .env backend/.env

FROM node:24-slim@sha256:e8e2e91b1378f83c5b2dd15f0247f34110e2fe895f6ca7719dbb780f929368eb AS frontend
WORKDIR /app
COPY frontend/ frontend/
WORKDIR /app/frontend
COPY frontend/public public/
RUN npm install

# Accept VERSION build arg and expose it to Vite
ARG VERSION
ENV NODE_ENV=production
ENV VITE_BASE_PATH=/static/
ENV VITE_APP_VERSION=${VERSION}
RUN npm run build

FROM python:3.14-slim@sha256:6a27522252aef8432841f224d9baaa6e9fce07b07584154fa0b9a96603af7456
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

# If using HTTP or reverse proxy
EXPOSE 8085
WORKDIR /app/backend
CMD ["uvicorn", "osmosmjerka.app:app", "--host", "0.0.0.0", "--port", "8085"]

# If using HTTPS
# Add privkey.pem and cert.pem to the ./backend directory before building the image
# EXPOSE 443
# CMD ["uvicorn", "osmosmjerka.app:app", "--host", "0.0.0.0", "--port", "443", "--ssl-keyfile=/app/privkey.pem", "--ssl-certfile=/app/cert.pem"]
