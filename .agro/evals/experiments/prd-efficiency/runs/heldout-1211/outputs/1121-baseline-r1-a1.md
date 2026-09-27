# PRD: TypeSafe judgment adapter with a prompt-miner consumer

Status: BLOCKED

Source: issue #1121 (`work/issue-1121.md`).

## User Stories

### US-001: Allow `TYPESAFE_API_KEY` as a secret

**Description:** As an operator, I want `agro secret set TYPESAFE_API_KEY` to accept the key so that I can configure TypeSafe without a compose change.

**Acceptance Criteria:**

- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` contains `"TYPESAFE_API_KEY"`.
- [ ] `.agro/cli/src/lib/__tests__/secrets.test.ts` asserts the new `SECRET_KEYS` list, and `pnpm test` exits 0.
- [ ] `.example.env` holds a commented-out `# TYPESAFE_API_KEY=` entry with a section header and a description of the consumer.
- [ ] The `docs/configuration.md` § Secrets key list names `TYPESAFE_API_KEY`.
- [ ] The fallback list in `_secret_keys()` in `.agro/scripts/migrate-harness-yaml.sh` names `TYPESAFE_API_KEY`.
- [ ] No `.devcontainer/docker-compose*.yml` file contains `TYPESAFE_API_KEY`, and `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.

### US-002: Add the zero-dependency adapter

**Description:** As a control-plane script author, I want one Jev adapter at `.agro/scripts/typesafe.mjs` so that consumers share the key lookup, the HTTP call, and the diagnostic.

**Acceptance Criteria:**

- [ ] `.agro/scripts/typesafe.mjs` imports only `node:` built-in modules.
- [ ] The adapter sends `POST https://api.typesafe.ai/v1/systemone` with the model `jev-latest` and the request shape `<request body shape from docs.typesafe.ai/api.md>`.
- [ ] The adapter reads the key from `process.env.TYPESAFE_API_KEY` first, then from the `TYPESAFE_API_KEY=` line of the repository-root `.env`.
- [ ] If no key resolves, `preflight()` returns `{ ok: false }` and a diagnostic that names `TYPESAFE_API_KEY` and the fix `agro secret set TYPESAFE_API_KEY`.
- [ ] If the HTTP call returns a non-2xx status, times out after `<request timeout ms>`, or returns an invalid body, the adapter returns a failure result with a diagnostic. The adapter never throws to the caller.
- [ ] `node .agro/scripts/typesafe.mjs check` prints the preflight result and exits 0 in the configured state and in the unconfigured state.
- [ ] `.agro/scripts/__tests__/typesafe.test.ts` covers the cases in the Test Plan with a stubbed `fetch`, and `pnpm test` exits 0 with no network access.

### US-003: Judge `correctionDensity` with Jev

**Description:** As a `/prompt-miner` operator, I want Jev to classify each human follow-up as corrective or not so that `correctionDensity` stops counting casual clarifications as corrections.

**Acceptance Criteria:**

- [ ] If the adapter preflight passes, `mine-traces.mjs` counts a follow-up as corrective when Jev answers `true` to `<corrective-follow-up question text>`.
- [ ] The engine sends each follow-up through `redact()` before the adapter call.
- [ ] If the preflight fails, the engine writes the adapter diagnostic to stderr once, before it reads traces. The engine then uses `NEGATION_LEXICON`.
- [ ] If an adapter call fails during a run, the engine writes one diagnostic to stderr, then uses `NEGATION_LEXICON` for the remaining sessions of that run.
- [ ] A new flag `--judge typesafe|lexicon` exists. `--judge lexicon` makes no adapter call and writes no TypeSafe diagnostic.
- [ ] `manifest.correctionJudge` records `source` (`typesafe` or `lexicon`) and `reason`.
- [ ] If `--no-git` is set and `--judge` is not set, the engine uses `--judge lexicon`. The existing probes and `node --test` suites stay offline.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.
- [ ] `references/scoring.md`, `references/report-schema.md`, and `SKILL.md` describe the judge, the flag, the manifest field, and the fallback.

### US-004: Prove the absent-TypeSafe path with a probe

**Description:** As a maintainer, I want a tier-A probe that runs the engine without a key so that AGRO never depends on TypeSafe.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/typesafe-absent-fallback.sh` declares `# tier:`, `# source:`, and `# desc:` headers.
- [ ] The probe copies `.agro/scripts/typesafe.mjs` and `.agro/skills/prompt-miner/scripts/` into a disposable tree with no `.env`, and unsets `TYPESAFE_API_KEY`.
- [ ] The probe runs the engine with `--dry-run --no-git --judge typesafe` against the committed fixtures. The probe asserts exit 0, a stderr line that names `TYPESAFE_API_KEY`, and `manifest.correctionJudge.source == "lexicon"`.
- [ ] The probe asserts that `sessions[]` from the unconfigured run equals `sessions[]` from a `--dry-run --no-git --judge lexicon` run.
- [ ] The probe exits 1 when the fault injection removes the stderr diagnostic, and exits 1 when the fault injection makes the engine exit non-zero.
- [ ] `bash .agro/evals/probes/typesafe-absent-fallback.sh` exits 0 in less than 30 seconds.

