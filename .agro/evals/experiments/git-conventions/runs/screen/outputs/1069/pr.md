FROM bug/1068-supervisor-pi-description-limit TO development

Closes #1068

## What the issue asked for

Pi rejects skill metadata whose `description` exceeds 1024 characters, so it could not load `/supervisor`. Shorten the description to fit that limit and keep the supervision triggers, the exclusions, and the role boundary.

## What was built

- The `/supervisor` frontmatter `description` is one 721-character paragraph. It keeps the supervise, babysit, watch, and drive triggers, the second-pane and Definition of Done ownership, the MonitorCreate/MonitorList/MonitorStop rules, the Herdr boundary, the no-code rule, and the `/delegate` and `/herdr` exclusions.
- The supervisor lessons add lesson 10, "A green status field is a claim, not evidence."
- `.agro/evals/decisions/skill-impact.md` records the change as SI-0014.
- `CHANGELOG.md` has a `### Fixed` entry under `[Unreleased]`.

## Where it diverged

Lesson 10 is not required by the issue. It is part of the same working-tree change and ships with it.

## What remains unverified

- Pi loading the skill end to end was not run here.
- CI was not run. The branch is not pushed.

## Verification

```
$ awk '/^description: \|/{f=1;next} f&&/^[a-z-]+:/{f=0} f{sub(/^  /,"");printf "%s",$0}' .agro/skills/supervisor/SKILL.md | wc -c
721
$ bash .agro/evals/probes/changelog-entry-length.sh
PASS: all [Unreleased] changelog entries are at most 250 characters
```

## Lessons

None.

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [x] Every acceptance criterion in the linked issue is met
- [ ] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
