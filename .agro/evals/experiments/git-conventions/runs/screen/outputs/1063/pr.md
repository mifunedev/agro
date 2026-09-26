FROM skill/1062-supervisor-description-limit TO development

Closes #1062

## What the issue asked for

Keep the `/supervisor` trigger description within the provider metadata limit, so the skill loads without a conflict.

## What was built

- The `/supervisor` description is 927 characters of prose. It was 1,005 characters before this change. The new text keeps every TRIGGER and Do NOT trigger clause.
- Duty 1 starts each advisor in a new `agent-*` Herdr tab at the harness root with bypass permissions. It reads `bypass permissions on` from the status line before the brief, then renames the agent.
- Duty 2 checks the pane for `Message @` before every send, so a brief never reaches the advisor's worker.
- The skill records failure modes 6–8: manual permission mode, `herdr agent start` splitting the supervisor's tab, and a send that reached a worker.
- `SI-0010` records the change in `.agro/evals/decisions/skill-impact.md`. `CHANGELOG.md` gets a `### Fixed` entry.

## Where it diverged

The change is wider than the metadata fix. It also includes the Duty 1 and Duty 2 procedure changes and failure modes 6–8, which came from later supervised runs.

## What remains unverified

- No provider load test was run against the changed skill. The limit is checked by character count only.
- `.agro/evals/RESULTS.md` has the same pre-existing non-PASS rows as the base commit. It shows `ERROR` for `curl-bash-safe-alternatives` and `REGRESSION` for `next-dev-prod`, `oh-config-surfaces`, and `skills-vendored`. This change did not cause them.
- The branch is cut from `c49f4c89`. Local `development` is 60 commits ahead. Merge `development` into the branch before review. Expect conflicts in `CHANGELOG.md` and `.agro/evals/RESULTS.md`.
- CI has not run. The branch is not pushed.

## Verification

```text
$ awk '/^description:/{f=1;next} /^allowed-tools:/{f=0} f' .agro/skills/supervisor/SKILL.md | sed 's/^  //' | tr '\n' ' ' | wc -c
927            # base commit: 1005

$ bash .agro/evals/probes/changelog-entry-length.sh
PASS: all [Unreleased] changelog entries are at most 250 characters

$ diff <(git show HEAD~1:.agro/evals/RESULTS.md | awk -F'|' '/^\| [a-z]/{print $2,$5}') \
       <(awk -F'|' '/^\| [a-z]/{print $2,$5}' .agro/evals/RESULTS.md) && echo "no status change"
no status change
```

## Lessons

None.

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [ ] Every acceptance criterion in the linked issue is met
- [ ] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
