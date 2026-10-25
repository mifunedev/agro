Use /supervisor to drive advisors through the project’s open PR backlog. Each advisor owns one item from qualification through closure or delivery, using /council for independent evaluation, /prd for scope, and /delegate for implementation. Follow the canonical skills for execution, monitoring, verification, and escalation.

1. Establish the backlog and batches.
Read the project instructions and enumerate all open PRs, including drafts. Inspect linked issues and identify duplicate, overlapping, or dependent work.

Process the queue in batches of up to three advisors, with one item assigned to each advisor. Each advisor owns its isolated worktree and branch. Serialize items with overlapping changes or dependencies.

Wait until every advisor in the current batch reaches closure, a completed PR marked ready, or a documented blocker before starting the next batch. Let /delegate govern each advisor’s workers.

2. Investigate and qualify.
For each PR, inspect its linked issue, discussion, diff, relevant code, tests, and current repository direction. Determine whether the underlying problem remains real, whether it is already addressed elsewhere, and whether solving it justifies the implementation and maintenance cost.

Have the advisor use /council to evaluate three distinct perspectives:
- User impact and alignment with project goals.
- Technical validity, root cause, and verifiability.
- Necessity, simpler alternatives, and regression risk.

Require independent initial assessments and an adversarial critique before the advisor synthesizes the decision. Preserve material dissent; do not repeat deliberation until agreement appears.

3. Score the opportunity.
The advisor assigns evidence-backed ratings from 0–5, using these weights:
- Demonstrated problem and user impact: 30%.
- Alignment with current project goals: 20%.
- Expected benefit relative to implementation and maintenance cost: 20%.
- Confidence in root cause and verifiable acceptance criteria: 15%.
- Simplicity and manageable regression risk: 15%.

Calculate the total out of 100 as the sum of each weight multiplied by its rating divided by five. Treat missing evidence as unknown, not zero. Scores summarize evidence; they do not replace it or represent a vote.

Qualify at 80/100 or higher only when the council evidence supports proceeding and no material objection remains unresolved. Judge the value of addressing the problem separately from defects the advisor can repair in the existing PR.

4. Decide and act.
- YES: Record the score, supporting evidence, dissent disposition, and smallest justified scope. Use /prd to define binary acceptance criteria, then /delegate to complete the work.
- NO: When sufficient evidence supports rejection, post the score and concise rationale, then close the PR. Do not automatically close its linked issue.
- BLOCKED: If evidence or consensus is insufficient, leave the PR open and report the precise unresolved question. Do not equate uncertainty with rejection.

Complete accepted PRs in place rather than creating duplicates. Preserve existing useful work and accepted task state. Recheck the PR’s current state and head before changing it; reassess material changes made by others.

5. Implement and verify.
The advisor owns planning, judgment, verification, and acceptance. Assign tracked implementation edits to bounded workers through /delegate.

The advisor inspects and integrates worker results, reruns acceptance checks, maintains the PRD tracker, and completes the required PR evidence. Return failed checks to the responsible worker for bounded repair.

Keep unfinished work in draft. Use /ci-status and the Git skill’s readiness gates to verify actual checks on the current PR revision before marking it ready. Missing, stale, pending, or unexpectedly skipped checks are not evidence of success. Do not merge.

6. Supervise through completion.
Use /supervisor’s canonical monitoring, context management, and escalation procedures. Judge completion from artifacts and verification evidence, not an idle advisor or an unsupported status claim.

Persist assignments and outcomes so an interrupted run can resume without duplicate dispatch. A blocked item may release its batch slot once the blocker is recorded and the advisor is safely stopped. Start the next batch only after all items in the current batch have reached an outcome.

This prompt authorizes decision comments, rejection closures, and planning, implementation, pushes, and readiness changes for qualifying work within the evaluated scope. No separate approval pause is needed for those actions. Escalate material scope expansion and blockers through /supervisor.

Finish with a compact table: item, advisor, score, decision, rationale, PR status, verification evidence, and any blocker. Clearly distinguish completed work from unresolved backlog.