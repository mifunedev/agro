# PRD: TypeSafe judgment adapter with a correctionDensity consumer

Status: BLOCKED

## User Stories

### US-001: Register TYPESAFE_API_KEY as a secret

**Description:** As an operator, I want `TYPESAFE_API_KEY` to be a managed secret. `agro secret` then stores the key in the root `.env` file, and compose never exports the key.

**Acceptance Criteria:**

- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` lists `"TYPESAFE_API_KEY"` as the last entry.
- [ ] The allow-list case in `.agro/cli/src/lib/__tests__/secrets.test.ts` lists `"TYPESAFE_API_KEY"` as the last entry and passes under `pnpm test`.
- [ ] `.example.env` holds the line `# TYPESAFE_API_KEY=`.
- [ ] `git grep -n TYPESAFE_API_KEY -- .devcontainer` prints no line.
- [ ] `bash .agro/evals/probes/compose-env-boundary.sh`, `bash .agro/evals/probes/config-schema-parity.sh`, and `bash .agro/evals/probes/oh-config-surfaces.sh` each exit 0.

### US-002: Add the zero-dependency adapter

**Description:** As a skill author, I want one adapter at `.agro/scripts/typesafe.mjs`. Each consumer then gets a typed judgment or a named, deterministic fallback.

**Acceptance Criteria:**

- [ ] `.agro/scripts/typesafe.mjs` imports only `node:` built-in modules and calls the API with the global `fetch`.
- [ ] The adapter sends `POST https://api.typesafe.ai/v1/systemone` with the model `jev-latest`. The request body and the response parsing follow the HTTP API contract at `https://docs.typesafe.ai/api.md`.
- [ ] The adapter reads `TYPESAFE_API_KEY` from `process.env`. If `process.env` has no value, the adapter reads the key from the root `.env` file.
- [ ] If the key is absent, the adapter returns an unconfigured result. The adapter makes no network call.
- [ ] If the API returns a non-2xx status, or the request exceeds `<request timeout ms>`, the adapter returns a failed result that names the HTTP status or the timeout.
- [ ] Each unconfigured result and each failed result carries a diagnostic that names the cause and the fix, for example `agro secret set TYPESAFE_API_KEY`.
- [ ] No diagnostic and no log line contains the key value.
- [ ] `node .agro/scripts/typesafe.mjs --preflight` exits 0 in each state. The command prints `typesafe: configured` or the unconfigured diagnostic.
- [ ] `.agro/scripts/__tests__/typesafe.test.ts` covers the absent key, a 401 response, a timeout, and a valid response with a stubbed `fetch`. The file passes under `pnpm test`.
- [ ] `.agro/scripts/README.md` lists `typesafe.mjs` in the script table.

### US-003: Add the skill preflight

**Description:** As an agent that runs `/prompt-miner`, I want the skill to report the TypeSafe state before the run. An unconfigured sandbox then shows a named diagnostic, not an opaque 401.

**Acceptance Criteria:**

- [ ] Step 1 of `.agro/skills/prompt-miner/SKILL.md` runs `node .agro/scripts/typesafe.mjs --preflight` before the `mine-traces.mjs` command.
- [ ] The step states that an unconfigured result continues the run with the negation lexicon.
- [ ] `bash .agro/evals/probes/prompt-miner-symlink-entrypoint.sh` and `bash .agro/evals/probes/registry-portability.sh` each exit 0.

### US-004: Judge correctionDensity with TypeSafe

**Description:** As an operator who mines prompts, I want TypeSafe to judge each corrective follow-up so that `correctionDensity` stops counting casual clarifications as corrections.

**Acceptance Criteria:**

