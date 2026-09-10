# Audit implementation — per-unit verdict gate

The **audit** gate, composed by `/spec execute` in `.agro/skills/spec/SKILL.md`. It answers
one question: *does this one implementation satisfy its task graph and is it
promotable?* — and emits exactly one verdict the caller routes on.

**Core principle: compose, don't re-derive — and never infer green from silence.**
This skill owns the *verdict*, not the checks. Each gate below is an existing
primitive; `/audit implementation` runs them in fail-fast order and integrates their results
into a single `AUDIT-PASS` / `AUDIT-FAIL`. It is **read-only**: it decides, it
does not mutate (no `gh pr ready`, no `gh pr merge`) and does not fix — promotion
is a downstream concern and remediation belongs to the build step on
`AUDIT-FAIL` (single-owner handoff: the outcome is decided here, acted on elsewhere).

> **Not a survey target.** `/audit prs` triages the *whole* open-PR queue in one
> bulk query (*"never loop per-PR"*, `audit/references/prs.md`); `/audit implementation`
> is the opposite shape — a single unit (1 impl vs. 1 `prd.json`). It consumes the
> same focused classifier used by `/audit pr`; it does not replace or fork it.

---

## Inputs

| Arg | Meaning |
|-----|---------|
| `<slug>` | The task slug — locates `.agro/tasks/<slug>/prd.json` and `.agro/tasks/<slug>/progress.txt`. Required. |
| `--pr <N>` | The PR for this unit, if one exists. When set, gate 3 uses the shared focused classifier (which reads `statusCheckRollup`, subsuming `/ci-status`). |
| `--repo <owner/name>` | Repository passed unchanged to focused PR acquisition. Required with `--pr`; never inferred from the process checkout or a hard-coded default. |
| `--base <branch>` | Expected PR base for focused classification. Defaults to `development`; set it to the parent branch for a stacked PR. |
| `--branch <branch>` | The work branch. Used by gate 3's `/ci-status` fallback when there is no PR yet (e.g. an autopilot pre-PR audit). Defaults to the current branch. |

---

## The five gates (fail-fast, in order)

Run in order; the **first** gate that fails decides the verdict (`AUDIT-FAIL`,
naming the gate). Only when **all** applicable gates pass is the verdict
`AUDIT-PASS`. A gate whose signal is missing or ambiguous is a FAIL, never a pass
(honest exits).

### Gate 1 — Task-graph conformance + artifact contract

Gate 1 has **two gating sub-checks**; either failing is an `AUDIT-FAIL`. Execute
the production helper `"$AUDIT_ROOT/.agro/skills/audit/scripts/implementation-gates.sh" gate1 "$SLUG"`;
the snippets below explain its behavior and are not a second implementation. The scripted
driver (`scripts/route-driver.sh`) runs this helper first and reports `gate1: FAIL` on a
non-zero exit.

**(a) Task-graph conformance.** Every user story in the task graph must be marked
complete. The implementation owner flips `passes: false → true` only after validating each story, so
the graph is conformant only when **zero** stories remain unfinished:

```bash
SLUG="$1"; PRD="$AUDIT_ROOT/.agro/tasks/$SLUG/prd.json"
[ -f "$PRD" ] || { echo "FAIL gate1: no $PRD"; exit 1; }
unfinished=$(jq '[.userStories[] | select(.passes != true)] | length' "$PRD")
total=$(jq '.userStories | length' "$PRD")
echo "task-graph: $((total - unfinished))/$total stories pass"
[ "$unfinished" -eq 0 ] || { echo "FAIL gate1: $unfinished story(ies) not passing"; exit 1; }
```

**(b) Artifact contract.** If the `prd.json` declares an `artifact_contract` block
(see the [artifact-contract schema](../../../../docs/artifact-contract-schema.md)), every
path in `artifact_contract.required_artifacts` must exist on disk. This is a
**gating** sub-check — a declared-but-missing artifact is a hard `AUDIT-FAIL`, not
an advisory warning. The block is **optional and additive**: a `prd.json` with no
`artifact_contract` key yields an empty list and passes this sub-check unchanged,
so the gate keeps its pre-contract behavior for specs that declare no contract:

