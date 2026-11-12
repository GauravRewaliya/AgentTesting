import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_lib"))
from harness import main

"""FREE (no model): the guard against good and bad hand-overs. python3 -I test_cases/main_expo_team/g0_guard_offline.py"""
import json, os, subprocess, sys
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))); os.chdir(R); os.makedirs("trace", exist_ok=True)
UX = ("Create the wireframe for the notes-app in test_run/notes-app. Requirements from the user: Expo Go app, drawer navigation (Home, Notifications) like "
      "expo/examples with-drawer-navigation, and screens that share a list through a zustand store like with-zustand. Read the approved plan at "
      "test_run/notes-app/plan.md. Output: wireframe pseudo code placed at the real paths App.js and store.js, plus wireframe.md.")
BUILD = ("Build notes-app in test_run: replace the approved wireframe (App.js, store.js) with the original code from expo/examples with-drawer-navigation and "
         "with-zustand. Plan: test_run/notes-app/plan.md. Merge package.json dependencies.")
RES = "Is the zustand code in test_run/notes-app/store.js valid for our zustand version? Also the syntax for create and shallow, please."
CASES = [("good ux hand-over after planner", ["planner"], ["ux-designer"], "ux-designer", UX, "ok"),
         ("ux before the planner ran", [], ["ux-designer"], "ux-designer", UX, "stop"),
         ("thin hand-over", ["planner"], ["ux-designer"], "ux-designer", "make the wireframe", "stop"),
         ("builder in the plan-approval turn", ["planner", "ux-designer"], ["planner"], "builder", BUILD, "stop"),
         ("unknown subagent", [], None, "general-purpose", "do everything", "stop"),
         ("good builder hand-over", ["planner", "ux-designer"], ["builder", "qa-reviewer"], "builder", BUILD, "ok"),
         ("useless agent (poet) called", [], None, "poet", "write a poem about the store", "stop"),
         ("any agent in a turn that allows none", [], [], "package-researcher", RES, "stop"),
         ("good package-researcher hand-over", [], ["package-researcher"], "package-researcher", RES, "ok"),
         ("researcher hand-over without the file path", [], ["package-researcher"], "package-researcher", "what is the syntax of zustand create and shallow? long enough text " * 3, "stop")]
bad = 0
for name, done, allowed, role, prompt, want in CASES:
    json.dump({"done": done}, open("trace/team_state.json", "w")); json.dump({"allowed": allowed}, open("trace/turn.json", "w"))
    ev = {"hook_event_name": "PreToolUse", "tool_name": "Agent", "tool_input": {"subagent_type": role, "prompt": prompt}}
    out = subprocess.run(["python3", "-I", "test_cases/_lib/guard.py"], input=json.dumps(ev), capture_output=True, text=True).stdout.strip()
    got = "stop" if '"continue": false' in out else "ok"; bad += got != want
    print("PASS" if got == want else "FAIL", name, "->", got, json.loads(out)["stopReason"][:100] if out else "")
for f in ("team_state.json", "turn.json", "guard.jsonl"):
    if os.path.exists("trace/" + f): os.remove("trace/" + f)
sys.exit(bad)
