# PRD: TypeSafe judgment adapter with a prompt-miner consumer

Status: BLOCKED

## User Stories

### US-001: Register `TYPESAFE_API_KEY` as a secret

**Description:** As an operator, I want `TYPESAFE_API_KEY` in the secret allow-list so that `agro secret set TYPESAFE_API_KEY` stores the key in `.env` and never renders the key into Compose.

**Acceptance Criteria:**

- [ ] `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` contains `"TYPESAFE_API_KEY"`.
- [ ] The allow-list test in `.agro/cli/src/lib/__tests__/secrets.test.ts` lists `"TYPESAFE_API_KEY"` and passes.
- [ ] `.example.env` holds a commented-out `# TYPESAFE_API_KEY=` line under a TypeSafe section header.
- [ ] No `.devcontainer/docker-compose*.yml` file contains the string `TYPESAFE_API_KEY`.
- [ ] `bash .agro/evals/probes/compose-env-boundary.sh` exits 0.
- [ ] `docs/configuration.md` lists `TYPESAFE_API_KEY` beside the other secret keys.

### US-002: Add the zero-dependency adapter `.agro/scripts/typesafe.mjs`

**Description:** As a control-plane script author, I want one adapter over `POST https://api.typesafe.ai/v1/systemone` so that each consumer gets typed answers or one named fallback reason.

**Acceptance Criteria:**

- [ ] `.agro/scripts/typesafe.mjs` imports only `node:` built-in modules.
- [ ] The adapter exports an async function that takes `state` and `questions` and sends `model: "jev-latest"`.
- [ ] The adapter sends the header `Authorization: Bearer <TYPESAFE_API_KEY>` and the header `Content-Type: application/json`.
- [ ] If `TYPESAFE_API_KEY` is unset or empty, the adapter makes no HTTP request and returns the reason `unconfigured`.
- [ ] If the endpoint returns HTTP 401 or HTTP 403, the adapter returns the reason `unauthorized`.
- [ ] If the endpoint returns another non-2xx status, the adapter returns the reason `http-<status>`.
- [ ] If the request exceeds `<timeout ms>` or the network fails, the adapter returns the reason `unreachable`.
- [ ] If the response body lacks an answer for a requested question ID, the adapter returns the reason `malformed-response`.
- [ ] The adapter never throws to its caller and never writes the key value to stdout or stderr.
- [ ] `node .agro/scripts/typesafe.mjs --check` exits 0 in every case.
- [ ] If the key is unset, `--check` prints one stderr line that names `TYPESAFE_API_KEY` and the command `agro secret set TYPESAFE_API_KEY`.
- [ ] `.agro/scripts/README.md` lists `typesafe.mjs` in its script table.

### US-003: Judge `correctionDensity` with TypeSafe in `mine-traces.mjs`

**Description:** As a `/prompt-miner` user, I want each follow-up prompt judged by a TypeSafe Noul question so that casual clarifications stop counting as corrections.

**Acceptance Criteria:**

- [ ] If the operator passes `<opt-in flag>` and the adapter returns answers, the engine counts a follow-up as corrective when its Noul value is at least `<noul threshold>`.
- [ ] If the adapter returns a fallback reason, the engine counts corrective follow-ups with `NEGATION_LEXICON`, exactly as today.
- [ ] On fallback, the engine prints one stderr line that names the reason and the fix, and the exit code stays unchanged.
- [ ] `manifest.correctionJudge` holds `"typesafe"` or `"lexicon"` in every dataset.
- [ ] `manifest.correctionJudgeFallback` holds the fallback reason, or `null` when TypeSafe answered.
- [ ] The engine sends each follow-up through `redact()` before the adapter receives it.
- [ ] With `--no-git` and no `<opt-in flag>`, the engine sends no HTTP request.
- [ ] `references/scoring.md` and `references/report-schema.md` describe the judge, the fallback, and the two manifest fields.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.

### US-004: Add the TypeSafe preflight to the prompt-miner skill

**Description:** As a `/prompt-miner` user, I want a TypeSafe preflight before Step 1 so that a missing key shows a named diagnostic, not a 401.

**Acceptance Criteria:**

- [ ] `.agro/skills/prompt-miner/SKILL.md` holds a preflight step ahead of Step 1 that runs the `--check` mode of `.agro/scripts/typesafe.mjs`.
- [ ] The preflight step states that an unconfigured result continues the run with the lexicon judge.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0 after the change.

### US-005: Add the absent-TypeSafe probe

