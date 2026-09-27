# PRD: TypeSafe judgment adapter with prompt-miner as first consumer

Status: DRAFT

## User Stories

### US-001: Register TYPESAFE_API_KEY as an allow-listed secret

**Description:** As an operator, I want `TYPESAFE_API_KEY` in the secret allow-list so that `agro secret set TYPESAFE_API_KEY` stores the key in the root dotenv.

**Acceptance Criteria:**

- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` contains `"TYPESAFE_API_KEY"`.
- [ ] The allow-list case in `.agro/cli/src/lib/__tests__/secrets.test.ts` lists `TYPESAFE_API_KEY`, and `pnpm test` exits 0.
- [ ] `.example.env` holds a commented `# TYPESAFE_API_KEY=` entry with a one-line purpose and the docs URL `https://docs.typesafe.ai`.
- [ ] The secret-key list at `.agro/scripts/migrate-harness-yaml.sh:118` and the secret list at `docs/configuration.md:172` name `TYPESAFE_API_KEY`.
- [ ] No `.devcontainer/docker-compose*.yml` file contains `TYPESAFE_API_KEY`, and `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.
- [ ] `bash .agro/evals/probes/oh-config-surfaces.sh` and `bash .agro/evals/probes/config-schema-parity.sh` exit 0.
- [ ] `pnpm typecheck` exits 0.

### US-002: Add the zero-dependency adapter at .agro/scripts/typesafe.mjs

**Description:** As a skill author, I want one adapter over `POST https://api.typesafe.ai/v1/systemone` so that each skill script gets a typed judgment or a named fallback reason.

**Acceptance Criteria:**

- [ ] `.agro/scripts/typesafe.mjs` imports only `node:` built-in modules and uses the global `fetch`.
- [ ] The adapter exports `judge(<question>, <input>, options)`, and the result is `{ ok: true, value, probability }` or `{ ok: false, reason }`.
- [ ] The adapter sends model `jev-latest` and reads the key from `process.env.TYPESAFE_API_KEY`.
- [ ] If `TYPESAFE_API_KEY` is empty, `judge` returns `{ ok: false, reason: "unconfigured" }` and sends no HTTP request.
- [ ] If the API returns HTTP 401, HTTP 5xx, a timeout, or a body that fails the schema check, `judge` returns `{ ok: false }` with a reason that names the cause.
- [ ] `judge` never throws for a network failure or an HTTP failure.
- [ ] `.agro/scripts/__tests__/typesafe.test.ts` drives each case above through an injected `fetch` stub, and `pnpm test` exits 0.
- [ ] `.agro/scripts/README.md` lists `typesafe.mjs` in the script table.

### US-003: Add the skill preflight

**Description:** As an agent that runs a skill, I want a preflight check so that an unconfigured sandbox reports the cause and the fix.

**Acceptance Criteria:**

- [ ] `node .agro/scripts/typesafe.mjs --check` with `TYPESAFE_API_KEY` empty prints `typesafe: TYPESAFE_API_KEY is empty; using the deterministic fallback. Fix: run agro secret set TYPESAFE_API_KEY` to stderr and exits 0.
- [ ] `node .agro/scripts/typesafe.mjs --check` with a non-empty key prints `typesafe: configured` to stderr and exits 0.
- [ ] The `--check` path sends no HTTP request.
- [ ] `.agro/skills/prompt-miner/SKILL.md` runs the `--check` command before the engine command when the operator passes `--judge typesafe`.
- [ ] `.agro/scripts/__tests__/typesafe.test.ts` covers both `--check` outputs, and `pnpm test` exits 0.

### US-004: Use TypeSafe for correctionDensity in prompt-miner

**Description:** As an operator who mines traces, I want TypeSafe to classify each corrective follow-up so that `correctionDensity` stops depending on the negation lexicon.

**Acceptance Criteria:**

- [ ] `parseArgs` in `.agro/skills/prompt-miner/scripts/mine-traces.mjs` accepts `--judge typesafe`, and the default judge stays `lexicon`.
- [ ] With `--judge typesafe` and a configured key, the engine sends each follow-up prompt through `redact()` and then through `judge`, and counts the prompt as corrective when `value` is true.
- [ ] If `judge` returns `ok: false` for a prompt, the engine uses `matchesLexicon(text, NEGATION_LEXICON)` for that prompt.
- [ ] The manifest reports `correctionJudge` as `lexicon` or `typesafe`, and reports `correctionFallbacks` as an integer count.
- [ ] With `--judge typesafe` and an empty key, the engine prints the US-003 diagnostic line one time to stderr, exits 0, and produces the same `signals` values as the default run.
- [ ] `aggregateSession` stays synchronous and takes the corrective count or the per-prompt classification as an input, so that existing callers keep the lexicon result.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0 and covers the typesafe path, the per-prompt fallback, and the empty-key path through an injected judge.
- [ ] `references/scoring.md` describes both judges, and `references/report-schema.md` documents `correctionJudge` and `correctionFallbacks`.

