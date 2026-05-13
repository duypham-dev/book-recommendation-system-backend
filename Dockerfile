FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --omit=dev

# Generate Prisma client
FROM deps AS builder
COPY . .
RUN DATABASE_URL="postgresql://dummy:dummy@postgres:5432/dummy" DIRECT_URL="postgresql://dummy:dummy@postgres:5432/dummy" npx prisma generate

# Final production image
FROM base AS runner
ENV NODE_ENV=production

# Copy deps and built app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/app ./app
COPY --from=builder /app/workers ./workers
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma.config.js ./prisma.config.js

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser
USER appuser

EXPOSE 8080
CMD ["node", "server.js"]