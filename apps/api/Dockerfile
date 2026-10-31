# syntax=docker/dockerfile:1
# Build context: the repository root (pnpm workspace).

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Only the manifests, so dependencies are cached until one of them changes.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @hostly/api...

# Development: the source is bind-mounted by docker compose and reloaded by tsx.
FROM deps AS dev
COPY tsconfig.base.json ./
COPY apps/api apps/api
WORKDIR /repo/apps/api
EXPOSE 3333
CMD ["pnpm", "dev"]

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api apps/api
RUN pnpm --filter @hostly/api build \
 && pnpm --filter @hostly/api deploy --prod --legacy /out

FROM node:${NODE_VERSION}-alpine AS prod
ENV NODE_ENV=production \
    PORT=3333
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 3333
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" > /dev/null || exit 1
CMD ["node", "dist/server.js"]
