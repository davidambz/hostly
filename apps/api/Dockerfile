# syntax=docker/dockerfile:1
# Build context: the repository root (pnpm workspace).

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
# COREPACK_HOME outside /root, so the pinned pnpm is usable by the node user offline.
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_HOME=/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# openssl lets Prisma detect the libssl version and pick the right schema engine.
RUN apk add --no-cache openssl \
 && corepack enable
WORKDIR /repo

# Download every package in the lockfile into the store. Depends only on the
# lockfile, so it stays cached until a dependency changes.
FROM base AS fetch
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .pnpmfile.cjs ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    corepack install \
 && pnpm fetch

FROM fetch AS source
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter @hostly/api... \
 && pnpm --filter @hostly/api db:generate

# Development: docker compose bind-mounts apps/api/src (tsx reloads on change) and
# apps/api/prisma, then regenerates the client and applies pending migrations on start.
FROM source AS dev
# node must own the app dir: the dev command regenerates src/generated and the tests
# write coverage/. (Its node_modules only holds symlinks, so this layer stays small.)
RUN chown -R node:node apps/api
USER node
WORKDIR /repo/apps/api
EXPOSE 3333
CMD ["sh", "-c", "pnpm db:generate && pnpm db:deploy && exec pnpm dev"]

# One-off job that applies pending migrations before a deploy (needs DATABASE_URL).
# Kept apart from prod so the runtime image does not carry the Prisma CLI.
FROM source AS migrate
USER node
WORKDIR /repo/apps/api
CMD ["pnpm", "db:deploy"]

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
