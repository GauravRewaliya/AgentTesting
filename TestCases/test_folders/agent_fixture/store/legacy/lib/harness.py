"""Shared harness for test_cases/main_*/<case>.py.

A case file builds a dict CASE and ends with `if __name__ == "__main__": main(CASE)`.
  python3 -I test_cases/main_lsp/l1_rename_no_subagent.py [--deps] [--fresh] [--keep]
  python3 -I test_cases/run.py --list | --status | <case id> [...] [--deps]

CASE keys
  id, title, after        id of the case whose checkpoint this one continues from (chain / branch)
  inherit                 'session' (default: conversation + workspace, forked) | 'workspace' (files only, fresh conversation: use when the main agent's role changes)
  agents                  mock sub-agents PASSED to the main agent (only these, nothing else)
  distractors             useless agents passed on purpose: calling one is a hard FAIL (guard stops it)
  skills / distractor_skills   skills passed through a generated plugin (only these)
  tools                   main agent's tools (--tools); None = default
  lead                    prompt file in _lib/prompts/ (appended to the system prompt)
  lsp                     True = a plugin with the local typescript-language-server (test_cases/_tools)
  external                True = run in a workspace outside .idea and git (needed for any case where the main agent edits files)
  setup                   names of setup steps run on the workspace first ("lsp_trap")
  turns                   [{user, allowed (sub-agent roles this turn may call), expect, soft}]
expect / soft (hard = FAIL, soft = WARN only)
  calls [roles in order] | tools {Name: {min,max}} | lsp_ok | skills_used | skills_not_used | reply_contains | reply_asks
  reply_reports_qa_fail | files_exist | files_absent | files_contain {f: text} | files_absent_text {f: text} | files_unchanged [f]
"""
import glob, hashlib, json, os, shutil, subprocess, sys, time
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__)); TC = os.path.dirname(HERE); R = os.path.dirname(TC)
STATE, TR = f"{TC}/_state", f"{R}/trace"
# Edit/Write are refused under .idea/ ("sensitive file"), so cases that edit run with external=True in a workspace outside .idea and outside git
EXT = os.environ.get("TEST_AGENT_DEV_WS", os.path.expanduser("~/.cache/test_agent_2/dev_ws"))
RUN_ROOT, WS = R, f"{R}/test_run"


def use_root(external):
    global RUN_ROOT, WS
    RUN_ROOT = EXT if external else R; WS = f"{RUN_ROOT}/test_run"; os.makedirs(WS, exist_ok=True)
LSP_BIN = f"{TC}/_tools/node_modules/.bin/typescript-language-server"

AGENT_DESC = {
    "planner": "Planning team. Turns a request into plan.md (goal, source examples, steps, files, risks). Call FIRST for any long task. Cannot see this conversation: give it the full request, repo/examples, target folder.",
    "ux-designer": "UX team. Reads plan.md and writes the wireframe: screens, flows and wireframe pseudo code placed at the real file paths. Cannot see this conversation: give it the requirements, the plan.md path, the examples and the target folder.",
    "builder": "Builder team. Replaces the approved wireframe with the real code taken from the named example repos and wires package.json. Cannot see this conversation: give it the wireframe/plan paths, the example names and the target folder.",
    "qa-reviewer": "QA team. Checks the built folder (files present, no wireframe markers left, dependencies) and returns PASS/FAIL lines. Call after the builder.",
    "package-researcher": "Package research. Answers questions about an npm package's API, syntax and version differences, and checks given code (name the file path) against the package version. Cannot see this conversation: give it the package, the file path(s) and the exact questions.",
    "poet": "Writes poems about code. Use for creative-writing requests.",
    "release-notes-writer": "Writes release notes for a finished version. Use only when a release is being cut.",
}


# ---------------------------------------------------------------- setup steps (script `cp` on the fly)
def setup_lsp_trap():
    app = f"{WS}/notes-app"
    for f in ("ZustandDemo.js", "cart.js"):
        shutil.copy(f"{TC}/_fixtures/lsp_trap/{f}", f"{app}/{f}")
    json.dump({"compilerOptions": {"allowJs": True, "checkJs": False, "module": "esnext", "moduleResolution": "bundler", "jsx": "preserve"},
               "include": ["*.js"]}, open(f"{app}/jsconfig.json", "w"), indent=1)


SETUPS = {"lsp_trap": setup_lsp_trap}


# ---------------------------------------------------------------- helpers
def rows(p):
    try: return [json.loads(l) for l in open(p) if l.strip()]
    except FileNotFoundError: return []


