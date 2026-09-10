#!/usr/bin/env bash
EXP=/tmp/sol-advisor-01a07e0e-c12b-71f4-afdb-0f4bc9d5b673/runtime-experiment-1
cd "$EXP" || exit 90
claude --model opus --effort high --dangerously-skip-permissions --allowedTools 'Read,Write,Bash,Task,ListAgents,TaskOutput,SendMessage' --output-format stream-json --verbose --include-hook-events -p "$(cat "$EXP/prompts/session-b.txt")" >"$EXP/raw/session-b.stream.jsonl" 2>"$EXP/raw/session-b.stderr.log"
rc=$?
printf 'SESSION_B_EXIT=%s\n' "$rc" >"$EXP/raw/session-b.exit"
tmux wait-for -S sol-runtime-b-01a07e0e-done
exit "$rc"
