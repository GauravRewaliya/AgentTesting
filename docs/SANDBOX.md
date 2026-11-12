# Sandbox: how loopferry isolates its agents, and how we do it locally with Docker

Source (read 2026-11-12): `~/projects/loopferry/src/services/engine/e2b-template.ts`, `providers/claude-coding.ts` (`SANDBOX_NOTES`), `handbook/ENGINE.md`, `.idea/docker/docker-compose.yml`.
Nothing was run against E2B (it needs `E2B_API_KEY` and bills sandbox minutes).

## 1. What loopferry's sandbox is (one E2B template, `loop-agent`; env `E2B_TEMPLATE`, default `loop-agent`)

| part | what |
|---|---|
| base | `mcr.microsoft.com/playwright:v1.63.0-noble`: Node, Chromium and every system library already inside |
| packages | apt: git, ffmpeg, curl, ca-certificates, ripgrep, unzip, sudo. Global `playwright` pinned to the SAME version as the browsers |
| agent tooling | Claude Code CLI, the Playwright MCP, a desktop (noVNC): versioned in `providers/sandbox-tooling.ts` |
| verified at BUILD time | a fresh login shell can launch Chromium, `claude --version` works, `playwright-mcp --help` works, the root-owned launcher has the right owner/mode, the login user can NOT `sudo`, tool processes run as `agent`, and `agent` cannot read the login owner's home. A broken template fails the build, not the first run |
| resources | 4 CPUs, 8 GB, workdir `/workspace` |
| privilege split | the CLI runs as `user` (owns the login); Bash and the Playwright MCP run as `agent`; settings deny the CLI's own Read/Edit/Write on the login, git credentials and the backstage |
| network | the sandbox reaches only GitHub, the package registries and the app; sandboxes are made with `allowPublicTraffic: false` |
| work | each repo is a real `git clone` at its ref (all binaries and config present); the agent installs dependencies itself and starts the repo's own dev server |

## 2. Why that setup has so few problems

1. **Everything the work needs is in the image, pinned and verified**: no "browser missing", no version drift, no missing system library.
2. **The agent builds and tests in the same live environment**: the real clone, real assets, real dependencies, the real dev server. Nothing is copied, exported, stubbed or replayed afterwards.
3. **The agent is the one who adapts**: an undeclared dependency, a wrong route or a busy port is fixed in the same session.
4. **Isolation is the sandbox, not the host**: installs, servers and browsers live and die inside it, so they cannot harm the machine.

## 3. Our local equivalent (Docker + volumes)

Rule: **we do not restart or manage containers.** A job is `docker run --rm` with the volumes mounted; when it ends the container is gone and the volumes stay; the next job mounts them again. Installs and builds happen inside the container, on the volume, so they cannot touch or fill the host's own folders or memory beyond the caps below.

| loopferry | ours today |
|---|---|
| E2B template `loop-agent` | image `agent-testing-qa:1` (node 22 slim + playwright-core + Chromium headless shell + corepack pnpm, non-root user, about 900 MB) |
| sandbox disk | docker volume `agent-testing-pnpm-store`: pnpm store, corepack binary, saved lockfiles, Metro cache; the app copy lives there only during a job |
| workspace | `test_harness/.state/v1/<session>/workspace` mounted READ-ONLY into the container; outputs go to `<session>/store/` (the only writable host path) |
| limits | **2 GB RAM, 1 CPU**, 512 pids, all capabilities dropped, no-new-privileges, non-root user (your uid), removed after the job (`--rm`). Declared once in the compose service `sandbox` (`test_harness/infra/docker-compose.yml`) and verified from INSIDE a container: `memory.max=2147483648`, `cpu.max=100000 100000`, `CapEff=0` |
| network | recording of a static page: `--network none`. Export / dev-server QA: network ON (registries needed), everything else the same |

### How a real agent call runs in Docker (HARNESS_SANDBOX=docker)

```
host:      bun tools.ts delegate ...            (the orchestrator, the store, the lead: host)
 DockerRunner.spawnOne -> docker compose -f test_harness/infra/docker-compose.yml run --rm -T --name claude-<agent>-<id> --user <uid> \
               -v <agent cwd>:<agent cwd> -v <prompt dir>:<prompt dir>:ro -w <agent cwd> sandbox claude -p ... --session-id ...
container: image agent-testing-claude:1 (Claude Code built in), 2 GB / 1 cpu, caps dropped, /claude = claude-personal, /pnpm = pnpm store volume
```
Why compose and not a long-lived container: compose is the single place that declares image, limits, security and volumes; jobs use `compose run --rm` (one throwaway container per call) so we never restart or manage a container, we only remount volumes. `compose up` is for services that stay up (S3).

## 4. Gaps against loopferry (honest list)

| gap | effect | proposal |
|---|---|---|
| the image is not verified like theirs | a broken image shows up at the first run | add a verify step to the image build (chromium launches, pnpm works), fail the build |
| base is Debian slim + a headless shell, not Microsoft's Playwright image | fewer fonts/system libraries, page rendering can differ | move to the Playwright base image once (about 1.5 GB), then delete the old image |
| ~~no Claude Code inside the container~~ **done 2026-11-12** | real sub-agents used to run `claude -p` on the HOST | image `agent-testing-claude:1` (QA image + Claude Code 2.1.322 + git + ripgrep, build FAILS if claude is missing; `test_harness/infra/claude/Dockerfile`), compose service `sandbox`, and `DockerRunner` (`harness/core/base/docker_runner.ts`, switch `HARNESS_SANDBOX=docker`). Your `claude-personal` profile is mounted at `/claude`. Tested: a real `claude -p` in the container answered in 2.7 s for $0.0006. **Open:** (1) an agent with Bash can READ the mounted profile (loopferry prevents it with a second user and deny rules): only use it for agents you trust, TODO T-23; (2) the lead, the pm and agents that delegate (need the host's `tools.ts`) stay on the host; (3) no full real case has run in docker yet |
| QA is a fixed script on an exported copy | blank page on solarin (see `QA_ISSUES.md` 12) | start the app's own dev server inside the container and record against it (see `QA_ISSUES.md` section 6) |
| no per-demo config (dev command, route, viewport, checks) | one generic script for every app | add `qa` block per demo in `sources.json` |
