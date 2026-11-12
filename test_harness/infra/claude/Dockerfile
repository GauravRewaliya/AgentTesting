# Sandbox image for REAL agents (HARNESS_SANDBOX=docker): the QA image (node 22, pnpm via corepack, playwright-core, Chromium headless shell) + Claude Code + git/ripgrep.
# Modelled on loopferry's E2B template `loop-agent`: everything an agent needs is pre-installed and the BUILD FAILS if claude is missing, so a broken image never shows up at the first run.
#   docker build -t agent-testing-claude:1 test_harness/infra/claude        (FROM agent-testing-qa:1: build that first, its layers are shared, so this adds only Claude Code)
# pnpm only (never npm): Claude Code is installed with `pnpm add -g`. pnpm skips install scripts by default; only THIS package's post-install (it fetches the native binary) is run, explicitly.
FROM agent-testing-qa:1
USER root
ENV COREPACK_HOME=/opt/corepack PNPM_HOME=/opt/pnpm PATH=/opt/pnpm/bin:/opt/pnpm:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends git ripgrep curl ca-certificates unzip \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable && mkdir -p "$PNPM_HOME/bin" && pnpm add -g @anthropic-ai/claude-code \
 && node "$(find /opt/pnpm -path "*@anthropic-ai/claude-code/install.cjs" | head -1)" \
 && chmod -R a+rX /opt \
 && claude --version && git --version && rg --version | head -1
# Bun is here ONLY for project generators the person asked for: `bun create vue@latest <name> --ts --router ...` (docs/SANDBOX.md). Installs of packages stay pnpm (CLAUDE.md).
ENV BUN_INSTALL=/opt/bun PATH=/opt/bun/bin:$PATH
RUN curl -fsSL https://bun.sh/install | bash && chmod -R a+rX /opt/bun && bun --version
USER 1000:1000
WORKDIR /workspace
ENTRYPOINT []
