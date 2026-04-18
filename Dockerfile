FROM node:20-bookworm-slim

# System deps: Chromium + FFmpeg + espeak-ng (Linux TTS fallback)
RUN apt-get update && apt-get install -y --no-install-recommends \
  libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 \
  libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 \
  libxdamage1 libatk-bridge2.0-0 libcups2 \
  ffmpeg espeak-ng fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps (layer-cached separately from source)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Install Remotion headless browser
RUN npx remotion browser ensure

# Pre-bundle Remotion composition → /app/build
RUN npx remotion bundle remotion/index.ts --out build

# Runtime directories
RUN mkdir -p renders ai-assets

ENV NODE_ENV=production
ENV REMOTION_SERVE_URL=build
ENV PORT=3000
ENV CONCURRENCY=1
ENV NODE_OPTIONS="--max-old-space-size=128 --expose-gc"

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
