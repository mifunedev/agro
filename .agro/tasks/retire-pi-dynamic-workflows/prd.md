---
title: "Retire Pi dynamic workflows"
issue: 1054
prefix: task
repo: mifunedev/agro
remote: origin
base: development
---

# PRD: Retire Pi dynamic workflows

## 1. Introduction/Overview

Open Harness pins `pi-dynamic-workflows` as a default project-local Pi package in
`.pi/settings.json`. The package registers a `workflow` tool that runs a JavaScript
DSL in a VM sandbox and fans work out to in-memory subagents. The harness already
owns one bounded delegation procedure in `.agro/skills/delegate/SKILL.md`, which
uses the provider-native `Agent` tools. Two execution surfaces for the same job
cost maintenance and split the vocabulary.

This task retires the package from the harness defaults and from current
documentation. Retirement means removal from defaults. It does not ban an
operator-managed global installation or an explicit `pi -e ...` argument.

## 2. Goals

- The default package list excludes the dynamic workflow pin and preserves every
  other package entry and every other setting in `.pi/settings.json`.
- The configuration regression test asserts the new exact list and adds a negative
  package-identity assertion that covers alternate package sources, not only the
  retired commit string.
- Current documentation stops advertising the retired tool. One short migration
  note names `/delegate`, the session reload boundary, and the global-override
  boundary.
- A fresh trusted Pi session does not register `workflow`, while Pi subagents,
  tasks, goal, Monitor/Loop, file search, and the safety guard stay registered.
- Pi regressions pass, and no global settings, cache, session history, gateway,
  application-owned file, or provider mirror is modified.
- Distribution and public-documentation effects carry an evidence-backed
  disposition.

## 3. Non-goals

- No modification of Pi upstream and no new workflow engine.
- No purge of global Pi packages, caches, session histories, or user scripts.
- No conversion or migration of existing workflow scripts.
- No removal of unrelated orchestration tools or of GitHub Actions workflows.
- No edit to `.pi/APPEND_SYSTEM.md`, which carries no workflow-specific instruction.
- No deletion of the historical `CHANGELOG.md` entry that records the original addition.
- No reload or restart of any running gateway, Herdr session, or other agent session.
- Merge and release stay outside this task.

## 4. User Stories

### US-001: Remove the default package pin and pin the negative contract

**Description:** As an operator, I want the dynamic workflow package absent from the
harness default Pi package list so that a fresh project does not register a second
workflow runtime.

**Acceptance Criteria:**

- [ ] `.pi/settings.json` `packages` contains the nine retained entries in their
      existing order and omits the dynamic workflow entry.
- [ ] Every other key in `.pi/settings.json` is byte-identical to the previous revision.
- [ ] `.pi/extensions/__tests__/settings.test.ts` asserts the new exact nine-entry list.
- [ ] The same test adds a negative assertion keyed on package identity, so any
      `pi-dynamic-workflows` entry fails regardless of source prefix, owner, or pin.
- [ ] `pnpm exec vitest run .pi/extensions/__tests__/settings.test.ts` exits 0.
- [ ] The exact configuration diff is captured in `evidence/settings.txt` and `evidence/diff.txt`.

### US-002: Stop advertising the retired tool in current documentation

**Description:** As a reader of the harness documentation, I want no current page to
present the dynamic workflow tool as available so that the docs match the shipped defaults.

**Acceptance Criteria:**

- [ ] `docs/integrations/pi-dynamic-workflows.md` is deleted.
- [ ] `docs/README.md` no longer links the deleted page.
- [ ] `docs/harnesses/pi.md` drops the default-package bullet, the `-e` load example,
      and the dedicated dynamic workflows section.
- [ ] `docs/harnesses/pi.md` gains one concise migration note that names `/delegate`,
      states that a running session keeps the tool until reload or restart, and states
      that a global installation or an explicit `-e` argument can still register it.
- [ ] `docs/installation.md:188` and `docs/integrations/pi-fff.md:16` no longer present
      the package as a current default.
- [ ] `CHANGELOG.md:681` is unchanged, and a new `## [Unreleased]` → `### Removed`
      entry of one imperative sentence at most 250 characters links issue #1054.