```bash
# Gating: a declared required_artifact that is absent on disk fails Gate 1.
# Optional block — no .artifact_contract ⇒ empty list ⇒ unchanged pass.
while IFS= read -r artifact; do
  [ -z "$artifact" ] && continue
  case "$artifact" in /*) echo "FAIL gate1: artifact must be AUDIT_ROOT-relative: $artifact"; exit 1;; esac
  artifact_path="$AUDIT_ROOT/$artifact"
  resolved=$(realpath -e -- "$artifact_path") || exit 1
  [ "$resolved" = "$artifact_path" ] && case "$resolved" in "$AUDIT_ROOT"/*) :;; *) false;; esac \
    || { echo "FAIL gate1: required_artifact is non-canonical, symlinked, or outside AUDIT_ROOT: $artifact"; exit 1; }
done < <(jq -r '.artifact_contract.required_artifacts // [] | .[]' "$PRD")
```

A non-conformant graph **or** a missing required artifact is `AUDIT-FAIL` →
`implement` (resume the unfinished stories, or produce the promised artifact). Do
not advance to the later gates. A worked fixture proving the artifact sub-check
fails on a missing path lives at
[`../fixtures/artifact-contract.prd.json`](../fixtures/artifact-contract.prd.json)
(exercised by `.agro/evals/probes/artifact-contract-audit.sh`).

### Gate 2 — Regression floor (`/eval`)

The probe suite must stay green for this change. Gate on the runner's **exit code +
delta**, not its prose.

**Read the cycle's result before running the suite.** `/spec execute` runs `/eval` once
per cycle and publishes `.agro/tasks/<slug>/eval-result.json`. Reuse it **only while it
describes the code under test** — that is, while its `commit` equals the current
`HEAD`:

```bash
RESULT=".agro/tasks/<slug>/eval-result.json"
if [ -f "$RESULT" ] && [ "$(jq -r .commit "$RESULT")" = "$(git rev-parse HEAD)" ]; then
  rc="$(jq -r .runnerExit "$RESULT")"          # inherit the cycle's single run
else
  AUDIT_RUN_ID="$AUDIT_RUN_ID" AUDIT_ROOT="$AUDIT_ROOT" \
    bash "$AUDIT_ROOT/.agro/skills/eval/run.sh" ; rc=$?
fi
# rc=0 → no NEW green→red regression for this commit (pass)
# rc=1 → at least one new regression (FAIL gate2)
```

The scripted driver runs exactly this reuse-or-run step and reports `gate2: FAIL` on a
non-zero exit. The commit check is what keeps the reuse honest: the moment the branch moves, the
record describes code that is no longer under test, and this gate runs the suite
itself rather than inheriting a stale green. **Never** reuse a record whose `commit`
you did not compare, and never treat a missing record as a pass.

