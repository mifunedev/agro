# PRD: TypeSafe judgment adapter for the control plane

Status: BLOCKED

Source: `work/issue-1121.md` (issue #1121).

## User Stories

### US-001: Register `TYPESAFE_API_KEY` as a secret

**Description:** As an operator, I want `agro secret set TYPESAFE_API_KEY` to store the TypeSafe key in `.env` so that the key never reaches `agro.json` or the compose `environment:` block.

**Acceptance Criteria:**

- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` contains `"TYPESAFE_API_KEY"`.
- [ ] The allow-list test in `.agro/cli/src/lib/__tests__/secrets.test.ts` lists `"TYPESAFE_API_KEY"` and passes.
- [ ] `.example.env` holds one commented `# TYPESAFE_API_KEY=` line under a TypeSafe section header.
- [ ] The secret list in `docs/configuration.md` near line 171 names `TYPESAFE_API_KEY`.
- [ ] No `.devcontainer/docker-compose*.yml` file contains the string `TYPESAFE_API_KEY`.
- [ ] `bash .agro/evals/probes/config-schema-parity.sh` exits 0.
- [ ] `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.
- [ ] `bash .agro/evals/probes/oh-config-surfaces.sh` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.

### US-002: Add the zero-dependency TypeSafe adapter

**Description:** As a control-plane script author, I want one `node:`-only adapter at `.agro/scripts/typesafe.mjs` for `POST https://api.typesafe.ai/v1/systemone` so that a script gets typed judgments without npm.

**Acceptance Criteria:**

- [ ] `.agro/scripts/typesafe.mjs` imports only `node:` built-in modules. `grep -E "from ['\"][^n.]" .agro/scripts/typesafe.mjs` prints nothing.
- [ ] No `package.json` file in the repository gains a dependency for this task.
- [ ] The module exports a judgment function that accepts an injected `fetch` and an injected environment object.
- [ ] If `TYPESAFE_API_KEY` is absent or empty, the judgment function makes no network call. The function returns a result with `configured: false`.
- [ ] If `TYPESAFE_API_KEY` is absent or empty, the adapter writes one stderr diagnostic. The diagnostic names `TYPESAFE_API_KEY` and the fix command `agro secret set TYPESAFE_API_KEY`.
- [ ] If the API returns a non-2xx status, the adapter writes a diagnostic with the HTTP status and returns a fallback result. The adapter throws no error.
- [ ] If the request exceeds `<timeout-ms>`, the adapter aborts the request, writes a diagnostic, and returns a fallback result.
- [ ] If the response body does not match `<response schema>`, the adapter writes a diagnostic and returns a fallback result.
- [ ] The adapter writes the diagnostic once per process, not once per call.
- [ ] No diagnostic and no thrown error contains the value of `TYPESAFE_API_KEY`.
- [ ] If the key is absent, `node .agro/scripts/typesafe.mjs --check` exits 0 and prints the diagnostic on stderr.
- [ ] If the key is present, `node .agro/scripts/typesafe.mjs --check` exits 0 and prints `<configured message>` on stdout.
- [ ] `.agro/scripts/__tests__/typesafe.test.ts` covers each case above with a stub `fetch` and makes no real network call.
- [ ] `.agro/scripts/README.md` lists `typesafe.mjs` in its script table.
- [ ] `pnpm test` exits 0.

### US-003: Score `correctionDensity` with a TypeSafe judgment

**Description:** As a prompt-miner operator, I want TypeSafe to judge each follow-up prompt so that `correctionDensity` ignores casual clarifications.

**Acceptance Criteria:**

- [ ] If the adapter reports `configured: true`, `mine-traces.mjs` computes `correctionDensity` from the adapter judgment for each follow-up prompt.
- [ ] If the adapter reports `configured: false` or returns a fallback result, `mine-traces.mjs` computes `correctionDensity` from `NEGATION_LEXICON`, byte for byte as today.
- [ ] The dataset `manifest` carries a `correctionSource` field with the value `typesafe`, `lexicon`, or `mixed`.
- [ ] The Markdown report prints the `correctionSource` value.
- [ ] `references/report-schema.md` documents `correctionSource`.
- [ ] `references/scoring.md` describes the TypeSafe path and the lexicon fallback for `correctionDensity`.
- [ ] `--dry-run --no-git` output against the committed fixtures, with `TYPESAFE_API_KEY` unset, matches the current output except the new `correctionSource` field and any timestamp field.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.
- [ ] The test file covers three paths with a stub adapter: TypeSafe verdicts, unconfigured fallback, and API-error fallback.
- [ ] No test makes a real network call.

### US-004: Add the skill preflight

**Description:** As a prompt-miner operator, I want an early report of a missing TypeSafe key so that I see the fix, not a 401.

**Acceptance Criteria:**

- [ ] `.agro/skills/prompt-miner/SKILL.md` holds a preflight step ahead of "Step 1 — Run the engine".
- [ ] The preflight step runs `node .agro/scripts/typesafe.mjs --check` and states that an absent key keeps the run on the lexicon path.
- [ ] The preflight step never stops the run and never asks the operator for the key.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/prompt-miner/SKILL.md` reports no new finding in the added lines.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.

### US-005: Guarantee the absent-TypeSafe behavior with a probe

**Description:** As a harness maintainer, I want a probe for the absent-TypeSafe path so that TypeSafe never becomes a hidden requirement.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/typesafe-absent-fallback.sh` exists with `# tier:`, `# source:`, and `# desc:` headers.
- [ ] The probe unsets `TYPESAFE_API_KEY` and runs `node .agro/scripts/typesafe.mjs --check`. The probe asserts exit 0 and the diagnostic text.
- [ ] The probe unsets `TYPESAFE_API_KEY` and runs `mine-traces.mjs --dry-run --no-git` against the committed fixtures. The probe asserts exit 0 and `correctionSource` equal to `lexicon`.
- [ ] The probe asserts that no `.devcontainer/docker-compose*.yml` file names `TYPESAFE_API_KEY`.
- [ ] If `node` or a required file is absent, the probe exits 2 with a stderr reason.
- [ ] The probe completes in less than 30 seconds.
- [ ] A fault-injection run against a disposable copy that makes the adapter throw on a missing key turns the probe to exit 1.
- [ ] The eval skill run reports the probe as PASS in `.agro/evals/RESULTS.md`.

## Summary

Verified current state:

- `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts:9` holds 8 keys. `secrets.test.ts:30` pins the exact list.
- `.example.env` holds commented secret lines only. `config-schema-parity.sh` requires each `.example.env` key to be an allow-listed secret.
- `compose-env-boundary.sh` rejects any compose `environment:` key that is not rendered or listed as a literal. A new `TYPESAFE_API_KEY` compose entry fails that probe today.
- `.devcontainer/docker-compose.yml:16` passes `GH_TOKEN` and 8 other keys. The block holds no other API key.
- `mine-traces.mjs:22` defines the 12-term `NEGATION_LEXICON`. `aggregateSession` at line 267 is synchronous and applies the lexicon at line 309.
- `references/scoring.md:40` flags `correctionDensity` as the highest-variance signal.
- The prompt-miner tests use `node:test`. `vitest.config.ts` does not include `.agro/skills/**`, so `pnpm test` does not run them.
- `.agro/scripts/__tests__/` holds vitest `.test.ts` files that `pnpm test` runs.
- `.agro/skills/typesafe-ai/SKILL.md` exists and points to the live HTTP API docs.
- No file under `.agro/` or `docs/` references `TYPESAFE_API_KEY` today.

Selected approach:

1. Register the key through the existing secret allow-list only.
2. Add one adapter module in `.agro/scripts/` with a `--check` entry point and an injectable `fetch`.
3. Classify follow-up prompts in the async `run` path of `mine-traces.mjs`, before the synchronous aggregation. Pass the verdicts into `aggregateSession`.
4. Keep `NEGATION_LEXICON` as the deterministic fallback.
5. Add one preflight step and one probe.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Secret allow-list; add `TYPESAFE_API_KEY`. |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `allow-list` suite | Pins the exact key list. |
| `.example.env` | TypeSafe section | Documents the commented key. |
| `docs/configuration.md` | secret list near line 171 | Operator reference for secrets. |
| `.agro/scripts/typesafe.mjs` | judgment function, `--check` | New adapter over the HTTP API. |
| `.agro/scripts/__tests__/typesafe.test.ts` | adapter cases | New vitest coverage with a stub `fetch`. |
| `.agro/scripts/README.md` | script table | Index entry for the adapter. |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `NEGATION_LEXICON`, `aggregateSession`, `run`, report writer | Consumer of the judgment. |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | new cases | Coverage for the three `correctionDensity` paths. |
| `.agro/skills/prompt-miner/references/scoring.md` | "Negation lexicon" section | Scoring model text. |
| `.agro/skills/prompt-miner/references/report-schema.md` | `manifest` | Dataset schema text. |
| `.agro/skills/prompt-miner/SKILL.md` | new preflight step | Up-front diagnostic. |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | new probe | Absent-TypeSafe guarantee. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret set TYPESAFE_API_KEY` | Extended | The command accepts one more allow-listed key. |
| `agro secret list` | Extended | The command lists `TYPESAFE_API_KEY` when `.env` sets the key. |
| `node .agro/scripts/typesafe.mjs --check` | New | Preflight command. Exit 0 in both states. |
| `POST https://api.typesafe.ai/v1/systemone` | New outbound call | Request shape `<request schema>`. Response shape `<response schema>`. Model `jev-latest`. |
| prompt-miner dataset `manifest.correctionSource` | New field | Records the source of `correctionDensity`. |
| `mifunedev/agro-web` | `<decision>` | See open question 6. |

## Storage

The key persists in the gitignored repository-root `.env` at mode `0600`. The existing `setSecret` path in `secrets.ts` writes the key. The adapter stores no state and writes no file. The prompt-miner dataset keeps its current `$TMPDIR` location.

## Architectural Decisions

- **Source of truth for secrets:** `SECRET_KEYS` stays the single allow-list. The compose `environment:` block does not carry the key. `compose-env-boundary.sh` already enforces that boundary.
- **Key resolution:** The adapter reads `TYPESAFE_API_KEY` from `process.env`. The fallback read of the repository-root `.env` is open question 1.
- **Dependency policy:** The adapter uses `node:` built-ins and the global `fetch` of Node 20. The adapter adds no npm package. This keeps `.agro/cli` free of runtime dependencies and skips the `pnpm audit --audit-level low` gate.
- **Contract:** An unconfigured adapter writes a named diagnostic, exits 0 at `--check`, and returns a fallback result. The adapter never falls back silently and never crashes the caller.
- **Determinism:** Tests and probes run with no key and a stub `fetch`. The lexicon path stays the reproducible baseline.
- **Batching:** The consumer sends follow-up prompts through the adapter from the async `run` path. `aggregateSession` stays synchronous and receives precomputed verdicts.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | allow-list equals the 9 keys | US-001 key registration. |
| `.agro/scripts/__tests__/typesafe.test.ts` | missing key; empty key; 2xx valid body; non-2xx; timeout; malformed body; one diagnostic per process; key absent from diagnostics; `--check` in both states | US-002 contract. |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | stub verdicts change `correctionDensity`; unconfigured equals lexicon result; API error equals lexicon result; `correctionSource` values | US-003 consumer. |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | absent key on adapter and engine; compose free of the key | US-005 guarantee. |
| `.agro/evals/probes/config-schema-parity.sh`, `compose-env-boundary.sh`, `oh-config-surfaces.sh`, `prompt-miner-schema-compat.sh` | existing assertions | No regression in the secret split and the engine. |

Write each new test before its implementation. Confirm each test fails first.

## Design Principles

- Follow the repository principles: code is the source of truth, one owner per policy, no comments in tracked code, and the smallest truthful change.
- Fill the value slot only. Keep the existing schema, validator, and neutral default.
- Fail loudly, then continue. Name the cause and the fix in each diagnostic.
- Keep TypeSafe optional. A sandbox without the key behaves as today.
- Never log, print, or persist the key value.
- Execution location: the adapter, the engine, the tests, and the probe run inside the sandbox. `agro secret set` runs on the host or in the sandbox.

## Out of Scope

- Skill suggestion through `UserPromptSubmit`. That change needs `/architect` and an ADR.
- Model-assisted guard hooks. Those hooks cross a security boundary with adversarial input.
- `/wiki query` reranking. `references/query.md` forbids that change.
- Tier-B behavioral evals.
- Other consumers: `simplicity-review.json`, `ui-evidence.json`, `delegate-graph.json`, the capability triad, and the `/retro` hypothesis table.
- Conversion of the prose shell snippets in `audit skills`, `audit context`, `audit eval-quality`, and `wiki query` into `.sh` files.
- The npm TypeSafe SDK.
- Removal of `NEGATION_LEXICON`.

## Open Questions

1. **Key resolution in unattended runs.** The key does not enter the compose environment. A cron fire or a new Herdr pane does not source `.env`.
   - A. The adapter reads `process.env`, then the repository-root `.env` (recommended).
   - B. The adapter reads `process.env` only. The operator sources `.env` before each run.
2. **Privacy egress.** The prompt-miner privacy contract keeps raw prompt text out of all output. The TypeSafe path sends follow-up prompt text to an external API.
   - A. Send prompt text only when the operator passes a new flag `<flag name>`. Default to the lexicon (recommended).
   - B. Send prompt text whenever the key is set. Add a `WARNING` banner, as `--include-prompt-text` does.
   - C. Run the `redact` pass before each call, and also apply option A or option B.
3. **API contract.** Confirm `<request schema>`, `<response schema>`, the question wording for "corrective follow-up", and `<confidence threshold>` from the live HTTP API docs.
4. **Timeout and volume limits.** Set `<timeout-ms>` and `<max prompts per run>` for the prompt-miner corpus.
5. **Skill portability.** `mine-traces.mjs` must import `.agro/scripts/typesafe.mjs` across the skill boundary. Choose one:
   - A. Import by relative path. Treat a missing adapter as `configured: false` (recommended).
   - B. Copy a minimal client into `.agro/skills/prompt-miner/scripts/`.
6. **Public documentation.** Confirm whether `mifunedev/agro-web` needs a TypeSafe secret entry.
7. **Preflight location.** Confirm that the preflight belongs in `prompt-miner/SKILL.md` only, not also in `typesafe-ai/SKILL.md`.
8. **Test wiring.** `pnpm test` does not run `mine-traces.test.mjs`. Confirm whether CI must run `mine-traces.test.mjs`.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.
- [ ] The eval skill run reports no REGRESSION in `.agro/evals/RESULTS.md`.
- [ ] With `TYPESAFE_API_KEY` unset, every existing probe keeps its prior state.
- [ ] No `package.json` file gains a dependency.
- [ ] `git grep TYPESAFE_API_KEY -- .devcontainer` prints nothing.
- [ ] `CHANGELOG.md` holds one entry for issue #1121.

## Lessons

Filled by the advisor before undraft.
