# PRD: OpenShell sandbox runtime

Status: DRAFT

## User Stories

### US-001: Boot the published image under OpenShell without systemd

**Description:** As an operator, I want the published AGRO image to start as a non-root OpenShell workload so that one image serves both runtimes.

**Acceptance Criteria:**

- [ ] `.devcontainer/openshell-main.sh` exists in the image at `/usr/local/bin/openshell-main.sh` with mode `0755`.
- [ ] If `id -u` is not `0`, `.devcontainer/entrypoint.sh` runs only the steps that need no root: home seed, workspace seed, `link-providers.sh --init`, and git identity.
- [ ] `openshell-main.sh` runs `entrypoint.sh` and then runs `exec sleep infinity`.
- [ ] A second run of `entrypoint.sh` as `sandbox` against a seeded home keeps every file in `/home/sandbox` unchanged.
- [ ] The Dockerfile creates `/home/sandbox/harness` with owner `sandbox:sandbox` before the `WORKDIR` line.
- [ ] `bash .agro/scripts/sandbox-boot-smoke.sh` exits 0, so the Docker runtime still boots under systemd.

### US-002: Ship the canonical AGRO OpenShell policy

**Description:** As an operator, I want one reviewed default-deny policy so that Claude Code reaches GitHub, npm, and Anthropic and reaches nothing else.

**Acceptance Criteria:**

- [ ] `.devcontainer/openshell-policy.yaml` exists, sets `process.run_as_user: sandbox`, and sets `process.run_as_group: sandbox`.
- [ ] The policy holds exactly three named network rules: `github`, `npm`, and `anthropic`. Each rule lists its hosts and its binaries.
- [ ] The `github` rule lists the binaries `/usr/bin/git`, `/usr/bin/gh`, and `/usr/bin/curl`. The rule permits `git push` over HTTPS and the release download hosts that `agro tool install herdr` uses.
- [ ] The `npm` rule lists only the binary `/usr/local/bin/node` and sets `access: read-only`.
- [ ] The `anthropic` rule lists only the binary glob `/home/sandbox/.local/lib/node_modules/@anthropic-ai/claude-code/bin/*`, the host `api.anthropic.com`, and the `<claude login hosts>`.
- [ ] A test parses the policy and asserts that `/usr/local/bin/node` appears in no rule except `npm`.
- [ ] `materialize()` in `.agro/cli/src/lib/registry.ts` writes `openshell-policy.yaml` into an `openshell` entry from an `agro-asset:` import and writes no compose file into that entry.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/sandbox.test.ts` exits 0 with a case that reads the materialized policy back from the entry.

### US-003: Add the OpenShell execution target

**Description:** As a CLI maintainer, I want an `ExecutionTarget` for OpenShell so that `agro` reaches an OpenShell sandbox through the existing seam.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/execution/openshell-target.ts` exports `OpenShellExecutionTarget` with `kind = "openshell"` and `contractVersion = 1`.
- [ ] `provision()` runs `openshell sandbox create --name <name> --from <image-ref> --policy <entry>/openshell-policy.yaml --env AGRO_EXECUTION_TARGET=local --env SANDBOX_NAME=<name> --detach -- /usr/local/bin/openshell-main.sh`.
- [ ] `attach()` runs `openshell sandbox exec -n <name> --tty --workdir /home/sandbox/harness -- zsh -l`.
- [ ] `exec()` runs `openshell sandbox exec -n <name>` with `--workdir`, `--env`, and `--timeout` taken from the `ExecRequest`.
- [ ] `status()` runs `openshell sandbox get <name> -o json` and reads the `phase` field. The map follows the phase table in Architectural Decisions.
- [ ] If `openshell sandbox get <name>` exits non-zero with `sandbox not found` or `sandbox '<name>' not found`, `status()` returns `absent`.
- [ ] `destroy()` runs `openshell sandbox delete <name>`.
- [ ] `capabilities()` returns `exec` and `pty`, and never returns `docker`.
- [ ] `resolveExecutionTarget()` returns `OpenShellExecutionTarget` when the entry `agro.json` holds `runtime: "openshell"` and the caller runs on the host.
- [ ] `target.ts` stays unchanged, and `bash .agro/evals/probes/execution-target-contract.sh` exits 0.
- [ ] `openshell-target.ts` exports the pure functions `createArgv`, `attachArgv`, `execArgv`, and `deleteArgv`. Each function returns a `string[]` and spawns no process.
- [ ] `provision()` and `agro sandbox install openshell --print-argv` both use `createArgv()`. A test asserts that both produce the same argv.
- [ ] `openshell-target.ts` exports `openshellPreflight(run)`, which holds the `openshell` binary check and the `openshell status` check that US-004 uses.
- [ ] `status()` parses the JSON output once through `parseOpenShellPhase()`. One frozen table maps each phase to an `ExecutionStatus`. A test proves that an unlisted phase maps to `failed`.
- [ ] Each process in `openshell-target.ts` starts through the injected `LifecycleRunner`. `git grep -n 'child_process' .agro/cli/src/lib/execution/openshell-target.ts` prints nothing.
- [ ] `git grep -nE 'openshell (sandbox|logs|status|policy|gateway)' .agro/cli/src ':!.agro/cli/src/__tests__'` lists only `openshell-target.ts`.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/openshell-target.test.ts .agro/cli/src/__tests__/execution-target.test.ts` exits 0.

### US-004: Register the runtime and provision with `agro sandbox install openshell`

**Description:** As an operator, I want `agro sandbox install openshell` to create a registered OpenShell sandbox so that I use one command for both runtimes.

**Acceptance Criteria:**

- [ ] `RUNTIME_CATALOG` holds an `openshell` entry with `provisionable: true` and `docsPath: "docs/runtimes/openshell.md"`.
- [ ] `SANDBOX_RUNTIMES` equals `["docker", "openshell"]`, and `agro sandbox --help` prints the line `openshell` followed by `provisionable`.
- [ ] If `openshell` is not on `PATH`, the command exits 1 and prints the upstream install command plus a review-first alternative.
- [ ] If `openshell status -o json` exits non-zero or reports a `status` other than `connected`, the command exits 1 and prints the `openshellGatewayHint()` text.
- [ ] `--checkout`, `--home-mount`, and `image.mode: "build"` each make the command exit 1 with a message that names the `openshell` runtime.
- [ ] The command never prompts. Name, timezone, and git identity come from the flags and the `seedConfig()` defaults.
- [ ] `--print-argv` prints the `openshell sandbox create` argv from US-003 and writes no registry entry.
- [ ] A successful run writes `agro.json` with `runtime: "openshell"` and `image.mode: "image"`, then prints `next: agro shell <name>`.
- [ ] If `openshell sandbox create` exits non-zero, the command exits with that code and removes the new registry entry.
- [ ] `docs/configuration.md` lists `openshell` as a value of `runtime`, and `bash .agro/evals/probes/config-schema-parity.sh` exits 0.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/sandbox.test.ts .agro/cli/src/__tests__/tool-catalog.test.ts` exits 0.

