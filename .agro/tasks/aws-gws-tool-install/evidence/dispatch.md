# Dispatch records

## US-001

| Field | Value |
|---|---|
| Story ID | US-001 |
| Dependencies | None |
| Read scope | Root context, PRD, CLI README, tool catalog, tool commands, tests, and official AWS/GWS release sources |
| Owned write paths | `.agro/cli/src/lib/tools/catalog.ts`; `.agro/cli/src/__tests__/tool-catalog.test.ts`; `.agro/cli/src/__tests__/tool.test.ts`; `.agro/tasks/aws-gws-tool-install/evidence/artifact-integrity.md` |
| Deliverable | One commit on `task/1610-tool-code`; never push |
| Verification | PRD US-001 criteria; targeted Vitest suite and typecheck pass; record red test and authenticated artifact evidence. Advisor accepts in the main checkout. |
| Execution directory | `/home/sandbox/harness/.worktrees/task/1610-tool-code` |
| Execution location | sandbox |
| Model and reason | Session-default GPT model; bounded implementation needs shell, TypeScript, and artifact-integrity reasoning. |

## US-002

| Field | Value |
|---|---|
| Story ID | US-002 |
| Dependencies | None |
| Read scope | Root context, PRD, STE skill, documentation READMEs, existing tool inventories |
| Owned write paths | `docs/installation.md`; `.agro/cli/README.md`; `README.md`; `CHANGELOG.md` |
| Deliverable | One commit on `task/1610-tool-docs`; never push |
| Verification | PRD US-002 criteria; STE has no finding on a changed line; issue-linked Unreleased entry. Advisor accepts in the main checkout. |
| Execution directory | `/home/sandbox/harness/.worktrees/task/1610-tool-docs` |
| Execution location | sandbox |
| Model and reason | Session-default GPT model; bounded technical documentation with verified installation boundaries. |

## US-003

| Field | Value |
|---|---|
| Story ID | US-003 |
| Dependencies | US-001, US-002 |
| Read scope | Accepted PRD, implementation, upstream artifact evidence, and CLI execution/host configuration |
| Owned write paths | `.agro/tasks/aws-gws-tool-install/evidence/manual-review.md` |
| Deliverable | One commit on the task branch; never push |
| Verification | PRD US-003 criteria; real isolated amd64 installs and removal; labeled failure fixture; advisor reruns verification. |
| Execution directory | `/home/sandbox/harness` |
| Execution location | sandbox |
| Model and reason | Session-default GPT model; independent evidence collection through the built CLI. |

The task uses the main checkout. US-001 and US-002 use isolated worktrees because their wave has disjoint write paths.
US-003 runs alone in the main task checkout after acceptance of the first wave.
Dependencies were installed with `pnpm install --frozen-lockfile` in both worker worktrees before dispatch.
Baseline: 3176 tests passed, 2 skipped; typecheck passed.
