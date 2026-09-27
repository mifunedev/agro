<!--
Title format (literal): FROM <source-branch> TO <target-branch>
Example:                FROM feat/42-short-desc TO <target-branch>
-->

Closes #<issue-number>

<!--
Put a closing keyword — Closes, Fixes or Resolves — in this body or in the title,
one per issue. A bare `#42` links the issue but does not close it.
-->

## Stories

<!-- One line per story from the plan's tracker. Tick a story when the advisor accepts it. -->

- [ ] US-001: <story title>

## What the issue asked for

<!-- The goals in the requester's terms, in 2–4 lines. -->

## What was built

<!-- The observable behavior that is now true, one line per story. -->

## Where it diverged

<!-- Every deliberate deviation from the plan and why, or "None". -->

## Manual review

<!-- The steps a reviewer runs to confirm what shipped. Use the shape in
     .agro/skills/git/references/manual-review.md: the user-journey shape
     for a user interface change, or the server, CLI, or API shape. -->

## What remains unverified

<!-- Skipped checks, and criteria that were reasoned but not executed, or "Nothing". -->

## Verification

<!-- The commands you ran and their real output, trimmed. -->

## Lessons

<!-- A summary of the plan's Lessons section. Give each lesson its outcome:
     fixed in this PR, issue #N, or dropped with the reason. Write "None" if there are none. -->

## Checklist

- [ ] Title is `FROM <source-branch> TO <target-branch>`
- [ ] Base branch is the repository's integration branch
- [ ] Closing keyword links every issue this PR completes
- [ ] Every acceptance criterion in the linked issue is met
- [ ] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass
- [ ] No new dependencies, or each one is justified above
- [ ] Changelog and user-facing documentation updated, or this is a pure chore
