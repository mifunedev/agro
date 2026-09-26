# PRD: Prune issue templates

Status: DRAFT

## User Stories

### US-001: Keep three issue templates, one per branch prefix

**Description:** As an operator, I want one issue template per branch prefix so that each issue maps to one prefix.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/issue-templates.test.ts` gains the cases in the Test Plan. The new cases fail against the current templates before the template edits.
- [ ] `ls .github/ISSUE_TEMPLATE` prints only `bug.md`, `feat.md`, and `task.md`.
- [ ] `.github/ISSUE_TEMPLATE/audit.md` and `.github/ISSUE_TEMPLATE/skill.md` do not exist.
- [ ] The `##` headings of `bug.md` are, in this order: `Metadata`, `Impact`, `Reproduction`, `Suspected Cause`, `Test Plan (TDD)`, `Acceptance Criteria`.
- [ ] The `Metadata` block of `bug.md` holds a `yml` fence with `pull_request_title: "FROM bug/[issue#]-[shortdesc] TO [target-branch]"` and `branch: "bug/[issue#]-[shortdesc]"`.
- [ ] Each checklist item under `## Acceptance Criteria` in `bug.md` is a binary check with a pass or fail outcome.
- [ ] The `##` headings of `task.md` are, in this order: `Metadata`, `Description`, `Done When`.
- [ ] The `Metadata` block of `task.md` holds a `yml` fence with `pull_request_title: "FROM task/[issue#]-[shortdesc] TO [target-branch]"` and `branch: "task/[issue#]-[shortdesc]"`.
- [ ] The frontmatter `title` of `bug.md` is `"bug: "`. The frontmatter `title` of `task.md` is `"task: "`.
- [ ] `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.

### US-002: Align the prefix and commit-type lists

**Description:** As an agent, I want all prefix and commit-type lists to agree so that my first choice is valid.

**Acceptance Criteria:**

- [ ] `.agro/skills/git/SKILL.md` § Issue Titles lists `<prefix>` ∈ `feat` · `bug` · `task`.
- [ ] `.agro/skills/git/SKILL.md` § Commit Messages lists `<type>` ∈ `feat` · `fix` · `task`.
- [ ] `docs/contributing.md` § Branch Naming lists `Prefixes: feat · bug · task`.
- [ ] `docs/contributing.md` § Commit Messages lists `Types: feat · fix · task`.
- [ ] `.agro/skills/prd/references/tracker.md` lists `--prefix <feat|bug|task>`, and its `branchName` `jq` check matches `^(feat|bug|task)/[0-9]+-[a-z0-9-]+$`.
- [ ] `.agro/skills/spec/references/plan.md` lists `[--prefix feat|bug|task]`.
- [ ] `git grep -nE 'feat\|bug\|task\|audit|task · audit|audit · skill' -- .agro/skills docs .github` prints no line.
- [ ] `CHANGELOG.md` holds one entry for this issue under `## [Unreleased]` → `### Changed`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/git/SKILL.md` reports no finding on a changed line.

## Summary

Verified current state:

- `.github/ISSUE_TEMPLATE/` holds five templates: `audit.md`, `bug.md`, `feat.md`, `skill.md`, `task.md`.
- `feat.md` opens with a `## Metadata` section. The section holds a `yml` fence with `pull_request_title` and `branch`. `feat.md` closes with binary `## Acceptance Criteria`.
- `bug.md` uses the sections `Description`, `Steps to Reproduce`, `Expected Behavior`, `Actual Behavior`, `Environment`, and `Acceptance Criteria`. Its title is `"[BUG] "`.
- `task.md` uses the sections `Description`, `Context`, and `Done When`. Its title is `"[TASK] "`.
- `.agro/skills/git/SKILL.md:36` lists the issue prefixes `feat` · `bug` · `task` · `audit` · `skill`. Line 37 ties each prefix to `.github/ISSUE_TEMPLATE/<prefix>.md`.
- `.agro/skills/git/SKILL.md:96` lists the commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `docs/contributing.md:107` lists the branch prefixes `feat` · `fix` · `task` · `audit` · `skill` · `agent`. This list disagrees with `/git`, which uses `bug`, not `fix`.
- `docs/contributing.md:131` lists the commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `.agro/skills/prd/references/tracker.md` and `.agro/skills/spec/references/plan.md` accept `--prefix feat|bug|task|audit|skill`.
- `.agro/scripts/__tests__/issue-templates.test.ts` checks two properties of each template: no stale stack tokens, and no link to `.claude/rules/git.md`. The test does not check the template set or the section order.
- `.claude/skills` is a symlink to `.agro/skills`. The canonical source for each skill edit is under `.agro/skills/`.

Selected approach:

1. Extend `issue-templates.test.ts` first. Assert the exact template set and the section order of `bug.md` and `task.md`.
2. Rewrite `bug.md` in the `feat.md` shape. Replace `task.md` with the thin template. Delete `audit.md` and `skill.md`.
3. Edit each prefix list and each commit-type list to the three values.
4. Add the changelog entry.