### US-005: Route shell, list, and destroy, and refuse the other verbs

**Description:** As an operator, I want `agro shell`, `agro sandbox list`, and `agro destroy` to act on an OpenShell entry so that the core loop needs no second CLI. For each other verb, I want the exact `openshell` command.

**Acceptance Criteria:**

- [ ] For an `openshell` entry, `agro shell` calls `OpenShellExecutionTarget.attach()` and builds no argv in `lifecycle.ts`.
- [ ] `agro sandbox list` prints runtime `openshell` and the status from `OpenShellExecutionTarget.status()`.
- [ ] For an `openshell` entry, `agro destroy` asks the existing confirmation phrase, calls `OpenShellExecutionTarget.destroy()`, and then removes the registry entry.
- [ ] For an `openshell` entry, `agro stop`, `agro restart`, `agro logs`, `agro ps`, `agro compose config`, and `agro sandbox upgrade` each exit 1 and print the `openshell` command from the Architectural Decisions table.
- [ ] For a `docker` entry, each verb produces the same argv as before this task.
- [ ] One resolver reads the entry `runtime` field and returns the verb policy. `git grep -n '"openshell"' .agro/cli/src/commands/lifecycle.ts .agro/cli/src/commands/sandbox-list.ts .agro/cli/src/services/sandbox-upgrade.ts` prints nothing.
- [ ] `SANDBOX_RUNTIMES` is computed from the `RUNTIME_CATALOG` entries with `provisionable: true`, and a test asserts the result `["docker", "openshell"]`.
- [ ] The OpenShell verb table ends with `satisfies Record<LifecycleVerb, VerbPolicy>`. `LifecycleVerb` covers `shell`, `stop`, `restart`, `logs`, `ps`, `destroy`, `config`, and `upgrade`.
- [ ] Each refusal throws `RuntimeUnsupportedError` with the runtime, the verb, and the hint. One catch site in `.agro/cli/src/cli.ts` prints the error and returns exit code 1.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `pnpm exec vitest run .agro/cli/src/__tests__/lifecycle.test.ts .agro/cli/src/__tests__/compose-verbs.test.ts .agro/cli/src/__tests__/destroy.test.ts` exits 0.

