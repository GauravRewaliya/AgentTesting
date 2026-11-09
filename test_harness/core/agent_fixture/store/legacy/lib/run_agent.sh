#!/usr/bin/env bash
# Serves the recorded result of a team role. usage: ./test_cases/_lib/run_agent.sh <role> <<'EOF' ...the full prompt... EOF
exec python3 -I "$(cd "$(dirname "$0")/../.." && pwd)/lib/mock_subagent.py" --role "$1"
