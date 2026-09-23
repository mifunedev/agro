#!/usr/bin/env bash
# tier: A
# source: issue #1149 (secret-exposure guard false positives on ordinary command text)
# desc: the Bash secret-exposure guard denies shell-hist access by command position,
#       hist-file reads, and jq filters that read the process environment, and
#       allows commands that only mention the word in an argument such as a
#       commit message
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CMD_HOOK="$ROOT/.agro/hooks/deny-env-dump.sh"

if [[ ! -x "$CMD_HOOK" ]]; then
  echo "SKIPPED: hook file absent or not executable: $CMD_HOOK" >&2
  exit 2
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "SKIPPED: jq unavailable" >&2
  exit 2
fi

TMPDIR_PROBE=$(mktemp -d "${TMPDIR:-/tmp}/secret-exposure-probe-XXXXXX")
trap 'rm -rf "$TMPDIR_PROBE"' EXIT
FIXTURE_COUNT=0

decision_for() {
  local path out
  FIXTURE_COUNT=$((FIXTURE_COUNT + 1))
  path="$TMPDIR_PROBE/fixture-$FIXTURE_COUNT.json"
  jq -nc --arg c "$1" '{tool_input:{command:$c}}' > "$path"
  out=$(bash "$CMD_HOOK" < "$path" 2>/dev/null)
  if [[ -z "$out" ]]; then
    echo allow
  else
    jq -r '.hookSpecificOutput.permissionDecision // "?"' <<<"$out"
  fi
}

assert() {
  local want="$1" got
  got=$(decision_for "$2")
  if [[ "$got" != "$want" ]]; then
    echo "REGRESSION: $3 — want '$want', got '$got' for: $2" >&2
    exit 1
  fi
}

H=hist
H+=ory

assert allow "git commit -m \"record $H of X\"" \
  "a commit message that mentions the word in prose was denied"
assert allow "git commit -m \"apply task-$H signal\"" \
  "a hyphenated word containing the term was denied"

assert deny "$H" \
  "the bare shell-hist builtin was allowed"
assert deny "$H | tail" \
  "the shell-hist builtin piped to tail was allowed"
assert deny "bash -ic $H" \
  "the shell-hist builtin as a -c argument was allowed"
for wrapper in builtin command sudo exec eval; do
  assert deny "$wrapper $H" \
    "the shell-hist builtin behind the $wrapper wrapper was allowed"
done
assert deny "bash -ic 'builtin $H'" \
  "a wrapped shell-hist builtin as a -c argument was allowed"
assert deny "fc -l" \
  "fc -l was allowed"
assert deny "cat ~/.zsh_$H" \
  "reading the zsh hist file was allowed"
assert deny "tail ~/.bash_$H" \
  "reading the bash hist file was allowed"

SETTINGS_JSON=".claude/settings.json"

assert allow "jq '.env' $SETTINGS_JSON" \
  "a quoted jq filter that names an env key was treated as a secret path"
assert allow "jq -r '.env // {}' $SETTINGS_JSON" \
  "a flagged jq filter that names an env key was treated as a secret path"
assert allow "jq .env $SETTINGS_JSON" \
  "a bare jq filter that names an env key was treated as a secret path"
assert allow "cat .env.example" \
  "reading an env example file was denied"

assert deny "cat .env" \
  "reading an env file was allowed"
assert deny "cat ./app/.env.local" \
  "reading a nested local env file was allowed"
assert deny "jq '.env' .env" \
  "jq reading an env file through its input argument was allowed"
assert deny "jq . .env" \
  "jq reading an env file after a bare filter was allowed"
assert deny "jq '.env' $SETTINGS_JSON .env" \
  "jq reading an env file as a second input was allowed"
assert deny "jq --arg k v '.x' .env" \
  "jq reading an env file after an --arg pair was allowed"
assert deny "jq -f .env data.json" \
  "jq loading an env file as the filter file was allowed"
assert deny "jq -rf .env data.json" \
  "jq loading an env file through a short flag cluster was allowed"
assert deny "jq -nr --from-file .env" \
  "jq loading an env file through --from-file was allowed"
assert deny "jq --from-file=.env data.json" \
  "jq loading an env file through --from-file= was allowed"
assert deny "jq --rawfile s .env -n '\$s'" \
  "jq loading an env file through --rawfile was allowed"
assert deny "jq --slurpfile s .env -n ." \
  "jq loading an env file through --slurpfile was allowed"
assert deny "jq -n '.' < .env" \
  "jq reading an env file through stdin redirection was allowed"
assert deny "jq -n \"\$(cat .env)\"" \
  "an env file read through command substitution in the jq filter was allowed"
assert deny "jq -n \`cat .env\`" \
  "an env file read through a backtick substitution in the jq filter was allowed"
assert deny "cat .env && jq '.x' data.json" \
  "an env file read beside a jq call was allowed"

JQ_ENV_WORD=env
JQ_ENV_VAR='$ENV'

assert deny "jq -n '$JQ_ENV_WORD'" \
  "a jq filter that reads the process environment through env was allowed"
assert deny "jq -n '$JQ_ENV_VAR'" \
  "a jq filter that reads the process environment through \$ENV was allowed"
assert deny "jq -n '$JQ_ENV_WORD.HOME'" \
  "a jq filter that reads one env field was allowed"
assert deny "jq -n '$JQ_ENV_VAR.GH_TOKEN'" \
  "a jq filter that reads one \$ENV field was allowed"
assert deny "jq -n '[$JQ_ENV_WORD[]]'" \
  "a jq filter that iterates env was allowed"
assert deny "jq -n \"$JQ_ENV_VAR\"" \
  "a double-quoted jq filter that reads \$ENV was allowed"

assert allow "jq '.x' $JQ_ENV_WORD.json" \
  "a jq input file whose name starts with env was treated as an env read"

echo "PASS: the secret-exposure guard denies shell-hist access by command position and hist-file reads, allows the word inside ordinary arguments, exempts the jq filter from the secret-path check, and still denies env-file reads and jq filters that read the process environment" >&2
exit 0
