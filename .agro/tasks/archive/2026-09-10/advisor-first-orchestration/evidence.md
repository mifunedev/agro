# Evidence: advisor-first orchestration (#988, ADR #989)

Branch `feat/988-advisor-first-orchestration`, PR #991. Content commits: policy `50515549`+`17a510de`+`ae296157`, docs `aa001fa8`+`7ed847d3`+`14127d7c` plus the CB-001 note, probes `758457f2`+`8cd488e5`, knowledge `ceced13c` plus two pattern pages (`f30900a4`); eval records and this document follow them. The independent review (T5) of `72548bc4` returned five blocking findings; their dispositions are in section 3 and the repairs are the two commits `ae296157` (T1) and `8cd488e5` (T2). A fresh review (Explore built-in with `model: fable`, self-reported `claude-fable-5-1`) ran on the repaired head `e67e5481` and found no blocking defect; the audit routes then ran on the head recorded under "Audit correlation".
Audit correlation: `AUDIT_RUN_ID` and native verdicts are appended in "Audit correlation" below after the audit routes run.

## 0. Why this is better than not doing it

Before: five active instruction surfaces told the build owner to implement directly and treated bounded workers as optional. `AGENTS.md`, `/spec execute` steps 3–4, the rendered task prompt, `/delegate` ("inherit the parent model; do not route routine work to a weaker tier"), and the local `/plan` skill all agreed on that default. The operator's advisor-first request could only be met by a handoff message, and a handoff cannot override contradictory canonical instructions.

After: one execution model in all five surfaces. The active session advises, decomposes, dispatches bounded workers, inspects evidence, and accepts. Workers own tracked edits. A direct owner edit needs a recorded operator exception. Same session by default; transfer only on operator request. Model policy honors explicit operator selections after a native capability check and blocks on an unsupported control instead of substituting.

This build ran under the new contract before it landed: every written policy, probe, docs, and knowledge edit in this PR came from a bounded worker (T1–T3) and was accepted by the advisor after re-running the checks. The advisor committed execution-state artifacts (`prd.md`, `prd.json`, `progress.txt`, `delegate-graph.json`, `delegate-log.txt`, `eval-result.json`, this file), the `/eval` scoreboard `.oh/evals/RESULTS.md`, and one byte-identical baseline copy of the untracked `.oh/skills/plan/SKILL.md` in the scaffold commit so T1 could reconcile it. No operator exception covers those two tracked files; the deviation is disclosed here and in `progress.txt`.

Observed in this run: the `Explore` built-in reported `claude-opus-5[1m]` although the call omitted `model`, so a provider built-in can carry its own model definition. Inheritance is not assumed for any worker whose model was not observed.

Cost paid, observed: five worker dispatches, three repair round-trips (one duplicate list number, one changelog section/voice, one changelog length), one worker interruption by a provider limit and resume. Harness-reported subagent usage: T1 ~186k tokens, T2 ~141k plus an uncounted interrupted partial, T3 ~128k, T4 ~69k; the parent's own usage was not exposed to the session. Benefit in token or time terms: **not claimed** — the operator declined a paid baseline-versus-candidate comparison (see D10).

## 1. What the plan asked for

The operator asked for the harness's operating instructions to make the active session an advisor that assigns bounded implementation and decides acceptance, without requiring a handoff or a particular model; for future plans to carry executable worker briefs covering their Definition of Done; for Claude routing to honor Fable advisor / Opus for low-complexity workers (first phrased as thinking-off, clarified in the repair round to advisor-judged effort) / never Sonnet only where the native surface supports it, with unsupported controls blocking rather than degrading; for probes, docs, glossary, RFC index, and CHANGELOG to follow; for an ADR superseding #929's direct-implementation default without rewriting history; and for any efficiency claim to be measured or absent.

## 2. What was built

### Root (D1)

```
$ wc -c AGENTS.md
9478 AGENTS.md
$ bash .oh/evals/probes/agents-identity-contract.sh; echo rc=$?
PASS: AGENTS.md owns product identity, glossary, code truth, and public-doc surfaces without procedure catalogs
rc=0
$ bash .oh/evals/probes/context-tier-size-budget.sh; echo rc=$?
PASS: AGENTS.md is 9478 B of 9500 B budget (~2369 tokens)
rc=0
```

New section `## One advisor, bounded workers` with links to `.oh/skills/delegate/SKILL.md` and `.oh/skills/spec/SKILL.md`; new glossary term **advisor**. Funded by removing sentences that duplicated non-negotiables #3–#5 and the lifecycle paragraph. All five `### N.` sections unchanged. `CLAUDE.md` still a symlink.

### One execution model (D2, D7, D8)

