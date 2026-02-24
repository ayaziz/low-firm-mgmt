# ── Stage 1: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json next.config.js ./
COPY src/ src/
COPY public/ public/

ENV NEXT_PUBLIC_API_URL=http://backend:4000
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Stage 2: Production ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S loma && adduser -S loma -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER loma

EXPOSE 3000

CMD ["node", "server.js"]
