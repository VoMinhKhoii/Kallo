# syntax=docker/dockerfile:1
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# Error reporting + product analytics. Both public (ingest-only keys) and both
# optional: empty → the SDKs never initialise. See docs/MONITORING.md.
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
# Paddle client-side token (public, price-preview only) for /pricing's live
# per-country prices. `test_` = sandbox, `live_` = production; empty → the page
# shows the message-file prices. See docs/BILLING.md → Pricing.
ARG NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
ENV NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
# Object storage (Cloudflare R2, docs/STORAGE.md). Both public: the avatar
# bucket's custom domain and the account id. The CSP's img-src is compiled at
# build from them; the R2 credentials themselves are runtime secrets only.
ARG NEXT_PUBLIC_AVATAR_BASE_URL
ARG R2_ACCOUNT_ID
ENV NEXT_PUBLIC_AVATAR_BASE_URL=$NEXT_PUBLIC_AVATAR_BASE_URL
ENV R2_ACCOUNT_ID=$R2_ACCOUNT_ID
# Source-map upload target; the auth token itself arrives as a BuildKit secret
# below so it never lands in an image layer.
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ENV NEXT_TELEMETRY_DISABLED=1

RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    bun run build

# Consolidate standalone assets: copy public/ and .next/static/ into standalone tree
RUN cp -r public .next/standalone/public && \
    cp -r .next/static .next/standalone/.next/static

FROM node:22-bookworm-slim AS runner
WORKDIR /app

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_AVATAR_BASE_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# Read at runtime by the server-side Sentry init (instrumentation.ts).
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_AVATAR_BASE_URL=$NEXT_PUBLIC_AVATAR_BASE_URL

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs nextjs

# Copy consolidated standalone tree (includes public/ and .next/static/)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# The card search worker runs outside the Next bundle (spawned by path from
# lib/ai/matching/cards/search-index/search-index.ts), so standalone output
# does not carry it: copy its files, and usearch (JS + the linux-x64 binary)
# with the packages it loads at runtime. CI loads the worker inside the built
# image (scripts/ci/card-index/check-runtime.mjs) before pushing it.
COPY --from=builder --chown=nextjs:nodejs \
  /app/lib/ai/matching/cards/search-index/worker.mjs \
  /app/lib/ai/matching/cards/search-index/search-core.mjs \
  /app/lib/ai/matching/cards/search-index/artifact-fetch.mjs \
  ./lib/ai/matching/cards/search-index/
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/usearch/package.json ./node_modules/usearch/package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/usearch/javascript/dist ./node_modules/usearch/javascript/dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/usearch/prebuilds/linux-x64 ./node_modules/usearch/prebuilds/linux-x64
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/node-gyp-build ./node_modules/node-gyp-build
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
