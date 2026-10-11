# PRD: Piped secret without a trailing newline

Status: DRAFT

## User Stories

### US-001: Write a piped value that has no trailing newline

**Description:** As the operator, I want `agro secret set <KEY>` to write a piped value without a trailing newline so that a script never hides an unwritten secret.

**Acceptance Criteria:**

- [ ] A test in `.agro/cli/src/lib/__tests__/` pipes `value` with no trailing newline into `askSecretPiped` through `askSecret` and asserts that the result is `value`.
- [ ] A test asserts that empty piped input resolves to an empty string, so that `runSecretSet` exits 1 with `no value entered`.
- [ ] The new tests fail before the change in `.agro/cli/src/lib/prompt.ts`.
- [ ] `npx vitest run .agro/cli/src/lib/__tests__/` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `CHANGELOG.md` has one `### Fixed` entry under `## [Unreleased]` that links #1409.

### US-002: Record manual review evidence

**Description:** As the advisor, I want a command transcript so that the PR shows the changed behavior.

**Acceptance Criteria:**

- [ ] `.agro/tasks/piped-secret-newline/evidence/manual-review.md` holds the output and exit code of `printf '%s' dummy-not-a-secret | node .agro/cli/dist/agro.js secret set GH_TOKEN --sandbox review-box` in a temporary `AGRO_HOME`, and of `agro secret list --sandbox review-box` after the write.
- [ ] The file holds the output and exit code of `printf '' | node .agro/cli/dist/agro.js secret set GH_TOKEN --sandbox review-box`, and that exit code is 1.
- [ ] The transcript holds no secret value.
- [ ] The story deletes each temporary directory that it creates.

## Summary

In the manual review of #1408, `printf '%s' dummy-not-a-secret | agro secret set GH_TOKEN --sandbox review-box` printed only the prompt, wrote nothing, and exited 0. `askSecretPiped` in `.agro/cli/src/lib/prompt.ts` resolves only through the `rl.question` callback. Nobody confirmed the cause. The worker confirms the cause with a red test before the fix.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/prompt.ts` | `askSecret`, `askSecretPiped` | Piped secret input |
| `.agro/cli/src/commands/secret.ts` | `runSecretSet` | Exits 1 on an empty value |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret set <KEY>` with piped input | Behavior | Writes a value without a trailing newline |

## Storage

N/A. The change adds no storage.

## Architectural Decisions

- `askSecretPiped` resolves when the input closes. The resolved value is the text read before the close.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/prompt-piped.test.ts` | value without newline; empty input | US-001 |

## Design Principles

- Make the silent failure loud.
- Add no comments to tracked code.

## Out of Scope

- The TTY input path.

## Open Questions

None.

## Acceptance Criteria

- [ ] `npm test` exits 0.
- [ ] `npm run typecheck` exits 0.

## Lessons

1. Claim: `rl.question` settles only on a line that ends in a newline, so a piped value without a newline left the promise pending and Node exited 0. Evidence: the new tests in `prompt-piped.test.ts` timed out before the fix. Outcome: fixed in this PR.
