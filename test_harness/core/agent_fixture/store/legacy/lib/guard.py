"""PreToolUse hook on Agent|Task: the interception. Checks every sub-agent call before the mock script runs.
 ok   -> exit 0 silently, the call proceeds (the mock script answers, no model-written work)
 stop -> {"continue": false, ...}: wrong role, wrong turn, role order broken, or a thin hand-over."""
import json, os, sys, time
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); T = os.path.join(R, "trace")
ev = json.load(sys.stdin); ti = ev.get("tool_input", {}); role = ti.get("subagent_type", ""); prompt = ti.get("prompt", "")
rules = json.load(open(os.path.join(R, "test_cases/_lib/rules.json")))
def load(p, d):
    try: return json.load(open(os.path.join(T, p)))
    except Exception: return d
done = load("team_state.json", {"done": []})["done"]; allowed = load("turn.json", {"allowed": None})["allowed"]
why = []
if role not in rules: why.append(f"unknown subagent '{role}'")
else:
    r = rules[role]; low = prompt.lower()
    if r.get("forbidden"): why.append(f"'{role}' is a useless/forbidden subagent for these cases")
    if allowed is not None and role not in allowed: why.append(f"'{role}' not allowed in this turn (allowed: {allowed})")
    r.setdefault("requires_done", []); r.setdefault("contains_all", []); r.setdefault("min_chars", 0)
    why += [f"needs '{d}' done first" for d in r["requires_done"] if d not in done]
    why += [f"hand-over lacks '{k}'" for k in r["contains_all"] if k.lower() not in low]
    if len(prompt) < r["min_chars"]: why.append(f"hand-over too thin ({len(prompt)} < {r['min_chars']} chars)")
open(os.path.join(T, "guard.jsonl"), "a").write(json.dumps({"t": time.time(), "role": role, "chars": len(prompt), "verdict": "stop" if why else "ok", "why": why}) + "\n")
if why:
    msg = "GUARD STOP: " + "; ".join(why)
    print(json.dumps({"continue": False, "stopReason": msg, "hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": msg}}))
else:
    json.dump({"done": done + [role]}, open(os.path.join(T, "team_state.json"), "w"))
