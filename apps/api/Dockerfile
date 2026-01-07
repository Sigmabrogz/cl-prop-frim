# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies
RUN bun install --frozen-lockfile

# Build the API
WORKDIR /app/apps/api
RUN bun run build

# Production stage
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Set production environment
ENV NODE_ENV=production
ENV API_PORT=3001

# Expose port
EXPOSE 3001

# Run the API
CMD ["bun", "run", "dist/index.js"]
