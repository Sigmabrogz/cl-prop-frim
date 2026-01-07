# Build stage - use Node/pnpm for building
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy entire monorepo
COPY . .

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build all workspace packages
RUN pnpm --filter @propfirm/shared build
RUN pnpm --filter @propfirm/redis build
RUN pnpm --filter @propfirm/database build

# Production stage - use Bun for runtime
FROM oven/bun:1

WORKDIR /app

# Copy everything from builder (with built packages)
COPY --from=builder /app .

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Run with Bun
CMD ["bun", "run", "apps/api/src/index.ts"]
