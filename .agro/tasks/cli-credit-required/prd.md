# PRD: agro CLI credit handling

Status: DRAFT

## User Stories

### US-001: Fall back to a free n4 on a credit refusal, or print the top-up link

**Description:** As a console user, I want `agro node create` and `agro hands create` to handle a credit refusal. I then get a free `n4` when I am eligible and a top-up link otherwise.

**Acceptance Criteria:**

- [ ] `createConsoleNode` in `.agro/cli/src/lib/console-api.ts` treats HTTP 403 `PAYMENTS_DISABLED` and HTTP 402 `CREDIT_REQUIRED` as credit refusals. One exported constant lists both pairs. `FREE_TIER_FALLBACK_CODE` is gone.
- [ ] After a credit refusal, `createConsoleNode` sends `GET /api/free-tier`. When the body holds `eligible: true`, the function prints the existing notice and sends one more `POST /api/nodes` with `spec: "n4"` and `freeTier: true`.
- [ ] When the body holds `eligible: false`, the function sends no second `POST`. The function prints `top up credit at <console url>/billing` to stderr and returns the first refusal.
- [ ] When `GET /api/free-tier` fails, the function sends the free `n4` retry. The console then decides the eligibility. This rule keeps `agro hands create` working, because a brain token cannot read `/api/free-tier`.
- [ ] When the free `n4` retry fails, the function prints the top-up line to stderr and returns the retry failure.
- [ ] Any other refusal returns after the first request, with no `GET /api/free-tier` and no top-up line. The existing tests for HTTP 403 `FREE_TIER_INELIGIBLE` and HTTP 400 `PAYMENTS_DISABLED` keep their assertions.
- [ ] With `--json`, stdout holds only the one JSON line. Each notice and the top-up line go to stderr.
- [ ] The `create` help text in `.agro/cli/src/commands/node.ts` names both refusals and the top-up link.
- [ ] Tests in `.agro/cli/src/__tests__/node.test.ts` and `.agro/cli/src/commands/__tests__/hands.test.ts` fail before the change and pass after the change. The tests cover 402 eligible, 402 not eligible, 403 eligible, an eligibility read failure, and a failed retry.
- [ ] `npm run typecheck` exits 0.

### US-002: Show the org credit state in agro node check

**Description:** As a console user, I want `agro node check` to report the credit state of the org. I then know whether a paid spec can start before I create a node.

**Acceptance Criteria:**

- [ ] `agro node check` sends `GET /api/billing/balance` and still sends only `GET` requests.
- [ ] When `paymentsEnabled` is `false`, the command prints `ok credit: payments are off`.
- [ ] When `balanceMicros` is above 0, the command prints `ok credit: balance $<amount>`, with the amount in USD to 2 decimals. The line adds `, auto top-up on` when `autoTopup` is not `null`.
- [ ] When `balanceMicros` is 0 or less and `autoTopup` is `null`, the command prints `warn credit: no credit (balance $<amount>) — top up at <console url>/billing`.
- [ ] When `balanceMicros` is 0 or less and `autoTopup` is not `null`, the command prints `ok credit: balance $<amount>, auto top-up on`.
- [ ] When the read fails, the command prints `warn credit: <message>`. A console without the route answers HTTP 404, and the line names that answer.
- [ ] No credit line changes the exit status. The command still exits 1 only on a `fail` line.
- [ ] The `check` help text in `.agro/cli/src/commands/node.ts` names the credit line.
- [ ] Tests in `.agro/cli/src/__tests__/node.test.ts` cover each line above and the GET-only rule.
- [ ] `npm run typecheck` exits 0.

### US-003: Document the credit handling

**Description:** As a reader, I want the docs and the changelog to state the credit handling. The published behavior then matches the CLI.

**Acceptance Criteria:**

- [ ] The `agro node` section of `docs/lifecycle-commands.md` states HTTP 402 `CREDIT_REQUIRED`, HTTP 403 `PAYMENTS_DISABLED`, the free `n4` rule, the top-up line, and the credit line of `agro node check`.
- [ ] The `agro hands` section of `docs/lifecycle-commands.md` states the credit refusal rule of `agro hands create` and the top-up line.
- [ ] `docs/lifecycle-commands.md` states that `agro hands list` shows no credit state, because a brain token cannot read `/api/billing/balance`.
- [ ] `CHANGELOG.md` `## [Unreleased]` lists the change under `### Changed`. The entry names `CREDIT_REQUIRED` and the top-up line.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on `docs/lifecycle-commands.md`.
- [ ] `AGENTS.md` stays unchanged.

### US-004: Capture the manual review transcript

**Description:** As the reviewer, I want a command transcript of each credit path so that the PR shows the behavior.

**Acceptance Criteria:**

- [ ] `.agro/tasks/cli-credit-required/evidence/manual-review.md` records `node .agro/cli/dist/agro.js node create --spec n8` against a local stub console after `npm --prefix .agro/cli run build`. The transcript shows four cases: 402 then eligible, 402 then not eligible, 403 `PAYMENTS_DISABLED` then eligible, and a failed retry. Each case lists the requests that the stub received.
- [ ] The transcript records `node .agro/cli/dist/agro.js node check` against the stub for each credit line of US-002.
- [ ] The stub binds a free loopback port. Before the run, the story checks that the port is free. If the port is busy, the story sets `blocked`, names the process, and stops no process.
- [ ] The story passes `AGRO_CONSOLE_URL` and `AGRO_CONSOLE_TOKEN` inline. The token is a throwaway value. The story writes no env file and no credentials file. The stub lives under a new temp directory, and the story deletes that directory after the run.
- [ ] `external` With operator approval, the story runs `agro node check` once against a live agro-console with an operator token, and records the credit line. That run creates nothing.

