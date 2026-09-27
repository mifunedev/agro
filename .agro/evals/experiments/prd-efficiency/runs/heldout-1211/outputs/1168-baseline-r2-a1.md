# PRD: Node host tools and a pinned workspace ref

Status: BLOCKED

Source: `work/issue-1168.md` (issue #1168). Branch: `feat/1168-node-host-tools`. Target: `development`.

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want `agro tool install <id> --host` to run a root-level installer through `sudo` so that a dedicated VM can install system packages with `agro`.

**Acceptance Criteria:**

- [ ] `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` gains a field that marks a host install as root-level. Each existing entry keeps its current behavior, and `tool-catalog.test.ts` proves that no existing entry sets the field.
- [ ] If the invoking user is not root, `installOnHost` runs the root-level install script through `sudo -n`.
- [ ] If the invoking user is root, `installOnHost` runs the root-level install script without `sudo`.
- [ ] If `sudo -n true` exits non-zero, the command exits 1 and prints a message that names the tool and states that the tool needs passwordless `sudo`. The command runs no install script and writes no `hostTools` receipt.
- [ ] The root-level install script receives the invoking user's name, so that the script can change that user's groups and home files.
- [ ] `agro tool list` marks each root-level host tool in the table output and in the `--json` output.
- [ ] Unit tests in `.agro/cli/src/__tests__/tool.test.ts` cover the root user, a user with passwordless `sudo`, and a user without passwordless `sudo`.
- [ ] Typecheck passes.

### US-002: Add the code-server tool

**Description:** As an operator, I want `agro tool install code-server --host` so that `agro` owns the code-server version on every node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry that installs for the invoking user, with `hostCapable: true` and an `uninstallArgv`.
- [ ] The script pins code-server `4.129.0` and checks the SHA-256 of the release tarball with `sha256sum -c`: `amd64` `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0`, `arm64` `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617`.
- [ ] If `dpkg --print-architecture` prints a value other than `amd64` or `arm64`, the script exits non-zero and names the architecture.
- [ ] The script extracts the tarball to `$HOME/.local/lib/code-server-4.129.0` and links `$HOME/.local/bin/code-server` to its `bin/code-server`.
- [ ] After `agro tool install code-server --host` on a Linux host, `$HOME/.local/bin/code-server --version` prints a line that starts with `4.129.0`.
- [ ] `agro tool uninstall code-server --host` removes the link and the extracted directory.
- [ ] Typecheck passes.

### US-003: Add the Docker Engine tool

**Description:** As an operator, I want `agro tool install <docker-tool-id> --host` so that every node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a Docker Engine entry with id `<docker-tool-id>` that is host-capable and root-level (US-001).
- [ ] The script installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin` from Docker's apt repository for Ubuntu. The script checks the repository key before it adds the repository.
- [ ] The script adds the invoking user to the `docker` group and enables the `docker` service.
- [ ] After the install and a new login, `docker run --rm hello-world` exits 0 and `docker compose version` exits 0 for the invoking user.
- [ ] If `runningInsideSandbox()` returns true, `agro tool install <docker-tool-id>` exits 1 with a message that names `access.dockerSocket`.
- [ ] A second `agro tool install <docker-tool-id> --host` exits 0 and changes nothing.
- [ ] `bash .agro/evals/probes/tool-catalog-boundary.sh` exits 0.
- [ ] Typecheck passes.

### US-004: Add the desktop tool

**Description:** As an operator, I want `agro tool install desktop --host` so that a node can serve an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry that is host-capable and root-level (US-001).
- [ ] If `tailscale` is not on `PATH`, the command exits 1, names `agro tool install tailscale --host`, and runs no install script.
- [ ] The script installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`, writes `xfce4-session` to the invoking user's `~/.xsession`, adds `xrdp` to `ssl-cert`, and enables `xrdp`.
- [ ] After the install and the two operator steps, TCP 3389 accepts connections on the Tailscale address and refuses connections on the public address. The mechanism is `<rdp-exposure-mechanism>` (Open Question 2).
- [ ] The script changes no SSH firewall rule and sets no password.
- [ ] On completion, the command prints the two remaining operator steps: `sudo tailscale up` and `sudo passwd <user>`.
- [ ] The script follows `https://github.com/ryaneggz/runbooks/blob/main/runbooks/ubuntu-24-xfce-xrdp-tailscale.md`, steps 3 to 6.
- [ ] Typecheck passes.

### US-005: Pin the workspace ref

**Description:** As an operator, I want `agro workspace create --ref <ref>` so that a node's workspace matches the CLI release.

**Acceptance Criteria:**

- [ ] `agro workspace create [<name>] --ref <ref>` clones `https://github.com/mifunedev/agro.git` at `<ref>`.
- [ ] `parseWorkspaceArgs` accepts `--ref <ref>` and `--ref=<ref>`, rejects `--ref` with no value, and rejects `--ref` with `workspace list`.
- [ ] If `<ref>` does not exist on the remote, the command exits 1, names the ref, and leaves no target directory.
- [ ] If the target already holds a git checkout, `--ref` does not change that checkout. The behavior is `<existing-checkout-behavior>` (Open Question 5).
- [ ] Without `--ref`, the command keeps its current behavior.
- [ ] `docs/lifecycle-commands.md` and the `agro workspace` help text document `--ref`.
- [ ] Unit tests in `.agro/cli/src/__tests__/workspace.test.ts` cover a tag, a missing ref, and no `--ref`.
- [ ] Typecheck passes.

### US-006: Document and release

**Description:** As an operator, I want the tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` list `code-server`, `<docker-tool-id>`, and `desktop`, and state which tools are root-level.
- [ ] `CHANGELOG.md` has entries for US-001 to US-005 under `## [Unreleased]`, each linked to issue #1168.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] Each probe in `.agro/evals/probes/` reports PASS or SKIPPED, and none reports REGRESSION.
- [ ] The pull request body has a `## Host install evidence` section with the commands and exit codes of US-002 to US-005 on an Ubuntu 24.04 host. The section lists each check that did not run as `NOT RUN` with the reason.
- [ ] AGRO `0.15.0` publishes the changes.

## Summary

Verified current state:

- `ToolEntry` already has `installUser?: "root" | "sandbox"`. `runToolInstall` passes the field only to the sandbox exec. `installOnHost` ignores the field and runs every script as the invoking user with `NPM_USER_PREFIX=~/.local`.
- `runToolInstall` refuses each entry without `installArgv` before it reaches `installOnHost`. A host-only entry therefore needs a change to that check.
- If the sandbox target is reachable, `runToolInstall` installs into the sandbox and ignores `--host`. Inside the sandbox, `runningInsideSandbox()` in `.agro/cli/src/lib/execution/detect.ts` selects the local target, and that target is always reachable.
- The existing host scripts pin a version, check `sha256sum -c`, and branch on `dpkg --print-architecture`. The code-server entry follows that pattern.
- `docker-cli` is `kind: "baked-in"` and has no host install. No tool installs Docker Engine.
- `.agro/evals/probes/tool-catalog-boundary.sh` fails when `catalog.ts` declares `id: "docker"`. The probe reserves that id for the runtime catalog (`agro sandbox install docker`). Issue US-003 asks for the id `docker`. This plan writes `<docker-tool-id>` until the operator decides (Open Question 1).
- The `tailscale` tool installs a user-level `tailscale` and `tailscaled` into `~/.local/bin`. The runbook installs Tailscale as a system package with a `tailscaled` systemd service (runbook step 7). The runbook restricts port 3389 with UFW in step 9, outside steps 3 to 6.
- `ensureHostWorkspace` in `.agro/cli/src/lib/host-workspace.ts` runs `git clone <AGRO_REPO_URL> <target>` with no ref. If the target exists and is empty, the function clones through a staging directory.
- `installOnHost` writes a `HostHarnessReceipt` (`prefix`, `binary`, `binPath`, `installedAt`, `workspaceRoot`) under `hostTools` in `~/.agro/config.json`.
- The CLI version is `0.14.0` in `.agro/cli/package.json` and in the root `package.json`.

Selected approach:

1. Add a root-level field to `ToolEntry`. `installOnHost` checks `sudo -n true` first, then runs the script through `sudo -n` and passes the invoking user's name.
2. Add `code-server` as a user-level entry that uses the existing pinned-tarball pattern.
3. Add the Docker Engine and `desktop` entries as host-only, root-level entries. `runToolInstall` refuses a host-only entry on a sandbox target.
4. Add `--ref` to `workspace create` and pass the ref to `git clone --branch <ref>`.
5. Update the documentation and `CHANGELOG.md`.
6. Release `0.15.0` through `/release`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG`, `resolveToolInstallArgv` | Root-level field; `code-server`, `<docker-tool-id>`, and `desktop` entries. |
| `.agro/cli/src/commands/tool.ts` | `runToolInstall`, `installOnHost`, `rowOf`, `renderTable`, `renderDetail` | `sudo -n` preflight and exec; host-only refusal on a sandbox target; root-level marker in list output. |
| `.agro/cli/src/lib/execution/detect.ts` | `runningInsideSandbox` | Detects the sandbox for the `access.dockerSocket` refusal. |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate`, `WorkspaceOptions` | Accepts `ref`. |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `cloneInto`, `cloneThroughStaging` | Passes `--branch <ref>` to `git clone`. |
| `.agro/cli/src/cli.ts` | `parseWorkspaceArgs`, workspace help, tool help | `--ref` parsing and help text. |
| `.agro/evals/probes/tool-catalog-boundary.sh` | `id: "docker"` check | Constrains the Docker Engine tool id. |
| `docs/installation.md`, `docs/lifecycle-commands.md`, `CHANGELOG.md` | tool and verb docs | Documentation. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server [--host]` | New tool | User-level install into `~/.local`. |
| `agro tool install <docker-tool-id> --host` | New tool | Root-level Docker Engine and Compose install. |
| `agro tool install desktop --host` | New tool | Root-level XFCE and xrdp install. |
| `agro tool install <root-level-id>` inside a sandbox | New refusal | Exits 1. The Docker Engine refusal names `access.dockerSocket`. |
| `agro tool list`, `agro tool status` | Output | Mark root-level tools in the table and in `--json`. |
| `agro workspace create --ref <ref>` | New flag | Clones at a pinned ref. |

## Storage

The existing `hostTools` record in `~/.agro/config.json` records each host install. The record needs no schema change. For a root-level tool, `prefix` and `binPath` do not describe the install location. The record keeps the fields for schema compatibility (Open Question 4).

## Architectural Decisions

- `catalog.ts` stays the only owner of each tool version, checksum, and install script.
- A dedicated VM may install system packages. The catalog marks those tools as root-level instead of refusing them.
- A root-level tool installs only on the host. `runToolInstall` refuses the tool on a sandbox target. The sandbox has no passwordless `sudo`, so a root install inside the sandbox blocks on a password prompt (see `.agro/evals/probes/tailscale-tool-boundary.sh`).
- `installOnHost` runs `sudo -n true` before the install. The command never opens an interactive password prompt.
- `sudo` resets the environment. The CLI passes the invoking user's name to the script as an explicit variable, `<invoking-user-variable>`, and does not rely on `SUDO_USER`.
- A tool that needs an interactive credential stops before the credential step and prints the step.
- The desktop tool never exposes RDP on the public address.
- `--ref` changes only a new clone. `--ref` never moves an existing checkout.
- Each install is idempotent. If `verifyArgv` exits 0, the command prints `already installed` and runs no script.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | new entries exist; root-level marker only on `<docker-tool-id>` and `desktop`; pinned version and both hashes for code-server; code-server uninstall argv names the link and the directory | US-001 to US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | root user: no `sudo`; non-root user: `sudo -n`; failed `sudo -n true`: exit 1, tool id in the message, no script, no receipt; list: root-level marker | US-001 |
| `.agro/cli/src/__tests__/tool.test.ts` | root-level tool refused on a sandbox target; Docker Engine refusal names `access.dockerSocket`; `desktop` refused without `tailscale` | US-003, US-004 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `--ref` tag passes `--branch <ref>` to `git clone`; missing ref exits 1, names the ref, and leaves no target directory; no `--ref` keeps the current argv; parse cases | US-005 |
| `.agro/evals/probes/tool-catalog-boundary.sh` | probe exits 0 | US-003 |
| Ubuntu 24.04 host run | commands and exit codes in the PR body | US-002 to US-005 |

## Design Principles

- One owner: `agro` owns tool versions and install steps.
- Keep each install idempotent.
- Fail closed: a missing prerequisite exits 1 before the command changes anything.
- Add no comments to tracked code.
- Change the canonical `.agro/` source only.

## Out of Scope

- A Tailscale auth key flow.
- A firewall policy beyond port 3389.
- Non-Ubuntu hosts.
- Root-level tool installs inside the sandbox.
- Changes to `mifunedev/agro-console`.

## Open Questions

1. **Docker Engine tool id.** `tool-catalog-boundary.sh` rejects `id: "docker"` in `catalog.ts`. Issue US-003 asks for `docker`.
   - A. Use `docker-engine` and keep the probe. Recommended.
   - B. Use `docker` and change the probe to allow the id across the tool and runtime catalogs.
2. **RDP exposure on the Tailscale address.** The `tailscale` catalog entry installs a user-level, userspace-networking `tailscaled`. The runbook uses the Ubuntu Tailscale package with a systemd service. The runbook restricts 3389 with UFW in step 9, outside steps 3 to 6. `sudo tailscale up` does not find `~/.local/bin/tailscale` through the default `secure_path`.
   - A. Bind xrdp to `127.0.0.1`, and reach 3389 through the userspace `tailscaled` forward. Add a system `tailscaled` service to the `tailscale` host install.
   - B. Require the system Tailscale package for `desktop`, and add a UFW rule that allows 3389 only on `tailscale0`.
   - C. Other: `<mechanism>`.
3. **Uninstall for root-level tools.** Each `ToolEntry` must set `uninstallArgv`. Issue US-003 and US-004 name no uninstall.
   - A. Set `uninstallArgv: null`, so that `agro tool uninstall` refuses. Recommended.
   - B. Remove the apt packages.
4. **Receipt for root-level tools.** `HostHarnessReceipt.prefix` and `binPath` point at `~/.local`.
   - A. Keep the current fields. Recommended.
   - B. Record the system location, for example `/usr/bin`.
5. **`--ref` with an existing checkout.** `ensureHostWorkspace` reuses an existing `.git` checkout.
   - A. Reuse the checkout, and print that `--ref` was not applied. Recommended.
   - B. Exit 1 when the checkout's `HEAD` does not match `<ref>`.
6. **code-server inside the sandbox.** Issue US-002 names only the host install.
   - A. Use one script for the sandbox and the host, like `herdr`. Recommended.
   - B. Host-only entry.
7. **Release branch.** The issue targets `development`, and `/release` publishes from `main` or `master`. The `0.15.0` release needs a merge from `development` to `main` after this PR. Confirm that US-006's release criterion waits for that merge.
8. **`--host` with a reachable sandbox.** From the host, `runToolInstall` installs into a reachable sandbox and ignores `--host`. On a node with a running sandbox, `agro tool install <docker-tool-id> --host` then reaches the host-only refusal.
   - A. Make `--host` skip the sandbox target. Recommended.
   - B. Keep the current routing, and document that host tools install before the first sandbox starts.

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, `agro tool install <docker-tool-id> --host` exits 0.
- [ ] On the same VM, `agro tool install code-server --host` exits 0.
- [ ] On the same VM, `agro workspace create --ref v0.15.0` exits 0.
- [ ] AGRO `0.15.0` is released.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
