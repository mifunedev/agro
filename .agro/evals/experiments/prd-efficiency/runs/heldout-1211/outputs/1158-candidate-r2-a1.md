# PRD: Prune issue templates to feat, bug, and task

Status: DRAFT

## User Stories

### US-001: Keep three issue templates in the feat shape

**Description:** As an operator, I want one issue template per branch prefix so that each issue maps to one branch prefix and one plan shape.

**Acceptance Criteria:**

- [ ] Red first: a new case in `.agro/scripts/__tests__/issue-templates.test.ts` asserts that `.github/ISSUE_TEMPLATE/` holds exactly `bug.md`, `feat.md`, and `task.md`. The case fails before the deletions.
- [ ] `.github/ISSUE_TEMPLATE/audit.md` and `.github/ISSUE_TEMPLATE/skill.md` do not exist.
- [ ] A test case asserts that the `##` headings of `bug.md` are, in order: `Metadata`, `Impact`, `Reproduction`, `Suspected Cause`, `Test Plan (TDD)`, `Acceptance Criteria`.
- [ ] The `bug.md` Metadata block holds a `yml` fence with `pull_request_title: "FROM bug/[issue#]-[shortdesc] TO [target-branch]"` and `branch: "bug/[issue#]-[shortdesc]"`.
- [ ] The `bug.md` Test Plan (TDD) section holds a `| Test File | Case(s) | Validates |` table, and its Acceptance Criteria section holds `- [ ]` items.
- [ ] A test case asserts that the `##` headings of `task.md` are, in order: `Metadata`, `Description`, `Done When`.
- [ ] The `task.md` Metadata block holds a `yml` fence with `pull_request_title: "FROM task/[issue#]-[shortdesc] TO [target-branch]"` and `branch: "task/[issue#]-[shortdesc]"`.
- [ ] The frontmatter `title` of `bug.md` is `"bug: "`, and the frontmatter `title` of `task.md` is `"task: "`.
- [ ] `pnpm test` exits 0.

### US-002: Align the prefix and commit-type lists

**Description:** As an agent, I want every prefix and commit-type list to match the three templates so that no procedure creates an `audit/` or `skill/` branch.

**Acceptance Criteria:**

- [ ] Red first: a new case in `.agro/scripts/__tests__/issue-templates.test.ts` reads `.agro/skills/git/SKILL.md` and `docs/contributing.md`. The case asserts the prefix list `feat` · `bug` · `task` and the type list `feat` · `fix` · `task`. The case fails before the edits.
- [ ] `.agro/skills/git/SKILL.md` line 36 lists `feat` · `bug` · `task` as the issue prefixes.
- [ ] `.agro/skills/git/SKILL.md` line 96 lists `feat` · `fix` · `task` as the commit types.
- [ ] `docs/contributing.md` line 107 lists `feat` · `bug` · `task` as the branch prefixes.
- [ ] `docs/contributing.md` line 127 lists `feat` · `fix` · `task` as the commit types.
- [ ] `.agro/skills/prd/references/tracker.md` accepts `--prefix <feat|bug|task>`, and its `branchName` jq check uses the regex `^(feat|bug|task)/[0-9]+-[a-z0-9-]+$`.
- [ ] `.agro/skills/spec/references/plan.md` line 5 shows `--prefix feat|bug|task`.
- [ ] `git grep -n -E 'feat\|bug\|task\|audit|task · audit' -- .agro/skills docs` prints no line.
- [ ] `CHANGELOG.md` holds one entry under `## [Unreleased]` › `### Changed` that links `#1158`.
- [ ] `pnpm test` exits 0.

## Summary

The issue is `work/issue-1158.md`. The operator wants three issue templates, one per branch prefix: `feat`, `bug`, and `task`.

Verified current state:

- `.github/ISSUE_TEMPLATE/` holds five files: `audit.md`, `bug.md`, `feat.md`, `skill.md`, `task.md`.
- `feat.md` opens with a `## Metadata` section that holds a `yml` fence with `pull_request_title` and `branch`. Its title is `"feat: "`.
- `bug.md` uses the old shape: Description, Steps to Reproduce, Expected Behavior, Actual Behavior, Environment, Acceptance Criteria. Its title is `"[BUG] "`.
- `task.md` holds Description, Context, and Done When. Its title is `"[TASK] "`.
- `.agro/skills/git/SKILL.md:36` lists five issue prefixes, and line 37 ties each prefix to `.github/ISSUE_TEMPLATE/<prefix>.md`.
- `.agro/skills/git/SKILL.md:96` lists five commit types, including `audit` and `skill`.
- `docs/contributing.md:107` lists six prefixes, including `fix` and `agent`. `docs/contributing.md:127` lists five commit types.
- `.agro/skills/prd/references/tracker.md` and `.agro/skills/spec/references/plan.md:5` accept `audit` and `skill` as branch prefixes.
- `.agro/scripts/__tests__/issue-templates.test.ts` checks two properties for each template: no stale stack tokens and no link to `.claude/rules/git.md`.

