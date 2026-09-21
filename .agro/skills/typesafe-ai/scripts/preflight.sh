#!/usr/bin/env bash
# Report whether TypeSafe is usable from this sandbox, then exit 0 either way.
# A missing key is an operator-configuration fact, not a script failure, so the
# caller reports what is unconfigured and moves on. A non-zero exit means this
# script itself is broken.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADAPTER="$SKILL_DIR/../../scripts/typesafe.mjs"
ENV_VAR="TYPESAFE_API_KEY"

LIVE=0
for arg in "$@"; do
  case "$arg" in
    --live) LIVE=1 ;;
    -h | --help)
      cat <<'USAGE'
preflight.sh — check that TypeSafe is configured before building with it

  bash preflight.sh [--live]

  (no flags)  report whether TYPESAFE_API_KEY is configured
  --live      additionally make one minimal request to verify the key works

Always exits 0. Surface the output to the operator verbatim.
USAGE
      exit 0
      ;;
    *)
      echo "preflight.sh: unknown flag: $arg" >&2
      exit 2
      ;;
  esac
done

if [ -f "$ADAPTER" ]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "TypeSafe preflight cannot run — node is not on PATH." >&2
    echo "TypeSafe judgments are unavailable until this is fixed." >&2
    exit 0
  fi
  if [ "$LIVE" -eq 1 ]; then
    node "$ADAPTER" --live || true
  else
    node "$ADAPTER" || true
  fi
  exit 0
fi

# The adapter is absent — this skill was installed without the control-plane
# sibling. Say so loudly rather than degrading silently, then answer what can
# still be answered from the environment alone.
echo "TypeSafe adapter is missing — expected .agro/scripts/typesafe.mjs beside this skill." >&2
echo "  Judgment helpers are unavailable; use the SDK directly in application code." >&2

if [ -n "${!ENV_VAR:-}" ]; then
  echo "$ENV_VAR is configured." >&2
else
  echo "TypeSafe is not configured — $ENV_VAR is unset." >&2
  echo "  Set it:   agro secret set $ENV_VAR" >&2
  echo "  Or add it to .env, then:  set -a; source .env; set +a" >&2
  echo "  Docs:     https://docs.typesafe.ai/sdk/javascript" >&2
  echo "TypeSafe judgments are unavailable until this is set." >&2
fi
exit 0
