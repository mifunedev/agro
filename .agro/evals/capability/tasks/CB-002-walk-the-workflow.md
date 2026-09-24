---
id: CB-002
slug: walk-the-workflow
title: "Walk the core chain end-to-end"
axes: [success, cost-time, unattended]
skills: [/prd, /git, /delegate]
created: 2026-06-19
---

# CB-002 · Walk the core chain end-to-end

## Task
Walk the core chain (`/prd` → draft PR → `/delegate` → ready PR) from an issue to a ready-for-review PR. Advance each stage through its gate with no dead ends. The capability under test carries one unit of work from plan to ready PR. The run keeps the plan-approval commitment gate. The run stops at the human merge gate and does not merge.

## Success signal
- `/prd` writes `.agro/tasks/<slug>/prd.md`, and the operator approves it before any issue, branch, or PR exists.
- After approval, `/prd` writes `prd.json`, and the `/git` "Draft PR for a task" procedure opens the issue, the branch, and the draft PR with the plan as the first commit.
- `/delegate` runs each story as a bounded worker. The advisor alone writes `passes`, `commit`, and `notes` in `prd.json`.
- `prd.md` ends with a non-empty `## Lessons` section.
- The `/git` "Ready for review" step marks the PR ready with CI green, then the run **stops at the human merge gate** (no auto-merge).
- The `workflow-boundaries` and `delegate-worker-boundary` probes are green.

## Rubric
| Axis | PASS | PARTIAL | FAIL |
|------|------|---------|------|
| success | A unit advances `/prd` → draft PR → `/delegate` → ready PR; the plan-approval gate fires before any GitHub state; every story passes with advisor-written acceptance notes; `## Lessons` is present; the run stops at the human merge gate; `workflow-boundaries` + `delegate-worker-boundary` green | Reaches a ready PR but one gate was implicit (for example, GitHub state existed before the plan was approved, or `## Lessons` is empty) | Auto-merged, skipped the plan-approval gate, or stalled without an honest stop |
| cost-time | One pass through the chain ships the unit, no rework loops | One story re-dispatched before acceptance | Repeated rejected stories before a ready PR |
| unattended | The chain runs from plan approval to a ready PR with zero human intervention before merge | Completed but a human had to unblock one stage | Required hands-on driving to advance the stages |

## Evidence basis
The core chain is defined in `.agro/skills/prd/SKILL.md`, `.agro/skills/git/SKILL.md` (§ Draft PR for a task, § Ready for review), and `.agro/skills/delegate/SKILL.md`. A human approves the plan. `/delegate` owns the build. The human owns the merge. Retargeted in #263 from the removed `walk-the-loop` task.

**Re-authored 2026-09-23 (#1156).** Issue #1156 retired `/spec`. The task now walks the core chain that replaced it. The `success` axis now checks the `/delegate` acceptance record and the `## Lessons` section. These checks replace the retired single-procedure readability rule. Scores from before this date are NOT comparable on that axis.

**Baseline reset 0.3.0 (autopilot removal).** Release 0.3.0 removed the `select` node and its sole runner. A human enters the chain at `/prd`. The `unattended` axis measures the build only, not selection, so pre-0.3.0 scores are NOT comparable on it.

## Scoring method
v1: on the branch under evaluation, drive one unit through the core chain (`/prd` → draft PR → `/delegate` → ready PR). Inspect the artifacts against the rubric. Confirm these items:

- The `.agro/tasks/<slug>/` folder holds `prd.md` and `prd.json`.
- The plan-approval gate came before any GitHub state.
- `jq -e 'all(.userStories[]; .passes == true)' .agro/tasks/<slug>/prd.json` exits 0.
- `prd.md` has a non-empty `## Lessons` section.
- The PR is ready with CI green, and the run stopped at the human merge gate.

Then confirm the `workflow-boundaries` and `delegate-worker-boundary` probes are green. If `/prd` or `/delegate` is not present on the branch under evaluation, mark this task SKIPPED (capability not present here) rather than FAIL.