### US-006: Document and guard the experimental runtime

**Description:** As an operator, I want a runtime page and a probe so that I know the v1 limits and the support cannot drift.

**Acceptance Criteria:**

- [ ] `docs/runtimes/openshell.md` labels the runtime experimental, interactive-only, and Claude Code only.
- [ ] `docs/runtimes/openshell.md` states the host prerequisites, the verb table, the policy file, and each item in `## Out of Scope`.
- [ ] `docs/runtimes/overview.md` and `docs/lifecycle-commands.md` list `openshell` as provisionable and link the runtime page.
- [ ] `.agro/evals/probes/openshell-runtime-contract.sh` fails if the catalog, the config enum, the policy asset, or the runtime page drops `openshell`.
- [ ] `bash .agro/evals/probes/openshell-runtime-contract.sh` exits 0, and `bash .agro/evals/probes/curl-bash-safe-alternatives.sh` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/runtimes/openshell.md` exits 0.

### US-007: Record manual review evidence

**Description:** As the advisor, I want a live transcript against a real OpenShell gateway so that the PR proves the v1 loop. This story depends on US-001 through US-006.

**Acceptance Criteria:**

- [ ] The operator approves the use of a local OpenShell gateway before the first live command.
- [ ] `.agro/tasks/openshell-sandbox-runtime/evidence/manual-review.md` holds the command transcript with the exit code of each command.
- [ ] Each step in the evidence file states its prerequisites, its location, the command, the trimmed output, and the exit status, as `.agro/skills/git/references/manual-review.md` requires.
- [ ] The evidence file holds the failure path `agro sandbox install openshell --name <name>` with the gateway stopped, with exit status 1 and the `openshellGatewayHint()` text.
- [ ] The transcript shows `agro sandbox install openshell --name <name>` exit 0 and `agro sandbox list` with status `ready`.
- [ ] The transcript shows `whoami` print `sandbox` and `pwd` print `/home/sandbox/harness` inside `agro shell <name>`.
- [ ] The transcript shows `git ls-remote https://github.com/mifunedev/agro` exit 0 and `npm view @anthropic-ai/claude-code version` exit 0 inside the sandbox.
- [ ] The transcript shows `gh auth login && gh auth setup-git` exit 0 inside the sandbox.
- [ ] In a clone of `<writable repository>` inside the sandbox, the transcript shows `git push --dry-run origin HEAD:refs/heads/openshell-review` exit 0.
- [ ] After the operator signs in to Claude Code inside the sandbox, the transcript shows `claude -p 'reply with OK'` exit 0.
- [ ] The transcript names each host in `<claude login hosts>` that the sign-in used.
- [ ] The transcript shows `curl -sS https://example.com` exit non-zero inside the sandbox, because the policy denies the host.
- [ ] The transcript shows `agro stop <name>` exit 1 with the `openshell sandbox stop <name>` hint.
- [ ] The transcript ends with `agro destroy <name>` exit 0, then `openshell sandbox list` and `agro sandbox list` without the test sandbox.

## Summary

### Verified current state

- `RUNTIME_CATALOG` holds `docker` as provisionable and `microsandbox` as planned. `runSandboxInstall()` refuses each entry with `provisionable: false`.
- `SANDBOX_RUNTIMES` equals `["docker"]`. `seedConfig()` writes `runtime = "docker"` into each new entry.
- `resolveExecutionTarget()` returns `LocalExecutionTarget` inside a sandbox and `DockerComposeExecutionTarget` on the host. No branch reads `runtime`.
- `runShell()` attaches through the target. `runComposeVerb()` calls `docker-compose.sh` directly for stop, restart, logs, ps, and destroy.
- The image sets `CMD ["/sbin/init"]` and declares no `USER`. The root `entrypoint.sh` seeds `/opt/home-seed` and `/opt/agro-seed`, and uses `gosu` and `chown`.
- `agro-cron.service` runs `cron-runtime.ts` under systemd. No other process starts the cron runtime.
- `~/.local/bin/claude` links to `~/.local/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe`, which is an ELF binary.