### US-005: Add probe coverage for the absent-TypeSafe contract

**Description:** As a maintainer, I want a probe that runs without TypeSafe so that AGRO keeps the current behavior when the key is absent.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/typesafe-absent-fallback.sh` declares `# tier:`, `# source:`, and `# desc:` headers and resolves paths from `${BASH_SOURCE[0]}`.
- [ ] The probe unsets `TYPESAFE_API_KEY`, runs `node .agro/scripts/typesafe.mjs --check`, and asserts exit 0 and the diagnostic line.
- [ ] The probe runs `mine-traces.mjs --dry-run --no-git --fixtures-dir <fixtures>` with and without `--judge typesafe`, and asserts exit 0 and equal `signals` values.
- [ ] The probe asserts that `.agro/scripts/typesafe.mjs` imports no module outside `node:`.
- [ ] The probe exits 2 with a stderr reason when `node` or the engine is absent.
- [ ] Fault injection on a disposable copy turns the probe to exit 1 for a crash on an empty key and for a silent fallback with no diagnostic line.
- [ ] `bash .agro/evals/probes/typesafe-absent-fallback.sh` exits 0, and `bash .agro/evals/probes/prompt-miner-schema-compat.sh` exits 0.

## Summary

Issue 1121 (`work/issue-1121.md`) asks the control plane to consume typed judgments from TypeSafe System One (`jev-latest`). The first consumer fills one value slot where AGRO already owns the schema, the validator, and the neutral default.

Verified current state:

- `SECRET_KEYS` at `.agro/cli/src/lib/secrets.ts:9` holds 8 keys. `.agro/cli/src/lib/__tests__/secrets.test.ts:30` pins the exact list.
- `.devcontainer/docker-compose.yml:16` has an `environment:` block. The probe `.agro/evals/probes/compose-env-boundary.sh` rejects each key that `config-render.ts` does not render and that its `LITERALS` list does not name.
- `.agro/skills/prompt-miner/scripts/mine-traces.mjs:22` defines `NEGATION_LEXICON`. `aggregateSession` at line 267 computes `correctionDensity` at lines 309-310 through `matchesLexicon`.
- `references/scoring.md:40` marks `correctionDensity` as the highest-variance signal.
- The engine tests run under `node:test`. The `.agro/scripts/__tests__/*.test.ts` files run under `vitest` through `pnpm test`.
- `.agro/skills/typesafe-ai/SKILL.md` points to `https://docs.typesafe.ai/api.md` for the HTTP contract. This plan does not verify the request body or the response body.

Selected approach: one ESM adapter with no npm dependency, one opt-in consumer, and one probe that pins the absent-key behavior. The key travels through the root dotenv, not through compose.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Secret allow-list for `agro secret set` |
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | `allow-list` case | Pins the exact key list |
| `.example.env` | commented key entries | Operator template for the root dotenv |
| `.agro/scripts/migrate-harness-yaml.sh` | secret list at line 118 | Legacy migration secret set |
| `docs/configuration.md` | secret list at line 172 | Operator reference for secrets |
| `.agro/scripts/typesafe.mjs` | `judge`, `--check` | New adapter and preflight |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `NEGATION_LEXICON`, `matchesLexicon`, `aggregateSession`, `parseArgs`, `run`, `main` | First consumer |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `redact` | Scrubs prompt text before the API call |
| `.agro/skills/prompt-miner/SKILL.md` | engine command at line 92 | Skill preflight step |
| `.agro/evals/probes/compose-env-boundary.sh` | `LITERALS`, `allowed` | Keeps the key out of compose |
| `.agro/evals/probes/prompt-miner-schema-compat.sh` | dry-run assertion | Existing engine regression guard |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret set TYPESAFE_API_KEY` | New accepted key | The CLI accepts one more allow-listed secret. |
| `node .agro/scripts/typesafe.mjs --check` | New command | Prints one status line to stderr and exits 0. |
| `judge()` export | New module API | Returns `{ ok, value, probability }` or `{ ok: false, reason }`. |
| `mine-traces.mjs --judge <lexicon\|typesafe>` | New flag | Selects the correction classifier. The default is `lexicon`. |
| Prompt-miner manifest | New fields | Adds `correctionJudge` and `correctionFallbacks`. |
| `POST https://api.typesafe.ai/v1/systemone` | New outbound call | Sends redacted follow-up prompts only when the operator passes `--judge typesafe`. |