Selected approach: delete two templates, rewrite two templates, and add test cases that pin the template set, the heading order, and the prefix lists. The `bug` prefix pairs with the `fix` commit type. The `/git` skill already uses that pair.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/ISSUE_TEMPLATE/bug.md` | frontmatter, `## Metadata` … `## Acceptance Criteria` | Rewrite in the feat shape. |
| `.github/ISSUE_TEMPLATE/task.md` | frontmatter, `## Metadata`, `## Description`, `## Done When` | Replace with a thin template. |
| `.github/ISSUE_TEMPLATE/audit.md` | whole file | Delete. |
| `.github/ISSUE_TEMPLATE/skill.md` | whole file | Delete. |
| `.github/ISSUE_TEMPLATE/feat.md` | `## Metadata` block | Reference shape. No change. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `templateFiles`, `describe("GitHub issue templates")` | Add the set, heading, and prefix cases. |
| `.agro/skills/git/SKILL.md` | lines 36 and 96 | Prefix and commit-type lists. |
| `docs/contributing.md` | lines 107 and 127 | Prefix and commit-type lists. |
| `.agro/skills/prd/references/tracker.md` | `--prefix` input, `branchName` jq check | Prefix list and regex. |
| `.agro/skills/spec/references/plan.md` | line 5 usage | Prefix list. |
| `CHANGELOG.md` | `## [Unreleased]` › `### Changed` | Changelog entry. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub "New issue" chooser | Modify | The chooser offers Feature Request, Bug Report, and Task. Audit and Skill leave the chooser. |
| Issue title prefix | Modify | Bug and task titles change from `[BUG] ` and `[TASK] ` to `bug: ` and `task: `. |
| `/prd` tracker `--prefix` | Modify | The argument accepts `feat`, `bug`, and `task`. |
| `/spec plan` `--prefix` | Modify | The argument accepts `feat`, `bug`, and `task`. |

## Storage

N/A. The change edits Markdown templates, documentation, and one test file. The change stores no state.

## Architectural Decisions

- The template directory is the source of truth for the prefix set. `.agro/skills/git/SKILL.md:37` already states the mapping from prefix to template file.
- The test file pins the template set and the prefix lists. A later drift then fails `pnpm test`.
- `.claude/skills/` resolves to `.agro/skills/` through symlinks. Edit only the `.agro/` source.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | "holds only feat, bug, and task" | The directory holds exactly `bug.md`, `feat.md`, `task.md`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | "bug template follows the feat shape" | The `##` heading order of `bug.md` and its `bug/` Metadata branch. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | "task template is thin" | The `##` heading order of `task.md` and its `task/` Metadata branch. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | "prefix and type lists match the templates" | The lists at `.agro/skills/git/SKILL.md` and `docs/contributing.md`. |
| `.agro/scripts/__tests__/issue-templates.test.ts` | existing two cases | No stale stack tokens and no stale git-rule link in the remaining templates. |

Run `pnpm test` from the repository root inside the sandbox. Archived task evidence at `.agro/tasks/archive/2026-09-10/sandbox-registry/progress.txt:7` records `pnpm test` as the suite command.

## Design Principles

- Keep one source of truth: the template directory defines the prefix set.
- Delete obsolete templates. Do not keep a dormant alternative.
- Add no explanatory comments to tracked code.
- Keep the edit small: touch only the files that list the prefixes.

## Out of Scope

- Changes to `.github/ISSUE_TEMPLATE/feat.md`.
- Changes to the `/audit` skill or the `/builder` skill.
- Changes to the pull request template.
- Relabeling or retitling existing GitHub issues.
- Public documentation in `mifunedev/agro-web`, unless Open Question 2 adds it.

## Open Questions

1. `.agro/skills/audit/references/drift.md:109` and line 116 accept the branch regex `^(feat|fix|task|audit|skill|agent)/`. Existing branches can carry the `fix`, `audit`, `skill`, or `agent` prefix. Does this task narrow that regex, or does the regex stay as is? The plan leaves the regex unchanged.
2. Does `mifunedev/agro-web` document the issue templates or the branch prefixes? If yes, that repository needs a matching change.
3. Which GitHub label does `task.md` keep? The plan keeps the current label `task`. `bug.md` keeps the label `bug`.

## Acceptance Criteria

- [ ] `ls .github/ISSUE_TEMPLATE` prints exactly `bug.md`, `feat.md`, `task.md`.
- [ ] `.agro/skills/git/SKILL.md` and `docs/contributing.md` list the prefixes `feat` · `bug` · `task` and the commit types `feat` · `fix` · `task`.
- [ ] `pnpm test` exits 0, and `.agro/scripts/__tests__/issue-templates.test.ts` passes.
- [ ] `CHANGELOG.md` holds one entry for `#1158` under `## [Unreleased]` › `### Changed`.

## Lessons

Filled by the advisor before undraft.
