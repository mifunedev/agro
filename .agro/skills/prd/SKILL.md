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

Each tool call sends the whole context again, so the number of tool calls sets the cost.
Keep the grounding complete, and remove repeated work.

1. Read the setup files in one turn with two parallel Bash calls. The first call reads the input file, [`references/tracker.md`](references/tracker.md), and each applicable `AGENTS.md`. The second call reads `.agro/skills/ste/SKILL.md` alone.
2. Ground the plan in about 2 to 4 batched calls. Section 3 gives the batch rules.
3. Use one Bash call to write the plan and to verify the plan. Section 6 gives the command.
4. Fix all checker findings in at most one more call.

- Read each file one time. Do not read a file again after its content is in the context.
- If a tool truncates an output, read only the missing line range with `sed -n`.
- Do not read `.github/ISSUE_TEMPLATE/feat.md`. Section 5 holds the headings of that template.
- Send independent tool calls in parallel in the same response.

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
2. Read the code, tests, configuration, and documentation that control the requested behavior.
   - Before the first read, list the paths and symbols that the request names. Read all of them in one batched call.
   - Put each file read and each `git grep -n` that you know you need into one command.
   - Use paths relative to the repository root. Do not start each command with `cd <absolute path>`.
   - For a long file, use `grep -n` or one `sed -n` window of 80 lines or less. Do not `cat` the whole file.
   - Do not search again for a symbol that an earlier output located.
   - Ground the plan statically. Do not run the target code, and do not build fixtures, driver scripts, or temporary harnesses.
   - When the issue gives a reproduction, cite the issue. Put the reproduction into the red-test criterion of a story.
   - Stop the grounding when each Key Integration Point, each Test Plan row, and each cited command has a verified source.
3. Separate verified facts from assumptions.
4. Never invent a missing command, path, threshold, or result. Write an explicit placeholder, such as `<test command>`, and add an open question.

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
- Make the last story capture the manual review evidence. The story depends on the stories that it proves.
  - For a user interface change, the story records an agent-browser journey with annotated screenshots.
  - For a server, CLI, or API change, the story writes a command transcript to `.agro/tasks/<slug>/evidence/manual-review.md`.
  - The story uses a live or local resource only with operator approval, and it deletes each resource that it creates.
  - Close uses the evidence to fill the PR `## Manual review` section in the shape of [`.agro/skills/git/references/manual-review.md`](../git/references/manual-review.md).
- If the plan has no user interface change and no server, CLI, or API change, state the reason in `## Out of Scope`. Omit the evidence story.

### Acceptance criteria

Write each criterion as a binary check. An agent must be able to execute or verify each check.

- Bad: "Works correctly." Good: "The button opens a confirmation dialog before it deletes the task."
- Bad: "Fast enough." Good: "`<command>` completes in less than 2 seconds on the fixture."

For each story that changes a user interface, add this criterion:
"Verify in browser using agent-browser skill".

## 6. Verify and report

1. Use one Bash call to write the plan and to verify the plan. Do not use the Write tool.
   - Write the file with a quoted heredoc, so that backticks and `$` stay literal: `mkdir -p .agro/tasks/<slug> && cat > <prd-path> <<'PRD_EOF'`. End the heredoc with a `PRD_EOF` line.
   - In the same call, run `grep -n '^## \|^### US-\|^- \[ \]\|^Status:' <prd-path>; bash .agro/skills/ste/scripts/ste-check.sh <prd-path>; echo "exit=$?"`.
   - Run the checker from the harness repository. Use an absolute path for another repository.
   - The output of that command is the read-back from disk.
2. From that output, confirm that each story has at least one acceptance criterion.
3. From that output, confirm that each section is present and in order. `## Lessons` must be the last section.
4. If the checker reports findings, fix all of them in one script call. Then run the verification command again in that same call.
   - Replace each flagged line by its line number with a full new line. Apply the replacements from the highest line number to the lowest.
   - Do not replace substrings from memory. A pattern that does not match leaves the finding in the file.
   - Do not print the flagged lines in a separate call, because the checker prints them. Do not read the source of `ste-check.sh`.
5. Review the meaning with the ten-question check in `/ste`. This review needs no tool call.
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
