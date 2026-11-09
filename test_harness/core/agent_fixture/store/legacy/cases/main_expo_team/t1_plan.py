import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_lib"))
from harness import main

CASE = dict(
    id="t1_plan", title="Long task: classify, call ONLY the planner, return the plan, wait for approval",
    agents=["planner", "ux-designer", "builder", "qa-reviewer"], distractors=["poet"], tools=["Agent"], lead="lead_team",
    turns=[dict(
        user="I am new to Expo Go. Using https://github.com/expo/examples as the base, recreate for me a small app in our workspace folder test_run: a drawer navigation (like their drawer-navigation example) whose screens share one list through a zustand store (like their zustand example).",
        allowed=["planner"],
        expect=dict(calls=["planner"], reply_contains=["Task size: long", "plan.md"], reply_asks="approve",
                    files_exist=["test_run/notes-app/plan.md"], files_absent=["test_run/notes-app/App.js"]))])

if __name__ == "__main__": main(CASE)
