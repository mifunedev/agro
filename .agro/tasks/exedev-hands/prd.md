# PRD: exe.dev hand provider and free tier fallback

Status: DRAFT

## User Stories

### US-001: Probe the exe.dev command API

**Description:** As the advisor, I want recorded exe.dev command output so that the provider stories build on measured JSON shapes, not on guesses.

**Acceptance Criteria:**

- [ ] `.agro/tasks/exedev-hands/evidence/probe.md` records the output of `ssh exe.dev help` for `ls`, `new`, `cp`, `pause`, `resume`, `rm`, and `tag`, run on the brain.
- [ ] The fixture file `.agro/cli/src/commands/__tests__/fixtures/exedev-ls.json` holds one `ssh exe.dev ls --json` capture. The capture holds one VM with the tag `agro-hand` and one VM without tags. The capture keeps the fields `vm_name`, `ssh_dest`, `status`, and `tags`, and drops share links and email fields.
- [ ] The probe records whether `pause` and `resume` accept `--json`, and records the exit status of `ssh exe.dev ls --json` when the account key is missing, run with `-o IdentitiesOnly=yes -i /dev/null`.
- [ ] The probe creates, forks, pauses, and deletes no VM.

### US-002: Extract the hand provider seam

**Description:** As a CLI maintainer, I want one `HandProvider` interface with the console implementation behind it. Then a second provider adds code beside the console code, not inside it.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/hands/provider.ts` exports `HandProvider`. The interface holds the operations `list`, `resolve`, `create`, `fork`, `pause`, `resume`, and `destroy`. The interface also holds the SSH destination, the host key alias, and the remote name.
- [ ] `.agro/cli/src/lib/hands/console-provider.ts` implements `HandProvider` with the current console calls. `runHands` in `.agro/cli/src/commands/hands.ts` calls verbs only through `HandProvider`.
- [ ] `.agro/cli/src/commands/__tests__/hands.test.ts` and `.agro/cli/src/commands/__tests__/hands-project.test.ts` pass with no edit to either file.
- [ ] `pnpm typecheck` exits 0, and `pnpm test:scripts` exits 0.

### US-003: Add the hands.provider configuration key

**Description:** As an operator, I want `hands.provider` in `agro.json` so that I select the hand provider for one brain explicitly.

**Acceptance Criteria:**

- [ ] `AGRO_CONFIG_FIELDS` in `.agro/cli/src/lib/agro-config.ts` holds `{ path: "hands.provider", type: "enum", values: ["console", "exedev"] }`, and `validateAgroConfig` rejects any other value.
- [ ] `agro hands` reads `hands.provider` from `~/.agro/workspaces/harness/agro.json`, where `~` is the home directory of the user that runs `agro`. When the file or the key is absent, the provider is `console`.
- [ ] `agro config set hands.provider exedev` writes the key, and `agro config set hands.provider other` exits 1.
- [ ] `docs/configuration.md` § Field reference documents `hands.provider`. `.agro/cli/src/__tests__/docs-reference.test.ts` passes.
- [ ] `.agro/cli/src/lib/__tests__/agro-config.test.ts` covers the valid values, the rejected value, and the absent key.

### US-004: Remove --free-tier and fall back to n4

**Description:** As an operator, I want console creates to pick the free tier without a flag. When I request a spec that the free tier does not offer, the CLI creates `n4` and tells me.

**Acceptance Criteria:**

- [ ] The worker deletes `CreateArgs.freeTier`, `CheckArgs.freeTier`, and the `--free-tier` parsing in `.agro/cli/src/commands/node.ts`. Then `agro node create` and `agro node check` reject `--free-tier` with `unknown flag "--free-tier"` and exit 1.
- [ ] Without `--spec`, `agro node create` sends the spec `n4` (`FREE_TIER_SPEC`).
- [ ] A shared function in `.agro/cli/src/lib/console-api.ts` sends `POST /api/nodes` with the requested spec. If the console returns HTTP 403 with the code `PAYMENTS_DISABLED`, the function sends one more `POST /api/nodes` with `spec: "n4"` and `freeTier: true`. The function sends no third request.
- [ ] Before the second request, the CLI prints `spec <spec> is not in the free tier; creating n4` to stderr. When the requested spec is `n4`, the CLI prints no notice.
- [ ] Any other error code, `FREE_TIER_INELIGIBLE` included, exits 1 after the first request with no retry.
- [ ] `agro node create` and the console provider `create` in `.agro/cli/src/lib/hands/console-provider.ts` both use the shared function.
- [ ] `agro node check` always runs the free tier check. A line `warn free-tier: not eligible ...` reports an ineligible account and does not change the exit status.
- [ ] `.agro/skills/sandbox/adapters/console.sh` passes no `--free-tier` and reads no `CONSOLE_FREE_TIER`. `.agro/skills/sandbox/references/validation.md` and `.agro/skills/sandbox/references/providers.md` no longer name `--free-tier` or `CONSOLE_FREE_TIER`.
- [ ] `nodeHelp` and `docs/lifecycle-commands.md` § Remote console nodes no longer name `--free-tier`, and both describe the `n4` fallback.
- [ ] `.agro/cli/src/__tests__/node.test.ts` covers the default spec, the fallback with its notice, no notice for `n4`, no retry for other codes, and the rejected flag. `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` expects `node check --ssh-key key-uuid`.
- [ ] `git grep -n -e '--free-tier' -e CONSOLE_FREE_TIER -- .agro docs ':!.agro/tasks'` prints no line.
- [ ] `resolveConsoleConfig`, `CONSOLE_CONFIG_MISSING`, and `DEFAULT_CONSOLE_URL` live in `.agro/cli/src/lib/console-api.ts`, and `resolveBrainConsoleConfig` moves from `hands.ts` to the same file. `.agro/cli/src/commands/auth.ts` imports nothing from `./node.js`.
- [ ] One shared function renders the node list table, and one shared function asks the delete confirmation. `agro node` and the console hand provider both call each function.
- [ ] `nodeHelp` states that a sandbox-profile node from `agro node create` is not a hand unless a brain manages the node.
- [ ] `pnpm typecheck` exits 0, and `pnpm test:scripts` exits 0.

### US-005: Read and run on exe.dev hands

**Description:** As an agent on an exe.dev brain, I want `agro hands list`, `exec`, and `fetch` to work on tagged exe.dev VMs. Then I offload project work without a console token.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/hands/exedev-provider.ts` implements `list` and `resolve` from `ssh exe.dev ls --json`. The provider returns only VMs whose `tags` holds `agro-hand`. `<hand>` is the VM name.
- [ ] With `hands.provider` set to `exedev`, `agro hands` needs no brain token. A failed `ssh exe.dev whoami` preflight exits 2 and prints the remedy to register the brain key with the exe.dev account.
- [ ] `exec` runs `ssh <ssh_dest> bash -lc '<command>'` with `HostKeyAlias=<vm_name>`. With `--project`, the command runs in `projects/<owner>/<repo>`. `exec` exits with the remote exit status.
- [ ] `fetch` runs `git fetch hand-<vm_name>` in the brain project.
- [ ] Both providers resolve the brain project as `<harness-root>/projects/<owner>/<repo>`. `<harness-root>` is `harnessRoot` from `~/.agro/config.json` when set, else `defaultHarnessRoot` (`${AGRO_HOME:-~/.agro}/workspaces/harness`). `hands.ts` no longer holds the literal `"workspaces", "harness"` or `BRAIN_HOME` for project paths.
- [ ] A test sets `AGRO_HOME` to a temp directory and proves that `fetch` runs in `<AGRO_HOME>/workspaces/harness/projects/<owner>/<repo>`.
- [ ] An untagged or unknown `<hand>` exits 1 and prints `hand <name> is not tagged agro-hand`.
- [ ] `.agro/cli/src/commands/__tests__/hands-exedev.test.ts` runs each verb against a fake runner that returns `fixtures/exedev-ls.json`. The tests pin the SSH argv, the remote name, the project paths, and the exit status.
- [ ] `pnpm typecheck` exits 0, and `pnpm test:scripts` exits 0.

