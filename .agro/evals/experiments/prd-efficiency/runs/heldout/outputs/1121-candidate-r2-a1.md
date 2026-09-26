# PRD: TypeSafe judgment adapter with correctionDensity consumer

Status: DRAFT

## User Stories

### US-001: Zero-dependency TypeSafe adapter and secret wiring

**Description:** As an operator, I want one TypeSafe adapter so that skills can request typed judgments safely.

**Acceptance Criteria:**

- [ ] The new file `.agro/scripts/typesafe.mjs` calls `POST https://api.typesafe.ai/v1/systemone` with the Node built-in `fetch` and imports no npm package.
- [ ] The adapter exports one judgment function that returns a typed value on HTTP 200 and returns an unconfigured result when `TYPESAFE_API_KEY` is empty.
- [ ] The adapter exposes a preflight command. With no key, the command prints a diagnostic that names `TYPESAFE_API_KEY` and the fix `agro secret set TYPESAFE_API_KEY`, then exits 0.
- [ ] On HTTP 401, a network error, or a timeout, the adapter prints a diagnostic that names the cause and returns the fallback signal. The adapter never throws to the caller.
- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` lists `TYPESAFE_API_KEY`, and `.agro/cli/src/lib/__tests__/secrets.test.ts` expects the new key.
- [ ] `.example.env` documents a commented `TYPESAFE_API_KEY=` entry.
- [ ] No `.devcontainer/docker-compose*.yml` file names `TYPESAFE_API_KEY`, and `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.
- [ ] The new file `.agro/scripts/__tests__/typesafe.test.mjs` covers the unconfigured path, the HTTP 200 path, and the HTTP 401 path against a stubbed `fetch`. Each test first fails against an empty adapter.

### US-002: TypeSafe correctionDensity in prompt-miner

**Description:** As an operator, I want calibrated correction judgments so that prompt-miner scores sessions with less variance.

**Acceptance Criteria:**

- [ ] If `TYPESAFE_API_KEY` is set, `mine-traces.mjs` classifies each human follow-up through the adapter and computes `correctionDensity` from the judgments.
- [ ] If `TYPESAFE_API_KEY` is empty, `mine-traces.mjs` prints one diagnostic, uses `NEGATION_LEXICON`, and produces output identical to the current engine.
- [ ] Each session record states which classifier produced `correctionDensity`, and `.agro/skills/prompt-miner/references/report-schema.md` documents the new field.
- [ ] Step 1 of `.agro/skills/prompt-miner/SKILL.md` runs the adapter preflight before the engine runs.
- [ ] `.agro/skills/prompt-miner/references/scoring.md` describes the TypeSafe classifier and keeps the negation lexicon as the fallback.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0, and the existing assertion `agg.correctionDensity === 0.5` still passes on the lexicon path.

### US-003: Probe for behavior without TypeSafe

**Description:** As an operator, I want a probe for the absent-key path so that AGRO behaves as today without TypeSafe.

**Acceptance Criteria:**

- [ ] The new file `.agro/evals/probes/typesafe-absent-fallback.sh` declares the `# tier:`, `# source:`, and `# desc:` headers.
- [ ] With `TYPESAFE_API_KEY` unset, the probe runs the adapter preflight and the engine on the tracked fixture `.agro/skills/prompt-miner/scripts/__tests__/fixtures/claude-sample.jsonl`.
- [ ] The probe exits 0 when both commands exit 0, the diagnostic names `TYPESAFE_API_KEY`, and the lexicon result matches the current engine.
- [ ] The probe exits 1 against a copy of the adapter that throws on a missing key. Record this fault-injection run in `progress.txt`.
- [ ] The probe completes in less than 30 seconds and makes no network call.

## Summary

Verified state: `mine-traces.mjs` computes `correctionDensity` at line 310 from `NEGATION_LEXICON`, a 12-entry list at line 22. `.agro/skills/prompt-miner/references/scoring.md` flags this signal as the highest-variance signal. `SECRET_KEYS` holds 8 keys, and a test pins the exact list. `.agro/cli/package.json` sets `"type": "module"`. The probe `compose-env-boundary.sh` restricts keys in the compose `environment:` block.

