import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_lib"))
from harness import main

# BRANCH of t3_build: a small question answerable from the conversation. Three agents are passed, none may be called.
CASE = dict(
    id="t3c_small_no_call", title="Minor question: must NOT call any sub-agent (planner, researcher and poet are all available)", after="t3_build",
    agents=["planner", "package-researcher"], distractors=["poet"], tools=["Agent"], lead="lead_team",
    turns=[dict(
        user="Quick one: which two expo example projects did we base the app on? One line, no new work please.", allowed=[],
        expect=dict(calls=[], reply_contains=["drawer", "zustand"]))])

if __name__ == "__main__": main(CASE)
