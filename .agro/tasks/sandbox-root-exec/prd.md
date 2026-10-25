# PRD: Stop root execution of agent-writable sandbox code

Status: DRAFT

Branch: `bug/1516-sandbox-root-exec`. Issue: #1516.

## User Stories

### US-001: Entrypoint runs control-plane scripts as the sandbox user

**Description:** As an operator, I want the root entrypoint to run no agent-writable script as root so that an agent cannot gain root without sudo.

**Acceptance Criteria:**

- [ ] The root section of `.devcontainer/entrypoint.sh` creates and chowns the uv directories that `provision-python.sh` lines 35-48 create, before the provisioning call.
- [ ] `.devcontainer/entrypoint.sh` starts `provision-python.sh` through `gosu sandbox`, in the same form as the `link-providers.sh` call.
- [ ] `.devcontainer/entrypoint.sh` contains no `ln -sf "$CONTROL_DIR/scripts/gateway.sh" /usr/local/bin/gateway` line.
- [ ] `grep -nE '^[[:space:]]*(if ! )?(bash|sh|source|\.) "?\$\{?CONTROL_DIR' .devcontainer/entrypoint.sh` prints no line.
- [ ] `.agro/scripts/__tests__/entrypoint.test.ts` asserts the `gosu sandbox` form of the provisioning call and asserts the absence of the `/usr/local/bin/gateway` symlink.
- [ ] A new assertion fails against the current entrypoint before the fix, and passes after the fix.
- [ ] If a tracked document under `.agro/skills` or `docs` tells the reader to run a bare `gateway` command, that document names `agro gateway` instead.
- [ ] `pnpm exec vitest run .agro/scripts/__tests__/entrypoint.test.ts .agro/scripts/__tests__/provision-python.test.ts` exits 0.
- [ ] `shellcheck -S warning .devcontainer/entrypoint.sh` exits 0.

### US-002: Shell failure hint restarts the named sandbox

**Description:** As a returning operator, I want the `agro shell` failure hint to restart my existing sandbox so that I do not create a second, empty sandbox.

**Acceptance Criteria:**

