# ---------- Build stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack to use pnpm
RUN corepack enable

# Install git and openssh-client for cloning private git repositories
RUN apk add --no-cache git openssh-client

# Set up known_hosts + recreate your host alias so "github.com-blog-content" resolves.
# No IdentityFile needed — the key comes from the forwarded SSH agent mount.
RUN mkdir -p -m 0700 ~/.ssh && \
    ssh-keyscan github.com >> ~/.ssh/known_hosts && \
    printf "Host github.com-blog-content\n\tHostName github.com\n\tUser git\n" >> ~/.ssh/config

# Copy package.json, pnpm-lock.yaml, and .npmrc to install dependencies first
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=ssh pnpm install --frozen-lockfile

# Then copy the rest of the application code and build the project
COPY . .
RUN --mount=type=ssh pnpm build

# ---------- Runtime Stage ----------
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]