---
name: prd
description: |
  Write or revise a repository-grounded plan for one task at
  .agro/tasks/<slug>/prd.md, with user stories, binary acceptance criteria,
  and the section headings of the feature issue template. Apply /ste.
  This skill plans only. It never implements the plan.
  TRIGGER when: "write a plan", "plan this", "plan this feature",
  "create a prd", "write prd for", "requirements for", "spec out".
argument-hint: "<request | existing-prd-path | input-file-or-issue>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# PRD

Write one plan per task. The plan is `.agro/tasks/<slug>/prd.md`. The operator
reviews it, and the implementation owner builds from it. Run inline in the
active session.

## Required contract

- Write the plan to `.agro/tasks/<slug>/prd.md` in the target repository.
- Read `.agro/skills/ste/SKILL.md` before you write. Apply `/ste` to every plan and every revision.
- Plan only. Do not implement, commit, push, open a pull request, launch workers, or start services.
- Writing or revising a plan is never approval.

## Cost budget

Each turn re-sends the whole context, so the turn count drives the cost. Keep the grounding, and cut repeated work. Target 6 to 8 tool calls for the whole episode:

1. **One setup turn with two parallel Bash calls in the same response:** (a) the input file, `.claude/skills/prd/references/tracker.md`, and each applicable `AGENTS.md`; (b) `.agro/skills/ste/SKILL.md` alone. One combined `cat` of all of them exceeds the tool output limit and gets truncated or saved to a file. That forced a full second read of ste and tracker in almost every episode, which is the largest single cost overrun. Never re-`cat` a file whose content you already received. If an output is still truncated, read only the missing line range from the saved file with `sed -n`. Do not read `.github/ISSUE_TEMPLATE/feat.md`, because section 5 already holds the headings.
2. **At most 3 or 4 grounding calls.** Batch each file read and each `git grep -n` that you already know you need into one command. Issue independent tool calls in parallel in the same response.
3. **One Write** of the complete plan.
4. **One verification call**, then at most **one fix call**. See section 6.

Grounding rules:

- Use relative paths from the repository root. Do not prefix each command with `cd <absolute path>`.
- Use `grep -n` and `sed -n <range>p` with wide ranges for large files. Do not `cat` a whole source, workflow, or test file when you need only one symbol or line number. Do not page through a file in consecutive `sed -n` windows. Do not open a file a second time for a neighboring range.
- Do not grep again for a symbol that an earlier result already located.
- Skip `.agro/tasks/AGENTS.md`, archived plans, earlier PRDs, and trace directories unless the issue references them.
- Stop exploring when each Key Integration Point, each Test Plan row, and each cited command has a verified path. Record each remaining uncertainty as an open question. Do not open more files to resolve the uncertainty.

## 1. Resolve the request

Arguments received: `$ARGUMENTS`

1. Identify the input type:
   - free text: a new plan request;
   - a path to an existing `prd.md`: revise that plan in place;
   - another file or an issue: comprehensive input for a new plan.
2. If the argument is empty, use the explicit planning request in the current conversation.
3. If no source identifies a task, print `Usage: /prd <request | existing-prd-path | input-file-or-issue>` and stop. Write nothing.
4. If the input names a file or an issue, read the complete input before you write.
5. Confirm the target repository from the request and the current directory. When the target is ambiguous, ask the operator.

Comprehensive input already holds the operator's decisions. For that input, do
not ask clarifying questions. Record each gap as an open question in the plan.

## 2. Derive the slug

This section is the only copy of the slug rules. Other skills refer to it.

1. Convert the task name to lowercase.
2. Replace each run of whitespace or punctuation with one `-`.
3. Remove a `-` at the start or at the end.
4. Reject the result if the result is empty, contains `/`, has more than 5 hyphen-separated words, or equals `archive`.

The result matches `[a-z0-9-]+`. The slug becomes the `<shortdesc>` segment of the task branch.

| Input | Slug |
|---|---|
| `Install Prereq Detection` | `install-prereq-detection` |
| `Add a long six word feature` | rejected: more than 5 words |
| `archive` | rejected: reserved name |

If `.agro/tasks/<slug>/prd.md` exists and the operator did not ask for a
revision of it, ask before you replace it.

## 3. Ground the plan

1. Read each applicable `AGENTS.md` and directory `README.md` for the affected paths.
2. Read the code, tests, configuration, and documentation that control the requested behavior. Before you read, list the paths and symbols that the issue names. Then fetch all of them in one batched call.
   - Ground the plan statically. Do not run the target code. Do not build fixtures, driver scripts, or temporary harnesses to observe runtime behavior. When the issue gives a reproduction, cite the issue. Put the reproduction into a story's red-test criterion for the implementer.
3. Separate verified facts from assumptions.
4. Never invent a missing command, path, threshold, or result. Write an explicit placeholder, such as `<test command>`, and add an open question.

5. The plan verifier checks each backticked path and each backticked command.
   - Put a path in backticks only when git tracks the path at the base commit, or when the same line marks the path as new ("new file `x`") or absent ("`x` is absent", "no file exists at `x`"). Mark each future file, each new directory, and each path that must not exist in this way. Do not write a trailing `/` on a directory that does not exist yet.
   - Do not backtick a gitignored path, such as `.env` files, caches, or home-directory state. Name such a location in plain prose, or cite its tracked parent directory.
