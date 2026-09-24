---
name: Task
about: A chore, refactor, or maintenance change with no new behavior and no bug
title: "task: "
labels: task
assignees: ""
---

## Metadata

> **IMPORTANT**: The very first step should _ALWAYS_ be validating this metadata section to maintain a **CLEAN** development workflow.

```yml
pull_request_title: "FROM task/[issue#]-[shortdesc] TO [target-branch]"
branch: "task/[issue#]-[shortdesc]"
```

---

## Description

<!-- What needs to be done and why? Link related issues or context. -->

---

## Done When

<!-- Every criterion must be binary — testable by an agent with a pass/fail outcome. -->

- [ ] <!-- Criterion 1 -->
- [ ] The repository's lint, typecheck, test, and build commands pass
- [ ] Draft PR opened: `FROM task/[issue#]-[shortdesc] TO [target-branch]`