## Summary

Verified current state on `origin/development` `ef52a983`:

- `.agro/cli/src/lib/console-api.ts:9` sets `FREE_TIER_FALLBACK_CODE = "PAYMENTS_DISABLED"`. `createConsoleNode` (line 239) retries `n4` with `freeTier: true` only after HTTP 403 with that code (line 247).
- `agro node create` (`.agro/cli/src/commands/node.ts:225`) and the console hands provider (`.agro/cli/src/lib/hands/console-provider.ts:95`) call `createConsoleNode`.
- `agro node check` (`runCheck`, line 401) reads `GET /api/free-tier` in `checkFreeTier` (line 386). The command prints `ok`, `warn`, and `fail` lines and exits 1 only on a `fail` line.
- agro-console (`origin/development`, after mifunedev/agro-console#768) answers HTTP 402 `CREDIT_REQUIRED` for a paid create of an org with no credit and no auto top-up. While `features.payments` is `false`, the console answers HTTP 403 `PAYMENTS_DISABLED` for an org without billing exemption.
- `docs/api-tokens.md` of agro-console lists `GET /api/billing/balance` (viewer, `CreditAccountResponse`) and `GET /api/free-tier` (viewer) for API tokens. `CreditAccountResponse` holds `balanceMicros`, `hasCard`, `paymentsEnabled`, `canManage`, and `autoTopup` (`{ amountUsd, thresholdUsd }` or `null`). The console top-up page is `/billing`.
- The brain token allowlist of agro-console (`BRAIN_TOKEN_ROUTES`) holds only node routes. A brain token cannot read `/api/billing/balance` or `/api/free-tier`.

Approach: one credit-refusal rule in `createConsoleNode` serves both `agro node create` and `agro hands create`. An eligibility read gates the free retry. A failed read keeps the current retry, so a brain keeps its current behavior. `agro node check` gets one credit line from `GET /api/billing/balance`. `agro hands list` gets no credit state. The docs and Lessons record that gap.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/console-api.ts` | `FREE_TIER_FALLBACK_CODE`, `createConsoleNode`, `callApi`, `DEFAULT_CONSOLE_URL` | Credit refusal rule, eligibility read, top-up line |
| `.agro/cli/src/commands/node.ts` | `nodeHelp`, `runCreate`, `checkFreeTier`, `runCheck` | Help text, credit line of `check` |
| `.agro/cli/src/lib/hands/console-provider.ts` | `create` | Hands create through `createConsoleNode` |
| `.agro/cli/src/__tests__/node.test.ts` | `PAYMENTS_DISABLED` reply, fallback and check tests | Node create and check tests |
| `.agro/cli/src/commands/__tests__/hands.test.ts` | `agro hands create` tests | Hands create with a brain token |
| `docs/lifecycle-commands.md` | `agro node` and `agro hands` sections | User docs |
| `CHANGELOG.md` | `## [Unreleased]` | Changelog entry |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro node create` | Changed | Free `n4` fallback on HTTP 402 `CREDIT_REQUIRED` as well as HTTP 403 `PAYMENTS_DISABLED`, gated by the free tier eligibility; top-up line otherwise |
| `agro hands create` | Changed | Same rule; the eligibility read fails for a brain token, so the free retry runs as today |
| `agro node check` | Changed | New `credit` line |
| `agro hands list` | Unchanged | No credit state; the brain token cannot read the balance |

## Storage

N/A. The CLI stores no credit state. Each command reads the console API.

## Architectural Decisions

- agro-console owns the credit state and the free tier rules. The CLI reads `/api/free-tier` and `/api/billing/balance` and never computes eligibility.
- One exported constant lists the credit refusals. `createConsoleNode` is the one place that applies the rule.
- A failed eligibility read keeps the free retry. The console still refuses an ineligible account with HTTP 403 `FREE_TIER_INELIGIBLE`.
- The CLI builds the top-up link as `<console url>/billing` from the resolved console URL.
- A credit line is `ok` or `warn`, never `fail`. Credit does not block a free node.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/node.test.ts` | 402 eligible, 402 not eligible, 403 eligible, eligibility read failure, failed retry, other refusals unchanged, `--json` stdout | US-001 |
| `.agro/cli/src/commands/__tests__/hands.test.ts` | 402 with a brain token: eligibility read refused, free retry sent | US-001 |
| `.agro/cli/src/__tests__/node.test.ts` | payments off, balance above 0, no credit, auto top-up, read failure, HTTP 404, GET only, exit status | US-002 |

Run the tests with `npx vitest run .agro/cli/src/__tests__/node.test.ts .agro/cli/src/commands/__tests__/hands.test.ts`. Run `npm run typecheck`.

## Design Principles

- Keep the smallest change: one rule, one constant, one new check line.
- Keep the console as the source of truth for credit and eligibility.
- Keep stdout machine-readable under `--json`. Notices go to stderr.
- Add no explanatory comments to tracked code (AGENTS.md § 5).

## Out of Scope

- The `--disposable` flag. The flag waits for agro-console E7.
- A credit state in `agro hands list`. agro-console must first allow a brain token to read `/api/billing/balance`.
- A top-up from the CLI. The CLI prints the link only.
- The `--disk` flag of ADR mifunedev/agro-console#775.
- A glossary term in `AGENTS.md`. The root contract holds no CLI billing detail (supervisor decision, 2026-11-15).

## Open Questions

None.

## Acceptance Criteria

- [ ] `npx vitest run` and `npm run typecheck` exit 0.
- [ ] No CLI path creates a paid node after a credit refusal.
- [ ] Each credit refusal ends in a free `n4` or a top-up line.
- [ ] `agro node check` stays GET-only.

## Lessons
