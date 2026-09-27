---
name: compact-handoff
description: |
  Generate exactly two ready-to-paste prompts from the current conversation,
  labeled COMPACT_PROMPT and COMPACT_POST_PROMPT: a `/compact` command that
  carries the working state forward, and a post-compaction prompt that directs
  the next unresolved task. Prints text only; executes neither prompt.
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

**`COMPACT_PROMPT` — the `/compact` command.** Write one command that the
operator pastes as is. Start with `/compact ` and follow it on the same line
with the compaction instruction. The instruction tells the summarizer what to
keep to deliver the best result on the next task:

- the seven items from step 1, each with its concrete values;
- open proposals, labeled as unapproved;
- the references that the next task needs, copied exactly.

The instruction also tells the summarizer to drop stale, superseded, and
redundant context, raw tool output, and file dumps.

**`COMPACT_POST_PROMPT` — the post-compaction prompt.** Write the message that
the operator sends after the compaction. The message directs the task from
step 2 and states:

- **Objective:** what the task achieves.
- **Scope:** what is in and out.
- **Deliverable:** the concrete output.
- **Completion criteria:** binary checks that prove the task is done.

Point at files for re-anchoring instead of restating their contents. Take the
criteria from the conversation. If the conversation does not define one, use
`<unknown: criterion>`.

## 4. Output

Print exactly this shape and nothing else:

````text
COMPACT_PROMPT:
```
/compact <compaction instruction>
```
COMPACT_POST_PROMPT:
```
<post-compaction prompt>
```
````

Use a plain fence with no language tag for each prompt. If a prompt contains
a triple backtick, fence that prompt with four backticks. Print no preamble,
commentary, or closing text.

## Examples

- `/compact-handoff` — prompts for the current conversation.
- `/compact-handoff finish the CI fix` — same, with the next task focused on
  the CI fix.
