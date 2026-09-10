#!/usr/bin/env bash
# tier: A
# source: PR #833 (migrate-harness-yaml.sh — append / uncomment-in-place / preserve / overwrite, plus a silent no-op second run) 2026-08-26
# desc: migrate-harness-yaml.sh carries a live harness.yaml into the agro.json/root-dotenv split — non-secret settings land as agro.json fields (never .devcontainer/.env or the retired .agro/config.json), the file is renamed, and the second run is a no-op
set -euo pipefail


ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MIGRATOR="$ROOT/.agro/scripts/migrate-harness-yaml.sh"

if [[ ! -f "$MIGRATOR" ]]; then
  echo "SKIPPED: .agro/scripts/migrate-harness-yaml.sh absent on this branch" >&2
  exit 2
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "SKIPPED: jq not on PATH — cannot read the migrated agro.json" >&2
  exit 2
fi

fails=()
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/.devcontainer" "$work/.agro/scripts"

cat > "$work/harness.yaml" <<'YAML'
sandbox:
  name: probebox
  timezone: America/Denver
git:
  user_name: Probe User
install:
  hermes: true
compose:
  overrides:
    - .devcontainer/docker-compose.probe.yml
YAML

cat > "$work/agro.json" <<'JSON'
{
  "version": 1,
  "name": "stalename",
  "git": {
    "userName": "Probe User"
  }
}
JSON

set +e
out="$(sh "$MIGRATOR" "$work" 2>&1)"
rc=$?
set -e

(( rc == 0 )) || fails+=("migrator exited $rc on a live harness.yaml")

if [[ ! -f "$work/agro.json" ]]; then
  fails+=("agro.json is gone after migration — non-secret settings have nowhere to land")
else
  field() { jq -r "$1 // empty" "$work/agro.json" 2>/dev/null || true; }
  [[ "$(field '.name')"        == "probebox"       ]] || fails+=(".name not overwritten with the harness.yaml value (got '$(field '.name')')")
  [[ "$(field '.timezone')"    == "America/Denver" ]] || fails+=(".timezone not set from harness.yaml (got '$(field '.timezone')')")
  [[ "$(field '.git.userName')" == "Probe User"    ]] || fails+=(".git.userName lost its already-correct value (got '$(field '.git.userName')')")
  jq -e 'has("install")' "$work/agro.json" >/dev/null 2>&1 \
    && fails+=("the migrator carried a retired install section into agro.json — \`oh harness install\` and \`oh tool install\` are the only install door")
  jq -e '.composeOverrides | index(".devcontainer/docker-compose.probe.yml")' "$work/agro.json" >/dev/null 2>&1 \
    || fails+=("compose.overrides path did not reach agro.json composeOverrides[]")
  jq -e 'type == "object"' "$work/agro.json" >/dev/null 2>&1 \
    || fails+=("agro.json is not a JSON object after migration")
fi

for retired in "$work/.devcontainer/.env" "$work/.devcontainer/.example.env" "$work/.agro/config.json"; do
  [[ -e "$retired" ]] \
    && fails+=("migrator wrote the retired surface ${retired#"$work"/} — non-secret settings belong in agro.json")
done

grep -qF 'stalename' <<<"$out" || fails+=("the summary does not print the replaced value 'stalename', so an overwrite of an existing agro.json field is invisible")
grep -qF 'agro.json'   <<<"$out" || fails+=("the summary does not name agro.json as the destination")

[[ -f "$work/harness.yaml.migrated" ]] || fails+=("harness.yaml was not renamed to harness.yaml.migrated")
[[ -f "$work/harness.yaml"          ]] && fails+=("harness.yaml still exists after migration")

before="$(cat "$work/agro.json" 2>/dev/null || true)"
set +e
out2="$(sh "$MIGRATOR" "$work" 2>&1)"
rc2=$?
set -e
(( rc2 == 0 ))                                      || fails+=("second run exited $rc2 (must be a silent no-op)")
[[ -z "$out2" ]]                                    || fails+=("second run printed output (must be silent): ${out2%%$'\n'*}")
[[ "$before" == "$(cat "$work/agro.json" 2>/dev/null || true)" ]] || fails+=("second run modified agro.json")

if (( ${#fails[@]} > 0 )); then
  echo "REGRESSION: harness.yaml migration contract broken:" >&2
  printf '  - %s\n' "${fails[@]}" >&2
  exit 1
fi

echo "PASS: harness.yaml migration — settings carried into agro.json fields, overrides rehomed to composeOverrides[], no retired .devcontainer/.env or .agro/config.json written, file renamed, second run a no-op" >&2
exit 0
