# Stage 1: Build
FROM node:20-alpine AS builder

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
RUN pnpm --filter @terminal-proxy/shared-types build
RUN pnpm --filter @terminal-proxy/backend build

# Stage 2: Production
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config for pnpm to resolve workspace packages
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./

# Copy built shared-types
COPY --from=builder /app/packages/shared-types/package.json packages/shared-types/package.json
COPY --from=builder /app/packages/shared-types/dist/ packages/shared-types/dist/

# Copy built backend
COPY --from=builder /app/apps/backend/package.json apps/backend/package.json
COPY --from=builder /app/apps/backend/dist/ apps/backend/dist/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001

WORKDIR /app/apps/backend

CMD ["node", "dist/index.js"]
