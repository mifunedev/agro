# PRD: Prune issue templates

Status: DRAFT

## User Stories

### US-001: Lock the template set in the test

**Description:** As an operator, I want `issue-templates.test.ts` to fail on a stray template or a missing section so that the three-template contract cannot drift.

**Acceptance Criteria:**

- [ ] `issue-templates.test.ts` asserts that `.github/ISSUE_TEMPLATE/` holds exactly `bug.md`, `feat.md`, and `task.md`.
- [ ] `issue-templates.test.ts` asserts that `bug.md` holds the headings `## Metadata`, `## Impact`, `## Reproduction`, `## Suspected Cause`, `## Test Plan (TDD)`, and `## Acceptance Criteria`, in that order.
- [ ] `issue-templates.test.ts` asserts that `task.md` holds the headings `## Metadata`, `## Description`, and `## Done When`, in that order.
- [ ] `issue-templates.test.ts` asserts that the `branch:` line in each template starts with the prefix that matches the file name.
- [ ] `issue-templates.test.ts` asserts that `.agro/skills/git/SKILL.md` and `docs/contributing.md` list the prefixes `feat` · `bug` · `task` and the commit types `feat` · `fix` · `task`.
- [ ] Before US-002 and US-003 land, `pnpm exec vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 1 on the new cases.
- [ ] The two existing cases stay in the file unchanged.

### US-002: Reshape the templates

**Description:** As an issue author, I want one template for each branch prefix so that my template choice sets the branch prefix.

**Acceptance Criteria:**

- [ ] `bug.md` follows the `feat.md` shape: frontmatter, `## Metadata`, `## Impact`, `## Reproduction`, `## Suspected Cause`, `## Test Plan (TDD)`, and `## Acceptance Criteria`.
- [ ] The `## Metadata` block in `bug.md` holds `pull_request_title: "FROM bug/[issue#]-[shortdesc] TO [target-branch]"` and `branch: "bug/[issue#]-[shortdesc]"`.
- [ ] Each checkbox under `## Acceptance Criteria` in `bug.md` states a pass or fail check.
- [ ] `task.md` holds frontmatter, `## Metadata`, `## Description`, and `## Done When`, and no other `##` section.
- [ ] The `## Metadata` block in `task.md` holds `branch: "task/[issue#]-[shortdesc]"`.
- [ ] The frontmatter `title` is `"bug: "` in `bug.md` and `"task: "` in `task.md`.
- [ ] `.github/ISSUE_TEMPLATE/audit.md` and `.github/ISSUE_TEMPLATE/skill.md` do not exist.
- [ ] The two existing test cases pass: no template contains `Next.js`, `PostgreSQL`, `- **Browser**`, or `.claude/rules/git.md`.

### US-003: Align the prefix and commit-type lists

**Description:** As a contributor, I want the `/git` skill and `docs/contributing.md` to list the three prefixes so that names match the templates.

**Acceptance Criteria:**

- [ ] `.agro/skills/git/SKILL.md` § Issue Titles lists `<prefix>` ∈ `feat` · `bug` · `task`.
- [ ] `.agro/skills/git/SKILL.md` § Commit Messages lists `<type>` ∈ `feat` · `fix` · `task`.
- [ ] `docs/contributing.md` § Branch Naming lists the prefixes `feat` · `bug` · `task`.
- [ ] `docs/contributing.md` § Commit Messages lists the types `feat` · `fix` · `task`.
- [ ] `CHANGELOG.md` holds one entry for this issue under `## [Unreleased]` → `### Changed`.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.

## Summary

The issue asks for three issue templates, one for each branch prefix: `feat`, `bug`, and `task`.

Verified current state:

- `.github/ISSUE_TEMPLATE/` holds five templates: `audit.md`, `bug.md`, `feat.md`, `skill.md`, and `task.md`. No `config.yml` exists.
- `feat.md` is the reference shape. The shape is frontmatter, `## Metadata` with a `yml` block, then content sections, and binary `## Acceptance Criteria` last.
- `bug.md` uses the title `"[BUG] "`. The sections are Description, Steps to Reproduce, Expected Behavior, Actual Behavior, Environment, and Acceptance Criteria. `bug.md` has no Metadata block and no test plan.
- `task.md` uses the title `"[TASK] "`. The sections are Description, Context, and Done When.
- `.agro/skills/git/SKILL.md:36` lists the prefixes `feat` · `bug` · `task` · `audit` · `skill`. `.agro/skills/git/SKILL.md:96` lists the commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `docs/contributing.md:107` lists the prefixes `feat` · `fix` · `task` · `audit` · `skill` · `agent`. `docs/contributing.md:127` lists the types `feat` · `fix` · `task` · `audit` · `skill`.
- `.agro/scripts/__tests__/issue-templates.test.ts` has two cases. Both cases iterate every `.md` file in the template directory. Neither case checks the file set.
- `package.json` defines `"test": "vitest run"`.

