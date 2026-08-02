# Express gateway (proxies /api/shelfmind/* to the Python backend).
# Monorepo-aware: needs the whole pnpm workspace context to resolve
# @workspace/api-zod and @workspace/db. Build from repo root:
#   docker build -f artifacts/api-server/Dockerfile -t shelfmind-gateway .
FROM node:22-slim AS build
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.34.5 --activate

# Copy the whole workspace (lockfile-driven install needs every package.json
# in the workspace graph, not just api-server's).
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server... run build

FROM node:22-slim AS run
WORKDIR /app
COPY --from=build /workspace/artifacts/api-server/dist ./dist
COPY --from=build /workspace/artifacts/api-server/package.json ./package.json

ENV NODE_ENV=production
ENV ML_API_URL=http://backend:8000
ENV PORT=3000
EXPOSE 3000

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