Block only on a **new** `green→red` regression or a non-zero runner exit. A
pre-existing red with an unchanged delta is non-gating but MUST be disclosed in
the verdict. (Mirrors `/spec execute`'s `/eval` gate and `.agro/evals/probes/eval-gate.sh`.)

### Gate 3 — Promotable / CI state

The implementation must be promotable: CI green **and** (for a PR) mergeable and
clean.

- **PR exists (`--pr N --repo O/N`):** invoke
  `"$AUDIT_ROOT/.agro/skills/audit/scripts/implementation-gates.sh" classify-pr "$REPO" "$PR" "$BASE"`.
  That production helper calls the shared acquisition and classifier and returns
  their fresh JSON. Consume only
  `.promotable`, `.readyForReview`, `.readyToMerge`, and `.evidenceComplete`.
  Pass only when evidence is complete and promotable; `NONE` and `UNKNOWN` fail.
  Never parse Markdown or a human routing token. The acquisition reads
  `statusCheckRollup`, so do not also poll CI.
- **No PR yet:** fall back to `/ci-status` on `--branch`. A `NO-RUN` CI status is
  **not** a pass (no run ≠ green) — that is `AUDIT-FAIL` until a run is dispatched
  and lands green.

The scripted driver runs the `classify-pr` helper when the caller passes `--pr`. Without
`--pr` the driver queries `gh run list --branch <branch>` and passes only when every run
for `HEAD` has status `completed` and conclusion `success`; no run for `HEAD` fails with
`gate3: FAIL (no green CI run for HEAD)`.

### Gate 4 — UI verification (conditional)

Gate 4 applies when a story in the task graph declares browser verification:

```bash
grep -qi "agent-browser\|Verify in browser" "$AUDIT_ROOT/.agro/tasks/$SLUG/prd.json" && echo "UI gate applies"
```

The production helper's `browser-required` mode runs this check. When no story
declares browser verification, the gate is **not applicable**, and no part of the
audit invokes `agent-browser`.

**Who produces the evidence.** The owner of `/spec execute` produces it, before the
audit. The owner runs the helper's `browser-preflight` mode (not the ordinary
`/agent-browser` repair/install preflight). The preflight requires `command -v
agent-browser` and a successful `agent-browser --version`, creates a profile beneath
`$AUDIT_TMP_ROOT`, launches only `about:blank` in session `audit-$AUDIT_RUN_ID`, then
closes that session and removes the profile. It sets `HOME` to that profile for every
browser command. The preflight does not install, download, repair, navigate to the application,
write under `AUDIT_ROOT`, or touch GitHub. It compares status, tracked content, index,
and untracked-content snapshots before and after. The preflight fails on any delta, including
a change to a file already dirty before the run. After a successful preflight the owner
drives `/agent-browser` against the running application and checks each acceptance
criterion. Screenshots stay under `$AUDIT_TMP_ROOT`, never in the repository. A
reviewer who did not write the code under review reads the screenshots against the
criteria, and the owner writes the verdicts to the record.

**The record.** `.agro/tasks/<slug>/ui-evidence.json`, schema version 1. The owner writes
it for the `HEAD` that the reviewer verified and adds it with `git add -f`:

```json
{"schemaVersion":1,"commit":"<40-hex HEAD verified>","verifiedAt":"<ISO-8601>",
 "preflight":{"runId":"<AUDIT_RUN_ID of the browser-preflight run>","exit":0},
 "reviewer":"<human or bounded read-only worker id>",
 "criteria":[{"story":"US-00N","criterion":"<text>","result":"PASS"|"FAIL",
              "screenshotSha256":"<hex>","note":"<what was observed>"}]}
```

The record carries the sha256 of each screenshot and the observation, so a later
reader can match a stored screenshot to the verdict without the repository holding the
image.

**What the scripted driver enforces.** `scripts/route-driver.sh` never runs a browser.
When `browser-required` exits 1 it prints `gate4: not applicable`. When it exits 0 the
driver reads the record and fails closed on each of these conditions, naming the
reason:

| Condition | Report line |
|---|---|
| Record missing, symlinked, unreadable, or `commit` neither `HEAD` nor the content head | `gate4: FAIL (no ui evidence for HEAD <sha>)` |
| Record does not match schema version 1 | `gate4: FAIL (malformed ui-evidence.json)` |
| `preflight.exit` ≠ 0 | `gate4: FAIL (browser-preflight run <runId> exited <n>)` |
| `criteria` is empty | `gate4: FAIL (no criteria verified)` |
| Any criterion has `result: FAIL` | one `gate4: FAIL criterion <story> <criterion> — <note>` line per failure, then `gate4: FAIL (<n> criteria FAIL)` |
| Otherwise | `gate4: PASS (<n> criteria verified by <reviewer> at <commit>)` |

**The content-head rule.** The driver accepts a record whose `commit` equals `HEAD`.
The driver also accepts a record whose `commit` is an ancestor of `HEAD` when only
record files changed since. Record files are paths under the audited task folder
`.agro/tasks/<slug>/` and `.agro/evals/RESULTS.md`. The driver prints which case applied:
`gate4: ui evidence commit <sha> equals HEAD` or
`gate4: ui evidence commit <sha> is the content head; only task records changed since`.
The same rule keys the `eval-result.json` reuse in gate 2 and the review in gate 5.
A stale record is not a pass: the moment code moves, the owner must re-verify
and rewrite the record for the new `HEAD`. The driver enforces the record; the
reviewer and the owner judge what the screenshots show.

