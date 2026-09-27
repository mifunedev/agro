# PRD: Manual review section standard for PRs

Status: DRAFT

## User Stories

### US-001: Require a manual review section in each PR

**Description:** As a reviewer, I want each PR body to hold a `## Manual review` section in one canonical shape. I can then validate what shipped myself.

**Acceptance Criteria:**

- [ ] `.github/pull_request_template.md` has `## Manual review` directly after `## Where it diverged`, with a comment that points to the reference. The template has no `## Visual Reference` section.
- [ ] `.agro/skills/git/references/manual-review.md` defines the user-journey shape and the server, CLI, or API shape, each with a short example.
- [ ] The user-journey shape has setup, lettered scenarios with numbered steps, an expected result for each step with the exact visible text, an annotated screenshot in a `<details>` block under each UI step, and cleanup.
- [ ] The server, CLI, or API shape has the exact command, where the command runs (host or sandbox, local or remote), prerequisites before the step, trimmed example output with the lines that matter, the expected exit status, and at least one failure-path command.
- [ ] The reference states that an expected result must come from an observed run, that a step that creates a resource needs a cleanup step, and that `Verification` lists what the agent ran while `Manual review` lists what the reviewer runs. It cites mifunedev/agro-console#185 as the reference example.
- [ ] The Ready-for-review gate in `.agro/skills/git/SKILL.md` lists `Manual review` among the non-empty evidence sections and links the reference.
- [ ] The Draft-PR step in `.agro/skills/git/SKILL.md` states that a target repository without `.github/pull_request_template.md` uses the harness template.
- [ ] A new probe `.agro/evals/probes/pr-manual-review.sh` passes. It fails if the template loses `## Manual review`, if the gate stops listing it, or if the reference loses either shape.
- [ ] `bash .agro/evals/probes/git-skill.sh` passes, and the `git-conventions` experiment checks that read the template stay valid.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on the reference file and on the changed lines of the git skill.

### US-002: Plan and fill the manual review evidence

**Description:** As the advisor, I want each plan to end with an evidence story and Close to fill the section from it. The manual review steps then come from a real run.

**Acceptance Criteria:**

- [ ] `.agro/skills/prd/SKILL.md` requires the last story of each plan to capture manual review evidence: an agent-browser journey with annotated screenshots for a user interface change, or a command transcript at `.agro/tasks/<slug>/evidence/manual-review.md` for a server, CLI, or API change. A plan with neither states why in `## Out of Scope`.
- [ ] `.agro/skills/delegate/SKILL.md` Close fills the PR `## Manual review` section from that evidence, in the shape of `.agro/skills/git/references/manual-review.md`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on the changed lines of both skills.
- [ ] Every probe that reads the `/prd` or `/delegate` skill still passes.

## Summary

PR mifunedev/agro-console#185 introduced a `## Manual review` section. The operator made it the standard for each PR in each project. Today the git skill builds the PR body from `.github/pull_request_template.md`, and its Ready-for-review gate checks six evidence sections. A repository without a template, such as agro-console, gets no shape.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.github/pull_request_template.md` | `## Manual review` | PR body shape |
| `.agro/skills/git/SKILL.md` | Draft PR for a task; Ready for review | Template fallback; gate |
| `.agro/skills/git/references/manual-review.md` | both shapes | Canonical format |
| `.agro/skills/prd/SKILL.md` | stories | Evidence story |
| `.agro/skills/delegate/SKILL.md` | Close | Fill the section |
| `.agro/evals/probes/pr-manual-review.sh` | probe | Contract guard |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| PR body | New section | `## Manual review` replaces `## Visual Reference` |

## Storage

N/A. The change edits skills, a template, and a probe.

## Architectural Decisions

- The canonical format lives in the git skill reference. The template and the other skills point to the reference and do not copy the format.
- The harness template is the fallback for a project without a template.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/pr-manual-review.sh` | template section, gate entry, both shapes | US-001 |
| `.agro/evals/probes/git-skill.sh` | existing contract | No regression |

## Design Principles

- One source of truth for the format.
- Only observed results in the expected-result text.

## Out of Scope

- A template file in each project repository.
- Changes to the issue templates.

## Open Questions

None.

## Acceptance Criteria

- [ ] Each changed file passes `ste-check.sh` on its changed lines.
- [ ] The probe suite has no new regression.

## Lessons

- The harness `.gitignore` ignores `.agro/tasks/*/*`, so an evidence screenshot does not reach the PR by default. Evidence: the US-001 report. Outcome: fixed in this PR. The reference says to commit each linked evidence file with `git add -f <path>`.
- agent-browser 0.8.5 has no annotate flag. Evidence: the US-001 report. Outcome: fixed in this PR. The reference describes numbered callouts that the agent adds before each screenshot, and names no annotate tool.
- `.github/ISSUE_TEMPLATE/feat.md` still has `### Visual Reference`. Evidence: `grep -n "Visual Reference" .github/ISSUE_TEMPLATE/feat.md`. Outcome: proposed issue "Align the feat issue template with the Manual review section".
- `skills-vendored.sh` exits 1 in this sandbox because `cc-safety-net` is not on PATH. Evidence: the same failure on the base commit. Outcome: dropped, because the environment causes it and this PR does not touch that probe.