- [ ] A tracked search for `pi-dynamic-workflows`, `Michaelliv`, and the retired pin
      classifies every remaining match as history, retirement guidance, or a negative test.
- [ ] Every local Markdown link that pointed at the deleted page resolves or is removed.
- [ ] Evidence lands in `evidence/references.txt` and `evidence/docs-review.md`.

### US-003: Prove the runtime tool inventory changed as intended

**Description:** As an operator, I want observed evidence that a fresh Pi session loses
`workflow` and keeps every retained tool so that retirement is verified rather than assumed.

**Acceptance Criteria:**

- [ ] The Pi version and the test checkout revision are recorded.
- [ ] A disposable Pi agent directory without global packages captures a baseline tool
      registry from the original package list into `evidence/runtime-before.json`.
- [ ] The same controlled settings capture the changed-configuration registry into
      `evidence/runtime-after.json`, using a temporary inspection extension outside tracked source.
- [ ] `workflow` is absent after the change, and the Agent/subagent, task, goal,
      Monitor/Loop, file-search, and safety-guard tools remain present.
- [ ] Startup errors and the effective prompt are inspected; no package-load error and
      no dynamic-workflow prompt guidance remain.
- [ ] Resource reload in that disposable session yields the same tool inventory.
- [ ] `evidence/runtime.txt` records the commands, real exit codes, and the boundary
      note that operator sessions need reload or restart.
- [ ] If a prerequisite is unavailable, the gate is recorded BLOCKED with the failure,
      never reported as passing.

### US-004: Keep Pi regressions green and ownership boundaries intact

**Description:** As the build owner, I want the full Pi test surface green and the change
confined to owned paths so that retirement does not disturb unrelated state.

**Acceptance Criteria:**

- [ ] `pnpm exec vitest run .pi` exits 0, captured in `evidence/pi-tests.txt`.
- [ ] The branch diff touches only `.pi/settings.json`, `.pi/extensions/__tests__/settings.test.ts`,
      the named documentation files, `CHANGELOG.md`, and `.agro/tasks/retire-pi-dynamic-workflows/`.
- [ ] No global settings file, package cache, session history, gateway state,
      application-owned project file, or provider mirror is modified.
- [ ] No gateway, Herdr session, cron service, or other agent session is reloaded or restarted.
- [ ] `evidence/boundary-review.md` records the independent boundary review.

### US-005: Record an evidence-backed distribution and public-documentation disposition

**Description:** As the operator, I want to know exactly where the retired default still
reaches users so that the retirement claim is bounded by observed source rather than assumption.

**Acceptance Criteria:**

- [ ] The path by which `.pi/settings.json` reaches initialized and updated projects is
      traced through current `.agro/cli` and `.agro/scripts` source and cited by `path:line`.
- [ ] `evidence/distribution-review.md` states whether an initialized or updated project
      inherits the harness package list, with source citations rather than assumption.
- [ ] `mifunedev/agro-web` is inspected for current dynamic-workflow advertising, and
      `evidence/public-docs-review.md` lists the exact affected paths or records a
      source-backed no-change finding.
- [ ] The advisor records a disposition for each surviving surface: fixed in this PR,
      an accepted owned companion change, or an escalation the operator must decide.
- [ ] D5 stays incomplete until the advisor accepts that disposition.

### US-006: Complete a review-ready pull request

**Description:** As a reviewer, I want a non-draft PR whose head carries green required CI
and a passing PR audit so that the change is ready to judge.

**Acceptance Criteria:**

- [ ] The accepted patch is committed on `task/1054-retire-pi-dynamic-workflows` and pushed to `origin`.
- [ ] A non-draft PR targets `development` in `mifunedev/agro` with the literal title
      `FROM task/1054-retire-pi-dynamic-workflows TO development` and a `Closes #1054` trailer.
- [ ] The PR body carries the D1–D5 evidence summary, the divergence section, and the
      unverified section.
- [ ] `/ci-status` runs after every push, and required CI is green at the final head SHA.
- [ ] `/audit pr` on the final revision returns a promotable verdict with no unresolved
      blocking findings and no merge conflict.