def wipe_ws():
    os.makedirs(WS, exist_ok=True)
    for p in glob.glob(f"{WS}/*") + glob.glob(f"{WS}/.[!.]*"):
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)


def ws_hashes():
    return {os.path.relpath(f, RUN_ROOT): hashlib.md5(open(f, "rb").read()).hexdigest() for f in glob.glob(f"{WS}/**/*", recursive=True) if os.path.isfile(f)}


def case_file(cid):
    m = glob.glob(f"{TC}/main_*/{cid}.py")
    if not m: sys.exit(f"no case file for id '{cid}'")
    return m[0]


def build_plugin(case):
    skills = case.get("skills", []) + case.get("distractor_skills", [])
    if not skills and not case.get("lsp"): return None
    d = f"{TR}/plugin_{case['id']}"; shutil.rmtree(d, ignore_errors=True); os.makedirs(f"{d}/.claude-plugin")
    json.dump({"name": "case-plugin", "version": "0.0.1", "description": "skills / lsp of one test case"}, open(f"{d}/.claude-plugin/plugin.json", "w"))
    for s in skills: shutil.copytree(f"{TC}/_skills/{s}", f"{d}/skills/{s}")
    if case.get("lsp"):
        ext = {".ts": "typescript", ".tsx": "typescriptreact", ".js": "javascript", ".jsx": "javascriptreact", ".mjs": "javascript", ".cjs": "javascript"}
        json.dump({"typescript": {"command": LSP_BIN, "args": ["--stdio"], "extensionToLanguage": ext}}, open(f"{d}/.lsp.json", "w"), indent=1)
    return d


def hooks_settings():
    hk = lambda c: {"type": "command", "command": c}
    tap = f"{R}/hooks_tap.sh"
    json.dump({"hooks": {"PreToolUse": [{"matcher": "Agent|Task", "hooks": [hk(f"python3 -I {HERE}/guard.py"), hk(tap)]}],
                         "PostToolUse": [{"matcher": "Agent|Task", "hooks": [hk(tap)]}], "SubagentStop": [{"hooks": [hk(tap)]}]}},
              open(f"{TR}/hooks.case.settings.json", "w"), indent=1)
    return f"{TR}/hooks.case.settings.json"


def parse_stream(out):
    s = [json.loads(l) for l in out.splitlines() if l.startswith("{")]
    uses, results = [], {}
    for e in s:
        if e.get("parent_tool_use_id"): continue
        m = e.get("message"); content = m.get("content") if isinstance(m, dict) else None
        for b in (content if isinstance(content, list) else []):
            if not isinstance(b, dict): continue
            if e.get("type") == "assistant" and b.get("type") == "tool_use": uses.append(b)
            if e.get("type") == "user" and b.get("type") == "tool_result": results[b.get("tool_use_id")] = b
    reply = "\n".join(b["text"] for e in s if e.get("type") == "assistant" and not e.get("parent_tool_use_id") and isinstance(e.get("message"), dict)
                      for b in e["message"].get("content", []) if isinstance(b, dict) and b.get("type") == "text")
    rs = [e for e in s if e.get("type") == "result"]
    sid = next((e["session_id"] for e in s if e.get("session_id")), None)
    return uses, results, reply, (rs[-1] if rs else {}), sid


