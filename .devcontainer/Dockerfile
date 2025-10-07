# Use Node.js base image
FROM node:24.8.0-slim

# Set working directory to where node_modules volume will be mounted
WORKDIR /workspace

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl wget git vim nano build-essential python3 \
    libnss3 libnspr4 libatk-bridge2.0-0 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2 \
    libatspi2.0-0 libgtk-3-0 procps \
    && rm -rf /var/lib/apt/lists/*

# Create a home directory for node if it doesn't exist
RUN mkdir -p /home/node && chown -R node:node /home/node

# Switch to node for development
USER node

# Expose ports used by dev tools
EXPOSE 8080 3000

# Default command
CMD ["bash"]
