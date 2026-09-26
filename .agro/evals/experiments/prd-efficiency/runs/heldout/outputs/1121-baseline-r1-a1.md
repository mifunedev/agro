# PRD: TypeSafe System One adapter with a prompt-miner consumer

Status: DRAFT

## User Stories

### US-001: Allow-list the TypeSafe API key as a secret

**Description:** As an operator, I want `TYPESAFE_API_KEY` to be an allow-listed secret so that `agro secret set TYPESAFE_API_KEY` stores the key in the gitignored root `.env`.

**Acceptance Criteria:**

- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` contains `"TYPESAFE_API_KEY"` as the last entry.
- [ ] The allow-list case in `.agro/cli/src/lib/__tests__/secrets.test.ts` expects the new nine-key list, and `pnpm test:scripts` exits 0.
- [ ] `.example.env` holds a commented-out `# TYPESAFE_API_KEY=` line under a `TypeSafe System One` section. The section states that the key reaches a process only through the shell environment.
- [ ] The `## Secrets` list in `docs/configuration.md` names `TYPESAFE_API_KEY`.
- [ ] No `.devcontainer/docker-compose*.yml` file contains `TYPESAFE_API_KEY`.
- [ ] `bash .agro/evals/probes/config-schema-parity.sh` exits 0.
- [ ] `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.
- [ ] `pnpm run typecheck` exits 0.

### US-002: Add the zero-dependency System One adapter

**Description:** As a control-plane script author, I want one System One adapter at `.agro/scripts/typesafe.mjs` so that every consumer gets typed answers or a named failure reason. The adapter calls `POST https://api.typesafe.ai/v1/systemone`.

**Acceptance Criteria:**

- [ ] `.agro/scripts/typesafe.mjs` imports only `node:` built-in modules and uses the global `fetch`.
- [ ] The adapter exports `askSystemOne({ state, questions, apiKey, fetchImpl })`. The default `apiKey` is `process.env.TYPESAFE_API_KEY`. The default `fetchImpl` is `globalThis.fetch`.
- [ ] Each request sends `"model": "jev-latest"`, the header `Authorization: Bearer <key>`, and the header `Content-Type: application/json`.
- [ ] Each request aborts after 10000 ms through `AbortSignal.timeout(10000)`.
- [ ] On HTTP 200 with an `answers` object, `askSystemOne` resolves to `{ ok: true, answers }`.
- [ ] `askSystemOne` never throws and never rejects. For each failure it resolves to `{ ok: false, reason, diagnostic }`, where `reason` is one of `unconfigured`, `unauthorized`, `rate-limited`, `http-error`, `timeout`, `network`, `malformed-response`.
- [ ] Each `diagnostic` string names the cause and the fix. The `unconfigured` diagnostic names `TYPESAFE_API_KEY` and the command `agro secret set TYPESAFE_API_KEY`.
- [ ] No `diagnostic` string and no log line contains the API key value.
- [ ] `.agro/scripts/__tests__/typesafe.test.ts` covers each `reason` value and the success path with an injected `fetchImpl`. The test makes no network call. `pnpm test:scripts` exits 0.
- [ ] `.agro/scripts/README.md` lists `typesafe.mjs` in its table.

### US-003: Add the TypeSafe preflight

**Description:** As an operator, I want a preflight that reports the TypeSafe configuration state up front so that I see a named cause. Without the preflight, a bad key surfaces as an opaque HTTP 401.

**Acceptance Criteria:**

- [ ] `node .agro/scripts/typesafe.mjs --check` exits 0 in every outcome.
- [ ] If `TYPESAFE_API_KEY` is unset or empty, `--check` prints the `unconfigured` diagnostic to stderr and makes no network call.
- [ ] If `TYPESAFE_API_KEY` is set, `--check` sends one minimal Noul request. On success, the command prints `TYPESAFE: configured (jev-latest)` to stdout.
- [ ] If the minimal request fails, `--check` prints the diagnostic for the failure `reason` to stderr. An HTTP 401 prints the `unauthorized` diagnostic, which tells the operator to replace the key with `agro secret set TYPESAFE_API_KEY`.
- [ ] The `import.meta` entrypoint guard runs the CLI only when the file is the process entrypoint. An `import` of `typesafe.mjs` runs no preflight.
- [ ] `.agro/scripts/__tests__/typesafe.test.ts` covers the unset-key path of `--check` through a child process with `TYPESAFE_API_KEY` removed from the environment.

### US-004: Judge prompt-miner correction density with Jev

