FROM node:24-bookworm-slim
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/guest-pwa/package.json apps/guest-pwa/package.json
COPY apps/staff/package.json apps/staff/package.json
COPY packages/shared/package.json packages/shared/package.json
# Switch to --frozen-lockfile once the registry-dependent lockfile gap is resolved.
RUN pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm build
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "--import", "tsx", "apps/api/src/server.ts"]