Files: `.oh/skills/spec/SKILL.md`, `references/execute.md`, `references/plan.md`, `templates/task-prompt.md`, `.oh/skills/delegate/SKILL.md`, `.oh/skills/plan/SKILL.md` (added to the tree from the untracked local baseline). T1's contract review listed 33 direct-implementation or inheritance instructions replaced; four probe-pinned literals deliberately kept with re-worded surroundings. `references/plan.md` gained the `Orchestration preserved` field and the orchestration-transfer check.

Actual invocation trace for D2: this task reached worker dispatch (T1, `delegate-log.txt` W1 line) before any tracked implementation edit; `git log --format='%s' 50515549..HEAD` shows every implementation commit was authored by a worker and integrated by cherry-pick.

### Model policy and native evidence (D3, D4)

Requested versus observed, from `delegate-graph.json`:

| Worker | Requested | Native surface finding | Observed | Provenance |
|---|---|---|---|---|
| Advisor | Fable 5.1, operator effort | n/a | `claude-fable-5-1` | runtime system prompt |
| T1 policy (H) | inherit (Fable) | `model` omitted | unknown (worker did not report) | Agent call |
| T2 tests (H) | inherit (Fable) | `model` omitted | unknown; the 429 error named `claude-fable-5-1` as the model sent | Agent call; provider error text |
| T3 docs (L) | Opus, thinking disabled (plan wording; superseded in the repair round by advisor-judged effort) | no per-worker thinking control exists | `claude-opus-5[1m]`; reasoning unknown | worker self-report |
| T4 checks (L) | Opus, thinking disabled (plan wording; superseded in the repair round by advisor-judged effort) | no per-worker thinking control exists | `claude-opus-5[1m]`; reasoning unknown | worker self-report |
| T5 review (H) | inherit (Fable), read-only | `Explore` built-in did not inherit | `claude-opus-5[1m]`; reasoning unknown | worker self-report |
| T5 fresh review (H) | `fable` set explicitly, read-only | `Explore` built-in with `model` set | `claude-fable-5-1`; reasoning unknown | worker self-report |
| T6 scripted driver (H) | `fable` set explicitly | `general-purpose` with `model` set | `claude-fable-5-1`; reasoning unknown | worker self-report |
| T7 repair policy (H) | `fable` set explicitly; effort judged high, no per-call control | `general-purpose` with `model` set | `claude-fable-5-1`; numeric `reasoning_effort` 15 self-reported, label unobserved (inherited) | worker self-report |
| T8 repair gates (H) | `fable` set explicitly; effort judged high, no per-call control | `general-purpose` with `model` set | see "Scripted driver completion contract" | worker self-report |

Capability gate: the Agent tool schema visible to this session carries `model` with aliases `sonnet`, `opus`, `haiku`, `fable` and no `thinking` or `effort` parameter. The first documentation read (2026-09-06, through a research worker) reported no per-subagent thinking or effort control; that was wrong for effort. The repair-round preflight read `sub-agents#supported-frontmatter-fields` and `model-config#adjust-effort-level` directly: subagent definition frontmatter supports `effort: low|medium|high|xhigh|max` (default inherits the session level; hot-reloaded, except that the first file in a new agents directory needs a restart), while the per-call Agent tool still carries no effort argument. No thinking-disable control exists on either surface, so the original "Opus with thinking disabled" request could not be confirmed; T3 and T4 were BLOCKED before dispatch and the operator authorized "Opus, reasoning unobserved". The operator later clarified that thinking-off was never the intent and that the advisor judges effort per task (Repair round, item 1); no subagent definition was created. Sonnet was never passed. `max` was never passed. Luna/Max and Astra/high: no native surface in this session exposes those models; recorded as a capability gap, no invented parameter passed.

### Bounded, isolated dispatch (D5)

`delegate-graph.json` and `delegate-log.txt` record five tasks: T1 alone in W1 in the integration worktree; T2 and T3 in W2 in separate worktrees (`feat/988-t2-probes`, `feat/988-t3-docs`) off `17a510de`, integrated by cherry-pick; T4 in W3 in a disposable `--shared` clone; T5 in W4 read-only. Workers stayed flat; none pushed, opened a PR, or wrote `prd.json`/`progress.txt`. Coupled policy edits stayed with one continuing worker (T1, one repair round). T3 continued through three assignments as one worker.

### Independent, commit-specific verification (D6)

Real instance: T3's first changelog entry was 303 characters; the suite on `762c0ec3` reported `changelog-entry-length REGRESSION`; the advisor rejected the wave, routed the repair to T3 (`9fcc945d` → `14127d7c`), and the probe returned to PASS. Seeded instance (T4, section C): with a Sonnet-routing fault applied, a `prd.json` copy marking a story passing on "worker reported done" failed the `jq all(.passes)` gate and the probe exited 1. A worker's completed status set no story to passing in this run; the advisor flipped `passes` only after re-running checks.

