import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "_lib"))
from harness import main

# Skills passed to the main agent: one required (naming-convention), one useless (tarot-reader). No sub-agent needed.
CASE = dict(
    id="s1_skill_convention", title="Needs the team naming skill; must not touch the tarot skill or any sub-agent",
    agents=[], distractors=["poet"], skills=["naming-convention"], distractor_skills=["tarot-reader"], tools=["Agent", "Skill"], lead="lead_dev",
    turns=[dict(
        user="What should I name the new zustand store file for the checkout feature, following our team convention?", allowed=[],
        expect=dict(calls=[], skills_used=["naming-convention"], skills_not_used=["tarot-reader"], reply_contains=["checkout.store.js"]))])

if __name__ == "__main__": main(CASE)
