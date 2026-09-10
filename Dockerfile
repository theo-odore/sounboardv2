# Use lightweight Node 22 Alpine Linux
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY server.js ./
COPY public/ ./public/

# Ensure directories for storage exist
RUN mkdir -p /app/uploads /app/data

# Expose default port
EXPOSE 3000

# Environment settings
ENV PORT=3000 \
    NODE_ENV=production

# Run the server
CMD ["node", "server.js"]