- [ ] If the adapter reports a configured key and the run has no `--no-typesafe` flag, `run()` in `mine-traces.mjs` asks the adapter for one judgment per follow-up human prompt.
- [ ] `aggregateSession(events, meta)` accepts precomputed judgments in `meta`. If `meta` has no judgments, the function uses `NEGATION_LEXICON` and gives the current result.
- [ ] If any adapter call returns an unconfigured result or a failed result, the run prints the diagnostic to stderr once, uses the lexicon for every session, and exits 0.
- [ ] The report manifest records `correctionJudge` as `"typesafe"` or `"lexicon"`.
- [ ] `--no-typesafe` forces the lexicon and makes no network call.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` passes. The file adds cases for judged input, unconfigured input, and a mid-run failure.
- [ ] The case that asserts `agg.correctionDensity` equals `0.5` passes unchanged.
- [ ] `.agro/skills/prompt-miner/references/scoring.md` and `.agro/skills/prompt-miner/references/report-schema.md` describe the judge, the fallback, and `correctionJudge`.
- [ ] `bash .agro/evals/probes/prompt-miner-schema-compat.sh` and `bash .agro/evals/probes/prompt-miner-weakness-record.sh` each exit 0.

### US-005: Prove the absent-key behavior with a probe

**Description:** As a maintainer, I want a tier A probe so that CI proves AGRO behaves as today when TypeSafe is absent.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/typesafe-absent-fallback.sh` declares the `# tier:`, `# source:`, and `# desc:` headers.
- [ ] The probe runs `mine-traces.mjs --no-git` over the committed fixtures in `.agro/skills/prompt-miner/scripts/__tests__/fixtures/` with `TYPESAFE_API_KEY` unset.
- [ ] The probe asserts exit 0, the unconfigured diagnostic on stderr, and `correctionJudge` equal to `"lexicon"`.
- [ ] The probe asserts that each session score equals the score from the same run with `--no-typesafe`.
- [ ] The probe asserts that `.agro/scripts/typesafe.mjs` imports only `node:` modules.
- [ ] The probe exits 1 against a copy of `typesafe.mjs` that imports a non-`node:` module. The probe exits 1 against a copy that throws on an absent key.
- [ ] The probe exits 0 on the final tree and completes in less than 30 seconds.

## Summary

The issue is `work/issue-1121.md`. The issue asks for TypeSafe System One judgments in the value slot of an existing schema. The first consumer is `correctionDensity` in the prompt miner.

Verified current state:

- `aggregateSession()` in `.agro/skills/prompt-miner/scripts/mine-traces.mjs:267` counts a follow-up as corrective when `matchesLexicon(t, NEGATION_LEXICON)` returns true (line 309).
- `.agro/skills/prompt-miner/references/scoring.md:40` calls `correctionDensity` the highest-variance signal. Line 74 lists the 12-term lexicon.
- `aggregateSession()` is synchronous. `run()` at line 850 is async and calls `aggregateSession()` once for each session.
- `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts:9` holds 8 keys. `secrets.test.ts:30` pins the list.
- `.example.env` lists each secret key as a commented line.
- `compose-env-boundary.sh` rejects each compose `environment:` key that `config-render.ts` does not render and that the probe does not list as a literal.
- `.agro/skills/typesafe-ai/SKILL.md` exists and holds no script. The skill names the live docs as the source of truth for the API contract.
- `mine-traces.test.mjs` uses `node:test`. No workflow under `.github` names the file.

