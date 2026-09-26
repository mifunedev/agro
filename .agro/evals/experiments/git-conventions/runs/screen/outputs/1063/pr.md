FROM bug/1062-supervisor-description-limit TO development

Closes #1062

## Stories

- [x] Keep the `/supervisor` trigger description within the provider metadata limit.

## What the issue asked for

Keep the `/supervisor` skill's `description` frontmatter within the provider metadata limit, so the skill loads without a conflict.

## What was built

- The `/supervisor` description is 933 characters. It stays below the 1,024-character limit.
- The changed prose follows Simplified Technical English.
- Duty 1 starts each advisor in a new Herdr tab in the supervisor's workspace, at the harness root, in bypass permissions mode. The tab name uses an `agent-*` prefix for agent tabs and a `dev-*` prefix for development environment tabs. The supervisor confirms the resolved working directory and the `bypass permissions on` status line before the brief.
- A new check makes the supervisor confirm that the advisor prompt does not target a worker (`Message @`) before every send.
- Failure modes 6–8 record the manual-mode stall, the split-pane launch, and the misrouted send.
- `.agro/evals/decisions/skill-impact.md` records the change as SI-0010 and SI-0011.
- `CHANGELOG.md` has an entry under `[Unreleased]` → `Fixed`.

## Where it diverged

The change is larger than the metadata fix. It also changes the advisor launch procedure (new tab, bypass permissions, tab names) and adds the send-target check. These changes come from later supervised runs and are in the same skill file.

## What remains unverified

- No agent loaded the skill in Claude Code, Codex, or Pi to confirm that the metadata conflict is gone.
- No agent ran the Herdr commands in Duty 1 or the `Message @` check against a live Herdr session.
- CI did not run. The branch is not pushed.

## Verification

```text
$ awk '/^description:/{f=1;next} /^allowed-tools/{f=0} f' .agro/skills/supervisor/SKILL.md | wc -c
933
$ bash .agro/evals/probes/changelog-entry-length.sh
PASS: all [Unreleased] changelog entries are at most 250 characters
```

`.agro/evals/RESULTS.md` holds the refreshed probe run at 2026-09-13 20:43. The status of each probe did not change from the previous run. `curl-bash-safe-alternatives` (ERROR), `next-dev-prod`, `oh-config-surfaces`, and `skills-vendored` (REGRESSION) were already red on the base commit.

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
