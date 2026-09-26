#!/usr/bin/env bash

ep_json_str() {
  jq -Rn --arg v "$1" '$v'
}

ep_json_lines() {
  jq -R -s -c 'split("\n") | map(select(length > 0))'
}

ep_locked() {
  local lock="$1"
  shift
  (
    flock 8
    "$@"
  ) 8>"$lock"
}

ep_append_line() {
  local file="$1" line="$2"
  (
    flock 9
    printf '%s\n' "$line" >>"$file"
  ) 9>"$file.lock"
}

ep_finalize_trace() {
  local raw="$1"
  [ -f "$raw" ] && gzip -n -f "$raw"
  if [ -f "$raw.gz" ]; then
    jq -cn --arg p "$raw.gz" --arg s "$(sha256sum "$raw.gz" | cut -d' ' -f1)" '{path: $p, sha256: $s}'
  else
    printf 'null\n'
  fi
}

ep_trace_events() {
  gzip -dc "$1" 2>/dev/null | jq -c -R 'fromjson? | objects'
}

ep_result_event() {
  [ -f "$1" ] || return 0
  ep_trace_events "$1" | jq -c -s 'map(select(.type == "result")) | last // empty'
}

ep_usage_json() {
  local result="$1"
  if [ -z "$result" ]; then
    printf 'null\n'
    return 0
  fi
  jq -c '{
      input_tokens: (.usage.input_tokens // null),
      output_tokens: (.usage.output_tokens // null),
      cache_read_input_tokens: (.usage.cache_read_input_tokens // null),
      cache_creation_input_tokens: (.usage.cache_creation_input_tokens // null),
      total_cost_usd: (.total_cost_usd // null),
      num_turns: (.num_turns // null)
    }' <<<"$result"
}

ep_ran_command() {
  local trace="$1" pattern="$2"
  [ -f "$trace" ] || { printf 'false\n'; return 0; }
  ep_trace_events "$trace" | jq -s --arg p "$pattern" 'any(.[]; .type == "assistant"
      and any(.message.content[]?; .type == "tool_use" and ((.input.command // "") | test($p))))'
}

ep_elapsed_s() {
  awk -v s="$1" -v e="$(date +%s%N)" 'BEGIN {printf "%.3f", (e - s) / 1e9}'
}
