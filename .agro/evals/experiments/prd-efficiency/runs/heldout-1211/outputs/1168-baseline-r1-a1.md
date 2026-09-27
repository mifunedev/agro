# PRD: Node host tools

Status: BLOCKED

Source: `work/issue-1168.md`. Branch: `feat/1168-node-host-tools`. Pull request title: `FROM feat/1168-node-host-tools TO development`.

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want `agro tool install <id> --host` to run a root-level installer through `sudo` so that a dedicated VM can install system packages with `agro`.

**Acceptance Criteria:**

- [ ] `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` gains the optional field `hostInstallUser?: "root"`. The existing entries do not set the field and keep their behavior.
- [ ] `ToolEntry` gains the optional field `hostRequires?: readonly string[]`. The field names catalog tool ids that must be installed on the host before the install starts.
- [ ] `ToolEntry` gains the optional field `hostNextSteps?: (user: string) => readonly string[]`. After a successful host install, `installOnHost` prints each step on its own line.
- [ ] If the invoking user has uid 0, `installOnHost` runs a root-level script without `sudo`.
- [ ] If the invoking user does not have uid 0, `installOnHost` first runs `sudo -n true`. If that probe exits 0, `installOnHost` runs the script as `sudo -n -- env AGRO_TOOL_USER=<user> <argv>`.
- [ ] A root-level script receives the invoking user name in `AGRO_TOOL_USER` in both cases.
- [ ] If `sudo -n true` exits non-zero, the command exits 1. The command prints a message that names the tool and states that the tool needs passwordless `sudo`. The command runs no installer and writes no `hostTools` record.
- [ ] If a tool in `hostRequires` is not installed on the host, the command exits 1 and prints `agro tool install <required-id> --host`. The command runs no installer.
- [ ] `agro tool list` shows a `HOST` column. The column reads `root` for a root-level host tool, `user` for another host-capable tool, and `-` for a tool with no host install. `agro tool list --json` adds `hostInstallUser` to each row.
- [ ] `.agro/cli/src/__tests__/tool.test.ts` covers a uid-0 user, a user with passwordless `sudo`, a user without it, and a missing `hostRequires` tool.
- [ ] `.agro/cli/src/__tests__/tool-catalog.test.ts` and `.agro/evals/probes/agent-browser-host-boundary.sh` keep the package-manager and `sudo` ban for each host installer without `hostInstallUser: "root"`. Both checks exempt only root-level entries.
- [ ] `bash .agro/evals/probes/agent-browser-host-boundary.sh` exits 0.

### US-002: Add the code-server tool

**Description:** As an operator, I want `agro tool install code-server --host` so that `agro` owns the code-server version on every node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry with `kind: "installable"`, `installUser: "sandbox"`, `hostCapable: true`, and no `hostInstallUser`.
- [ ] The entry has an `uninstallArgv` that removes `${HARNESS_PREFIX_TOKEN}/bin/code-server` and `${HARNESS_PREFIX_TOKEN}/lib/code-server-4.129.0`.
- [ ] The script pins code-server `4.129.0`. The script checks the SHA-256 of the release tarball: `amd64` `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0`, `arm64` `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617`.
- [ ] If `dpkg --print-architecture` prints a value other than `amd64` or `arm64`, the script exits non-zero and prints that value.
- [ ] The script sets `prefix="${NPM_USER_PREFIX:-$HOME/.local}"`, extracts the tarball to `$prefix/lib/code-server-4.129.0`, and links `$prefix/bin/code-server` to `$prefix/lib/code-server-4.129.0/bin/code-server`.
- [ ] After `agro tool install code-server --host` on a Linux host, `$HOME/.local/bin/code-server --version` prints a line that starts with `4.129.0`.
- [ ] `agro tool uninstall code-server --host` removes the link and the extracted directory.

### US-003: Add the docker tool

