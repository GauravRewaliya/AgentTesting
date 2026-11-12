import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_lib"))
from harness import main

CASE = dict(
    id="t2_wireframe", title="Plan approved: ONLY the ux-designer, with requirements + plan.md + examples in the hand-over", after="t1_plan",
    agents=["planner", "ux-designer", "builder", "qa-reviewer"], distractors=["poet"], tools=["Agent"], lead="lead_team",
    turns=[dict(
        user="The plan looks good, continue.", allowed=["ux-designer"],
        expect=dict(calls=["ux-designer"], reply_contains=["WIREFRAME", "App.js"], reply_asks="approve",
                    files_exist=["test_run/notes-app/App.js", "test_run/notes-app/wireframe.md"],
                    files_contain={"test_run/notes-app/App.js": "WIREFRAME"}))])

if __name__ == "__main__": main(CASE)
