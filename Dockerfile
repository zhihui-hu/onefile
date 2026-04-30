# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

FROM base AS deps

ENV HUSKY=0

RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

FROM base AS builder

ENV NEXT_TELEMETRY_DISABLED=1
ENV HUSKY=0

COPY --from=deps --link /app/node_modules ./node_modules
COPY . .

RUN pnpm build

FROM base AS node-runtime

RUN apk add --no-cache binutils \
  && strip --strip-all /usr/local/bin/node

FROM alpine:3.23 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=27507
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache ca-certificates libc6-compat libstdc++ \
  && addgroup -S -g 1001 nodejs \
  && adduser -S -D -H -u 1001 -G nodejs nextjs \
  && mkdir -p /app/data \
  && chown nextjs:nodejs /app /app/data

COPY --from=node-runtime --link /usr/local/bin/node /usr/local/bin/node
COPY --from=builder --chown=nextjs:nodejs --link /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs --link /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs --link /app/public ./public

USER nextjs

EXPOSE 27507
VOLUME ["/app/data"]

STOPSIGNAL SIGTERM

CMD ["node", "server.js"]
