---
name: compact-handoff
description: |
  Generate exactly two ready-to-paste prompts from the current conversation: a
  `/compact` prompt that carries the working state forward, and a
  post-compaction prompt that directs the next unresolved task. Prints text
  only; executes neither prompt.
  TRIGGER when: /compact-handoff is invoked, or the operator asks for a compact
  prompt plus a resume prompt, a compaction carry-forward, or a handoff before
  compacting.
argument-hint: "[focus]"
disable-model-invocation: true
---

# Compact Handoff

Arguments received: `$ARGUMENTS`

Produce two prompts. Execute neither. Change no files, run no tools that
mutate state, and dispatch no workers.

## 1. Collect the state

Read the conversation from the start. Weight later messages over earlier ones.
If `$ARGUMENTS` is not empty, treat it as the focus for the next task and for
what to keep. The focus adds no requirements.

Extract each item below. Keep only what a fresh context needs to continue.

- **Objective:** the overall goal, in the operator's terms.
- **Latest instructions:** the most recent operator directions. A later
  instruction replaces an earlier one on the same point.
- **Decisions:** choices the operator made or approved.
- **Constraints:** hard rules, boundaries, and exclusions in force.
- **Completed work:** what is done, with the evidence that proves it.
- **Essential references:** file paths, branches, PRs, issues, commands, URLs,
  and identifiers that the next step needs. Copy them exactly.
- **Unresolved next steps:** open work, in order, and any open question
  blocked on the operator.

Classify every candidate item before you keep it:

| Status | Treatment |
|---|---|
| Approved by the operator | Keep as a decision. |
| Proposed but not approved | Keep only as an open proposal, labeled as such. |
| Superseded, abandoned, or answered | Drop. |
| Tool output, file dumps, exploration, retries | Drop. Keep only the conclusion and its reference. |

Do not invent a requirement, criterion, path, or decision. If a value that
the next task needs is missing, write `<unknown: what is missing>`.

## 2. Select the next task

Pick the first unresolved step that waits on no operator answer. If every
remaining step waits on the operator, make the next task "ask the operator" and name the
blocking question. If no work remains, make the next task "confirm completion
with the operator".

## 3. Write the prompts

**Prompt 1 — `/compact`.** Start with `/compact`. Follow it with an
instruction that tells the summarizer what to preserve, grouped under the
seven headings from step 1. Tell it to drop stale, superseded, and redundant
context, raw tool output, and file dumps. Tell it to keep open proposals
labeled as unapproved.

**Prompt 2 — post-compaction.** Direct execution of the task from step 2.
State:

- **Objective:** what the task achieves.
- **Scope:** what is in and out.
- **Deliverable:** the concrete output.
- **Completion criteria:** binary checks that prove the task is done.

Point at files for re-anchoring instead of restating their contents. Take the
criteria from the conversation. If the conversation does not define one, use
`<unknown: criterion>`.

## 4. Output

Print only the two prompts, each in its own fenced `text` block, in order.
Print no preamble, commentary, or closing text.

## Examples

- `/compact-handoff` — prompts for the current conversation.
- `/compact-handoff finish the CI fix` — same, with the next task focused on
  the CI fix.