Approach: add one HTTP adapter with no dependencies under `.agro/scripts/`. Wire the key through `SECRET_KEYS` and `.example.env` only. Make `prompt-miner` the first consumer. The contract for an absent key is "fail loudly, then continue": a named diagnostic, exit 0, and the lexicon fallback.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/scripts/typesafe.mjs` (new file) | judgment function, preflight command | HTTP adapter and diagnostics |
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Secret allow-list |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | allow-list test | Pins the key list |
| `.example.env` | commented key entries | Operator documentation |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `aggregateSession`, `NEGATION_LEXICON` | Consumer and fallback |
| `.agro/skills/prompt-miner/SKILL.md` | Step 1 | Preflight call |
| `.agro/skills/prompt-miner/references/scoring.md` | Negation lexicon section | Signal definition |
| `.agro/skills/prompt-miner/references/report-schema.md` | session record | Classifier field |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret set TYPESAFE_API_KEY` | New allowed key | The CLI accepts the new secret key. |
| `mine-traces.mjs` output | New field | Each session names its correction classifier. |
| Adapter preflight | New command | The command reports the configuration state and exits 0. |

## Storage

N/A. The adapter keeps no state. The key lives in the gitignored secrets file that `agro secret set` writes.

## Architectural Decisions

- The HTTP API is the only transport. The npm SDK stays out, so `.agro/cli` keeps zero runtime dependencies and skips the `pnpm audit --audit-level low` gate.
- The key goes through `SECRET_KEYS` and `.example.env`. The compose `environment:` block does not carry the key.
- `NEGATION_LEXICON` stays as the deterministic fallback. The lexicon is the source of truth when the key is absent.
- The adapter owns every diagnostic. Consumers call the adapter and never parse HTTP errors.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/typesafe.test.mjs` (new file) | no key, HTTP 200, HTTP 401, timeout | Adapter contract |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | allow-list | New key |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | lexicon path, stubbed adapter path | Consumer and fallback |
| `.agro/evals/probes/typesafe-absent-fallback.sh` (new file) | key unset | Current behavior without TypeSafe |
| `.agro/evals/probes/compose-env-boundary.sh` | compose keys | Key stays out of compose |
| `.agro/evals/probes/config-schema-parity.sh` | secret parity | Key surfaces stay aligned |

## Design Principles

- Fail loudly, then continue. Never fall back silently and never crash.
- Keep one adapter as the only caller of the TypeSafe API.
- Keep zero runtime dependencies in `.agro/scripts/` and `.agro/cli`.
- Add no explanatory comments to tracked code.

## Out of Scope

- Skill suggestion through the `UserPromptSubmit` hook.
- Guard hooks that use model judgments.
- Reranking for `/wiki query`.
- Tier-B behavioral evals.
- Other consumers such as `simplicity-review.json` or the audit snippets.

## Open Questions

1. The prompt-miner privacy contract governs trace text. Does the operator approve sending redacted human follow-ups to an external API? Should `redact` run first?
2. The issue names no request schema or output type for `jev-latest`. Which output type does the correction judgment use: boolean or probability?
3. `aggregateSession` is synchronous. Does the engine batch adapter calls before aggregation, or does `aggregateSession` become async?
4. Which command runs the new file `.agro/scripts/__tests__/typesafe.test.mjs` in CI: `<test command>`?
5. Does `.agro/skills/typesafe-ai/SKILL.md` also need the preflight?
6. Does the mifunedev/agro-web repository need a page for the new secret key?

## Acceptance Criteria

- [ ] With `TYPESAFE_API_KEY` unset, each changed command exits 0 and prints a diagnostic that names the key.
- [ ] With `TYPESAFE_API_KEY` unset, prompt-miner output matches the output of the base commit.
- [ ] `bash .agro/evals/probes/typesafe-absent-fallback.sh` exits 0 on the new file.
- [ ] `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.
- [ ] `.agro/cli/package.json` gains no runtime dependency.

## Lessons

Filled by the advisor before undraft.