## Summary

Issue #1121 asks the control plane to consume typed judgments from TypeSafe System One. The first consumer is `prompt-miner`'s `correctionDensity`.

Verified current state:

- `aggregateSession()` in `.agro/skills/prompt-miner/scripts/mine-traces.mjs` computes `correctionDensity` with `matchesLexicon()` over the 12-term `NEGATION_LEXICON`.
- `references/scoring.md` flags `correctionDensity` as the highest-variance signal.
- `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` is the allow-list for the root `.env`. The list holds 8 keys today.
- The compose `environment:` block carries `GH_TOKEN` and `SANDBOX_PASSWORD` only. `compose-env-boundary.sh` rejects any other unrendered key.
- The sandbox mounts the repository at `/home/sandbox/harness`, so a sandbox process can read the repository-root `.env`.
- `.agro/scripts/closing-keywords.mjs` sets the pattern for a plain `.mjs` module with a vitest test under `.agro/scripts/__tests__/`.
- The `prompt-miner` probes run the engine with `--dry-run --no-git` against committed fixtures.

Selected approach:

1. Add the key to the secret allow-list and its mirrors.
2. Add one adapter module over the HTTP API. Do not add the npm SDK.
3. Make the engine call the adapter for follow-up classification when the preflight passes.
4. Keep the lexicon as the deterministic fallback.
5. Add one probe that proves the fallback.

