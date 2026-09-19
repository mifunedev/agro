#!/usr/bin/env bash
# tier: A
# source: issue #134; spec-simplification issue #816; workflow authority issue #854;
#         evidence retired into the PR body by issue #1088
# desc: /spec execute treats draft PRs as checkpoints and ready-for-review as success, and its
#       evidence gate refuses the undraft on the PR BODY's five sections rather than on a
#       task-folder evidence.md (retired by issue #1088).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EXEC="$ROOT/.claude/skills/spec/references/execute.md"
SPEC="$ROOT/.agro/skills/spec/SKILL.md"

[ -f "$EXEC" ] || { echo "SKIPPED: missing /spec execute procedure: $EXEC" >&2; exit 2; }
[ -f "$SPEC" ] || { echo "SKIPPED: missing /spec dispatcher: $SPEC" >&2; exit 2; }

bad_exec=$(grep -nE 'stops at draft PR|draft PR creation; loop launch|launch \+ CI verification stay manual|manual: `gh pr ready|manual: `/ci-status`' "$EXEC" || true)
if [[ -n "$bad_exec" ]]; then
  echo "REGRESSION: /spec execute reintroduced draft-only/manual-finalization guidance:" >&2
  echo "$bad_exec" >&2
  exit 1
fi

for token in 'ready-for-review' 'gh pr ready' 'Finalization contract' '/eval' '/ci-status' 'observability checkpoint'; do
  if ! grep -qF "$token" "$EXEC"; then
    echo "REGRESSION: /spec execute missing ready-finalization token: $token" >&2
    exit 1
  fi
done

final_section="$(awk '/^### [0-9]+\. Promotable gate/{f=1} f' "$EXEC")"
if [[ -z "$final_section" ]]; then
  echo "REGRESSION: /spec execute has no 'Promotable gate → undraft' section" >&2
  exit 1
fi
if ! grep -qE 'ready[^.]*\*\*only\*\* when|only when .*promotable|only if it is classified promotable' <<<"$final_section"; then
  echo "REGRESSION: /spec execute's gh pr ready is no longer gated on the promotable classification" >&2
  exit 1
fi
if ! grep -qF 'gh pr ready' <<<"$final_section"; then
  echo "REGRESSION: /spec execute's finalization section no longer performs the undraft" >&2
  exit 1
fi
if ! grep -qF 'Never `gh pr merge`' <<<"$final_section"; then
  echo "REGRESSION: /spec execute's finalization section no longer forbids gh pr merge" >&2
  exit 1
fi

# The evidence is the PR body, not a task-folder file. The retired artifact lived
# under gitignored .agro/tasks/, so it reached a reviewer only through `git add -f`
# and silently missed the diff without it. Its return is a regression.
if grep -qF 'evidence.md' "$EXEC"; then
  echo "REGRESSION: /spec execute reintroduced the retired .agro/tasks/<slug>/evidence.md artifact" >&2
  grep -nF 'evidence.md' "$EXEC" >&2
  exit 1
fi
if grep -qF 'git ls-files --error-unmatch' "$EXEC"; then
  echo "REGRESSION: /spec execute still tracks a gitignored evidence artifact instead of using the PR body" >&2
  exit 1
fi
if ! grep -qF 'The evidence gate' <<<"$final_section"; then
  echo "REGRESSION: /spec execute's merge gate no longer carries an evidence gate" >&2
  exit 1
fi
if ! grep -qF -e '--json body' <<<"$final_section"; then
  echo "REGRESSION: /spec execute's evidence gate no longer reads the PR body back from GitHub" >&2
  exit 1
fi
if ! grep -qE 'Refuse the undraft' <<<"$final_section"; then
  echo "REGRESSION: /spec execute no longer REFUSES the undraft when the PR body carries no evidence" >&2
  exit 1
fi
if ! grep -qF 'DRAFT-BLOCKED(evidence)' <<<"$final_section"; then
  echo "REGRESSION: /spec execute no longer records DRAFT-BLOCKED(evidence) for a body with no evidence" >&2
  exit 1
fi
for section in 'Why this is better' 'What the plan asked for' 'What was built' \
               'Where it diverged from the plan, and why' 'What remains unverified'; do
  if ! grep -qF "$section" <<<"$final_section"; then
    echo "REGRESSION: /spec execute's PR body no longer carries the '$section' section" >&2
    exit 1
  fi
done
# An empty divergence/unverified section is spelled out, never dropped.
if ! grep -qF 'None' <<<"$final_section" || ! grep -qF 'Nothing' <<<"$final_section"; then
  echo "REGRESSION: /spec execute no longer requires an empty diverged/unverified section to be written as None / Nothing" >&2
  exit 1
fi

# A promotable verdict describes ONE head. Undrafting at a commit and then pushing
# past it leaves a ready PR standing on a classification that no longer describes
# what a reviewer sees, so the procedure must (a) confirm the PR head is the commit
# being promoted and (b) re-open the gate on any later push.
if ! grep -qF 'headRefOid' <<<"$final_section"; then
  echo "REGRESSION: /spec execute does not confirm the PR head is the commit it is promoting" >&2
  exit 1
fi
if ! grep -qF 'gate re-opens on every push after the undraft' <<<"$final_section"; then
  echo "REGRESSION: /spec execute no longer re-opens the promotable gate on a post-undraft push" >&2
  exit 1
fi
if ! grep -qF 'gh pr ready --undo' <<<"$final_section"; then
  echo "REGRESSION: /spec execute names no way back to draft when a pushed head stops being promotable" >&2
  exit 1
fi

execute_line=$(grep -E '^\| `execute` \|' "$SPEC" || true)
if [[ -z "$execute_line" ]]; then
  echo "REGRESSION: /spec dispatcher missing execute row" >&2
  exit 1
fi
if grep -qE '→ draft PR[[:space:]]*\|' <<<"$execute_line"; then
  echo "REGRESSION: /spec execute row still ends at draft PR:" >&2
  echo "$execute_line" >&2
  exit 1
fi
if ! grep -qE 'ready PR|ready-for-review' <<<"$execute_line"; then
  echo "REGRESSION: /spec execute row must name the ready PR terminal state" >&2
  echo "$execute_line" >&2
  exit 1
fi

echo "PASS: /spec execute treats the draft PR as a checkpoint, refuses the undraft unless the PR body answers the five evidence questions, names no retired task-folder evidence file, gates ready-for-review on the promotable classification, and re-opens that gate when the head moves past it" >&2
exit 0
