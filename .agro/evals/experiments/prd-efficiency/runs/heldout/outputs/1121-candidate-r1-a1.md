# PRD: TypeSafe judgment adapter for the control plane

Status: DRAFT

## User Stories

### US-001: Zero-dependency TypeSafe adapter and secret wiring

**Description:** As an operator, I want one TypeSafe adapter so that skills can request typed judgments.

**Acceptance Criteria:**

- [ ] The new file `.agro/scripts/typesafe.mjs` imports only `node:` built-in modules.
- [ ] The adapter sends `POST https://api.typesafe.ai/v1/systemone` with the model `jev-latest` through the global `fetch`.
- [ ] The adapter exports a preflight function. The function reports `configured` when `TYPESAFE_API_KEY` is set and `unconfigured` otherwise.
- [ ] When `TYPESAFE_API_KEY` is absent, the adapter prints one stderr line. The line names `TYPESAFE_API_KEY` and the fix `agro secret set TYPESAFE_API_KEY`. The adapter returns the fallback marker and throws no error.
- [ ] When the API returns HTTP 401 or a network error, the adapter prints one stderr line with the cause and returns the fallback marker.
- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` contains `TYPESAFE_API_KEY`.
- [ ] `.example.env` holds a commented `TYPESAFE_API_KEY=` entry with a one-line purpose note.
- [ ] No file that matches .devcontainer/docker-compose*.yml names `TYPESAFE_API_KEY`.
- [ ] `.agro/cli/package.json` gains no dependency.
- [ ] The new file `.agro/scripts/__tests__/typesafe.test.mjs` covers the configured path with a stubbed `fetch`, the absent key, and HTTP 401. The tests pass.

### US-002: Jev scores correctionDensity in prompt-miner

**Description:** As an operator, I want Jev to classify corrective follow-ups so that correctionDensity carries less noise.

**Acceptance Criteria:**

- [ ] When the adapter reports `configured`, `mine-traces.mjs` classifies each human follow-up through the adapter.
- [ ] When the adapter reports `unconfigured` or returns the fallback marker, `mine-traces.mjs` counts corrective follow-ups with `NEGATION_LEXICON`, as today.
- [ ] The report records the source of correctionDensity as `typesafe` or `lexicon`.
- [ ] With `TYPESAFE_API_KEY` unset, the existing assertions in `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` pass without change.
- [ ] A new test case stubs the adapter and asserts that Jev verdicts set correctionDensity.
- [ ] `.agro/skills/prompt-miner/SKILL.md` runs the adapter preflight before the mining step and states the unconfigured diagnostic.
- [ ] `.agro/skills/prompt-miner/references/scoring.md` documents the Jev path and keeps the lexicon as the fallback.

### US-003: Probe for behavior without TypeSafe

**Description:** As a maintainer, I want a probe for the absent-key path so that AGRO stays unchanged without TypeSafe.

**Acceptance Criteria:**

- [ ] The new file `.agro/evals/probes/typesafe-absent-fallback.sh` declares the `# tier:`, `# source:`, and `# desc:` headers.
- [ ] With `TYPESAFE_API_KEY` unset, the probe runs `mine-traces.mjs` on the tracked fixture `.agro/skills/prompt-miner/scripts/__tests__/fixtures/claude-sample.jsonl`.
- [ ] The probe exits 0 only when the run exits 0, stderr names `TYPESAFE_API_KEY`, and the report records the source `lexicon`.
- [ ] The probe exits 1 when the adapter crashes, exits non-zero, or falls back without the stderr diagnostic.
- [ ] The implementer drives the REGRESSION branch against a disposable broken copy and records the result in `progress.txt`.

## Summary