### Verified OpenShell facts (v0.1.2, released 2026-09-28, Apache 2.0)

- A gateway is the control plane. A compute driver creates each sandbox as a workload plus a supervisor. The local driver order is Kubernetes, Podman, then Docker.
- The Linux gateway runs as the user service `openshell-gateway` on `https://127.0.0.1:17670`. No `gateway start` verb exists.
- The install command is `curl -LsSf https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh | sh`. The variable `OPENSHELL_VERSION=v0.1.2` pins the version.
- Host floors: Docker 28.0, Landlock ABI 3 (Linux 6.2), and seccomp user notification. Upstream marks WSL 2 as experimental.
- `--from` accepts an image reference and builds no Dockerfile. OpenShell replaces the image `ENTRYPOINT`, `CMD`, and `USER` with its supervisor.
- The workload runs as one non-root user with no capabilities. The Docker driver rejects a root image unless the policy sets a non-root `run_as_user`.
- Egress is denied by default. Network rules hot-reload. Filesystem and process fields apply only at creation.
- A gateway restart or host reboot stops every process. `sandbox start` launches a new main process on the kept container.
- Bind mounts need three gateway settings, and upstream warns that bind mounts bypass the filesystem policy.

### Selected approach

V1 is a narrow, experimental, interactive-only slice. The slice proves one loop: install, shell, list, and destroy, with Claude Code under a default-deny policy.

The published AGRO image runs with two additions. The policy sets `run_as_user: sandbox`. The new `openshell-main.sh` seeds the workspace and sleeps as the main process.

V1 defers each feature that depends on OpenShell behavior that no AGRO run has observed. The cron runtime is the largest deferral, because a gateway restart stops every process. The US-007 transcript gives the evidence for the follow-up design.

This approach rejects three alternatives:

- A planned catalog entry plus `agro tool install openshell` gives the operator no runnable sandbox.
- OpenShell nested inside the Docker sandbox needs the host Docker socket, which equals root on the host. Upstream documents no nested mode.
- A second OpenShell-only image doubles the release surface. The policy fields make the existing image compatible.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/runtimes/catalog.ts` | `RUNTIME_CATALOG`, `findRuntime` | Declares `openshell` as provisionable |
| `.agro/cli/src/lib/agro-config.ts` | `SANDBOX_RUNTIMES`, `AGRO_CONFIG_FIELDS` | Accepts `runtime: "openshell"` |
| `.agro/cli/src/commands/sandbox.ts` | `runSandboxInstall`, `seedConfig` | Preflight, refusals, and entry write |
| `.agro/cli/src/lib/registry.ts` | `materialize` | Writes the policy asset into an `openshell` entry |
| `.agro/cli/src/lib/execution/index.ts` | `resolveExecutionTarget` | Selects the target from the entry runtime |
| `.agro/cli/src/lib/execution/openshell-target.ts` | `OpenShellExecutionTarget` | New adapter over the `openshell` CLI |
| `.agro/cli/src/commands/lifecycle.ts` | `runShell`, `runComposeVerb`, `runDestroy`, `runComposeConfig` | Routes or refuses each verb by runtime |
| `.agro/cli/src/commands/sandbox-list.ts` | `runSandboxList` | Prints the OpenShell status |
| `.agro/cli/src/services/sandbox-upgrade.ts` | upgrade entry point | Refuses an `openshell` entry |
| `.devcontainer/entrypoint.sh` | `seed_home`, `seed_workspace_volume` | Adds the non-root branch |
| `.devcontainer/openshell-main.sh` | new script | Long-lived main process |
| `.devcontainer/openshell-policy.yaml` | new policy | Canonical default-deny policy |
| `.devcontainer/Dockerfile` | `WORKDIR`, `COPY` lines | Ships the script and the workspace owner |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro sandbox install openshell` | New runtime value | Non-interactive preflight, then `openshell sandbox create` |
| `agro sandbox --help` | Output change | Lists `openshell  provisionable` |
| `agro shell`, `agro sandbox list`, `agro destroy` | Runtime dispatch | Calls `OpenShellExecutionTarget` for an `openshell` entry |
| `agro stop`, `restart`, `logs`, `ps`, `compose config`, `sandbox upgrade` | New refusal | Exits 1 with the `openshell` command |
| `agro.json` `runtime` | Enum extension | Adds `openshell` |
| Published image | Additive | Adds `openshell-main.sh` and the harness directory owner |
| `mifunedev/agro-web` | Public documentation | Follow-up issue adds the runtime page after merge |

