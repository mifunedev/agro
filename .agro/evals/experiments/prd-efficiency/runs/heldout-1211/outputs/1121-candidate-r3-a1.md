# PRD: TypeSafe judgment adapter with a prompt-miner consumer

Status: BLOCKED

Source: `work/issue-1121.md`.

## User Stories

### US-001: Add the zero-dependency TypeSafe adapter

**Description:** As a control-plane script author, I want one adapter at `.agro/scripts/typesafe.mjs` so that a script can request a typed Jev judgment without an npm dependency.

**Acceptance Criteria:**

- [ ] `.agro/scripts/typesafe.mjs` imports only `node:` built-in modules and global `fetch`.
- [ ] The adapter sends `POST https://api.typesafe.ai/v1/systemone` with model `jev-latest`, in the request shape of `https://docs.typesafe.ai/api.md`.
- [ ] The adapter reads `TYPESAFE_API_KEY` from `process.env` first, then from the root `.env` file.
- [ ] If the key is absent, the adapter returns an `unconfigured` result that names `TYPESAFE_API_KEY` and the fix `agro secret set TYPESAFE_API_KEY`. The adapter sends no request.
- [ ] If the API returns HTTP 401, a non-2xx status, a timeout, or a malformed body, the adapter returns a `failed` result that names the cause. The adapter throws no error.
- [ ] `node .agro/scripts/typesafe.mjs --check` prints one diagnostic line and exits 0 in both the configured state and the unconfigured state.
- [ ] `.agro/scripts/__tests__/typesafe.test.ts` passes under `pnpm test` with a stubbed `fetch`. The tests make no network call.
- [ ] `.agro/scripts/README.md` lists `typesafe.mjs` in the script table.

### US-002: Register TYPESAFE_API_KEY as a secret

**Description:** As an operator, I want `TYPESAFE_API_KEY` in the secret allow-list so that `agro secret set TYPESAFE_API_KEY` stores the key in the root `.env` file.

**Acceptance Criteria:**

- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` contains `TYPESAFE_API_KEY`.
- [ ] The allow-list test in `.agro/cli/src/lib/__tests__/secrets.test.ts` lists `TYPESAFE_API_KEY` and passes.
- [ ] `.example.env` documents `TYPESAFE_API_KEY` in a commented-out block with its consumer and the fallback behavior.
- [ ] The `## Secrets` list in `docs/configuration.md` names `TYPESAFE_API_KEY`.
- [ ] No `.devcontainer/docker-compose*.yml` file contains `TYPESAFE_API_KEY`.
- [ ] `bash .agro/evals/probes/compose-env-boundary.sh`, `bash .agro/evals/probes/oh-config-surfaces.sh`, and `bash .agro/evals/probes/config-schema-parity.sh` each exit 0.
- [ ] `pnpm test` exits 0, including `.agro/cli/src/lib/__tests__/config-render.test.ts`.

### US-003: Judge correctionDensity with TypeSafe in prompt-miner

**Description:** As a prompt-miner operator, I want each human follow-up judged by Jev so that `correctionDensity` stops counting casual clarifications as corrections.

**Acceptance Criteria:**

- [ ] If the adapter returns a judgment, `mine-traces.mjs` counts a follow-up as corrective when Jev judges the follow-up a correction of the prior agent turn.
- [ ] If the adapter returns `unconfigured` or `failed`, `mine-traces.mjs` writes one stderr diagnostic that names the cause and the fix. The engine then scores with `NEGATION_LEXICON` and exits 0.
- [ ] The report `manifest` records the judgment source for `correctionDensity` as `typesafe` or `lexicon`.
- [ ] A new case in `mine-traces.test.mjs` feeds the follow-up "actually, also add a README" with a stubbed judgment of "not a correction". The case asserts `correctiveFollowups` equals 0. The same input under the lexicon gives 1.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.
- [ ] `references/scoring.md`, `references/report-schema.md`, and `SKILL.md` in `.agro/skills/prompt-miner/` describe the judgment source and the lexicon fallback.
- [ ] Step 1 of `.agro/skills/prompt-miner/SKILL.md` runs `node .agro/scripts/typesafe.mjs --check` before the engine runs.

### US-004: Probe the absent-TypeSafe contract

