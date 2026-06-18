# Slim Railway image — Next.js web only (no worker services in the image).
FROM oven/bun:1.3.3 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY packages/auth/package.json ./packages/auth/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY packages/agent-core/package.json ./packages/agent-core/
COPY packages/integration-core/package.json ./packages/integration-core/
COPY packages/graph-core/package.json ./packages/graph-core/

COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY services ./services
COPY turbo.json ./

RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client \
  && rm -rf /var/lib/apt/lists/*

ENV RAILWAY_ENV=true
ENV NEXT_PUBLIC_SLIM_DEPLOY=true

RUN bun install --frozen-lockfile
RUN bunx turbo run build --filter=@cortex/web

FROM oven/bun:1.3.3 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV RAILWAY_ENV=true
ENV NEXT_PUBLIC_SLIM_DEPLOY=true

COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/apps/web ./apps/web
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/node_modules ./node_modules

WORKDIR /app/apps/web
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/api/health').then(r=>r.json()).then(j=>process.exit(j.db?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "start"]
