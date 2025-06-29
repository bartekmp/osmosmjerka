FROM python:3.12-slim AS backend
WORKDIR /app
COPY backend/ backend/
COPY .env backend/.env

FROM node:20-slim AS frontend
WORKDIR /app
COPY frontend/ frontend/
WORKDIR /app/frontend
COPY frontend/public public/
RUN npm install && npm run build

FROM python:3.12-slim
LABEL maintainer="bartekmp"
LABEL version="0.1"
LABEL description="Dockerfile for a Python backend with a Node.js frontend wordsearch game app called Osmosmjerka."

WORKDIR /app
COPY --from=backend /app/backend /app
COPY --from=frontend /app/frontend/build /app/static

RUN pip install -r requirements.txt

# If using HTTP
# EXPOSE 8085
# CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8085"]

# If using HTTPS
# Add privkey.pem and cert.pem to the ./backend directory
EXPOSE 443
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "443", "--ssl-keyfile=/app/privkey.pem", "--ssl-certfile=/app/cert.pem"]
