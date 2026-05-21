FROM node:20-slim

# Install Chromium dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production

# Create app directory
WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production

# Copy source
COPY . .

# Create directories for logs and sessions
RUN mkdir -p /app/logs /app/sessions

# Run as non-root user
RUN groupadd -r visitor && useradd -r -g visitor -G audio,video visitor \
    && chown -R visitor:visitor /app
USER visitor

CMD ["node", "src/index.js"]
