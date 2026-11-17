# QA recorder image: headless Chromium + playwright-core, nothing else. Everything is installed INSIDE the image, the host gets nothing.
#   docker build -t agent-testing-qa:1 test_harness/infra/qa
# Base node:22-bookworm-slim is small; only the chromium headless shell (not full Chrome, firefox, webkit) is downloaded.
FROM node:22-bookworm-slim
# default pnpm for a project that pins none (pin_pm.mjs); a project's own packageManager always wins. Bump it here, not in a global file.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright HOME=/tmp PNPM_DEFAULT_VERSION=10.28.0
WORKDIR /app
RUN corepack enable && pnpm init >/dev/null && pnpm add playwright-core@1.49.1 \
 && pnpm exec playwright-core install --with-deps chromium-headless-shell \
 && rm -rf /var/lib/apt/lists/* /root/.cache && chmod -R a+rX /ms-playwright /app
COPY record.mjs /app/record.mjs
USER 1000:1000
ENTRYPOINT ["node", "/app/record.mjs"]
