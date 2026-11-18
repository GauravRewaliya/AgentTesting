# 09 Risks and shared state (running two approaches side by side)

| Shared thing | Hazard | Mitigation |
|---|---|---|
| env protocol `HARNESS_STORE/TASK/AGENT/CWD/DIR/RUNNER/MAX_DEPTH/LOCKS_URL/LOCKS_PREFIX/MAX_INSTANCES/SANDBOX` | a second approach using the same names aliases f1 | prefix per approach or separate processes |
| `UI_STORE`, `UI_REPO` | force ONE store/repo for every run (`run.ts:35-39`) | do not set both approaches at once |
| `.state/<STATE_VERSION>/<task>/{store,workspace}` + `f1_exp/` map | two approaches on `v1` share the experiment map and pointer files | distinct `STATE_VERSION` per approach (`test_harness/core/paths.ts`) |
| `ui/.ui-data/`, UI port 5174 | one UI store | one UI per approach |
| `.state/chrome-profile`, `browser.json`, `headless.json` | one Chrome profile + tab registry (`browser_conn.ts:9`, `tab.ts`) | keep shared on purpose or namespace |
| `/tmp/lf-slots` (cap 3 concurrent `claude`, `slots.ts:8`), `lf-launch`, `lfwt-*`, `lfp-*`, `lfqa-*`, `cdp-*` | machine-wide cap shared by all runs | arguably desirable |
| Redis locks `HARNESS_LOCKS_PREFIX`; without Redis locks live in the store file | file locks are per store | per-approach prefix |
| Claude transcripts `~/.claude/projects/...`, `CLAUDE_CONFIG_DIR`, `HARNESS_VERSION` | different shells use different profiles | pin the profile |
| docker compose project `agent-testing`, S3 `agent-testing-s3` port 55442, bucket `agent-testing-qa`, sandbox image `agent-testing-claude:1` | no per-approach namespace | `AT_S3_CONTAINER`, `AT_S3_PORT` overrides |
| loopferry port 55441 | separate project | do not reuse |

// ERROR: a mod in a shared `CLAUDE_CONFIG_DIR` also intercepts the other approach's real `claude -p` calls. Load the mod only with `--plugin-dir` per lead process.

## Hazards carried over from f1
See `06` A1 loopholes (Bash writes bypass the edit lock, registry reachable via `Bash(node *)`, lease lapses, duplicate forks).
