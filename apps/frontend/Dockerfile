# Stage 1: Build
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./

# Copy shared-types (frontend depends on it) and frontend
COPY packages/shared-types/ packages/shared-types/
COPY apps/frontend/ apps/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Build shared-types first, then frontend
RUN pnpm --filter @terminal-proxy/shared-types build
RUN pnpm --filter @terminal-proxy/frontend build

# Stage 2: Production
FROM nginx:1.27-alpine

# Copy built static files
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# Copy custom nginx config
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