def evaluate(ex, ctx):
    f = []
    if "calls" in ex and ctx["calls"] != ex["calls"]: f.append(f"calls {ctx['calls']} != {ex['calls']}")
    for n, lim in ex.get("tools", {}).items():
        c = ctx["tools"].get(n, 0)
        if "min" in lim and c < lim["min"]: f.append(f"tool {n} used {c}x, wanted >= {lim['min']}")
        if "max" in lim and c > lim["max"]: f.append(f"tool {n} used {c}x, wanted <= {lim['max']}")
    if ex.get("lsp_ok") and (ctx["lsp_errors"] or not ctx["tools"].get("LSP")): f.append(f"LSP not working: {ctx['lsp_errors'][:2] or 'tool never used'}")
    for k in ex.get("skills_used", []):
        if k not in ctx["skills"]: f.append(f"skill '{k}' not used")
    for k in ex.get("skills_not_used", []):
        if k in ctx["skills"]: f.append(f"skill '{k}' used but useless")
    f += [f"reply lacks '{k}'" for k in ex.get("reply_contains", []) if k.lower() not in ctx["reply"].lower()]
    if ex.get("reply_asks") and ex["reply_asks"] not in ctx["reply"].lower(): f.append("reply does not ask for approval")
    if ex.get("reply_reports_qa_fail") and not any(k in ctx["reply"] for k in ("FAIL", "not wired", "does not use", "doesn't use", "isn't wired", "not yet")): f.append("reply hides the QA FAIL")
    f += [f"missing file {p}" for p in ex.get("files_exist", []) if not os.path.exists(f"{RUN_ROOT}/{p}")]
    f += [f"file should not exist yet: {p}" for p in ex.get("files_absent", []) if os.path.exists(f"{RUN_ROOT}/{p}")]
    for p, k in ex.get("files_contain", {}).items():
        if not (os.path.exists(f"{RUN_ROOT}/{p}") and k in open(f"{RUN_ROOT}/{p}").read()): f.append(f"{p} lacks '{k}'")
    for p, k in ex.get("files_absent_text", {}).items():
        if os.path.exists(f"{RUN_ROOT}/{p}") and k in open(f"{RUN_ROOT}/{p}").read(): f.append(f"{p} still has '{k}'")
    for p in ex.get("files_unchanged", []):
        if ctx["before"].get(p) != ctx["after"].get(p): f.append(f"{p} was changed")
    return f


