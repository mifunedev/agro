# PRD: TypeSafe judgment adapter with prompt-miner as first consumer

Status: DRAFT

Source: GitHub issue #1121 (`work/issue-1121.md`).

## User Stories

### US-001: Allow-list `TYPESAFE_API_KEY` as a secret

**Description:** As an operator, I want `TYPESAFE_API_KEY` stored in the root `.env` through `agro secret set` so that the key stays out of git and out of the compose environment.

**Acceptance Criteria:**

- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` ends with `"TYPESAFE_API_KEY"`.
- [ ] The allow-list case in `.agro/cli/src/lib/__tests__/secrets.test.ts` expects the new nine-key list, and `pnpm test` exits 0.
- [ ] `.example.env` holds a commented-out `# TYPESAFE_API_KEY=` line under a `TypeSafe` section header.
- [ ] The `.example.env` section states that the key is optional and names `set -a; source /home/sandbox/harness/.env; set +a` as the load step.
- [ ] The `## Secrets` key list in `docs/configuration.md` names `TYPESAFE_API_KEY`.
- [ ] No `.devcontainer/docker-compose*.yml` file names `TYPESAFE_API_KEY`, and `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.
- [ ] `bash .agro/evals/probes/oh-config-surfaces.sh` and `bash .agro/evals/probes/config-schema-parity.sh` exit 0.

### US-002: Add the zero-dependency adapter and its preflight

**Description:** As a control-plane script author, I want one adapter at `.agro/scripts/typesafe.mjs` so that each consumer gets a typed judgment or a named fallback reason.

**Acceptance Criteria:**

- [ ] `.agro/scripts/typesafe.mjs` imports only `node:` built-in modules.
- [ ] The adapter sends each request as `POST https://api.typesafe.ai/v1/systemone` with the model `jev-latest`.
- [ ] The request body and the response parser follow the live contract at `https://docs.typesafe.ai/api.md`. The worker records the page date in the PR body.
- [ ] The adapter exports `typesafeStatus(env)`. The function returns `{ configured: false, reason, fix }` when `TYPESAFE_API_KEY` is unset or empty.
- [ ] The adapter exports one async judgment function that accepts an injected `fetch`. The function returns `{ ok: false, reason }` on a missing key, an HTTP status other than 2xx, a network error, a timeout, or a malformed response. The function never throws.
- [ ] `node .agro/scripts/typesafe.mjs --preflight` with `TYPESAFE_API_KEY` unset exits 0 and writes one stderr line that starts with `TYPESAFE: unconfigured`.
- [ ] The preflight line names the cause `TYPESAFE_API_KEY is not set` and the fix `agro secret set TYPESAFE_API_KEY`.
- [ ] `node .agro/scripts/typesafe.mjs --preflight` with `TYPESAFE_API_KEY` set exits 0 and writes one stderr line that starts with `TYPESAFE: configured`. The preflight sends no network request.
- [ ] No adapter output contains the value of `TYPESAFE_API_KEY`.
- [ ] `.agro/scripts/__tests__/typesafe.test.ts` covers each failure reason with a stubbed `fetch`, opens no network socket, and `pnpm test` exits 0.
- [ ] The table in `.agro/scripts/README.md` lists `typesafe.mjs`.

### US-003: Judge `correctionDensity` with TypeSafe in prompt-miner

**Description:** As a prompt-miner operator, I want a calibrated TypeSafe judgment for each follow-up prompt so that `correctionDensity` stops depending on the 12-word negation lexicon.

**Acceptance Criteria:**