- [ ] `evidence/pr-completion.md` records the PR URL, the final head SHA, the CI run URLs,
      and the audit verdict.
- [ ] The PR is not merged and no release is published.

## 5. Success Criteria

The Definition of Done table in the approved plan, D1 through D6, maps one-to-one onto
US-001 through US-006. A gate with no observed output is BLOCKED, never passed.

## Knowledge Context

- **Base commit**: `d341ebc38e28b1d5433844052bd1edb17df51cf7`
- **Queries**: `pi packages delegate workflow docs`, `delegate spec evals docs` (`--patterns`)
- **Knowledge used**: `[[pattern-delegate-builtin-type-carries-own-model]]`, `[[pattern-delegate-ledger-stale-at-acceptance]]`, `[[pattern-delegate-worker-terminated-before-report]]`, `[[pattern-docs-prohibition-by-example]]`, `[[pattern-evals-prose-literal-pinning]]`
- **Grounded against**: `.pi/settings.json`, `.pi/extensions/__tests__/settings.test.ts`, `docs/integrations/pi-dynamic-workflows.md`, `docs/harnesses/pi.md`, `docs/installation.md`, `docs/README.md`, `docs/integrations/pi-fff.md`, `CHANGELOG.md`, `package.json`, `vitest.config.ts`, `.agro/evals/probes/audit-stale-references.sh`, `.agro/skills/git/SKILL.md`, `.worktrees/AGENTS.md`, `projects/mifunedev/agro-web/docs/`
- **Conflicts discovered**: none. The plan's verified-facts list matched current sources at the base commit. One fact the plan did not state: `projects/mifunedev/agro-web` is cloned locally and currently advertises the package in `docs/harnesses/pi.md`, `docs/installation.md`, `docs/integrations/pi-fff.md`, and `docs/integrations/pi-dynamic-workflows.md`. US-005 resolves its disposition.

## Expected Knowledge Impact

- **Impact**: NOT-APPLICABLE
- **Expected entries**: `none`
- **Affected source paths**: `.pi/settings.json`, `.pi/extensions/__tests__/settings.test.ts`, `docs/**`, `CHANGELOG.md`
- **Reason**: No tracked knowledge page under `.agro/knowledge/source/` or `.agro/knowledge/patterns/` declares a dependency on the Pi package list or on the dynamic workflow documentation. The change removes a third-party default and its usage prose; it introduces no reusable mechanism and changes no harness architecture, skill behavior, agent role, or shared vocabulary. Step 6 re-derives the real answer from the actual diff.

## Plan Reconciliation

- **Source plan**: `/home/sandbox/harness/.agro/plans/retire-pi-dynamic-workflows/plan.md`
- **Intent preserved**: YES
- **Material deviations**: none
- **Constraints discovered during grounding**: (1) `projects/mifunedev/agro-web` is cloned locally and carries the same advertising, so US-005's public-documentation disposition has a concrete, inspectable target rather than a remote-only question; a companion change in that repository is a separate assignment the advisor defines only after accepting the evidence, and it is not part of this PR's diff. (2) The worktree path in the plan's T1 row is illustrative; the canonical convention in `.worktrees/AGENTS.md` and `.agro/skills/git/SKILL.md` places the build at `.worktrees/task/1054-retire-pi-dynamic-workflows`. (3) `.agro/evals/probes/audit-stale-references.sh` guards retired *audit* vocabulary only and does not scan for the retired package name, so no probe exemption is needed; `[[pattern-docs-prohibition-by-example]]` still applies to how the migration note is worded. (4) The operator selected `origin` → `mifunedev/agro` and base `development` explicitly; this checkout has exactly one remote.
- **Orchestration preserved**: YES. T1 remains one continuing bounded writer owning the coupled step 2-3 files in an isolated worktree with requested model `inherit` and reasoning `medium`; T2 remains an independent read-only reviewer with no tracked write paths, the same requested settings, and no service actions; T3 remains advisor-owned publication work with no implementation edits. The 30-turn and 1,000-word worker budgets, the evidence destinations, the exclusion lists, the prohibition on calling the retiring tool, the prohibition on child dispatch and service restarts, and the requirement to record requested and observed settings separately all carry into the task prompt through this PRD.