## Storage

The registry entry stays at `${AGRO_HOME:-~/.agro}/sandboxes/<name>/`. The entry holds `agro.json`, `.env`, and `openshell-policy.yaml`. The entry holds no compose file.

The OpenShell gateway owns the sandbox record in its SQLite store. The Docker driver keeps the container and its writable layer. The home directory and the workspace live in that layer. `agro destroy` deletes both through `openshell sandbox delete <name>`.

## Architectural Decisions

- **Source of truth.** The entry field `runtime` selects the target. `resolveExecutionTarget()` reads that field. No second selector key exists, and the `sandbox.substrate` question in #731 stays open.
- **Execution location.** Every `openshell` command runs on the host. Agent work runs inside the OpenShell workload. The CLI never installs OpenShell on the host.
- **Gateway.** The CLI uses the active gateway of the host `openshell` CLI. A per-entry gateway field waits for a real need.
- **Image.** The CLI uses the official image reference, or the `--image=<ref>` value. Build mode stays Docker-only.
- **Process model.** `openshell-main.sh` is the main process. The script runs the non-root bootstrap and sleeps. Interactive agents run in Herdr, which the operator installs with `agro tool install herdr`.
- **Policy.** `.devcontainer/openshell-policy.yaml` is the canonical source. `materialize()` rewrites the entry copy on every lifecycle call. The operator changes the live network policy with `openshell policy set <name> --policy <file> --wait`.
- **GitHub access.** The operator approved `git push` for agents on 2026-09-28. The `github` rule grants read and push over HTTPS.
- **Binary scope.** Each network rule names the programs that need the rule. Claude Code installs as the native binary `claude.exe`, so Node gets no Anthropic access.
- **Claude Code tools.** Claude Code tools such as WebFetch reach only the `anthropic` hosts. The runtime page states this limit.
- **Credentials.** The operator runs `gh auth login && gh auth setup-git` inside the sandbox, as in the Docker lifecycle.
- **Sandbox detection.** `--env AGRO_EXECUTION_TARGET=local` makes `runningInsideSandbox()` return true without `/.dockerenv`.

| OpenShell phase | `ExecutionStatus` |
|---|---|
| `Ready` | `ready` |
| `Provisioning`, `Starting` | `starting` |
| `Stopping`, `Stopped`, `Deleting`, `Completed` | `stopped` |
| `Error`, `Unknown`, `Unspecified`, or an unlisted value | `failed` |
| `sandbox not found` | `absent` |

The phase names come from `SandboxPhase` in `proto/openshell.proto` at tag `v0.1.2`. `openshell status` exits 0 when the gateway is down, so the preflight reads the JSON `status` field. `openshell gateway add` requires an endpoint, so the hint names `https://127.0.0.1:17670`. An upstream test asserts the JSON value `"Ready"`.

