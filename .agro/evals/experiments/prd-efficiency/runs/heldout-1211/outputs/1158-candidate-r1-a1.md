# PRD: Prune issue templates to feat, bug, and task

Status: DRAFT

## User Stories

### US-001: Keep three issue templates in the feat.md shape

**Description:** As an operator, I want one issue template per branch prefix so that each issue maps to exactly one prefix.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/issue-templates.test.ts` has a case that asserts the `.md` files in `.github/ISSUE_TEMPLATE/` equal `bug.md`, `feat.md`, `task.md`.
- [ ] The new case fails before the template change, because `audit.md` and `skill.md` exist.
- [ ] `.github/ISSUE_TEMPLATE/audit.md` and `.github/ISSUE_TEMPLATE/skill.md` do not exist.
- [ ] `bug.md` has the `##` headings `Metadata`, `Impact`, `Reproduction`, `Suspected Cause`, `Test Plan (TDD)`, `Acceptance Criteria`, in that order.
- [ ] `task.md` has the `##` headings `Metadata`, `Description`, `Done When`, in that order.
- [ ] The `Metadata` block in `bug.md` and in `task.md` copies the `feat.md` Metadata block, with the `feat` prefix replaced by `bug` or `task`.
- [ ] The test file has a case for each heading order above.
- [ ] `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.

### US-002: Align the prefix and commit-type lists

**Description:** As an agent, I want every prefix list to name `feat`, `bug`, and `task` so that no skill or document points at a deleted template.

**Acceptance Criteria:**

- [ ] `.agro/skills/git/SKILL.md` line 36 lists the prefixes `feat` · `bug` · `task`.
- [ ] `.agro/skills/git/SKILL.md` line 96 lists the commit types `feat` · `fix` · `task`.
- [ ] `docs/contributing.md` "Branch Naming" lists the prefixes `feat` · `bug` · `task`.
- [ ] `docs/contributing.md` "Commit Messages" lists the types `feat` · `fix` · `task`.
- [ ] `.agro/skills/prd/references/tracker.md` accepts `--prefix <feat|bug|task>`, and its `jq` branch check uses `^(feat|bug|task)/`.
- [ ] `.agro/skills/spec/references/plan.md` line 5 shows `--prefix feat|bug|task`.
- [ ] `git grep -nE 'feat\|bug\|task\|audit|audit. · .skill' -- .agro/skills docs` prints no line.
- [ ] `CHANGELOG.md` has one entry under `## [Unreleased]` → `### Changed` that names the three templates and links the issue as `<issue#>`.

## Summary

The issue source is `work/issue-1158.md`. The directory `.github/ISSUE_TEMPLATE/` holds five templates today: `audit.md`, `bug.md`, `feat.md`, `skill.md`, `task.md`.

Verified current state:

- `bug.md` has the headings Description, Steps to Reproduce, Expected Behavior, Actual Behavior, Environment, and Acceptance Criteria.
- `task.md` has the headings Description, Context, and Done When.
- `audit.md` and `skill.md` are free-form templates. The `/audit` skill replaces the audit template. A new skill is a `feat` issue.
- `.agro/skills/git/SKILL.md:36` lists the issue prefixes `feat` · `bug` · `task` · `audit` · `skill`. Line 37 states that each prefix matches `.github/ISSUE_TEMPLATE/<prefix>.md`.
- `.agro/skills/git/SKILL.md:96` lists the commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `docs/contributing.md:107` lists the branch prefixes `feat` · `fix` · `task` · `audit` · `skill` · `agent`. Line 127 lists the commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `.agro/skills/prd/references/tracker.md` and `.agro/skills/spec/references/plan.md:5` accept the prefix set `feat|bug|task|audit|skill`.
- `.agro/scripts/__tests__/issue-templates.test.ts` checks only forbidden tokens and stale links. The test has no check on the file set or on the headings.

