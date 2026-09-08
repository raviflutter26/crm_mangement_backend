# Payslip generation uses Puppeteer, so the image needs a real Chromium plus its
# font and library dependencies. Debian slim is used rather than Alpine because
# Puppeteer's bundled Chromium is glibc-linked.
FROM node:20-slim

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Chromium + the fonts payslips render with. fonts-indic covers Devanagari and
# Tamil so employee names and ₹ amounts don't come out as boxes.
RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium \
        ca-certificates \
        fonts-liberation \
        fonts-indic \
        fonts-noto-color-emoji \
        dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests first so `npm ci` is cached until dependencies actually change
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# Uploaded documents live here. This MUST be backed by a persistent volume:
# a container filesystem is wiped on every redeploy, taking every employee
# document and receipt with it. Set UPLOAD_DIR=/app/uploads (the default) and
# mount your volume at that path.
RUN mkdir -p /app/uploads /app/logs && chown -R node:node /app

# Declares the mount point so `docker run -v` and orchestrators pick it up.
VOLUME ["/app/uploads"]

USER node

EXPOSE 5000

# dumb-init gives PID 1 correct signal handling so SIGTERM reaches Node and the
# graceful shutdown in server.js actually runs.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