### Probes (D9)

```
$ for p in delegate-model-effort-policy delegate-worker-boundary spec-single-owner roles-are-skills advisor-execution-contract plan-orchestration-contract; do bash .oh/evals/probes/$p.sh >/dev/null 2>&1; echo "$p rc=$?"; done
delegate-model-effort-policy rc=0
delegate-worker-boundary rc=0
spec-single-owner rc=0
roles-are-skills rc=0
advisor-execution-contract rc=0
plan-orchestration-contract rc=0
```

Fault injection: T2 demonstrated 33 cases (REGRESSION then restored PASS) in `scratchpad/t2-fault-injection.log`; T4 independently re-ran 11 named cases (missing delegation, Sonnet substitution, off-to-low, `thinking: max`, stale acceptance, overlapping writers, forced handoff, hard-coded advisor identity, concurrent ownership, incomplete brief, forced handoff in plan) in `scratchpad/t4-checks.log`, all caught. Every probe's `# desc:` states it inspects instruction text and does not verify runtime model selection.

Full suite on `cd986dbc`, the final content head including the scripted audit driver (recorded in `eval-result.json`; an earlier run on `8cd488e5` gave the same result):

```
ran 143 probe(s); runner exit 0; PERSISTENT RED (3) — not gating, no green->red delta
  curl-bash-safe-alternatives  ERROR       python3: command not found (rc 127)
  oh-config-surfaces           REGRESSION  oh.json is not valid JSON
  skills-vendored              REGRESSION  cc-safety-net binary not found on PATH
```

All three reproduce on base `9261d512` in this environment (verified in a detached clone).

### Documentation and records (D11)

`docs/rfcs/README.md`: new `#989` Draft row; `#929` keeps `Accepted` with the sentence "[#989] supersedes its optional-worker, direct-implementation default." `docs/glossary.md`: new **advisor** entry; `agent` and `session` entries reworded; the five probe-pinned strings intact. `.oh/tasks/README.md`: advisor ownership sentence plus `delegate-graph.json`/`delegate-log.txt` rows. `CHANGELOG.md`: four Unreleased entries, all ≤ 250 chars (`changelog-entry-length` PASS). `bash .oh/scripts/link-providers.sh --check` → `Providers OK`. STE: 0 findings on changed lines in every worker report; pre-existing findings on untouched lines left alone. Public docs (`mifunedev/openharness-web`): not changed in this PR; see unverified.

### Knowledge impact (step 6)

```
$ bash .oh/skills/wiki/scripts/knowledge-impact.sh --changed <22 changed paths>
NEEDS-REVIEW  plan-vs-built-reconciliation  declared sources are in the changed set: .oh/skills/spec/references/execute.md
FRESH         (9 other source pages)
NOT-APPLICABLE (15 pattern pages — provenance immutable)
```

| Page | State | Action |
|---|---|---|
| `plan-vs-built-reconciliation` | UPDATED | 12 `execute.md` citations remapped, summary reworded to the advisor-first owner, `updated: 2026-09-06`, `verified_at: 14127d7c…` (commit `ceced13c`, by T3) |
| `audit-architecture` | REVERIFIED | declares `audit/SKILL.md`, changed by the driver retirement; every cited line still resolves, no claim about the agent driver; `verified_at: 5deb1d54…` (by T3) |
| `pattern-audit-driver-tool-allowlist` | UPDATED (`confidence: deprecated`) | describes the retired nested-agent driver; retirement paragraph added, historical body and pinned sources kept (by T3) |
| all other `source/` pages | NOT-AFFECTED (no declared source in the changed set) | none |
| all other `patterns/` pages | NOT-AFFECTED (immutable provenance) | none |
| new advisor-first page | NOT CREATED | the canonical skills and ADR #989 are the source; a page now would be a second description with no consumer |

`bash .oh/evals/probes/wiki-readme-index.sh` → PASS after the index regeneration.

### Reversibility (D12)

T4 section E: `git revert --no-edit` of the seven policy/probe/docs commits together applied with no conflicts; the six original probes then passed on the rollback branch and on base `9261d512`. Root checkout `/home/sandbox/harness` untouched (its unrelated modifications to `.gitignore`, `.claude/settings.json`, `.oh/evals/RESULTS.md`, `skill-impact.md`, and the untracked `.oh/skills/plan/` preserved); the AGRO worktree `feat/940-agro-compat-foundation` untouched; the source plan not staged.

### Independent review findings and dispositions (T5 on `72548bc4`)

