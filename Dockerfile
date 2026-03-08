# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
# Bind to all interfaces so Docker port mapping works
ENV HOST=0.0.0.0

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist/ dist/

EXPOSE 3000

# Default: HTTP transport. Override CMD for stdio mode.
#   HTTP:  docker run -p 3000:3000 warframe-mcp
#   Stdio: docker run -i warframe-mcp node dist/index.js
CMD ["node", "dist/index.js", "--http"]
