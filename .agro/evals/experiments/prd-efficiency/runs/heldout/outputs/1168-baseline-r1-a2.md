# PRD: Node host tools

Status: BLOCKED

Source: issue #1168 (`work/issue-1168.md`). Branch: `feat/1168-node-host-tools`. Pull request base: `development`.

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want `agro tool install <id> --host` to run a root-level installer through `sudo` so that a dedicated VM can install system packages with `agro`.

**Acceptance Criteria:**

- [ ] `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` gains the optional field `hostInstallUser?: "root"`. The seven existing entries keep their current argv and `installUser` values.
- [ ] A catalog entry can declare `hostInstallArgv` with no `installArgv`. `runToolInstall` accepts such an entry on the host path. The sandbox path refuses such an entry with its `notInstallableReason`.
- [ ] If the invoking user is not root, `installOnHost` runs the root-level install argv as `sudo -n <argv>`.
- [ ] If the invoking user is root, `installOnHost` runs the root-level install argv with no `sudo` prefix.
- [ ] If the invoking user is not root and `sudo -n true` exits non-zero, the command exits 1. The message names the tool and states that the tool needs passwordless `sudo`. The runner records no install call, and `hostTools` in the host `agro.json` stays unchanged.
- [ ] `ToolOptions` gains an injectable user-id source, so that tests select root or non-root without a real `process.getuid()` call.
- [ ] `agro tool list` shows a `ROOT` column with `yes` for each root-level host tool and `no` for each other tool. `agro tool list --json` adds a `rootLevel` boolean to each row.
- [ ] After a root-level install, the command does not print the `~/.local` install path or the `export PATH` hint.
- [ ] `.agro/cli/src/__tests__/tool.test.ts` covers three cases: the root user, a user with passwordless `sudo`, and a user without passwordless `sudo`.
- [ ] `.agro/cli/src/__tests__/tool-catalog.test.ts` limits the rule "no `apt`, `dpkg -i`, or `sudo` in a host installer" to entries without `hostInstallUser: "root"`.
- [ ] `npm test` exits 0 and `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Add the code-server tool

**Description:** As an operator, I want `agro tool install code-server --host` so that `agro` owns the code-server version on every node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry with `kind: "installable"`, `installUser: "sandbox"`, `hostCapable: true`, no `hostInstallUser`, an `installArgv`, and an `uninstallArgv`.
- [ ] The install script pins code-server `4.129.0`. The script checks the SHA-256 of the release tarball against `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0` on `amd64` and `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617` on `arm64`.
- [ ] If `dpkg --print-architecture` returns a value other than `amd64` or `arm64`, the script exits non-zero and prints that value.
- [ ] The script extracts the tarball to `${NPM_USER_PREFIX:-$HOME/.local}/lib/code-server-4.129.0`. On the host, that path is `$HOME/.local/lib/code-server-4.129.0`.
- [ ] The script links `$HOME/.local/bin/code-server` to `$HOME/.local/lib/code-server-4.129.0/bin/code-server`.
- [ ] After `agro tool install code-server --host` on a Linux host, `$HOME/.local/bin/code-server --version` prints a first line that starts with `4.129.0`.
- [ ] `parseToolArgs` in `.agro/cli/src/cli.ts` accepts `--host` for `uninstall`.
- [ ] After `agro tool uninstall code-server --host`, `$HOME/.local/bin/code-server` and `$HOME/.local/lib/code-server-4.129.0` do not exist.
- [ ] `tool-catalog.test.ts` asserts the pinned version, both hashes, and the `sha256sum -c -` check.

### US-003: Add the docker tool

**Description:** As an operator, I want `agro tool install docker --host` so that every node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `docker` entry with `hostCapable: true`, `hostInstallUser: "root"`, a `hostInstallArgv`, no `installArgv`, and `uninstallArgv: null`.
- [ ] The script adds Docker's apt repository for Ubuntu and checks the repository key before the first `apt-get install`. The script then installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin`.
- [ ] The script adds the invoking user to the `docker` group. Under `sudo`, the invoking user is `$SUDO_USER`. For a root invoker, the invoking user is `root`.
- [ ] The script runs `systemctl enable --now docker`.
- [ ] The `verifyArgv` of `docker` passes only when Docker Engine and the Compose plugin are present. A host with only the Docker CLI fails the check.
- [ ] After the install and a new login, the invoking user runs `docker run --rm hello-world` with exit 0 and `docker compose version` with exit 0.
- [ ] Inside an AGRO sandbox, `agro tool install docker` exits 1 with a message that names `access.dockerSocket`.
- [ ] A second `agro tool install docker --host` exits 0 and prints `docker: already installed`. The runner records no install call.
- [ ] `tool-catalog.test.ts` replaces the assertion `findTool("docker")` is undefined. The new assertion states that `docker-cli` stays `baked-in` and that `docker` is a root-level host tool.

