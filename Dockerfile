FROM node:24-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/guest-pwa/package.json apps/guest-pwa/package.json
COPY apps/staff/package.json apps/staff/package.json
COPY apps/owner/package.json apps/owner/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
ENV SERVE_FRONTENDS=true
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]
