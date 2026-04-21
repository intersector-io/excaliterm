# Stage 1: Build (Debian-based for glibc-compatible native addons)
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./

# Copy shared-types and backend packages
COPY packages/shared-types/ packages/shared-types/
COPY apps/backend/ apps/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Build shared-types first, then backend
RUN pnpm --filter @excaliterm/shared-types build
RUN pnpm --filter @excaliterm/backend build

# Stage 2: Production (must match builder's libc for native addons)
FROM node:22-slim

WORKDIR /app

# Copy node_modules from builder (includes compiled native addons like better-sqlite3)
COPY --from=builder /app/node_modules/ node_modules/

# Copy built shared-types
COPY --from=builder /app/packages/shared-types/package.json packages/shared-types/package.json
COPY --from=builder /app/packages/shared-types/dist/ packages/shared-types/dist/
COPY --from=builder /app/packages/shared-types/node_modules/ packages/shared-types/node_modules/

# Copy built backend
COPY --from=builder /app/apps/backend/package.json apps/backend/package.json
COPY --from=builder /app/apps/backend/dist/ apps/backend/dist/
COPY --from=builder /app/apps/backend/node_modules/ apps/backend/node_modules/

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001

WORKDIR /app/apps/backend

CMD ["node", "dist/index.js"]
