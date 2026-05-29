# Vite 8 / React 19 SPA -> static files served by nginx.
# Uses glibc (slim) for the builder because Vite 8's rolldown bundler doesn't
# ship musl/alpine native bindings.

FROM node:22-slim AS deps
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY frontend/package.json ./frontend/package.json
COPY pnpm-workspace.yaml package.json ./
# pnpm fetch needs the workspace topology but only frontend deps are pulled
RUN pnpm --filter @shopcart/frontend install --frozen-lockfile=false

FROM deps AS build
COPY frontend ./frontend
ENV NODE_ENV=production
RUN pnpm --filter @shopcart/frontend build

FROM nginx:1.27-alpine AS runner
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