| Finding | Disposition |
|---|---|
| BL-1 `execute.md` and the task prompt kept "only for bounded, disjoint worker tasks", readable as permission to keep coupled work in the owner | T1 repair `ae296157`: "disjoint" now describes one dispatch shape; coupled work names one continuing worker; pinned prefix intact; probes 0 |
| BL-2 T5 ran on `claude-opus-5[1m]` while its record said inherit Fable | Records corrected (`delegate-graph.json`, matrix above); fresh review dispatched with `model: fable` explicitly; T1/T2 model stays unknown |
| BL-3 eval result and check transcript keyed to older commits; audit pending | Suite re-run on the repaired head and recorded in `eval-result.json`; the audit routes run on the pushed head and their run ID and verdicts are recorded under "Audit correlation" |
| BL-4 advisor-committed `.oh/skills/plan/SKILL.md` baseline copy and `RESULTS.md` refreshes omitted from the ownership statement | Section 0 corrected; disclosed in `progress.txt`; no operator exception claimed |
| BL-5 probes passed on `…Sonnet when no Opus…` and `The owner may write tracked implementation edits…` | T2 repair `8cd488e5`: negation must govern the Sonnet token; new permission scan; 7 injection cases in `t2-fault-injection.log` "repair round" |
| NB-1 stale heading | T1 repair: "Re-ground before you assign work" |
| NB-2 the delegate skill's L preference (Opus, thinking off) blocks every L dispatch until an operator decision | Superseded in the repair round: the operator clarified that the advisor judges effort per task, so no fixed L preference remains and effort never blocks (T7, `a27ae3fa`) |
| NB-3 `.oh/skills/audit/references/harness.md` and `.oh/skills/strategic-proposal/SKILL.md` still route workers to Sonnet | Outside the approved T-scope; disclosed in section 4, not changed |
| NB-4 preference-heading exemption is broad | Accepted risk; disclosed |
| NB-5 root lost two duplicate bullets and the progressive-disclosure sentence | Bullets duplicate non-negotiables #3/#5; the disclosure sentence is restated by "Read the nearest directory README"; accepted |
| NB-6 fallback check lacked a negation filter | T2 repair `8cd488e5` |
| NB-7 literal pinning fragility | Accepted; the probes flatten whitespace and scan sentences, paraphrase remains a known limit |
| NB-8 uncommitted delegation records at review time | Committed with this document |
| NB-9 "claimed, unmeasured" wording | Reworded to "not claimed" |
| NB-10 `prd.md` checkboxes unticked | `prd.json` is the completion authority; left |

## 3. Where they diverged, and why

- **L binding.** The plan's L configuration (Opus, thinking disabled) could not be verified natively; the repair round then replaced that request with advisor-judged effort (see Repair round). Per the plan's own rule the assignments blocked and the operator chose "Opus, reasoning unobserved". Thinking-off is not claimed anywhere.
- **D10 comparison not run.** The operator declined a paid comparison. No efficiency claim is made (see 0).
- **Small-task no-worker exemption removed** from `/plan` rather than softened; under the new contract a small implementation task uses one worker, and only plan-only or factual requests keep synthesis in the session. Consistent with the plan's "a small task can use one worker".
- **Knowledge page rewrites route to a worker** (execute.md step 6) — the plan classifies documentation as tracked implementation edits; applied consistently.
- **`.oh/skills/plan/SKILL.md` added to the tree.** The plan named it as T1's file but it was untracked at the root. The baseline copy went into the scaffold commit so T1's reconciliation diff stays reviewable.
- **Base moved** from `9a479575` to `9261d512` between planning and execution; the intersection with grounded paths was `docs/rfcs/README.md` and `CHANGELOG.md`, both T3's files, re-read at the new base.
- **Development merge.** `origin/development` released 0.9.0 mid-build; the advisor merged it into the branch and resolved two conflicts as integration rather than authorship: the knowledge index was regenerated with the `wiki-readme-index` oracle, and this branch's five CHANGELOG entries were moved back under `Unreleased` after the release cut relocated the header. No worker content changed.
- **ADR text.** The ADR issue body opens with "Advisor-first execution"; T3 wrote "The advisor-first execution default:" in the index row to satisfy the lowercase-token rule the probes enforce under `.oh/skills/` (docs are not scanned, but the vocabulary rule was applied uniformly).

## 4. What remains unverified