- [ ] `mine-traces.mjs` accepts `--correction-judge lexicon|typesafe`. The default is `lexicon`.
- [ ] With `--correction-judge lexicon`, every `sessions[]` and `unranked[]` record is byte-identical to the output of the current engine on the committed fixtures.
- [ ] With `--correction-judge typesafe` and a working adapter, the engine sends each follow-up prompt through `redact()` before the adapter call.
- [ ] With `--correction-judge typesafe` and a working adapter, `correctionDensity` equals the sum of per-prompt corrective probabilities divided by the human-prompt count, clamped to 0..1.
- [ ] With `--correction-judge typesafe` and `TYPESAFE_API_KEY` unset, the engine writes one stderr diagnostic that names the cause and the fix, uses the lexicon, and exits 0.
- [ ] With `--correction-judge typesafe` and a failing adapter call, the engine writes one stderr diagnostic that names the reason, uses the lexicon for that session, and exits 0.
- [ ] `manifest.correctionJudge` records `lexicon` or `typesafe:jev-latest`. `manifest.correctionJudgeFallbacks` records the count of sessions that fell back to the lexicon.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0 and covers the lexicon default, the unconfigured fallback, and a stubbed TypeSafe path.
- [ ] `.agro/skills/prompt-miner/SKILL.md` Step 1 runs the adapter preflight before the engine when the arguments hold `--correction-judge typesafe`.
- [ ] `references/scoring.md` defines both judges. `references/report-schema.md` documents both new manifest fields.
- [ ] The privacy contract in `SKILL.md` states that `--correction-judge typesafe` sends redacted follow-up prompt text to `api.typesafe.ai`.

### US-004: Prove the absent-TypeSafe behavior with a probe

**Description:** As a harness maintainer, I want a tier-A probe so that a change which breaks AGRO without TypeSafe fails the eval suite.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/typesafe-absent-fallback.sh` declares `# tier: A`, `# source:` naming issue #1121, and `# desc:` headers.
- [ ] The probe runs each check with `TYPESAFE_API_KEY` removed from the child environment. The probe makes no network request.
- [ ] The probe asserts that `typesafe.mjs --preflight` exits 0 and writes the `TYPESAFE: unconfigured` line.
- [ ] The probe asserts that `mine-traces.mjs --dry-run --no-git --correction-judge typesafe` on the committed fixtures exits 0, writes the diagnostic, and records `manifest.correctionJudge` as `lexicon`.
- [ ] The probe asserts that the `sessions[]` output of that run equals the `sessions[]` output of a `--correction-judge lexicon` run.
- [ ] The probe asserts that `typesafe.mjs` imports only `node:` modules.
- [ ] The probe exits 2 with a stderr reason when `node`, `jq`, the adapter, or the engine is absent.
- [ ] Fault injection on a disposable copy turns each assertion red with exit 1. The worker records each injected fault and the observed message in the PR body.
- [ ] `bash .agro/evals/probes/typesafe-absent-fallback.sh` exits 0 in under 30 seconds.

## Summary

Issue #1121 names a recurring AGRO shape: a strict schema around a value that an agent produces from prose. This task adds the first path for a typed, calibrated value from TypeSafe System One (`jev-latest`). The task proves the path on one consumer.

Verified current state:

- `.agro/cli/src/lib/secrets.ts` owns `SECRET_KEYS`, an eight-key allow-list. `secrets.test.ts` pins the exact list.
- `config-render.ts` refuses to render an allow-listed key into the compose environment file. `config-render.test.ts` iterates `SECRET_KEYS`, so the new key gets that coverage without a new test.
- `compose-env-boundary.sh` fails when a compose `environment:` key is neither rendered nor a documented literal. The probe keeps `TYPESAFE_API_KEY` out of compose.
- `.example.env` documents each secret, commented out. Keys such as `META_API_KEY` and the Langfuse pair reach a process only through `set -a; source /home/sandbox/harness/.env; set +a`.
- `mine-traces.mjs` computes `correctionDensity` in `aggregateSession()`. The function counts follow-up prompts that match `NEGATION_LEXICON`. `references/scoring.md` names the signal the highest-variance signal.
- `mine-traces.mjs` imports only `node:` modules. Its `run()` function is async, so an awaited adapter call fits without a new control flow.
- `.agro/scripts/closing-keywords.mjs` sets the pattern for an `.mjs` module under `.agro/scripts/` with a vitest test in `.agro/scripts/__tests__/`.
- No CI job runs `mine-traces.test.mjs`. The probe `prompt-miner-schema-compat.sh` runs the engine on the committed fixtures.

