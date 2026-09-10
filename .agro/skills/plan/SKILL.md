---
name: plan
description: |
  Create or revise a repository-grounded Markdown plan at .agro/plans/<slug>/plan.md.
  Always include a Definition of Done and an advisor orchestration strategy
  that maps work and verification to each completion criterion. Apply /ste.
  Plans are gitignored by default. Do not implement the plan.
  TRIGGER when: /plan invoked, "write a plan", "create a plan",
  or "save a plan in .agro/plans". Use /spec for task scaffolding or execution.
argument-hint: "<request | existing-plan-path>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Plan

Create one local planning document for the operator and the future implementation owner.
Run inline in the active session.

## Required contract

- Write plans to `.agro/plans/<slug>/plan.md` in the target repository.
- Keep `plan.md` as the source of truth. Reserve sibling `plan.html` for an optional rendering; do not generate HTML during `/plan`.
- Always include `## Definition of Done`, even in a short or blocked draft.
- Always include `## advisor orchestration strategy`; this is not a separate agent role.
- Read `.agro/skills/ste/SKILL.md` before drafting. Apply `/ste` to every plan and revision.
- Keep plans gitignored by default. Never stage or force-add a plan without explicit operator approval.
- Plan only. Do not implement, create task folders, launch implementation workers, commit, push, or start services.
- Do not invoke `/spec` or `/delegate` automatically after writing a plan.
- Do not change provider settings or move existing `.claude/plans/` files automatically.

## 1. Resolve the request

Arguments received: `$ARGUMENTS`

1. Use the argument as a free-text request or an existing plan path.
2. If the argument is empty, use the current conversation's explicit planning request.
3. If neither source identifies a task, print `Usage: /plan <request | existing-plan-path>` and stop without writing.
4. If the input names an existing file, read the complete file before drafting.
5. Confirm the target repository from the request and current directory. Ask when the target is ambiguous.
6. Read applicable `AGENTS.md`, `CLAUDE.md`, and directory `README.md` files for the affected paths.
7. Derive a descriptive lowercase kebab-case slug from the topic. Use at most five words; reject path separators and traversal components.

If the operator requests a revision, reuse the selected `.agro/plans/<slug>/plan.md` file.
If another plan occupies the derived path, ask before replacing that plan.
For an input in another layout, preserve the source and write the draft to `.agro/plans/<slug>/plan.md`.
If the input is a companion rendering, read its sibling `plan.md` as the source before revision.
Do not overwrite unrelated local work or write through symlinks outside the target repository.

## 2. Ground the plan

1. Read the code, tests, configuration, and documentation that control the requested behavior.
2. Query `/wiki query <topic> --patterns` when tracked repository knowledge exists.
3. Verify relevant recalled claims against current sources.
4. Apply `/architect` when the request changes structural boundaries. Keep its decision in the active session.
5. Separate verified facts from assumptions and open decisions.
6. Ask only questions whose answers materially change scope, safety, or the completion criteria.

Record unresolved values as explicit placeholders and questions. Never invent a missing command, path, threshold, permission, or test result.
A draft with an unresolved required decision is `BLOCKED`, not ready for approval.
Scale detail to the task, but never omit either required completion section.

## 3. Define completion before sequencing work

Write the Definition of Done before the implementation steps.
Give each criterion a stable identifier such as `D1`.
For every criterion, name:

- the observable outcome;
- the verification command or review procedure;
- the expected result and evidence artifact;
- the owner who produces or verifies the evidence.

Map every requested requirement to at least one criterion.
Include regression protection and negative cases where the changed behavior requires them.
Name environment prerequisites for checks that require a host, sandbox, credentials, or external service.
A missing prerequisite blocks its required gate. A skipped check does not satisfy that gate.
Never substitute a worker's completion summary for verified evidence.

## 4. Plan the orchestration

Read `.agro/skills/delegate/SKILL.md` before writing the orchestration strategy.
The advisor behavior belongs to the active session; it creates no persistent identity or competing worker hierarchy.
This section describes future execution, not permission to start implementation.

1. Name the active session as the one accountable owner; it decides, assigns, and accepts.
2. Identify independent research that benefits from bounded read-only workers.
3. Reconcile research in the active session before assigning writes.
4. Write one bounded assignment for every tracked implementation edit. Keep coupled edits with one continuing worker.
5. Sequence assignments by dependencies. Use isolated worktrees for parallel writers. Keep overlapping file changes sequential.
6. Schedule independent read-only evidence review after implementation.
7. Return a failed criterion to the bounded worker that owns the affected files, under the same advisor.
8. Stop dependent work when a prerequisite fails. Escalate unresolved scope or safety decisions to the operator.

Give every bounded assignment these fields:

- Stable task ID and dependency IDs.
- Complexity, selection reason, exact requested model, and reasoning setting after native resolution.
- Read scope, owned write paths, and explicit exclusions.
- Execution directory, worktree isolation, native worker type, and supported continuation method.
- Concrete deliverable and ready-to-send worker brief.
- Verification commands or an exact review procedure, expected results, and evidence destinations.
- Covered DoD IDs, the acceptance owner, and the failure/repair route.