### US-006: Manage the exe.dev hand lifecycle with guards

**Description:** As an agent on an exe.dev brain, I want `create`, `fork`, `pause`, `resume`, and `destroy` on exe.dev hands. Guards stop each verb that names the brain or a VM outside the hand set.

**Acceptance Criteria:**

- [ ] `create` runs `ssh exe.dev new --json --name <name> --tag agro-hand`. `create --project` and `create --clone` prepare the hand and add the remote `hand-<name>` to the brain project.
- [ ] With `hands.provider` set to `exedev`, `create --spec` and `fork --spec` exit 1 with `--spec applies only to console hands`.
- [ ] `fork` runs `ssh exe.dev cp <source> <name> --copy-tags`. `pause`, `resume`, and `destroy` run `ssh exe.dev pause`, `resume`, and `rm`.
- [ ] `fork`, `pause`, `resume`, and `destroy` exit 1 with no `ssh exe.dev` write call when the VM has no `agro-hand` tag.
- [ ] Each write verb exits 1 with no `ssh exe.dev` write call when `<hand>` names the brain VM. The provider identifies the brain VM by `os.hostname()`.
- [ ] `destroy` asks the operator for confirmation unless the command line holds `--yes`.
- [ ] `handsHelp` in `.agro/cli/src/commands/hands.ts` documents both providers, the `agro-hand` tag, the guards, and the `n4` fallback for console hands.
- [ ] `hands-exedev.test.ts` covers each write verb, each guard, the `--spec` refusal, and the confirmation prompt.
- [ ] `pnpm typecheck` exits 0, and `pnpm test:scripts` exits 0.

