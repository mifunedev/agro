---
name: Feature Request
about: Propose a new feature with enough detail for autonomous agent implementation
title: "feat: "
labels: enhancement
assignees: ""
---

## Metadata

> **IMPORTANT**: The very first step should _ALWAYS_ be validating this metadata section to maintain a **CLEAN** development workflow.

```yml
pull_request_title: "FROM feat/[issue#]-[shortdesc] TO [target-branch]"
branch: "feat/[issue#]-[shortdesc]"
worktree_path: ".worktrees/feat/[issue#]-[shortdesc]"
```

---

## User Stories

<!-- Define the feature from the user's perspective FIRST. Every story follows the format:
     "As a [role], I want [capability] so that [benefit]."
     These stories drive all downstream decisions — integration points, interfaces, and acceptance criteria. -->

- As a **[role]**, I want **[capability]** so that **[benefit]**.
- As a **[role]**, I want **[capability]** so that **[benefit]**.

---

## Summary

<!-- Brief context beyond the user stories. Include visual references if applicable. -->

### Visual Reference

<!-- Screenshots, mockups, ASCII sketches, or links to reference implementations. -->

---

## Key Integration Points

<!-- Files, modules, or functions that need changes. Describe the ROLE each plays. -->

| File                 | Function(s) / Symbol(s) | Role                                  |
| -------------------- | ----------------------- | ------------------------------------- |
| _e.g., `path/to/module`_ | _e.g., `function_name()`_ | _e.g., New entry point for feature_ |

---

## Interface Integration Points

<!-- Which user-facing surfaces change? UI components, routes, CLI commands, API endpoints, config, or docs. Mark N/A if none. -->

| Surface                      | Change Type | Description                        |
| ---------------------------- | ----------- | ---------------------------------- |
| _e.g., `path/to/component`_  | Modify      | _e.g., Add entry point to feature_ |
| _e.g., `command --flag`_     | New         | _e.g., Expose feature from the CLI_ |

---

## Storage

<!-- Where and how is data persisted? Specify the existing pattern to follow. Mark N/A if the feature is stateless. -->

- **Persistence layer**: <!-- e.g., database, file, cache, or none -->
- **Location / schema**: <!-- e.g., table, collection, file path -->
- **Pattern**: <!-- e.g., existing module or helper to follow -->

---

## Architectural Decisions

<!-- Explicit decisions that prevent misinterpretation. State the source of truth, state management approach, etc. -->

- **Source of truth**: <!-- e.g., the database — NOT client-side storage -->
- **State management**: <!-- e.g., existing store, local state, or none -->
- **Auth / scoping**: <!-- e.g., existing auth guard, per-user scoping, or N/A -->

---

## Test Plan (TDD)

> **TDD is the best approach.** Write failing tests _before_ implementation. Tests define the contract; code makes them pass. This order catches misunderstandings early and keeps scope tight.

<!-- List the test files and cases that will be written BEFORE implementation code.
     Follow the repository's existing test framework and file layout. -->

| Test File                         | Case(s)                                   | Validates                  |
| --------------------------------- | ----------------------------------------- | -------------------------- |
| _e.g., `path/to/feature.test`_    | _e.g., `creates record with valid input`_ | _e.g., Core feature logic_ |
| _e.g., `path/to/endpoint.test`_   | _e.g., `rejects unauthorized request`_    | _e.g., Access guard_       |

---

## Design Principles

- Simplicity is beauty, complexity is pain.
- _ALWAYS_ look at the current codebase first — achieve the goal in the **least amount of changes**.
- **TDD-first**: write tests _before_ implementation — this is the **best** approach. Red → Green → Refactor.
- Follow existing repository patterns, conventions, and tooling.
- <!-- Add any feature-specific principles here -->

---

## Out of Scope

<!-- Anything explicitly NOT part of this feature to keep the agent focused. -->

---

## Acceptance Criteria

<!-- Every criterion must be binary — testable by an agent with a pass/fail outcome. Avoid subjective language. -->

- [ ] Implementation plan is thoroughly documented
- [ ] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass (new tests required for all new logic)
- [ ] New code follows existing repository patterns
- [ ] No new dependencies added beyond what's already in the project (or justified in PR description)
- [ ] User-facing documentation updated if behavior changes
- [ ] Draft PR opened: `FROM feat/[issue#]-[shortdesc] TO [target-branch]`
- [ ] <!-- Add feature-specific criteria -->
