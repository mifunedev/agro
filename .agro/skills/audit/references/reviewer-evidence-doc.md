# Reviewer evidence — the PR body contract

The human-readable proof a reviewer reads to see *that the change works*, not merely
*that a verdict was emitted*. It is written **into the pull request description**, so
it arrives with the review itself.

**It is a gate condition.** `/spec execute` refuses to undraft a PR whose body does not
carry it. The operator's understanding of the work stops at the plan they approved;
everything after that happened inside a compacted session they did not watch. These
sections are how the build answers back to that plan, which is what makes approving a
merge an informed act rather than a trusting one.

**No task-folder file carries this record.** The retired `.agro/tasks/<slug>/evidence.md`
lived under a gitignored path, so it reached the reviewer only through a forced add; one
written without `git add -f` was present on disk and absent from the PR diff, which from
the reviewer's seat is identical to never having written it. The PR body has no such
failure mode: there is one surface, GitHub versions every edit of it, and the reviewer
cannot miss it.

**This is not the lifecycle evidence contract.** `AUDIT_EVIDENCE_PATH`
(`evidence.json`, schema v1, invocation-scoped and never inside `AUDIT_ROOT`) is the
machine record that lets the boundary log `complete`. The reviewer evidence is a
separate, human-addressed narrative in the PR description.

## Ownership — the audit routes do not write it

`/audit implementation` and `/audit pr` are read-only: they decide, they do not mutate
the repository and they do not edit the PR. Neither route writes these sections. The
**orchestrating caller** writes them from the observations those routes returned — in
the shipped workflow that caller is `/spec execute`, after its `/audit pr` delegation
returns. A route that wrote the body itself would break its report-only contract.

## Contract

- **Surface**: the pull request description, written with
  `gh pr edit <N> --repo <owner/name> --body ...` and read back with
  `gh pr view <N> --json body --jq .body`. There is no second copy and no companion
  file; a reviewer who opens the PR has already found the evidence.
- **Complete**: every one of the five sections below is present with content. The gate
  reads the body back from GitHub, because the body a reviewer sees is the one on the
  server — not the heredoc the session believed it sent.
- **Observed only**: every claim quotes output that actually ran during the audit —
  the exact command and its real output, trimmed but never paraphrased into a
  summary that could not be reproduced. Predicted, expected, or reconstructed
  output is forbidden; a gate with no observed output is recorded as a gap, not as
  a pass.
- **Correlated**: record the `AUDIT_RUN_ID` and the native verdict verbatim
  (`AUDIT-PASS` / `AUDIT-FAIL` / `PR-AUDIT-PROMOTABLE` / `PR-AUDIT-BLOCKED` /
  `PR-AUDIT-UNKNOWN`), so the body is traceable to one audit log entry.
- **Honest**: non-gating pre-existing reds, skipped gates, and not-applicable gates
  are stated as such. An `AUDIT-FAIL` still gets a body — it records what was proven
  and what blocked.
- **Repo-safe**: screenshots and scratch output stay under `AUDIT_TMP_ROOT`
  (invocation-scoped, deleted); describe what was observed rather than committing
  binaries into the task folder.
- **Follow-ups are cited, not named**: an acceptance criterion recorded as satisfied
  by work outside this repository — a mirror issue, a downstream PR, a tracked
  follow-up — is met only when that artifact **exists** and the body carries its
  resolvable URL. Naming a follow-up in prose is a plan, and a plan reads as
  satisfaction to every reader who does not go looking. File it, then cite it. No
  gate here can see an artifact in another repository, so this line is the only
  thing standing between "deferred" and "done".
- **Answers back to the plan**: the five sections below are not optional prose. Three of
  them — *why this is better*, *divergence* and *unverified* — are the things a reviewer cannot reconstruct
  from the diff, so an empty one is written as `None` / `Nothing` explicitly. Omitting
  them reads as "nothing diverged, nothing unchecked", the most expensive claim this
  record can make by accident, and `/spec execute` refuses the undraft for it.

## The five questions

Every PR body answers these, in this order, before the per-gate proof:

0. **Why this is better than not doing it** — the first question, because it is the only
   one a reviewer cannot answer for themselves. State the *before* and the *after* as the
   operator experiences them, with a number wherever one exists, and name the cost paid to
   get there. A benefit nobody can measure is written as *claimed, unmeasured* — never
   dressed up as proven. Verification output belongs to questions 2 and 4; this question
   is about consequence, not correctness. A body that proves every gate green and never
   says what improved has failed its reader.
1. **What the plan asked for** — the approved `prd.md`'s goals in the operator's terms,
   not a restatement of the story titles.
2. **What was built** — the observable behavior that now holds.
3. **Where they diverged, and why** — every place the build differs from the approved
   plan: a criterion satisfied differently, a deliberate deviation, a mid-build scope
   call. Explicitly `None` when there was none.
4. **What remains unverified** — skipped gates, criteria argued rather than observed,
   pre-existing reds carried forward, a `SIMPLICITY-RESIDUAL` list the simplify loop
   ended on, anything a reviewer must check by hand. Explicitly `Nothing` when there is
   none.

**Why question 0 is first and separate.** Questions 1–4 prove the change is *correct*.
None of them establishes it was *worth making*. A body can pass every gate, diverge nowhere,
and leave nothing unverified while the reader still cannot say what is better than the repo
without it — which is the review they were actually asked for. Correctness evidence answers
the auditor; this question answers the operator.

## Shape

The PR description:

```markdown
Closes #<N>.

**Status: <READY | DRAFT-BLOCKED(<gate>)>** · **Audit run**: <AUDIT_RUN_ID> · **Verdict**: <NATIVE-VERDICT>

## Why this is better

<the before/after a reviewer would otherwise have to infer: what was worse without this
change, what is better now, the number where one exists, and what it cost. Benefits with
no measurement behind them are labelled "claimed, unmeasured".>

## What the plan asked for

<the approved prd.md's goals in the operator's terms — 2-4 lines, not the story titles.>

## What was built

<2–4 sentences: the problem the change solves, and the observable behavior that
proves it is solved.>

## Knowledge impact

<each impacted page and its final state: UPDATED / REVERIFIED / NOT-AFFECTED (reason).>

## Where it diverged from the plan, and why

<every deliberate deviation, differently-satisfied criterion, and mid-build scope
call, each with its reason — or the single word "None".>

## What remains unverified

<skipped gates, criteria argued rather than observed, pre-existing reds carried
forward, anything needing a hand check — or "Nothing".>

## Proof by gate

| Gate | What was checked | Observed | Result |
|------|------------------|----------|--------|
| Task graph | `prd.json` stories + artifact contract | `<t>/<t> stories pass` | PASS |
| Regression floor | `/eval` runner exit + delta | `rc=0`, no new green→red | PASS |
| Promotable / CI | focused classifier JSON | `promotable=true`, `evidenceComplete=true` | PASS |
| UI | browser criteria | n/a — no story declares browser verification | N/A |
| Slop | net lines + changed-function CCN | `+<netAdded>/-<netRemoved>`, `<n>` over CCN <max> | PASS |

## Observed output

```text
$ <exact command>
<real output, trimmed>
```

## Acceptance criteria → proof

| Story | Criterion | Proof |
|-------|-----------|-------|
| US-001 | <criterion> | <file:line, or the observed-output block above> |

## Gaps and non-gating findings

- <pre-existing red, skipped check, or explicit "none">
```
