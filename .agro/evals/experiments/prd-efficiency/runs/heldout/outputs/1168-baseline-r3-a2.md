# PRD: Node host tools and a pinned workspace ref

Status: BLOCKED

Source: `work/issue-1168.md` (issue #1168). Branch: `feat/1168-node-host-tools`. Target branch: `development`.

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want `agro tool install <id> --host` to run a root-level installer through `sudo` so that a dedicated VM can install system packages with `agro`.

**Acceptance Criteria:**

- [ ] `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` gains the optional field `hostInstallUser?: "root"`. Each existing entry omits the field and keeps its behavior.
- [ ] `ToolEntry` gains the optional field `hostRequires?: readonly string[]`. The field holds the tool ids that a host install needs first.
- [ ] If the invoking user has uid 0, a root-level host install runs the installer argv with no `sudo` prefix.
- [ ] If the invoking user is not root, a root-level host install first runs `sudo -n true` with captured output.
- [ ] If `sudo -n true` exits 0, the installer runs as `sudo -n -- <installer argv> <invoking user name>`.
- [ ] If `sudo -n true` exits non-zero, the command exits 1. The message names the tool and states that the tool needs passwordless `sudo`. The runner records no installer call, and `~/.agro/config.json` gains no `hostTools` entry.
- [ ] If a tool in `hostRequires` is not on the host `PATH` that `hostTargetFor` builds, the command exits 1 and prints `agro tool install <required id> --host`. The command changes nothing.
- [ ] If no sandbox is reachable, a tool whose `installArgv` is undefined and whose `hostInstallArgv` is defined reaches the host install path.
- [ ] `agro tool list` prints a `HOST` column with the value `root` for a root-level host tool, `user` for another host-capable tool, and `no` otherwise.
- [ ] `agro tool list --json` gives each row the field `hostInstallUser` with the value `"root"`, `"user"`, or `null`.
- [ ] `printToolHelp` in `.agro/cli/src/cli.ts` states that a root-level host install needs root or passwordless `sudo`.
- [ ] Unit tests in `.agro/cli/src/__tests__/tool.test.ts` cover uid 0, a user with passwordless `sudo`, and a user without passwordless `sudo`.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Add the code-server tool

**Description:** As an operator, I want `agro tool install code-server --host` so that `agro` owns the code-server version on every node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry with `binary: "code-server"`, `hostCapable: true`, no `hostInstallUser`, and a non-null `uninstallArgv`.
- [ ] The `code-server` entry has a `hostInstallArgv`. The installer pins version `4.129.0`.
- [ ] The installer checks the release tarball with `sha256sum -c -` against `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0` for `amd64` and `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617` for `arm64`.
- [ ] If `dpkg --print-architecture` prints a value other than `amd64` or `arm64`, the installer exits non-zero and prints that value.
- [ ] The installer extracts the tarball to `$HOME/.local/lib/code-server-4.129.0`. The installer links `$HOME/.local/bin/code-server` to `$HOME/.local/lib/code-server-4.129.0/bin/code-server`.
- [ ] On a Linux host, after `agro tool install code-server --host`, `$HOME/.local/bin/code-server --version` prints a first line that starts with `4.129.0`.
- [ ] `agro tool uninstall code-server --host` removes `$HOME/.local/bin/code-server` and `$HOME/.local/lib/code-server-4.129.0`.
- [ ] `.agro/cli/src/__tests__/tool-catalog.test.ts` asserts the version, both hashes, the extract path, and the link path.

### US-003: Add the docker tool

**Description:** As an operator, I want `agro tool install docker --host` so that every node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `docker` entry with `hostCapable: true` and `hostInstallUser: "root"`.
- [ ] The `docker` entry probes presence with `command -v dockerd`, so the Docker CLI alone does not count as an install.
- [ ] The installer adds Docker's apt repository for Ubuntu with a `signed-by` key file.
- [ ] The installer installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin` from that repository.
- [ ] If `/etc/os-release` does not set `ID=ubuntu`, the installer exits non-zero and prints the `ID` value.
- [ ] The installer adds the user in `$1` to the `docker` group and runs `systemctl enable --now docker`.
- [ ] After the install and a new login, `docker run --rm hello-world` exits 0 for the invoking user.
- [ ] After the install and a new login, `docker compose version` exits 0 for the invoking user.
- [ ] Inside an AGRO sandbox, `agro tool install docker` exits 1 with a message that names `access.dockerSocket`.
- [ ] A second `agro tool install docker --host` prints `docker: already installed (dockerd)`, exits 0, and runs no installer.

### US-004: Add the desktop tool

**Description:** As an operator, I want `agro tool install desktop --host` so that a node can serve an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry with `hostCapable: true`, `hostInstallUser: "root"`, and `hostRequires: ["tailscale"]`.
- [ ] If `tailscale` is not installed, `agro tool install desktop --host` exits 1 and prints `agro tool install tailscale --host`.
- [ ] The installer installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`.
- [ ] The installer writes `xfce4-session` to `~/.xsession` in the home directory of the user in `$1`, owned by that user.
- [ ] The installer adds `xrdp` to the `ssl-cert` group and runs `systemctl enable --now xrdp`.
- [ ] After the operator completes the printed steps, TCP 3389 accepts a connection on the Tailscale address. The mechanism is open question 1.
- [ ] After the operator completes the printed steps, TCP 3389 refuses a connection on the public address.
- [ ] The installer changes no firewall rule for TCP 22. The installer runs no `passwd` and no `chpasswd`.
- [ ] On success, the command prints `sudo tailscale up` and `sudo passwd <user>` as the remaining operator steps, with `<user>` replaced by the invoking user name.
- [ ] The installer follows steps 3 to 6 of `https://github.com/ryaneggz/runbooks/blob/main/runbooks/ubuntu-24-xfce-xrdp-tailscale.md`.

### US-005: Pin the workspace ref

**Description:** As an operator, I want `agro workspace create --ref <tag>` so that a node's workspace matches the CLI release.

**Acceptance Criteria:**

- [ ] `agro workspace create [<name>] --ref <ref>` runs `git clone --branch <ref> https://github.com/mifunedev/agro.git <target>`.
- [ ] `--ref=<ref>` parses the same way as `--ref <ref>`. `--ref` with no value exits 1.
- [ ] If `<ref>` does not exist on the remote, the command exits 1 and prints `<ref>`. The target directory does not exist after the command.
- [ ] Without `--ref`, the runner receives the same `git clone` argv as before this change.
- [ ] `printWorkspaceHelp` in `.agro/cli/src/cli.ts` lists `--ref <ref>`.
- [ ] `docs/lifecycle-commands.md` documents `--ref`.
- [ ] `.agro/cli/src/__tests__/workspace.test.ts` covers a tag, a missing ref, and no `--ref`.

### US-006: Document and release

**Description:** As an operator, I want the tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` lists `code-server`, `docker`, and `desktop`, and names `docker` and `desktop` as root-level.
- [ ] `docs/lifecycle-commands.md` lists `code-server`, `docker`, and `desktop`, and names `docker` and `desktop` as root-level.
- [ ] `CHANGELOG.md` has one `[Unreleased]` entry for each of US-001 to US-005, each linked to issue #1168.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no `REGRESSION`.
- [ ] The pull request body has a `## Host install evidence` section. The section lists the command and exit code of each host check in US-002 to US-005 on an Ubuntu 24.04 host.
- [ ] Each host check that did not run appears in that section as `NOT RUN` with the reason.
- [ ] After the merge, the `/release` procedure publishes AGRO `0.15.0`.

## Summary

Verified current state:

- `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` has `installUser?: "root" | "sandbox"` for the sandbox path only. No field marks a host install as root-level.
- `runToolInstall` in `.agro/cli/src/commands/tool.ts` refuses a tool whose `installArgv` is undefined before the code checks the sandbox. A host-only tool cannot reach `installOnHost` today.
- `installOnHost` runs only when no sandbox is reachable. `--host` does not force the host path when the sandbox runs.
- `installOnHost` runs the installer with `NPM_USER_PREFIX=~/.local` and no user. `LocalExecutionTarget.argvFor` adds `sudo --` for `user: "root"` with `stdio: "inherit"`. That form can prompt for a password.
- `sudo` resets the environment by default. A root installer cannot read `NPM_USER_PREFIX` or `$USER` of the invoking user from the environment.
- `tool-catalog.test.ts` asserts that no host installer contains `apt`, `dpkg -i`, or `sudo`. The test also asserts the exact list of tools that download with `curl -fsSL`. US-002 to US-004 must change both assertions.
- `tailscale` installs `tailscale` and `tailscaled` into `~/.local/bin` for the invoking user. No systemd unit runs `tailscaled`. Root's `secure_path` does not include `~/.local/bin`.
- `runningInsideSandbox` in `.agro/cli/src/lib/execution/detect.ts` detects the sandbox with `/.dockerenv` and `SANDBOX_NAME`. Inside the sandbox, `runToolInstall` takes the sandbox path.
- `ensureHostWorkspace` in `.agro/cli/src/lib/host-workspace.ts` runs `git clone <AGRO_REPO_URL> <target>` and has no ref argument. An existing checkout returns `action: "reused"` with no clone.
- The CLI version is `0.14.0` in `package.json` and `.agro/cli/package.json`. `CHANGELOG.md` `[Unreleased]` already holds #1143 entries.
- Runbook steps 3 to 6 install the packages, write `~/.xsession`, set a password, and enable `xrdp`. Steps 3 to 6 contain no firewall rule. The runbook restricts TCP 3389 in step 9 with UFW `default deny incoming`.

Selected approach:

1. Add `hostInstallUser` and `hostRequires` to `ToolEntry`. Keep the `sudo` decision in `tool.ts` with an injectable uid, so tests need no real `sudo`.
2. Pass the invoking user name to a root installer as `$1`. The installer resolves the home directory with `getent passwd "$1"`.
3. Let a host-only entry reach the host path. Keep the refusal inside the sandbox.
4. Add `ref` to `ensureHostWorkspace`. Remove the target directory when a clone with a ref fails and the command created the directory.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG`, `hostCapableToolIds` | New fields `hostInstallUser` and `hostRequires`. New entries `code-server`, `docker`, and `desktop`. |
| `.agro/cli/src/commands/tool.ts` | `runToolInstall`, `installOnHost`, `rowOf`, `renderTable`, `ToolOptions` | Host-only routing, `sudo -n` preflight, `hostRequires` check, `HOST` column, injectable uid. |
| `.agro/cli/src/lib/execution/local-target.ts` | `LocalExecutionTarget.exec` | Runs the host argv. No change planned: `tool.ts` builds the `sudo -n --` prefix itself. |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate`, `WorkspaceOptions` | New `ref` option. |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `cloneInto`, `cloneThroughStaging` | `--branch <ref>` on clone. Cleanup on a failed clone. |
| `.agro/cli/src/cli.ts` | `printToolHelp`, `printWorkspaceHelp`, workspace argument parser | Help text and `--ref` parsing. |
| `docs/installation.md`, `docs/lifecycle-commands.md` | tool and verb reference | New tools, root-level marker, `--ref`. |
| `CHANGELOG.md` | `[Unreleased]` | Entries for US-001 to US-005. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server --host` | New tool | Installs code-server `4.129.0` into `~/.local`. |
| `agro tool install docker --host` | New tool | Installs Docker Engine and Compose as root. |
| `agro tool install desktop --host` | New tool | Installs XFCE and XRDP as root. Needs `tailscale`. |
| `agro tool uninstall code-server --host` | New tool | Removes the link and the extracted directory. |
| `agro tool list` | Output | New `HOST` column. |
| `agro tool list --json` | Output | New row field `hostInstallUser`. |
| `agro workspace create --ref <ref>` | New flag | Clones the named tag or branch. |
| `agro tool --help`, `agro workspace --help` | Help text | Root-level note and `--ref`. |

## Storage

The host install keeps the existing `hostTools` record in `~/.agro/config.json`. A root-level install writes the same `HostHarnessReceipt` shape. The receipt `prefix` stays `~/.local`, because `uninstallOnHost` reads it. No schema change.

## Architectural Decisions

- A dedicated VM may install system packages. The catalog marks those tools with `hostInstallUser: "root"` instead of refusing them. This reverses the rule that no host installer calls `apt`. The rule stays in force for each tool without `hostInstallUser: "root"`.
- `tool.ts` owns the `sudo` decision. The code never uses an interactive `sudo`, so an unattended session cannot hang on a password prompt.
- The invoking user name travels as `$1`, not through the environment, because `sudo` resets the environment.
- `hostRequires` checks prerequisites before `sudo`, on the invoking user's `PATH`.
- A tool that needs an interactive credential stops before the credential step and prints the step.
- The desktop tool never exposes RDP on the public address.
- `docker` and `desktop` get `uninstallArgv: null` with a `notInstallableReason` that states that `agro` does not remove system packages. Open question 4 can change this.
- `docker` refuses inside the sandbox, because the sandbox reaches Docker through `access.dockerSocket`.
- `--ref` accepts a tag or a branch, because `git clone --branch` accepts only those. A commit SHA is out of scope.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | New entries exist; `hostInstallUser` only on `docker` and `desktop`; `hostRequires` on `desktop`; code-server version, hashes, and paths; `apt` and `sudo` assertions scoped to tools without `hostInstallUser: "root"`; the `curl -fsSL` list includes `code-server` | US-001 to US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | uid 0 runs no `sudo`; passwordless `sudo` runs `sudo -n true`, then `sudo -n -- <argv> <user>`; failed `sudo -n true` exits 1, names `docker`, runs no installer, writes no receipt | US-001 |
| `.agro/cli/src/__tests__/tool.test.ts` | Missing `hostRequires` tool exits 1 and prints `agro tool install tailscale --host` | US-001, US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | `HOST` column values; JSON field `hostInstallUser` | US-001 |
| `.agro/cli/src/__tests__/tool.test.ts` | Host-only entry reaches `installOnHost`; `docker` inside the sandbox prints `access.dockerSocket`; second `docker` install runs no installer | US-001, US-003 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `--ref v0.15.0` argv; missing ref exits 1 and leaves no target; no `--ref` keeps the old argv; `--ref=<v>` and missing value parsing | US-005 |
| `.agro/cli/src/__tests__/docs.test.ts` or `workspace.test.ts` "documents the verb" case | `docs/lifecycle-commands.md` contains `--ref` | US-005 |
| Manual on an Ubuntu 24.04 host | Commands of US-002 to US-005 with exit codes | US-006 |

## Design Principles

- One owner: `agro` owns tool versions and install steps.
- Keep each install idempotent. The presence probe skips an installed tool.
- Pin each download and check its SHA-256.
- Never prompt for a password in an unattended path.
- Add no comments to tracked code.
- Change the canonical source only. This task touches no provider mirror.

Affected surfaces:

- Host and sandbox: applied. Tools install on the host. `docker` refuses in the sandbox. The implementation owner builds and tests inside the sandbox.
- Lifecycle door: applied. `agro tool` and `agro workspace` change.
- Canonical and provider surfaces: not applicable. No skill, hook, or symlink changes.
- Root and scaffold: applied to the CLI only. Initialized projects get the change through the CLI release.
- Interactive and headless processes: not applicable. No persistent process starts.
- Local and remote operation: applied. `sudo -n` keeps a remote unattended run from hanging.
- Parallel operation: applied. US-002 to US-004 each add one catalog entry and can conflict in `catalog.ts`. Run them in sequence after US-001.
- Public documentation: open question 5.
- Verification: `npm test`, `npm --prefix .agro/cli run typecheck`, the eval probes, CI, and the host evidence section.

## Out of Scope

- A Tailscale auth key flow.
- A firewall policy beyond TCP 3389.
- Non-Ubuntu hosts.
- A `tailscaled` systemd unit. Open question 2 can move this into scope.
- A commit SHA for `--ref`.
- Removal of Docker Engine or the desktop packages.
- A change to how `--host` behaves when a sandbox is reachable. Open question 3 can move this into scope.

## Open Questions

1. **Blocks US-004.** How does the installer restrict TCP 3389 to the Tailscale address without a change to SSH firewall rules? Runbook steps 3 to 6 hold no firewall step. The runbook uses UFW `default deny incoming` in step 9, which also closes public TCP 22. The Tailscale address does not exist until the operator runs `sudo tailscale up`, after the install.
   - A. Add `iptables` rules that accept TCP 3389 on `tailscale0` and drop TCP 3389 on each other interface. Persist the rules with `<persistence mechanism>`.
   - B. Enable UFW with `default allow incoming`, then add `allow in on tailscale0 to any port 3389 proto tcp` and `deny 3389/tcp`.
   - C. Bind `xrdp` to the Tailscale address in `/etc/xrdp/xrdp.ini`. This needs `tailscale up` before the install.
   - D. Other: `<specify>`.
2. **Blocks US-004.** The `tailscale` catalog entry installs `tailscaled` into `~/.local/bin` with no service. `sudo tailscale up` cannot find `tailscale` on root's `secure_path`, and no `tailscaled` runs. Which change makes the printed step work?
   - A. The `desktop` installer adds a `tailscaled` systemd unit that runs `~/.local/bin/tailscaled`, and prints `sudo ~/.local/bin/tailscale up`.
   - B. A new root-level `tailscale` host install uses Tailscale's apt repository.
   - C. Other: `<specify>`.
3. On a node with a running sandbox, `agro tool install code-server --host` installs into the sandbox, because `--host` applies only when no sandbox is reachable. Must `--host` force the host path for this task?
   - A. No. Keep the current rule. The node installs tools before the sandbox starts.
   - B. Yes. `--host` always selects the host path.
4. Must `agro tool uninstall docker --host` and `agro tool uninstall desktop --host` remove packages?
   - A. No. Both refuse with a reason. This plan uses A.
   - B. Yes. Add `apt-get purge` uninstallers.
5. Does `mifunedev/agro-web` need matching pages for the three tools and `--ref`? The issue does not say.
6. With `--ref` and an existing checkout, `ensureHostWorkspace` reuses the checkout at its current ref. Must the command check or change the ref?
   - A. Reuse the checkout and print its current `git describe` output.
   - B. Exit 1 when `HEAD` does not match `<ref>`.
   - C. Keep the reuse with no message.
7. Which Ubuntu 24.04 host produces the `## Host install evidence` section, and who runs it: `<host>`, `<operator or agent>`?

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, `agro tool install docker --host` exits 0.
- [ ] On the same VM, `agro tool install code-server --host` exits 0.
- [ ] On the same VM, `agro workspace create --ref v0.15.0` exits 0 and `git -C ~/.agro/workspaces/default describe --tags` prints `v0.15.0`.
- [ ] Each story in `prd.json` has `passes: true`.
- [ ] CI is green on the pull request from `feat/1168-node-host-tools` to `development`.
- [ ] AGRO `0.15.0` is released.

## Lessons

Filled by the advisor before undraft.