Selected approach: the adapter is a small ESM module over `fetch`. The miner precomputes judgments in the async `run()` and passes the judgments into the pure `aggregateSession()`. Any adapter failure switches the whole run to the lexicon, so one report never mixes two judges.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Secret allow-list. |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `allow-list` case | Pins the allow-list. |
| `.example.env` | commented key lines | Operator template. |
| `.agro/scripts/typesafe.mjs` | new: `judge()`, `isConfigured()`, `--preflight` | Adapter and preflight. |
| `.agro/scripts/README.md` | script table | Script index. |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `run()`, `aggregateSession()`, `parseArgs()`, `NEGATION_LEXICON` | First consumer. |
| `.agro/skills/prompt-miner/SKILL.md` | Step 1 | Preflight call site. |
| `.agro/skills/prompt-miner/references/scoring.md` | Negation lexicon section | Signal definition. |
| `.agro/skills/prompt-miner/references/report-schema.md` | manifest fields | Report contract. |
| `.agro/evals/probes/compose-env-boundary.sh` | `LITERALS` | Keeps the key out of compose. No change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret` key list | Add | `TYPESAFE_API_KEY` becomes a valid secret key. |
| `node .agro/scripts/typesafe.mjs --preflight` | New CLI | Prints the configured state or the diagnostic. Exits 0. |
| `mine-traces.mjs --no-typesafe` | New flag | Forces the lexicon. |
| Report `manifest.correctionJudge` | New field | Names the judge for the run. |
| Outbound HTTPS to `api.typesafe.ai` | New egress | Sends follow-up prompt text when the key is present. |

## Storage

The key lives in the root `.env` file through `setSecret()`. The adapter keeps no cache and writes no file. The report gains one manifest field.

## Architectural Decisions

- Source of truth for the key: the root `.env` file and `process.env`. The compose `environment:` block never carries the key.
- The adapter uses the HTTP API, not the npm SDK. This keeps `.agro/cli` free of a runtime dependency and keeps the `pnpm audit --audit-level low` gate out of the path.
- Contract: an unconfigured state or a failed call prints one specific diagnostic, exits 0, and uses the deterministic fallback. The adapter never falls back without a diagnostic and never throws to the caller.
- `aggregateSession()` stays synchronous and pure. Network calls stay in `run()`.
- One run uses one judge. A mid-run failure reverts the whole run to the lexicon.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | allow-list includes `TYPESAFE_API_KEY` | US-001 |
| `.agro/scripts/__tests__/typesafe.test.ts` | absent key; 401; timeout; valid response; key never printed | US-002 |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | judged follow-ups; unconfigured fallback; mid-run failure; `--no-typesafe` | US-004 |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | absent key equals lexicon; `node:`-only imports | US-005 |
| `.agro/evals/probes/compose-env-boundary.sh` | key absent from compose | US-001 |

Write each red test before the change it guards. Run `pnpm test` for the vitest files. Run `node --test` for `mine-traces.test.mjs`.

## Design Principles

- Apply the root `AGENTS.md` rules: no explanatory comments in tracked code, one source of truth, and the smallest change.
- Fail loudly, then continue: name the cause and the fix, exit 0, and use the fallback.
- Absent TypeSafe gives the current output byte for byte, except the new `correctionJudge` field.
- Keep the key out of logs, diagnostics, reports, and compose.

## Out of Scope

- Skill suggestion through `UserPromptSubmit`.
- Model-assisted guard hooks.
- Reranking in `/wiki query`.
- Tier-B behavioral evals.
- Other consumers: `simplicity-review.json`, `ui-evidence.json`, `delegate-graph.json`, the capability triad, and the `/retro` hypothesis table.
- New `.sh` files for the prose snippets in `audit skills`, `audit context`, `audit eval-quality`, and `wiki query`.

## Open Questions

1. Data egress: the miner redacts prompt text in reports by default. Does the operator approve sending raw follow-up prompt text to `api.typesafe.ai`?
   - A. Send raw text.
   - B. Send `redact(text)` output.
   - C. Require an explicit `--typesafe` opt-in flag instead of automatic use.
2. Judgment shape: which primitive and which rule convert a judgment into the corrective count?
   - A. One Noul per follow-up. Sum the probabilities as the expected count.
   - B. One Noul per follow-up. Count a probability at or above `<threshold>`.
3. What value does `<request timeout ms>` take?
4. Does `correctiveFollowups` stay an integer, or does the field accept a fractional expected count?
5. Which CI job runs `mine-traces.test.mjs`? No workflow under `.github` names the file.
6. Does a sandbox shell export the root `.env` values into `process.env`? The adapter reads the file as a fallback in each case.
7. Does `mifunedev/agro-web` document the `agro secret` key list? If so, the page needs the new key.

## Acceptance Criteria

- [ ] Each story acceptance criterion passes.
- [ ] `pnpm test` exits 0.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.
- [ ] The `/eval` probe suite reports no REGRESSION.
- [ ] With `TYPESAFE_API_KEY` unset, the miner report equals the current report except for `correctionJudge`.
- [ ] `git grep -n TYPESAFE_API_KEY` finds no key value in a tracked file.

## Lessons

Filled by the advisor before undraft.
