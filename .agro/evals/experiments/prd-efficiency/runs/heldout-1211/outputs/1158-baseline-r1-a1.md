# PRD: Prune issue templates to feat, bug, and task

Status: DRAFT

## User Stories

### US-001: Rewrite the bug template in the feature template shape

**Description:** As an operator, I want `bug.md` to follow the `feat.md` shape so that an agent can fix a bug from the issue body alone.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/issue-templates.test.ts` holds a case that asserts the `bug.md` headings, and the case fails before the template change.
- [ ] `.github/ISSUE_TEMPLATE/bug.md` holds these `##` headings in this order: `Metadata`, `Impact`, `Reproduction`, `Suspected Cause`, `Test Plan (TDD)`, `Acceptance Criteria`.
- [ ] The `Metadata` block of `bug.md` holds `branch: "bug/[issue#]-[shortdesc]"` and `pull_request_title: "FROM bug/[issue#]-[shortdesc] TO [target-branch]"`.
- [ ] The frontmatter `title` of `bug.md` is `"bug: "`.
- [ ] Each checklist item under `## Acceptance Criteria` in `bug.md` names a binary check.
- [ ] `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.

### US-002: Replace the task template and delete the audit and skill templates

**Description:** As an operator, I want exactly one issue template for each branch prefix so that the template set matches the branch conventions.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/issue-templates.test.ts` holds a case that asserts the template set is exactly `bug.md`, `feat.md`, `task.md`. The case fails before the deletions.
- [ ] `.agro/scripts/__tests__/issue-templates.test.ts` holds a case that asserts the `task.md` headings, and the case fails before the template change.
- [ ] `.github/ISSUE_TEMPLATE/task.md` holds these `##` headings in this order: `Metadata`, `Description`, `Done When`.
- [ ] The `Metadata` block of `task.md` holds `branch: "task/[issue#]-[shortdesc]"` and `pull_request_title: "FROM task/[issue#]-[shortdesc] TO [target-branch]"`.
- [ ] The frontmatter `title` of `task.md` is `"task: "`.
- [ ] `.github/ISSUE_TEMPLATE/audit.md` and `.github/ISSUE_TEMPLATE/skill.md` do not exist.
- [ ] `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.

### US-003: Align the prefix and commit-type lists

**Description:** As an agent, I want one prefix list and one commit-type list across the git documents so that branch, issue, and commit names match.

**Acceptance Criteria:**

- [ ] `.agro/skills/git/SKILL.md` § Issue Titles lists the prefixes `feat` · `bug` · `task`.
- [ ] `.agro/skills/git/SKILL.md` § Commit Messages lists the types `feat` · `fix` · `task`.
- [ ] `docs/contributing.md` § Branch Naming lists the prefixes `feat` · `bug` · `task`.
- [ ] `docs/contributing.md` § Commit Messages lists the types `feat` · `fix` · `task`.
- [ ] The `--prefix` value list in `.agro/skills/prd/references/tracker.md` is `feat|bug|task`, and the `branchName` regex in its Verification block is `^(feat|bug|task)/[0-9]+-[a-z0-9-]+$`.
- [ ] The `--prefix` value list in `.agro/skills/spec/references/plan.md` is `feat|bug|task`.
- [ ] `git grep -nE "audit\|skill|\` · \`audit\` · \`skill" -- .agro/skills/git .agro/skills/prd .agro/skills/spec docs/contributing.md` prints no line.
- [ ] `CHANGELOG.md` holds one entry for this change under `## [Unreleased]` → `### Changed`. The entry links the issue.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

## Summary

Issue #1158 reduces the issue templates to three, one for each branch prefix.

Verified current state:

- `.github/ISSUE_TEMPLATE/` holds five templates: `audit.md`, `bug.md`, `feat.md`, `skill.md`, `task.md`.
- `feat.md` opens with a `Metadata` YAML block that names the branch and the PR title. `bug.md` and `task.md` have no `Metadata` block.
- `bug.md` uses the title `"[BUG] "`. `task.md` uses `"[TASK] "`. `.agro/skills/git/SKILL.md` § Issue Titles requires the form `<prefix>: <shortdesc>`.
- `.agro/skills/git/SKILL.md` lists the issue prefixes `feat` · `bug` · `task` · `audit` · `skill` and the commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `docs/contributing.md` lists the branch prefixes `feat` · `fix` · `task` · `audit` · `skill` · `agent`. This prefix list disagrees with the `/git` skill on `fix` and `bug`.
- `docs/contributing.md` lists the commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `.agro/skills/prd/references/tracker.md` and `.agro/skills/spec/references/plan.md` accept `--prefix feat|bug|task|audit|skill`.
- `.agro/scripts/__tests__/issue-templates.test.ts` checks two things: no stale stack tokens, and no link to `.claude/rules/git.md`. The test does not check the template set or the headings.

