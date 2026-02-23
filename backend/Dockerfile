# ── Stage 1: Build ──
FROM node:20-alpine AS builder
WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --ignore-scripts
# Force exact TypeScript 5.3.3 (original stable version)
RUN npm uninstall typescript && npm install typescript@5.3.3 --save-exact --force
RUN npm list typescript --depth=0

COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ src/
COPY prisma/ prisma/

RUN npx prisma generate
RUN npm run build

# ── Stage 2: Production ──
FROM node:20-alpine AS runner
WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Install only production deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts

# Copy Prisma client (generated) and schema
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma/ prisma/

# Copy compiled app
COPY --from=builder /app/dist ./dist

# Non-root user
RUN addgroup -g 1001 -S loma && adduser -S loma -u 1001
USER loma

EXPOSE 4000

CMD ["node", "dist/src/main.js"]