Selected approach: add red tests for the file set and the heading order, then rewrite `bug.md` and `task.md`, delete two templates, and align every prefix list. The branch prefix for a bug is `bug`. The commit type for a bug is `fix`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/ISSUE_TEMPLATE/bug.md` | whole file | Rewrite in the `feat.md` shape. |
| `.github/ISSUE_TEMPLATE/task.md` | whole file | Replace with Metadata, Description, Done When. |
| `.github/ISSUE_TEMPLATE/audit.md` | whole file | Delete. |
| `.github/ISSUE_TEMPLATE/skill.md` | whole file | Delete. |
| `.github/ISSUE_TEMPLATE/feat.md` | `## Metadata` block | Source shape for the Metadata block. Read only. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `templateFiles`, `describe("GitHub issue templates")` | Add the file-set case and the heading-order cases. |
| `.agro/skills/git/SKILL.md` | "Issue Titles" line 36, "Commit Messages" line 96 | Prefix list and commit-type list. |
| `docs/contributing.md` | "Branch Naming" line 107, "Commit Messages" line 127 | Prefix list and commit-type list. |
| `.agro/skills/prd/references/tracker.md` | "Inputs" `--prefix`, "Verification" `jq` regex | Prefix set for `prd.json` conversion. |
| `.agro/skills/spec/references/plan.md` | line 5 `--prefix` | Prefix set for `/spec plan`. |
| `CHANGELOG.md` | `## [Unreleased]` → `### Changed` | Changelog entry. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub "New issue" chooser | Modify | The chooser offers Feature, Bug, and Task. Audit and Skill disappear. |
| Branch prefixes | Modify | The allowed branch prefixes become `feat`, `bug`, `task`. |
| Commit types | Modify | The allowed commit types become `feat`, `fix`, `task`. |
| `/prd` tracker `--prefix` | Modify | The argument accepts `feat`, `bug`, `task`. |
| `/spec plan --prefix` | Modify | The argument accepts `feat`, `bug`, `task`. |

## Storage

N/A. The task changes Markdown templates, documentation, and one test file. The task stores no state.

## Architectural Decisions

- Source of truth: `.github/ISSUE_TEMPLATE/<prefix>.md` defines the prefix set. `.agro/skills/git/SKILL.md` names the same set.
- The test file pins the template set and the heading order. A future template change must update the test.
- `.claude/skills` is a symlink to `.agro/skills`. Edit only the canonical `.agro/skills/` files.
- Surfaces: host and sandbox, applied (edits run in the sandbox worktree). Lifecycle door, not applicable (no `agro` verb changes). Canonical and provider surfaces, applied (edits go to `.agro/skills/`). Root and scaffold, applied to the root repository only. Interactive and headless processes, not applicable. Local and remote operation, not applicable. Parallel operation, applied (US-001 and US-002 own disjoint files except `CHANGELOG.md`, which US-002 owns). Public documentation, open (see Open Questions). Verification, applied (vitest and `git grep`).

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | "hold only feat, bug, and task" | The `.md` file set in `.github/ISSUE_TEMPLATE/` equals `bug.md`, `feat.md`, `task.md`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | "bug.md follows the feat.md shape" | The `##` headings of `bug.md` equal the US-001 list, in order. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | "task.md is thin" | The `##` headings of `task.md` equal `Metadata`, `Description`, `Done When`, in order. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | existing two cases | The forbidden tokens and the stale link stay absent. |
| shell | the `git grep` command in US-002 | No retired prefix list remains. |

Run the red step first. The three new cases fail on the current tree.

## Design Principles

- Keep one template per branch prefix.
- Delete obsolete templates. Do not keep a dormant alternative.
- Add no explanatory comments to tracked code. Template placeholders are data for the issue author, not code comments.
- Apply `/ste` to every template body and every documentation line.

## Out of Scope

- The branch regex in `.agro/skills/audit/references/drift.md:109` and `:116`, `^(feat|fix|task|audit|skill|agent)/`. See Open Questions.
- The PR template and `feat.md` content.
- GitHub labels `audit` and `skill` on the remote repository.
- Archived task files under `.agro/tasks/archive/`.
- The `agent` branch prefix in `docs/contributing.md`, other than its removal from the aligned list.

## Open Questions

1. Does `.agro/skills/audit/references/drift.md` change its branch regex to `^(feat|bug|task)/`? The current regex accepts `fix`, `audit`, `skill`, and `agent`. A change flags existing branches with those prefixes as drift. Default: out of scope.
2. Does `mifunedev/agro-web` list the issue templates, branch prefixes, or commit types? If yes, that repository needs a matching change.
3. Does the operator delete the `audit` and `skill` labels on GitHub? This plan does not change remote labels.

## Acceptance Criteria

- [ ] `ls .github/ISSUE_TEMPLATE/` prints only `bug.md`, `feat.md`, `task.md`.
- [ ] `.agro/skills/git/SKILL.md` and `docs/contributing.md` list the prefixes `feat` · `bug` · `task` and the commit types `feat` · `fix` · `task`.
- [ ] `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `CHANGELOG.md` has the entry under `## [Unreleased]` → `### Changed`.

## Lessons

Filled by the advisor before undraft.