- [ ] The story creates no container, volume, or registry entry. If a check needs such a resource, the story stops and asks the operator.
- [ ] The test "prints the install hint" in `.agro/cli/src/__tests__/lifecycle.test.ts` expects the new hint text.
- [ ] The "Tear down" block of `docs/quickstart.md` shows `agro restart <name>` as the command that starts a stopped sandbox again.
- [ ] The documents that pair `agro stop <name>` with `agro sandbox install docker --name <name>` to apply configuration stay unchanged.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/lifecycle.test.ts` exits 0.
- [ ] `pnpm typecheck` exits 0.

### US-003: Manual review evidence

**Description:** As a reviewer, I want a command transcript of the changed behavior so that I can accept the change without a rebuild.

**Acceptance Criteria:**

- [ ] `.agro/tasks/sandbox-root-exec/evidence/manual-review.md` records the `grep` command of US-001 and its empty output.
- [ ] The transcript records the hint that the built CLI prints for `agro shell <name>` against a stopped or absent container.
- [ ] The transcript records the exit status of `pnpm test` and `pnpm typecheck` on the integrated task branch.
- [ ] The story creates no container, volume, or registry entry. If a check needs one, the story stops and asks the operator.

## Summary

The container entrypoint runs as root under systemd or Compose init. At `.devcontainer/entrypoint.sh:340`, root runs `bash "$CONTROL_DIR/scripts/provision-python.sh"`. `CONTROL_DIR` resolves inside the project tree. The `sandbox` user owns that script with mode `775`. An agent can edit the script, and the next container start runs the edit as root. This path bypasses the password gate on sudo (`.devcontainer/Dockerfile:80`). The escalation applies when `access.dockerSocket` is `false`, which is the default (`.agro/cli/src/lib/agro-config.ts:116`).

`.devcontainer/entrypoint.sh:493` links the agent-writable `gateway.sh` into `/usr/local/bin/gateway`. No root caller uses the link. An operator who runs `sudo gateway` executes agent-written code. The documented door is `agro gateway`.

The docker `shellFailure` hint at `.agro/cli/src/lib/runtimes/verbs.ts:86` omits the sandbox name. Without `--name`, `agro sandbox install docker` picks a new name through `nextDefaultName`. That function treats each registry entry as taken (`registry.ts:77`). `agro restart [name]` exists (`docs/lifecycle-commands.md:34`).

The selected approach moves the root-only directory setup into the entrypoint and drops to `sandbox` before the script runs. The approach deletes the `gateway` symlink. The approach points the hint and the quickstart at `agro restart <name>`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.devcontainer/entrypoint.sh` | provisioning block near line 338; symlink at line 493 | Root boot sequence |
| `.agro/scripts/provision-python.sh` | root branch, lines 26-54 | Directory setup that the entrypoint takes over |
| `.agro/scripts/__tests__/entrypoint.test.ts` | `CONTROL_DIR` routing test, lines 229-247; Slack restore test, line 269 | Static entrypoint contract |
| `.agro/scripts/__tests__/provision-python.test.ts` | "runs provisioning after provider links", line 314 | Ordering contract for the provisioning call |
| `.agro/cli/src/lib/runtimes/verbs.ts` | `RUNTIME_NAMING.docker.shellFailure` | Shell failure hint |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | "prints the install hint", line 624 | Hint contract |
| `docs/quickstart.md` | "Tear down" block, line 171 | Operator restart guidance |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/usr/local/bin/gateway` in the container | Removed | Operators use `agro gateway` |
| `agro shell` stderr hint | Changed text | Names the sandbox and `restart` |
| `docs/quickstart.md` | Changed command | `agro restart <name>` restarts a stopped sandbox |

## Storage

N/A. The change adds no persistent state.

## Architectural Decisions

- Root executes only code from the image or from root-owned paths. Agent-writable control-plane scripts run through `gosu sandbox`.
- `provision-python.sh` keeps its root branch. An operator who runs the script with sudo still gets a sandbox-owned result.
- `agro` stays the only lifecycle door. The task removes the bare `gateway` alias.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/entrypoint.test.ts` | provisioning call uses `gosu sandbox`; no `/usr/local/bin/gateway` symlink; no bare root execution of `$CONTROL_DIR` scripts | US-001 |
| `.agro/scripts/__tests__/provision-python.test.ts` | provisioning still runs after provider links and does not abort boot | US-001 |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | hint text names `restart <name>` | US-002 |

## Design Principles

- Apply the sandbox boundary: agent work stays inside the sandbox, and agent-writable code never runs as root.
- Make the smallest change that removes the path. Add no new verb and no new mechanism.
- Express intent through code and tests. Add no explanatory comments.

## Out of Scope

- Change of the default for `access.dockerSocket` or `egress`.
- Tamper resistance for `.agro/hooks`.
- Pinning of the `curl | sh` installers in `.devcontainer/Dockerfile`.
- The hint that `runShell` prints after a non-zero zsh exit.
- A new `agro start` verb.
- An image rebuild or a live boot test. The evidence story uses static checks and the built CLI.

## Open Questions

None.

## Acceptance Criteria

- [ ] Every story in `prd.json` has `passes: true`.
- [ ] `pnpm test` exits 0 on the integrated task branch.
- [ ] `pnpm typecheck` exits 0 on the integrated task branch.
- [ ] The CI workflow `ci-harness.yml` passes on the pull request.

## Lessons

- Claim: `pnpm test` exits 1 with 11 failures in `herdr-default.test.ts` and `install.test.ts`. Evidence: the same 11 failures occur on base `1c028039` without this change. `herdr-default.test.ts` reports `spawnSync zsh ENOENT` because this runner has no `zsh`. Outcome: dropped, because the failures predate this change and its paths.
- Claim: `pnpm build` exits 1 when `pnpm` is available only through `corepack`, because the `build` script calls a bare `pnpm`. Evidence: the US-003 transcript. Outcome: dropped, because the defect is tooling friction in this runner.
- Claim: the test title "prints the install hint" in `lifecycle.test.ts` now describes a restart hint. Evidence: US-002 diff. Outcome: dropped, because the assertion holds the exact hint text and the title carries no behavior.
- Claim: the built CLI cannot show the shell hint without a registry entry. Evidence: `agro shell` exits 2 at the registry check before `docker exec`. Outcome: dropped, because the operator accepted the unit test as proof for US-003.
