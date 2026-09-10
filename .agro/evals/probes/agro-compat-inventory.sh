#!/usr/bin/env bash
# tier: A
# source: issue #940 (AGRO Phase 0) — every active OH_* contract is inventoried and classified before any phase renames it
# desc: every OH_* identifier in tracked or untracked non-ignored files appears in .agro/compat-inventory.json with one of the four classifications, no non-obsolete entry is stale, and every alias-sla entry names its AGRO_* spelling
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
INVENTORY="$ROOT/.agro/compat-inventory.json"

[[ -f "$INVENTORY" ]] || { echo "SKIPPED: $INVENTORY absent — the Phase 0 inventory has not landed here" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "SKIPPED: jq not on PATH" >&2; exit 2; }
git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1 || { echo "SKIPPED: not a git checkout" >&2; exit 2; }

fails=()

if ! jq -e '.version == 1 and (.classifications | keys | sort) == ["alias-sla","migrate-later","obsolete","retained-generic"]' "$INVENTORY" >/dev/null; then
  fails+=("inventory must be version 1 with exactly the four classifications")
fi

bad_class="$(jq -r '[.variables, .paths] | map(to_entries[]) | map(select(.value.classification as $c | ["migrate-later","alias-sla","retained-generic","obsolete"] | index($c) | not)) | .[].key' "$INVENTORY")"
[[ -z "$bad_class" ]] || fails+=("entries with an unknown classification: $(tr '\n' ' ' <<<"$bad_class")")

found="$(git -C "$ROOT" ls-files -z --cached --others --exclude-standard \
  | grep -zv -e '^\.agro/tasks/' -e '^\.agro/compat-inventory\.json$' \
  | sort -zu \
  | xargs -0 grep -ohI -E '\bOH_[A-Z0-9_]*[A-Z0-9]\b' 2>/dev/null | sort -u || true)"
inventoried="$(jq -r '.variables | keys[]' "$INVENTORY" | sort -u)"
non_obsolete="$(jq -r '.variables | to_entries[] | select(.value.classification != "obsolete") | .key' "$INVENTORY" | sort -u)"

missing="$(comm -23 <(printf '%s\n' "$found") <(printf '%s\n' "$inventoried") | paste -sd' ' -)"
[[ -z "$missing" ]] || fails+=("OH_* identifiers in the tree that the inventory does not classify: $missing")

stale="$(comm -13 <(printf '%s\n' "$found") <(printf '%s\n' "$non_obsolete") | paste -sd' ' -)"
[[ -z "$stale" ]] || fails+=("non-obsolete inventory entries no file mentions: $stale")

no_agro="$(jq -r '.variables | to_entries[] | select(.value.classification == "alias-sla") | select((.value.agro // "") | startswith("AGRO_") | not) | .key' "$INVENTORY" | paste -sd' ' -)"
[[ -z "$no_agro" ]] || fails+=("alias-sla entries without an AGRO_* spelling: $no_agro")

# shellcheck disable=SC2088
for path in '.oh/' 'oh.json' '~/.oh/sandboxes/' '~/.openharness' '/opt/oh-seed' '.oh/.image-seeded'; do
  jq -e --arg p "$path" '.paths[$p]' "$INVENTORY" >/dev/null || fails+=("persisted path not inventoried: $path")
done

if (( ${#fails[@]} > 0 )); then
  echo "REGRESSION: legacy contract inventory drifted from the tree:" >&2
  printf '  - %s\n' "${fails[@]}" >&2
  exit 1
fi

echo "PASS: every OH_* identifier in tracked or untracked non-ignored files is classified in .agro/compat-inventory.json, no non-obsolete entry is stale, alias-sla entries carry their AGRO_* spelling, and the epic's persisted legacy paths are inventoried" >&2
exit 0
