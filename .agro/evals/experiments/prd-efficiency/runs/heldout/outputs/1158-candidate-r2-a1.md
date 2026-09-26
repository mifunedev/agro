# PRD: Prune issue templates to feat, bug, and task

Status: DRAFT

## User Stories

### US-001: Guard the template set with tests

**Description:** As a maintainer, I want tests that pin the template set so that stale templates fail CI.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/issue-templates.test.ts` has a case that asserts the `.md` files in `.github/ISSUE_TEMPLATE/` are exactly `bug.md`, `feat.md`, and `task.md`.
- [ ] The test file has a case that asserts `bug.md` holds the headings `## Metadata`, `## Impact`, `## Reproduction`, `## Suspected Cause`, `## Test Plan (TDD)`, and `## Acceptance Criteria` in that order.
- [ ] The test file has a case that asserts `task.md` holds exactly the headings `## Metadata`, `## Description`, and `## Done When` in that order.
- [ ] Before US-002 lands, the new cases fail against the base commit.

### US-002: Rewrite bug and task templates and delete audit and skill

**Description:** As an operator, I want three templates so that each branch prefix maps to one template.

**Acceptance Criteria:**

- [ ] `.github/ISSUE_TEMPLATE/bug.md` follows the `feat.md` shape with the six US-001 headings and binary acceptance-criteria checkboxes.
- [ ] `.github/ISSUE_TEMPLATE/task.md` holds only the frontmatter, `## Metadata`, `## Description`, and `## Done When`.
- [ ] The `## Metadata` block in `bug.md` and `task.md` uses the yml `pull_request_title` and `branch` keys from `feat.md`, with the `bug` or `task` prefix.
- [ ] `.github/ISSUE_TEMPLATE/audit.md` is deleted, and `.github/ISSUE_TEMPLATE/skill.md` is deleted.
- [ ] Each remaining template keeps the link to `.agro/skills/git/SKILL.md`.
- [ ] Every case in `.agro/scripts/__tests__/issue-templates.test.ts` passes.

### US-003: Align prefix lists and changelog

**Description:** As a contributor, I want one prefix list in every document so that branch names stay consistent.

**Acceptance Criteria:**

- [ ] `.agro/skills/git/SKILL.md` line 36 lists the prefixes `feat` · `bug` · `task`.
- [ ] `.agro/skills/git/SKILL.md` line 96 lists the commit types `feat` · `fix` · `task`.
- [ ] `docs/contributing.md` line 107 lists the prefixes `feat` · `bug` · `task`.
- [ ] `docs/contributing.md` line 127 lists the commit types `feat` · `fix` · `task`.
- [ ] `git grep -n -E 'audit · skill|ISSUE_TEMPLATE/(audit|skill)'` prints no line in `.agro/skills/git/SKILL.md` or `docs/contributing.md`.
- [ ] `CHANGELOG.md` has an entry under `## [Unreleased]` and `### Changed` that names the three templates.

## Summary

The directory `.github/ISSUE_TEMPLATE/` holds five templates: `audit.md`, `bug.md`, `feat.md`, `skill.md`, and `task.md`. The `bug.md` template uses a free-form Description and Steps shape. The `task.md` template holds a Context section. The /git skill lists five branch prefixes and five commit types. The file `docs/contributing.md` lists six branch prefixes, including `fix` and `agent`, and five commit types. The test `.agro/scripts/__tests__/issue-templates.test.ts` checks only stale tokens and stale links.

The plan adds red tests first. Then the plan rewrites `bug.md` and `task.md`, deletes `audit.md` and `skill.md`, and aligns both prefix lists. The branch prefix `bug` maps to the commit type `fix`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/ISSUE_TEMPLATE/bug.md` | template headings | Rewrite to the `feat.md` shape |
| `.github/ISSUE_TEMPLATE/task.md` | template headings | Replace with a thin template |
| `.github/ISSUE_TEMPLATE/audit.md` | whole file | Delete |
| `.github/ISSUE_TEMPLATE/skill.md` | whole file | Delete |
| `.github/ISSUE_TEMPLATE/feat.md` | `## Metadata`, `## Test Plan (TDD)` | Reference shape; no change |
| `.agro/skills/git/SKILL.md` | prefix list at line 36, commit types at line 96 | Canonical git workflow |
| `docs/contributing.md` | prefixes at line 107, types at line 127 | Contributor documentation |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `templateFiles` | Template regression tests |
| `CHANGELOG.md` | `## [Unreleased]` / `### Changed` | Release notes |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub new-issue chooser | Removal | The Audit and Skill choices disappear. |
| Bug issue body | Shape change | Bug reports use the six `feat.md`-style sections. |
| Task issue body | Shape change | Task issues use Metadata, Description, and Done When. |

## Storage

N/A. The change edits Markdown templates and documentation only.

## Architectural Decisions

- `.agro/skills/git/SKILL.md` is the canonical prefix list. `docs/contributing.md` repeats the same list.
- One branch prefix maps to one template: `feat`, `bug`, and `task`.
- Commit types stay separate from branch prefixes: `feat`, `fix`, and `task`.
- An audit runs through the /audit skill. A new skill uses the `feat` template.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | template set equals `bug.md`, `feat.md`, `task.md` | Deletion of `audit.md` and `skill.md` |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `bug.md` heading order | `feat.md`-shape rewrite |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `task.md` heading set | Thin task template |
| `.agro/scripts/__tests__/issue-templates.test.ts` | existing stale-token and stale-link cases | No regression |

Run the file with `<test command>` from the package that owns vitest.

## Design Principles

- Keep one template per branch prefix.
- Keep one source of truth for the prefix list in the /git skill.
- Delete obsolete templates. Do not keep dormant alternatives.
- Add no explanatory comments to tracked code.

## Out of Scope

- The drift regex in `.agro/skills/audit/references/drift.md` at lines 109 and 116.
- The `--prefix` list in `.agro/skills/spec/references/plan.md` at line 5.
- The `--prefix` list and the `jq` branch regex in `.agro/skills/prd/references/tracker.md`.
- GitHub labels and existing issues that use the `audit` or `skill` templates.
- Matching changes in the mifunedev/agro-web repository.

## Open Questions

1. Which command runs `.agro/scripts/__tests__/issue-templates.test.ts`? The plan uses `<test command>` until the implementer confirms the package that owns vitest.
2. Must `.agro/skills/spec/references/plan.md`, `.agro/skills/prd/references/tracker.md`, and `.agro/skills/audit/references/drift.md` drop `audit` and `skill` in this task? The issue names only the /git skill and `docs/contributing.md`.
3. Must `docs/contributing.md` drop the `agent` prefix? The Done When list implies the removal, but the issue does not name `agent`.
4. Does the public site in mifunedev/agro-web document the issue templates or the prefix list?

## Acceptance Criteria

- [ ] `.github/ISSUE_TEMPLATE/` holds only `feat.md`, `bug.md`, and `task.md`.
- [ ] The /git skill and `docs/contributing.md` list the prefixes `feat` · `bug` · `task` and the commit types `feat` · `fix` · `task`.
- [ ] `.agro/scripts/__tests__/issue-templates.test.ts` passes.
- [ ] `CHANGELOG.md` has an entry under `### Changed` in `## [Unreleased]`.

## Lessons

Filled by the advisor before undraft.
