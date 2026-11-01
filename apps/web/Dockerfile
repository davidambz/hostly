# syntax=docker/dockerfile:1
# Build context: the repository root (pnpm workspace).

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
# COREPACK_HOME outside /root, so the pinned pnpm is usable by the node user offline.
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_HOME=/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
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
# No install scripts: the root postinstall generates the API's Prisma Client, and the
# web app's own tools (Vite, rolldown) ship prebuilt binaries.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --ignore-scripts --filter @hostly/web...

# Development: docker compose bind-mounts src, public and index.html; Vite hot-reloads.
FROM source AS dev
# node must own the app dir: Vite writes its cache under node_modules/.vite.
RUN chown -R node:node apps/web
USER node
WORKDIR /repo/apps/web
EXPOSE 5173
CMD ["pnpm", "dev"]

FROM source AS build
# The API's public URL is baked into the bundle at build time.
ARG VITE_API_URL=http://localhost:3333
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @hostly/web exec vite build

# Production: static files behind nginx, as a non-root user on port 8080.
FROM nginxinc/nginx-unprivileged:1.30-alpine AS prod
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz > /dev/null || exit 1