**Description:** As a maintainer, I want a deterministic probe that proves AGRO behaves exactly as today without TypeSafe so that the fallback contract cannot regress.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/typesafe-absent-fallback.sh` declares the `# tier:`, `# source:`, and `# desc:` headers.
- [ ] The probe unsets `TYPESAFE_API_KEY` and runs `mine-traces.mjs --dry-run --no-git --fixtures-dir <fixtures>` with the opt-in flag.
- [ ] The probe exits 0 only if the engine exits 0, `manifest.correctionJudge` equals `"lexicon"`, and every `correctionDensity` equals the value of a run without the flag.
- [ ] The probe exits 1 if stderr lacks the `TYPESAFE_API_KEY` diagnostic.
- [ ] The probe runs `node .agro/scripts/typesafe.mjs --check` with the key unset and exits 1 unless the exit code is 0.
- [ ] The probe completes in less than 30 seconds and makes no network request.
- [ ] A deliberately broken copy of the adapter that throws on a missing key drives the probe to exit 1.

## Summary

AGRO validates many schema'd envelopes, but an agent produces each value from prose. This task adds one path for a calibrated, typed judgment. The path fills one existing value slot and keeps the deterministic default.

Verified current state:

- `.agro/skills/prompt-miner/scripts/mine-traces.mjs:22` defines `NEGATION_LEXICON` with 12 entries.
- `aggregateSession()` at `mine-traces.mjs:309` counts follow-ups that match the lexicon.
- `references/scoring.md` names `correctionDensity` as the highest-variance signal.
- `run()` is async, so an awaited judge call fits the current control flow.
- `SECRET_KEYS` in `.agro/cli/src/lib/secrets.ts` holds 8 keys.
- `config-render.ts:55` refuses to render any key in `SECRET_KEYS`.
- `compose-env-boundary.sh` rejects any Compose `environment:` key outside the rendered set and its literal list.
- The TypeSafe HTTP API returns `answers.<id>.noul` as a number from 0 to 1 for a `noul` question. The source is `https://docs.typesafe.ai/api.md`, read on 2026-09-26.
- `.agro/skills/typesafe-ai/SKILL.md` exists. No script in the repository calls TypeSafe today.

Selected approach: the adapter lives in `.agro/scripts/` because `.agro/manifest.json` ships `scripts/**`. The adapter uses the global `fetch` of Node 20, so the adapter adds no runtime dependency. The engine asks one Noul question per follow-up prompt. The engine batches the questions of one session into one request. The engine keeps the lexicon path as the fallback and records which judge ran.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/secrets.ts` | `SECRET_KEYS` | Secret allow-list; keeps the key out of Compose |
| `.example.env` | TypeSafe section | Operator template for the key |
| `docs/configuration.md` | secret key list, line 171 | Operator reference |
| `.agro/scripts/typesafe.mjs` | new adapter export, `--check` mode | HTTP client and fallback reasons |
| `.agro/scripts/README.md` | script table | Script index |
| `.agro/skills/prompt-miner/scripts/mine-traces.mjs` | `aggregateSession()`, `run()`, `parseArgs()`, `manifest` | Consumer of the judgment |
| `.agro/skills/prompt-miner/SKILL.md` | new preflight step | Up-front diagnostic |
| `.agro/skills/prompt-miner/references/scoring.md` | `correctionDensity`, negation lexicon section | Scoring contract |
| `.agro/skills/prompt-miner/references/report-schema.md` | `manifest` table | Dataset contract |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | new probe | Absent-TypeSafe regression guard |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro secret set TYPESAFE_API_KEY` | New accepted key | The command writes the key to `.env` |
| `node .agro/scripts/typesafe.mjs --check` | New CLI mode | The mode prints the TypeSafe state and exits 0 |
| `mine-traces.mjs <opt-in flag>` | New flag | The flag selects the TypeSafe judge |
| prompt-miner dataset `manifest` | New fields | `correctionJudge` and `correctionJudgeFallback` |
| `mifunedev/agro-web` public docs | Documentation | The public site lists the new secret key. Open question 5 confirms the need. |

## Storage

The key persists in the gitignored `.env` at the repository root through the existing `setSecret()` path. The adapter keeps no cache and writes no file. The prompt-miner reports stay in `$TMPDIR`, as today.

## Architectural Decisions

