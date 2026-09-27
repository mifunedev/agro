# PRD: Prune issue templates

Status: DRAFT

## User Stories

### US-001: Three issue templates, one per branch prefix

**Description:** As an operator, I want one issue template per branch prefix so that each issue maps to one branch shape.

**Acceptance Criteria:**

- [ ] `ls .github/ISSUE_TEMPLATE/` prints only `bug.md`, `feat.md`, and `task.md`.
- [ ] `.github/ISSUE_TEMPLATE/audit.md` and `.github/ISSUE_TEMPLATE/skill.md` do not exist.
- [ ] `bug.md` holds these `##` headings in this order: `Metadata`, `Impact`, `Reproduction`, `Suspected Cause`, `Test Plan (TDD)`, `Acceptance Criteria`.
- [ ] The `bug.md` Metadata block names `bug/[issue#]-[shortdesc]` as the branch and `FROM bug/[issue#]-[shortdesc] TO [target-branch]` as the PR title.
- [ ] Each `- [ ]` item in the `bug.md` Acceptance Criteria section states a pass/fail check.
- [ ] `task.md` holds these `##` headings in this order: `Metadata`, `Description`, `Done When`.
- [ ] The `task.md` Metadata block names `task/[issue#]-[shortdesc]` as the branch and `FROM task/[issue#]-[shortdesc] TO [target-branch]` as the PR title.
- [ ] `npx vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.
- [ ] Each new test case in `issue-templates.test.ts` fails against the pre-change templates.

### US-002: Aligned prefix and commit-type lists

**Description:** As an agent, I want every prefix list to match the templates so that no two sources disagree.

**Acceptance Criteria:**

- [ ] `.agro/skills/git/SKILL.md` § Issue Titles lists `<prefix>` as `feat` · `bug` · `task`.
- [ ] `.agro/skills/git/SKILL.md` § Commit Messages lists `<type>` as `feat` · `fix` · `task`.
- [ ] `docs/contributing.md` § Branch Naming lists prefixes `feat` · `bug` · `task`.
- [ ] `docs/contributing.md` § Commit Messages lists types `feat` · `fix` · `task`.
- [ ] `.agro/skills/spec/references/plan.md` shows `--prefix feat|bug|task`.
- [ ] `.agro/skills/prd/references/tracker.md` shows `--prefix <feat|bug|task>`.
- [ ] `.agro/skills/audit/references/drift.md` Step B-2 accepts work branches that match `^(feat|bug|task)/`.
- [ ] `git grep -nE 'task\|audit|· audit|· agent|ISSUE_TEMPLATE/(audit|skill)' -- ':!CHANGELOG.md' ':!.agro/tasks' ':!.agro/evals/decisions' ':!.agro/evals/datasets'` prints no line.
- [ ] `CHANGELOG.md` holds one entry for this issue under `## [Unreleased]` → `### Changed`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/git/SKILL.md` reports no finding on a changed line.

## Summary

Issue #1158 reduces the issue templates to three: `feat`, `bug`, `task`.

Verified current state:

- `.github/ISSUE_TEMPLATE/` holds five templates: `audit.md`, `bug.md`, `feat.md`, `skill.md`, `task.md`.
- `feat.md` carries the target shape: a `## Metadata` block with a `yml` fence, a `## Test Plan (TDD)` table, and binary `## Acceptance Criteria`.
- `bug.md` uses an older shape: Description, Steps to Reproduce, Expected Behavior, Actual Behavior, Environment, Acceptance Criteria.
- `task.md` holds Description, Context, and Done When. `task.md` has no Metadata block.
- `.agro/skills/git/SKILL.md` lists issue prefixes `feat` · `bug` · `task` · `audit` · `skill`. The same file lists commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `docs/contributing.md` lists branch prefixes `feat` · `fix` · `task` · `audit` · `skill` · `agent`. The same file lists commit types `feat` · `fix` · `task` · `audit` · `skill`. The branch list says `fix`, and the `/git` skill says `bug`.
- `.agro/skills/spec/references/plan.md` and `.agro/skills/prd/references/tracker.md` also list `audit` and `skill` as `--prefix` values. The issue does not name these two files. This plan includes them, because a stale list breaks the one-source rule.
- `.agro/skills/audit/references/drift.md` Step B-2 accepts work branches that match `^(feat|fix|task|audit|skill|agent)/`. That regex omits `bug`, so the drift check flags each `bug/` branch as unexpected. The repository merged `bug/1150-guard-false-allows` in commit `51b44e1`.
- `.agro/scripts/__tests__/issue-templates.test.ts` checks two things for every template: no stale application-stack token, and no link to `.claude/rules/git.md`.

