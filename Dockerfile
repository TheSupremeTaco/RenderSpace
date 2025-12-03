# ============================
# Stage 1: Build Vite frontend
# ============================
FROM node:20 AS frontend-builder

WORKDIR /app

# Install frontend dependencies
COPY services/web/frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Copy the rest of the frontend and build
COPY services/web/frontend ./frontend
RUN cd frontend && npm run build
# Vite is configured to output to ../static, so now /app/static contains the built files.


# ============================
# Stage 2: Python + Flask app
# ============================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system deps (optional but useful)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
 && rm -rf /var/lib/apt/lists/*

# Install Python dependencies for the web service
COPY services/web/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code (Flask, static, etc.)
COPY services/web ./ 

# Overwrite static directory with built frontend assets from stage 1
COPY --from=frontend-builder /app/static ./static

# Cloud Run will inject PORT, default to 8080 for local use
# OLD:
# ENV FLASK_APP=app.routes \
#     PORT=8080
# NEW:
ENV FLASK_APP=app \
    PORT=8080

# Expose port for local docker run (Cloud Run ignores EXPOSE)
EXPOSE 8080

# Use gunicorn as the HTTP server
# OLD:
# CMD ["bash", "-c", "gunicorn -b 0.0.0.0:${PORT:-8080} app.routes:app"]
# NEW:
CMD ["bash", "-c", "gunicorn -b 0.0.0.0:${PORT:-8080} app:app"]
