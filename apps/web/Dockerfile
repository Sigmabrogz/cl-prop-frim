# Build stage - copy entire monorepo
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy entire monorepo
COPY . .

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build arguments for environment variables (set at build time)
# These MUST be provided via Railway's "Build Args" or environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

# Set environment variables for the build
# Use defaults for build if not provided (will be overridden at runtime via Railway vars)
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-https://api.example.com}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL:-wss://ws.example.com}

# Build the web app
WORKDIR /app/apps/web
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
