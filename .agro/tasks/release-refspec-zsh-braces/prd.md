# PRD: Release refspec zsh braces

Status: DRAFT

## User Stories

### US-001: Brace the release push refspec and guard skill code blocks

**Description:** As the advisor, I want the `/release` push command to work in zsh. Then a release push from the sandbox does not fail on a mangled refspec.

**Acceptance Criteria:**

- [ ] `.agro/skills/release/SKILL.md` § 3 gives `git push "${REMOTE}" "${SHA}:refs/heads/${TARGET}"`.
- [ ] A new test file `.agro/scripts/__tests__/skill-shell-portability.test.ts` scans each fenced `bash` or `sh` block in `.agro/skills/**/*.md` and `docs/**/*.md`. The test fails on an unbraced variable that a colon and a letter follow, for example `$SHA:r`.
- [ ] The test reports the file, the line, and the variable for each finding.
- [ ] The test fails on the current `development` branch with the finding `.agro/skills/release/SKILL.md` line 162 `$SHA`, and the test passes after the change.
- [ ] `pnpm vitest run .agro/scripts/__tests__/skill-shell-portability.test.ts` exits 0.
- [ ] `CHANGELOG.md` `## [Unreleased]` holds one `### Fixed` entry that links issue #1331.
- [ ] Typecheck passes.

## Summary

Issue #1331 reports that the `/release` push command breaks under zsh. `.agro/skills/release/SKILL.md:162` gives `git push "$REMOTE" "$SHA:refs/heads/$TARGET"`. In zsh, `$SHA:r` applies the `:r` modifier. The refspec becomes `<sha>efs/heads/main`. The `v0.17.0` push failed with `error: src refspec eec6b976695fdb1e1117f622323df70f8570f3c3efs/heads/main does not match any`.

Verified current state:

- The advisor shell in the sandbox is zsh. Bash runs the tracked scripts, and bash applies no modifier there.
- `git grep` for an unbraced `$NAME:` followed by a letter in `.agro/skills/**/*.md`, `docs/**/*.md`, and the `AGENTS.md` files finds one match: `.agro/skills/release/SKILL.md:162`.
- No test checks shell portability of skill code blocks.

Selected approach: brace the three variables on line 162 and add one static test, so that a later skill edit cannot add the same defect.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/release/SKILL.md` | § 3 "Trigger the release" | Holds the failing command. |
| `.agro/scripts/__tests__/skill-shell-portability.test.ts` | new | Guards fenced shell blocks. |
| `CHANGELOG.md` | `## [Unreleased]` | Release note. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/release` skill text | Fix | The push command works in bash and zsh. |
| test suite | New test | Fails on an unbraced variable before a colon and a letter in a skill or doc code block. |

## Storage

N/A. The change adds no persistent state.

## Architectural Decisions

- The guard scans only fenced `bash` and `sh` blocks in Markdown. Agents copy those blocks into an interactive shell. Tracked scripts run under bash and stay out of scope.
- The guard flags `$NAME:` followed by a letter, because only a letter starts a zsh modifier such as `:r`, `:h`, or `:t`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/skill-shell-portability.test.ts` | every skill and doc shell block has no unbraced `$NAME:<letter>` | US-001 |
| same file | a fixture string with `"$SHA:refs"` gives one finding; `"${SHA}:refs"` gives none | detector correctness |

## Design Principles

- Fix the one defect and guard the class. Add no shell linter dependency.
- Do not add explanatory comments to tracked code.

## Out of Scope

- Shell portability of tracked scripts. Bash runs them.
- Other zsh differences, such as word splitting or glob options.
- A manual review run. The change is skill text and a static test, so the test is the proof. A `/release` run would publish a release.

## Open Questions

None.

## Acceptance Criteria

- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `git grep -nE '"\$[A-Za-z_]+:[a-zA-Z]' -- .agro/skills docs` prints no line.

## Lessons

1. Claim: the new test also flags `$NAME:<letter>` inside single quotes, where the shell does not expand the variable. Evidence: the detector does not parse quotes. Outcome: dropped, because no skill or doc block triggers the case and a braced form is correct in both quote styles.