**Description:** As a harness maintainer, I want a probe that runs AGRO without TypeSafe so that the unconfigured path stays loud and non-fatal.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/typesafe-absent-fallback.sh` declares `# tier:`, `# source:`, and `# desc:` headers.
- [ ] The probe unsets `TYPESAFE_API_KEY` and points the adapter at an empty dotenv path.
- [ ] The probe runs `mine-traces.mjs --dry-run --no-git` against the committed fixtures.
- [ ] The probe asserts exit 0, a stderr diagnostic that names `TYPESAFE_API_KEY`, and `correctionDensity` values equal to the lexicon values.
- [ ] The probe returns 1 when the diagnostic is absent. The owner proves this with one fault-injection run on a disposable copy.
- [ ] The probe returns 1 when the engine exits non-zero. The owner proves this with one fault-injection run on a disposable copy.
- [ ] The probe completes in less than 30 seconds and makes no network call.

## Summary

The issue names two shapes. The first shape is a schema'd envelope with a prose-produced value. The second shape is prose-specified determinism. This task addresses one slot of the first shape.

Verified current state:

- `mine-traces.mjs` defines `NEGATION_LEXICON` with 12 terms at lines 22-35.
- `aggregateSession` computes `correctionDensity` from `matchesLexicon` at lines 309-310. The function is synchronous.
- `run` and `main` in `mine-traces.mjs` are `async`. The engine imports only `node:` modules.
- `references/scoring.md` line 40 flags `correctionDensity` as the highest-variance signal.
- `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` holds 8 keys. The secrets test pins the exact list.
- `compose-env-boundary.sh` rejects a compose `environment:` key outside the rendered set and the documented literals.
- `.example.env` documents each secret in a commented-out block.

Selected approach:

1. Add a zero-dependency HTTP adapter at `.agro/scripts/typesafe.mjs`.
2. Add `TYPESAFE_API_KEY` to the secret allow-list only.
3. Precompute one judgment per follow-up in `run`, before `aggregateSession` scores the session.
4. Pass the judgments into `aggregateSession`. Keep `NEGATION_LEXICON` as the deterministic fallback.
5. Guard the unconfigured path with a Tier A probe.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/typesafe.mjs` | new: `judge`, `check`, CLI `--check` | Adapter over the HTTP API. Returns `ok`, `unconfigured`, or `failed`. |
| `.agro/scripts/README.md` | script table | Lists the new script. |
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Allow-list that `agro secret set` enforces. |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `allow-list` test | Pins the exact key list. |
| `.example.env` | new commented block | Operator documentation for the key. |
| `docs/configuration.md` | `## Secrets` list | Public list of allow-listed keys. |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `NEGATION_LEXICON`, `matchesLexicon`, `aggregateSession`, `run`, `main` | Consumer. Lines 309-310 compute `correctionDensity`. |
| `.agro/skills/prompt-miner/references/scoring.md` | `correctionDensity` row, `### Negation lexicon` | Signal definition. |
| `.agro/skills/prompt-miner/references/report-schema.md` | `## manifest` | Report fields. |
| `.agro/skills/prompt-miner/SKILL.md` | step list | Adds the preflight line. |
| `.agro/evals/probes/compose-env-boundary.sh` | `LITERALS`, rendered set | Existing guard: the key stays out of compose. |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | new probe | Guards the unconfigured contract. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret set TYPESAFE_API_KEY` | Extended | The command accepts one new key. |
| `node .agro/scripts/typesafe.mjs --check` | New | Prints the configuration state. Exits 0. |
| `mine-traces.mjs` stderr | Extended | Prints one diagnostic line when the adapter returns `unconfigured` or `failed`. |
| prompt-miner report `manifest` | Extended | Adds the `correctionDensity` judgment source field. The field name is `<manifest field name>`. |
| Outbound HTTPS | New | Sends human follow-up text to `api.typesafe.ai` when the key is present. |

## Storage

The root `.env` file stores `TYPESAFE_API_KEY` at mode 0600. `setSecret` in `.agro/cli/src/lib/secrets.ts` writes the file. This task adds no other persistence. The adapter keeps no cache.

## Architectural Decisions

- The adapter calls the HTTP API directly. The npm SDK stays out. This choice keeps `.agro/cli` free of runtime dependencies and keeps skill scripts portable. The choice also avoids the `pnpm audit --audit-level low` pre-install gate.
- `TYPESAFE_API_KEY` stays out of every compose `environment:` block. The adapter reads the key from `process.env`, then from the root `.env` file.
- The adapter owns the diagnostic text. Each consumer prints the adapter diagnostic and chooses its own deterministic fallback.
- The contract for an unconfigured or failed state is: print one diagnostic, exit 0, use the deterministic fallback. The adapter never falls back without a diagnostic. The adapter never crashes the consumer.
- `aggregateSession` stays synchronous. `run` resolves the judgments first and passes them in. The existing unit tests keep calling `aggregateSession` without a network stub.
- `NEGATION_LEXICON` stays as the fallback. The probe pins the fallback output to the current lexicon output.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/typesafe.test.ts` | key absent; key in `process.env`; key in dotenv only; HTTP 401; HTTP 500; timeout; malformed body; valid judgment | US-001 result states and diagnostics. |
| `.agro/scripts/__tests__/typesafe.test.ts` | source scan for non-`node:` imports | US-001 zero-dependency rule. |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `allow-list` | US-002 key registration. |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | existing secret exclusion cases | US-002: the key never renders into the compose file. |
| `.agro/evals/probes/compose-env-boundary.sh` | existing | US-002 compose boundary. |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | stubbed judgment overrides the lexicon; unconfigured falls back to the lexicon; manifest source field | US-003 consumer behavior. |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | unset key, fixture run, exit 0, diagnostic, lexicon parity | US-004 absent contract. |
| `.agro/evals/probes/prompt-miner-schema-compat.sh` | existing | Regression floor for the engine. |

