# 使用本地/镜像站已有的 node 镜像，避免 Docker Hub 超时
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY docker/server.mjs ./server.mjs

ENV AI_HOST=ai
ENV AI_PORT=8080
ENV PORT=80

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