- Do not backtick a wrong command or script from the issue to correct it. Write "the runner named in the issue does not exist", and backtick only the correct command. The verifier checks each line on its own: an absent marker on one line does not cover a backticked mention on another line, such as in the Test Plan or Out of Scope.
   - In the section 6 verification call, add this check of the backticked paths: `for x in $(grep -o '`[A-Za-z0-9._/-]*/[A-Za-z0-9._-]*`' <prd-path> | tr -d '`' | sort -u); do git ls-files --error-unmatch "$x" >/dev/null 2>&1 || echo "UNTRACKED $x"; done`. For each `UNTRACKED` path, fix every line that backticks the path without a new or absent marker on the same line. Include those fixes in the single fix call.
   - Before the Write, check the cited paths in one call: `git ls-files --error-unmatch <path>...`, plus `ls` on each script that a command names. Add this check to a grounding call when possible.
6. Each new file that the plan declares must be git-trackable. The `.agro/tasks/<slug>/` directory is gitignored. Do not declare a new deliverable file there, such as `evidence.md`. Record evidence in `progress.txt` or in the PR body, and refer to the evidence without a path.

A draft with an unresolved required decision has the status `BLOCKED`.

## 4. Ask clarifying questions

Ask only the questions whose answers change scope, safety, or acceptance.
Give lettered options, so that the operator can answer with `1A, 2C`:

```text
1. What is the scope?
   A. Minimal version
   B. Full feature
   C. Backend only
   D. Other: <specify>
```

For comprehensive input, skip this step.

## 5. Write the plan

Use the section headings of `.github/ISSUE_TEMPLATE/feat.md`, in this order.
When a section does not apply, write "N/A" and give the reason.

```markdown
# PRD: <title>

Status: DRAFT | BLOCKED

## User Stories

### US-001: <title>

**Description:** As a <role>, I want <capability> so that <benefit>.

**Acceptance Criteria:**

- [ ] <Binary, verifiable criterion.>

## Summary
<Context beyond the stories: verified current state and the selected approach.>

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|

## Storage
<Persistence layer, location or schema, pattern to follow. N/A with a reason if stateless.>

## Architectural Decisions
<Source of truth, state management, auth or scoping.>

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|

## Design Principles
<Repository principles plus task-specific principles.>

## Out of Scope
<What this task does not include.>

## Open Questions
<Unresolved decisions. Write "None" when no question remains.>

## Acceptance Criteria
- [ ] <Task-level binary criterion.>

## Lessons

Filled by the advisor before undraft.
```

### Stories

- Give each story the heading `### US-00N: <title>`, a description in the form "As a <role>, I want <capability> so that <benefit>", and an acceptance-criteria checklist.
- Size and order the stories by the rules in [`references/tracker.md`](references/tracker.md).
- Keep each story description to one short sentence of 20 words or fewer: "As a <role>, I want <short capability> so that <short benefit>." Put no lists, no parentheses, and no second clause in it. Long descriptions are the most common `ste-check` finding and cost extra fix turns. Put detail in the acceptance criteria.
- Write every other sentence to `/ste` rules before the Write. Aim for zero findings, not fix-after.

### Acceptance criteria

Write each criterion as a binary check. An agent must be able to execute or verify each check.

- Bad: "Works correctly." Good: "The button opens a confirmation dialog before it deletes the task."
- Bad: "Fast enough." Good: "`<command>` completes in less than 2 seconds on the fixture."

For each story that changes a user interface, add this criterion:
"Verify in browser using agent-browser skill".

## 6. Verify and report

1. Run one combined verification call: `grep -n '^## \|^### US-\|^- \[ \]\|^Status:' <prd-path>; bash .agro/skills/ste/scripts/ste-check.sh <prd-path>; echo "exit=$?"`. Run the checker from the harness repository. Use an absolute path for another repository. This output is the read-back from disk.
2. From that output, confirm that each story has at least one acceptance criterion.
3. From that output, confirm that each section is present and in order. `## Lessons` must be the last section.
4. If the output shows findings, fix all of them in one script call. Replace each flagged line by its line number with a full new line, for example in `python3`: `L=open(p).read().split('\n'); L[n-1]='<new line>'`. Apply the replacements from the highest line number to the lowest. Do not use substring replacement of text you recall: a non-matching pattern silently leaves the finding and costs another turn. Rerun the combined command inside that same call. Do not fix one finding per turn. Do not print the flagged lines in a separate turn, because the checker already prints them. Do not read the source of `ste-check.sh`.
5. Review the meaning with the ten-question check in `/ste`. This review needs no extra tool call.
6. Report the path, the status, and the open questions.

Use `DRAFT` only when the plan passes these checks and waits for operator approval.
Use `BLOCKED` when a required decision, prerequisite, or check remains open.
If the write fails, report `FAILED` with the cause. Do not report a plan that you did not read back.

## 7. After operator approval

Do these steps only after the operator approves the plan. The approval is an
explicit operator statement. Writing or revising the plan does not start
either step.

1. Convert `prd.md` to `.agro/tasks/<slug>/prd.json`. Follow [`references/tracker.md`](references/tracker.md).
2. Offer the "Draft PR for a task" procedure in [`.agro/skills/git/SKILL.md`](../git/SKILL.md). Run the procedure only when the operator accepts.

## Examples

- `/prd webhook retry limits` writes a grounded draft at `.agro/tasks/webhook-retry-limits/prd.md`.
- `/prd .agro/tasks/webhook-retry-limits/prd.md` reads the draft and revises it in place.
- `/prd` with no request prints the usage message and writes nothing.