### Gate 5 — Slop (less code, low complexity)

The correctness gates above prove the change *works*. None of them can fail a change
that works and is twice the size it needed to be. This gate asks the one question that
closes that hole:

> **Can this diff be smaller and still satisfy every acceptance criterion in `prd.json`?**

While the answer is yes, the verdict is `AUDIT-FAIL` and the build simplifies. The goal
stays one sentence on purpose — the ingenuity belongs in the execution, not in the
objective. Less code is less code to maintain and fewer places for a bug to live.

**Signals.** Run
`"$AUDIT_ROOT/.agro/skills/audit/scripts/implementation-gates.sh" slop-metrics "$BASE"`,
which emits one JSON object. Report every number in the verdict:

| Field | Meaning |
|---|---|
| `netAdded` / `netRemoved` | Lines the unit's diff adds and removes vs. `--base`, excluding lockfiles, `.agro/evals/RESULTS.md`, and symlinked provider mirrors. `netAdded` is the headline number the loop drives down. |
| `tsOverCcn` | Functions in the changed `.ts`/`.js`/`.mjs` files over `ccnMax` (default 10), from `uvx lizard`. **Real per-function cyclomatic complexity.** |
| `shBranchPoints` | The *net* change in branch tokens across changed `.sh` files. No complexity tool parses bash, so this is an explicit **proxy** — never report it as CCN. |
| `tool` | `lizard <version>`, `lizard n/a (no analysable files changed)`, or `unavailable`. |

`tool: unavailable` means `uvx lizard` could not resolve (an offline runner). The
complexity signal is then **SKIPPED and disclosed** — an empty `tsOverCcn` from an
unavailable tool is never reported as a clean complexity result. Never infer green from
silence.

**Findings — the termination rule.** Every finding MUST cite `file:line`, name the
concrete simpler alternative, and state the lines it removes. **A finding with no
concrete simpler alternative is not a finding.** That rule is what keeps this gate an
engineering check rather than an unbounded argument about taste. Typical shapes: a
primitive the repo already has, an abstraction with exactly one call site and no
criterion requiring it, a new file where editing an existing one would do, a path no
story exercises.

A finding is **blocking** only when its alternative satisfies every acceptance criterion
with no new work. Anything else is disclosed, non-gating. A function the diff
*introduces* above `ccnMax` is blocking; one already over the threshold on the base is
disclosed only — the same pre-existing/new distinction gate 2 makes.

**Who produces the findings.** A fresh read-only reviewer who did not write the code
under review reads the diff at `HEAD` and returns findings in the shape above. The owner
of `/spec execute` writes them to `.agro/tasks/<slug>/simplicity-review.json`, schema
version 1, and adds the file with `git add -f`. The driver never writes this record, and
the implementer of the code under review never writes it:

```json
{"schemaVersion":1,"commit":"<40-hex HEAD the review read>",
 "reviewer":"<bounded read-only worker id or human>","reviewedAt":"<ISO-8601>",
 "findings":[{"file":"<repo path>","line":<int>,"simplerAlternative":"<concrete>",
              "removesLines":<int>,"blocking":true|false,
              "status":"open"|"resolved","resolvedIn":"<commit or null>"}]}
```

**The bounded, monotone loop.** The owner keeps the round record
`.agro/tasks/<slug>/simplify-rounds.json` with the fields `rounds`, `netAdded`,
`lastCommit`, and `nonReducing`. The owner sets `nonReducing: true` when a round's
`netAdded` did not strictly fall below the previous round's. The loop **terminates**
when `rounds >= 3` or when `nonReducing` is `true`. The loop ends when the diff cannot shrink further,
not on taste, so it terminates by construction.

**What the scripted driver enforces.** `scripts/route-driver.sh` runs these steps in
order and fails closed:

