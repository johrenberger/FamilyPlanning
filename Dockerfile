FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application
COPY lib/ ./lib/
COPY views/ ./views/
COPY public/ ./public/

# Create data and config directories
RUN mkdir -p data config

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -sf http://localhost:8080/ || exit 1

# Start server (not CLI mode)
CMD ["node", "lib/server.js"]