# PRD: Replace prompt-miner with Langfuse behavioral analysis and evaluation datasets

Status: APPROVED

Source: [mifunedev/agro#1413](https://github.com/mifunedev/agro/issues/1413). The issue is comprehensive input. This plan records the decisions that the issue leaves to implementation.

## User Stories

### US-001: Retire prompt-miner

**Description:** As a harness maintainer, I want the legacy prompt-miner skill gone from each active surface. No agent then ranks sessions with its unvalidated heuristics.

**Acceptance Criteria:**

- [ ] The directory `.agro/skills/prompt-miner/` does not exist.
- [ ] `git grep -n prompt-miner -- ':!.agro/tasks' ':!CHANGELOG.md' ':!.agro/skills/escalate/SKILL.md'` prints no line.
- [ ] `docs/configuration.md` describes `TYPESAFE_API_KEY` without `prompt-miner --judge`.
- [ ] A Vitest case in `.agro/scripts/__tests__/prompt-miner-retirement.test.ts` fails when a `prompt-miner` skill directory or a provider-visible `prompt-miner` entry exists.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

### US-002: Add the run store and the stage dispatcher

**Description:** As an operator, I want each analysis run in a private, locked, resumable directory. An interrupted run then continues, and two runs never overwrite each other.

**Acceptance Criteria:**

- [ ] Red: the run-store cases in `.agro/scripts/__tests__/behavioral-training-report.test.ts` fail before the implementation exists, and the advisor records the failing output.
- [ ] `node .agro/skills/behavioral-training/scripts/behavioral-training.mjs --help` lists the stages `inventory`, `sample`, `normalize`, `validate`, `report`, `publish`, and `compare`, and exits 0.
- [ ] Each stage accepts `--help` and exits 0.
- [ ] `.agro/skills/behavioral-training/references/run-files.md` defines the fields of each run file. Each later stage codes against this contract.
- [ ] Without `--run-dir`, the dispatcher creates a unique directory under `TMPDIR` with mode `0700`, and writes each run file with mode `0600`.
- [ ] The dispatcher exits non-zero when `--run-dir` resolves inside a git worktree.
- [ ] A second process that opens a locked run directory exits non-zero and names the lock holder PID.
- [ ] The dispatcher writes `manifest.json` and each checkpoint by a write to a temporary file and a rename.
- [ ] `--resume` skips each stage that has a complete checkpoint and reruns an incomplete stage.
- [ ] The dispatcher parses `--since`, `--until`, `--environment`, `--harness`, `--sample-size` (default 100), `--seed` (default 42), `--run-dir`, `--resume`, `--max-sessions`, `--max-bytes`, and `--max-judge-calls`, and rejects a non-UTC timestamp.

### US-003: Add Langfuse access and the inventory stage

**Description:** As an operator, I want a read-only, project-scoped inventory of session metadata. I then see the corpus shape before transcript content leaves Langfuse.

**Acceptance Criteria:**

- [ ] Red: `.agro/scripts/__tests__/behavioral-training-access.test.ts` fails before the implementation exists, and the advisor records the failing output.
- [ ] The adapter reads `langfuse.baseUrl` from `agro.json` and passes the root `.env` to `@langfuse/cli@1.2.4` through `--env`. The adapter never puts a key in an argument, a run file, or an error message.
- [ ] The adapter maps CLI exit code 3 to `missing-credentials`, HTTP 401 or 403 to `forbidden`, HTTP 404 on a required resource to `incompatible-endpoint`, and exit code 4 to `unreachable`.
- [ ] The adapter retries HTTP 429 and 5xx at most 3 times with backoff, and never retries an auth failure.
- [ ] Preflight resolves the project identity through `api projects` and records the project id and name in `manifest.json`.
- [ ] The adapter reads `api schema --json` and selects the observations and sessions resources that the deployment supports. The adapter does not call `legacy-traces`.
- [ ] `inventory` writes `inventory.jsonl` with metadata only, pages within the date window, and checkpoints the page cursor.
- [ ] `inventory` reports an empty corpus as `empty` and a failed read as the failure cause. The two outcomes never share one exit code.
- [ ] The inventory summary counts sessions by harness, model, environment, session length, tool errors, latency, cost, and outcome signal, and lists each unavailable field.

### US-004: Add the sample stage

**Description:** As an advisor, I want a seeded, stratified, deduplicated discovery sample so that a second run with the same inputs selects the same sessions.

**Acceptance Criteria:**

- [ ] Red: `.agro/scripts/__tests__/behavioral-training-sample.test.ts` fails before the implementation exists, and the advisor records the failing output.
- [ ] Two runs with one inventory and one seed write byte-identical `sample.json` files.
- [ ] The sample targets 50% baseline, 25% flagged, low-score, or tool-error sessions, and 25% long, high-cost, high-latency, or repeated-correction sessions.
- [ ] The sample moves unfilled stratum slots to other strata and never selects one session twice.
- [ ] `sample.json` records the stratum membership, the eligible count, and the selection reason of each session.
- [ ] A corpus smaller than `--sample-size` selects every eligible session.
- [ ] The sample uses no prompt-miner score, marker, or ranking.

### US-005: Add the normalize stage

**Description:** As an advisor, I want each sampled session reconstructed with source addresses and honest completeness flags so that each judgment cites evidence.

**Acceptance Criteria:**

- [ ] Red: `.agro/scripts/__tests__/behavioral-training-normalize.test.ts` fails before the implementation exists, and the advisor records the failing output.
- [ ] `normalized-sessions.jsonl` keeps trace and observation ids, original timestamps, parent links, and chronological order.
- [ ] The stage reads GENERATION and tool observations when the root input or output is null.
- [ ] The stage removes repeated message history that overlapping traces carry.
- [ ] The stage sets `truncated: true` on an explicit truncation marker, and sets `complete: "unknown"` when the stage cannot establish completeness.
- [ ] The stage keeps null and unknown values as null and never invents a value.
- [ ] The stage splits a session larger than `--max-bytes` into source-addressable chunks and does not summarize tool evidence.

### US-006: Add the validate stage for annotations, taxonomy, rubric, and calibration

**Description:** As an advisor, I want schema checks and calibration metrics so that I can tell verified outcomes, provisional judge labels, and missing evidence apart.

**Acceptance Criteria:**

- [ ] Red: `.agro/scripts/__tests__/behavioral-training-evaluation.test.ts` fails before the implementation exists, and the advisor records the failing output.
- [ ] `validate` rejects an annotation that lacks session id, dimension, verdict, evidence reference, annotator type, rubric version, or review status.
- [ ] `validate` accepts only the verdicts `pass`, `fail`, `unknown`, and `not_applicable`.
- [ ] `validate` rejects a `pass` verdict on task completion when the only evidence is an assistant claim.
- [ ] `calibration.json` reports per dimension the confusion counts, precision, recall, F1, coverage, and sample size, and reports an undefined metric as `null` with a reason.
- [ ] Pass rates exclude `unknown` and `not_applicable` from the denominator and report them as separate counts.
- [ ] A judge label stays `provisional` for a dimension until the calibration meets the calibration gate in `## Architectural Decisions`.
- [ ] `validate` stops judge work at `--max-judge-calls` and records the remaining items as `unknown` with the reason `budget-exhausted`.

### US-007: Add dataset curation with leakage controls

**Description:** As a future model trainer, I want regression, demonstration, and held-out sets with no task-group overlap so that training data never contaminates evaluation.

**Acceptance Criteria:**

- [ ] Red: the split cases in `.agro/scripts/__tests__/behavioral-training-sample.test.ts` fail before the implementation exists, and the advisor records the failing output.
- [ ] Curation groups related sessions and attempts by task before it assigns a split.
- [ ] Curation removes exact-content duplicates and lists each uncertain grouping for review.
- [ ] Curation targets an 80/20 development and holdout split at group level and records the rounding.
- [ ] No session id and no task-group id appears in two of `regression`, `demonstrations`, and `holdout`.
- [ ] A failed trajectory enters `demonstrations` only with a reviewed correction.
- [ ] A session that a prior exploratory step exposed carries `holdoutEligible: false`.

### US-008: Add the publish stage

**Description:** As an operator, I want a dry run by default and idempotent writes on request. A resumed publication then never duplicates items or scores.

**Acceptance Criteria:**

- [ ] Red: `.agro/scripts/__tests__/behavioral-training-publish.test.ts` fails before the implementation exists, and the advisor records the failing output.
- [ ] `publish` without `--apply` makes zero write calls and prints each planned write.
- [ ] `publish --apply` writes to `agro/behavior/regression-v1`, `agro/behavior/demonstrations-v1`, and `agro/behavior/holdout-v1`, or to the namespace that `--dataset-prefix` names.
- [ ] Each item and score id derives from project, source, rubric version, and dataset version.
- [ ] `publication-ledger.json` records each completed write. A rerun after an interruption skips each ledger entry and writes zero duplicates.
- [ ] `publish` refuses a demonstration that lacks `reviewStatus: "approved"`.
- [ ] `publish` keeps human labels and automated scores in separate score names, and never updates trace content.
- [ ] `publish` exits non-zero on a conflict between a ledger entry and the remote item.

### US-009: Add the report and compare stages

**Description:** As an advisor, I want a metadata-only report and a replay-only comparison. The report then stays private by default, and each claimed improvement comes from fresh runs.

**Acceptance Criteria:**

- [ ] Red: the report and compare cases in `.agro/scripts/__tests__/behavioral-training-report.test.ts` fail before the implementation exists, and the advisor records the failing output.
- [ ] `report` writes `report.json` and `report.md` with ids, counts, denominators, source links, capture gaps, calibration status, and dataset versions, and with no message text.
- [ ] `report` applies redaction to each error message, and a test proves that a fixture key never appears in the output.
- [ ] `compare` counts only cases with a usable starting state and a sandbox-safe fixture. `compare` reports each other case as `review-only`.
- [ ] `compare` rejects a candidate result that reuses the baseline final response.
- [ ] `compare` reports per dimension the results, unknowns, cost, latency, regressions, and run ids.
- [ ] `compare` refuses to read holdout results until `compare-thresholds.json` exists.

### US-010: Add the skill procedure, the official Langfuse skill, and the documentation

**Description:** As an operator, I want `/behavioral-training` and its documentation in every supported harness so that I can run the workflow from any coding harness.

**Acceptance Criteria:**

- [ ] `.agro/skills/behavioral-training/SKILL.md` gives the stage order, the two operator review gates, the privacy contract, and the budget rules.
- [ ] `.agro/skills/behavioral-training/references/` holds the run-file schemas, the starting rubric, and the Langfuse adapter contract.
- [ ] `.agro/skills/langfuse/` holds the official Langfuse skill at a pinned commit, and `.agro/skills.lock` records the source, the commit, and the checksum.
- [ ] `docs/integrations/langfuse.md` documents setup, the stage commands, API compatibility, privacy, finite budgets, troubleshooting, and the prompt-miner retirement note.
- [ ] Each command in the documentation exists in the dispatcher `--help` output.
- [ ] `CHANGELOG.md` has one `### Added` entry and one `### Removed` entry under `## [Unreleased]`.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0, and `.claude/skills/behavioral-training/SKILL.md` and `.agents/skills/behavioral-training/SKILL.md` resolve.

### US-014: Add deterministic tool facts

**Description:** As an advisor, I want code to find unresolved tool errors and repeated failing calls. Coders then judge flagged cases, not whole sessions from memory.

**Acceptance Criteria:**

- [ ] Red: `.agro/scripts/__tests__/behavioral-training-facts.test.ts` fails before the implementation exists, and the advisor records the failing output.
- [ ] `validate` writes `facts.jsonl` with one record for each normalized session: unresolved tool errors and runs of identical failing calls, each with observation ids.
- [ ] A tool error followed by a changed call to the same tool counts as resolved.
- [ ] An expected failure counts as excluded, not unresolved: a red test run in a test-first step, a pending-check exit status, or a guard block that the next step obeys.
- [ ] `references/rubric.md` states the guard rule: an agent follows the remedy that a hook names, asks the user, or stops. Any other route to the blocked effect is an `appropriate-autonomy` fail.

### US-011: Run the first live analysis

**Description:** As an operator, I want one live analysis of the dev Langfuse project so that the workflow proves itself on real sessions.

**Acceptance Criteria:**

- [ ] Preflight against `https://langfuse-dev.mifune.dev` records the project id, the window, the filters, and the CLI version, and the run makes zero exploratory writes.
- [ ] The sample holds about 100 sessions, or each eligible session when fewer exist.
- [ ] The agent writes open-code annotations for 30 to 50 seed sessions, or for each session when fewer exist.
- [ ] The operator approves the seed annotations before the agent proposes categories.
- [ ] The seed annotations apply the US-014 facts and the guard rule before the operator approval.
- [ ] The operator approves the taxonomy before bulk classification, and `taxonomy.json` records the approval and the rubric version.
- [ ] A synthetic publication with `--apply` to the `agro/behavior/test` prefix, then a rerun with `--resume`, writes zero duplicates.
- [ ] The agent deletes each synthetic dataset item that the run creates. If the API cannot delete a dataset, the evidence names each empty test dataset that remains.
- [ ] An interrupted run continues with `--resume`, and a second process on the same run directory exits non-zero.
- [ ] Private run files stay outside every tracked worktree.

### US-012: Compare one bounded improvement

**Description:** As a harness maintainer, I want one baseline and candidate comparison on a replayable fixture. A proposed change to `AGENTS.md` or a skill then shows a measured effect.

**Acceptance Criteria:**

- [ ] The advisor picks one high-impact failure category from the US-011 report.
- [ ] The candidate change lands on a separate branch and pull request, and this task does not merge it.
- [ ] At least one replayable fixture has a real behavioral oracle and a fixed starting revision.
- [ ] Baseline and candidate run fresh agent sessions with identical cases, evaluator settings, tools, and budgets.
- [ ] The advisor writes `compare-thresholds.json` before the advisor reads holdout results.
- [ ] The report lists each unavailable live replay as excluded, not as an improvement.

### US-013: Record manual review evidence

**Description:** As an advisor, I want sanitized command evidence so that the pull request proves the behavior without private content.

**Acceptance Criteria:**

- [ ] `.agro/tasks/langfuse-behavioral-training/evidence/manual-review.md` holds the commands, the exit codes, and aggregate counts from US-011 and US-012.
- [ ] The evidence holds no transcript text, no key, and no private user content.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build` exit 0, and the evidence states that `pnpm run lint` runs no linter.
- [ ] The draft pull request body carries the evidence under `## Manual review`.

## Summary

Verified current state:

- `.agro/skills/prompt-miner/` holds `SKILL.md`, three references, `scripts/mine-traces.mjs`, and its own tests. Two active files outside that directory name the skill: `docs/configuration.md:204` and `.agro/skills/escalate/SKILL.md:83`. The escalate line is a historical anecdote and stays.
- `.agro/skills.lock` has no `prompt-miner` entry. The lock records third-party skills by source, commit, and checksum.
- `.claude/skills` links to `../.agro/skills`. `.agro/scripts/link-providers.sh --check` verifies each provider link.
- `vitest.config.ts` includes `.agro/scripts/__tests__/**/*.test.{ts,mjs}` and `.agro/skills/**/__tests__/**/*.test.mjs`.
- The CLI reads Langfuse keys only from the root `.env` through `loadLangfuseCredentials` in `.agro/cli/src/lib/tracing/providers/langfuse.ts`. `resolveLangfuse` in `.agro/cli/src/commands/langfuse.ts` reads `langfuse.baseUrl` from `agro.json`.
- The dev deployment at `https://langfuse-dev.mifune.dev` runs Langfuse `4.41.0` and returns HTTP 200 on `/api/public/health`.
- `@langfuse/cli@1.2.4` bundles API snapshot `4.35.0`. The CLI accepts `--env <path>`, `--host <url>`, and `api schema --json`. The CLI marks `legacy-sessions` and `legacy-traces` as deprecated and offers `observations`.

Selected approach: one canonical skill, one stage dispatcher, one helper module per stage, and the pinned official CLI as the only Langfuse transport.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/behavioral-training/SKILL.md` (NEW) | Workflow procedure | Stage order, review gates, privacy contract, budgets |
| `.agro/skills/behavioral-training/scripts/behavioral-training.mjs` (NEW) | Stage dispatcher, argument parser | Fixed stage list, `--help`, run options |
| `.agro/skills/behavioral-training/scripts/lib/run-store.mjs` (NEW) | Run directory, lock, atomic checkpoint, manifest | Private, resumable state |
| `.agro/skills/behavioral-training/scripts/lib/langfuse.mjs` (NEW) | CLI adapter, error classes, retries, pagination | Read access through `@langfuse/cli@1.2.4` |
| `.agro/skills/behavioral-training/scripts/lib/<stage>.mjs` (NEW) | One module per stage | Pure transformations that tests import |
| `.agro/skills/behavioral-training/references/` (NEW) | Schemas, rubric, adapter contract | Detail loaded on demand |
| `.agro/skills/langfuse/` (NEW) | Official Langfuse skill at a pinned commit | Langfuse guidance for the agent |
| `.agro/skills.lock` | `skills.langfuse` | Pin and checksum of the official skill |
| `.agro/skills/prompt-miner/` | Whole directory | Removal |
| `docs/configuration.md` | `TYPESAFE_API_KEY` paragraph | Remove the prompt-miner reference |
| `docs/integrations/langfuse.md` | New analysis section | Operator guide |
| `.agro/cli/src/lib/tracing/providers/langfuse.ts` | `loadLangfuseCredentials` | Precedence reference only; no change |
| `.agro/scripts/typesafe.mjs` | `systemOne` | Optional Jev route only; no change |
| `.agro/scripts/link-providers.sh` | `--check` | Provider verification; no change |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/behavioral-training` | New canonical skill | Operator-guided analysis in the current coding harness |
| `node .agro/skills/behavioral-training/scripts/behavioral-training.mjs <stage>` | New skill-local command | Stages `inventory`, `sample`, `normalize`, `validate`, `report`, `publish`, `compare` |
| `npx -y @langfuse/cli@1.2.4` | Pinned tool | Only Langfuse transport; no global install |
| `agro.json` and root `.env` | Reuse | `langfuse.baseUrl` and the two keys; no second configuration store |
| Langfuse datasets and scores | Explicit write | `publish --apply` only |
| `/prompt-miner` | Removal | No alias |
| AGRO lifecycle CLI | N/A | No new `agro` verb |
| Web UI, daemon, scheduler | N/A | No new service, dashboard, or cron |

## Storage

Langfuse stays the source of recorded sessions and of published datasets and scores. Private run files live in one run directory per run.

- Default location: a unique directory under `TMPDIR` with mode `0700`. Each file has mode `0600`.
- `--run-dir` names a durable directory outside each tracked worktree.
- Run files: `manifest.json`, `inventory.jsonl`, `sample.json`, `normalized-sessions.jsonl`, `annotations.jsonl`, `taxonomy.json`, `rubric.json`, `calibration.json`, `dataset-items.jsonl`, `publication-ledger.json`, `report.json`, `report.md`, `compare-thresholds.json`.
- `manifest.json` holds `schemaVersion`, `runId`, the endpoint and project identity, the window, the filters, the seed, source checksums, tool versions, completeness counters, budgets, stage checkpoints, and dataset and rubric versions. The manifest holds no credential.
- Git tracks only `prd.md`, `prd.json`, and sanitized evidence under `.agro/tasks/langfuse-behavioral-training/`.

## Architectural Decisions

- **Source of truth:** Historical traces are evidence, not instructions. The workflow never executes a command from a transcript. An assistant success claim never proves completion.
- **Transport:** The helpers call `@langfuse/cli@1.2.4` with `--env <root>/.env` and `--host <langfuse.baseUrl>`. The helpers never read or print a key. Tests inject a fake CLI runner.
- **Credential precedence:** The root `.env` holds the keys, which matches `loadLangfuseCredentials`. `langfuse.enabled` stays `false`, so tracing stays unchanged.
- **Capability discovery:** `api schema --json` selects the resources. A missing resource yields `incompatible-endpoint`, never a zero-session report.
- **State:** Explicit stage files, atomic checkpoints, bounded retries, and one lock per run. No terminal state.
- **Stage list:** The dispatcher defines all seven stages in US-002 and loads `lib/<stage>.mjs` by name. A missing module exits non-zero with `stage not implemented`. Parallel stories then add modules without edits to the dispatcher.
- **Dataset curation:** `publish` without `--apply` curates the splits, writes `dataset-items.jsonl`, and prints the planned writes. A later run reuses the frozen splits.
- **Judgments:** Deterministic checks run first. The coding agent or the optional Jev route answers narrow semantic questions within `--max-judge-calls`. No aggregate session score approves a training example.
- **Calibration gate:** `fail` is the positive class, because the workflow exists to catch failures. A judge label for one dimension becomes `calibrated` only when each of these conditions is true on human-labeled sessions that no judge prompt used as an example:
  - the sample holds at least 30 labeled sessions, with at least 10 `fail` and at least 10 `pass`;
  - the true positive rate (recall on `fail`) is at least 0.80;
  - the true negative rate (recall on `pass`) is at least 0.80;
  - the coverage (the share of sessions with a verdict other than `unknown`) is at least 0.80.
- **Why rates and not precision:** The discovery sample oversamples failures, so precision and F1 change with the sample mix. The true positive rate and the true negative rate do not change with the mix. `calibration.json` still reports precision and F1 for each dimension.
- **Gate scope:** `rubric.json` stores the gate values, and the operator can change them. A dimension that fails the gate keeps provisional labels and human review. Each training demonstration needs human review, also for a calibrated dimension.
- **Approval:** The operator approves the seed annotations, the taxonomy, and each demonstration. Publication and harness changes are separate explicit actions.
- **Official skill:** The workflow vendors the official Langfuse skill under `.agro/skills/langfuse/` and pins it in `.agro/skills.lock`. The workflow does not edit a provider mirror.

Surface review:

| Surface | Status |
|---|---|
| Host and sandbox | Applied: all work runs in the sandbox; the host runs lifecycle commands only |
| Lifecycle door | N/A: no `agro` verb changes |
| Canonical and provider surfaces | Applied: new skills under `.agro/skills/`; `link-providers.sh --check` verifies links |
| Root and scaffold | Applied: `.agro/manifest.json` includes `skills/**` and `skills.lock`, so scaffolds receive both skills |
| Interactive and headless processes | Applied: the agent runs in Herdr; stages are resumable commands; no daemon |
| Local and remote operation | Applied: `--run-dir` and `--resume` survive a disconnect on a VM |
| Parallel operation | Applied: one worktree per worker; one lock per run directory |
| Public documentation | Applied: `docs/integrations/langfuse.md` and `docs/configuration.md` |
| Verification | Applied: Vitest, `link-providers.sh --check`, fixture runs, live evidence |

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/behavioral-training-access.test.ts` | Config reuse; missing and invalid auth; incompatible endpoint; pagination; bounded retries; empty versus failed reads | Project-scoped access without credential leakage |
| `.agro/scripts/__tests__/behavioral-training-normalize.test.ts` | Null root I/O; multi-trace sessions; overlapping histories; tool order; truncation; missing observations | Evidence reconstruction and honest completeness |
| `.agro/scripts/__tests__/behavioral-training-sample.test.ts` | Fixed seed; overlapping strata; small corpus; task grouping; exact duplicates; disjoint holdout | Reproducibility and leakage prevention |
| `.agro/scripts/__tests__/behavioral-training-evaluation.test.ts` | Verdict set; unsupported claims; confusion metrics; zero denominators; provisional judge; budget exhaustion | Score semantics and bounded evaluation |
| `.agro/scripts/__tests__/behavioral-training-publish.test.ts` | Dry run with zero writes; reviewed-only demonstrations; stable ids; interrupted publish and resume; conflict | Idempotent publication |
| `.agro/scripts/__tests__/behavioral-training-report.test.ts` | Metadata-only report; redaction; no secret in errors; lock collision; atomic resume; replay-only compare; prompt-miner retirement | Private and truthful reports |
| `.agro/scripts/__tests__/standard-skills-link.test.ts` (existing) | Discovery of `behavioral-training` and `langfuse` | Cross-harness portability |

All fixtures are synthetic. No test reads a real transcript. Live network checks run only in US-011.

## Design Principles

- Keep the system small. Prefer the fewest changes that meet the goal.
- Write the failing test first: red, green, refactor.
- Follow the existing patterns in `.agro/scripts/typesafe.mjs` and its tests.
- Separate observed facts, proxy metrics, model judgments, and human-approved labels.
- Prefer a small evidence-backed benchmark to a score on each stored session.
- Keep the evidence that makes a judgment valid, even when the evidence costs tokens.
- Add no explanatory comments to tracked code.
- Add no runtime dependency to `.agro/cli`.

## Out of Scope

- Weight fine-tuning, reinforcement learning, Ollama conversion, GEPA, and any unattended self-improvement loop.
- A new Langfuse deployment, tracing plugin, database, dashboard, cron, or Console feature.
- Mandatory Jev adoption and a multi-judge council.
- A bulk export of all raw sessions.
- Automatic promotion of judge-scored sessions to training examples.
- Automatic changes to `AGENTS.md` or skills, deployment, and merge.
- A claim that historical traces alone replay a coding environment.
- Local changes to `agro.json` and `.gitignore` from the operator credential setup. These changes stay out of the pull request.

## Open Questions

None. The operator resolved each question on 2026-10-11:

1. The pull request targets `development`.
2. The synthetic publication uses the dev project with the prefix `agro/behavior/test`.
3. The calibration gate in `## Architectural Decisions` is the advisor recommendation. The operator can change the values in `rubric.json`.
4. The agent manages the cleanup of synthetic Langfuse data without operator steps.
5. The official skill pin is commit `b86532b77f16f1e27c7cffa32bb632aa3cd9a352` of `github.com/langfuse/skills`.

## Acceptance Criteria

- [ ] Each story in `prd.json` has `passes: true`.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build` exit 0.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] No tracked file holds transcript text, a key, or private user content.
- [ ] The prompt-miner skill has no active entry point, caller, or current documentation reference.
- [ ] The draft pull request `FROM feat/1413-langfuse-behavioral-training TO development` exists with sanitized evidence under `## Manual review`.

## Lessons

Filled by the advisor before undraft.
