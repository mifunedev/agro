# PRD: agro hands create --desktop parity and --count

Status: APPROVED

Issue: [#1676](https://github.com/mifunedev/agro/issues/1676)

## User Stories

### US-001: Align --desktop with the agro-console Desktop option

**Description:** As an operator on a brain, I want `agro hands create --desktop` to match the agro-console Desktop option. The CLI sends the same tools and applies the same spec rule, so that a desktop hand from the CLI matches a desktop hand from `/nodes/create`.

**Acceptance Criteria:**

- [ ] With `--desktop` and the profile `sandbox` (the default), the create request body has `tools: ["agro", "docker", "desktop"]` and no `docker` field.
- [ ] With `--desktop --profile agro`, with or without `--docker`, the create request body has `tools: ["docker", "desktop"]` and no `docker` field.
- [ ] With brain authority, `--desktop --profile agro` sends `tools: ["agro", "docker", "desktop"]`, because the console forces the profile `sandbox` for brain authority.
- [ ] Without `--desktop`, the create request body has no `tools` field, as before.
- [ ] `--desktop --spec n2` exits 1 with `agro hands create: the desktop needs at least n4 (4 GB); use --spec n4 or larger (n8 recommended)` and sends no console request.
- [ ] `--desktop` without `--spec` sends no `spec` field. The console default spec `n4` supports the desktop.
- [ ] The console refusals HTTP 422 `SPEC_TOO_SMALL_FOR_TOOL` and HTTP 503 `DESKTOP_IMAGE_UNAVAILABLE` keep their current lines.
- [ ] The tests in `.agro/cli/src/commands/__tests__/hands.test.ts` § `agro hands create --desktop` pin each body above with the existing fake console, and each test fails before the change.
- [ ] Typecheck passes.

### US-002: Create N console hands with --count

**Description:** As an operator on a brain, I want `agro hands create --count <N>` to create N console hands in one call. Then I can create N desktop gate nodes with one command.

**Acceptance Criteria:**

- [ ] `--count <N>` and `--count=<N>` accept an integer from 1 to 10. The default is 1. Another value exits 1 with `agro hands create: --count must be an integer from 1 to 10` and sends no console request.
- [ ] `--count` applies only to console hands. With the exedev provider, `create --count 2` exits 1 with `agro hands create: --count applies only to console hands` before any provider call.
- [ ] With N greater than 1, `--project` or `--clone` exits 1 with `agro hands create: --count excludes --project and --clone`.
- [ ] With `--name <name>` and N greater than 1, the hands get the names `<name>-1` to `<name>-N` in request order. With N equal to 1, the hand gets `<name>`. Without `--name`, the request has no `name` field.
- [ ] The CLI sends the create requests in sequence. The CLI sends request k+1 only after the console returns a node id for request k. The waits for `running` and the desktop waits run at the same time.
- [ ] When the console refuses request k without a node id, the CLI sends no later request. The CLI prints `agro hands create: hand <k> of <N>: <error>` on stderr.
- [ ] With N equal to 1, the human output and the `--json` output do not change.
- [ ] With N greater than 1 and without `--json`, stdout has one line for each hand with a node id, in request order. The line is `hand <index> alias <alias> status <status> ssh <sshDest or ->`.
- [ ] With N greater than 1 and `--desktop`, each hand line adds `desktop <rdpAddress>` or `desktop not listening`. The desktop next steps print one time after the hand lines.
- [ ] With N greater than 1 and `--json`, stdout has one JSON line for each hand with a node id, in request order. Each JSON line has the fields of the current `--json` line. A hand with a failed wait gets the line with its last status.
- [ ] `--count 3 --desktop` sends three requests, each with the US-001 desktop body.
- [ ] The exit status is 0 only when each of the N hands reaches `running`. Otherwise the exit status is 1. Before the exit, the CLI prints the line of each hand with a node id and one stderr line for each failure. A desktop without xrdp stays a warning, as with N equal to 1.
- [ ] Tests in `.agro/cli/src/commands/__tests__/hands.test.ts` cover each criterion above with the existing fake console. The cases are the bound, the names, the request order, the human lines, and the JSON lines. The cases also include a refusal at request 2 of 3, a wait failure at hand 2 of 3, and the exedev refusal. No test creates a live hand.
- [ ] Typecheck passes.

### US-003: Update help, docs, and CHANGELOG

**Description:** As an operator, I want the help, the docs, and the CHANGELOG to describe `--desktop` and `--count`, so that the published text matches the code.

**Acceptance Criteria:**

- [ ] `agro hands --help` shows `[--count <N>]` in the `create` usage line. The help has a `--count` paragraph with the bound, the names, the output, and the exit status. The `--desktop` paragraph names the US-001 tools and the local `n2` refusal.
- [ ] The help states that `--count` applies only to console hands, in the exedev paragraph.
- [ ] `docs/lifecycle-commands.md` shows the same usage line and describes `--count` and the US-001 `--desktop` tools.
- [ ] `CHANGELOG.md` `## [Unreleased]` has an `### Added` entry for `--count` and a `### Changed` entry for the #1667 `--desktop` change. The `### Changed` entry states the role tools and the local `n2` refusal. Both entries link to #1676.
- [ ] The help test in `.agro/cli/src/commands/__tests__/hands.test.ts` pins the new usage line.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/lifecycle-commands.md` reports no new finding in the changed lines.

### US-004: Capture the manual review transcript

**Description:** As the advisor, I want a command transcript of the built CLI against a local fake console. The PR then shows the behavior through the user entry point, with no live spend.

**Acceptance Criteria:**

- [ ] The worker builds the CLI with `npm --prefix .agro/cli run build`. The worker runs `node .agro/cli/dist/<entry>` with `AGRO_CONSOLE_URL=http://127.0.0.1:<port>` and `AGRO_CONSOLE_TOKEN=fake-token` inline on each command.
- [ ] Before the boot, the worker confirms a free `<port>`. If the port is busy, the worker reports BLOCKED with the holder process and stops no process.
- [ ] The fake console is an untracked script in the worktree scratch area. The fake console answers `POST /api/nodes` and `GET /api/nodes/<id>` and logs each request body. The fake console stops at the end of the run.
- [ ] The transcript is at `.agro/tasks/hands-create-desktop-count/evidence/manual-review.md`. The transcript runs `create --count 2 --desktop --name gate --json`, `create --desktop --spec n2`, `create --count 11`, `--provider exedev create --count 2`, and a refusal at request 2 of 3. Each command shows stdout, stderr, the exit status, and the logged request bodies.
- [ ] No command uses a real token, and no command reaches a live console.

## Summary

Verified current state on `origin/development` (a48c7351):

- `agro hands create --desktop` exists (#1667, unreleased in `CHANGELOG.md`). `toolsField` in `.agro/cli/src/lib/hands/console-provider.ts` sends `tools: ["desktop"]`, or `["docker", "desktop"]` with `--docker`.
- `createConsoleProvider().create` posts one node and waits for `running` through `awaitRunning`, which calls the status report one time right after the console returns a node id.
- `runCreate` in `.agro/cli/src/commands/hands.ts` creates one hand. `CONSOLE_ONLY_CREATE_FLAGS` refuses console flags for the exedev provider.

Verified agro-console contract at `mifunedev/agro-console` 8418f5f0:

- `apps/web/app/api/nodes/route.ts` routes `POST /api/nodes` to `NodesController.create` in `apps/web/server/controllers/nodes.controller.ts`. `create` needs the role `operator`, accepts brain authority, and forces `profile: "sandbox"` when the caller is a brain.
- `createNodeRequestSchema` in `packages/shared/src/models/node.ts` takes `tools` from `NODE_TOOLS = ["agro", "docker", "desktop"]`. `NODE_PROFILE_TOOLS` offers `agro`, `docker`, and `desktop` for `sandbox`, and `docker` and `desktop` for `agro`. Without `tools`, the console gives the profile tools without `desktop`. `NODE_TOOL_MIN_SPEC.desktop` is `n4`, and `DEFAULT_NODE_SPEC` is `n4`. A smaller spec gets HTTP 422 `SPEC_TOO_SMALL_FOR_TOOL`.
- `apps/web/components/create-node-form.tsx` labels the profile `sandbox` as the role "Hands". `DEFAULT_TOOL_SELECTION` selects `agro` and `docker` (`DEFAULT_DOCKER_CHOICE = true`). `withNodeRole` sends `tools` as the selected role tools. `draftsForTools` raises a draft spec below `NODE_TOOL_MIN_SPEC` to the smallest offered spec with enough memory.
- `apps/web/lib/create-node-batch.ts` creates a batch in sequence, stops at the first refusal, and caps a batch at `CREATE_NODE_BROWSER_CEILING = 10`.

Selected approach: `--desktop` sends the role tools plus `desktop`, as the form does with its defaults. An explicit `--spec n2` conflicts with `--desktop`, so the CLI refuses the conflict locally and does not raise the spec silently. Without `--spec`, the console default spec fits. `--count` follows the form batch: a cap of 10 and sequential requests that stop at the first refusal. The CLI chains each request on the first status report of the previous create. The provider interface does not change, and the waits run at the same time.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/hands/console-provider.ts` | `toolsField`, `ConsoleHandRequest`, `createConsoleProvider().create` | Build the desktop tools for the effective profile. |
| `.agro/cli/src/commands/hands.ts` | `parseCreate`, `CreateArgs`, `VALUE_FLAGS`, `CONSOLE_ONLY_CREATE_FLAGS`, `runCreate`, `createdLine`, `waitDesktop`, `printDesktop`, `handsHelp`, `runHands` | Parse `--count`, refuse `n2` with `--desktop`, chain the creates, print one line for each hand, and pass the authority to the tools rule. |
| `.agro/cli/src/commands/__tests__/hands.test.ts` | `agro hands create --desktop`, `agro hands create --json`, help usage test | Pin the request bodies and the output with the fake console. |
| `docs/lifecycle-commands.md` | `agro hands` row and section | Public usage. |
| `CHANGELOG.md` | `## [Unreleased]` | Release notes. |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| `agro hands create --desktop` | Changed | Sends the role tools plus `desktop`; refuses `--spec n2` locally. |
| `agro hands create --count <N>` | New | Creates 1 to 10 console hands in one call. |
| `agro hands create --json` | Extended | Prints one line for each hand with N greater than 1. |
| `POST /api/nodes` body | Changed | `tools` holds the role tools with `desktop`. |

## Storage
N/A: the CLI keeps no state. The console owns each node.

## Architectural Decisions
- The agro-console create form and `createNodeRequestSchema` are the source of truth for the desktop tools and the spec rule.
- The console enforces the paid node limit and the free tier. The CLI reports each refusal and does not repeat the console rules, except the local `n2` refusal that prevents a partial batch.
- The `HandProvider` interface does not change. `runCreate` sequences the requests on the status report.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/commands/__tests__/hands.test.ts` | desktop tools for `sandbox`, `agro`, brain authority, no `--desktop` | US-001 request bodies |
| `.agro/cli/src/commands/__tests__/hands.test.ts` | `--desktop --spec n2` sends no request | US-001 local refusal |
| `.agro/cli/src/commands/__tests__/hands.test.ts` | `--count` bound, names, order, human lines, JSON lines, refusal at 2 of 3, wait failure at 2 of 3, exedev refusal, `--project` exclusion | US-002 |
| `.agro/cli/src/commands/__tests__/hands.test.ts` | help usage line | US-003 |

Gate commands, run from the worktree:

```bash
export PATH=$HOME/.local/share/fnm/aliases/default/bin:$PATH
corepack pnpm exec vitest run .agro/cli/src/commands/__tests__/
corepack pnpm run typecheck
corepack pnpm test
```

The 7 `herdr-default.test.ts` failures in `corepack pnpm test` are the brain baseline: the brain has no zsh.

## Design Principles
- Match the agro-console form for each rule that the console owns.
- The CLI reports every hand with a node id. The CLI never exits before the report.
- Refuse a conflict before the first request, so that a refusal does not leave a partial batch.
- Keep the provider interface; change only the command and the tools rule.

## Out of Scope
- Changes to the agro-console repository.
- `--count` for the exedev provider and for `fork`.
- `--count` with `--project` or `--clone`.
- A `--no-docker` or `--no-agro` tool flag.
- Live console creates and any live spend in tests or evidence.

## Open Questions
None. The supervisor can override the selected defaults. The defaults are the flag name `--count`, the cap 10, the local refusal of `--spec n2`, and the role tools for `--desktop`.

## Acceptance Criteria
- [ ] Each story passes its acceptance criteria.
- [ ] `corepack pnpm run typecheck` exits 0.
- [ ] `corepack pnpm test` shows no failure outside the 7 baseline `herdr-default.test.ts` failures.
- [ ] CI on the PR is green.

## Lessons

1. Claim: an edit to `docs/lifecycle-commands.md` makes the sandbox routing replay stale. Evidence: CI on `674c050c` failed `sandbox-routing.test.ts` with `stale source: instructionSha256`. Outcome: fixed in this PR. The supervisor chose a real replay: 17 fresh-context, decision-only agents (`replay15`) matched all 17 oracles, and `e3582789` rebuilt `decisions.json` from their responses.
2. Claim: the first `--count` hand line printed the request position, not the console index. Evidence: the advisor read the US-002 diff at `53033ca7`. Outcome: fixed in this PR (US-002 round 1).
3. Claim: `/code-review 1677` pass 1 found four defects in `createMany`. The defects were an unhandled rejection, an order that depended on callback timing, silent skipped requests, and `desktop not listening` on a failed hand. Evidence: the review output on `dd23e677`. Outcome: fixed in this PR (`445f604b`, US-002 round 2).
4. Claim: pass 2 found two more defects: `ssh <host>` on a non-running hand, and a running hand marked failed after a desktop-wait error. Evidence: the review output on `5c03e346`. Outcome: fixed in this PR (`c15ae912`, US-002 round 3). The supervisor approved round 3 past the 2-round cap.
5. Claim: stdout `hand <index>` and stderr `hand <k> of <N>` use two numberings. Evidence: review passes 1 and 2. Outcome: dropped. The wording is in `docs/lifecycle-commands.md`, and a change needs another routing replay.
6. Claim: `--desktop --spec N2` skips the local refusal. Evidence: review passes 1, 2. Outcome: dropped. The console spec enum accepts only lowercase `n2` to `n64`, so the console refuses `N2` with a validation error.
7. Claim: a failed hand prints the undocumented `desktop -`, and `--count` with no value prints the range error instead of `requires a value`. Evidence: review pass 2. Outcome: dropped. Both messages are clear, and a docs change needs another routing replay.
8. Claim: pass 3 found only nits. Brain authority with `--profile agro --desktop` sends `profile: "agro"` with the sandbox tools. The line prints `desktop not listening` when xrdp listens without a tailnet host. A JSON consumer cannot match a refused request by position. Evidence: the review output on `9836b97c`. Outcome: dropped. The console forces the profile `sandbox` for a brain and returns a tailnet name with `rdpListening`. The stderr line names each refused request.
9. Claim: on the single-hand path, an exception from the desktop wait still rejects `runCreate`. Evidence: review pass 3 (pre-existing in #1667). Outcome: dropped. `awaitDesktop` converts API errors to a warning, so only an unexpected exception reaches this path, and the path predates this PR.
10. Claim: the brain disk filled during US-002 round 1, and every Bash call failed. Evidence: `ENOSPC` on `prd.json`; the supervisor freed space. Outcome: dropped. The cause was host capacity, not a defect in the change. Workers now write large output to the scratchpad and delete the output.
11. Claim: git ignores `.agro/tasks/<slug>/evidence/`, so a plain `git add` left `baseline.md` untracked. Evidence: `git ls-files` after `fec00af2`. Outcome: fixed in this PR with `git add -f`.
