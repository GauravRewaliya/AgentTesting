// WHAT THIS HARNESS CAN AND CANNOT DO, as a tree. Single source of truth: the runner reads it (a case's `needs`),
// the README mirrors it (`bun core/harness_own_custom/capabilities.ts` prints it). Add a node when you learn a limit.
//
//  status:  ok = supported and tested | partial = works with a known gap (warns) | no = NOT supported (case is skipped)
//
// harness_own_custom
// ├─ multiagent
// │   ├─ spawn a sub-agent ................ ok       new session + id per spawn (R1)
// │   ├─ several sub-agents, one after other ok
// │   ├─ parallel sub-agents .............. partial  each call is a separate one-shot CLI; works, but no real concurrency/ordering test
// │   ├─ nested (sub-agent spawns sub-agent) no       the sub-agent is a lookup, it cannot call the harness
// │   └─ background / async agents ........ no       every call is answered at once, never "still running"
// ├─ sandbox
// │   ├─ files the sub-agent "writes" ..... partial  written by the recorded run(req) into run_test; the sub-agent never edits or runs anything
// │   ├─ Edit / Write / Bash by a sub-agent no       none of its own tool use exists, so no permission prompts or denials either
// │   ├─ persistence of those files ....... ok       kept in run_test and in the case session folder (.state/…/sessions/fx_<id>/workspace)
// │   └─ worktree / branch isolation ...... no       by design per MAIN agent only; sub-agents share its workspace
// ├─ session
// │   ├─ new id per spawn, isolation ...... ok       R1, R3
// │   ├─ follow-up to the same session .... partial  reply is a TEMPLATE over the session history, not a model: it can only restate task + replies
// │   ├─ survive between calls / restart .. ok       rebuilt from the case run/harness.jsonl in .state
// │   ├─ long history / compaction ........ no
// │   └─ resume the LEAD across cases ..... ok       --resume of the `after` checkpoint
// ├─ lookup (which recorded result answers)
// │   ├─ keywords + agent ................. ok
// │   ├─ similarity (bag of words) ........ partial  threshold 0.15 can pick a near-miss; stoplist is hand-tuned
// │   └─ nothing found .................... ok       NOTFOUND + `miss` event (fails loud)
// ├─ guard
// │   ├─ forbidden (distractor) agent ..... ok       hard stop
// │   ├─ unknown agent type ............... ok       GUARD-RETRY, not counted
// │   └─ role order / required facts ...... ok       store/*_rules.json (requires_done, contains_all, min_chars) checked in the PreToolUse hook; broken rule = GUARD-RETRY
// ├─ cost / tokens of the sub-agent ....... no       zero by design; nothing about sub-agent context size is measured
// ├─ judging
// │   ├─ automatic pass/fail .............. no       by design: expected is text, a person / Claude judges the report
// │   └─ repeat runs / flakiness stats .... no       one run per case; the lead is a small model and varies
// └─ tied to the Claude Code build
//     └─ Agent tool result shape .......... partial  the mod must return the engine's full output shape; an update can break it (error is explicit)

export type Status = "ok" | "partial" | "no";
export type Node = { name: string; status?: Status; note?: string; children?: Node[] };

const n = (name: string, status: Status, note?: string): Node => ({ name, status, note });
export const TREE: Node = {
  name: "harness_own_custom", children: [
    {
      name: "multiagent", children: [
        n("spawn", "ok", "new session + id per spawn"),
        n("sequential", "ok"),
        n("parallel", "partial", "separate one-shot CLI calls; no real concurrency test"),
        n("nested", "no", "a sub-agent cannot call the harness"),
        n("background", "no", "every call is answered at once"),
      ]
    },
    {
      name: "sandbox", children: [
        n("files", "partial", "written by the recorded run(req); the sub-agent never edits or runs anything"),
        n("tools", "no", "no Edit/Write/Bash by a sub-agent, so no permission prompts or denials"),
        n("persistence", "ok", "run_test + checkpoint copy"),
        n("worktree", "no", "by design one workspace per MAIN agent, shared by its sub-agents; no git worktree/branch for the main agent"),
      ]
    },
    {
      name: "session", children: [
        n("isolation", "ok", "R1, R3"),
        n("followup", "partial", "reply is a template over the history, not a model"),
        n("restart", "ok", "rebuilt from the case run/harness.jsonl in .state"),
        n("compaction", "no", "no long-history / context-limit behaviour"),
        n("lead_resume", "ok", "--resume of the `after` checkpoint"),
      ]
    },
    {
      name: "lookup", children: [
        n("keywords", "ok"),
        n("similarity", "partial", "threshold 0.15 may pick a near-miss"),
        n("notfound", "ok", "NOTFOUND + miss event"),
      ]
    },
    {
      name: "guard", children: [
        n("forbidden", "ok"),
        n("unknown_type", "ok"),
        n("roles", "ok", "hand-over rules (store/*_rules.json): ported to the PreToolUse hook in core/interpose.ts; a broken rule = GUARD-RETRY"),
      ]
    },
    n("subagent_cost", "no", "zero by design"),
    {
      name: "judging", children: [
        n("auto_verdict", "no", "by design: a person / Claude judges"),
        n("repeat_runs", "no", "one run per case"),
      ]
    },
    { name: "artifact", children: [n("publish", "no", "the Artifact tool does not exist in headless `claude -p` (see test_artifact/main.ts)")] },
    { name: "claude_code_build", children: [n("agent_result_shape", "partial", "an update can break the mod's reply shape")] },
  ]
};

/** Look up a dotted path ("session.followup"). Unknown path = a typo: reported, never silently ok. */
export function find(path: string, node: Node = TREE): Node | undefined {
  const [head, ...rest] = path.split(".");
  const next = node.children?.find((c) => c.name === head);
  return !next ? undefined : rest.length ? find(rest.join("."), next) : next;
}

/** warnings + whether to skip, for a case's `needs`. */
export function check(needs: string[] = []): { skip: boolean; warnings: string[] } {
  const warnings: string[] = []; let skip = false;
  for (const p of needs) {
    const c = find(p);
    if (!c) { warnings.push(`unknown capability "${p}" (typo?)`); skip = true; }
    else if (c.status === "no") { warnings.push(`NOT SUPPORTED by this harness: ${p}${c.note ? " (" + c.note + ")" : ""}`); skip = true; }
    else if (c.status === "partial") warnings.push(`partial: ${p}${c.note ? " (" + c.note + ")" : ""}`);
  }
  return { skip, warnings };
}

export function render(node: Node = TREE, prefix = "", last = true, root = true): string {
  const tag = node.status ? ` [${node.status}]${node.note ? " " + node.note : ""}` : "";
  const line = root ? node.name : `${prefix}${last ? "└─ " : "├─ "}${node.name}${tag}`;
  const kids = node.children ?? [];
  const pre = root ? "" : prefix + (last ? "   " : "│  ");
  return [line, ...kids.map((c, i) => render(c, pre, i === kids.length - 1, false))].join("\n");
}
if (import.meta.main) console.log(render());
