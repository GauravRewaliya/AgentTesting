// HOW A CALLER STARTS A SUB-AGENT in approach 1 (a1_team_cli): the `team agent <name> / agent all / agent wait / agent list` shell commands. This text is part of the APPROACH, not of the shared launch
// code: another approach (a2 native Agent tool, a3) tells its callers something else. launch.ts takes it as a parameter (default: this one) and appends it after the sub-agent list.
export const delegateDocs = (teamCmd: string): string => `

# How to call them (one Bash command each; every command prints one line of JSON)
  ${teamCmd} agent <role> --session new|<agent_id>|fork:<agent_id> --objective "<what>" --output "<format>" --boundaries "<limits>" [--async] [--mode ask] [--writes a,b] [--title "<what this agent is for>"]
  ${teamCmd} agent all --from <agent_id> --role <role> --tasks '[{"title":"..","writes":["run_test/p/a.js"],"objective":".."},{...}]'   N tasks for N copies of one agent\'s memory, ALL STARTED AT ONCE (no --async to forget); then ONE agent wait
  ${teamCmd} agent wait --agents <id>,<id> [--any] [--timeout 300]     (after --async calls: waits until they finish and returns their answers)
  ${teamCmd} agent list
To ask an agent that already worked on a topic for more, continue it with --session <its agent_id>: it remembers what it did.`;
