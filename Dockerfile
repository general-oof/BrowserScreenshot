FROM node:20-bookworm-slim

# Install basic tools needed for Playwright's install-deps command
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files first for caching
COPY package.json package-lock.json* ./

# Install application dependencies
RUN npm ci --include=dev

# Install Playwright Chromium browser and all its OS-level dependencies
RUN npx playwright install --with-deps chromium

# Copy the rest of the application
COPY . .

# Build Next.js
RUN npm run build

# Expose Next.js default port
EXPOSE 3000

# Start the production server
CMD ["npm", "start"]
