# PRD: Prune issue templates

Status: DRAFT

## User Stories

### US-001: Rewrite the bug template in the feature shape

**Description:** As an operator, I want `bug.md` to follow the `feat.md` shape so that an agent can fix a bug from the issue body alone.

**Acceptance Criteria:**

- [ ] `.github/ISSUE_TEMPLATE/bug.md` holds these `##` headings in this order: `Metadata`, `Impact`, `Reproduction`, `Suspected Cause`, `Test Plan (TDD)`, `Acceptance Criteria`.
- [ ] The `Metadata` block of `bug.md` holds `branch: "bug/[issue#]-[shortdesc]"` and `pull_request_title: "FROM bug/[issue#]-[shortdesc] TO [target-branch]"`.
- [ ] The `Reproduction` section of `bug.md` asks for steps, expected behavior, actual behavior, and environment.
- [ ] The frontmatter of `bug.md` sets `title: "bug: "` and `labels: bug`.
- [ ] A new case in `.agro/scripts/__tests__/issue-templates.test.ts` asserts the `bug.md` heading order. The case fails before the rewrite and passes after the rewrite.

### US-002: Keep three templates only

**Description:** As an operator, I want one issue template per branch prefix so that the template set matches the branch prefixes.

**Acceptance Criteria:**

- [ ] `.github/ISSUE_TEMPLATE/task.md` holds these `##` headings in this order: `Metadata`, `Description`, `Done When`.
- [ ] The `Metadata` block of `task.md` holds `branch: "task/[issue#]-[shortdesc]"` and `pull_request_title: "FROM task/[issue#]-[shortdesc] TO [target-branch]"`.
- [ ] The frontmatter of `task.md` sets `title: "task: "` and `labels: task`.
- [ ] `.github/ISSUE_TEMPLATE/audit.md` and `.github/ISSUE_TEMPLATE/skill.md` do not exist.
- [ ] `ls .github/ISSUE_TEMPLATE` prints exactly `bug.md`, `feat.md`, and `task.md`.
- [ ] New cases in `issue-templates.test.ts` assert the exact template set and the `task.md` heading order. The cases fail before the change and pass after the change.

### US-003: Align the prefix and commit-type lists

**Description:** As an agent, I want one prefix list and one commit-type list in every document so that I name branches and commits consistently.

**Acceptance Criteria:**

- [ ] `.agro/skills/git/SKILL.md` lists the issue and branch prefixes as `feat` · `bug` · `task`.
- [ ] `.agro/skills/git/SKILL.md` lists the commit types as `feat` · `fix` · `task`.
- [ ] `docs/contributing.md` lists the branch prefixes as `feat` · `bug` · `task`.
- [ ] `docs/contributing.md` lists the commit types as `feat` · `fix` · `task`.
- [ ] `.agro/skills/prd/references/tracker.md` accepts `--prefix <feat|bug|task>`, and the `branchName` check uses the regex `^(feat|bug|task)/[0-9]+-[a-z0-9-]+$`.
- [ ] `.agro/skills/spec/references/plan.md` documents `--prefix feat|bug|task`.
- [ ] A new case in `issue-templates.test.ts` asserts the prefix and commit-type lists in `.agro/skills/git/SKILL.md` and `docs/contributing.md`. The case fails before the change and passes after the change.
- [ ] `grep -rnE 'feat\|bug\|task\|audit\|skill' .agro/skills docs` prints no line.

### US-004: Record the change in the changelog

**Description:** As an operator, I want a changelog entry so that users learn that the `audit` and `skill` templates are gone.

**Acceptance Criteria:**

- [ ] `CHANGELOG.md` holds one new entry under `## [Unreleased]` → `### Changed`. The entry names the three templates and links the issue as `<issue#>`.

## Summary

Verified current state:

- `.github/ISSUE_TEMPLATE/` holds five templates: `audit.md`, `bug.md`, `feat.md`, `skill.md`, `task.md`.
- `bug.md` holds `Description`, `Steps to Reproduction`, `Expected Behavior`, `Actual Behavior`, `Environment`, and a generic `Acceptance Criteria` list. The file has no `Metadata` block and no test plan.
- `task.md` holds `Description`, `Context`, and `Done When`. The file has no `Metadata` block.
- `.agro/skills/git/SKILL.md:36` lists issue prefixes `feat` · `bug` · `task` · `audit` · `skill`. Line 37 states that each prefix matches `.github/ISSUE_TEMPLATE/<prefix>.md`.
- `.agro/skills/git/SKILL.md:96` lists commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `docs/contributing.md:107` lists branch prefixes `feat` · `fix` · `task` · `audit` · `skill` · `agent`. This list uses `fix` where the `/git` skill uses `bug`.
- `docs/contributing.md:127` lists commit types `feat` · `fix` · `task` · `audit` · `skill`.
- `.agro/skills/prd/references/tracker.md:10` and `:109`, and `.agro/skills/spec/references/plan.md:5`, accept the prefixes `feat|bug|task|audit|skill`.
- `.agro/scripts/__tests__/issue-templates.test.ts` checks every template for stale stack tokens and for the stale `.claude/rules/git.md` link. The test does not check the template set or the headings.

Selected approach:

1. Add the failing test cases.
2. Rewrite `bug.md` and `task.md`.
3. Delete `audit.md` and `skill.md`.
4. Edit each prefix list and each commit-type list to the new set.

 The branch prefix `bug` pairs with the commit type `fix`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/ISSUE_TEMPLATE/bug.md` | whole file | Rewrite in the `feat.md` shape |
| `.github/ISSUE_TEMPLATE/task.md` | whole file | Replace with the thin template |
| `.github/ISSUE_TEMPLATE/audit.md` | whole file | Delete |
| `.github/ISSUE_TEMPLATE/skill.md` | whole file | Delete |
| `.agro/skills/git/SKILL.md` | `## Issue Titles`, `## Commit Messages` | Canonical prefix list and commit-type list |
| `docs/contributing.md` | `## Branch Naming`, `## Commit Messages` | Contributor-facing prefix list and commit-type list |
| `.agro/skills/prd/references/tracker.md` | `--prefix`, `branchName` regex | Accepted prefixes for `prd.json` conversion |
| `.agro/skills/spec/references/plan.md` | `--prefix` usage line | Accepted prefixes for `/spec plan` |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `describe("GitHub issue templates")` | Regression tests for the template set, the headings, and the lists |
| `CHANGELOG.md` | `## [Unreleased]` → `### Changed` | Release note |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| GitHub "New issue" chooser | Modify | The chooser offers Feature Request, Bug Report, and Task only |
| `.github/ISSUE_TEMPLATE/bug.md` | Modify | New sections: Metadata, Impact, Reproduction, Suspected Cause, Test Plan (TDD), Acceptance Criteria |
| `.github/ISSUE_TEMPLATE/task.md` | Modify | New sections: Metadata, Description, Done When |
| `/git` skill | Modify | Prefix list and commit-type list shrink to three entries each |
| `docs/contributing.md` | Modify | Prefix list and commit-type list shrink to three entries each |
| `/prd` tracker and `/spec plan` | Modify | `--prefix` accepts `feat`, `bug`, and `task` only |

## Storage

N/A. The change edits Markdown templates, documentation, and one test file. No state persists.

## Architectural Decisions

- **Source of truth**: `.agro/skills/git/SKILL.md` owns the prefix list and the commit-type list. `docs/contributing.md`, `tracker.md`, and `plan.md` copy the list. The new test asserts that the `/git` skill and `docs/contributing.md` agree.
- **Prefix and type mapping**: the branch prefix `feat` pairs with the commit type `feat`. The branch prefix `bug` pairs with the commit type `fix`. The branch prefix `task` pairs with the commit type `task`.
- **Scope of alignment**: the issue names the `/git` skill and `docs/contributing.md`. The plan also edits `tracker.md` and `plan.md`, because these files validate or document the same prefix set. A `prd.json` with an `audit/` or `skill/` branch fails the new regex. No active task in `.agro/tasks/` uses these prefixes.
- **Template shape**: `bug.md` reuses the `feat.md` Metadata block, `Test Plan (TDD)` table, and binary acceptance-criteria style. `task.md` keeps the Metadata block and drops every other `feat.md` section.
- **Auth / scoping**: N/A.

## Test Plan (TDD)

Run `pnpm exec vitest run .agro/scripts/__tests__/issue-templates.test.ts` in the sandbox. Write each case before the matching change, and confirm that the case fails first.

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/issue-templates.test.ts` | `holds exactly feat, bug, and task templates` | The template set |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `bug template follows the feature shape` | The `bug.md` heading order and `bug/` Metadata branch |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `task template stays thin` | The `task.md` heading order and `task/` Metadata branch |
| `.agro/scripts/__tests__/issue-templates.test.ts` | `git skill and contributing guide list the same prefixes and commit types` | The prefix list and the commit-type list in both files |
| `.agro/scripts/__tests__/issue-templates.test.ts` | existing two cases | No regression of the stale-token and stale-link checks |

## Design Principles

- Follow the repository principles in `AGENTS.md`. Make the smallest change that meets the issue. Delete obsolete paths instead of keeping dormant alternatives.
- Keep one template per branch prefix. An audit is a skill that the operator runs. A new skill is a feature.
- Keep one source of truth for the prefix list. Assert agreement with a test, not with prose.
- Do not add comments to tracked code.

## Out of Scope

- The branch regex in `.agro/skills/audit/references/drift.md:109` and `:116`. See Open Question 1.
- The `agent` prefix in `docs/contributing.md:107`. The plan removes the entry with the other stale prefixes and adds no replacement.
- The `feat.md` template and `.github/pull_request_template.md`.
- Renaming or closing existing issues and branches that use `audit/`, `skill/`, or `fix/`.
- The `/audit harness` check at `.agro/skills/audit/references/harness.md:124`. The check lists the templates at run time and needs no change.

## Open Questions

1. `.agro/skills/audit/references/drift.md` recognizes work branches with `^(feat|fix|task|audit|skill|agent)/`. This regex omits `bug/`, so the drift check reports a `bug/` branch as unexpected.
   A. Leave the regex unchanged in this task.
   B. Change the regex to `^(feat|bug|task)/`.
   C. Change the regex to accept the new prefixes and the legacy prefixes.
   The default is A.
2. The repository `mifunedev/agro-web` renders public documentation. Does the agro-web repository carry a copy of the prefix list or the commit-type list? If yes, that copy needs a matching change. The default is no change.
3. The GitHub issue number does not exist yet. The changelog link and the branch name use `<issue#>` until the operator opens the issue.

## Acceptance Criteria

- [ ] `.github/ISSUE_TEMPLATE/` holds only `feat.md`, `bug.md`, and `task.md`.
- [ ] `.agro/skills/git/SKILL.md` and `docs/contributing.md` list the prefixes `feat` · `bug` · `task` and the commit types `feat` · `fix` · `task`.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/issue-templates.test.ts` exits 0 in the sandbox.
- [ ] `pnpm test` exits 0 in the sandbox.
- [ ] `CHANGELOG.md` holds the new entry under `## [Unreleased]` → `### Changed`.
- [ ] The draft PR title is `FROM task/<issue#>-prune-issue-templates TO development`.

## Lessons

Filled by the advisor before undraft.