### US-007: Route hand requests across providers in the sandbox skill

**Description:** As an agent, I want one hands reference for both providers. Then a request to offload work to a hand routes the same way on a console brain and on an exe.dev brain.

**Acceptance Criteria:**

- [ ] `git mv` renames `.agro/skills/sandbox/references/mifune-console.md` to `.agro/skills/sandbox/references/hands.md`. The route id changes from `mifune-console` to `hands` in `.agro/skills/sandbox/SKILL.md`.
- [ ] `hands.md` covers provider selection, enrollment with `ssh exe.dev tag <vm> agro-hand`, the guards, the `n4` fallback, and the operator request examples from ADR #1622.
- [ ] `.agro/skills/sandbox/references/exedev.md` no longer states that exe.dev has no pause. The file points to `hands.md` for the use of an exe.dev VM as a hand.
- [ ] `.agro/scripts/__tests__/sandbox-skill.test.ts`, `.agro/scripts/__tests__/helpers/sandbox-routing.ts`, and the files in `.agro/scripts/__tests__/fixtures/sandbox-routing/` use the route `hands`. `cases.json` holds at least two exe.dev hand requests from ADR #1622.
- [ ] `docs/lifecycle-commands.md` § Hands from a brain documents both providers.
- [ ] `CHANGELOG.md` `## [Unreleased]` names the exe.dev hand provider and `hands.provider`. A **BREAKING** entry names the removal of `--free-tier` and the `n4` fallback. Each entry links to the task issue.
- [ ] The root `AGENTS.md` § A small glossary defines **brain**, **hand**, and **console node**. A hand is a node that a brain creates and manages through `agro hands`.
- [ ] `.agro/skills/sandbox/references/hands.md` and `.agro/skills/worktrees/SKILL.md` name the brain harness root through `agro hands --help`, not through a repeated literal path.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/sandbox/references/hands.md` exits 0.
- [ ] `bash .agro/scripts/link-providers.sh` in check mode exits 0, and `pnpm test:scripts` exits 0.

### US-008: Record a live review on agro-sbx-dev-001

**Description:** As the operator, I want one transcript of the built CLI on the real exe.dev hand. The transcript shows the provider working end to end in the PR.

**Acceptance Criteria:**

- [ ] Before any write, a read-only `agro hands list` on the brain lists `agro-sbx-dev-001`. If the command fails, the story sets `blocked` and runs no other command.
- [ ] `.agro/tasks/exedev-hands/evidence/manual-review.md` records the built CLI on the brain `agro-supervisor` with `hands.provider` passed for the run only. The run covers `list`, `exec agro-sbx-dev-001 --project <owner>/<repo> -- git log --oneline -1`, one commit on the hand, `fetch`, `pause`, and `resume`.
- [ ] The transcript shows `agro hands destroy agro-supervisor --yes` refused with exit 1 and no exe.dev write.
- [ ] The transcript shows `agro node create --free-tier` refused with exit 1 and no console request.
- [ ] The run creates, forks, and destroys no VM or console node. A `create`, `fork`, or live `n4` fallback run needs separate operator authority and an `agro auth login` sign-in. `external`
- [ ] At the end, `ssh exe.dev ls --json` lists the same VMs and tags as at the start.

## Summary

ADR #1622 selects option 3: a provider seam inside `agro hands`, with exe.dev as the second provider. The brain `agro-supervisor` is an exe.dev VM with no console token, so `agro hands` exits 2 there today. The operator also put the removal of `--free-tier` into this scope. When a requested spec is not in the free tier, a console create falls back to `n4`.

Verified facts:

- `agro hands` is console-only. `resolveHand` in `.agro/cli/src/commands/hands.ts` calls `GET /api/nodes/<ref>`. `runSsh` hardcodes `sandbox@<sshHost>`. `sshOptions` pins `HostKeyAlias=<console uuid>`. `handRemote` returns `hand-<orgIndex>`.
- `defaultDeps` sets `homeDir` to `BRAIN_HOME` (`/home/sandbox`). The brain project path derives from `homeDir`. On the exe.dev brain, the home directory is `/home/exedev`.
- `runHands` resolves the brain token before it dispatches a verb, and exits 2 without the token.
- The exe.dev account API offers `ls --json`, `new --tag`, `cp --copy-tags`, `pause`, `resume`, `rm`, `restart`, and `tag`.
- On 2026-11-14, `ssh exe.dev tag agro-sbx-dev-001 agro-hand` succeeded. `ls --json` then reported `"tags": ["agro-hand"]` for that VM and no `tags` key for `agro-supervisor`.
- On `agro-sbx-dev-001`, `bash -lc "agro run --help"` succeeds with agro 0.33.0. A non-login SSH command does not find `agro` on `PATH`.
- `.agro/cli/src/commands/node.ts` parses `--free-tier` in `parseCreate` and `parseCheck`. With the flag, `create` sends `freeTier: true` and defaults the spec to `FREE_TIER_SPEC` (`n4`). Without the flag, `create` requires `--spec`, although `nodeHelp` states that the spec defaults to `n4`.
- `node.test.ts` pins the console answer HTTP 403 `PAYMENTS_DISABLED` ("Payments are not available yet. Use the free tier.") for a create without `freeTier`.
- `checkFreeTier` calls `GET /api/free-tier` and fails the check when `eligible` is not `true`.
- `.agro/skills/sandbox/adapters/console.sh` adds `--free-tier` to `agro node check` and `agro node create` unless `CONSOLE_FREE_TIER=0`.
- `AGRO_CONFIG_FIELDS` is the registry of `agro.json` fields. `docs-reference.test.ts` audits documented dotted keys against that registry.
- `sandbox-skill.test.ts`, `helpers/sandbox-routing.ts`, and both routing fixtures pin the route id `mifune-console` and the file `mifune-console.md`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/hands.ts` | `runHands`, `resolveHand`, `runSsh`, `sshOptions`, `handRemote`, `defaultDeps`, `handsHelp` | verb dispatch and SSH transport |
| `.agro/cli/src/commands/node.ts` | `parseCreate`, `parseCheck`, `FREE_TIER_SPEC`, `checkFreeTier`, `nodeHelp` | `--free-tier` removal and `n4` default |
| `.agro/cli/src/lib/console-api.ts` | `ConsoleNode`, `callApi`, `waitForRunning`, shared create function (new) | console client and `n4` fallback |
| `.agro/cli/src/lib/hands/provider.ts` | `HandProvider` (new) | provider seam |
| `.agro/cli/src/lib/hands/console-provider.ts` | console provider (new) | current behavior behind the seam |
| `.agro/cli/src/lib/hands/exedev-provider.ts` | exe.dev provider (new) | `ssh exe.dev` calls, tag filter, guards |
| `.agro/cli/src/lib/agro-config.ts` | `AGRO_CONFIG_FIELDS`, `validateAgroConfig`, `readAgroConfig` | `hands.provider` key |
| `.agro/cli/src/lib/host-config.ts` | `readHostConfig`, `defaultHarnessRoot`, `workspacesRoot` | brain harness root resolution |
| `.agro/cli/src/lib/console-auth.ts` | console credential file | operator token source |
| `.agro/cli/src/commands/auth.ts` | imports of `resolveConsoleConfig`, `CONSOLE_CONFIG_MISSING`, `DEFAULT_CONSOLE_URL` | moves its imports from `./node.js` to `lib/` |
| `AGENTS.md` | A small glossary | defines brain, hand, and console node |
| `.agro/cli/src/command-table.ts` | `HANDS_VERBS` | verb list; no change expected |
| `.agro/skills/sandbox/adapters/console.sh` | `console_preflight`, `console_create` | free tier flag removal |
| `.agro/skills/sandbox/SKILL.md` | route table | `hands` route |
| `.agro/skills/sandbox/references/mifune-console.md` | whole file | renamed to `hands.md` |
| `.agro/skills/sandbox/references/exedev.md` | Cleanup section | pause correction |
| `.agro/skills/sandbox/adapters/exedev.sh` | `exedev_*` | validation adapter; no change (ADR #1314) |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro hands <verb>` | extended | Each verb runs against the provider that `hands.provider` selects. |
| `agro.json` `hands.provider` | new key | `console` or `exedev`. The default is `console`. |
| exe.dev tag `agro-hand` | new convention | The tag marks an exe.dev VM as a hand. |
| brain remote `hand-<vm_name>` | new name form | The remote name for an exe.dev hand. Console hands keep `hand-<index>`. |
| `agro node create --free-tier`, `agro node check --free-tier` | removed | The flag exits 1 as an unknown flag. |
| `agro node create` without `--spec` | changed | The spec defaults to `n4`. |
| console create on `PAYMENTS_DISABLED` | new behavior | One retry with `n4` and `freeTier: true`, with a stderr notice. |
| `agro node check` free tier line | changed | Always runs. An ineligible account prints `warn` and does not fail the check. |
| `CONSOLE_FREE_TIER` validation variable | removed | The console adapter no longer reads the variable. |
| `sandbox` skill route | renamed | `mifune-console` becomes `hands`. |

## Storage

N/A. `agro hands` keeps no local state. The provider API is the only list of hands. `hands.provider` lives in the existing tracked `agro.json`.

## Architectural Decisions

- ADR #1622 owns the provider decision. The provider seam replaces the console-only code path. The task adds no second dispatch path.
- The provider API is the source of truth. The exe.dev hand set is the set of VMs with the tag `agro-hand`.
- The `exedev` provider needs no brain token. The exe.dev account key on the brain authorizes each call.
- The CLI enforces the exe.dev authority fence: the tag guard and the brain-hostname guard. The console provider keeps its server-side token scope.
- Remote commands on exe.dev hands run in a login shell, so `agro` resolves on `PATH`.
- The console answer decides the free tier, not a CLI flag. The CLI falls back to `n4` only on `PAYMENTS_DISABLED`, retries one time, and prints the fallback. One shared function owns the fallback for `agro node create` and console hand creates.
- exe.dev hands have no spec. The `exedev` provider refuses `--spec` instead of a silent mapping.
- The bash validation adapter `exedev.sh` stays separate, because ADR #1314 owns its contract.
- `agro hands` resolves the brain harness root as `readHostConfig(env, home).harnessRoot`, then `defaultHarnessRoot(env, home)` from `.agro/cli/src/lib/host-config.ts`. No command or skill repeats the literal path.
- The exe.dev API keeps two callers: the TypeScript provider and the validation adapter `exedev.sh`. ADR #1622 accepts this duplication, because validation VMs are not hands. The US-001 fixture pins the shape that the TypeScript provider parses.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/commands/__tests__/hands.test.ts` | existing cases, no edit | console behavior survives the seam |
| `.agro/cli/src/commands/__tests__/hands-project.test.ts` | existing cases, no edit | console project flow survives the seam |
| `.agro/cli/src/commands/__tests__/hands-exedev.test.ts` | list filter, resolve, exec argv, fetch remote, preflight failure, write verbs, tag guard, brain guard, `--spec` refusal, confirmation | exe.dev provider |
| `.agro/cli/src/__tests__/node.test.ts` | default spec `n4`, fallback request pair, notice text, no notice for `n4`, no retry on other codes, rejected flag, `warn free-tier` line | free tier removal and fallback |
| `.agro/scripts/__tests__/remote-sandbox-adapters.test.ts` | preflight argv without `--free-tier` | console adapter |
| `.agro/cli/src/lib/__tests__/agro-config.test.ts` | valid values, rejected value, absent key | `hands.provider` |
| `.agro/cli/src/__tests__/docs-reference.test.ts` | existing audit | documented key matches the registry |
| `.agro/scripts/__tests__/sandbox-skill.test.ts` | route table, reference files, exe.dev hand cases | skill routing |

## Design Principles

- Apply the root `AGENTS.md` rules: no explanatory comments in tracked code, one source of truth, smallest truthful model.
- Keep the console hand path byte-compatible, except for the `n4` fallback. The unchanged console hand tests are the proof.
- Fail closed on exe.dev: an unknown JSON shape, a missing tag, or the brain hostname stops the verb.
- Make each fallback visible: the CLI never changes a requested spec without a notice.
- Print no token and no private key in any output.

## Out of Scope

- agro-console adoption of external VMs.
- A local hand registry.
- Mixed providers on one brain.
- Changes to the ADR #1314 validation adapter contract.
- Execution isolation on the hand (ADR #1575).
- An upgrade of agro on `agro-sbx-dev-001`.
- A spec catalog or a free tier spec list in the CLI. The console answer stays the authority.

## Open Questions

1. The JSON output of `ssh exe.dev new --json` and `ssh exe.dev cp` is not captured, because a capture creates a VM. US-006 parses `<new output fields>` from `help new` and the US-001 probe. The first authorized `create` must confirm the shape.
2. The route rename from `mifune-console` to `hands` touches the content-bound routing evidence from #1618. Confirm that the fixture update needs no new council evidence.
3. The plan assumes that the console answers `PAYMENTS_DISABLED` for a spec outside the free tier. Before US-004 starts, the operator confirms the code or names `<free tier spec refusal code>`.
4. The plan assumes that a brain-token `POST /api/nodes` accepts `freeTier: true`. Confirm the assumption for console hand creates, or limit the fallback to `agro node create`.

## Acceptance Criteria

- [ ] Each story in `prd.json` has `passes: true`.
- [ ] `pnpm typecheck` exits 0, and `pnpm test:scripts` exits 0.
- [ ] `agro hands list` on `agro-supervisor` with `hands.provider` set to `exedev` lists `agro-sbx-dev-001`.
- [ ] With `hands.provider` absent, `agro hands` behaves as before, and the unchanged console hand tests prove it.
- [ ] `git grep -n -e '--free-tier' -e CONSOLE_FREE_TIER -- .agro docs ':!.agro/tasks'` prints no line.
- [ ] ADR #1622 status is `Accepted` before the task PR leaves draft. `external`

## Lessons

1. Claim: content-bound routing evidence goes stale when any instruction file changes. Evidence: US-004 edited `providers.md`, `validation.md`, and `docs/lifecycle-commands.md`, and `sandbox-routing.test.ts` failed with `stale source: instructionFiles` until US-007 recorded fresh decisions. The first fresh replay also found two real gaps (R9 omitted the `agro-run` owner, and no procedure pushed a branch to an existing hand). Outcome: fixed in this PR (`86d75213` documents both gaps; `063bdc44` records 11 matching decisions).
2. Claim: the hands tests read the real home directory after `hands.provider` resolution arrived. Evidence: US-003 report; `hands.test.ts` had no `userHome` injection. Outcome: fixed in this PR (US-005 injects a temp `userHome`).
3. Claim: `agro node create --free-tier` prints the sign-in message before the unknown-flag message when no console configuration exists. Evidence: US-008 transcript E3; `runNode` resolves the console configuration before verb flags. Outcome: dropped. Both paths exit 1 and send no console request.
4. Claim: no run has observed the JSON shape of `ssh exe.dev new --json` and `cp --json`. Evidence: open question 1; the probe created no VM. Outcome: dropped. The provider falls back to `--name` plus `ls --json` and fails closed; the first authorized `create` confirms the shape.
5. Claim: no run has checked the fallback trigger `PAYMENTS_DISABLED` or brain-token acceptance of `freeTier: true` against the live console. Evidence: open questions 3 and 4; the brain has no console sign-in. Outcome: dropped. A different refusal code leaves the create failing as before, with no regression.
6. Claim: a named microVM target in `agro run` depends on `msb start` outside the `agro` lifecycle door. Evidence: `run.ts` `runInMicrovm` error text. Outcome: dropped. ADR #1575 owns that lifecycle, and the finding is not a correctness or security risk in this PR.
7. Claim: validation checks keep the literal `$HOME/.agro/workspaces/harness`. Evidence: US-007 report (`checks/agro-rows.sh`, `checks/hermes-home.sh`, `references/validation.md`). Outcome: dropped. Those paths describe a fresh install, not the brain harness root.
