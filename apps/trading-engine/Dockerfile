# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/trading-engine ./apps/trading-engine

# Install dependencies
RUN bun install --frozen-lockfile

# Build the trading engine
WORKDIR /app/apps/trading-engine
RUN bun run build

# Production stage
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/apps/trading-engine/dist ./dist
COPY --from=builder /app/apps/trading-engine/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Set production environment
ENV NODE_ENV=production
ENV WS_PORT=3002

# Expose WebSocket port
EXPOSE 3002

# Run the trading engine
CMD ["bun", "run", "dist/index.js"]