Selected approach: extend the existing test first, then change the templates, then align each prefix list. The branch prefix for a bug is `bug`. The commit type for a bug fix is `fix`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/ISSUE_TEMPLATE/bug.md` | whole file | Rewritten bug template |
| `.github/ISSUE_TEMPLATE/task.md` | whole file | Replaced thin task template |
| `.github/ISSUE_TEMPLATE/audit.md` | whole file | Deleted |
| `.github/ISSUE_TEMPLATE/skill.md` | whole file | Deleted |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `describe("GitHub issue templates")` | Contract for the template set and headings |
| `.agro/skills/git/SKILL.md` | § Issue Titles, § Commit Messages | Canonical prefix and commit-type lists |
| `docs/contributing.md` | § Branch Naming, § Commit Messages | Contributor-facing lists |
| `.agro/skills/prd/references/tracker.md` | `--prefix`, Verification regex | Accepted branch prefixes for `prd.json` |
| `.agro/skills/spec/references/plan.md` | argument form, `--prefix` | Accepted branch prefixes for `/spec plan` |
| `CHANGELOG.md` | `## [Unreleased]` → `### Changed` | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub "New issue" template chooser | Modify | Shows Feature Request, Bug Report, and Task only |
| `.github/ISSUE_TEMPLATE/bug.md` | Modify | New sections and `bug:` title |
| `.github/ISSUE_TEMPLATE/task.md` | Modify | Thin template with `task:` title |
| `/prd` tracker `--prefix` | Modify | Accepts `feat`, `bug`, `task` only |
| `/spec plan --prefix` | Modify | Accepts `feat`, `bug`, `task` only |
| `docs/contributing.md` | Modify | New prefix and commit-type lists |

## Storage

N/A. The change edits Markdown templates and documentation. The change stores no data.

## Architectural Decisions

- **Source of truth**: `.github/ISSUE_TEMPLATE/<prefix>.md` defines the prefix set. `.agro/skills/git/SKILL.md` states the prefix set and the commit-type set. Every other list copies these two sets.
- **Prefix and type split**: the branch and issue prefix for a bug is `bug`. The commit type for a bug fix is `fix`. The other two values match: `feat` and `task`.
- **Canonical edits**: edit `.agro/skills/...` only. `.claude/skills` is a symlink to `.agro/skills`.
- **State management**: none.
- **Auth / scoping**: N/A.
- **Execution location**: the application agent edits and tests inside the sandbox worktree for `task/<N>-prune-issue-templates`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | `holds exactly the feat, bug, and task templates` | Template set equals `bug.md`, `feat.md`, `task.md` |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `bug template follows the feature shape` | `bug.md` headings in order, `bug/` Metadata branch, `bug: ` title |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `task template is thin` | `task.md` headings in order, `task/` Metadata branch, `task: ` title |
| `.agro/scripts/__tests__/issue-templates.test.ts` | existing cases | No stale stack tokens, no stale git rule link |

Run the suite with `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts`. Write each new case before the template change, and confirm that the case fails first.

## Design Principles

- Simplicity is beauty, complexity is pain.
- Make the smallest change that satisfies the issue.
- Write the failing test before the template change.
- Delete obsolete templates. Do not keep a dormant alternative.
- Keep one source of truth for each list. Copy the list from `.agro/skills/git/SKILL.md`.
- Add no explanatory comments to tracked code.

## Out of Scope

- `feat.md` content changes.
- `.github/pull_request_template.md`.
- The branch regex in `.agro/skills/audit/references/drift.md`. See Open Question 1.
- Relabeling or retitling open GitHub issues that use the `audit` or `skill` labels.
- The `/audit` skill and the skill-authoring procedure in `/builder`.

## Open Questions

1. `.agro/skills/audit/references/drift.md` accepts work branches that match `^(feat|fix|task|audit|skill|agent)/`. Does this task align that regex to `^(feat|bug|task)/`? The default is no, because existing `fix/`, `audit/`, `skill/`, and `agent/` branches would then report as unexpected.
2. The current `bug.md` has an `Environment` section. Does that content move into `Reproduction`? The default is yes: `Reproduction` keeps the checkout, sandbox, agent runtime, command, and host fields.
3. Does `mifunedev/agro-web` publish the prefix or commit-type lists? If so, that repository needs a matching change.

## Acceptance Criteria

- [ ] `ls .github/ISSUE_TEMPLATE/` prints only `bug.md`, `feat.md`, `task.md`.
- [ ] `.agro/skills/git/SKILL.md` and `docs/contributing.md` list the prefixes `feat` · `bug` · `task` and the commit types `feat` · `fix` · `task`.
- [ ] `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.
- [ ] `CHANGELOG.md` holds an entry for this change under `## [Unreleased]` → `### Changed`.
- [ ] Draft PR opened: `FROM task/<N>-prune-issue-templates TO development`.

## Lessons

Filled by the advisor before undraft.