**Description:** As an operator, I want `agro tool install docker --host` so that every node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `docker` entry with `hostCapable: true`, `hostInstallUser: "root"`, a `hostInstallArgv`, and no `installArgv`.
- [ ] The `docker` entry `verifyArgv` exits 0 only when `docker compose version` exits 0 and `systemctl is-enabled docker` prints `enabled`. The baked-in `docker-cli` entry alone does not satisfy the check.
- [ ] The script installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin` from Docker's apt repository for Ubuntu. The script checks the repository key.
- [ ] The script adds the user in `AGRO_TOOL_USER` to the `docker` group and runs `systemctl enable --now docker`.
- [ ] After the install and a new login, `docker run --rm hello-world` exits 0 and `docker compose version` exits 0 for the invoking user.
- [ ] Inside an AGRO sandbox, `agro tool install docker` exits 1 with a message that names `access.dockerSocket`.
- [ ] A second `agro tool install docker --host` exits 0, prints `docker: already installed`, and runs no installer.

### US-004: Add the desktop tool

**Description:** As an operator, I want `agro tool install desktop --host` so that a node can serve an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry with `hostCapable: true`, `hostInstallUser: "root"`, `hostRequires: ["tailscale"]`, a `hostInstallArgv`, and no `installArgv`.
- [ ] If `tailscale` is not installed on the host, the command exits 1 and prints `agro tool install tailscale --host`.
- [ ] Inside an AGRO sandbox, `agro tool install desktop` exits 1 with a message that states that `desktop` installs only on the host.
- [ ] The script installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`.
- [ ] The script writes `xfce4-session` to `~/.xsession` of the user in `AGRO_TOOL_USER`, runs `adduser xrdp ssl-cert`, and runs `systemctl enable --now xrdp`.
- [ ] The script restricts TCP 3389 by the mechanism that Open Question 2 selects. The script changes no rule for TCP 22 and runs no `passwd` command.
- [ ] After the install and the two operator steps, TCP 3389 accepts a connection on the Tailscale address. TCP 3389 refuses a connection on the public address.
- [ ] On completion, the command prints the two remaining operator steps: `sudo tailscale up` and `sudo passwd <user>`, with `<user>` replaced by the invoking user name.
- [ ] The script follows `https://github.com/ryaneggz/runbooks/blob/main/runbooks/ubuntu-24-xfce-xrdp-tailscale.md`, steps 3 to 6. The script does not run step 5 (`sudo passwd`).

### US-005: Pin the workspace ref

**Description:** As an operator, I want `agro workspace create --ref <tag>` so that a node's workspace matches the CLI release.

**Acceptance Criteria:**

- [ ] `parseWorkspaceArgs` in `.agro/cli/src/cli.ts` accepts `--ref <ref>` and `--ref=<ref>` for `create`. The parser rejects `--ref` for `list`, rejects an empty ref, and rejects a ref that starts with `-`.
- [ ] `agro workspace create [<name>] --ref <ref>` runs `git clone --branch <ref> -- https://github.com/mifunedev/agro.git <target>`.
- [ ] If `<ref>` does not exist, the command exits 1, prints the ref, and leaves no target directory.
- [ ] Without `--ref`, the command runs the same `git clone` argv as before this change.
- [ ] If the target directory already holds a git checkout, `--ref` does not change that checkout. The command prints the reuse message as before.
- [ ] `docs/lifecycle-commands.md` and the `agro workspace --help` text document `--ref`.
- [ ] `.agro/cli/src/__tests__/workspace.test.ts` covers a tag, a missing ref, and no `--ref`.

### US-006: Document and release

**Description:** As an operator, I want the tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` list `code-server`, `docker`, and `desktop`, and state that `docker` and `desktop` are root-level.
- [ ] `docs/lifecycle-commands.md` no longer states that `agent-browser` has no host install.
- [ ] `CHANGELOG.md` has entries under `## [Unreleased]` for US-001 to US-005.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] Each script in `.agro/evals/probes/` exits 0 or reports `SKIPPED`.
- [ ] The pull request body has a `## Host install evidence` section. The section lists the commands and exit codes of US-002 to US-005 on an Ubuntu 24.04 host. The section lists a check that did not run as `NOT RUN` with the reason.
- [ ] AGRO `0.15.0` publishes the changes.

## Summary

Verified current state:

- `installOnHost` in `.agro/cli/src/commands/tool.ts` runs each host installer as the invoking user with `NPM_USER_PREFIX=~/.local`. The function writes a `hostTools` receipt to the host config after a successful install.
- `runToolInstall` refuses each entry without `installArgv` before `runToolInstall` checks the sandbox. A host-only entry therefore needs a change to that gate.
- `runToolInstall` takes the host path only when the sandbox is not reachable. Inside a sandbox, `runningInsideSandbox` selects the local target, and the sandbox path runs.
- `LocalExecutionTarget.argvFor` runs a `user: "root"` request with `sudo --` when `stdio` is `"inherit"`. That form prompts for a password. US-001 therefore builds the `sudo -n` argv in `installOnHost`.
- A host install needs an existing AGRO workspace. `resolveExistingWorkspace` refuses otherwise, and `.agro/evals/probes/host-workspace-door.sh` guards that rule. The task-level acceptance criterion therefore runs `agro workspace create` first.
- `agent-browser` has a host install: `hostInstallArgv` fetches a pinned binary. `docs/lifecycle-commands.md` still states the opposite. The issue summary repeats the stale statement.
- `tool-catalog.test.ts` ("keeps every host installer clear of the operating system package manager") and `agent-browser-host-boundary.sh` ban `apt`, `dpkg -i`, and `sudo` in every `hostInstallArgv`. The same test file requires `installUser: "sandbox"` and an `installArgv` for each `installable` entry. The `docker` and `desktop` entries break these checks. US-001 narrows the checks to entries without `hostInstallUser: "root"`.
- The `tailscale` host install puts `tailscale` and `tailscaled` in `~/.local/bin`. The install creates no systemd unit, and `sudo` does not search `~/.local/bin`. The printed step `sudo tailscale up` therefore fails after the current `tailscale` host install. Open Question 1 records this gap.
- `fetchRemoteSource` in `.agro/cli/src/lib/remote.ts` already clones with `--branch <ref>` and rejects a ref that starts with `-`. `cloneInto` in `.agro/cli/src/lib/host-workspace.ts` has no ref parameter.
- `cloneThroughStaging` removes its staging directory on failure. `cloneInto` on a new path does not remove a partial target.

Selected approach: add three optional catalog fields, route root-level host installs through `sudo -n`, add three catalog entries, and thread an optional ref through `ensureHostWorkspace`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG` | New fields `hostInstallUser`, `hostRequires`, `hostNextSteps`; entries `code-server`, `docker`, `desktop`. |
| `.agro/cli/src/commands/tool.ts` | `runToolInstall`, `installOnHost`, `rowOf`, `renderTable` | Host-only gate, `sudo -n` preflight and argv, `hostRequires` check, next steps, `HOST` column. |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `cloneInto`, `cloneThroughStaging` | Optional ref; no target left after a failed clone. |
| `.agro/cli/src/commands/workspace.ts` | `WorkspaceOptions`, `runWorkspaceCreate` | Pass `ref` to `ensureHostWorkspace`. |
| `.agro/cli/src/cli.ts` | `WorkspaceArgs`, `parseWorkspaceArgs`, workspace help | `--ref` parsing and help text. |
| `.agro/evals/probes/agent-browser-host-boundary.sh` | package-manager ban | Exempt root-level entries only. |
| `docs/installation.md`, `docs/lifecycle-commands.md`, `CHANGELOG.md` | tool and verb docs | Documentation. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server` | New tool | User-level install in the sandbox and on the host. |
| `agro tool install docker --host` | New tool | Root-level host install. The sandbox path refuses and names `access.dockerSocket`. |
| `agro tool install desktop --host` | New tool | Root-level host install. Requires `tailscale`. |
| `agro tool list` | Output | New `HOST` column; new JSON field `hostInstallUser`. |
| `agro workspace create --ref <ref>` | New flag | Clone at a branch or tag. |

## Storage

The existing `hostTools` record in the host config (`~/.agro/config.json`) records each host install. The receipt shape does not change. A root-level install records the same fields as a user-level install.

## Architectural Decisions