- **Effective worker reasoning settings.** No surface exposes them; every `reasoning` cell reads unknown. Probes prove instruction shape, not runtime routing.
- **Three persistent reds** (`curl-bash-safe-alternatives` ERROR, `oh-config-surfaces`, `skills-vendored`) are environment-caused and pre-existing on base; carried forward, not fixed here.
- **T1/T2 observed model** is unknown; both were dispatched with `model` omitted (inherit). Only the provider's 429 error text names `claude-fable-5-1` for T2.
- **Efficiency.** No matched comparison; no token, cost, or time claim is made.
- **Requested-transfer behavior** was tested as a prompt-contract check (T4 section D) and by probes (concurrent-ownership scan); a live two-session transfer was not exercised in this build.
- **Public docs** (`mifunedev/openharness-web`) may still describe the old direct-implementation default. This PR does not audit or change that repository, and no external issue exists for it; the D11 public-guidance review stays open for the operator.
- **Other declared sources of `plan-vs-built-reconciliation`** (`reviewer-evidence-doc.md`, `spec-ready-finalization.sh`) were not in this diff and were not re-cited; the page's prior `verified_at` commit is not in this repository's history, so their freshness relative to that page was not re-established here.
- **STE findings on untouched lines** in the edited skill files (150 pre-existing on `execute.md` and siblings) remain.
- **Scripted driver `--base` skew.** Gate 5 resolves `--base` as a local ref; when the local `development` branch is stale the metrics include upstream commits (observed: 9210 vs 2142 net added). Gate 3 needs the plain base name for the PR check, so the two uses conflict; a later change should resolve gate 5 against the remote-tracking ref. Non-blocking by design.
- **Gate 3 in PR mode is not head-specific.** The driver classifies the PR's remote head and never compares it to the local HEAD (pre-existing T6 behavior, noted by the repair-round reviewer). The undraft therefore requires a fresh `PR-AUDIT-PROMOTABLE` on the pushed head, which this procedure performs; a head-equality check inside the driver is deferred to the follow-up plan with the base-skew item.
- **Repair-round residuals disclosed, not fixed:** `execute.md`'s UI paragraph re-describes the `ui-evidence.json` fields in prose beside the schema in `implementation.md`; `spec-single-owner.sh` carries a double blank line where scans were removed; "Prefer Sonnet for the experts." passes the routing scan (paraphrase class).
- **Reviewer's paraphrase-class evasions** of the new probes (`Do not hesitate to route … to Sonnet`, `the owner applies the tracked change directly`) still pass; the probes narrow the class, they do not close it.

### Scope addition: the nested-agent audit driver is retired (#993)

Operator decision on 2026-09-06, recorded in `prd.md` Plan Reconciliation as an approved material deviation. Trigger: `/audit implementation` attempt 1 (`audit-20260906T191412Z-1541169`) failed before any gate ran because its `claude -p` driver hit the provider spend limit while the interactive session and its workers kept running; that driver's model was unrecorded and unbound by the operator's constraints, and every gate it re-derived is deterministic.

Built by bounded worker T6 (`5deb1d54`): `route-driver.sh` now runs gate 1 (`implementation-gates.sh gate1`), gate 2 (reuse `eval-result.json` when its commit is HEAD, else run the suite), gate 3 (`classify-pr`, or a green CI run for HEAD when there is no PR), gate 4 (fails closed when UI verification applies), gate 5 (metrics and disclosure only), prints `AUDIT-EVIDENCE: <token>`, and publishes the schema-v1 evidence itself. The `pr` target maps the classifier to `PR-AUDIT-PROMOTABLE / BLOCKED / UNKNOWN`. Report-only targets exit 64: the active session reads those routes directly. `audit-run-root-contract.sh` now exercises the scripted driver (unsupported target, gate-1 failure fixture, gate-3 no-CI fixture with a stub `gh`) instead of a fake agent.

```
$ for p in $(ls .oh/evals/probes | grep -E '^audit'); do bash .oh/evals/probes/$p >/dev/null 2>&1; printf '%s %s\n' "$p" "$?"; done
audit-dispatcher-contract.sh 0
audit-implementation-behavior.sh 0
audit-pr-acquire.sh 0
audit-pr-classifier.sh 0
audit-run-root-contract.sh 0
audit-shellcheck-coverage.sh 0
audit-slop-gate.sh 0
audit-stale-references.sh 0
$ grep -c AUDIT_AGENT_COMMAND_JSON .oh/skills/audit/scripts/route-driver.sh
0
```

T6's real run of the new driver against this task (worktree head `7c3a7c2f`, run `audit-20260906T200226Z-1598585`): gate 1 PASS (7/7), gate 2 PASS (suite run, exit 0), gate 3 FAIL because GitHub reported the draft PR's `mergeable`/`mergeStateStatus` as `UNKNOWN` (`evidenceComplete: false`); verdict `AUDIT-FAIL` published with `state=complete`. The verdict was accepted as data, not tuned away. Knowledge impact of this addition: `pattern-audit-driver-tool-allowlist` (describes the retired driver) and `audit-architecture` (declares `audit/SKILL.md`) are resolved by T3; states are recorded in the knowledge table above once applied.

