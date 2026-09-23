# syntax=docker/dockerfile:1.7
# Build from the repo root:  docker build -f apps/api/Dockerfile -t jat-api .

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# ---- build: install, compile shared + api, produce a pruned production bundle ----
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/
COPY apps/api/ apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@jat/api..."
RUN pnpm --filter @jat/shared build \
 && pnpm --filter @jat/api generate \
 && pnpm --filter @jat/api build
# Self-contained copy of the api with production dependencies only.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm deploy --filter @jat/api --prod --legacy /out

# ---- runtime: small image, non-root user ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/v1/health/live || exit 1
# Single instance: applying migrations at start-up is safe and keeps deploys to one step.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