| agro verb | V1 behavior |
|---|---|
| `agro shell <name>` | runs `openshell sandbox exec -n <name> --tty --workdir /home/sandbox/harness -- zsh -l` |
| `agro sandbox list` | reads `openshell sandbox get <name>` |
| `agro destroy <name>` | runs `openshell sandbox delete <name>`, then removes the entry |
| `agro stop <name>` | refuses; prints `openshell sandbox stop <name>` |
| `agro restart <name>` | refuses; prints `openshell sandbox stop <name> && openshell sandbox start <name>` |
| `agro logs <name>` | refuses; prints `openshell logs <name>` |
| `agro ps <name>` | refuses; prints `openshell sandbox get <name>` |
| `agro compose config` | refuses; prints `openshell policy get <name>` |
| `agro sandbox upgrade <name>` | refuses; names the `openshell` runtime |

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/sandbox-boot-smoke.sh` | Docker boot stays green | US-001 |
| `.agro/cli/src/__tests__/sandbox.test.ts` | policy materialize; help line; missing binary; gateway down; `--checkout` refusal; `--print-argv`; failed create cleanup | US-002, US-004 |
| `.agro/cli/src/__tests__/openshell-target.test.ts` | provision argv; attach argv; exec flags; status map; destroy argv; capability set | US-003 |
| `.agro/cli/src/__tests__/execution-target.test.ts` | runtime dispatch in `resolveExecutionTarget()` | US-003 |
| `.agro/evals/probes/execution-target-contract.sh` | the contract names no substrate | US-003 |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | shell routing; refusal text for each refused verb | US-005 |
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | Docker argv unchanged | US-005 |
| `.agro/cli/src/__tests__/destroy.test.ts` | OpenShell delete, then entry removal | US-005 |
| `.agro/evals/probes/openshell-runtime-contract.sh` | catalog, enum, asset, and doc stay aligned | US-006 |
| `.agro/tasks/openshell-sandbox-runtime/evidence/manual-review.md` | live v1 loop transcript | US-007 |

Each unit test stubs the `LifecycleRunner` and asserts the `openshell` argv. No unit test needs a live gateway.

## Design Principles

- **One dispatch point.** One resolver reads the entry `runtime` field. `lifecycle.ts`, `sandbox-list.ts`, and `sandbox-upgrade.ts` never compare runtime strings.
- **Exhaustive verb tables.** Each runtime declares `route` or `refuse` for each `LifecycleVerb`. A new verb or a new runtime fails `typecheck` until a person decides.
- **One adapter file per upstream.** `openshell-target.ts` holds each `openshell` flag. An upstream flag change edits one file.
- **Pure argv builders.** Functions build argv, and methods run argv. `--print-argv` and `provision()` share one builder.
- **Parse once at the edge.** `parseOpenShellPhase()` turns upstream output into a typed phase. One table maps the phase to a status.
- **One typed refusal.** `RuntimeUnsupportedError` carries the runtime, the verb, and the hint. One catch site prints the error.
- **Injected effects.** Each process starts through the injected `LifecycleRunner`. No unit test needs a live gateway.
- **Scripts split by privilege.** `entrypoint.sh` selects the root steps or the user steps with one `id -u` check. Each step checks before the step acts. `openshell-main.sh` calls `entrypoint.sh` and copies no logic.
- **Policy as data.** `.devcontainer/openshell-policy.yaml` is the only copy. TypeScript imports the file as an asset and never edits the file.
- **Names over comments.** Names and tests carry intent, as the root `AGENTS.md` requires.
- **Keep one image and one lifecycle door.** The OpenShell path changes no Docker behavior. A refused verb prints the exact `openshell` command.
- **Keep the host clean.** The CLI checks for OpenShell and prints the install command, but never runs the command.
- **Stop at two runtimes.** Build no plugin system and no runtime SDK. Review the abstraction when a third runtime arrives.

## Out of Scope

Each deferred item gets one follow-up issue after merge.

- The cron runtime and every unattended schedule. A gateway restart stops every process, so the design waits for the US-007 evidence.
- Routed `stop`, `restart`, `logs`, and `ps` verbs. V1 prints the `openshell` command instead.
- The interactive install wizard and a minimum-version check.
- Network rules for PyPI and OpenAI, and support for Python tooling and Codex.
- The `--checkout` bind mount. Bind mounts bypass the OpenShell filesystem policy and need three gateway settings.
- The Docker socket, sshd, and Docker inside the sandbox. The workload has no capabilities and no inbound network.
- Root tool installs inside the sandbox. `no_new_privs` blocks `sudo`, so each `installUser: "root"` tool fails.
- OpenShell provider credential injection and the upstream provider profiles.
- The MicroVM and Kubernetes drivers. The manual review covers the Docker driver only.
- Host install of the `openshell` binary by `agro`.
- The public page in `mifunedev/agro-web`.

## Open Questions

None. The operator approved `git push` on 2026-09-28. The v0.1.2 source settles the phase names. The native `claude.exe` binary removes the Node breadth question.

## Acceptance Criteria

- [ ] `agro sandbox install openshell --name <name>` creates a running OpenShell sandbox on a host with a local gateway.
- [ ] `agro shell <name>` opens `zsh` as `sandbox` in `/home/sandbox/harness` inside that sandbox.
- [ ] Each refused verb exits 1 and prints its `openshell` command.
- [ ] Each Docker lifecycle test and `bash .agro/scripts/sandbox-boot-smoke.sh` exit 0.
- [ ] `pnpm test` exits 0, and `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .agro/evals/probes/openshell-runtime-contract.sh` and `bash .agro/evals/probes/execution-target-contract.sh` exit 0.
- [ ] `.agro/tasks/openshell-sandbox-runtime/evidence/manual-review.md` holds the US-007 transcript.
- [ ] The PR `## Manual review` section follows the server, CLI, or API shape, and `bash .agro/skills/git/scripts/manual-review-check.sh <body-file>` exits 0.

## Lessons

Filled by the advisor before undraft.
