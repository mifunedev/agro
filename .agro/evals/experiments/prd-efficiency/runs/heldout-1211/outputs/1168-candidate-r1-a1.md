# PRD: Node host tools

Status: DRAFT

Source: `work/issue-1168.md` (issue #1168). Branch: `feat/1168-node-host-tools`. Pull request target: `development`.

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want `agro tool install <id> --host` to run a root-level installer through `sudo` so that a dedicated VM can install system packages with `agro`.

**Acceptance Criteria:**

- [ ] `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` gains a `hostRoot?: boolean` field. Each existing entry omits the field and keeps its behavior.
- [ ] `ToolEntry` gains a `hostOnly?: boolean` field. A host-only entry has a `hostInstallArgv` and no `installArgv`.
- [ ] If the invoking user is root, `installOnHost` runs the root-level script with no `sudo`.
- [ ] If the invoking user is not root, `installOnHost` runs the root-level script through `sudo -n`.
- [ ] If `sudo -n true` exits non-zero, the command exits 1. The message names the tool and states that the tool needs passwordless `sudo`. The runner records no install call and no `hostTools` record.
- [ ] The root-level script receives the invoking user name in `AGRO_INVOKING_USER` and the invoking home in `AGRO_INVOKING_HOME`.
- [ ] On the host, `agro tool install <host-only id>` takes the host path when the sandbox runs.
- [ ] Inside the sandbox (`AGRO_EXECUTION_TARGET=local`), `agro tool install <host-only id>` exits 1 and names `agro tool install <id> --host` on the host.
- [ ] `agro tool list` adds a `HOST` column with the value `root`, `user`, or `no`. `agro tool status` prints `on the host: yes (root)` for a root-level tool.
- [ ] `.agro/cli/src/__tests__/tool.test.ts` covers the root user, a user with passwordless `sudo`, and a user without passwordless `sudo`. Each case fails before the change and passes after the change.

### US-002: Add the code-server tool

**Description:** As an operator, I want `agro tool install code-server --host` so that `agro` owns the code-server version on every node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry with `kind: "installable"`, `installUser: "sandbox"`, `hostCapable: true`, no `hostRoot`, and an `uninstallArgv`.
- [ ] The script pins code-server `4.129.0`. The script checks the SHA-256 of the release tarball with `sha256sum -c -`.
- [ ] The `amd64` hash is `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0`. The `arm64` hash is `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617`.
- [ ] If `dpkg --print-architecture` prints a value other than `amd64` or `arm64`, the script exits non-zero and prints that value.
- [ ] The script extracts the tarball to `${NPM_USER_PREFIX:-$HOME/.local}/lib/code-server-4.129.0`.
- [ ] The script links `${NPM_USER_PREFIX:-$HOME/.local}/bin/code-server` to `bin/code-server` in the extracted directory.
- [ ] On a Linux host, after `agro tool install code-server --host`, `$HOME/.local/bin/code-server --version` prints a line that starts with `4.129.0`.
- [ ] `agro tool uninstall code-server --host` removes the link and the extracted directory.
- [ ] `.agro/cli/src/__tests__/tool-catalog.test.ts` lists `code-server` in the sha256 test and asserts both pinned hashes.

### US-003: Add the docker tool

**Description:** As an operator, I want `agro tool install docker --host` so that every node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `docker` entry with `hostCapable: true`, `hostOnly: true`, and `hostRoot: true` (US-001).
- [ ] The `docker` entry verifies with `command -v dockerd`, so the baked-in `docker-cli` in the sandbox does not satisfy the probe.
- [ ] The script adds Docker's apt repository for Ubuntu with a checked repository key.
- [ ] The script installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin`.
- [ ] The script adds `$AGRO_INVOKING_USER` to the `docker` group and runs `systemctl enable --now docker`.
- [ ] On Ubuntu 24.04, after the install and a new login, `docker run --rm hello-world` exits 0 for the invoking user.
- [ ] On Ubuntu 24.04, after the install and a new login, `docker compose version` exits 0 for the invoking user.
- [ ] Inside an AGRO sandbox, `agro tool install docker` exits 1. The message names `access.dockerSocket`.
- [ ] A second `agro tool install docker --host` exits 0 and prints `docker: already installed`.

### US-004: Add the desktop tool

**Description:** As an operator, I want `agro tool install desktop --host` so that a node can serve an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry with `hostCapable: true`, `hostOnly: true`, and `hostRoot: true` (US-001).
- [ ] If `command -v tailscale` fails, the command exits 1 before the `sudo` check. The message names `agro tool install tailscale --host`.
- [ ] The script installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`.
- [ ] The script writes `xfce4-session` to `$AGRO_INVOKING_HOME/.xsession`.
- [ ] The script adds the `xrdp` user to `ssl-cert` and runs `systemctl enable --now xrdp`.
- [ ] After the install, TCP 3389 accepts connections on the Tailscale address. TCP 3389 refuses connections on the public address.
- [ ] The script changes no SSH firewall rule. The script sets no password.
- [ ] On completion, the command prints two remaining operator steps: `sudo tailscale up` and `sudo passwd <user>`.
- [ ] The script follows steps 3 to 6 of `https://github.com/ryaneggz/runbooks/blob/main/runbooks/ubuntu-24-xfce-xrdp-tailscale.md`.
- [ ] Inside an AGRO sandbox, `agro tool install desktop` exits 1 and names `agro tool install desktop --host`.

### US-005: Pin the workspace ref

**Description:** As an operator, I want `agro workspace create --ref <tag>` so that a node's workspace matches the CLI release.

**Acceptance Criteria:**

- [ ] `parseWorkspaceArgs` in `.agro/cli/src/cli.ts` accepts `--ref <v>` and `--ref=<v>`, and rejects a missing value.
- [ ] `agro workspace create [<name>] --ref <ref>` runs `git clone --branch <ref> https://github.com/mifunedev/agro.git <target>`.
- [ ] If `<ref>` does not exist, the command exits 1 and names the ref. The target directory does not exist after the command.
- [ ] If the target already holds a `.git` checkout and `--ref` is set, the command exits 1, names the path, and changes nothing.
- [ ] Without `--ref`, the runner receives the same `git clone` argv as before the change.
- [ ] `docs/lifecycle-commands.md` documents `--ref` in the verb table and in the `agro workspace` section.
- [ ] `.agro/cli/src/__tests__/workspace.test.ts` covers a tag, a missing ref, an existing checkout, and no `--ref`.

### US-006: Document and release

**Description:** As an operator, I want the tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` list `code-server`, `docker`, and `desktop`.
- [ ] Both documents state that `docker` and `desktop` are root-level and need passwordless `sudo`.
- [ ] `docs/lifecycle-commands.md` states that `agent-browser` has a host install, to match `hostInstallArgv` in the catalog.
- [ ] `CHANGELOG.md` has one `[Unreleased]` entry for each of US-001 to US-005, each linked to issue #1168.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] Every probe in `.agro/evals/probes/` reports PASS or SKIPPED under `/eval`.
- [ ] The pull request body has a `## Host install evidence` section. The section lists the commands and exit codes of US-002 to US-005 on an Ubuntu 24.04 host.
- [ ] The evidence section lists each check that did not run as `NOT RUN` with the reason.
- [ ] The release workflow publishes AGRO `0.15.0` with these changes.

## Summary

Verified current state:

- `ToolEntry` has `installUser?: "root" | "sandbox"`, `hostInstallArgv`, `hostCapable`, and `hostUninstallArgv` (`.agro/cli/src/lib/tools/catalog.ts:5-23`). `installUser` controls only the sandbox install.
- Every installable entry uses `installUser: "sandbox"`. `tool-catalog.test.ts:49` enforces this rule, because a root install in the sandbox hangs on a `sudo` password prompt (#906).
- `tool-catalog.test.ts:76` forbids `apt`, `dpkg -i`, `sudo`, and `--with-deps` in every `hostInstallArgv`.
- `tool-catalog.test.ts:57` requires each `curl -fsSL` script to contain `NPM_USER_PREFIX` and `sha256sum -c -`. The test pins the list of ids.
- `runToolInstall` refuses an entry with no `installArgv` before the host path (`tool.ts:519`). The command takes the host path only when the sandbox is unreachable (`tool.ts:529`). A `--host` flag with a running sandbox installs into the sandbox.
- `installOnHost` runs the host script through `LocalExecutionTarget` with `NPM_USER_PREFIX` and records `hostTools` in the host `agro.json` (`tool.ts:380-506`).
- `agent-browser` has a `hostInstallArgv` that installs no system package (`catalog.ts:41`). `docs/lifecycle-commands.md:313` states the opposite. `docs/installation.md:236` matches the code. The issue repeats the stale claim.
- `docker-cli` is baked into the sandbox image and has `hostCapable: false`. No entry installs Docker Engine.
- `tailscale` is host-capable and installs into `~/.local`.
- `ensureHostWorkspace` runs `git clone https://github.com/mifunedev/agro.git <target>` and has no ref argument (`.agro/cli/src/lib/host-workspace.ts:60-91`).
- The root and CLI `package.json` files both hold version `0.14.0`.

Selected approach:

1. Add `hostRoot` and `hostOnly` to `ToolEntry`. Keep `installUser` for the sandbox install only.
2. Scope the package-manager test to entries without `hostRoot`. Keep the sandbox-user test unchanged.
3. Route each host-only entry to `installOnHost` on the host. Refuse each host-only entry inside the sandbox.
4. Pass `ref` from `runWorkspaceCreate` to `ensureHostWorkspace`, and add `--branch <ref>` to the clone argv.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG`, `installableToolIds`, `resolveToolInstallArgv` | `hostRoot` and `hostOnly` fields; `code-server`, `docker`, and `desktop` entries. |
| `.agro/cli/src/commands/tool.ts` | `runToolInstall`, `installOnHost`, `renderTable`, `renderDetail`, `rowOf` | Host-only routing, sandbox refusal, `sudo -n` check, `HOST` column. |
| `.agro/cli/src/lib/execution/local-target.ts` | `LocalExecutionTarget` | Runs a `user: "root"` call through `sudo --` (`tool-catalog.test.ts:46`). The root-level path needs `sudo -n`. |
| `.agro/cli/src/commands/workspace.ts` | `WorkspaceOptions`, `runWorkspaceCreate` | `ref` option and existing-checkout refusal. |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `cloneInto`, `cloneThroughStaging` | `--branch <ref>` in the clone argv. |
| `.agro/cli/src/cli.ts` | `parseWorkspaceArgs` (line 1039), workspace dispatch (line 1591) | `--ref` flag and help text. |
| `.agro/evals/probes/agent-browser-host-boundary.sh` | probe | Guards the host install boundary. The probe must stay green. |
| `docs/installation.md`, `docs/lifecycle-commands.md`, `CHANGELOG.md` | tool list, verb table, `[Unreleased]` | Documentation. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server [--host]` | New tool | User-level install in the sandbox or on the host. |
| `agro tool install docker --host` | New tool | Root-level, host-only Docker Engine and Compose install. |
| `agro tool install desktop --host` | New tool | Root-level, host-only XFCE and xrdp install behind Tailscale. |
| `agro tool list`, `agro tool status` | Output | New `HOST` column with `root`, `user`, or `no`. |
| `agro workspace create --ref <ref>` | New flag | Clones the named tag or branch. |
| `ToolEntry` | Type | New optional `hostRoot` and `hostOnly` fields. |

## Storage

N/A. The existing `hostTools` record in the host `agro.json` records each host install. The record format does not change.

## Architectural Decisions

- A dedicated VM can install system packages. The catalog marks those tools with `hostRoot: true`. The command does not refuse them.
- The sandbox never runs a root-level installer. The sandbox-user rule from #906 stays unchanged.
- `hostOnly` tools have no sandbox install. On the host, `agro` routes them to the host path. Inside the sandbox, `agro` refuses them.
- The `sudo -n true` check runs before any install call. The command never waits on a password prompt.
- A tool that needs an interactive credential stops before the credential step and prints the step.
- The desktop tool never exposes RDP on the public address.
- `--ref` passes to `git clone --branch`. The flag accepts a tag or a branch. The flag does not accept a commit SHA.
- `--ref` never moves an existing checkout. The command refuses instead, so a reused workspace never reports a ref it does not hold.
- The `docker` id installs the engine on the host. The `docker-cli` id stays the baked-in sandbox CLI.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | `hostRoot` and `hostOnly` shape; package-manager rule scoped to entries without `hostRoot`; `code-server` in the sha256 list; pinned hashes; `docker` verifies `dockerd` | US-001 to US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | root user runs with no `sudo`; non-root user runs through `sudo -n`; failed `sudo -n true` exits 1 with no install call and no record | US-001 |
| `.agro/cli/src/__tests__/tool.test.ts` | host-only tool on the host with a running sandbox takes the host path; host-only tool inside the sandbox exits 1 | US-001, US-003, US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | `docker` refusal names `access.dockerSocket`; `desktop` without `tailscale` names `agro tool install tailscale --host` | US-003, US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | `HOST` column values; `on the host: yes (root)` | US-001 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `--ref` parse forms; tag clone argv; missing ref exits 1 with no target; existing checkout refusal; no `--ref` argv unchanged | US-005 |
| `.agro/evals/probes/*.sh` | full suite under `/eval` | US-006 |
| Ubuntu 24.04 host | commands and exit codes from US-002 to US-005 | US-006 evidence |

## Design Principles

- One owner: `agro` owns tool versions and install steps.
- Each install is idempotent. A second run exits 0 and changes nothing.
- A root-level install fails fast. The command never prompts for a password.
- Add no comments to tracked code.
- Change the canonical `.agro/cli` source. Do not patch a built bundle.

## Out of Scope

- A Tailscale auth key flow.
- A firewall policy beyond port 3389.
- Non-Ubuntu hosts.
- A root-level install inside the sandbox.
- A commit SHA for `--ref`.
- Changes in `mifunedev/agro-console`. That repository consumes the release.

## Open Questions

1. The plan adds a `HOST` column to `agro tool list`. The issue says only "marks". Confirm the column, or name another marker.
2. The runbook for US-004 is external. The implementer must read steps 3 to 6 to choose the 3389 restriction (a `ufw` rule on `tailscale0` or an xrdp bind address).
3. `mifunedev/agro-web` documents the catalog of installable tools. Confirm whether this task updates that repository or a follow-up issue does.

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, `agro tool install docker --host` exits 0.
- [ ] On the same VM, `agro tool install code-server --host` exits 0.
- [ ] On the same VM, `agro workspace create --ref v0.15.0` exits 0.
- [ ] Every story acceptance criterion in US-001 to US-006 is checked.
- [ ] AGRO `0.15.0` is released.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
