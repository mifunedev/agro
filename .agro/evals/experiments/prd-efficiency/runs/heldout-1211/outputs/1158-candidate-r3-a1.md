# PRD: Prune issue templates

Status: DRAFT

## User Stories

### US-001: Keep one issue template per branch prefix

**Description:** As an operator, I want exactly three issue templates so that each template maps to one branch prefix.

**Acceptance Criteria:**

- [ ] A new case in `.agro/scripts/__tests__/issue-templates.test.ts` asserts that the `.md` files in `.github/ISSUE_TEMPLATE/` equal `bug.md`, `feat.md`, `task.md`.
- [ ] The new case fails before the deletion, because `audit.md` and `skill.md` exist.
- [ ] `.github/ISSUE_TEMPLATE/audit.md` and `.github/ISSUE_TEMPLATE/skill.md` do not exist.
- [ ] `npx vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.

### US-002: Rewrite the bug template in the feature template shape

**Description:** As an operator, I want a bug template in the feature template shape so that a bug issue carries a TDD test plan.

**Acceptance Criteria:**

- [ ] A new case in `issue-templates.test.ts` asserts that the `## ` headings of `bug.md` are, in order: `Metadata`, `Impact`, `Reproduction`, `Suspected Cause`, `Test Plan (TDD)`, `Acceptance Criteria`.
- [ ] The new case fails against the current `bug.md`.
- [ ] The `## Metadata` section of `bug.md` holds a `yml` block with `pull_request_title` and `branch` keys, and `branch` starts with `bug/`.
- [ ] The frontmatter of `bug.md` keeps `labels: bug`.
- [ ] `npx vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.

### US-003: Replace the task template with a thin template

**Description:** As an operator, I want a thin task template so that a small unit of work needs only a description and a done list.

**Acceptance Criteria:**

- [ ] A new case in `issue-templates.test.ts` asserts that the `## ` headings of `task.md` are, in order: `Metadata`, `Description`, `Done When`.
- [ ] The new case fails against the current `task.md`, because the current file holds `## Context` and no `## Metadata`.
- [ ] The `## Metadata` section of `task.md` holds a `yml` block with `pull_request_title` and `branch` keys, and `branch` starts with `task/`.
- [ ] `npx vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.

### US-004: Align prefix and commit-type lists

**Description:** As a contributor, I want aligned prefix lists in the git skill and the contributing guide so that names match the templates.

**Acceptance Criteria:**

- [ ] Line 36 of `.agro/skills/git/SKILL.md` lists the issue prefixes `feat` · `bug` · `task` and no other prefix.
- [ ] Line 96 of `.agro/skills/git/SKILL.md` lists the commit types `feat` · `fix` · `task` and no other type.
- [ ] Line 107 of `docs/contributing.md` lists the branch prefixes `feat` · `bug` · `task` and no other prefix.
- [ ] Line 127 of `docs/contributing.md` lists the commit types `feat` · `fix` · `task` and no other type.
- [ ] `CHANGELOG.md` holds one new entry under `## [Unreleased]` › `### Changed` that cites the issue number.

## Summary

Issue 1158 (`work/issue-1158.md`) reduces the issue templates to three: `feat`, `bug`, `task`.

Verified current state:

- `.github/ISSUE_TEMPLATE/` holds five files: `audit.md`, `bug.md`, `feat.md`, `skill.md`, `task.md`.
- `bug.md` holds `Description`, `Steps to Reproduce`, `Expected Behavior`, `Actual Behavior`, `Environment`, and `Acceptance Criteria`.
- `task.md` holds `Description`, `Context`, and `Done When`. The file holds no `Metadata` section.
- `.agro/skills/git/SKILL.md:36` lists issue prefixes `feat` · `bug` · `task` · `audit` · `skill`.
- `.agro/skills/git/SKILL.md:96` lists commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `docs/contributing.md:107` lists branch prefixes `feat` · `fix` · `task` · `audit` · `skill` · `agent`.
- `docs/contributing.md:127` lists commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `.agro/scripts/__tests__/issue-templates.test.ts` checks two things across all templates: no stale stack prompts, and no link to `.claude/rules/git.md`.
- `.claude/skills` resolves to `.agro/skills`. `.claude/skills/git/SKILL.md` and `.agro/skills/git/SKILL.md` share one inode.

