#!/usr/bin/env bash
# tier: A
# source: issue #645 — clean-breaking audit migration
# desc: all tracked active surfaces, including current tasks/docs/templates/probes, reject stale public audit vocabulary
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"; cd "$ROOT"
pat='(^|[^A-Za-z0-9-])(pr-audit|harness-audit|context-audit|skill-lint|eval-lint|drift-check)([^A-Za-z0-9-]|$)|\.agro/skills/(pr-audit|harness-audit|context-audit|skill-lint|eval-lint|drift-check)(/|$)|auditor\.md'
set +e
hits=$(git grep -n -E "$pat" -- ':!CHANGELOG.md' ':!docs/rfcs/preserved-changelog-rationale.md' ':!.agro/evals/RESULTS.md' ':!.agro/evals/datasets/**' ':!.agro/tasks/archive/**')
rc=$?; set -e
[[ $rc -eq 0 || $rc -eq 1 ]] || { echo 'REGRESSION: stale-reference inventory failed' >&2; exit 1; }
bad=()
while IFS= read -r hit; do
  [[ -n $hit ]] || continue
  path=${hit%%:*}; rest=${hit#*:}; line=${rest#*:}
  case "$path:$line" in
    .agro/evals/probes/audit-dispatcher-contract.sh:*|.agro/evals/probes/audit-stale-references.sh:*) continue;;
    .agro/skills.lock:*Migrated*provenance*) continue;;
    .agro/scripts/link-providers.sh:*context-audit-runner.sh*|.agro/skills/audit/references/context.md:*context-audit-*) continue;;
    .agro/skills/audit/references/pr.md:*pr-audit-proof*|.agro/skills/audit/references/prs.md:*pr-audit-proof*) continue;;
    .agro/skills/prompt-miner/scripts/mine-traces.mjs:*pr-audit*) continue;;
  esac
  bad+=("$hit")
done <<<"$hits"
if ((${#bad[@]})); then printf '%s\n' "${bad[@]}" >&2; echo 'REGRESSION: active legacy audit reference' >&2; exit 1; fi
# shellcheck disable=SC2016 # literal Markdown route token
bare_audit='`/audit`'
for caller in \
  .agro/knowledge/source/recursive-language-models.md \
  .agro/skills/weigh \
  .agro/skills/benchmark/SKILL.md \
  .agro/skills/spec/SKILL.md \
  .agro/skills/spec/references/execute.md \
  .agro/skills/spec/references/retro.md \
  docs/artifact-contract-schema.md
do
  if git grep -nF "$bare_audit" -- "$caller"; then
    echo "REGRESSION: bare implementation audit route in $caller" >&2; exit 1
  fi
done
if grep -nF 'mechanics + `/audit`' AGENTS.md; then
  echo 'REGRESSION: workflow summary uses bare implementation audit route' >&2; exit 1
fi
# shellcheck disable=SC2016 # literal documented environment variable
canonical_skills='$AUDIT_ROOT/.agro/skills/'
grep -qF "$canonical_skills" .agro/skills/audit/references/skills.md \
  || { echo 'REGRESSION: skills audit does not scan canonical .agro/skills' >&2; exit 1; }
for path in AGENTS.md docs/README.md docs/artifact-contract-schema.md crons/heartbeat.md .github/workflows/ci-harness.yml .agro/evals/capability/tasks/CB-001-ship-harness-change.md .agro/skills/benchmark/SKILL.md .agro/skills/spec/references/retro.md; do
  git ls-files --error-unmatch "$path" >/dev/null || { echo "REGRESSION: stale-reference coverage path missing: $path" >&2; exit 1; }
done
echo 'PASS: no active legacy audit references across tracked active surfaces' >&2
