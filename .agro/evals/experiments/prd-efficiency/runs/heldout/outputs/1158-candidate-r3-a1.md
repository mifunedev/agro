# PRD: Prune issue templates to feat, bug, and task

Status: DRAFT

## User Stories

### US-001: Reduce the template set to three

**Description:** As an operator, I want one issue template per branch prefix so that issue shape matches branch type.

**Acceptance Criteria:**

- [ ] `ls .github/ISSUE_TEMPLATE` lists only `feat.md`, `bug.md`, and `task.md`.
- [ ] The implementer deletes `.github/ISSUE_TEMPLATE/audit.md` and `.github/ISSUE_TEMPLATE/skill.md`.
- [ ] `.github/ISSUE_TEMPLATE/bug.md` has the headings Metadata, Impact, Reproduction, Suspected Cause, Test Plan (TDD), and Acceptance Criteria, in that order.
- [ ] The Metadata section of `.github/ISSUE_TEMPLATE/bug.md` uses the same yml block shape as `.github/ISSUE_TEMPLATE/feat.md`, with the bug branch prefix.
- [ ] Each checkbox under Acceptance Criteria in `.github/ISSUE_TEMPLATE/bug.md` is a binary check.
- [ ] `.github/ISSUE_TEMPLATE/task.md` has only the headings Metadata, Description, and Done When, in that order.
- [ ] A new test case in `.agro/scripts/__tests__/issue-templates.test.ts` asserts the exact set `bug.md`, `feat.md`, `task.md`.
- [ ] The new test case fails before the deletions and passes after the deletions.
- [ ] `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.

### US-002: Align prefix and commit-type lists

**Description:** As an agent, I want one prefix list in each guide so that branch and commit names stay consistent.

**Acceptance Criteria:**

- [ ] Line 36 of `.agro/skills/git/SKILL.md` lists the prefixes `feat` · `bug` · `task` and no other prefix.
- [ ] Line 96 of `.agro/skills/git/SKILL.md` lists the commit types `feat` · `fix` · `task` and no other type.
- [ ] The Prefixes line of `docs/contributing.md` lists `feat` · `bug` · `task` and no other prefix.
- [ ] The Types line of `docs/contributing.md` lists `feat` · `fix` · `task` and no other type.
- [ ] `CHANGELOG.md` has an entry for this change under `### Changed` in `## [Unreleased]`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/contributing.md` reports no new finding on the changed lines.

## Summary

The template directory `.github/ISSUE_TEMPLATE/` holds five templates: `audit.md`, `bug.md`, `feat.md`, `skill.md`, and `task.md`. The /git skill lists five branch prefixes and five commit types. `docs/contributing.md` lists six prefixes, with `fix` in place of `bug` and an extra `agent`. The existing test checks only stale tokens in each template.

The plan keeps three templates, one per branch prefix. The `bug` prefix pairs with the `fix` commit type. An audit is a skill that the operator runs. A new skill is a feature. The plan rewrites `bug.md` in the `feat.md` shape and reduces `task.md` to three sections.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/ISSUE_TEMPLATE/bug.md` | whole file | Rewrite in the `feat.md` shape |
| `.github/ISSUE_TEMPLATE/task.md` | whole file | Replace with the thin template |
| `.github/ISSUE_TEMPLATE/audit.md` | whole file | Delete |
| `.github/ISSUE_TEMPLATE/skill.md` | whole file | Delete |
| `.github/ISSUE_TEMPLATE/feat.md` | Metadata section | Reference shape; no change |
| `.agro/skills/git/SKILL.md` | lines 36 and 96 | Prefix list and commit-type list |
| `docs/contributing.md` | lines 107 and 127 | Prefix list and commit-type list |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `templateFiles` | Add the exact-set test case |
| `CHANGELOG.md` | `## [Unreleased]` `### Changed` | Changelog entry |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub new-issue chooser | Removed entries | The Audit and Skill options disappear |
| GitHub new-issue chooser | Changed body | The Bug and Task bodies change shape |
| Branch naming | Narrowed | Valid prefixes become `feat`, `bug`, and `task` |

## Storage

N/A. The change edits Markdown templates and documentation only.

## Architectural Decisions

- The template directory is the source of truth for the prefix set.
- The /git skill and `docs/contributing.md` mirror that set.
- The test asserts the set, so a new template requires a deliberate test change.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | new case: template set equals `bug.md`, `feat.md`, `task.md` | Exact template set |
| `.agro/scripts/__tests__/issue-templates.test.ts` | existing stale-token and git-link cases | Rewritten templates stay clean |

## Design Principles

- Delete obsolete paths. Leave no dormant template.
- Keep one prefix per template and one template per prefix.
- Add no explanatory comments beyond the placeholder prompts that the templates already use.

## Out of Scope

- The public documentation in the mifunedev/agro-web repository.
- The branch regex in `.agro/skills/audit/references/drift.md`.
- The `--prefix` lists in `.agro/skills/prd/references/tracker.md` and `.agro/skills/spec/references/plan.md`.
- Existing branches and issues that use the `audit` or `skill` prefix.

## Open Questions

1. Do the `--prefix` lists in `.agro/skills/prd/references/tracker.md` and `.agro/skills/spec/references/plan.md` also drop `audit` and `skill`? This plan leaves them unchanged.
2. Does the drift regex in `.agro/skills/audit/references/drift.md` also narrow to `feat`, `bug`, and `task`? This plan leaves the regex unchanged.
3. Does `docs/contributing.md` keep the `agent` prefix? The issue lists three prefixes, so this plan removes `agent`.

## Acceptance Criteria

- [ ] `.github/ISSUE_TEMPLATE/` holds only `feat.md`, `bug.md`, and `task.md`.
- [ ] The /git skill and `docs/contributing.md` list the prefixes `feat` · `bug` · `task` and the commit types `feat` · `fix` · `task`.
- [ ] `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.
- [ ] `CHANGELOG.md` has an entry under `### Changed` in `## [Unreleased]`.

## Lessons

Filled by the advisor before undraft.