**Description:** As a prompt-miner operator, I want an opt-in `--correction-judge typesafe` mode so that `correctionDensity` stops counting casual clarifications as corrections. The mode replaces the 12-word negation lexicon with calibrated Jev judgments.

**Acceptance Criteria:**

- [ ] `mine-traces.mjs` accepts `--correction-judge lexicon|typesafe`. The default is `lexicon`. `parseArgs` rejects any other value with exit code 64.
- [ ] With the default `lexicon` judge, each `sessions[]` entry in the `--dry-run --no-git` output on the committed fixtures matches the output of the current engine byte for byte.
- [ ] The existing case `score-breakdown arithmetic matches the documented formula` in `mine-traces.test.mjs` passes unchanged.
- [ ] With `--correction-judge typesafe`, the engine sends one request for each session that has at least one follow-up prompt. Each request holds one Noul question for each follow-up.
- [ ] The engine passes each follow-up prompt through `redact()` before the prompt enters a request body.
- [ ] With `--correction-judge typesafe`, `correctionDensity` equals the sum of the follow-up Noul probabilities divided by the total human prompt count, clamped to 0..1.
- [ ] If any request in a run fails, the engine discards every Jev answer for the run. The engine then scores each session with the lexicon, prints one diagnostic to stderr, and exits 0.
- [ ] `manifest.correctionJudge` records the judge that produced the scores: `lexicon` or `typesafe:jev-latest`.
- [ ] The engine loads the adapter through a dynamic `import()` of `../../../scripts/typesafe.mjs`. If the import fails, the engine prints a diagnostic that names the missing adapter and falls back to the lexicon.
- [ ] `node .claude/skills/prompt-miner/scripts/mine-traces.mjs --dry-run --no-git --correction-judge typesafe` with `TYPESAFE_API_KEY` unset exits 0 and prints the `unconfigured` diagnostic to stderr.
- [ ] `mine-traces.test.mjs` covers the typesafe path, the mid-run failure path, and the unconfigured path with an injected judge. The tests make no network call.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.
- [ ] `SKILL.md` Step 1 runs `node .agro/scripts/typesafe.mjs --check` before the engine when the arguments contain `--correction-judge typesafe`.
- [ ] The `SKILL.md` privacy contract states that `--correction-judge typesafe` sends redacted follow-up prompt text to `api.typesafe.ai`.
- [ ] `references/scoring.md` documents both judges. `references/report-schema.md` documents `manifest.correctionJudge`.

### US-005: Guard the TypeSafe-absent behavior with a probe

**Description:** As a harness maintainer, I want a deterministic probe for the TypeSafe-absent path so that a hidden TypeSafe dependency turns the eval suite red.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/typesafe-absent-fallback.sh` declares `# tier:`, `# source:`, and `# desc:` headers.
- [ ] The probe removes `TYPESAFE_API_KEY` from the environment of each child process. The probe makes no network call.
- [ ] The probe runs `mine-traces.mjs --dry-run --no-git` on the committed fixtures twice: once with the default judge and once with `--correction-judge typesafe`.
- [ ] The probe returns PASS only when both runs exit 0, both `.sessions` arrays are equal under `jq -S`, and both runs report `manifest.correctionJudge == "lexicon"`.
- [ ] The probe returns PASS only when the stderr of the typesafe run contains `TYPESAFE_API_KEY` and `agro secret set TYPESAFE_API_KEY`.
- [ ] The probe returns PASS only when `node .agro/scripts/typesafe.mjs --check` exits 0 and prints the `unconfigured` diagnostic.
- [ ] The probe returns 2 with a stderr reason when `node` or `jq` is absent.
- [ ] Fault injection: a disposable copy of the engine that exits 1 on the unconfigured path makes the probe return 1 and name the failed condition.
- [ ] `bash .agro/skills/eval/run.sh` reports the probe as PASS.

## Summary

Issue 1121 names a recurring AGRO shape: a strict schema and validator wrap a value that an agent produces from prose. This task builds the first typed-judgment path. The path fills one value slot with a calibrated TypeSafe System One answer and keeps the current deterministic value as the fallback.

Verified current state:

- `.agro/cli/src/lib/secrets.ts` owns `SECRET_KEYS` with 8 keys. `secrets.test.ts` pins the exact list.
- `config-schema-parity.sh` fails when `.example.env` and `SECRET_KEYS` differ. `compose-env-boundary.sh` fails when a compose `environment:` key is neither rendered by `config-render.ts` nor a documented literal. A new compose key for TypeSafe therefore fails that probe.
- `.example.env` documents the shell-export pattern for secrets outside compose: `set -a; source /home/sandbox/harness/.env; set +a`.
- `mine-traces.mjs` computes `correctionDensity` in `aggregateSession` from `NEGATION_LEXICON`. `aggregateSession` is synchronous. `references/scoring.md` names `correctionDensity` the highest-variance signal.
- `.agro/manifest.json` ships `scripts/**`, so an installed harness holds `.agro/scripts/typesafe.mjs`.
- `vitest.config.ts` runs `.agro/scripts/__tests__/**/*.test.ts` in CI through `pnpm test:scripts`. No CI workflow runs `node --test` on `mine-traces.test.mjs`.
- The live API reference at `https://docs.typesafe.ai/api.md` defines the request as `state`, `model`, and a `questions` map. A Noul answer is `{ "type": "noul", "noul": <0..1> }`. HTTP 429 means a rate limit.

Selected approach: a zero-dependency HTTP adapter with a preflight mode, one opt-in prompt-miner consumer, and one probe for the absent path. The engine judges all follow-ups before aggregation and passes the probabilities into `aggregateSession`. `aggregateSession` stays synchronous.

Affected surfaces:

| Surface | State | Note |
|---|---|---|
| Host and sandbox | applied | `agro secret set` runs on the host or in the sandbox. The adapter and the engine run in the sandbox. |
| Lifecycle door | applied | `agro secret set TYPESAFE_API_KEY` accepts the new key. No new verb. |
| Canonical and provider surfaces | applied | All edits land under `.agro/`. The `.claude/skills/prompt-miner` link resolves the engine. |
| Root and scaffold | applied | `.agro/scripts/` ships in the payload, so initialized projects receive the adapter. |
| Interactive and headless processes | not applicable | No persistent process. The disabled `crons/prompt-miner.md` stays unchanged. |
| Local and remote operation | applied | The key reaches the process through the shell environment on any host. |
| Parallel operation | not applicable | No shared mutable state. Each run writes its own `$TMPDIR` report. |
| Public documentation | applied | See the open question on `mifunedev/agro-web`. |
| Verification | applied | See the Test Plan. |

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Secret allow-list. |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `allow-list` suite | Pins the allow-list. |
| `.example.env` | TypeSafe section | Documents the secret. |
| `docs/configuration.md` | `## Secrets` | Lists the allow-listed keys. |
| `.agro/scripts/typesafe.mjs` | `askSystemOne`, `--check` CLI | New adapter and preflight. |
| `.agro/scripts/__tests__/typesafe.test.ts` | new suite | Adapter unit tests. |
| `.agro/scripts/README.md` | script table | Script index. |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `parseArgs`, `run`, `aggregateSession`, `USAGE` | Consumer: judge selection, batching, fallback. |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | new cases | Consumer unit tests. |
| `.agro/skills/prompt-miner/SKILL.md` | `argument-hint`, Step 1, privacy contract | Skill procedure. |
| `.agro/skills/prompt-miner/references/scoring.md` | `correctionDensity`, negation lexicon | Scoring contract. |
| `.agro/skills/prompt-miner/references/report-schema.md` | `manifest` | Dataset schema. |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | new probe | Absent-path guard. |
| `CHANGELOG.md` | next entry | Change record per `/git`. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret set TYPESAFE_API_KEY` | extended | Accepts one more allow-listed key. |
| `node .agro/scripts/typesafe.mjs --check` | new | Preflight. Exits 0 in every outcome. |
| `askSystemOne(...)` | new | ESM export for control-plane scripts. |
| `mine-traces.mjs --correction-judge lexicon\|typesafe` | new flag | Default `lexicon`. |
| `manifest.correctionJudge` | new field | Records the judge for the run. |
| `/prompt-miner` Step 1 | changed | Runs the preflight when the arguments contain `--correction-judge typesafe`. |

## Storage

N/A. The key persists in the root `.env` through the existing `agro secret set` path. The adapter holds no state. prompt-miner reports stay in `$TMPDIR`.

## Architectural Decisions

- **Transport.** The adapter calls the HTTP API with the global `fetch`. The npm SDK stays out, so `.agro/cli` keeps zero runtime dependencies and `pnpm audit --audit-level low` sees no new package.
- **Secret path.** `TYPESAFE_API_KEY` lives in `SECRET_KEYS` and `.example.env` only. The key never enters a compose `environment:` block. The adapter reads `process.env.TYPESAFE_API_KEY` only. The adapter never reads `.env` itself.
- **Failure contract.** Unconfigured fails loudly, then continues: one stderr diagnostic that names the cause and the fix, exit 0, and the deterministic lexicon value. `askSystemOne` returns failures as values and never throws.
- **Opt-in consumer.** The default judge stays `lexicon`. The `typesafe` judge sends redacted transcript text to a third party, so the operator requests the judge explicitly with the flag. Key presence alone starts no egress.
- **One judge per run.** A run never mixes Jev scores with lexicon scores. A single failed request moves the whole run to the lexicon. Mixed scores corrupt the per-stratum correlations in `references/markers.md`.
- **Expected-value density.** The typesafe judge sums the Noul probabilities. That sum is the expected count of corrective follow-ups. This choice needs no invented probability threshold.
- **Loose coupling.** The engine loads the adapter through a dynamic `import()`. A copy of the skill without `.agro/scripts/` still runs on the lexicon and reports the missing adapter.
- **Batching.** One request per session with one Noul question per follow-up. Independent questions over the same state run in parallel on the server.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | allow-list holds nine keys | US-001 |
| `.agro/evals/probes/config-schema-parity.sh` | existing probe | US-001 `.example.env` parity |
| `.agro/evals/probes/compose-env-boundary.sh` | existing probe | US-001 key stays out of compose |
| `.agro/scripts/__tests__/typesafe.test.ts` | success; `unconfigured`; `unauthorized` on 401; `rate-limited` on 429; `http-error` on 500; `timeout`; `network`; `malformed-response`; key absent from each diagnostic; request body holds `jev-latest` | US-002 |
| `.agro/scripts/__tests__/typesafe.test.ts` | `--check` with the key unset exits 0 and prints the `unconfigured` diagnostic | US-003 |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | `--correction-judge` parsing; lexicon output unchanged; expected-value density from injected Noul answers; `redact()` applied before egress; mid-run failure falls back for the whole run; unconfigured falls back; `manifest.correctionJudge` values | US-004 |
| `.agro/evals/probes/prompt-miner-schema-compat.sh` | existing probe | US-004 keeps fixture parsing |
| `.agro/evals/probes/prompt-miner-symlink-entrypoint.sh` | existing probe | US-004 keeps the symlink entrypoint |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | new probe plus fault injection | US-005 |

Write each test before its implementation. Run `pnpm test:scripts`, `pnpm run typecheck`, `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs`, and `bash .agro/skills/eval/run.sh`.

## Design Principles

- Code is the source of truth. Add no explanatory comments to tracked code.
- Keep one adapter for every TypeSafe call. A consumer never builds its own request.
- A typed answer fills a slot that already has a schema, a validator, and a neutral default. The default stays reachable.
- Never fall back silently. Never crash on a TypeSafe failure.
- Keep transcript egress explicit, redacted, and documented.
- Add no machinery beyond the one proven consumer.

## Out of Scope

- Skill suggestion through `UserPromptSubmit`. This change needs `/architect` and an ADR.
- Model-assisted guard hooks. These hooks sit on a security boundary with adversarial input.
- `/wiki query` reranking. `references/query.md` forbids reranking.
- Tier-B behavioral evals.
- Other schema'd-envelope consumers: `simplicity-review.json`, `ui-evidence.json`, `delegate-graph.json`, the capability triad, and the `/retro` hypothesis table.
- `.sh` extraction for the shell snippets in `audit skills`, `audit context`, `audit eval-quality`, and `wiki query`.
- Enabling `crons/prompt-miner.md`.
- A calibration study of Jev against a hand-labeled correction sample.

## Open Questions

1. Does `mifunedev/agro-web` list the allow-listed secrets? If yes, the public page needs `TYPESAFE_API_KEY`.
2. Does the TypeSafe API cap the number of questions in one request? If a cap exists, the engine chunks each session's follow-ups to `<per-request question cap>`.
3. Does the `mifunedev/skills` registry publish `prompt-miner`? If yes, the published copy runs on the lexicon only, because the dynamic import cannot resolve `.agro/scripts/typesafe.mjs`.
4. Does the operator want the default judge to change to `typesafe` after a calibration study? This plan keeps `lexicon` as the default.
5. Does the operator want CI to run `node --test` on `mine-traces.test.mjs`? No workflow runs that suite today.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `pnpm test:scripts` exits 0.
- [ ] `pnpm run typecheck` exits 0.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION.
- [ ] With `TYPESAFE_API_KEY` unset, every existing prompt-miner probe returns the same result as on the base branch.
- [ ] `git diff --stat` shows no change under `.devcontainer/` and no change to `package.json` dependencies.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `CHANGELOG.md` holds one entry for this change.

## Lessons

Filled by the advisor before undraft.