## Storage

N/A. The adapter keeps no state. The key lives in the existing root dotenv that `readSecret` and `setSecret` manage. The adapter writes no cache.

## Architectural Decisions

- `.agro/scripts/typesafe.mjs` is the single owner of the HTTP contract, the model name, the timeout, and the diagnostic text.
- The adapter uses the HTTP API and global `fetch`, not the npm SDK. This choice keeps `.agro/cli` free of runtime dependencies and avoids the `pnpm audit --audit-level low` gate.
- `TYPESAFE_API_KEY` stays out of every compose `environment:` block. The root dotenv owns the key.
- The deterministic lexicon stays the default judge and the fallback. A consumer never blocks on the model.
- The contract for an empty key is: print one diagnostic line, exit 0, and use the deterministic fallback.
- The operator opts in with `--judge typesafe` because the flag sends prompt text to an external service. The engine sends only `redact()` output.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | allow-list holds `TYPESAFE_API_KEY` | US-001 |
| `.agro/scripts/__tests__/typesafe.test.ts` | empty key, HTTP 200, HTTP 401, HTTP 5xx, timeout, bad body, no throw | US-002 |
| `.agro/scripts/__tests__/typesafe.test.ts` | `--check` empty key, `--check` configured key, no request | US-003 |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | typesafe judge, per-prompt fallback, empty key equals lexicon, redaction before judge | US-004 |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | diagnostic line, exit 0, equal signals, `node:`-only imports | US-005 |
| `.agro/evals/probes/compose-env-boundary.sh` | existing | Key stays out of compose |
| `.agro/evals/probes/prompt-miner-schema-compat.sh` | existing | Engine parse regression |

Write each failing test first. Then implement the story.

## Design Principles

- Code is the source of truth. Add no explanatory comments to tracked code.
- One source of truth for the HTTP contract: `.agro/scripts/typesafe.mjs`.
- Fail loudly, then continue: name the cause and the fix, exit 0, use the fallback.
- No silent fallback and no crash.
- Zero runtime dependencies for control-plane scripts.
- Smallest change: one adapter, one consumer, one probe.

## Out of Scope

- Skill suggestion through `UserPromptSubmit`. This work needs `/architect` and an ADR.
- Model-assisted guard hooks. These hooks sit on a security boundary with adversarial input.
- `/wiki query` reranking. `references/query.md` forbids this reranking.
- Tier-B behavioral evals.
- Other consumers: `simplicity-review.json`, `ui-evidence.json`, `delegate-graph.json`, the capability triad, and the `/retro` hypothesis table.
- Conversion of the shell snippets in `audit skills`, `audit context`, `audit eval-quality`, and `wiki query` to `.sh` files.
- A compose `environment:` entry for `TYPESAFE_API_KEY`.

## Open Questions

1. The request body and the response body of `POST https://api.typesafe.ai/v1/systemone` stay unverified. The US-002 implementer reads `https://docs.typesafe.ai/api.md` and records `<request body>`, `<response body>`, and `<auth header>`.
2. Confirm the opt-in default. Option A: `--judge typesafe` stays opt-in (this plan). Option B: a non-empty `TYPESAFE_API_KEY` selects the typesafe judge.
3. Confirm the adapter timeout value: `<timeout ms>`.
4. Confirm the exact question text for the correction judgment: `<correction question>`.
5. Confirm the process that exports `TYPESAFE_API_KEY` from the root dotenv into an agent shell in the sandbox: `<env export path>`.
6. Confirm whether `mifunedev/agro-web` needs a page for `TYPESAFE_API_KEY` and `--judge typesafe`.

## Acceptance Criteria

- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.
- [ ] `bash .agro/evals/probes/typesafe-absent-fallback.sh` exits 0.
- [ ] `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.
- [ ] `bash .agro/evals/probes/prompt-miner-schema-compat.sh` exits 0.
- [ ] `git grep -n TYPESAFE_API_KEY -- .devcontainer` prints no line.
- [ ] `.agro/cli/package.json` holds no new `dependencies` entry, and root `package.json` holds no TypeSafe package.

## Lessons

Filled by the advisor before undraft.
