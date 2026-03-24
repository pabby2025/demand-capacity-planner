# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /build/frontend
COPY app/frontend/package*.json ./
RUN npm ci --silent
COPY app/frontend/ ./
RUN npm run build

# ── Stage 2: Python backend + static files ────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app/backend

# Install Python deps
COPY app/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY app/backend/ ./

# Copy Excel dataset (bundled for auto-ingest on first startup)
COPY large_sample_dataset.xlsx ./large_sample_dataset.xlsx

# Copy React build output into FastAPI's static folder
COPY --from=frontend-build /build/frontend/dist ./static

# Azure App Service reads WEBSITES_PORT; expose 8000
EXPOSE 8000

ENV EXCEL_PATH=/app/backend/large_sample_dataset.xlsx

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
