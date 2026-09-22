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
PROJECT="$WORK/project"
HOME_DIR="$WORK/home"
mkdir -p "$PROJECT/.agro/scripts" "$HOME_DIR"
printf '{\n  "name": "probe",\n  "langfuse": {}\n}\n' > "$PROJECT/agro.json"

set +e
(
  cd "$PROJECT"
  env -u LANGFUSE_PUBLIC_KEY -u LANGFUSE_SECRET_KEY -u LANGFUSE_BASE_URL \
    HOME="$HOME_DIR" \
    timeout 20 node "$ROOT/$CLI" config langfuse </dev/null >"$WORK/out" 2>"$WORK/err"
  echo $? > "$WORK/code"
)
set -e
code="$(cat "$WORK/code")"

if [ "$code" = "124" ]; then
  missing+=("agro config langfuse blocked for 20s with stdin not a TTY — the wizard prompted an unattended session")
elif [ "$code" != "0" ]; then
  missing+=("agro config langfuse exited $code with stdin not a TTY (expected 0): $(head -c 400 "$WORK/err" | tr '\n' ' ')")
fi
if ! grep -qF "$NOTICE" "$WORK/out"; then
  missing+=("stdout lacks the skip notice \"$NOTICE\" — an operator cannot tell the wizard was bypassed")
fi
if grep -qF "$STEP_MARK" "$WORK/out" "$WORK/err"; then
  missing+=("a wizard step marker \"$STEP_MARK\" was rendered with stdin not a TTY — the wizard ran unattended")
fi
if [ -e "$HOME_DIR/.config/agro/langfuse.env" ]; then
  missing+=("the skipped wizard wrote the credential fragment for a project with langfuse unset")
fi

if ((${#missing[@]})); then
  printf 'REGRESSION: %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "PASS: agro config langfuse skips the wizard without a TTY (exit 0, notice printed, no step rendered) and carries the shared interactivity gate" >&2
