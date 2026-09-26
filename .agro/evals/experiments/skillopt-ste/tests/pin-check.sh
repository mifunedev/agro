#!/usr/bin/env bash
set -euo pipefail

EXP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EXP_DIR
readonly CHECK="$EXP_DIR/check-pins.sh"
REPO_ROOT="$(git -C "$EXP_DIR" rev-parse --show-toplevel)"
readonly REPO_ROOT
readonly EXP_REL="${EXP_DIR#"$REPO_ROOT"/}"
readonly SKILL_REL=.agro/skills/ste

scratch="$(mktemp -d)"
cleanup() {
  rm -rf "$scratch"
}
trap cleanup EXIT
readonly COPY="$scratch/root"
readonly SHIM="$scratch/shim"

reset_copy() {
  rm -rf "$COPY"
  mkdir -p "$COPY/$EXP_REL/corpus" "$COPY/$(dirname "$SKILL_REL")"
  cp "$REPO_ROOT/AGENTS.md" "$COPY/AGENTS.md"
  cp -R "$REPO_ROOT/$SKILL_REL" "$COPY/$SKILL_REL"
  cp "$EXP_DIR/corpus/manifest.json" "$COPY/$EXP_REL/corpus/manifest.json"
  cp "$EXP_DIR/verify.sh" "$COPY/$EXP_REL/verify.sh"
}

change_byte() {
  printf 'X' | dd of="$1" bs=1 seek=0 count=1 conv=notrunc status=none
}

status=0
expect() {
  local label="$1" want_rc="$2" want_text="$3" rc
  shift 3
  set +e
  err="$("$@" 2>&1 >/dev/null)"
  rc=$?
  set -e
  if [ "$rc" -ne "$want_rc" ]; then
    printf 'FAIL %s: exit %s, want %s: %s\n' "$label" "$rc" "$want_rc" "$err" >&2
    status=1
  elif [ -n "$want_text" ] && [[ "$err" != *"$want_text"* ]]; then
    printf 'FAIL %s: stderr does not name %s: %s\n' "$label" "$want_text" "$err" >&2
    status=1
  else
    printf 'PASS %s\n' "$label"
  fi
}

reset_copy
expect "clean baseline" 0 "" bash "$CHECK" --root "$COPY"
expect "clean candidate" 0 "" bash "$CHECK" --arm candidate --root "$COPY"

pinned_files=(
  "root_agents_md|AGENTS.md"
  "baseline_skill_md|$SKILL_REL/SKILL.md"
  "ste_frozen_tree|$SKILL_REL/references/rules.md"
  "ste_frozen_tree|$SKILL_REL/scripts/ste-check.sh"
  "corpus_manifest|$EXP_REL/corpus/manifest.json"
  "verify_sh|$EXP_REL/verify.sh"
)
for entry in "${pinned_files[@]}"; do
  IFS='|' read -r name path <<<"$entry"
  reset_copy
  change_byte "$COPY/$path"
  expect "baseline names $name after a change to $path" 1 "MISMATCH $name " bash "$CHECK" --root "$COPY"
done

reset_copy
change_byte "$COPY/$SKILL_REL/SKILL.md"
expect "baseline rejects a SKILL.md change" 1 "MISMATCH ste_tree " bash "$CHECK" --root "$COPY"
expect "candidate accepts a SKILL.md change" 0 "" bash "$CHECK" --arm candidate --root "$COPY"

reset_copy
change_byte "$COPY/$SKILL_REL/references/rules.md"
expect "candidate rejects a references change" 1 "MISMATCH ste_frozen_tree " bash "$CHECK" --arm candidate --root "$COPY"

reset_copy
printf 'extra\n' > "$COPY/$SKILL_REL/NOTES.md"
expect "candidate rejects an added skill file" 1 "MISMATCH ste_frozen_tree " bash "$CHECK" --arm candidate --root "$COPY"

reset_copy
mkdir -p "$SHIM"
printf '#!/usr/bin/env bash\nprintf "9.9.9 (Claude Code)\\n"\n' > "$SHIM/claude"
chmod +x "$SHIM/claude"
expect "baseline rejects another harness version" 1 "MISMATCH harness_version " env PATH="$SHIM:$PATH" bash "$CHECK" --root "$COPY"

expect "bad arm exits 2" 2 "" bash "$CHECK" --arm other --root "$COPY"
expect "missing root exits 2" 2 "" bash "$CHECK" --root "$scratch/absent"

exit "$status"
