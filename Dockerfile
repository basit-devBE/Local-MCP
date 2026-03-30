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

COPY src/ ./src/

EXPOSE 3000

# Non-root user for safety
RUN useradd -m mcpuser && chown -R mcpuser /app
USER mcpuser

CMD ["node", "src/server.js"]
