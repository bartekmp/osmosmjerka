FROM python:3.12-slim AS backend
WORKDIR /app
COPY backend/ backend/

FROM node:20-slim AS frontend
WORKDIR /app
COPY frontend/ frontend/
WORKDIR /app/frontend
RUN npm install && npm run build

FROM python:3.12-slim

LABEL maintainer="bartekmp"
LABEL version="0.1"
LABEL description="Dockerfile for a Python backend with a Node.js frontend wordsearch game app called Osmosmjerka."

WORKDIR /app
COPY --from=backend /app/backend /app/backend
COPY --from=frontend /app/backend/static /app/backend/static
WORKDIR /app/backend
RUN pip install -r requirements.txt
CMD ["python", "app.py"]
