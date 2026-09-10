#!/usr/bin/env bash
EXP=/tmp/sol-advisor-01a07e0e-c12b-71f4-afdb-0f4bc9d5b673/runtime-experiment-1
cd "$EXP" || exit 90
claude --model opus --effort high --dangerously-skip-permissions --allowedTools 'Read,Write,Bash,Task,ListAgents,TaskOutput' --output-format stream-json --verbose --include-hook-events --forward-subagent-text -p "$(cat "$EXP/prompts/session-a.txt")" >"$EXP/raw/session-a.stream.jsonl" 2>"$EXP/raw/session-a.stderr.log"
rc=$?
printf 'SESSION_A_EXIT=%s\n' "$rc" >"$EXP/raw/session-a.exit"
tmux wait-for -S sol-runtime-a-01a07e0e-done
exit "$rc"