Selected approach: add the secret, then a thin HTTP adapter, then the opt-in consumer, then the probe. The consumer uses the expected corrective count, so the calibrated probability replaces a threshold.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Allow-list that admits `TYPESAFE_API_KEY` to `.env`. |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `allow-list` case | Pins the exact key list. |
| `.example.env` | new `TypeSafe` section | Documents the optional key and the load step. |
| `docs/configuration.md` | `## Secrets` | Public list of allow-listed keys. |
| `.agro/scripts/typesafe.mjs` | `typesafeStatus`, judgment function, `--preflight` | New adapter over the HTTP API. |
| `.agro/scripts/__tests__/typesafe.test.ts` | new | Adapter tests with a stubbed `fetch`. |
| `.agro/scripts/README.md` | script table | Lists the adapter. |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `parseArgs`, `aggregateSession`, `run`, `USAGE` | Consumer: new flag, judge selection, manifest fields. |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | new cases | Consumer tests. |
| `.agro/skills/prompt-miner/SKILL.md` | Privacy contract, Step 1 | Preflight step and disclosure of the external call. |
| `.agro/skills/prompt-miner/references/scoring.md` | `correctionDensity` row, negation lexicon | Defines both judges. |
| `.agro/skills/prompt-miner/references/report-schema.md` | `manifest` | Documents `correctionJudge` and `correctionJudgeFallbacks`. |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | new | Absent-TypeSafe guarantee. |
| `CHANGELOG.md` | `[Unreleased]` | One `Added` entry per the `/git` changelog rules. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret set TYPESAFE_API_KEY` | Extended | The command accepts the new key. |
| `agro secret list` | Extended | The command reports the new key when `.env` holds a value. |
| `node .agro/scripts/typesafe.mjs --preflight` | New | Reports `configured` or `unconfigured` on stderr, and exits 0. |
| `mine-traces.mjs --correction-judge lexicon\|typesafe` | New flag | Selects the `correctionDensity` judge. The default is `lexicon`. |
| prompt-miner JSON dataset `manifest` | Extended | Adds `correctionJudge` and `correctionJudgeFallbacks`. |
| Environment variable `TYPESAFE_API_KEY` | New | The adapter reads the value from `process.env` only. |

## Storage

The key lives in the gitignored root `.env` at mode `0600`, the same as each other allow-listed secret. The adapter holds no state and writes no file. The prompt-miner reports stay in `$TMPDIR/oh-prompt-miner/<UTC-date>/`, the current location.

## Architectural Decisions

- **Source of truth for the key:** `SECRET_KEYS` owns admission to `.env`. The adapter reads `process.env.TYPESAFE_API_KEY` only. The adapter never parses `.env`. This matches the `META_API_KEY` and Langfuse precedent.
- **No compose wiring:** the compose `environment:` block does not carry the key. `compose-env-boundary.sh` already enforces this rule.
- **HTTP, not the SDK:** the adapter uses the Node built-in `fetch`. This keeps `.agro/cli` free of a runtime dependency and keeps the `pnpm audit --audit-level low` gate out of the path.
- **One adapter, no consumer-specific logic:** `typesafe.mjs` owns transport, status, timeout, and error mapping. Each consumer owns its question and its fallback.
- **Fail loudly, then continue:** each failure path writes one stderr diagnostic that names the cause and the fix. Each path then exits 0 and uses the deterministic fallback. No path falls back without a diagnostic. No path crashes.
- **Opt-in consumer:** prompt-miner uses TypeSafe only when the arguments hold `--correction-judge typesafe`. The key alone does not send transcript text off the host. The prompt-miner privacy contract calls itself non-negotiable, so a new data flow needs an explicit operator action.
- **Calibrated value, no threshold:** `correctionDensity` becomes the expected corrective count over the human-prompt count. The formula consumes the probability directly and adds no tunable cutoff.
- **Auditable scores:** the manifest records the judge and the fallback count, so each score stays reconstructable.
- **Cron unchanged:** `crons/prompt-miner.md` keeps the lexicon default.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | allow-list holds nine keys | `SECRET_KEYS` admits `TYPESAFE_API_KEY`. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | existing `SECRET_KEYS` loop | The key never renders into the compose environment file. |
| `.agro/scripts/__tests__/typesafe.test.ts` | unset key; empty key; HTTP 401; HTTP 500; network error; timeout; malformed body; success | Each path returns a typed result and never throws. |
| `.agro/scripts/__tests__/typesafe.test.ts` | `--preflight` with the key unset and set | Exit 0, the correct stderr line, and no key value in output. |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | lexicon default | Output matches the current engine. |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | `typesafe` with the key unset | Diagnostic, lexicon fallback, exit 0. |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | `typesafe` with a stubbed judge | Expected-count density, `redact()` applied, manifest fields set. |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | preflight, engine fallback, output equality, zero-dependency import | AGRO without TypeSafe behaves as today. |
| existing probes | `compose-env-boundary.sh`, `oh-config-surfaces.sh`, `config-schema-parity.sh`, `prompt-miner-schema-compat.sh` | No regression on the secret surfaces or the engine. |

Write each test before the code it covers. Run `pnpm test`, the `node --test` command, and `/eval` before the PR leaves draft.

## Design Principles

- Follow the root `AGENTS.md`: add no explanatory comments to tracked code, keep one source of truth, and do the work inside the sandbox.
- Keep the adapter small. Add no retry loop, cache, or batch layer until a second consumer needs one.
- Treat the absent-TypeSafe path as the primary path. The probe guards that path.
- Keep a secret out of every log line, diagnostic, and report.
- Send only redacted text off the host, and only after an explicit operator flag.

Affected surfaces:

- **Host and sandbox:** applied. All edits and tests run in the sandbox. `agro secret set` runs on the host or in the sandbox.
- **Lifecycle door:** applied. `agro secret set` and `agro secret list` gain one key. No verb changes.
- **Canonical and provider surfaces:** applied. The skill edits land in `.agro/skills/prompt-miner/`. `.claude/skills` is a symlink to `../.agro/skills`, so no mirror edit is needed.
- **Root and scaffold:** applied. `.example.env` and `SECRET_KEYS` ship to initialized projects.
- **Interactive and headless processes:** not applicable. The task adds no persistent process.
- **Local and remote operation:** applied. The adapter needs outbound HTTPS to `api.typesafe.ai`. Without the key or the network, the fallback runs.
- **Parallel operation:** applied. The adapter holds no shared mutable state.
- **Public documentation:** open. See question 3.
- **Verification:** applied. See the test plan.

## Out of Scope

- Skill suggestion through `UserPromptSubmit`. This change needs `/architect` and an ADR.
- Model-assisted guard hooks. These cross a security boundary with adversarial input.
- `/wiki query` reranking. `references/query.md` forbids it.
- Tier-B behavioral evals.
- Other schema'd-envelope consumers: `simplicity-review.json`, `ui-evidence.json`, `delegate-graph.json`, the capability triad, and the `/retro` hypothesis table.
- New `.sh` scripts for the prose shell snippets in `audit skills`, `audit context`, `audit eval-quality`, and `wiki query`.
- A TypeSafe path in `crons/prompt-miner.md`.
- The TypeSafe npm SDK.

## Open Questions

1. The plan makes the prompt-miner consumer opt-in through `--correction-judge typesafe`. The issue says the judgment replaces the lexicon. Choose the default:
   - A. Opt-in flag; the lexicon stays the default (the plan as written).
   - B. Key presence enables TypeSafe; `--correction-judge lexicon` opts out.
2. Set the adapter request timeout: `<timeout-ms>`. The value must keep the probe and the tests under 30 seconds.
3. Does `mifunedev/agro-web` mirror the secret list in `docs/configuration.md`? If yes, add a matching change to that repository.
4. Choose one request per follow-up prompt or one batched request per session. The choice depends on the batch limits at `https://docs.typesafe.ai/api.md`: `<batch limit>`.
5. Before this task, the engine sent no transcript text off the host. Confirm that redacted follow-up prompt text may go to `api.typesafe.ai` under the flag.

## Acceptance Criteria

- [ ] Each story acceptance criterion above passes.
- [ ] `pnpm test` exits 0.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.
- [ ] `/eval` reports no REGRESSION, and `typesafe-absent-fallback` reports PASS.
- [ ] `grep -rn "TYPESAFE_API_KEY" .devcontainer/` prints no line.
- [ ] `.agro/scripts/typesafe.mjs` and `mine-traces.mjs` import no module outside `node:`.
- [ ] `CHANGELOG.md` `[Unreleased]` holds one `Added` entry that links issue #1121.
- [ ] The PR body records the API contract page date and the fault-injection evidence.

## Lessons

Filled by the advisor before undraft.