### US-004: Add the desktop tool

**Description:** As an operator, I want `agro tool install desktop --host` so that a node can serve an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry with `hostCapable: true`, `hostInstallUser: "root"`, a `hostInstallArgv`, no `installArgv`, and `uninstallArgv: null`.
- [ ] If the Tailscale check from Open Question 1 fails, the command exits 1 and prints `agro tool install tailscale --host`.
- [ ] The script installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`.
- [ ] The script writes `xfce4-session` to `~/.xsession` of the invoking user, and the invoking user owns that file.
- [ ] The script adds `xrdp` to the `ssl-cert` group and runs `systemctl enable --now xrdp`.
- [ ] After the install and `sudo tailscale up`, TCP 3389 accepts connections on the Tailscale address. TCP 3389 refuses connections on the public address. The mechanism follows the answer to Open Question 2.
- [ ] The script changes no SSH firewall rule and sets no password.
- [ ] On success, the command prints two remaining operator steps: `sudo tailscale up` and `sudo passwd <user>`, with `<user>` replaced by the invoking user.
- [ ] The script follows steps 3 to 6 of `https://github.com/ryaneggz/runbooks/blob/main/runbooks/ubuntu-24-xfce-xrdp-tailscale.md`.

### US-005: Pin the workspace ref

**Description:** As an operator, I want `agro workspace create --ref <tag>` so that a node's workspace matches the CLI release.

**Acceptance Criteria:**

- [ ] `parseWorkspaceArgs` accepts `--ref <ref>` and `--ref=<ref>` for `create`. `--ref` with no value, and `--ref` on `list`, exit 1 with a message.
- [ ] `agro workspace create [<name>] --ref <ref>` runs `git clone --branch <ref> https://github.com/mifunedev/agro.git <target>`.
- [ ] If `<ref>` does not exist, the command exits 1 and the message names the ref. The command leaves no directory that the command created.
- [ ] Without `--ref`, the runner receives the same `git clone` argv as before this change.
- [ ] If a checkout already exists at the target and the operator passes `--ref`, the command follows the answer to Open Question 3.
- [ ] `docs/lifecycle-commands.md` and `printWorkspaceHelp` document `--ref`.
- [ ] `.agro/cli/src/__tests__/workspace.test.ts` covers a tag, a missing ref, and no `--ref`.

### US-006: Document and release

**Description:** As an operator, I want the tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` list `code-server`, `docker`, and `desktop`, and name `docker` and `desktop` as root-level.
- [ ] `docs/lifecycle-commands.md` lists `agent-browser` as host-capable, which matches `TOOL_CATALOG`.
- [ ] `printToolHelp` in `.agro/cli/src/cli.ts` lists the new tools and states that a root-level tool needs root or passwordless `sudo`.
- [ ] `CHANGELOG.md` `## [Unreleased]` has one entry each for US-001 to US-005, and each entry links issue #1168.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no `REGRESSION`.
- [ ] The pull request body has a `## Host install evidence` section. The section lists the commands and exit codes of US-002 to US-005 on an Ubuntu 24.04 host. The section lists each check that did not run as `NOT RUN` with the reason.
- [ ] AGRO `0.15.0` publishes the changes. The release follows `.agro/skills/release/SKILL.md` after operator approval.

## Summary

Verified current state:

- `installOnHost` in `.agro/cli/src/commands/tool.ts` runs only when the sandbox is not reachable. The function installs into `~/.local` as the invoking user and never calls `sudo`.
- `runToolInstall` refuses each entry that has no `installArgv` before the function checks the host path. A host-only entry therefore needs a change to that gate.
- `ToolEntry.installUser` (`"root" | "sandbox"`) governs only the sandbox path. Every installable entry sets `installUser: "sandbox"`.
- `tool-catalog.test.ts` forbids `apt`, `dpkg -i`, and `sudo` in every host installer. The same file asserts that `findTool("docker")` is undefined, because the runtime catalog owns the id `docker`.
- `agent-browser` is host-capable in `TOOL_CATALOG` and in `docs/installation.md`. `docs/lifecycle-commands.md` still states that `agent-browser` has no host install. The issue repeats that stale statement.
- `docker-cli` is `baked-in` and not host-capable. No tool installs Docker Engine.
- `tailscale` is host-capable. The host install copies `tailscale` and `tailscaled` into `~/.local/bin`, and the install starts no system service.
- `parseToolArgs` rejects `--host` on `uninstall`. `runToolUninstall` acts on the host when the sandbox is not reachable.
- `ensureHostWorkspace` in `.agro/cli/src/lib/host-workspace.ts` runs `git clone <AGRO_REPO_URL> <target>` with no ref. The function reuses an existing checkout without a change.
- `runningInsideSandbox` in `.agro/cli/src/lib/execution/detect.ts` detects the sandbox.
- Root `package.json` and `.agro/cli/package.json` are at `0.14.0`. `release.yml` reads the version from root `package.json` on a push to `main`.

Selected approach:

1. Add `hostInstallUser: "root"` to the catalog. In `installOnHost`, check `sudo -n true`, then prefix the argv with `sudo -n` for a non-root user.
2. Allow host-only entries: `hostInstallArgv` defined and `installArgv` undefined.
3. Add `code-server` as a user-level tool that follows the `herdr` pattern.
4. Add `docker` and `desktop` as root-level host-only tools.
5. Pass `--ref` through `ensureHostWorkspace` to `git clone --branch`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG`, `installableToolIds` | Add `hostInstallUser`. Add the `code-server`, `docker`, and `desktop` entries. |
| `.agro/cli/src/commands/tool.ts` | `runToolInstall`, `installOnHost`, `rowOf`, `renderTable`, `ToolOptions` | Host-only gate, `sudo -n` path, `ROOT` column, injectable user id. |
| `.agro/cli/src/cli.ts` | `parseToolArgs`, `printToolHelp`, `parseWorkspaceArgs`, `printWorkspaceHelp` | `--host` on `uninstall`, `--ref` on `workspace create`, help text. |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate`, `WorkspaceOptions` | Pass `ref` to the clone. |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `cloneInto`, `cloneThroughStaging` | Add `--branch <ref>` to `git clone`. |
| `docs/installation.md`, `docs/lifecycle-commands.md`, `CHANGELOG.md` | tool and verb docs | Documentation. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server` | New tool | Sandbox or host install into `~/.local`. |
| `agro tool install docker --host` | New tool | Root-level host install of Docker Engine and Compose. |
| `agro tool install desktop --host` | New tool | Root-level host install of XFCE and xrdp. |
| `agro tool uninstall <id> --host` | New flag | The parser accepts `--host` on `uninstall`. |
| `agro tool list` | Output | New `ROOT` column and `rootLevel` JSON field. |
| `agro workspace create --ref <ref>` | New flag | Clone at a branch or tag. |
| `mifunedev/agro-web` | Docs | Mirror the new tools and `--ref` flag. See Open Question 5. |

## Storage

The host `agro.json` keeps one `hostTools` receipt per host install. The receipt gains no field. A root-level receipt uses the current `HostHarnessReceipt` shape.

## Architectural Decisions

- `TOOL_CATALOG` is the single source of truth for each tool version, checksum, and install step.
- A dedicated VM can install system packages. The catalog marks those tools with `hostInstallUser: "root"` and does not refuse them.
- `agro` runs `sudo` only with `-n`, so an install never waits on a password prompt. This rule matches the sandbox rule in `tool-catalog.test.ts` (#906).
- A root-level installer takes the invoking user from `$SUDO_USER`, or `root` when `$SUDO_USER` is empty.
- A tool that needs an interactive credential stops before the credential step and prints that step.
- The desktop tool never exposes RDP on the public address.
- `docker` and `desktop` have `uninstallArgv: null`. `agro tool uninstall` refuses them with the existing message.
- The tool id `docker` follows the issue. The tool catalog and the runtime catalog then share the ids `microsandbox` and `docker`. See Open Question 4.
- `--host` keeps its meaning: the host path runs only when the sandbox is not reachable.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | ten tool ids; `code-server` pins and hashes; `docker` and `desktop` root-level and host-only; package-manager rule limited to user-level host installers; shared ids with the runtime catalog | US-001 to US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | root user runs argv with no `sudo`; non-root user with passwordless `sudo` runs `sudo -n <argv>`; failed `sudo -n true` exits 1 with no install call and no `hostTools` change | US-001 |
| `.agro/cli/src/__tests__/tool.test.ts` | `ROOT` column and `rootLevel` JSON field | US-001 |
| `.agro/cli/src/__tests__/tool.test.ts` | inside the sandbox, `docker` refusal names `access.dockerSocket`; second `docker` install exits 0 with no install call | US-003 |
| `.agro/cli/src/__tests__/tool.test.ts` | `desktop` with no Tailscale exits 1 and names `agro tool install tailscale --host` | US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | `parseToolArgs` accepts `--host` on `uninstall` | US-002 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `--ref v0.15.0` adds `--branch v0.15.0`; missing ref exits 1, names the ref, leaves no created directory; no `--ref` keeps the old argv; parser errors | US-005 |
| Ubuntu 24.04 host, manual | commands and exit codes of US-002 to US-005 | US-006 evidence |

## Design Principles

- One owner: `agro` owns tool versions and install steps.
- Each install is idempotent. `verifyArgv` short-circuits a second install.
- An unattended install never blocks on a prompt.
- Add no comments to tracked code.
- Change the smallest surface: one catalog field, one gate, one flag.

## Out of Scope

- A Tailscale auth key flow.
- A firewall policy beyond port 3389.
- Hosts other than Ubuntu.
- An uninstall for `docker` and `desktop`.
- A `--host` install while the sandbox is reachable.
- A `hostDownloadSize` gate for `docker` and `desktop`.
- A `--ref` that names a commit SHA. `git clone --branch` accepts only a branch or a tag.

## Open Questions

1. **Blocks US-004.** The `agro` host install of `tailscale` puts `tailscale` and `tailscaled` in `~/.local/bin` and starts no daemon. `sudo tailscale up` does not find that binary, and no `tailscaled` service runs. Which Tailscale does `desktop` require?
   A. Require Tailscale from the official package, with a running `tailscaled` service, as in runbook step 7. The check fails when `/usr/bin/tailscale` or `tailscaled.service` is absent. The message names the official install.
   B. Change the `tailscale` host install to root-level. That install adds the official package and enables `tailscaled.service`. The check then names `agro tool install tailscale --host`, as the issue states.
   C. Other: <specify>.
2. **Blocks US-004.** Steps 3 to 6 of the runbook bind xrdp on every address. The runbook restricts 3389 in step 9 with UFW, and that step also changes SSH rules. Which mechanism refuses 3389 on the public address?
   A. A persistent `iptables` or `nftables` rule that drops TCP 3389 on each interface other than `tailscale0`.
   B. UFW rules for 3389 only. This choice needs UFW active, and activating UFW without an SSH rule locks out public SSH.
   C. Bind xrdp to the Tailscale address. This choice needs `tailscale up` before the install.
   D. Other: <specify>.
3. When a checkout already exists at the target and the operator passes `--ref`, what does `agro workspace create` do?
   A. Exit 1 and name the existing checkout. (Recommended.)
   B. Reuse the checkout and print a warning that the ref did not apply.
   C. Run `git checkout <ref>` in the existing checkout.
4. The catalog id `docker` reverses the test "keeps docker-cli distinct from the docker RUNTIME". Keep the id `docker`, or rename the new catalog entry to `docker-engine`?
5. Does `mifunedev/agro-web` need a matching change in this task, or in a follow-up issue?
6. The code-server release asset URL is `<code-server tarball URL>`. Confirm the URL that matches the two pinned hashes.

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, each of these commands exits 0: `agro tool install docker --host`, `agro tool install code-server --host`, and `agro workspace create --ref v0.15.0`.
- [ ] AGRO `0.15.0` is released.
- [ ] CI is green on the pull request.

## Lessons

Filled by the advisor before undraft.