Selected approach: add red test cases first, then change the templates and the lists. The implementation owner edits only canonical paths.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/ISSUE_TEMPLATE/audit.md` | whole file | Delete. The `/audit` skill replaces the audit template. |
| `.github/ISSUE_TEMPLATE/skill.md` | whole file | Delete. A new skill uses the `feat` template. |
| `.github/ISSUE_TEMPLATE/bug.md` | frontmatter, all sections | Rewrite in the `feat.md` shape. |
| `.github/ISSUE_TEMPLATE/task.md` | frontmatter, all sections | Replace with `Metadata`, `Description`, `Done When`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `templateFiles()`, `describe("GitHub issue templates")` | Add the set case and the two heading-order cases. |
| `.agro/skills/git/SKILL.md` | lines 36 and 96 | Canonical prefix and commit-type lists. |
| `docs/contributing.md` | lines 107 and 127 | Contributor prefix and commit-type lists. |
| `CHANGELOG.md` | `## [Unreleased]` › `### Changed` | Record the change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub "New issue" template picker | Remove | The picker stops offering "Audit" and "Skill". |
| GitHub bug issue form | Modify | The form asks for Impact, Reproduction, Suspected Cause, a TDD test plan, and binary criteria. |
| GitHub task issue form | Modify | The form asks for Metadata, Description, and Done When. |
| `/git` skill prefix and type lists | Modify | Lists shrink to three prefixes and three commit types. |

## Storage

N/A. The change edits Markdown templates, documentation, and one test. No persistent state changes.

## Architectural Decisions

- `.github/ISSUE_TEMPLATE/<prefix>.md` stays the source of truth for the issue prefix set. `.agro/skills/git/SKILL.md:37` already states this mapping.
- `.agro/skills/git/SKILL.md` is the canonical skill source. The implementation owner does not edit the `.claude/skills/` mirror path.
- The branch prefix for a bug is `bug`. The commit type for a bug is `fix`. The issue states both lists.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | holds only `bug.md`, `feat.md`, `task.md` | US-001: the template set. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `bug.md` headings match the feature shape in order | US-002: the bug template shape. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `task.md` headings are `Metadata`, `Description`, `Done When` | US-003: the thin task template. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | existing stale-prompt and stale-link cases | Regression: the new templates keep both guards green. |

Run the suite with `npx vitest run .agro/scripts/__tests__/issue-templates.test.ts`. The root `package.json` defines `"test": "vitest run"`.

## Design Principles

- Map one template to one branch prefix.
- Keep each template small. A template section must carry information that the implementation owner uses.
- Edit the canonical `.agro/` source, not a provider mirror.
- Write the red test before each template change.
- Add no explanatory comments to the test file.

## Out of Scope

- Changes to `.github/ISSUE_TEMPLATE/feat.md`.
- Changes to the pull request template.
- Changes to `/audit` skill behavior or `/builder` skill behavior.
- A GitHub label cleanup for the `audit` and `skill` labels.
- Public documentation in `mifunedev/agro-web`, unless Open Question 3 decides otherwise.

## Open Questions

1. Other prefix lists name `audit` and `skill`: `.agro/skills/prd/references/tracker.md:10` and `:109`, and `.agro/skills/spec/references/plan.md:5`. Must this task reduce these lists to `feat|bug|task`? Recommendation: yes, because each list produces a branch name.
2. `.agro/skills/audit/references/drift.md:109` and `:116` accept the branch regex `^(feat|fix|task|audit|skill|agent)/`. Must this task change the regex to `^(feat|bug|task)/`? A narrower regex flags existing `fix/`, `audit/`, and `skill/` branches as unexpected.
3. Does `mifunedev/agro-web` list the issue prefixes or the commit types? If yes, that repository needs a matching change.

## Acceptance Criteria

- [ ] `ls .github/ISSUE_TEMPLATE/` prints exactly `bug.md`, `feat.md`, `task.md`.
- [ ] `.agro/skills/git/SKILL.md` and `docs/contributing.md` list prefixes `feat` · `bug` · `task` and commit types `feat` · `fix` · `task`.
- [ ] `npx vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.
- [ ] `CHANGELOG.md` holds one entry for this change under `### Changed`.
- [ ] `git grep -n 'ISSUE_TEMPLATE/audit\|ISSUE_TEMPLATE/skill'` prints no match.

## Lessons

Filled by the advisor before undraft.
