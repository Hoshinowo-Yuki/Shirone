# ---------- Build stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack to use pnpm
RUN corepack enable

# Copy package.json, pnpm-lock.yaml, and .npmrc to install dependencies first
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# Then copy the rest of the application code and build the project
COPY . .
RUN pnpm build

# ---------- Runtime Stage ----------
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]