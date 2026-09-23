#!/usr/bin/env bash
# tier: A
# source: #1131 — `agro config langfuse` is a five-step interactive wizard, but the same
#         binary runs from bootstrap, systemd, and cron with no terminal attached. A wizard
#         that blocks on its first prompt there hangs the unattended session forever
#         (AGENTS.md non-negotiable #3). The gate that prevents this is a one-line boolean
#         that a refactor can silently flip.
# desc: with stdin not a TTY and no --yes, `agro config langfuse` must skip the wizard:
#       exit 0 inside the timeout, print the skip notice, and never render a wizard step.
#       The gate in commands/langfuse.ts must be the exact expression the sandbox wizard
#       uses, so the two interactive commands cannot drift apart.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; cd "$ROOT"
CLI=".agro/cli/dist/agro.js"
SRC=".agro/cli/src/commands/langfuse.ts"
GATE='opts.yes !== true && (process.stdin.isTTY === true || io.ask !== undefined)'
NOTICE='skipping the wizard'
STEP_MARK='[1/5]'

if [ ! -f "$SRC" ]; then
  echo "SKIPPED: $SRC absent — no Langfuse wizard to check" >&2
  exit 2
fi
if ! command -v node >/dev/null 2>&1; then
  echo "SKIPPED: node is not on PATH" >&2
  exit 2
fi
if [ ! -f "$CLI" ]; then
  echo "SKIPPED: $CLI absent — run \`npm --prefix .agro/cli run build\` first" >&2
  exit 2
fi
if [ "$SRC" -nt "$CLI" ]; then
  echo "SKIPPED: $CLI is older than $SRC — rebuild before probing" >&2
  exit 2
fi

missing=()

if ! grep -qF "$GATE" "$SRC"; then
  missing+=("$SRC does not contain the sandbox wizard's interactivity gate verbatim: $GATE")
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

run_unattended() {
  local project="$1" home="$2" out="$3" err="$4"
  (
    cd "$project"
    env -u LANGFUSE_PUBLIC_KEY -u LANGFUSE_SECRET_KEY -u LANGFUSE_BASE_URL \
      HOME="$home" \
      timeout 20 node "$ROOT/$CLI" config langfuse </dev/null >"$out" 2>"$err"
  )
}

UNSET="$WORK/unset"
UNSET_HOME="$WORK/unset-home"
mkdir -p "$UNSET/.agro/scripts" "$UNSET_HOME"
printf '{\n  "name": "probe",\n  "langfuse": {}\n}\n' > "$UNSET/agro.json"

set +e
run_unattended "$UNSET" "$UNSET_HOME" "$WORK/unset.out" "$WORK/unset.err"
code=$?
set -e

if [ "$code" = "124" ]; then
  missing+=("langfuse unset: agro config langfuse blocked for 20s with stdin not a TTY — the wizard prompted an unattended session")
elif [ "$code" != "0" ]; then
  missing+=("langfuse unset: agro config langfuse exited $code with stdin not a TTY (expected 0): $(head -c 400 "$WORK/unset.err" | tr '\n' ' ')")
fi
if ! grep -qF "$NOTICE" "$WORK/unset.out"; then
  missing+=("langfuse unset: stdout lacks the skip notice \"$NOTICE\" — an operator cannot tell the wizard was bypassed")
fi
if grep -qF "$STEP_MARK" "$WORK/unset.out" "$WORK/unset.err"; then
  missing+=("langfuse unset: a wizard step marker \"$STEP_MARK\" was rendered with stdin not a TTY — the wizard ran unattended")
fi
if [ -e "$UNSET_HOME/.config/agro/langfuse.env" ]; then
  missing+=("langfuse unset: the skipped wizard wrote the credential fragment")
fi

ENABLED="$WORK/enabled"
ENABLED_HOME="$WORK/enabled-home"
mkdir -p "$ENABLED/.agro/scripts" "$ENABLED_HOME"
printf '{\n  "name": "probe",\n  "langfuse": {\n    "enabled": true,\n    "baseUrl": "http://127.0.0.1:9"\n  }\n}\n' > "$ENABLED/agro.json"
printf 'LANGFUSE_PUBLIC_KEY=pk-lf-probe0000000000\nLANGFUSE_SECRET_KEY=sk-lf-probe0000000000\n' > "$ENABLED/.env"

set +e
run_unattended "$ENABLED" "$ENABLED_HOME" "$WORK/enabled.out" "$WORK/enabled.err"
code=$?
set -e

if [ "$code" = "124" ]; then
  missing+=("langfuse enabled: agro config langfuse blocked for 20s with stdin not a TTY — the wizard prompted an unattended session")
fi
if ! grep -qF "$NOTICE" "$WORK/enabled.out"; then
  missing+=("langfuse enabled: stdout lacks the skip notice \"$NOTICE\"")
fi
if grep -qF "$STEP_MARK" "$WORK/enabled.out" "$WORK/enabled.err"; then
  missing+=("langfuse enabled: a wizard step marker \"$STEP_MARK\" was rendered with stdin not a TTY — the wizard ran unattended")
fi
if ! grep -qE '"enabled": *true' "$ENABLED/agro.json"; then
  missing+=("langfuse enabled: an unattended run flipped langfuse.enabled off — the wizard took the disable branch without an operator")
fi
if grep -qF "sk-lf-probe0000000000" "$WORK/enabled.out" "$WORK/enabled.err"; then
  missing+=("langfuse enabled: the secret key was echoed")
fi

if ((${#missing[@]})); then
  printf 'REGRESSION: %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "PASS: agro config langfuse skips the wizard without a TTY for an unset and an enabled project (notice printed, no step rendered, enabled never flipped) and carries the shared interactivity gate" >&2
