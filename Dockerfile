# Fire Santa Run — production container image
#
# Builds the React SPA and the Hono API server, then assembles a minimal
# runtime image. Ships to Azure Container Apps (see infra/), which scales the
# whole service to zero when idle and back up on the next request — the
# realtime WebSocket hub lives in this same process (see
# server/src/realtime/), so there is nothing else to deploy.
#
# Layout inside the image matches local dev (repo root as cwd):
#   /app/dist/            React build (served as static files)
#   /app/server/dist/     Compiled Hono server
#   /app/server/node_modules/   Production-only server deps
#
# Vite bakes VITE_* values into the client bundle at BUILD time, so they must
# be passed as --build-arg (see infra/deploy.sh). They are not secrets that
# need runtime protection (they end up in the shipped JS either way) — the
# real secrets (Stripe keys, storage connection string, etc.) are read at
# runtime from environment variables set on the Container App.

# ---- Stage 1: build the React SPA ----
FROM node:22-alpine AS client-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

ARG VITE_MAPBOX_TOKEN
ARG VITE_ENTRA_CLIENT_ID
ARG VITE_ENTRA_TENANT_ID
ARG VITE_ENTRA_AUTHORITY
ARG VITE_ENTRA_REDIRECT_URI
ARG VITE_APP_NAME="Fire Santa Run"
ENV VITE_DEV_MODE=false \
    VITE_MAPBOX_TOKEN=${VITE_MAPBOX_TOKEN} \
    VITE_ENTRA_CLIENT_ID=${VITE_ENTRA_CLIENT_ID} \
    VITE_ENTRA_TENANT_ID=${VITE_ENTRA_TENANT_ID} \
    VITE_ENTRA_AUTHORITY=${VITE_ENTRA_AUTHORITY} \
    VITE_ENTRA_REDIRECT_URI=${VITE_ENTRA_REDIRECT_URI} \
    VITE_APP_NAME=${VITE_APP_NAME}
RUN npm run build

# ---- Stage 2: build the Hono server ----
FROM node:22-alpine AS server-build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# ---- Stage 3: runtime ----
FROM node:22-alpine AS runtime
ARG COMMIT_SHA=unknown
ENV NODE_ENV=production \
    PORT=8080 \
    COMMIT_SHA=${COMMIT_SHA}
WORKDIR /app

# Production server dependencies only (no devDependencies, no client toolchain).
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev && npm cache clean --force

COPY --from=server-build /app/server/dist ./server/dist
COPY --from=client-build /app/dist ./dist

EXPOSE 8080
USER node
CMD ["node", "server/dist/main.js"]
