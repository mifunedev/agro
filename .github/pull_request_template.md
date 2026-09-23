<!--
Title format (literal): FROM <source-branch> TO <target-branch>
Example:                FROM feat/42-short-desc TO <target-branch>
-->

Closes #<issue-number>

<!--
Put a closing keyword — Closes, Fixes or Resolves — in this body or in the title,
one per issue. A bare `#42` links the issue but does not close it.
-->

## Summary

<!-- What changed, and why. Rationale and rejected alternatives belong here. -->

## Changes

<!-- Files, modules, or surfaces touched, and the role each change plays. -->

| File / Surface | Change | Why |
| -------------- | ------ | --- |
|                |        |     |

## Test Plan (TDD)

<!-- Tests written before implementation, and what each proves. -->

| Test File | Case(s) | Validates |
| --------- | ------- | --------- |
|           |         |           |

## Verification

<!-- The commands you ran and what they proved. Paste relevant output. -->

## Visual Reference

<!-- Screenshots or recordings for user-facing changes. Delete if N/A. -->

## Out of Scope / Follow-ups

<!-- Anything intentionally left out, with linked issues where they exist. -->

## Checklist

- [ ] Title is `FROM <source-branch> TO <target-branch>`
- [ ] Base branch is the repository's integration branch
- [ ] Closing keyword links every issue this PR completes
- [ ] Every acceptance criterion in the linked issue is met
- [ ] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass
- [ ] No new dependencies, or each one is justified above
- [ ] Changelog and user-facing documentation updated, or this is a pure chore