The contract is "fail loudly, then continue". The engine prints a specific diagnostic, exits 0, and uses the lexicon.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Allow-list that `agro secret set` enforces. |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `SECRET_KEYS` list assertion | Pins the allow-list. |
| `.example.env` | new `TYPESAFE_API_KEY` section | Operator documentation for the secret. |
| `.agro/scripts/migrate-harness-yaml.sh` | `_secret_keys()` fallback list | Mirror of the allow-list for the migration path. |
| `docs/configuration.md` | § Secrets | User-facing list of allowed keys. |
| `.agro/scripts/typesafe.mjs` | new: `resolveKey()`, `preflight()`, `ask()`, `check` CLI mode | The adapter. |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `aggregateSession()`, `parseArgs()`, `run()`, `NEGATION_LEXICON`, `redact()` | The first consumer. |
| `.agro/skills/prompt-miner/references/scoring.md` | § Sub-signal definitions, § Negation lexicon | Scoring documentation. |
| `.agro/skills/prompt-miner/references/report-schema.md` | § `manifest` | Adds `correctionJudge`. |
| `.agro/skills/prompt-miner/SKILL.md` | § Step 1 flag surface | Documents `--judge`. |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | new probe | Guards the absent-TypeSafe behavior. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret set TYPESAFE_API_KEY` | new accepted key | The CLI accepts one more secret. |
| `node .agro/scripts/typesafe.mjs check` | new command | Prints the preflight result. Exits 0. |
| `mine-traces.mjs --judge typesafe\|lexicon` | new flag | Selects the `correctionDensity` judge. The default is `<default judge: typesafe when configured, or lexicon>`. |
| `manifest.correctionJudge` | new report field | Records the judge source and the reason. |
| stderr of `mine-traces.mjs` | new diagnostic line | Names the missing key or the failed call, and the fix. |

## Storage

N/A. The adapter holds no state. The key lives in the existing gitignored root `.env`. Reports stay in `$TMPDIR` as today.

## Architectural Decisions

- **Source of truth for the key:** `SECRET_KEYS` owns the allow-list. The adapter reads `process.env` first, then the root `.env`. This order matches the precedence rule in `.example.env`.
- **No compose wiring:** `TYPESAFE_API_KEY` stays out of every `environment:` block. `compose-env-boundary.sh` keeps that rule.
- **HTTP, not SDK:** The adapter uses the built-in `fetch`. This keeps `.agro/cli` free of runtime dependencies and avoids the `pnpm audit --audit-level low` pre-install gate.
- **One adapter, many consumers:** Consumers call `preflight()` and `ask()`. Consumers do not read the key or build requests.
- **Failure scope:** The first failed call in a run disables the judge for the rest of that run. One diagnostic replaces a repeated timeout per session.
- **Privacy:** The engine sends only redacted follow-up text. The engine never sends the first prompt, assistant text, or tool output.
- **Determinism:** `--no-git` implies `--judge lexicon` unless `--judge` is explicit. Tests and probes stay offline and deterministic.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `SECRET_KEYS` equals the 9-key list | US-001 allow-list. |
| `.agro/scripts/__tests__/typesafe.test.ts` | Key lookup: env, `.env`, env beats `.env`. No key: diagnostic. Non-2xx, timeout, invalid body: failure result. Imports: `node:` only. | US-002 adapter contract. |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | Stub judge overrides a lexicon miss and a lexicon hit. `--judge lexicon` makes zero calls. A failed call switches to the lexicon. `redact()` runs first. | US-003 consumer behavior. |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | unconfigured `--judge typesafe` run exits 0, prints diagnostic, matches `--judge lexicon` output | US-004 fallback guarantee. |
| `.agro/evals/probes/compose-env-boundary.sh` | existing probe stays green | No compose wiring. |
| `.agro/evals/probes/prompt-miner-*.sh` | existing probes stay green | No regression in the engine. |

## Design Principles

- Code is the source of truth. Add no explanatory comments to tracked code.
- Fail loudly, then continue. Never fall back silently. Never crash.
- Keep one adapter. Delete no deterministic fallback.
- Keep `.agro/` portable: zero runtime dependencies, `node:` built-ins only.
- Send the minimum text off the host, after redaction.

Affected surfaces:

- **Host and sandbox:** applied. `agro secret set` runs on the host. The engine and the adapter run in the sandbox.
- **Lifecycle door:** applied. `agro secret set` accepts one more key. No other verb changes.
- **Canonical and provider surfaces:** applied. Edit `.agro/skills/prompt-miner/` only. The provider symlinks stay unchanged.
- **Root and scaffold:** applied. `<scaffold impact: confirm that initialized projects receive .agro/scripts/typesafe.mjs>`.
- **Interactive and headless processes:** applied. The daily `crons/prompt-miner.md` cron runs headless and reads the key from `.env`.
- **Local and remote operation:** applied. The adapter needs outbound HTTPS only.
- **Parallel operation:** not applicable. The adapter holds no shared mutable state.
- **Public documentation:** applied. See the open question on `mifunedev/agro-web`.
- **Verification:** applied. See the Test Plan.

## Out of Scope

- Skill suggestion through `UserPromptSubmit`. This needs `/architect` and an ADR.
- Model-assisted guard hooks. These cross a security boundary with adversarial input.
- `/wiki query` reranking. `references/query.md` forbids it.
- Tier-B behavioral evals.
- The other schema'd consumers: `simplicity-review.json`, `ui-evidence.json`, `delegate-graph.json`, the capability triad, and the `/retro` hypothesis table.
- `.sh` extraction for the prose shell snippets in `audit skills`, `audit context`, `audit eval-quality`, and `wiki query`.
- Changes to the vendored `.agro/skills/typesafe-ai/SKILL.md`.

## Open Questions

1. **Privacy default (blocks US-003).** The privacy contract in `prompt-miner/SKILL.md` keeps prompt text on the host. The judge sends redacted follow-ups to `api.typesafe.ai`. Choose one option:
   - A. The judge runs by default when the key resolves.
   - B. The judge runs only with `--judge typesafe`. An unconfigured run with that flag prints the diagnostic.
2. **API contract (blocks US-002).** Confirm `<request body shape from docs.typesafe.ai/api.md>`, the auth header, and the response field that holds the typed answer.
3. **Question text (blocks US-003).** Confirm `<corrective-follow-up question text>`. Confirm whether the engine uses the typed boolean or a probability threshold `<threshold>`.
4. **Timeout.** Confirm `<request timeout ms>` for one adapter call.
5. **Cost and rate limits.** A 14-day cron window can hold many follow-ups. Confirm whether the engine needs batching or a per-run call cap `<cap>`.
6. **Skill preflight host.** Issue #1121 asks for "a skill preflight". The plan puts the preflight in the adapter. The engine runs the preflight at start. Confirm the location, or name the skill to run `node .agro/scripts/typesafe.mjs check`.
7. **Scaffold.** Confirm that initialized projects receive `.agro/scripts/typesafe.mjs`.
8. **Public documentation.** Confirm whether `mifunedev/agro-web` needs the new secret and the `--judge` flag.
9. **Calibration.** `scoring.md` asks for a hand-labeled sample before an operator trusts the signal. Confirm whether this task includes that calibration, or a follow-up task owns it.

## Acceptance Criteria

- [ ] `pnpm test` exits 0.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.
- [ ] `bash .agro/evals/probes/typesafe-absent-fallback.sh` exits 0.
- [ ] `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.
- [ ] Each `bash .agro/evals/probes/prompt-miner-*.sh` probe exits 0.
- [ ] `grep -rn TYPESAFE_API_KEY .devcontainer/` prints no line.
- [ ] `.agro/scripts/typesafe.mjs` contains no `import` of a non-`node:` module.
- [ ] With no key, `node .agro/skills/prompt-miner/scripts/mine-traces.mjs --dry-run --no-git` exits 0.

## Lessons

Filled by the advisor before undraft.
