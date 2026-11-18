# 07 Prompts review (lead prompts of A1 vs A2)

## Where the prompts live
- **A1:** lead = `f1_multiagent/harness/agents/lead/.claude/CLAUDE.md` (112 lines) + `# Sub-agents you may call` (`harness/core/launch.ts:20`) + team-tools block (`launch.ts:25-62`) + per-turn `COMMANDS` (`harness/lead.ts:21-41`). Sub-agent role prompts: `harness/agents/*/.claude/CLAUDE.md`.
- **A2:** `harness_own_custom/core/system_prompt.md` (5 rules, router) appended via `--append-system-prompt` (`claude.ts:23`); `core/agent_prompt.md` (thin sub-agent, hook path); `core/prompts/solo.md` (confirm-first, only `lead:"solo"` / `router:false`).

## Side by side
| Topic | A2 `system_prompt.md` | A1 lead `CLAUDE.md` |
|---|---|---|
| Role | router lead, do not do the work | lead, no edit tools, reads workspace read-only |
| Delegate | Agent tool, one at a time | `team delegate ...`, `--async`, recipes |
| Hand-over | rule 2: self-contained, never "as discussed" | hand over the person's words + purpose; no invented requirements (`CLAUDE.md:25`) |
| Errors | nothing on NOTFOUND / guard | read `{"ok":false,"reason"}`, fix, retry; say what could not be done (`:4`, `:15`) |
| Follow-up | SendMessage by id | `--session <id>`; "ask X" must continue X (`:27`) |
| After the answer | rule 5: stop, do not redo or "improve" | keep going until done and checked; 4-part reply Outcome/Evidence/Needs/Next (`:39-44`) |

## Rules to ADD to f1 (from A2)
- // TODO: hard rule "after the sub-agent answers, do not redo or improve its work" (f1 only says keep going).
- // TODO: say explicitly "answer small questions yourself" (only implied by "scale to the request").
- // TODO: keep `REPORT:` / UNVERIFIED lines verbatim.
- // TODO: confirm-first protocol from `solo.md` as an optional prompt layer (lives in `custom/`).

## Rules to ADD to A2 (from f1)
- retry after a refusal (code emits `GUARD-RETRY`, prompt never says what to do), explicit NOTFOUND handling, count what the person lists, "ask X" continues X, never present an unchecked thing as done, verify with a fresh QA agent.

## Weaknesses found
- // ImprovementsNeeded: f1 lead prompt ~9 KB + shared-tools ~10 KB + COMMANDS ~3 KB; the same command list is written three times (`CLAUDE.md:16`, `lead.ts:23`, `launch.ts:31`). Generate it from one source.
- // ERROR: contradiction: RECIPE PLAN says "no questions" (`CLAUDE.md:7`), later "STOP and ask when blocked" (`:46`).
- Prompt-only rules (no code enforcement): count what the person lists, no command/id names to the person, 4-part reply, "link only after browse". Code backstops exist for NEEDS_PARENT (`lead.ts:47 personReply`) and phases ("code enforces n+1 waits for n").
- A2 rules enforced in code but never explained to the lead: unknown type, thin hand-over, role order (`interpose.ts:33-38`, `guard.ts`).
- Model mismatch: f1 lead is sonnet and relied on for dozens of rules; A2 lead is haiku with 5 rules. Never compare results across them without saying so.
- // NOT_POSSIBLE: under a native-tool approach these prompt parts have no meaning: `--async/wait`, `--writes/apply_patches`, `plan_submit/phase_pass`, `fork:`, `--mode ask`. They stay in A1 only. Routing recipes, the Judgement section, the final-answer format and all sub-agent role prompts carry over unchanged.
- f1 sub-agent prompts all end with the same "When you are stuck" `NEEDS_PARENT:` block; `qa-reviewer` is the longest (~7 KB); `pm` references `plan_pause` / `plan_replan`, so it only works inside f1.
