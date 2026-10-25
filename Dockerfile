ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS standalone-files
COPY --from=builder /app/.next/standalone /app/standalone
RUN rm -rf /app/standalone/node_modules

FROM node:${NODE_VERSION}-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=standalone-files --chown=nextjs:nodejs /app/standalone ./
COPY --from=production-dependencies --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/db/migrations ./db/migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/db.mjs ./scripts/db.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/change-admin-password.mjs ./scripts/change-admin-password.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/reference-seed.mjs ./scripts/reference-seed.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/notifications/run-app.mjs ./scripts/notifications/run-app.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/notifications/worker.mjs ./scripts/notifications/worker.mjs

USER nextjs
EXPOSE 3000
CMD ["node", "scripts/notifications/run-app.mjs", "start"]