AGRO validates envelopes, but agents produce the values from prose. This task adds one path for typed judgments from TypeSafe System One. `.agro/skills/typesafe-ai/SKILL.md` exists, but no script calls the API. `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` lists eight keys. `mine-traces.mjs` computes correctionDensity at lines 309 to 310 from `NEGATION_LEXICON`. `.agro/skills/prompt-miner/references/scoring.md` line 40 marks the signal as the highest-variance signal. The adapter calls the HTTP API directly and keeps the CLI free of runtime dependencies. An unconfigured sandbox prints a diagnostic, exits 0, and uses the lexicon.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| new file `.agro/scripts/typesafe.mjs` | judgment call, preflight | HTTP adapter and fallback contract |
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Secret allowlist |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `SECRET_KEYS` list assertion | Pins the key list |
| `.example.env` | `TYPESAFE_API_KEY` entry | Operator documentation of the key |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `NEGATION_LEXICON`, `matchesLexicon`, correctionDensity at line 309 | First consumer |
| `.agro/skills/prompt-miner/SKILL.md` | mining procedure | Preflight step |
| `.agro/skills/prompt-miner/references/scoring.md` | correctionDensity row, negation lexicon section | Scoring documentation |
| `.agro/evals/probes/compose-env-boundary.sh` | compose `environment:` check | Existing guard that keeps the key out of compose |
| `.agro/evals/probes/oh-config-surfaces.sh` | `SECRET_KEYS` extraction | Existing parity probe for the new key |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro secret set TYPESAFE_API_KEY` | New allowed key | The existing verb accepts the new key. |
| new file `.agro/scripts/typesafe.mjs` | New module | Skill scripts import the adapter. |
| prompt-miner report | New field | The report records the correctionDensity source. |

## Storage

The key lives in the gitignored secrets file at the repository root, which `.agro/cli/src/lib/secrets.ts` manages. The adapter stores no state. Reports keep their current location.

## Architectural Decisions

- The adapter owns the TypeSafe HTTP contract. Consumers never call the API directly.
- The adapter uses `fetch` from Node 20 and adds no npm package.
- The compose `environment:` block does not carry the key.
- The fallback marker is the single signal for the deterministic path. Each consumer keeps its current deterministic code as the fallback.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/scripts/__tests__/typesafe.test.mjs` | configured request shape; absent key; HTTP 401; network error | US-001 contract |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | key list includes `TYPESAFE_API_KEY` | US-001 wiring |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | lexicon path unchanged; stubbed Jev path | US-002 |
| new file `.agro/evals/probes/typesafe-absent-fallback.sh` | absent key on the real fixture | US-003 |
| `.agro/evals/probes/compose-env-boundary.sh` | compose files stay free of the key | US-001 boundary |

Run each test with `<test command>` for the adapter and the miner. Run the probes through /eval.

## Design Principles

- Fail loudly, then continue: name the cause and the fix, exit 0, and use the deterministic fallback.
- Keep one source of truth: the adapter owns the API contract.
- Add no comments to tracked code.
- Change canonical files under `.agro/` only.

## Out of Scope

- Skill suggestion through `UserPromptSubmit`.
- Model-assisted guard hooks.
- Reranking in /wiki query.
- Tier-B behavioral evals.
- Other consumers such as simplicity-review.json or the /retro hypothesis table.
- Shell scripts for the prose snippets in the audit skills.

## Open Questions

1. Which command runs the `.mjs` tests? The plan uses `<test command>` until the implementer confirms the runner.
2. Does the preflight belong in `.agro/skills/prompt-miner/SKILL.md` only, or also in `.agro/skills/typesafe-ai/SKILL.md`?
3. What request and response schema does Jev use for a binary judgment? The implementer reads the live TypeSafe docs.
4. How does the key reach the sandbox process without the compose `environment:` block? The implementer confirms the loader in `.agro/cli/src/lib/secrets.ts`.
5. Does the public documentation in mifunedev/agro-web need a secret-key entry?

## Acceptance Criteria
- [ ] Each story acceptance criterion passes.
- [ ] With `TYPESAFE_API_KEY` unset, the new file `.agro/evals/probes/typesafe-absent-fallback.sh` exits 0.
- [ ] `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.
- [ ] `bash .agro/evals/probes/oh-config-surfaces.sh` exits 0.
- [ ] With `TYPESAFE_API_KEY` unset, prompt-miner produces the same correctionDensity values as the base commit on the tracked fixtures.

## Lessons

Filled by the advisor before undraft.