- `.agro/scripts/typesafe.mjs` is the single owner of the endpoint URL, the model name, the auth header, and the fallback reasons.
- Each consumer owns its questions, its threshold, and its deterministic fallback.
- The adapter reads the key from `process.env.TYPESAFE_API_KEY`. The operator decides in open question 2 whether the adapter also reads `.env`.
- The key stays out of every Compose `environment:` block. `SECRET_KEYS` membership enforces this through `config-render.ts`.
- The contract is "fail loudly, then continue": a named diagnostic, exit 0, and the deterministic fallback.
- Host and sandbox: the adapter and the engine run inside the sandbox. The CLI secret change runs on the host.
- Canonical and provider surfaces: all skill edits land in `.agro/skills/`. Provider directories change only through symlinks.
- Interactive and headless processes: not applicable. The task adds no persistent process.
- Parallel operation: the adapter holds no shared mutable state.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/__tests__/secrets.test.ts` | allow-list equality includes `TYPESAFE_API_KEY` | US-001 |
| `.agro/cli/src/lib/__tests__/config-render.test.ts` | existing secret-refusal cases cover the new key | US-001 |
| `.agro/scripts/__tests__/typesafe.test.ts` | unset key, 401, 500, timeout, malformed body, success, key never logged, no non-`node:` import | US-002 |
| `.agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` | injected judge success, injected judge fallback, redaction before send, manifest fields, lexicon parity without the flag | US-003 |
| `.agro/evals/probes/typesafe-absent-fallback.sh` | unset key with opt-in flag; `--check` exit code; fault injection | US-005 |
| `.agro/evals/probes/compose-env-boundary.sh` | existing probe stays green | US-001 |

Run `pnpm test` for the Vitest suites. Run `node --test` for the prompt-miner suite. Run `/eval` for the probes.

## Design Principles

- Code is the source of truth. Add no explanatory comments to tracked code.
- Keep `.agro/cli` free of runtime dependencies. Use the HTTP API, not the npm SDK.
- Keep the deterministic path as the default and as the fallback.
- Never fall back in silence. Record the judge in the dataset and name the cause on stderr.
- Send no transcript text to an external service without an explicit operator opt-in.
- Make the adapter testable without the network. Inject the fetch function or the judge.

## Out of Scope

- Skill suggestion through `UserPromptSubmit`. This change needs `/architect` and an ADR.
- Model-assisted guard hooks. These hooks cross a security boundary.
- `/wiki query` reranking. `references/query.md` forbids it.
- Tier-B behavioral evals.
- Other value slots: `simplicity-review.json`, `ui-evidence.json`, `delegate-graph.json`, the capability triad, and the `/retro` hypothesis table.
- `.sh` scripts for the prose-specified shell snippets in `audit skills`, `audit context`, `audit eval-quality`, and `wiki query`.
- A calibration study of the Noul threshold against a hand-labeled sample.

## Open Questions

1. Privacy and opt-in. The prompt-miner privacy contract forbids raw prompt text in default output. TypeSafe receives follow-up prompt text. Pick one:
   - A. TypeSafe runs only with an explicit flag, `<opt-in flag>`. The engine redacts text before each send. (Recommended.)
   - B. TypeSafe runs whenever `TYPESAFE_API_KEY` is set.
   - C. Other: `<specify>`.
2. Key source. `.env` values do not reach sandbox shells unless the operator runs `set -a; source .env`. Pick one:
   - A. The adapter reads `process.env` only. The diagnostic names the `source` step.
   - B. The adapter reads `process.env`, then reads the harness `.env` file.
3. Threshold. Supply `<noul threshold>` for the corrective decision. The value 0.5 is a guess until a hand-labeled sample confirms it.
4. Timeout and batch size. Supply `<timeout ms>` and the maximum number of questions per request.
5. Public documentation. Confirm whether `mifunedev/agro-web` needs a matching change for the new secret key.
6. Registry portability. Confirm whether `prompt-miner` ships to the `mifunedev/skills` registry. If it ships, an import of `.agro/scripts/typesafe.mjs` fails `registry-portability.sh`.

## Acceptance Criteria

- [ ] Each story in this plan passes its acceptance criteria.
- [ ] `pnpm test` exits 0.
- [ ] `node --test .agro/skills/prompt-miner/scripts/__tests__/mine-traces.test.mjs` exits 0.
- [ ] `/eval` reports no REGRESSION, and `typesafe-absent-fallback.sh` reports PASS.
- [ ] With `TYPESAFE_API_KEY` unset, the prompt-miner dry run on the fixtures produces the same `correctionDensity` values as the run on the base commit.
- [ ] `.agro/cli/package.json` gains no new `dependencies` entry.

## Lessons

Filled by the advisor before undraft.