The branch prefix `bug` pairs with the commit type `fix`. The issue states both lists, so the plan keeps that pairing.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/ISSUE_TEMPLATE/bug.md` | whole file | Rewrite in the `feat.md` shape. |
| `.github/ISSUE_TEMPLATE/task.md` | whole file | Replace with Metadata, Description, Done When. |
| `.github/ISSUE_TEMPLATE/audit.md` | whole file | Delete. |
| `.github/ISSUE_TEMPLATE/skill.md` | whole file | Delete. |
| `.github/ISSUE_TEMPLATE/feat.md` | `## Metadata`, `## Acceptance Criteria` | Reference shape. No change. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `describe("GitHub issue templates")` | Add the template-set and section-order cases. |
| `.agro/skills/git/SKILL.md` | § Issue Titles, § Commit Messages | Set the prefix list and the commit-type list. |
| `docs/contributing.md` | § Branch Naming, § Commit Messages | Set the prefix list and the commit-type list. |
| `.agro/skills/prd/references/tracker.md` | § Inputs, § Verification | Set the `--prefix` values and the `branchName` regex. |
| `.agro/skills/spec/references/plan.md` | usage line 5 | Set the `--prefix` values. |
| `CHANGELOG.md` | `## [Unreleased]` → `### Changed` | Add one entry. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub "New issue" template chooser | Modify | The chooser offers Feature Request, Bug Report, and Task. Audit and Skill leave the chooser. |
| `/git` skill | Modify | Issue prefixes `feat` · `bug` · `task`. Commit types `feat` · `fix` · `task`. |
| `docs/contributing.md` | Modify | Same lists as `/git`. |
| `/prd` tracker and `/spec plan` `--prefix` | Modify | Accept `feat`, `bug`, and `task` only. |
| `mifunedev/agro-web` | Unknown | See Open Question 2. |

## Storage

N/A. The change edits Markdown templates, documentation, and one test. No component persists state.

## Architectural Decisions

- **Source of truth**: `.github/ISSUE_TEMPLATE/` defines the set of issue prefixes. `/git` § Issue Titles names that set, and each other list copies `/git`.
- **Canonical surface**: Edit skills under `.agro/skills/`. Do not edit `.claude/skills/`, which is a symlink.
- **Title format**: `bug.md` and `task.md` use the `/git` title format `<prefix>: `, as `feat.md` does with `"feat: "`.
- **Bug environment fields**: The current `## Environment` fields (checkout, sandbox, agent runtime, command, host context) move into `## Reproduction`. The issue names no `Environment` section.
- **Labels**: `bug.md` keeps `labels: bug`. `task.md` keeps `labels: task`. The plan does not delete the `audit` or `skill` GitHub labels.
- **Auth / scoping**: N/A.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | `holds exactly feat, bug, and task templates` | The sorted `.md` names equal `["bug.md", "feat.md", "task.md"]`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `bug template follows the feat shape` | The `##` headings of `bug.md` equal the ordered list in US-001, and the `branch:` line starts with `bug/`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `task template is thin` | The `##` headings of `task.md` equal `Metadata`, `Description`, `Done When`, and the `branch:` line starts with `task/`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `titles use the /git prefix format` | Each frontmatter `title` equals `"<basename>: "`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | existing two cases | No regression. |

Run: `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts`, then `pnpm test`.

## Design Principles

- Keep one template for each branch prefix. Delete the obsolete templates. Do not keep them as dormant alternatives.
- Keep one source of truth for the prefix set. Every list copies `/git`.
- Write the failing test before the template edits.
- Add no explanatory comments to tracked code.
- Apply `/ste` to each changed prose line.

## Out of Scope

- The `.agro/skills/audit/references/drift.md` branch regex `^(feat|fix|task|audit|skill|agent)/`. That regex classifies existing branches. See Open Question 1.
- Deletion or rename of GitHub labels.
- Changes to `feat.md` and `.github/pull_request_template.md`.
- Rename of existing branches, issues, or archived tasks under `.agro/tasks/archive/`.
- Historical records in `.agro/evals/decisions/` and past `CHANGELOG.md` releases.

## Open Questions

1. Must the `drift.md` branch regex narrow to `^(feat|bug|task)/`? The narrow regex flags open `fix/`, `audit/`, `skill/`, and `agent/` branches as unexpected. The plan leaves the regex unchanged.
2. Does `mifunedev/agro-web` publish the prefix list or the commit-type list? If yes, the site needs a matching change in a separate PR.

## Acceptance Criteria

- [ ] `.github/ISSUE_TEMPLATE/` holds only `feat.md`, `bug.md`, and `task.md`.
- [ ] `/git` and `docs/contributing.md` list the prefixes `feat` · `bug` · `task` and the commit types `feat` · `fix` · `task`.
- [ ] `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` → `### Changed` that links the issue.
- [ ] `git diff --stat` shows no change under `.claude/`.

## Lessons

Filled by the advisor before undraft.
