# syntax=docker/dockerfile:1.7
# platform-frontend: supports dev (default target) and production targets
FROM node:20-alpine AS base
RUN corepack enable pnpm
WORKDIR /app/platform-frontend

COPY platform-frontend/package.json platform-frontend/pnpm-lock.yaml* ./
COPY game-sdk ../game-sdk
COPY anchor ./anchor
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm config set store-dir /pnpm/store && pnpm install
COPY platform-frontend ./

FROM base AS dev
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec next dev --turbopack -H 0.0.0.0 -p 3000"]

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build && pnpm prune --prod

FROM node:20-alpine AS production
RUN corepack enable pnpm
WORKDIR /app/platform-frontend
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/platform-frontend/package.json ./
COPY --from=builder /app/platform-frontend/node_modules ./node_modules
COPY --from=builder /app/platform-frontend/.next ./.next
COPY --from=builder /app/platform-frontend/public ./public
USER nextjs
EXPOSE 3000
CMD ["pnpm", "start"]