1. Print `gate5: metrics <json>` from `slop-metrics <base>`. When `tool` starts with
   `lizard` and `tsOverCcn` is non-empty, print `gate5: SIMPLICITY-RESIDUAL disclosed`.
2. Read `simplicity-review.json`. When the file is missing, symlinked, malformed, or its
   `commit` is neither `HEAD` nor the content head (see the content-head rule in gate 4), report
   `gate5: FAIL (no simplicity review for HEAD <sha>)` and publish `AUDIT-FAIL`. A stale
   or absent review is not a pass.
3. Read `simplify-rounds.json` when present. A file whose `rounds` is not a number
   reports `gate5: FAIL (malformed simplify-rounds.json)`. Otherwise the driver prints
   `gate5: rounds <json>` and computes the termination rule above.
4. Print one `gate5: open <file>:<line> — <alternative>` line for every open finding,
   so the report carries the judgment.
5. When a finding has `blocking: true` and `status: open` and the loop is not
   terminated, report `gate5: FAIL (<n> blocking simplicity finding(s) open)` and
   publish `AUDIT-FAIL`.
6. When blocking findings are open and the loop has ended, report
   `gate5: PASS with SIMPLICITY-RESIDUAL (<n> open finding(s) after <rounds> round(s))`
   and continue.
7. Otherwise report
   `gate5: PASS (review <reviewer> at <commit>, <n> finding(s), none blocking open)`.

This route **reads** both records. It never writes or increments them — the
orchestrating caller owns those files, exactly as it owns `evidence.md`. The driver
enforces the contract; the reviewer supplies the findings and the owner judges the
route for each one.

---

## Verdict

| All applicable gates pass | Any gate fails |
|---|---|
| `AUDIT-PASS` → `retro` | `AUDIT-FAIL` → `implement` (resume) |

State the verdict, then — on the **final line** — emit the routing token. Always
name the deciding gate on `AUDIT-FAIL` and disclose any non-gating pre-existing
red from gate 2. An `AUDIT-PASS` reached at the gate-5 round cap or on a
non-reducing round carries `SIMPLICITY-RESIDUAL: <n>` with the residual findings;
a `PASS` that hides residual slop is the one thing this gate exists to prevent.

---

## What this skill does NOT do

- **Mutate PR state.** No `gh pr ready`, no `gh pr merge`, no labels. The verdict
  is read-only; undrafting/merging is a separate, downstream decision.
- **Fix anything.** Remediation is the `implement` node's job on `AUDIT-FAIL`.
- **Fork PR classification.** It consumes the same private classifier JSON as
  `/audit pr` and `/audit prs`.
- **Re-run a passing gate.** Fail-fast: stop at the first failing gate.
- **Write the gate-4 or gate-5 records.** It reads
  `.agro/tasks/<slug>/simplify-rounds.json`, `.agro/tasks/<slug>/simplicity-review.json`,
  and `.agro/tasks/<slug>/ui-evidence.json`; the orchestrating caller writes them.
- **Run a browser.** Gate 4 reads the owner's verified record; the owner and a
  reviewer produce it.
- **Apply the simplification.** Gate 5 names the smaller alternative; removing the
  code is the `implement` node's job, like every other `AUDIT-FAIL`.
- **Write the reviewer evidence doc.** The per-gate observations above are what
  `.agro/tasks/<slug>/evidence.md` is built from, but the orchestrating caller writes and
  commits it — see [`reviewer-evidence-doc.md`](reviewer-evidence-doc.md).

---

## Memory Protocol

Return this structured observation to the outer dispatcher; do not report a run record from this route. The dispatcher prints the one terminal run record:

```markdown
## audit -- HH:MM UTC
- **Result**: OP
- **Unit**: <slug> (PR #<N> / branch <branch>)
- **Verdict**: AUDIT-PASS | AUDIT-FAIL (gate <n>: <reason>)
- **Gates**: graph <p/t> · eval <rc> · promotable <class> · ui <pass|n/a> · slop +<netAdded>/-<netRemoved> (<clean|blocking n|residual n>)
- **Observation**: <one sentence>
```
