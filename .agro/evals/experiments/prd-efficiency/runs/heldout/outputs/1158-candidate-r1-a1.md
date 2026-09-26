# PRD: Prune issue templates to feat, bug, and task

Status: DRAFT

## User Stories

### US-001: Guard the three-template set with tests

**Description:** As a maintainer, I want tests that pin the template set so that stale templates fail CI.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/issue-templates.test.ts` asserts that `.github/ISSUE_TEMPLATE/` holds exactly `bug.md`, `feat.md`, and `task.md`.
- [ ] The test asserts that `bug.md` holds the headings Metadata, Impact, Reproduction, Suspected Cause, Test Plan (TDD), and Acceptance Criteria in that order.
- [ ] The test asserts that `task.md` holds the headings Metadata, Description, and Done When in that order.
- [ ] Before US-002 lands, `npx vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 1 on the new cases.

### US-002: Rewrite bug and task templates and delete the others

**Description:** As an operator, I want one template per branch prefix so that issue shape matches branch type.

**Acceptance Criteria:**

- [ ] `.github/ISSUE_TEMPLATE/bug.md` follows the `feat.md` shape with the six headings from US-001.
- [ ] `.github/ISSUE_TEMPLATE/task.md` holds only frontmatter plus the Metadata, Description, and Done When sections.
- [ ] The file `.github/ISSUE_TEMPLATE/audit.md` is absent after the change.
- [ ] The file `.github/ISSUE_TEMPLATE/skill.md` is absent after the change.
- [ ] `npx vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.

### US-003: Align prefix and commit-type lists

**Description:** As a contributor, I want one prefix list everywhere so that docs match the templates.

**Acceptance Criteria:**

- [ ] `.agro/skills/git/SKILL.md` lists branch prefixes `feat` · `bug` · `task` at line 36.
- [ ] `.agro/skills/git/SKILL.md` lists commit types `feat` · `fix` · `task` at line 96.
- [ ] `docs/contributing.md` lists prefixes `feat` · `bug` · `task` and types `feat` · `fix` · `task`.
- [ ] `.agro/skills/prd/references/tracker.md` and `.agro/skills/spec/references/plan.md` list only `feat`, `bug`, and `task` as prefixes.
- [ ] `git grep -n 'audit|skill' -- .agro/skills docs` prints no prefix list.
- [ ] `CHANGELOG.md` holds an entry for this change under `### Changed` in the Unreleased section.

## Summary

The directory `.github/ISSUE_TEMPLATE/` holds five templates: `audit.md`, `bug.md`, `feat.md`, `skill.md`, and `task.md`. The current `bug.md` uses Description, Steps to Reproduce, Expected, Actual, and Environment sections. The current `task.md` holds Description, Context, and Done When. The /git skill lists five branch prefixes and five commit types. `docs/contributing.md` lists six prefixes, including `fix` and `agent`, and five commit types. The prd tracker and the spec plan reference also accept `audit` and `skill` prefixes. This task keeps three templates, one per branch prefix. The task rewrites `bug.md` in the `feat.md` shape, thins `task.md`, deletes the other two templates, and aligns every prefix list.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/ISSUE_TEMPLATE/feat.md` | section headings | Shape reference for `bug.md` |
| `.github/ISSUE_TEMPLATE/bug.md` | whole file | Rewrite target |
| `.github/ISSUE_TEMPLATE/task.md` | whole file | Rewrite target |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `templateFiles` | Template test suite |
| `.agro/skills/git/SKILL.md` | lines 36-37, 96 | Prefix and commit-type lists |
| `docs/contributing.md` | lines 107, 127 | Prefix and commit-type lists |
| `.agro/skills/prd/references/tracker.md` | `--prefix` input, branchName regex | Prefix list |
| `.agro/skills/spec/references/plan.md` | line 5 `--prefix` | Prefix list |
| `CHANGELOG.md` | `### Changed` under Unreleased | Changelog entry |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub new-issue chooser | Removal | The Audit and Skill choices disappear. |
| Bug issue body | Modified | New sections follow the feat shape. |
| Task issue body | Modified | Three sections replace the current layout. |

## Storage

N/A. The change edits tracked Markdown files and one test file. No state persists.

## Architectural Decisions

- The branch prefix set is `feat`, `bug`, `task`. Each prefix maps to one template file of the same name.
- The commit type set is `feat`, `fix`, `task`. A `bug` branch uses `fix` commits.
- The /git skill is the canonical source for both sets. Other files repeat the sets and must match the skill.
- Audits run through the /audit skill and need no template. A new skill uses the feat template.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | holds exactly feat, bug, task | Deleted templates stay deleted |
| `.agro/scripts/__tests__/issue-templates.test.ts` | bug headings in order | Bug template follows the feat shape |
| `.agro/scripts/__tests__/issue-templates.test.ts` | task headings in order | Task template stays thin |
| `.agro/scripts/__tests__/issue-templates.test.ts` | existing stale-token and git-link cases | No regression |

## Design Principles

- Keep one template per branch prefix.
- Keep one source of truth for the prefix list in the /git skill.
- Delete obsolete templates. Leave no dormant alternative.
- Add no explanatory comments to tracked code.

## Out of Scope

- Changes to `.github/ISSUE_TEMPLATE/feat.md`.
- Relabel or migration of existing GitHub issues that use the audit or skill labels.
- Changes to the /audit skill or the /builder skill.
- Public documentation in mifunedev/agro-web, unless Open Question 2 requires the change.

## Open Questions

1. The `agent` prefix in `docs/contributing.md` has no template. This plan removes the prefix. Confirm the removal.
2. Does mifunedev/agro-web document the five templates or the prefix list? If so, the operator opens a matching change there.
3. Do the GitHub labels audit and skill stay in the repository settings? This plan leaves the labels unchanged.

## Acceptance Criteria

- [ ] `ls .github/ISSUE_TEMPLATE/` prints only `bug.md`, `feat.md`, and `task.md`.
- [ ] `npx vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.
- [ ] The /git skill and `docs/contributing.md` list prefixes `feat` · `bug` · `task` and commit types `feat` · `fix` · `task`.
- [ ] `CHANGELOG.md` holds an entry under `### Changed` in the Unreleased section.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .github/ISSUE_TEMPLATE/bug.md .github/ISSUE_TEMPLATE/task.md` exits 0.

## Lessons

Filled by the advisor before undraft.
