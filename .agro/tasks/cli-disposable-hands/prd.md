# PRD: agro CLI disposable hands

Status: DRAFT

## User Stories

### US-001: Create a disposable node with agro node create

**Description:** As a console user, I want `agro node create --disposable` to request a disposable node. I then get a hand with no data volume without a call to the raw API.

**Acceptance Criteria:**

- [ ] `agro node create --disposable` sends `"disposable": true` in the `POST /api/nodes` body. Without the flag, the body holds no `disposable` key.
- [ ] After a credit refusal, the free `n4` retry of `createConsoleNode` keeps `"disposable": true`.
- [ ] When the console answers HTTP 422 `DISPOSABLE_PROFILE_UNSUPPORTED`, the command prints `only a sandbox node can be disposable: drop --disposable, or use --profile sandbox` to stderr and exits 1.
- [ ] The CLI sends the request for `--profile agro --disposable`, and the console refuses the request. The CLI adds no local profile rule.
- [ ] The `create` help text in `.agro/cli/src/commands/node.ts` names `--disposable` and states these rules:
  - A disposable node has no data volume.
  - Pause, resume, fork, snapshot, convert, and disk grow return HTTP 409 `NODE_DISPOSABLE`.
  - `agro node delete <id>` deletes the node.
  - The platform deletes a running disposable node at the end of the credit grace window after the low-balance email.
  - The platform also deletes a running disposable node at the end of the free-tier allowance.
- [ ] Tests in `.agro/cli/src/__tests__/node.test.ts` fail before the change and pass after the change. The tests cover the body with and without the flag, the free `n4` retry, and the HTTP 422 line.
- [ ] `npm run typecheck` exits 0.

### US-002: Create a disposable hand and explain the refused verbs in agro hands

**Description:** As a brain, I want `agro hands create --disposable` and a clear line for each verb that a disposable hand refuses. I then create a short-lived hand and know how to delete the hand.

**Acceptance Criteria:**

- [ ] `HandRequest` in `.agro/cli/src/lib/hands/provider.ts` gets the optional boolean `disposable`. The console provider sends `"disposable": true` when the request sets it.
- [ ] `agro hands create --disposable` creates a disposable hand through the console provider.
- [ ] With `hands.provider` `exedev`, `agro hands create --disposable` exits 1 before any provider call and prints `--disposable applies only to console hands`.
- [ ] When the console answers HTTP 409 `NODE_DISPOSABLE` to `agro hands pause`, `agro hands resume`, or `agro hands fork`, the command prints `hand <ref> is disposable and cannot <verb>: delete it with agro hands destroy <ref>` to stderr and exits 1.
- [ ] Any other refusal keeps its current message.
- [ ] The `create` help text in `.agro/cli/src/commands/hands.ts` names `--disposable`, the console-only rule, the refused verbs, the delete command, and the deletion rule of US-001.
- [ ] `CHANGELOG.md` `## [Unreleased]` lists the flag under `### Added`. The entry names `--disposable`, HTTP 409 `NODE_DISPOSABLE`, HTTP 422 `DISPOSABLE_PROFILE_UNSUPPORTED`, and the deletion rule.
- [ ] `docs/lifecycle-commands.md` stays unchanged.
- [ ] Tests in `.agro/cli/src/commands/__tests__/hands.test.ts` and the console provider tests in `.agro/cli/src/__tests__/node.test.ts` fail before the change and pass after the change.
- [ ] `npm run typecheck` exits 0.

### US-003: Capture the manual review transcript

**Description:** As the reviewer, I want a command transcript of each disposable path. The PR then shows the behavior.

**Acceptance Criteria:**

- [ ] `.agro/tasks/cli-disposable-hands/evidence/manual-review.md` records these commands through `node .agro/cli/dist/agro.js` after `npm --prefix .agro/cli run build`, against a local stub console:
  - `node create --disposable`, with the request body that the stub received;
  - `node create --profile agro --disposable`, with the HTTP 422 line;
  - `hands pause`, `hands resume`, and `hands fork` on a disposable hand, each with the HTTP 409 line.
- [ ] The story commits the stub source as `evidence/stub-console.mjs`. The story adds each evidence file with `git add -f`, because `.gitignore` ignores task evidence.
- [ ] Before the run, the story checks that the stub port is free. If the port is busy, the story sets `blocked`, names the process, and stops no process.
- [ ] The story passes each environment value inline and uses a throwaway token. The story writes no env file and no credentials file. The story deletes its temp directory after the run.
- [ ] `external` After the agro release, the operator approves one live run. The run creates one disposable hand on agro-console, records the refused `pause`, and deletes the hand.

## Summary

Verified current state:

- The agro-console PR mifunedev/agro-console#786 (merged at `a1f08900`) adds the optional boolean `disposable` to `POST /api/nodes`, with the default `false`. The console refuses a create with `"profile": "agro"` and `"disposable": true` with HTTP 422 `DISPOSABLE_PROFILE_UNSUPPORTED`. On a disposable hand, pause, resume, disk grow, fork, snapshot create, and snapshot restore return HTTP 409 `NODE_DISPOSABLE`. Restart and delete work. At the end of the credit grace window or the free-tier allowance, the platform deletes a running disposable hand. According to the agro-console docs, `agro node create` has no `--disposable` flag yet.
- `.agro/cli/src/commands/node.ts` `parseCreate` accepts `--spec`, `--ssh-key`, `--name`, `--profile`, `--json`, and the app flags. `runCreate` calls `createConsoleNode` in `.agro/cli/src/lib/console-api.ts`, which spreads the body into the free `n4` retry.
- `agro node` has no pause, resume, fork, snapshot, convert, or disk verb. `agro hands` has `pause`, `resume`, and `fork`. The console provider sends them through `act` and `fork` in `.agro/cli/src/lib/hands/console-provider.ts`.
- `HandRequest` holds `name` and `spec`. `runHands` already refuses `--spec` for `exedev` with `SPEC_REFUSAL`.
- `docs/lifecycle-commands.md` is a hashed instruction file of the sandbox routing replay (`.agro/scripts/__tests__/helpers/sandbox-routing.ts`). This task does not edit the file.

Approach: one flag, `--disposable`, maps to the API field. The console owns the profile rule and the refused verbs. The CLI maps the two codes to lines that name the delete command.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/node.ts` | `parseCreate`, `CreateArgs`, `runCreate`, `nodeHelp` | Flag, request body, HTTP 422 line, help |
| `.agro/cli/src/lib/console-api.ts` | `createConsoleNode` | Free `n4` retry keeps the body |
| `.agro/cli/src/lib/hands/provider.ts` | `HandRequest` | `disposable` field |
| `.agro/cli/src/lib/hands/console-provider.ts` | `create`, `fork`, `act` | Request body, HTTP 409 line |
| `.agro/cli/src/commands/hands.ts` | `parseCreate`, `runCreate`, `runHands`, `handsHelp` | Flag, exedev refusal, help |
| `.agro/cli/src/__tests__/node.test.ts` | node create tests, console provider tests | Tests |
| `.agro/cli/src/commands/__tests__/hands.test.ts` | hands create, pause, resume, fork tests | Tests |
| `CHANGELOG.md` | `## [Unreleased]` | Changelog entry |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro node create --disposable` | New flag | Sends `"disposable": true`; HTTP 422 line |
| `agro hands create --disposable` | New flag | Console provider only |
| `agro hands pause`, `resume`, `fork` | Changed error | HTTP 409 `NODE_DISPOSABLE` line with the delete command |

## Storage

N/A. The CLI stores no state for this flag.

## Architectural Decisions

- agro-console owns the disposable rules. The CLI sends the field and maps the two codes. The CLI adds no local profile rule.
- The flag name `--disposable` matches the API field `disposable`.
- `agro hands fork` sends no `disposable` field. A fork of a disposable hand gets HTTP 409 from the console.
- The CLI has no snapshot, convert, or disk verb. The help text states the HTTP 409 rule for those paths, and no CLI code handles them.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/node.test.ts` | body with and without `--disposable`, free `n4` retry keeps the field, HTTP 422 line, help | US-001 |
| `.agro/cli/src/commands/__tests__/hands.test.ts` | `create --disposable`, exedev refusal, HTTP 409 on `pause`, `resume`, `fork`, other refusals unchanged | US-002 |
| `.agro/cli/src/__tests__/node.test.ts` | console provider sends `disposable`, maps HTTP 409 | US-002 |

Run `npx vitest run .agro/cli/src/__tests__/node.test.ts .agro/cli/src/commands/__tests__/hands.test.ts` and `npm run typecheck`.

## Design Principles

- Keep the smallest change: one flag, two error lines, help text, and a changelog entry.
- Keep the console as the source of truth for the rules.
- Keep stdout machine-readable under `--json`. Error lines go to stderr.
- Add no explanatory comments to tracked code (AGENTS.md § 5).

## Out of Scope

- Any edit of `docs/lifecycle-commands.md`. The file is a hashed routing instruction file.
- A disposable column in `agro node list` or `agro hands list`.
- Snapshot, convert, and disk verbs in the CLI.
- The exedev provider. exe.dev has no disposable field.

## Open Questions

None.

## Acceptance Criteria

- [ ] `npx vitest run` and `npm run typecheck` exit 0, apart from the 7 baseline failures in `.agro/scripts/__tests__/herdr-default.test.ts`.
- [ ] `docs/lifecycle-commands.md` stays unchanged, and `.agro/scripts/__tests__/sandbox-routing.test.ts` passes.
- [ ] Each refused path names the delete command.

## Lessons

1. A line-number fix for an STE finding overwrote the US-002 description in `prd.md`, and the `prd.json` conversion then merged US-002 into US-003. Evidence: commit `e3d991ad` restores the description and regenerates `prd.json`. Outcome: fixed in this PR; the advisor now checks the story and criterion counts after each conversion.
2. The CLI has no snapshot, convert, or disk verb, so the HTTP 409 `NODE_DISPOSABLE` rule for those paths lives only in the help text. Evidence: `agro node --help` and `agro hands --help`. Outcome: dropped; the supervisor accepted help text for those operations.
3. The usage lines of `agro node create` and `agro hands create` in `docs/lifecycle-commands.md` do not show `--disposable`. Evidence: the file stays unchanged because the sandbox routing replay hashes the file. Outcome: dropped; the supervisor kept the file unchanged, and the CLI help and `CHANGELOG.md` state the flag.
4. `herdr-default.test.ts` fails 7 tests on this host. Evidence: the same 7 tests fail on `origin/development` `ef52a983`. Outcome: dropped; baseline failure outside this change.
