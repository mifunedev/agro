# PRD: Prune issue templates to feat, bug, and task

Status: DRAFT

## User Stories

### US-001: Reduce the issue templates to three

**Description:** As an operator, I want one issue template per branch prefix so that each issue maps to one prefix and one shape.

**Acceptance Criteria:**

- [ ] `.agro/scripts/__tests__/issue-templates.test.ts` holds the new cases in the Test Plan, and each new case fails before the template change.
- [ ] `ls .github/ISSUE_TEMPLATE/` prints only `bug.md`, `feat.md`, and `task.md`.
- [ ] `.github/ISSUE_TEMPLATE/audit.md` and `.github/ISSUE_TEMPLATE/skill.md` do not exist.
- [ ] `bug.md` holds these `##` headings in this order: `Metadata`, `Impact`, `Reproduction`, `Suspected Cause`, `Test Plan (TDD)`, `Acceptance Criteria`.
- [ ] `bug.md` Metadata holds `branch: "bug/[issue#]-[shortdesc]"` and `pull_request_title: "FROM bug/[issue#]-[shortdesc] TO [target-branch]"`.
- [ ] `bug.md` Acceptance Criteria holds only `- [ ]` checklist items.
- [ ] `task.md` holds these `##` headings in this order: `Metadata`, `Description`, `Done When`.
- [ ] `task.md` Metadata holds `branch: "task/[issue#]-[shortdesc]"` and `pull_request_title: "FROM task/[issue#]-[shortdesc] TO [target-branch]"`.
- [ ] The frontmatter `title` of each template equals `"<prefix>: "`, where `<prefix>` is the file name without `.md`.
- [ ] `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.

### US-002: Align the prefix and commit-type lists

**Description:** As an agent, I want all prefix and commit-type lists to match so that the `/git` skill, `docs/contributing.md`, and task tools agree.

**Acceptance Criteria:**

- [ ] `.agro/skills/git/SKILL.md` § Issue Titles lists `<prefix>` ∈ `feat` · `bug` · `task`.
- [ ] `.agro/skills/git/SKILL.md` § Commit Messages lists `<type>` ∈ `feat` · `fix` · `task`.
- [ ] `docs/contributing.md` § Branch Naming lists `Prefixes: feat · bug · task`.
- [ ] `docs/contributing.md` § Commit Messages lists `Types: feat · fix · task`.
- [ ] `.agro/skills/prd/references/tracker.md` documents `--prefix <feat|bug|task>`, and its `branchName` `jq` check uses `^(feat|bug|task)/[0-9]+-[a-z0-9-]+$`.
- [ ] `.agro/skills/spec/references/plan.md` documents `--prefix feat|bug|task`.
- [ ] `.worktrees/AGENTS.md` lists the branch worktree subfolders `feat/` `bug/` `task/`.
- [ ] `.agro/skills/audit/references/drift.md` Step B-2 uses the regex `^(feat|bug|task|agent)/` in the prose and in the shell block.
- [ ] `grep -nE 'audit[|]skill|audit.{0,4} · .{0,4}skill|audit/. .skill/' .agro/skills/git/SKILL.md docs/contributing.md .agro/skills/prd/references/tracker.md .agro/skills/spec/references/plan.md .worktrees/AGENTS.md .agro/skills/audit/references/drift.md` prints no line.
- [ ] `CHANGELOG.md` `## [Unreleased]` `### Changed` holds one entry for this task that links [#1158](https://github.com/mifunedev/agro/issues/1158).
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

## Summary

Verified current state:

- `.github/ISSUE_TEMPLATE/` holds five templates: `audit.md`, `bug.md`, `feat.md`, `skill.md`, `task.md`.
- `feat.md` is the reference shape. It opens with a `## Metadata` YAML block that holds `pull_request_title` and `branch`, and it closes with binary `## Acceptance Criteria`.
- `bug.md` uses a free-form shape: Description, Steps to Reproduce, Expected Behavior, Actual Behavior, Environment, Acceptance Criteria. Its title is `"[BUG] "`.
- `task.md` holds Description, Context, and Done When. Its title is `"[TASK] "`.
- `.agro/skills/git/SKILL.md:36` lists issue prefixes `feat` · `bug` · `task` · `audit` · `skill`. Line 96 lists commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `docs/contributing.md:107` lists branch prefixes `feat` · `fix` · `task` · `audit` · `skill` · `agent`. This list uses `fix` where the `/git` skill uses `bug`. Line 127 lists commit types `feat` · `fix` · `task` · `audit` · `skill`.
- Four more files carry the same stale prefix list: `.agro/skills/prd/references/tracker.md`, `.agro/skills/spec/references/plan.md:5`, `.worktrees/AGENTS.md:12`, and `.agro/skills/audit/references/drift.md:109-119`.
- The drift regex `^(feat|fix|task|audit|skill|agent)/` omits `bug`. The drift check reports a `bug/` branch as UNEXPECTED today.
- `.agro/scripts/__tests__/issue-templates.test.ts` scans every template for stale tokens. The test does not check the file set or the section shape.
- `.claude/skills` is a symlink to `.agro/skills`. The canonical files live under `.agro/skills/`.
- No local branch uses the `audit/` or `skill/` prefix.
- Git marks `.agro/skills/prd/references/tracker.md` as skip-worktree. `git grep` does not scan this file, so the verification uses plain `grep`.

Selected approach:

1. Extend the test.
2. Rewrite `bug.md` and `task.md`.
3. Delete `audit.md` and `skill.md`.
4. Replace each stale prefix list with the three prefixes.
5. Replace each stale commit-type list with the three types.

