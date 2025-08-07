FROM python:3.13-slim AS backend
WORKDIR /app
COPY backend/ backend/
COPY .env backend/.env
COPY pyproject.toml pyproject.toml

FROM node:20-slim AS frontend
WORKDIR /app
COPY frontend/ frontend/
WORKDIR /app/frontend
COPY frontend/public public/
RUN npm install

ENV NODE_ENV=production
ENV VITE_BASE_PATH=/static/
RUN npm run build

FROM python:3.13-slim
LABEL maintainer="bartekmp"
LABEL description="Dockerfile for a Python backend with a Node.js frontend wordsearch game app called Osmosmjerka with PostgreSQL."

WORKDIR /app
COPY --from=backend /app/backend /app/backend/
COPY --from=backend /app/pyproject.toml /app/
COPY --from=frontend /app/frontend/build /app/backend/static

ARG VERSION
ENV SETUPTOOLS_SCM_PRETEND_VERSION=$VERSION

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
