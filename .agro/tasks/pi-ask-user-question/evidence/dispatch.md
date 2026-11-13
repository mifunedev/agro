# Dispatch records

## US-001

- Story ID: US-001.
- Dependencies: none.
- Read scope: PRD, `.pi/settings.json`, Pi package and extension documentation, published package source.
- Owned write paths: `evidence/probe.md` and `evidence/probe.mjs` under this task directory.
- Deliverable: one commit on `feat/1616-pi-ask-user-question`.
- Verification: run the probe inside the sandbox; require registration, answer, cancellation, no-UI checks, and cleanup to pass.
- Execution directory: `/home/exedev/.agro/workspaces/harness/.worktrees/feat/1616-pi-ask-user-question`.
- Execution location: host orchestration; execute runtime commands through `agro run --` in the sandbox.
- Model and reason: provider default; the bounded probe needs package-loading and runtime judgment.

## US-002

- Story ID: US-002.
- Dependencies: US-001.
- Read scope: PRD, accepted probe, `.pi/settings.json`, settings regression, Pi guide, changelog.
- Owned write paths: `.pi/settings.json`, `.pi/extensions/__tests__/settings.test.ts`, `docs/harnesses/pi.md`, `CHANGELOG.md`.
- Deliverable: one commit on `feat/1616-pi-ask-user-question`.
- Verification: require a red test before configuration, a green settings regression after configuration, and a passing provider-link check.
- Execution directory: `/home/exedev/.agro/workspaces/harness/.worktrees/feat/1616-pi-ask-user-question`.
- Execution location: host orchestration; execute runtime commands through `agro run --` in the sandbox.
- Model and reason: provider default; the small integration needs consistency across configuration, tests, and documentation.

## US-003

- Story ID: US-003.
- Dependencies: US-002.
- Read scope: accepted probe, configured package pin, Pi guide, manual-review standard.
- Owned write paths: `evidence/manual-review.md` and `evidence/manual-review.sh` under this task directory.
- Deliverable: one commit on `feat/1616-pi-ask-user-question`.
- Verification: require fresh user-entry-point install and list commands, runtime checks, a failure path, recorded exit statuses, and resource cleanup.
- Execution directory: `/home/exedev/.agro/workspaces/harness/.worktrees/feat/1616-pi-ask-user-question`.
- Execution location: host orchestration; execute runtime commands through `agro run --` in the sandbox.
- Model and reason: provider default; the evidence must reflect observed behavior rather than predicted output.

## Isolation

The task uses a worktree because the main checkout contains operator-local `agro.json` changes.
The stories run sequentially in the task checkout. No worker shares mutable state with another worker.
The advisor owns the tracker and acceptance. Workers do not push or spawn workers.
