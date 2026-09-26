# PRD: TypeSafe judgment adapter with correctionDensity consumer

Status: DRAFT

## User Stories

### US-001: Zero-dependency TypeSafe adapter

**Description:** As a control-plane script, I want one typed TypeSafe call so that skills get judgments without npm packages.

**Acceptance Criteria:**

- [ ] The new file `.agro/scripts/typesafe.mjs` imports only `node:` built-in modules.
- [ ] The adapter sends `POST https://api.typesafe.ai/v1/systemone` with the model `jev-latest` and the key from `TYPESAFE_API_KEY`.
- [ ] If `TYPESAFE_API_KEY` is unset or empty, the adapter makes no network call and returns an `unconfigured` result that names the key and the fix command `agro secret set TYPESAFE_API_KEY`.
- [ ] If the HTTP call fails, times out after <timeout ms>, or returns a non-2xx status, the adapter returns an `unavailable` result with the cause. The adapter never throws to the caller.
- [ ] The adapter exposes a preflight mode that prints the configuration state to stderr and exits 0 in every state.
- [ ] The new file `.agro/scripts/__tests__/typesafe.test.ts` covers the configured, unconfigured, HTTP-error, and timeout paths with a stubbed `fetch`. The test makes no real network call.

### US-002: Secret wiring for TYPESAFE_API_KEY

**Description:** As an operator, I want to store the TypeSafe key as a secret so that sandboxes can use the adapter.

**Acceptance Criteria:**

- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` contains `TYPESAFE_API_KEY`.
- [ ] The repository-root example env template lists `TYPESAFE_API_KEY` with an empty value.
- [ ] No file that matches the glob .devcontainer/docker-compose*.yml names `TYPESAFE_API_KEY`.
- [ ] `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.
- [ ] `.agro/cli/src/lib/__tests__/secrets.test.ts` asserts that `isSecretKey("TYPESAFE_API_KEY")` returns true.

### US-003: Jev-backed correctionDensity with loud fallback

**Description:** As a prompt-miner operator, I want Jev to judge corrective follow-ups so that the score has less variance.

**Acceptance Criteria:**

- [ ] If the adapter returns a judgment, `mine-traces.mjs` counts a follow-up as corrective from the Jev judgment.
- [ ] If the adapter returns `unconfigured` or `unavailable`, `mine-traces.mjs` prints one diagnostic line to stderr, uses `NEGATION_LEXICON`, and exits 0.
- [ ] The report manifest records the source of `correctionDensity` as `typesafe` or `lexicon`.
- [ ] With `TYPESAFE_API_KEY` unset, the scores for the tracked fixtures equal the scores at the base commit.
- [ ] `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` covers the Jev path with a stubbed adapter and the fallback path.
- [ ] `.agro/skills/prompt-miner/references/scoring.md` and `.agro/skills/prompt-miner/references/report-schema.md` describe the new source field.

### US-004: Absent-TypeSafe probe and skill preflight

**Description:** As the eval runner, I want a probe for the absent-key path so that AGRO keeps its current behavior.

**Acceptance Criteria:**

- [ ] The new file `.agro/evals/probes/typesafe-absent-fallback.sh` declares `# tier:`, `# source:`, and `# desc:` headers.
- [ ] The probe runs `mine-traces.mjs` on the tracked fixtures with `TYPESAFE_API_KEY` unset. The probe exits 0 only if the run exits 0, the stderr names `TYPESAFE_API_KEY`, and the manifest source is `lexicon`.
- [ ] A fault-injection run against a disposable copy that removes the stderr diagnostic makes the probe exit 1.
- [ ] `.agro/skills/typesafe-ai/SKILL.md` and `.agro/skills/prompt-miner/SKILL.md` tell the agent to run the adapter preflight before the first TypeSafe call.

## Summary

Control-plane validators check schemas, but prose-reading agents produce the values. This task adds one typed value source: TypeSafe System One through the HTTP API. The adapter uses no npm SDK. This choice keeps the zero-runtime-dependency guarantee of `.agro/cli` and keeps skill scripts portable. `correctionDensity` in `.agro/skills/prompt-miner/scripts/mine-traces.mjs` now uses the 12-entry `NEGATION_LEXICON`. `.agro/skills/prompt-miner/references/scoring.md` marks the signal as the highest-variance signal. The selected approach keeps the lexicon as the deterministic fallback. An unconfigured sandbox fails loudly, exits 0, and continues with the lexicon.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| new file `.agro/scripts/typesafe.mjs` | judge call, preflight | HTTP adapter and preflight |
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Secret allow-list |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `NEGATION_LEXICON`, `correctionDensity` near line 309 | First consumer |
| `.agro/skills/prompt-miner/references/scoring.md` | Negation lexicon section | Scoring contract |
| `.agro/evals/probes/compose-env-boundary.sh` | `LITERALS` | Keeps the key out of compose |
| `.agro/skills/typesafe-ai/SKILL.md` | preflight step | Skill preflight |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro secret set TYPESAFE_API_KEY` | New accepted key | The CLI accepts the new secret key |
| Adapter preflight | New CLI mode | Prints the configuration state and exits 0 |
| prompt-miner report manifest | New field | Records the `correctionDensity` source |
| prompt-miner stderr | New diagnostic | Names the missing key and the fix |

## Storage

The key uses the existing secrets file that `secretsFilePath` resolves. The adapter stores no state. The report manifest carries the new source field.

## Architectural Decisions

- The HTTP API is the only TypeSafe transport. The npm SDK stays out of the repository.
- `SECRET_KEYS` is the single source for the key allow-list. The compose `environment:` block never carries the key.
- The adapter returns a result value for every failure. Each caller owns its fallback and its diagnostic.
- `NEGATION_LEXICON` stays as the deterministic fallback, and the fixture scores stay unchanged without a key.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/scripts/__tests__/typesafe.test.ts` | configured, unconfigured, HTTP error, timeout | US-001 |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `TYPESAFE_API_KEY` is a secret key | US-002 |
| `.agro/evals/probes/compose-env-boundary.sh` | key absent from compose | US-002 |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | Jev path, fallback path, unchanged fixture scores | US-003 |
| new file `.agro/evals/probes/typesafe-absent-fallback.sh` | absent key keeps current behavior | US-004 |

## Design Principles

- Fail loudly, then continue: name the cause and the fix, exit 0, and use the fallback.
- Never fall back silently, and never crash.
- Keep zero runtime dependencies in the adapter.
- Add no explanatory comments to tracked code.
- Keep one adapter. Add no second consumer in this task.

## Out of Scope

- Skill suggestion through `UserPromptSubmit`. This change needs /architect and an ADR.
- Model-assisted guard hooks.
- Reranking for /wiki query.
- Tier-B behavioral evals.
- Other schema-envelope consumers and prose-specified audit snippets.

## Open Questions

1. What request and response shape does `jev-latest` use for a boolean judgment with a probability? The plan uses the placeholder <Jev request schema>.
2. What timeout must the adapter use? The plan uses <timeout ms>.
3. Which probability threshold marks a follow-up as corrective? The plan uses <threshold>.
4. Which runner executes `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs`: `pnpm test` or `node --test`?
5. Must public documentation in the mifunedev/agro-web repository name the new secret?

## Acceptance Criteria
- [ ] Every story acceptance criterion passes.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] In a sandbox without `TYPESAFE_API_KEY`, the probe in the new file `.agro/evals/probes/typesafe-absent-fallback.sh` exits 0.
- [ ] `git grep -n typesafe -- package.json .agro/cli/package.json` prints no dependency entry.

## Lessons

Filled by the advisor before undraft.
