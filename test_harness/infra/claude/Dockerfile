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
# Code intelligence for the agents: `tsc` for type errors, and the language server behind the LSP tool (the harness loads it as the plugin harness/plugins/ts-lsp).
# TypeScript is pinned to 5.x: 7.x has no tsserver.js and the language server cannot start (tested 2026-11-13).
RUN pnpm add -g typescript@5.9.3 typescript-language-server && chmod -R a+rX /opt && ln -s "$(dirname "$(find /opt/pnpm -path '*typescript/lib/tsserver.js' | head -1)")" /opt/ts-lib \
 && tsc --version && typescript-language-server --version && test -f /opt/ts-lib/tsserver.js   # /opt/ts-lib: stable path for the language server's initializationOptions.tsserver.path
# Bun is here ONLY for project generators the person asked for: `bun create vue@latest <name> --ts --router ...` (docs/SANDBOX.md). Installs of packages stay pnpm (CLAUDE.md).
ENV BUN_INSTALL=/opt/bun PATH=/opt/bun/bin:$PATH
RUN curl -fsSL https://bun.sh/install | bash && chmod -R a+rX /opt/bun && bun --version
# Several Node versions (like nvm), so a project that needs another Node than the image default (22) still builds. fnm = one small binary, versions live in /opt/fnm.
# Use:  fnm exec --using=20 pnpm install   |   eval "$(fnm env)" && fnm use 24   |  a project's .nvmrc / .node-version: `fnm exec --using=file pnpm ...`  (never npm).
ENV FNM_DIR=/opt/fnm PATH=/opt/fnm-bin:$PATH
RUN curl -fsSL https://fnm.vercel.app/install | bash -s -- --install-dir /opt/fnm-bin --skip-shell \
 && fnm install 20 && fnm install 24 && chmod -R a+rX /opt/fnm /opt/fnm-bin && fnm list
USER 1000:1000
WORKDIR /workspace
ENTRYPOINT []