Commands: `pnpm test`, `pnpm typecheck`, `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs`, and `bash .agro/evals/probes/<probe>.sh`.

## Design Principles

- Code is the source of truth. Add no explanatory comments to tracked code.
- Keep one adapter. Future consumers import the same module.
- Fail loudly, then continue. The operator sees the cause and the fix before the fallback runs.
- Keep deterministic tests offline. Stub `fetch` in every unit test.
- Keep the change in the canonical `.agro/` sources. Patch no provider mirror.

## Out of Scope

- Skill suggestion through `UserPromptSubmit`. That change needs `/architect` and an ADR.
- Model-assisted guard hooks. Those hooks sit on a security boundary with adversarial input.
- `/wiki query` reranking. `references/query.md` forbids the change.
- Tier-B behavioral evals.
- Consumers other than `correctionDensity`, such as `simplicity-review.json`, `ui-evidence.json`, `delegate-graph.json`, the capability triad, and the `/retro` hypothesis table.
- Scripts for the prose-specified snippets in `audit skills`, `audit context`, `audit eval-quality`, and `wiki query`.
- Compose `environment:` wiring for `TYPESAFE_API_KEY`.
- Public documentation in `mifunedev/agro-web`, unless Open Question 4 selects the change.

## Open Questions

1. Privacy: the miner sends human follow-up text to `api.typesafe.ai`. The miner already warns about secrets under `--include-prompt-text`. Choose one option.
   - A. Send the text by default when the key is present, after the existing redaction.
   - B. Send the text only with a new opt-in flag `<flag name>`.
   - C. Other: <specify>.
2. Request shape: the plan does not record the exact body, the question wording, the answer type, or the confidence threshold for Jev. The owner reads `https://docs.typesafe.ai/api.md` and records `<question text>` and `<confidence threshold>` before US-003.
3. Limits: the plan does not record a request timeout, a batch size, or a per-run request cap. Supply `<timeout ms>` and `<max requests per run>`.
4. Documentation: does `mifunedev/agro-web` need a matching page for the new secret?
   - A. Yes, in this task.
   - B. No, in a follow-up issue.
5. Calibration: `references/scoring.md` asks for a hand-labeled sample before the signal gains trust. Does acceptance require a comparison of Jev and the lexicon on `<labeled sample path>`?
   - A. Yes, before merge.
   - B. No, in a follow-up task.

## Acceptance Criteria

- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.
- [ ] `bash .agro/evals/probes/typesafe-absent-fallback.sh` exits 0 with `TYPESAFE_API_KEY` unset.
- [ ] `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.
- [ ] `bash .agro/evals/probes/prompt-miner-schema-compat.sh` exits 0.
- [ ] `git grep -n TYPESAFE_API_KEY -- .devcontainer` prints no line.
- [ ] `grep -nE "from ['\"][^n]" .agro/scripts/typesafe.mjs` prints no line.
- [ ] With `TYPESAFE_API_KEY` unset, each prompt-miner score equals the score from the base commit on the committed fixtures.
- [ ] Each open question has a recorded operator answer.

## Lessons

Filled by the advisor before undraft.