Selected approach: extend the existing test first, then reshape `bug.md` and `task.md`, delete `audit.md` and `skill.md`, and edit the two lists. The `bug.md` sections follow the issue: Impact replaces Description and Expected or Actual Behavior. Reproduction replaces Steps to Reproduce and keeps the environment fields.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | `templateFiles()`, `describe("GitHub issue templates")` | Contract for the template set, the sections, and the two lists |
| `.github/ISSUE_TEMPLATE/feat.md` | whole file | Reference shape. This task does not change the file. |
| `.github/ISSUE_TEMPLATE/bug.md` | whole file | Rewrite in the `feat.md` shape |
| `.github/ISSUE_TEMPLATE/task.md` | whole file | Replace with the thin template |
| `.github/ISSUE_TEMPLATE/audit.md` | whole file | Delete |
| `.github/ISSUE_TEMPLATE/skill.md` | whole file | Delete |
| `.agro/skills/git/SKILL.md` | § Issue Titles, § Commit Messages | Canonical prefix and commit-type lists |
| `docs/contributing.md` | § Branch Naming, § Commit Messages | Contributor-facing copy of the lists |
| `CHANGELOG.md` | `## [Unreleased]` → `### Changed` | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub "New issue" template chooser | Modify | Shows Feature Request, Bug Report, and Task only |
| `.github/ISSUE_TEMPLATE/bug.md` | Modify | New sections and a Metadata block |
| `.github/ISSUE_TEMPLATE/task.md` | Modify | Thin template |
| `/git` skill | Modify | Prefix and commit-type lists |
| `docs/contributing.md` | Modify | Prefix and commit-type lists |

## Storage

N/A. The change edits tracked Markdown files and one test. The change adds no persisted state.

## Architectural Decisions

- **Source of truth**: `.agro/skills/git/SKILL.md` owns the prefix and commit-type lists. `docs/contributing.md` repeats the lists for contributors. The test keeps the two copies equal to the template set.
- **Prefix to template mapping**: each prefix has one template with the same file name, as `.agro/skills/git/SKILL.md:37` states.
- **Commit type for a bug fix**: the branch prefix is `bug` and the commit type is `fix`, as the issue states.
- **Audits and skills**: an audit runs through the `/audit` skill and needs no issue template. A new skill is a `feat` issue.
- **State management**: N/A. The change holds no runtime state.
- **Auth / scoping**: N/A. The change touches no access control.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | `holds exactly one template per branch prefix` | The directory holds `bug.md`, `feat.md`, and `task.md` only |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `bug template follows the feature shape` | The six `bug.md` headings, in order |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `task template stays thin` | The three `task.md` headings, in order, and no other `##` heading |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `branch metadata matches the template prefix` | The `branch:` value in each template starts with `<file name>/` |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `git skill and contributing guide list the same prefixes and types` | Both files list `feat` · `bug` · `task` and `feat` · `fix` · `task` |
| `.agro/scripts/__tests__/issue-templates.test.ts` | existing two cases | No stale stack prompts and no stale `.claude/rules/git.md` link |

Run `pnpm exec vitest run .agro/scripts/__tests__/issue-templates.test.ts` in the sandbox. Write the new cases first. The new cases fail before US-002 and US-003.

## Design Principles

- Follow the `AGENTS.md` rules. Make the change inside the sandbox. Add no comments to tracked code.
- Make the smallest change that meets the issue. Reuse the `feat.md` shape. Add no new template machinery.
- Keep one source of truth for the prefix list. The test detects drift between the two copies.
- Delete obsolete templates. Do not keep a dormant alternative.

## Out of Scope

- Changes to `feat.md` and `.github/pull_request_template.md`.
- Deletion or rename of the `audit` and `skill` labels on GitHub.
- Retirement of existing `audit/*` and `skill/*` branches and worktrees.
- Changes to the `/audit` skill and the `/builder` skill.
- The public documentation in `mifunedev/agro-web`. Open Question 2 covers this surface.

## Open Questions

1. Five more files list the retired prefixes `audit` and `skill`. The issue does not name these files. Recommendation: align the first four files in US-003 and keep the fifth file unchanged.
   - `.agro/skills/prd/references/tracker.md`: the `--prefix` list and the `branchName` regex in the `jq` check.
   - `.claude/skills/prd/references/tracker.md`: the same lists. This path is a plain directory, not a symlink to `.agro/`.
   - `.agro/skills/spec/references/plan.md:5`: the `--prefix` list.
   - `.worktrees/AGENTS.md:12`: the worktree subfolder list.
   - `.agro/skills/audit/references/drift.md:109` and `:116`: the branch regex `^(feat|fix|task|audit|skill|agent)/`. Existing branches can still match this regex, so this file stays unchanged.
2. Does `mifunedev/agro-web` publish the prefix or commit-type lists? If yes, the operator opens a matching change in `mifunedev/agro-web`.
3. `docs/contributing.md:107` lists `agent` as a branch prefix. `.worktrees/AGENTS.md` uses `agent/<name>` branches for per-agent checkouts. The issue lists only `feat` · `bug` · `task`. Recommendation: drop `agent` from the issue-branch prefix list. `agent/<name>` stays a separate branch namespace.

## Acceptance Criteria

- [ ] `ls .github/ISSUE_TEMPLATE/` prints `bug.md`, `feat.md`, and `task.md` only.
- [ ] `.agro/skills/git/SKILL.md` and `docs/contributing.md` list the prefixes `feat` · `bug` · `task` and the commit types `feat` · `fix` · `task`.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `CHANGELOG.md` holds an entry for this issue under `## [Unreleased]` → `### Changed`.
- [ ] The new test cases landed before the template edits, in commit order.
- [ ] The diff adds no dependency.
- [ ] A draft PR is open with the title `FROM task/<N>-prune-issue-templates TO development`.

## Lessons

Filled by the advisor before undraft.
