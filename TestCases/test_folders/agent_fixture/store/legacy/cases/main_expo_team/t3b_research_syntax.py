import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_lib"))
from harness import main

# BRANCH of t3_build: a package-research question about the code the builder wrote. Only the researcher is passed (plus a useless poet).
CASE = dict(
    id="t3b_research_syntax", title="Ask about the package syntax and check the builder's store.js: package-researcher IS required", after="t3_build",
    agents=["package-researcher"], distractors=["poet"], tools=["Agent"], lead="lead_team",
    turns=[dict(
        user="Before we go on: is the zustand code the builder wrote in test_run/notes-app/store.js valid for the zustand version we depend on? "
             "Also tell me the syntax to create a store and to use shallow.",
        allowed=["package-researcher"],
        expect=dict(calls=["package-researcher"], reply_contains=["create", "shallow", "3.6.7"], files_unchanged=["test_run/notes-app/store.js"]))])

if __name__ == "__main__": main(CASE)