### Repair round (operator-approved pre-merge corrections, three blockers)

The PR was returned to draft on 2026-09-06 for three corrections; every other finding stays in the separately maintained delegate-follow-up plan and is dispositioned in section 4.

1. **Effort policy.** The operator clarified that "thinking off" was never the intent and, on being asked where a fixed low-effort subagent definition should live, answered that none should exist: the advisor judges the effort level for each worker task. T7 (`a27ae3fa`) rewrote the delegate skill's provider subsection: low-complexity Claude workers run on Opus; the advisor selects `low`/`medium`/`high`/`xhigh` per task (never `max`), records it before dispatch, applies it through the documented native control (subagent definition frontmatter `effort:`, hot-reloaded at the scope the operator chooses) when one exists, and otherwise records "inherited session level, unobserved". Effort never blocks and never justifies a model substitution. Native path verified from the current docs (`sub-agents#supported-frontmatter-fields`, `model-config#adjust-effort-level`) on 2026-09-06; the per-call Agent tool has no effort argument; no agents directory exists in this sandbox and none was created. Observation: T7 reported a numeric `reasoning_effort` of 15 in its own context, so a worker can self-report a numeric effort but not the `low|medium|high` label; the observed column stays "inherited, label unobserved". `delegate-model-effort-policy.sh` now rejects any thinking-disabled wording and pins the per-task effort judgment.
2. **Sonnet selections.** `audit/references/harness.md` and `strategic-proposal/SKILL.md` no longer select Sonnet; both defer to `.oh/skills/delegate/SKILL.md` without naming another universal model. The probe gained a repository-wide routing scan (all `.oh/skills/**/*.md` except the delegate skill's own negated exclusion and the `claude-api` reference) that fired on exactly those two files at base `bc23623b` and on nothing after the edit; re-adding a `sonnet` table cell is a demonstrated REGRESSION.
3. **Gate 4 / gate 5 completion contract.** See "Scripted driver completion contract" below (T8).

### Scripted driver completion contract (T8, `08378472` + `1514036f`)

Before: gate 5 only printed metrics and never produced the `AUDIT-FAIL` that `/spec execute`'s simplify loop routes on; gate 4 failed every applicable UI story with no way to consume verified evidence. After: two owner-written records, both fail-closed in the driver, with judgment left to a fresh reviewer and the owner.

- `simplicity-review.json` (schema v1: `commit`, `reviewer`, `findings[]` with `file`, `line`, `simplerAlternative`, `removesLines`, `blocking`, `status`). Written by the owner from a fresh read-only reviewer's findings, never by the implementer or the driver. Gate 5: missing, symlinked, malformed, or not keyed to the content head → `AUDIT-FAIL (no simplicity review for HEAD …)`; any `blocking: true, status: open` finding → `AUDIT-FAIL (<n> blocking simplicity finding(s) open)` unless `simplify-rounds.json` records `rounds >= 3` or `nonReducing: true`, in which case `PASS with SIMPLICITY-RESIDUAL`; otherwise PASS naming the reviewer and commit. Every open finding is printed as `file:line — alternative`.
- `ui-evidence.json` (schema v1: `commit`, `preflight.runId`/`exit`, `reviewer`, `criteria[]` with `story`, `criterion`, `result`, `screenshotSha256`, `note`). Gate 4: not applicable when no story requires browser verification; otherwise missing/stale/malformed, `preflight.exit != 0`, empty criteria, or any `FAIL` → `AUDIT-FAIL` with the exact reason; else PASS naming the reviewer. The driver never runs a browser; screenshots stay outside the repo.
- Content-head rule: a record's `commit` is accepted when it equals HEAD or is an ancestor after which only `.oh/tasks/` files or `.oh/evals/RESULTS.md` changed (the record commit itself moves HEAD). The same rule now keys the gate-2 `eval-result.json` reuse. The driver prints which case applied.
- Consumers updated: `implementation.md` gates 4–5, `execute.md` step 5 (fresh reviewer → record → route blocking findings to the owning worker → rounds → re-review → cap/non-reducing → residual), `.oh/tasks/README.md` rows, CHANGELOG.

Genuine path on this task, all with the scripted driver and a fresh read-only reviewer (`claude-fable-5-1-simplicity-reviewer`, Explore built-in with `model: fable`, not an implementer):

| Step | Head | Run | Result |
|---|---|---|---|
| Rejection, no record | `bc23623b` | `audit-20260906T210029Z-1860607` (T8's real run) | `AUDIT-FAIL` — `gate5: FAIL (no simplicity review for HEAD …)` |
| Review round 1 | `1514036f` | reviewer pass 1 | 11 blocking findings with concrete alternatives (duplicated `head` lookups and a hand-built pipeline in the driver; duplicated negative scans and an implied presence check in probes; a twice-written `gh` stub; bullets and table rows restating policy rules; a JSON heredoc and two "Never" bullets restating the same contract; a stale prose reference) |
| Rejection on the record | `1514036f` | `audit-20260906T221532Z-1981557` | `AUDIT-FAIL (11 blocking simplicity finding(s) open)`; `simplify-rounds.json` round 1, `netAdded` 2470 vs `origin/development` |
| Repairs by owning workers | `e1550a23` (T2), `d6635419` (T8), `4c069f65` (T7) | — | all 11 applied; 11 probes, `diff --check` green; `netAdded` 2404 (reducing round) |
| Review round 2 | `4c069f65` | reviewer pass 2 | all 11 `resolved` with `resolvedIn`; one new non-blocking whitespace finding left `open` and disclosed |
| Acceptance (round 1) | `4c069f65` | `audit-20260906T221952Z-2066766` | `AUDIT-PASS` — gate 2 reused `eval-result.json` for HEAD, gate 3 PASS, gate 4 not applicable, gate 5 `PASS (review … at 4c069f65…, 12 finding(s), none blocking open)` |
| Independent review of the round | `4c069f65` | T10 (Explore, `claude-fable-5-1`) | 0 blocking; content-head allowlist breadth routed to T8 (`ac616544`) |
| Review pass 3 on the allowlist fix | `ac616544` | reviewer pass 3 | 1 new blocking finding: replace the allowlist loop with a git pathspec exclusion (removes 2 lines) |
| Rejection (round 2) | `ac616544` | `audit-20260906T222822Z-2117337` | `AUDIT-FAIL (1 blocking simplicity finding(s) open)`; `simplify-rounds.json` round 2, `netAdded` 2413 |
| Repair and final acceptance | see "Audit correlation" | | the pathspec repair, review pass 4, and the acceptance run on the final content head are recorded there |

Tested paths (all in `audit-run-root-contract.sh`, 18 fixture cases): no review → FAIL; open blocking finding → FAIL; `rounds: 3` or `nonReducing` → PASS with residual; resolved → PASS; stale or non-ancestor or symlinked record → FAIL; malformed rounds → FAIL; UI required without evidence → FAIL; valid evidence → PASS; a FAIL criterion, `preflight.exit: 1`, empty criteria, stale UI record → FAIL; content-head record with only task files changed → PASS; a code file changed past the review → FAIL. Genuine rejection on this task: T8's real run `audit-20260906T210029Z-1860607` on `bc23623b` returned `AUDIT-FAIL` at gate 5 with no review record. The genuine review → repair/acceptance path on the final head is recorded under "Audit correlation". Gate 4 has no genuine instance in this task (no UI story); its paths are fixture-tested only, and that is stated as such.

### Disposition of the original criteria after the repair round

| ID | Repair-round status | Basis |
|---|---|---|
| D1 root | Re-verified on `4c069f65` | `agents-identity-contract`, `context-tier-size-budget` exit 0; `AGENTS.md` 9478 B; root untouched this round |
| D2 one model | Re-verified | `spec-single-owner`, `advisor-execution-contract`, `plan-orchestration-contract` exit 0 after the simplify edits to `execute.md` and the delegate skill |
| D3 model policy | Re-verified with the corrected contract | Opus for low complexity, advisor-judged effort, requested/observed separation, no thinking-off wording (probe-enforced); effort labels remain unobservable and are recorded as inherited |
| D4 Luna/Astra | Carried, unchanged | still a capability gap on this surface; no invented parameter |
| D5 bounded dispatch | Re-verified for the round | T7/T8/T2/T9/T10 records in `delegate-graph.json`; disjoint files; workers flat |
| D6 independent, commit-specific verification | Re-verified and strengthened | genuine gate-5 rejection → repair → acceptance table above; content-head rule; independent review of the round |
| D7 plans/briefs | Carried, unchanged | no plan-skill change this round |
| D8 single owner | Re-verified | advisor committed only records and integration; `roles-are-skills` exit 0 |
| D9 tests | Re-verified | suite on `4c069f65` runner exit 0; audit fixtures 18 cases; model-policy probe fault injection re-run |
| D10 efficiency | Carried: not measured, not claimed | unchanged |
| D11 docs/records | Re-verified for the changed surfaces | `.oh/tasks/README.md` rows, CHANGELOG entries; public docs still deferred |
| D12 reversibility | Carried from the earlier rehearsal; the repair commits are ordinary reverts | no new rehearsal run this round |

Deferred by operator decision to `.oh/plans/delegate-follow-up/plan.md` and therefore **not claimed as verified here**: remaining delegation cleanup (acceptance before dependency release, useful task sizing, interrupted-task reconciliation, undefined procedures and accidental triggers), the audit-base skew of gate-5 metrics against a stale local `--base` ref, the public-documentation update in `mifunedev/openharness-web`, robustness items (paraphrase-class probe evasions, preference-heading exemption), and the optional efficiency measurement.

### Retro, compile, and benchmark (tail steps 8–9)

The task-scoped retro (report-only; verdicts recorded in `progress.txt`) produced six hypotheses. Two are supported at medium or high confidence and generalize; they were compiled into `kind: pattern` pages by the bounded docs worker: `pattern-delegate-builtin-type-carries-own-model` and `pattern-evals-negation-must-govern-token`. Four are report-only.

Benchmark: `.oh/evals/capability/RESULTS.md` suite score is `1.44` on this head and `1.44` on `origin/development`; the ceiling held and the eval floor is green (runner exit 0). This run exercised the CB-001/CB-002 path under the new default, which is the capability the change states, so the verdict is BENEFICIAL as a justified hold. No ceiling movement and no efficiency benefit are claimed; no new capability score row was written because no rubric-graded run was performed.

## Audit correlation

| Route | Run ID | Head | Native verdict | Note |
|---|---|---|---|---|
| `/audit implementation` (attempt 1) | `audit-20260906T191412Z-1541169` | `e67e5481` | none (state `failed`, exit 1) | The shipped agent driver (`claude -p`) was refused by the provider: monthly spend limit, session limit resets 16:10 MDT. No gate ran. Not a verdict about the code. |
| `/audit implementation` (attempt 2, scripted driver) | `audit-20260906T201643Z-1659991` | `188edfa5` | `AUDIT-PASS` (state `complete`, exit 0) | gate1 `task-graph: 7/7 stories pass`; gate2 ran the suite for `188edfa5…` (exit 0; persistent reds unchanged); gate3 `classify-pr` → `evidenceComplete: true, promotable: true, mergeable: MERGEABLE, mergeStateStatus: CLEAN, ci: PASS`; gate4 not applicable; gate5 metrics printed and `SIMPLICITY-RESIDUAL disclosed`. No nested agent ran. |
| `/audit implementation` (repair round, rejection) | `audit-20260906T221532Z-1981557` | `1514036f` | `AUDIT-FAIL` | gate 5: 11 blocking simplicity findings open (real record, fresh reviewer) |
| `/audit implementation` (repair round, acceptance) | `audit-20260906T221952Z-2066766` | `4c069f65` | `AUDIT-PASS` | all gates; gate 5 review at HEAD, none blocking open; the final pushed head re-runs this route before the undraft and its run ID is recorded in the PR body |
| `/audit implementation` (repair round, rejection 2) | `audit-20260906T222822Z-2117337` | `ac616544` | `AUDIT-FAIL` | gate 5: 1 blocking finding open (allowlist loop → pathspec) |
| `/audit implementation` (repair round, final acceptance) | `audit-20260906T223016Z-2180334` | `48113599` | `AUDIT-PASS` | gate 2 reused `eval-result.json` for HEAD; gate 3 PASS; gate 4 not applicable; gate 5 review pass 4 at HEAD, 13 findings, none blocking open (`netAdded` 2470 → 2411 over two rounds); the pushed head re-runs this route before the undraft, recorded in the PR body |
| `/audit pr` (scripted driver) | see the PR body and `/tmp/spec-advisor-first-orchestration.state` | the final pushed head | `PR-AUDIT-PROMOTABLE` is required for the undraft | This row cannot carry the verdict for the head it describes: committing it would move the head past the classified commit and re-open the gate, so the run ID and verdict are recorded in the PR body's Evidence section instead. |

Gate-5 disclosure. The driver computed `slop-metrics` against the ref named by `--base`, which is the PR base name `development`; in this worktree that resolves to the root checkout's stale local branch (`9a479575`), so the reported `netAdded: 9210` and the four `tsOverCcn` functions (`lifecycle.ts runSandbox CCN 32`, `oh-config.ts validateOhConfig CCN 21`, `coerceFieldValue CCN 13`, `registry.ts resolveSandboxRoot CCN 11`) belong to upstream CLI commits this PR merged in and never edited. Against the real base `origin/development` the metrics are `netAdded: 2142, netRemoved: 272, shBranchPoints: 139, tsOverCcn: [], tool: lizard n/a (no analysable files changed)` (`git diff --stat origin/development...HEAD`: 37 files, +2285/−413). The stale-local-branch skew is a limitation of the scripted driver's `--base` handling, recorded here and in section 4; it does not change the verdict because gate 5 discloses and does not block.
