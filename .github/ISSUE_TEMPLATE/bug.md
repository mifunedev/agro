---
name: Bug Report
about: Report broken behavior with enough detail for autonomous agent reproduction and repair
title: "bug: "
labels: bug
assignees: ""
---

## Metadata

> **IMPORTANT**: The very first step should _ALWAYS_ be validating this metadata section to maintain a **CLEAN** development workflow.

```yml
pull_request_title: "FROM bug/[issue#]-[shortdesc] TO [target-branch]"
branch: "bug/[issue#]-[shortdesc]"
```

---

## Impact

<!-- State who is affected and what they cannot do. Use the story format so the fix is judged by the user outcome, not by the symptom.
     "As a [role], I expect [behavior] but [failure], so [consequence]." -->

- As a **[role]**, I expect **[behavior]** but **[failure]**, so **[consequence]**.

---

## Reproduction

<!-- Give the smallest deterministic reproduction. An agent must be able to run these steps and see the failure. -->

1. <!-- Step 1 -->
2. <!-- Step 2 -->
3. <!-- Step 3 -->

### Expected Behavior

<!-- What should happen? -->

### Actual Behavior

<!-- What happens instead? Paste the exact error text or output, trimmed. -->

```text

```

### Environment

- **Checkout / branch**: <!-- git branch --show-current; git rev-parse --short HEAD -->
- **Sandbox / container**: <!-- agro ps / container name -->
- **Agent runtime**: <!-- claude, pi, codex, cron, or other relevant harness runtime -->
- **Command or workflow**: <!-- agro verb, script, skill, cron, or GitHub workflow that failed -->
- **Host context**: <!-- OS, Docker version; browser only if UI behavior is involved -->

---

## Suspected Cause

<!-- Files, modules, or functions that are likely involved. Describe the ROLE each plays in the failure. Mark "Unknown" if not yet investigated. -->

| File                     | Function(s) / Symbol(s)   | Role in the failure                     |
| ------------------------ | ------------------------- | --------------------------------------- |
| _e.g., `path/to/module`_ | _e.g., `function_name()`_ | _e.g., Accepts input it should reject_  |

---

## Test Plan (TDD)

> **Reproduce first.** Write a test or probe that fails on the current code _before_ the fix. The fix is done when that test passes and nothing else turns red.

| Test File                       | Case(s)                                     | Validates                    |
| ------------------------------- | ------------------------------------------- | ---------------------------- |
| _e.g., `path/to/module.test`_   | _e.g., `rejects input that caused #[issue]`_ | _e.g., The reported failure_ |

---

## Design Principles

- Simplicity is beauty, complexity is pain.
- Fix the root cause, not the symptom. State the cause in the PR.
- _ALWAYS_ look at the current codebase first — fix the bug in the **least amount of changes**.
- **TDD-first**: a failing reproduction test comes before the fix. Red → Green → Refactor.
- Follow existing repository patterns, conventions, and tooling.

---

## Out of Scope

<!-- Related problems or refactors that this fix must NOT include. File them separately. -->

---

## Acceptance Criteria

<!-- Every criterion must be binary — testable by an agent with a pass/fail outcome. Avoid subjective language. -->

- [ ] Root cause is identified and stated in the PR description
- [ ] A reproduction test or eval probe fails **before** the fix and passes after
- [ ] The reproduction steps above no longer produce the failure
- [ ] The repository's lint, typecheck, test, and build commands pass
- [ ] No new dependencies added (or justified in PR description)
- [ ] Changelog entry under `### Fixed` if the bug was user-visible
- [ ] Draft PR opened: `FROM bug/[issue#]-[shortdesc] TO [target-branch]`
- [ ] <!-- Add bug-specific criteria -->