- A dedicated VM may install system packages. The catalog marks those tools with `hostInstallUser: "root"` instead of refusing them. The package-manager ban stays in force for every other host installer.
- `installOnHost` owns the `sudo -n` decision. `LocalExecutionTarget` does not change, so sandbox behavior does not change.
- A root-level script gets the invoking user from `AGRO_TOOL_USER`, not from `SUDO_USER`. The same variable works for a uid-0 caller.
- Tools that need interactive credentials stop before the credential step and print the step.
- The desktop tool never exposes RDP on the public address.
- The host path keeps its trigger: a host install runs only when the sandbox is not reachable.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | new entries; `hostInstallUser` only on `docker` and `desktop`; pinned code-server hashes and version; package-manager ban for non-root host installers | US-001 to US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | uid 0: no `sudo`. Passwordless `sudo`: `sudo -n -- env AGRO_TOOL_USER=<user>`. Failed `sudo -n true`: exit 1, no exec, no receipt. Missing `hostRequires`: exit 1. Next steps. `HOST` column and JSON field. Sandbox refusal names `access.dockerSocket`. | US-001, US-003, US-004 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `--ref v0.15.0` clone argv; missing ref exits 1 and leaves no target; no `--ref` keeps the old argv | US-005 |
| `.agro/cli/src/__tests__/cli.property.test.ts` or the existing parser test file | `--ref` parse, `--ref=`, empty ref, `--ref` with `list` | US-005 |
| `.agro/evals/probes/agent-browser-host-boundary.sh` | probe exits 0 with the new root-level entries present | US-001 |
| Ubuntu 24.04 host, manual | commands and exit codes in `## Host install evidence` | US-002 to US-005 |

## Design Principles

- One owner: `agro` owns tool versions and install steps.
- Keep each install idempotent. `verifyArgv` decides "already installed" before any script runs.
- Fail before a change: each refusal in US-001 runs before the installer and before the receipt write.
- Keep the root-level exemption narrow. Only an entry with `hostInstallUser: "root"` may call the package manager.
- Add no comments to tracked code.

## Out of Scope

- A Tailscale auth key flow.
- A firewall policy beyond port 3389.
- Non-Ubuntu hosts.
- Host uninstall of `docker` and `desktop`. See Open Question 3.
- A host install while the sandbox is reachable.

## Open Questions

1. How does `sudo tailscale up` work after `agro tool install tailscale --host`? The current host install puts `tailscale` and `tailscaled` in `~/.local/bin` with no systemd unit, and `sudo` does not search `~/.local/bin`. This question blocks US-004.
   - A. Recommended: add a root-level host variant for `tailscale` that installs Tailscale's apt package and enables `tailscaled`. The sandbox install does not change.
   - B. The `desktop` script installs a `tailscaled` systemd unit that runs `~/.local/bin/tailscaled`. The printed step becomes `sudo ~/.local/bin/tailscale up`.
   - C. `desktop` requires a system `tailscaled` service. The refusal names Tailscale's own installer instead of `agro tool install tailscale --host`.
2. How does the `desktop` script restrict TCP 3389 to the Tailscale path? The runbook uses UFW in step 9, outside steps 3 to 6. A UFW default-deny policy also blocks public SSH, and the plan forbids an SSH rule change. This question blocks US-004.
   - A. Recommended: a persistent `nftables` or `iptables` rule that drops TCP 3389 on each interface except `tailscale0`, installed by a systemd oneshot unit.
   - B. `xrdp.ini` listens only on the Tailscale address. This option needs `sudo tailscale up` before the install, which reverses the printed step order.
   - C. UFW rules for port 3389 only, without `ufw enable`. The rules have no effect while UFW stays disabled.
3. Do `docker` and `desktop` get a host uninstall? Recommended: no. Set `uninstallArgv: null` with a reason, and keep removal out of scope.
4. What is the exact code-server release asset URL? The expected form is `https://github.com/coder/code-server/releases/download/v4.129.0/code-server-4.129.0-linux-<arch>.tar.gz`. Before the advisor accepts US-002, the implementation owner confirms that the pinned hashes match these assets.

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, these commands run in this order and each exits 0: `agro workspace create --ref v0.15.0`, `agro tool install docker --host`, `agro tool install code-server --host`.
- [ ] Open Questions 1 and 2 have operator answers, and US-004 reflects them.
- [ ] AGRO `0.15.0` is released.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