Cover every DoD criterion with at least one assignment plus an advisor-owned acceptance check.
An assignment must not say only "implement the plan" or "satisfy all criteria"; it names its write paths and its DoD IDs.
A read-only worker never owns edits.
Use `/delegate` for worker limits, model policy, and recursion policy; do not redefine those policies here.
A plan-only request can keep synthesis and draft writing with the active advisor; state why implementation delegation does not apply.
Continue in the active session by default; the plan needs no handoff and no particular model.
Provide a concise handoff prompt only when the operator requests transfer to another session. A plan without that prompt is complete.
During approved execution, `/spec` owns the build and `/delegate` owns its execution records under `.agro/tasks/<slug>/`.
The draft remains planning input, not a second completion-state database.

## 5. Write the draft

1. Create `.agro/plans/<slug>/` only inside the confirmed target repository.
2. Check the destination with `git check-ignore --no-index -- <plan-path>` in a Git repository.
3. If no ignore rule covers the destination, create `.agro/plans/.gitignore` containing `*` and a final newline.
4. If an existing ignore file conflicts with that default, ask before changing it.
5. If the destination is already tracked, report the conflict. Do not untrack the file automatically.
6. Write the plan with the structure below. Replace placeholders with grounded content or explicit blocking questions.

In a non-Git directory, create the same local ignore file and report that Git verification is unavailable.
Do not edit the consumer repository's root `.gitignore` or provider configuration during plan creation.

Use these sections in order.

```markdown
# Plan: <title>

Status: DRAFT | BLOCKED

## Goal and scope
<Requested outcome, constraints, and explicit non-goals.>

## Current state and decision
<Source paths, verified behavior, selected approach, and assumptions.>

## Definition of Done
| ID | Observable outcome | Verification and expected result | Evidence | Owner |
|---|---|---|---|---|
| D1 | <Outcome.> | <Command or review procedure; required result.> | <Artifact.> | <Owner.> |

## Implementation steps
| Step | Action and files | Dependencies | Execution context | DoD IDs |
|---|---|---|---|---|
| 1 | <Bounded change.> | <None or step IDs.> | <Host or sandbox; target repository.> | D1 |

## advisor orchestration strategy
<One active owner who decides and accepts; the reason delegation applies or does not; evidence-review and repair sequence.>

| Task | Complexity and selection reason | Requested model / reasoning | Dependencies | Read scope; owned write paths; exclusions | Execution directory; worktree; worker type; continuation | Deliverable | Verification and evidence destination | DoD IDs; acceptance owner; repair route |
|---|---|---|---|---|---|---|---|---|
| T1 | <Class and deciding factors.> | <Exact setting or `inherit`.> | <None or task IDs.> | <Paths.> | <Directory; isolation; built-in type; continuation method.> | <Artifact.> | <Command or procedure; expected result; destination.> | <IDs; advisor; worker that repairs.> |

<Ready-to-send worker brief for each task.>

| Wave | Work and owner | Dependencies | Output or handoff | DoD IDs |
|---|---|---|---|---|
| 1 | <Research or worker task.> | <None or prior wave.> | <Source-backed result.> | D1 |

<Optional handoff prompt, only when the operator requests transfer; its absence does not make the plan incomplete.>

## Affected surfaces
<Mark each surface applied or not applicable, with a reason: host and sandbox;
lifecycle door; canonical and provider surfaces; root and scaffold;
interactive and headless processes; local and remote operation;
parallel operation; public documentation; verification.>

## Risks, rollback, and open questions
<Failure modes, recovery steps, required permissions, and unresolved decisions. Write "None" when no questions remain.>

## Approval and handoff
<This draft does not authorize execution. Name the operator decisions required before the build.>
```

## 6. Verify and report

1. Re-read the saved plan from disk.
2. Confirm that both required sections contain task-specific content.
3. Check every DoD identifier against the implementation and orchestration tables. Reject missing coverage or dangling identifiers.
4. Confirm that each criterion has an observable pass condition, evidence, and an owner.
5. Confirm that every bounded assignment carries all required fields and that no read-only worker owns edits.
6. Run `bash .agro/skills/ste/scripts/ste-check.sh <plan-path>` from the harness repository. Use an absolute plan path for another repository.
7. Fix checker findings and review meaning with `/ste`'s ten-question check.
8. In Git, confirm that an ignore rule covers the saved file and that `git ls-files -- <plan-path>` returns no entries.
9. Report the path, status, unresolved questions, and validation results.
10. If a Markdown revision changes the content, report any existing sibling `plan.html` as stale. Do not overwrite the rendering automatically.

Use `DRAFT` only when the plan passes validation and awaits operator approval.
Use `BLOCKED` when a required decision, prerequisite, or validation remains unresolved.
Report `UNCHANGED` when a requested revision needs no content changes and the existing plan passes validation.
If writing fails, report `FAILED` with the cause. Do not claim that a plan exists without reading it back.
To undo creation, remove only the new plan after operator confirmation; preserve other drafts and existing ignore rules.

After approval, offer `/spec plan --plan .agro/plans/<slug>/plan.md` for task scaffolding only.
Offer `/spec .agro/plans/<slug>/plan.md` only when the operator requests the approved build.
Do not treat generating or revising a plan as approval.

## Examples and boundaries

- `/plan add retry limits to webhook delivery` creates a grounded draft without implementation.
- `/plan .agro/plans/webhook-retry-limits/plan.md` reads the existing draft before revision.
- `.agro/plans/webhook-retry-limits/plan.html` can hold an optional rendering of that same plan.
- `/plan` without a planning request prints usage and writes nothing.
- If a saved plan fails validation, revise that same plan and rerun the checks; do not create duplicate recovery drafts.
- Use `/imagine` for a speculative PRD sketch, `/prd` for structured requirements, and `/spec plan` for an executable task folder.