Selected approach: extend the existing vitest file first, then rewrite the templates, then align the lists.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/ISSUE_TEMPLATE/bug.md` | template body | Rewrite in the `feat.md` shape. |
| `.github/ISSUE_TEMPLATE/task.md` | template body | Replace with Metadata, Description, Done When. |
| `.github/ISSUE_TEMPLATE/audit.md` | whole file | Delete. |
| `.github/ISSUE_TEMPLATE/skill.md` | whole file | Delete. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `describe("GitHub issue templates")` | Add the template-set and heading-order cases. |
| `.agro/skills/git/SKILL.md` | § Issue Titles, § Commit Messages | Align the prefix and type lists. |
| `docs/contributing.md` | § Branch Naming, § Commit Messages | Align the prefix and type lists. |
| `.agro/skills/spec/references/plan.md` | argument form, `--prefix` | Align the prefix list. |
| `.agro/skills/prd/references/tracker.md` | § Inputs, `--prefix` | Align the prefix list. |
| `.agro/skills/audit/references/drift.md` | Step B-2 regex and message | Align the work-branch regex. |
| `CHANGELOG.md` | `## [Unreleased]` → `### Changed` | Record the change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub "New issue" template chooser | Modify | The chooser offers Feature Request, Bug Report, and Task only. |
| `/spec plan --prefix` | Modify | The accepted values become `feat`, `bug`, `task`. |
| `/prd` tracker `--prefix` | Modify | The accepted values become `feat`, `bug`, `task`. |
| `/audit drift` Step B-2 | Modify | The check accepts `feat/`, `bug/`, and `task/` work branches. |
| `docs/contributing.md` | Modify | Contributor docs list the three prefixes and three commit types. |

## Storage

N/A. The change edits static Markdown templates and docs. The change stores no state.

## Architectural Decisions

- **Source of truth**: `.github/ISSUE_TEMPLATE/<prefix>.md` defines the prefix set. The `/git` skill states that each prefix matches one template file. Every other list copies that set.
- **Prefix and commit type differ for bugs**: the branch prefix is `bug`. The commit type is `fix`. The issue states both values.
- **`agent` prefix**: `docs/contributing.md` lists `agent`. No template exists for `agent`. This plan removes `agent` from the list.
- **State management**: N/A. The change holds no runtime state.
- **Auth / scoping**: N/A.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | `holds exactly feat, bug, and task templates` | The sorted `.md` file list equals `["bug.md", "feat.md", "task.md"]`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `bug template follows the feat shape` | The `##` headings of `bug.md` equal `Metadata`, `Impact`, `Reproduction`, `Suspected Cause`, `Test Plan (TDD)`, `Acceptance Criteria`, in order. The Metadata block contains `bug/[issue#]-[shortdesc]`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `task template is thin` | The `##` headings of `task.md` equal `Metadata`, `Description`, `Done When`, in order. The Metadata block contains `task/[issue#]-[shortdesc]`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | existing two cases | The existing stale-token and stale-link checks stay green. |

Run the file with `npx vitest run .agro/scripts/__tests__/issue-templates.test.ts`. Run the full suite with `npm test`.

## Design Principles

- Change the fewest files that make the three-template rule true.
- Write the failing test cases before the template edits.
- Keep one prefix set. Copy the set from the template directory into each list.
- Keep new template prose in STE style.
- Add no comments to tracked code.

## Out of Scope

- Changes to `feat.md` and `.github/pull_request_template.md`.
- Changes to the `/audit` skill and the `/builder` skill, except the Step B-2 regex in `drift.md`.
- A GitHub issue-template `config.yml` file.
- GitHub label changes for the `audit` and `skill` labels.
- Edits to archived tasks, eval datasets, eval decisions, and past `CHANGELOG.md` entries.
- Changes to the public documentation site `mifunedev/agro-web`.

## Open Questions

1. Does `bug.md` keep the Environment fields (checkout, sandbox, agent runtime, command, host context)? This plan places the fields inside `## Reproduction`. The operator can drop the fields instead.
2. After this change, the drift check flags an old `fix/`, `audit/`, `skill/`, or `agent/` branch as unexpected. This plan accepts that result. The operator can keep the old prefixes in the drift regex instead.
3. Does `mifunedev/agro-web` mirror the prefix list from `docs/contributing.md`? If the site mirrors the list, the operator opens a matching change there.

## Acceptance Criteria

- [ ] `.github/ISSUE_TEMPLATE/` holds only `feat.md`, `bug.md`, `task.md`.
- [ ] The `/git` skill and `docs/contributing.md` list prefixes `feat` · `bug` · `task` and commit types `feat` · `fix` · `task`.
- [ ] `npx vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.
- [ ] `npm test` exits 0.
- [ ] `CHANGELOG.md` holds an entry for #1158 under `## [Unreleased]` → `### Changed`.
- [ ] The draft PR title reads `FROM task/1158-prune-issue-templates TO development`.

## Lessons

Filled by the advisor before undraft.
