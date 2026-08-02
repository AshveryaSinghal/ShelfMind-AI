# React/Vite frontend, built then served as static files via nginx.
# Monorepo-aware, same reasoning as artifacts/api-server/Dockerfile.
# Build from repo root: docker build -f artifacts/shelfmind/Dockerfile -t shelfmind-web .
FROM node:22-slim AS build
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.34.5 --activate

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/shelfmind... run build

FROM nginx:alpine AS run
COPY --from=build /workspace/artifacts/shelfmind/dist /usr/share/nginx/html
# SPA fallback so client-side routes don't 404 on refresh.
RUN printf 'server {\n  listen 80;\n  location / {\n    root /usr/share/nginx/html;\n    try_files $uri /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