# ---------------------------------------------------------------- run one case
def run_case(case, deps=False, fresh=False, keep=False):
    cid = case["id"]; ck = f"{STATE}/{cid}/ckpt.json"; use_root(case.get("external"))
    sid, done, fork = None, [], False
    if case.get("after"):
        pk = f"{STATE}/{case['after']}/ckpt.json"
        if not os.path.exists(pk):
            if not deps: sys.exit(f"'{cid}' continues from '{case['after']}', which has no checkpoint. Run it first, or pass --deps.")
            print(f"--deps: running '{case['after']}' first")
            if not load_and_run(case["after"], deps, False, True) or not os.path.exists(pk): sys.exit(f"dependency '{case['after']}' failed: fix it first, '{cid}' was not run")
        c = json.load(open(pk)); done = c["done"]; sid, fork = (c["session_id"], True) if case.get("inherit", "session") == "session" else (None, False)
        use_root(case.get("external")); wipe_ws(); shutil.copytree(f"{STATE}/{case['after']}/ws", WS, dirs_exist_ok=True)
        print(f"continuing from '{case['after']}': " + (f"conversation (session {sid[:8]}, forked so other branches stay reusable) + workspace" if sid else "workspace files only (fresh conversation: the earlier role must not leak)"))
    else: wipe_ws()
    for s in case.get("setup", []): SETUPS[s]()
    os.makedirs(TR, exist_ok=True)
    for f in ("guard.jsonl", "hooks.jsonl"):
        if os.path.exists(f"{TR}/{f}"): os.remove(f"{TR}/{f}")
    json.dump({"done": done}, open(f"{TR}/team_state.json", "w"))
    agents = {n: {"description": AGENT_DESC[n], "model": "haiku", "tools": ["Bash"],
                  "prompt": f"Run {HERE}/run_agent.sh {n} and pass the COMPLETE prompt you were given, verbatim, on stdin with a quoted heredoc (<<'EOF'). Reply with the script's output verbatim and nothing else. Do not read any file."}
              for n in case.get("agents", []) + case.get("distractors", [])}
    plugin = build_plugin(case); hs = hooks_settings(); lead = open(f"{HERE}/prompts/{case.get('lead', 'lead_team')}.md").read()
    print(f"\n######## {cid}: {case['title']}\n  passed to main: agents={case.get('agents', [])} useless-agents={case.get('distractors', [])} "
          f"skills={case.get('skills', [])} useless-skills={case.get('distractor_skills', [])} tools={case.get('tools') or 'default'} lsp={bool(case.get('lsp'))}")
    ok_all, total = True, 0.0
    for n, turn in enumerate(case["turns"], 1):
        json.dump({"allowed": turn.get("allowed")}, open(f"{TR}/turn.json", "w")); open(f"{TR}/hooks.jsonl", "w").close()
        g0 = len(rows(f"{TR}/guard.jsonl")); before = ws_hashes()
        cmd = ["claude", "-p", turn["user"], "--output-format", "stream-json", "--verbose", "--model", "sonnet", "--setting-sources", "", "--settings", hs,
               "--permission-mode", "acceptEdits", "--strict-mcp-config", "--append-system-prompt", lead]
        if agents: cmd += ["--agents", json.dumps(agents)]
        if plugin: cmd += ["--plugin-dir", plugin]
        if case.get("tools"): cmd += ["--tools", ",".join(sorted(set(case["tools"]) | {"Bash"}))]  # --tools also limits the sub-agents: they need Bash for the mock script
        cmd += ["--allowedTools", "Bash(*run_agent.sh*)", "Read", "Grep", "Glob", "LSP", "Skill"]
        if sid: cmd += ["--resume", sid] + (["--fork-session"] if fork and n == 1 else [])
        env = dict(os.environ, CLAUDE_CODE_DISABLE_CLAUDE_MDS="1", TEST_WS=WS)
        t0 = time.time(); p = subprocess.run(cmd, stdin=subprocess.DEVNULL, capture_output=True, text=True, env=env, cwd=RUN_ROOT)
        open(f"{TR}/{cid}_turn{n}.stream.jsonl", "w").write(p.stdout)
        uses, results, reply, res, new_sid = parse_stream(p.stdout); sid = new_sid or sid; total += res.get("total_cost_usd", 0) or 0
        pre = [x["tool_input"] for x in rows(f"{TR}/hooks.jsonl") if x.get("hook_event_name") == "PreToolUse"]
        guard = rows(f"{TR}/guard.jsonl")[g0:]
        lsp_use = [u for u in uses if u["name"] == "LSP"]
        lsp_err = []
        for u in lsp_use:
            r = results.get(u["id"], {}); txt = json.dumps(r.get("content"))[:300]
            if r.get("is_error") or any(k in txt.lower() for k in ("no lsp server", "not available", "failed to", "error")): lsp_err.append(txt[:160])
        ctx = {"calls": [x.get("subagent_type") for x in pre], "tools": Counter(u["name"] for u in uses if u["name"] != "Agent"),
               "skills": [u["input"].get("skill") or u["input"].get("name") for u in uses if u["name"] == "Skill"], "reply": reply,
               "lsp_errors": lsp_err, "before": before, "after": ws_hashes()}
        ctx["tools"]["Agent"] = len(pre)
        fails = [f"GUARD STOP {x['role']}: {'; '.join(x['why'])}" for x in guard if x["verdict"] == "stop"] + evaluate(turn.get("expect", {}), ctx)
        warns = evaluate(turn.get("soft", {}), ctx)
        ok_all &= not fails
        ops = [u["input"].get("operation") for u in lsp_use]
        print(f"\n--- turn {n}: {'PASS' if not fails else 'FAIL ' + ' | '.join(fails)}{'   WARN ' + ' | '.join(warns) if warns else ''}")
        print(f"  user  : {turn['user'][:100]!r}\n  calls : subagents={ctx['calls']} hand-over chars={[len(x.get('prompt', '')) for x in pre]} guard={[(x['role'], x['verdict']) for x in guard]}")
        print(f"  tools : {dict(ctx['tools'])}  LSP ops={ops}  LSP errors={lsp_err[:1]}  skills={ctx['skills']}\n  reply : {reply[:260]!r}\n  cost  : ${res.get('total_cost_usd')}  {time.time() - t0:.0f}s")
        if any(x["verdict"] == "stop" for x in guard): break
    print(f"\n==> {cid}: {'PASS' if ok_all else 'FAIL'}  total ${total:.3f}")
    if ok_all:
        shutil.rmtree(f"{STATE}/{cid}", ignore_errors=True); os.makedirs(f"{STATE}/{cid}")
        shutil.copytree(WS, f"{STATE}/{cid}/ws")
        st = json.load(open(f"{TR}/team_state.json")) if os.path.exists(f"{TR}/team_state.json") else {"done": done}
        json.dump({"session_id": sid, "done": st["done"], "cost": round(total, 4), "at": time.strftime("%F %T"), "after": case.get("after")}, open(ck, "w"), indent=1)
        print(f"  checkpoint saved: _state/{cid}/  (continue or branch from it with after='{cid}')")
    if not keep: wipe_ws(); print("  test_run/ emptied (--keep to inspect)")
    return ok_all


def load_and_run(cid, deps, fresh, keep):
    import importlib.util
    spec = importlib.util.spec_from_file_location(cid, case_file(cid)); m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return run_case(m.CASE, deps, fresh, keep)


def main(case):
    a = sys.argv[1:]
    sys.exit(0 if run_case(case, "--deps" in a, "--fresh" in a, "--keep" in a) else 1)
