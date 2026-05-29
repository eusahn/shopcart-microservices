# Shared multi-stage Dockerfile for every Node service in the monorepo.
# Build with:  docker build --build-arg SERVICE=catalog-service -t shopcart/catalog-service .
#
# Each service is built once with full workspace context (pnpm needs the workspace
# topology), then the runtime image only carries that service + its prod deps.

ARG NODE_VERSION=20.18-alpine

# ---------- deps ----------
FROM node:${NODE_VERSION} AS deps
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# Copy lockfile + workspace topology so pnpm fetch can warm the store
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY services ./services
RUN pnpm install --frozen-lockfile=false

# ---------- proto ----------
FROM deps AS proto
COPY proto ./proto
COPY buf.yaml buf.gen.yaml ./
RUN pnpm proto:gen

# ---------- builder ----------
FROM proto AS builder
ARG SERVICE
ENV SERVICE=${SERVICE}
RUN test -n "$SERVICE" || (echo "SERVICE build-arg is required" && exit 1)
RUN pnpm --filter "@shopcart/${SERVICE}..." build

# ---------- runner ----------
FROM node:${NODE_VERSION} AS runner
ARG SERVICE
ENV NODE_ENV=production
ENV SERVICE=${SERVICE}
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Bring just the deployed service's compiled output + its node_modules subtree.
COPY --from=builder /repo /repo
WORKDIR /repo/services/${SERVICE}

# Drop devDependencies for the slim runtime layer.
# `pnpm deploy` only accepts ONE project filter — no `...` recursive selector.
# It still pulls in the service's workspace deps from the lockfile.
RUN pnpm --filter "@shopcart/${SERVICE}" --prod deploy /app/svc

WORKDIR /app/svc
USER node
EXPOSE 8080 9090 50051

# Allow OTel to load before any business code
ENV NODE_OPTIONS="--enable-source-maps"
CMD ["node", "dist/index.js"]
