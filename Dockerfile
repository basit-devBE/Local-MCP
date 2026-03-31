FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-slim

# Install system tools needed by shell/network tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    netcat-openbsd \
    dnsutils \
    whois \
    traceroute \
    iputils-ping \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist/

EXPOSE 3000

# Non-root user for safety
RUN useradd -m mcpuser && \
    mkdir -p /host-home && \
    chown -R mcpuser /app /host-home

USER mcpuser

CMD ["node", "dist/server.js"]