Keep `fix` as the commit type for a bug fix, as the issue states. Keep `agent/` in the drift regex and in `.worktrees/AGENTS.md`, because per-agent branches use `agent/<name>` and no issue backs them.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/ISSUE_TEMPLATE/bug.md` | whole file | Rewrite in the `feat.md` shape. |
| `.github/ISSUE_TEMPLATE/task.md` | whole file | Replace with Metadata, Description, Done When. |
| `.github/ISSUE_TEMPLATE/audit.md` | whole file | Delete. |
| `.github/ISSUE_TEMPLATE/skill.md` | whole file | Delete. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `describe("GitHub issue templates")` | Add file-set, heading-order, metadata, and title cases. |
| `.agro/skills/git/SKILL.md` | § Issue Titles, § Commit Messages | Canonical prefix and commit-type lists. |
| `docs/contributing.md` | § Branch Naming, § Commit Messages | Contributor-facing copy of the lists. |
| `.agro/skills/prd/references/tracker.md` | `--prefix` input, `branchName` `jq` check | Prefix list for `prd.json` conversion. |
| `.agro/skills/spec/references/plan.md` | usage line 5 | Prefix list for `/spec plan`. |
| `.worktrees/AGENTS.md` | subfolder table | Worktree subfolders per prefix. |
| `.agro/skills/audit/references/drift.md` | Step B-2 | Work-branch regex. |
| `CHANGELOG.md` | `## [Unreleased]` `### Changed` | Release note. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub "New issue" template chooser | Modify | The chooser offers Feature Request, Bug Report, and Task only. |
| `.github/ISSUE_TEMPLATE/bug.md` | Modify | New section shape and title `"bug: "`. |
| `.github/ISSUE_TEMPLATE/task.md` | Modify | New section shape and title `"task: "`. |
| `/git` skill | Modify | Prefix list and commit-type list. |
| `docs/contributing.md` | Modify | Prefix list and commit-type list. |
| `/prd` tracker and `/spec plan` | Modify | `--prefix` accepts `feat`, `bug`, or `task`. |
| `/audit drift` | Modify | A `bug/` branch reads as a work branch. |

## Storage

N/A. The task changes Markdown templates, documentation, and one test. The task persists no data.

## Architectural Decisions

- **Source of truth**: `.agro/skills/git/SKILL.md` owns the prefix list and the commit-type list. Each other file copies the two lists from the `/git` skill.
- **Template-to-prefix map**: each template file name equals its branch prefix. The `/git` skill already states this rule at line 37.
- **Commit type for a bug**: the commit type stays `fix`. The branch prefix and the issue prefix stay `bug`.
- **State management**: none.
- **Auth / scoping**: N/A.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | `holds only feat, bug, and task templates` | The sorted `.md` file set equals `["bug.md", "feat.md", "task.md"]`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `bug template follows the feat shape` | `bug.md` `##` headings equal `Metadata`, `Impact`, `Reproduction`, `Suspected Cause`, `Test Plan (TDD)`, `Acceptance Criteria`, in order. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `task template stays thin` | `task.md` `##` headings equal `Metadata`, `Description`, `Done When`, in order. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `metadata branch matches the file prefix` | Each template Metadata holds `branch: "<prefix>/[issue#]-[shortdesc]"`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `title matches the file prefix` | Each template frontmatter `title` equals `"<prefix>: "`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | existing two cases | Stale stack tokens and the stale `.claude/rules/git.md` link stay absent. |

Run: `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts`.
Run the full suite with `pnpm test` before the PR.

## Design Principles

- Simplicity is beauty, complexity is pain.
- Make the smallest change that reaches the goal.
- Write the failing test before the template change.
- Keep one source of truth: the `/git` skill owns the lists.
- Edit the canonical `.agro/skills/` files. Do not edit `.claude/skills/`, because `.claude/skills/` is a symlink.
- Delete obsolete templates. Do not keep a dormant alternative.
- Add no code comments to tracked code.

## Out of Scope

- Changes to `feat.md`.
- Changes to `.github/pull_request_template.md`.
- Changes to the `/audit` skill behavior other than the Step B-2 regex.
- A rename of existing remote branches or closed issues.
- Edits to `.agro/tasks/archive/`, `.agro/evals/decisions/`, or released `CHANGELOG.md` sections.
- Changes to `mifunedev/agro-web`. Open Question 1 covers this surface.

## Open Questions

1. Does `mifunedev/agro-web` publish a copy of the prefix list or the template list? If yes, the operator opens a matching issue in `mifunedev/agro-web`.
2. Does the operator accept the four scope additions beyond the issue text: `tracker.md`, `plan.md`, `.worktrees/AGENTS.md`, and the `drift.md` regex? The plan includes them, because each file carries the same stale list.
3. Does `docs/contributing.md` need a separate line for `agent/<name>` branches after `agent` leaves the prefix list? The plan adds no line, because `.worktrees/AGENTS.md` documents `agent/` branches.

## Acceptance Criteria

- [ ] `.github/ISSUE_TEMPLATE/` holds only `feat.md`, `bug.md`, and `task.md`.
- [ ] The `/git` skill and `docs/contributing.md` list prefixes `feat` · `bug` · `task` and commit types `feat` · `fix` · `task`.
- [ ] `pnpm vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` `### Changed` for #1158.
- [ ] Draft PR opened: `FROM task/1158-prune-issue-templates TO development`.

## Lessons

Filled by the advisor before undraft.
