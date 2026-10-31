# syntax=docker/dockerfile:1
# Build context: the repository root (pnpm workspace).

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Download every package in the lockfile into the store. Depends only on the
# lockfile, so it stays cached until a dependency changes.
FROM base AS fetch
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm fetch

FROM fetch AS source
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter @hostly/api...

# Development: docker compose bind-mounts apps/api/src and tsx reloads on change.
FROM source AS dev
RUN chown -R node:node /repo
USER node
WORKDIR /repo/apps/api
EXPOSE 3333
CMD ["pnpm", "dev"]

FROM source AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @hostly/api build \
 && pnpm --filter @hostly/api deploy --prod --legacy /out

FROM node:${NODE_VERSION}-alpine AS prod
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3333
WORKDIR /app
COPY --from=build --chown=node:node /out .
USER node
EXPOSE 3333
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" > /dev/null || exit 1
CMD ["node", "dist/server.js"]
