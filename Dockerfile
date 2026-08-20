# ── Stage 1: build React frontend ──────────────────────────────────────────────
FROM node:20-alpine AS build-frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ── Stage 2: production image ───────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Install backend deps
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built frontend into /app/public (served by Express)
COPY --from=build-frontend /frontend/dist ./public

# Data directory (SQLite DB)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data

EXPOSE 3001
# Expose MQTT relay port (only relevant when relay_enabled=true)
EXPOSE 1883

CMD ["node", "src/index.js"]
