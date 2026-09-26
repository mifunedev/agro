# PRD: TypeSafe judgment adapter with a prompt-miner consumer

Status: DRAFT

Source: `work/issue-1121.md` (issue #1121).

## User Stories

### US-001: Register `TYPESAFE_API_KEY` as a secret

**Description:** As an operator, I want `TYPESAFE_API_KEY` in the secret allow-list so that `agro secret set TYPESAFE_API_KEY` stores the key in the root `.env` and no compose file carries the key.

**Acceptance Criteria:**

- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` contains `"TYPESAFE_API_KEY"` as the last entry.
- [ ] The allow-list case in `.agro/cli/src/lib/__tests__/secrets.test.ts` lists `"TYPESAFE_API_KEY"`, and `pnpm test` exits 0.
- [ ] `.example.env` holds a commented `# TYPESAFE_API_KEY=` line under a `TypeSafe` section header.
- [ ] The secret list in `docs/configuration.md` names `TYPESAFE_API_KEY`.
- [ ] `grep -rn TYPESAFE_API_KEY .devcontainer/` prints no line.
- [ ] `bash .agro/evals/probes/compose-env-boundary.sh`, `bash .agro/evals/probes/config-schema-parity.sh`, and `bash .agro/evals/probes/oh-config-surfaces.sh` each exit 0.

### US-002: Add the zero-dependency TypeSafe adapter

**Description:** As a skill author, I want an HTTP adapter for `POST https://api.typesafe.ai/v1/systemone` so that a skill script consumes a Jev judgment without an npm dependency.

**Acceptance Criteria:**

- [ ] `.agro/scripts/typesafe.mjs` imports only `node:` built-in modules and uses the global `fetch`.
- [ ] `resolveApiKey()` returns `process.env.TYPESAFE_API_KEY` when the variable is non-empty.
- [ ] If the variable is empty or unset, `resolveApiKey()` reads `TYPESAFE_API_KEY` from the `.env` file two directories above the adapter, and returns `null` when the file or the key is absent.
- [ ] `evaluate({ state, questions })` sends `model: "jev-latest"` with an `Authorization: Bearer <key>` header and returns `{ ok: true, answers }` on HTTP 200.
- [ ] If no key resolves, `evaluate()` returns `{ ok: false, diagnostic }` and makes no network request.
- [ ] If the request returns a non-200 status, times out, or returns a body without `answers`, `evaluate()` returns `{ ok: false, diagnostic }`. The diagnostic names the cause. No case throws.
- [ ] `node .agro/scripts/typesafe.mjs --preflight` exits 0 in each case. With no key, the command prints the unconfigured diagnostic to stderr. With a key, the command prints `typesafe: configured` to stdout and makes no network request.
- [ ] The unconfigured diagnostic contains the literals `TYPESAFE_API_KEY` and `agro secret set TYPESAFE_API_KEY`.
- [ ] The key value never appears in stdout, stderr, or a diagnostic.
- [ ] `.agro/scripts/README.md` lists `typesafe.mjs` with its purpose.
- [ ] `pnpm test` runs `.agro/scripts/__tests__/typesafe.test.ts` and exits 0 with no network access.

### US-003: Judge `correctionDensity` with TypeSafe on request

**Description:** As a `/prompt-miner` operator, I want a Jev Noul judge for each follow-up prompt so that `correctionDensity` stops counting clarifications as corrections.

**Acceptance Criteria:**

- [ ] `parseArgs` accepts `--correction-judge lexicon|typesafe`, rejects any other value with exit 64, and defaults to `lexicon`.
- [ ] Without `--correction-judge`, `node .agro/skills/prompt-miner/scripts/mine-traces.mjs --dry-run --no-git --fixtures-dir <fixtures>` prints output byte-identical to the output of the pre-change engine for the committed fixtures.
- [ ] With `--correction-judge typesafe` and a key, the engine calls `evaluate()` with the redacted follow-up prompts and one Noul question per follow-up. The engine counts a follow-up as corrective when the `noul` value is greater than or equal to `<threshold>`.
- [ ] Each follow-up text passes through the existing `redact()` function before the engine sends the text.
- [ ] With `--correction-judge typesafe` and no key, the engine prints the unconfigured diagnostic to stderr once, scores every session with the negation lexicon, and exits 0.
- [ ] If any `evaluate()` call returns `ok: false`, the engine prints that diagnostic to stderr once, scores every session in the run with the negation lexicon, and exits 0.
- [ ] With `--correction-judge`, `manifest.correctionJudge` records `requested`, `used`, and `diagnostic`. Without the flag, the manifest holds no `correctionJudge` key.
- [ ] `references/scoring.md`, `references/report-schema.md`, and `SKILL.md` document the flag, the fallback, and the manifest field.
- [ ] `SKILL.md` runs `node .agro/scripts/typesafe.mjs --preflight` before the engine step when the operator passes `--correction-judge typesafe`.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/` exits 0 with no network access.

### US-004: Probe the absent-TypeSafe contract

**Description:** As a maintainer, I want an absent-TypeSafe probe so that a later change cannot turn the fallback into a crash or a silent path.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/typesafe-absent-fallback.sh` declares `# tier:`, `# source:`, and `# desc:` headers.
- [ ] The probe copies `typesafe.mjs` and the prompt-miner scripts into a temporary tree with the same relative layout and no `.env`. The probe runs with `TYPESAFE_API_KEY` unset.
- [ ] The probe exits 0 only when each check passes. The preflight exits 0 and prints the unconfigured diagnostic. The engine exits 0 with `--correction-judge typesafe` and prints the diagnostic once. The `sessions[].scoreBreakdown` values equal the values of a run without the flag.
- [ ] The probe exits 2 when `node` or a copied source file is absent.
- [ ] A fault-injection run that makes the adapter throw on a missing key turns the probe to exit 1.
- [ ] The probe completes in less than 30 seconds.

## Summary

Issue #1121 asks the control plane to consume typed Jev judgments where AGRO already owns the schema, the validator, and the neutral default. This task delivers the adapter, the secret wiring, a preflight, one consumer, and one probe. Other consumers stay out of scope.

Verified current state:

- `.agro/cli/src/lib/secrets.ts:9` defines `SECRET_KEYS` with eight keys. `.agro/cli/src/lib/__tests__/secrets.test.ts:30` pins the list.
- `.agro/cli/src/lib/__tests__/config-render.test.ts:136` asserts that no `SECRET_KEYS` entry reaches the rendered compose environment. The new key inherits that guard.
- `.agro/evals/probes/compose-env-boundary.sh` rejects compose `environment:` keys outside the rendered set and a literal list. The new key stays out of compose.
- The compose file mounts the repository at `/home/sandbox/harness` (`.devcontainer/docker-compose.yml:13`). The root `.env` is therefore readable inside the sandbox. An unattended cron process can read the key without a shell `source` step.
- `mine-traces.mjs:22` defines `NEGATION_LEXICON`. `aggregateSession` (`mine-traces.mjs:307-310`) counts follow-ups that match the lexicon. `references/scoring.md` names `correctionDensity` the highest-variance signal.
- `aggregateSession` is synchronous. `run()` is `async`.
- The prompt-miner tests use `node --test`. The root `vitest.config` includes `.agro/scripts/__tests__/**/*.test.ts` and excludes skill `.mjs` tests.
- The live API reference at `https://docs.typesafe.ai/api.md` defines the request (`state`, `model`, `questions`) and the Noul answer (`{ "type": "noul", "noul": <0..1> }`).

Selected approach: the adapter is a small `fetch` wrapper that never throws. The consumer is opt-in through a flag, so the default engine output does not change. If a run cannot reach TypeSafe, the engine prints one diagnostic and scores the whole run with the lexicon. One run never mixes the two judges.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Allow-lists `TYPESAFE_API_KEY`. |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `allow-list` case | Pins the allow-list. |
| `.example.env` | TypeSafe section | Documents the secret for operators. |
| `docs/configuration.md` | secret list, line 171 | Documents the secret list. |
| `.agro/scripts/typesafe.mjs` | `resolveApiKey`, `evaluate`, `--preflight` | New adapter and preflight. |
| `.agro/scripts/__tests__/typesafe.test.ts` | new | Adapter unit tests with an injected `fetch`. |
| `.agro/scripts/README.md` | script index | Lists the adapter. |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `parseArgs`, `aggregateSession`, `run`, `NEGATION_LEXICON`, `redact` | Consumer of the adapter. |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | new cases | Consumer tests. |
| `.agro/skills/prompt-miner/SKILL.md` | argument hint, engine step | Flag and preflight step. |
| `.agro/skills/prompt-miner/references/scoring.md` | `correctionDensity` row, lexicon section | Judge definition and fallback. |
| `.agro/skills/prompt-miner/references/report-schema.md` | `manifest` | `correctionJudge` field. |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | new | Absent-TypeSafe probe. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret set TYPESAFE_API_KEY` | new accepted key | The existing verb accepts the new key. No new verb. |
| `node .agro/scripts/typesafe.mjs --preflight` | new command | Reports configured or unconfigured. Exits 0 in both cases. |
| `mine-traces.mjs --correction-judge lexicon\|typesafe` | new flag | Selects the `correctionDensity` judge. Default `lexicon`. |
| prompt-miner dataset `manifest.correctionJudge` | new optional field | The engine writes the field only when the operator passes the flag. |
| `evaluate({ state, questions })` | new module API | Returns `{ ok, answers }` or `{ ok: false, diagnostic }`. |

## Storage

The key lives in the gitignored root `.env`, mode 0600, which `agro secret set` owns. The adapter reads the key and writes no file. The prompt-miner reports keep their existing scratch location under `$TMPDIR`. The task adds no cache of judgments.

## Architectural Decisions

- **Source of truth for the key:** `SECRET_KEYS` owns the allow-list. The adapter resolves the key from `process.env`, then from the repository-root `.env`. The compose `environment:` block never carries the key.
- **Transport:** the adapter calls the HTTP API with the global `fetch` of Node 20. The adapter adds no npm dependency, so `.agro/cli` keeps zero runtime dependencies and the `pnpm audit` gate sees no change.
- **Failure contract:** the adapter never throws. Each failure returns one diagnostic that names the cause and the fix. The caller prints the diagnostic, continues with the deterministic fallback, and exits 0.
- **Opt-in consumer:** the lexicon stays the default judge. `--correction-judge typesafe` enables the network call. Without the flag, the engine output stays byte-identical.
- **Whole-run fallback:** the engine resolves all TypeSafe judgments before scoring. One failure switches the whole run to the lexicon, so one dataset never mixes two judges.
- **Privacy:** the engine sends only `redact()` output of follow-up prompts. The engine never sends the first prompt, assistant text, or tool output.
- **Surfaces:**
  - Host and sandbox: applied. The operator runs `agro secret set` on the host. The adapter and the engine run in the sandbox.
  - Lifecycle door: applied. `agro secret set` accepts the key. No verb changes.
  - Canonical and provider surfaces: applied. All skill edits land in `.agro/skills/prompt-miner/`. No provider mirror changes.
  - Root and scaffold: applied to the root. `<scaffold impact>` is open question 5.
  - Interactive and headless processes: not applicable. The task starts no persistent process.
  - Local and remote operation: applied. The key resolves from the mounted `.env` with no attached shell.
  - Parallel operation: applied. The adapter holds no shared mutable state.
  - Public documentation: `<agro-web change>` is open question 6.
  - Verification: applied. See the Test Plan.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | allow-list holds `TYPESAFE_API_KEY` | US-001 allow-list. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | existing secret-exclusion loop | US-001 compose boundary. |
| `.agro/scripts/__tests__/typesafe.test.ts` | key from env or `.env`. No key: diagnostic, no request. HTTP 200: answers. HTTP 401, 5xx, timeout, bad body: diagnostic. Diagnostics omit the key. | US-002. |
| `.agro/scripts/__tests__/typesafe.test.ts` | `--preflight` exits 0 configured and unconfigured | US-002 preflight. |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | flag parse and reject; default output unchanged; injected judge at `<threshold>`; redaction before send; unconfigured fallback; failure fallback; manifest field only with the flag | US-003. |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | absent-key preflight and engine run; scoreBreakdown parity; fault injection | US-004. |
| `.agro/evals/probes/prompt-miner-schema-compat.sh` | existing | Default engine path stays green. |

## Design Principles

- Keep the key out of every compose `environment:` block.
- Fail loudly, then continue: one diagnostic, exit 0, deterministic fallback.
- Keep the default behavior byte-identical when TypeSafe is absent.
- Add no npm dependency to the adapter or the engine.
- Send the smallest redacted state that answers the question.
- Add no tracked-code comments, per the root `AGENTS.md`.

## Out of Scope

- Skill suggestion through `UserPromptSubmit`. That change needs `/architect` and an ADR.
- Model-assisted guard hooks.
- `/wiki query` reranking. `references/query.md` forbids the change.
- Tier-B behavioral evals.
- Other consumers: `simplicity-review.json`, `ui-evidence.json`, `delegate-graph.json`, the capability triad, and the `/retro` hypothesis table.
- `.sh` extraction for `audit skills`, `audit context`, `audit eval-quality`, and `wiki query`.
- Changes to `crons/prompt-miner.md`. That cron ships `enabled: false`.
- Edits to the vendored `.agro/skills/typesafe-ai/SKILL.md`.

## Open Questions

1. What Noul threshold counts a follow-up as corrective? Proposed default: `0.5`. The value stays `<threshold>` until the operator confirms the value or supplies a hand-labeled calibration sample.
2. Does the operator approve the egress of redacted follow-up prompts to `api.typesafe.ai`? The plan assumes yes, gated by the opt-in flag.
3. What request timeout applies? Proposed default: `<timeout-ms>` = 10000.
4. What maximum number of Noul questions fits one request, and what rate limit applies? The public API page states neither value. The adapter batches follow-ups per session until the operator supplies `<max-questions-per-request>`.
5. Must initialized projects receive the adapter and the secret, or only this orchestrator repository? The value stays `<scaffold impact>`.
6. Does `mifunedev/agro-web` document the secret list? If yes, the task needs a matching change. The value stays `<agro-web change>`.

## Acceptance Criteria

- [ ] Each story acceptance criterion above passes.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/` exits 0.
- [ ] The `/eval` probe suite reports no REGRESSION, and `typesafe-absent-fallback.sh` reports PASS.
- [ ] `git diff --stat` shows no change under `.devcontainer/` and no change to any `package.json` dependency list.

## Lessons

Filled by the advisor before undraft.
