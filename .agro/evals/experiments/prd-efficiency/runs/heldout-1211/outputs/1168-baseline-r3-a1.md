# PRD: Node host tools

Status: BLOCKED

Source: `work/issue-1168.md` (issue #1168). Branch: `feat/1168-node-host-tools`. Pull request: `FROM feat/1168-node-host-tools TO development`.

## User Stories

### US-001: Install root-level host tools

**Description:** As an operator, I want `agro tool install <id> --host` to run a root-level installer through `sudo` so that a dedicated VM can install system packages with `agro`.

**Acceptance Criteria:**

- [ ] `ToolEntry` in `.agro/cli/src/lib/tools/catalog.ts` gains the optional field `hostInstallUser?: "root"`. An entry without the field keeps its current behavior.
- [ ] If the invoking user has uid 0, a root-level host install runs its script with no `sudo` prefix.
- [ ] If the invoking user does not have uid 0, a root-level host install runs its script as `sudo -n -- <argv>`.
- [ ] Before the install, `agro` runs `sudo -n true`. If that command exits non-zero, `agro` exits 1 and prints a message that names the tool and states that the tool needs passwordless `sudo`.
- [ ] After a failed `sudo -n true`, the install script does not run and `~/.agro/config.json` does not change.
- [ ] The root-level install script receives the invoking user name in the environment variable `AGRO_INVOKING_USER`.
- [ ] `agro tool list` prints a `ROOT` column. The column shows `yes` for each root-level tool and `no` for each other tool.
- [ ] `agro tool list --json` gives each row the boolean field `rootLevel`.
- [ ] A tool that has `hostInstallArgv` and no `installArgv` takes the host install path when the operator passes `--host`, also when the sandbox is running.
- [ ] Inside the sandbox, `agro tool install <id>` for a tool with no `installArgv` exits 1 and prints the `notInstallableReason` of the tool.
- [ ] Unit tests in `.agro/cli/src/__tests__/tool.test.ts` cover uid 0, a non-root user with passwordless `sudo`, and a non-root user without passwordless `sudo`.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Add the code-server tool

**Description:** As an operator, I want `agro tool install code-server --host` so that `agro` owns the code-server version on every node.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `code-server` entry with `kind: "installable"`, `installUser: "sandbox"`, `hostCapable: true`, no `hostInstallUser`, and an `uninstallArgv`.
- [ ] The install script pins code-server `4.129.0` and runs `sha256sum -c -` on the release tarball with these digests: `amd64` `889b09ff3a167a293f53cb68a5a7f38dbab6bd2b50d7a5951c757e56ba51a2b0`, `arm64` `62f7886018923a18cc16112ccfbcd51aee80f8e0c1bb7abc48773d1fd32a7617`.
- [ ] If `dpkg --print-architecture` prints a value other than `amd64` or `arm64`, the script exits non-zero and prints that value.
- [ ] The script sets `prefix="${NPM_USER_PREFIX:-$HOME/.local}"`, extracts the tarball to `$prefix/lib/code-server-4.129.0`, and links `$prefix/bin/code-server` to `$prefix/lib/code-server-4.129.0/bin/code-server`.
- [ ] On a Linux host, after `agro tool install code-server --host`, `$HOME/.local/bin/code-server --version` prints a first line that starts with `4.129.0`.
- [ ] After `agro tool uninstall code-server --host`, neither `$HOME/.local/bin/code-server` nor `$HOME/.local/lib/code-server-4.129.0` exists.
- [ ] `.agro/cli/src/__tests__/tool-catalog.test.ts` asserts the version, both digests, the extract path, and the link path.

### US-003: Add the docker tool

**Description:** As an operator, I want `agro tool install docker --host` so that every node gets Docker Engine and Compose from one command.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `docker` entry with `hostCapable: true`, `hostInstallUser: "root"`, a `hostInstallArgv`, and no `installArgv`. The entry id depends on open question 1.
- [ ] The entry uses `binary: "dockerd"` and `verifyArgv` that runs `command -v dockerd`.
- [ ] The script adds Docker's apt repository for Ubuntu, fetches the repository key, and checks the key fingerprint `<docker apt key fingerprint>` before apt trusts the key.
- [ ] The script installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin`.
- [ ] The script adds `$AGRO_INVOKING_USER` to the `docker` group and runs `systemctl enable --now docker`.
- [ ] On completion, `agro` prints that the operator must log in again before the `docker` group applies.
- [ ] On an Ubuntu 24.04 host, after the install and a new login, `docker run --rm hello-world` exits 0 for the invoking user.
- [ ] On the same host, `docker compose version` exits 0 for the invoking user.
- [ ] Inside an AGRO sandbox, `agro tool install docker` exits 1 and prints a message that names `access.dockerSocket`.
- [ ] A second `agro tool install docker --host` exits 0, prints `already installed`, and runs no install script.

### US-004: Add the desktop tool

**Description:** As an operator, I want `agro tool install desktop --host` so that a node can serve an XFCE desktop over RDP through Tailscale.

**Acceptance Criteria:**

- [ ] `TOOL_CATALOG` has a `desktop` entry with `hostCapable: true`, `hostInstallUser: "root"`, a `hostInstallArgv`, and no `installArgv`.
- [ ] The entry uses `binary: "xrdp"` and `verifyArgv` that runs `command -v xrdp`.
- [ ] If the Tailscale check of open question 2 fails, `agro` exits 1, prints `agro tool install tailscale --host`, and runs no install script.
- [ ] The script installs `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`.
- [ ] The script writes `xfce4-session` to `~/.xsession` of `$AGRO_INVOKING_USER`, and that user owns the file.
- [ ] The script adds the `xrdp` user to the `ssl-cert` group and runs `systemctl enable --now xrdp`.
- [ ] After the install, a TCP connection to port 3389 on the Tailscale address of the host succeeds.
- [ ] After the install, a TCP connection to port 3389 on the public address of the host fails.
- [ ] The script contains no `passwd` command and no firewall rule for port 22.
- [ ] On completion, `agro` prints `sudo tailscale up` and `sudo passwd <user>`, with `<user>` replaced by the invoking user name.
- [ ] The script steps match steps 3 to 6 of `https://github.com/ryaneggz/runbooks/blob/main/runbooks/ubuntu-24-xfce-xrdp-tailscale.md`.

### US-005: Pin the workspace ref

**Description:** As an operator, I want `agro workspace create --ref <tag>` so that a node's workspace matches the CLI release.

**Acceptance Criteria:**

- [ ] `parseWorkspaceArgs` in `.agro/cli/src/cli.ts` accepts `--ref <ref>` and `--ref=<ref>` for `create`.
- [ ] `parseWorkspaceArgs` rejects `--ref` with no value and rejects `--ref` with `list`.
- [ ] With `--ref <ref>`, `ensureHostWorkspace` runs `git clone --branch <ref> https://github.com/mifunedev/agro.git <target>`.
- [ ] If `<ref>` does not exist on the remote, the command exits 1, prints the ref, and leaves no directory at the target path.
- [ ] If the target already holds a checkout and the operator passes `--ref`, the command follows the answer to open question 3.
- [ ] Without `--ref`, the command runs `git clone https://github.com/mifunedev/agro.git <target>` as before.
- [ ] `agro workspace --help` and `docs/lifecycle-commands.md` document `--ref`.
- [ ] `.agro/cli/src/__tests__/workspace.test.ts` covers a tag, a missing ref, and no `--ref`.

### US-006: Document and release

**Description:** As an operator, I want the tools in a release so that the console can pin that release.

**Acceptance Criteria:**

- [ ] `docs/installation.md` and `docs/lifecycle-commands.md` list `code-server`, `docker`, and `desktop`.
- [ ] Both documents name `docker` and `desktop` as root-level tools that need passwordless `sudo`.
- [ ] `CHANGELOG.md` has one `[Unreleased]` entry for each of US-001 to US-005, and `.agro/evals/probes/changelog-entry-length.sh` passes.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] Each probe in `.agro/evals/probes/` exits 0 or reports `SKIPPED`.
- [ ] The pull request body has a `## Host install evidence` section. The section lists the commands and exit codes of US-002 to US-005 on an Ubuntu 24.04 host. The section lists each check that did not run as `NOT RUN` with the reason.
- [ ] After the merge, the release workflow publishes AGRO `0.15.0` per `.agro/skills/release/SKILL.md`.

## Summary

Verified current state:

- `runToolInstall` in `.agro/cli/src/commands/tool.ts` refuses a tool with no `installArgv` before any host logic runs.
- `runToolInstall` calls `installOnHost` only when the sandbox is not reachable. `--host` does not select the host when the sandbox runs.
- `installOnHost` needs an existing AGRO workspace. The function calls `resolveExistingWorkspace` and creates no workspace.
- `installOnHost` runs the host argv with no `user`, and passes `NPM_USER_PREFIX=~/.local`.
- `LocalExecutionTarget.argvFor` in `.agro/cli/src/lib/execution/local-target.ts` maps `user: "root"` to `sudo --` for `stdio: "inherit"` and to `sudo -n --` for captured output. The class accepts an injected `identity`.
- `docker-cli` is a `baked-in` entry with `hostCapable: false`. No entry installs Docker Engine.
- `tailscale` is host-capable. The entry installs userspace `tailscale` and `tailscaled` binaries into `~/.local/bin` and keeps state in `~/.tailscale`.
- `ensureHostWorkspace` in `.agro/cli/src/lib/host-workspace.ts` runs `git clone https://github.com/mifunedev/agro.git <target>` and has no ref parameter.
- The CLI version is `0.14.0` in `package.json` and `.agro/cli/package.json`.

Guards that conflict with the issue:

- `.agro/evals/probes/agent-browser-host-boundary.sh` fails when any `hostInstallArgv` matches `apt`, `sudo`, or `dpkg -i`. `tool-catalog.test.ts` asserts the same rule. The docker and desktop scripts must use `apt`.
- `.agro/evals/probes/tool-catalog-boundary.sh` fails when `tools/catalog.ts` declares `id: "docker"`, because the runtime catalog owns that id.
- `tool-catalog.test.ts` requires `installArgv` on each `installable` entry and lists the exact tool ids, installable ids, curl-plus-sha scripts, and version probes.

Selected approach:

1. Add `hostInstallUser?: "root"` to `ToolEntry`.
2. For a root-level host install, `installOnHost` runs `sudo -n true` first, then runs the argv with an explicit `sudo -n --` prefix and `AGRO_INVOKING_USER` in the environment. The explicit prefix avoids the `sudo --` form that `argvFor` selects for `stdio: "inherit"`.
3. A root-level install writes the same `hostTools` receipt as any other host install.
4. Route a host-only tool (a `hostInstallArgv` and no `installArgv`) to `installOnHost` when the operator passes `--host`. `runToolInstall` refuses a host-only tool only inside the sandbox.
5. Scope the no-`apt`, no-`sudo` guard to entries without `hostInstallUser`. The operator decision in the issue replaces the #1078 rule for root-level entries only.
6. Add `ref?: string` to `ensureHostWorkspace` and pass `--branch <ref>` to `git clone`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/tools/catalog.ts` | `ToolEntry`, `TOOL_CATALOG`, `installableToolIds` | `hostInstallUser` field; `code-server`, `docker`, `desktop` entries. |
| `.agro/cli/src/commands/tool.ts` | `runToolInstall`, `installOnHost`, `rowOf`, `renderTable` | Host-only routing, `sudo -n` preflight and prefix, `ROOT` column, `rootLevel` field. |
| `.agro/cli/src/lib/execution/local-target.ts` | `LocalIdentity`, `identity` | Source of the invoking uid and user name; test injection point. |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace`, `cloneInto`, `cloneThroughStaging` | `--branch <ref>` on the clone. |
| `.agro/cli/src/commands/workspace.ts` | `runWorkspaceCreate`, `WorkspaceOptions` | `ref` option. |
| `.agro/cli/src/cli.ts` | `parseWorkspaceArgs`, `printWorkspaceHelp`, `printToolHelp` | `--ref` flag and help text. |
| `.agro/evals/probes/agent-browser-host-boundary.sh` | package-manager patterns | Scope the rule to entries without `hostInstallUser`. |
| `.agro/evals/probes/tool-catalog-boundary.sh` | `id: "docker"` check | Depends on open question 1. |
| `docs/installation.md`, `docs/lifecycle-commands.md`, `CHANGELOG.md` | tool and verb docs | Documentation. |
| `package.json`, `.agro/cli/package.json`, `.agro/cli/package-lock.json` | `version` | Bump to `0.15.0`. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro tool install code-server [--host]` | New | Pinned code-server in `~/.local`. |
| `agro tool install docker --host` | New | Docker Engine and Compose through passwordless `sudo`. |
| `agro tool install desktop --host` | New | XFCE and xrdp through passwordless `sudo`, reachable over Tailscale only. |
| `agro tool uninstall code-server [--host]` | New | Removes the link and the extracted directory. |
| `agro tool list` and `agro tool list --json` | Modify | `ROOT` column and `rootLevel` field. |
| `agro workspace create --ref <ref>` | New | Clone at a branch or tag. |
| `docs/installation.md`, `docs/lifecycle-commands.md` | Modify | New tools, root-level marker, `--ref`. |

## Storage

N/A. No new storage. Each host install writes the existing `hostTools.<id>` receipt in `~/.agro/config.json` through `writeHostConfig`.

## Architectural Decisions

- **Source of truth:** `TOOL_CATALOG` owns each tool version, digest, and install script. No second installer exists.
- **Root boundary:** The `hostInstallUser: "root"` marker is the only way an entry gets `sudo`. `agro` adds the `sudo -n --` prefix. The script text contains no `sudo`.
- **Credentials:** `agro` never prompts for a password and never sets one. Each tool that needs a credential stops before the credential step and prints the step.
- **Network exposure:** The desktop tool never exposes port 3389 on the public address.
- **Sandbox boundary:** Inside the sandbox, `docker` and `desktop` refuse. `docker` names `access.dockerSocket` as the sandbox route to a Docker daemon.
- **Uninstall:** `docker` and `desktop` keep `uninstallArgv: null`. The issue asks for no uninstall of system packages.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool-catalog.test.ts` | tool id list; installable id list; `hostInstallUser` only on `docker` and `desktop`; no `apt` or `sudo` in a non-root `hostInstallArgv`; code-server pins and paths; `code-server` in the version-probe list | US-001 to US-004 |
| `.agro/cli/src/__tests__/tool.test.ts` | uid 0: no prefix. Passwordless `sudo`: the argv runs as `sudo -n -- <argv>`. No passwordless `sudo`: exit 1, the entry id in stderr, no receipt. | US-001 |
| `.agro/cli/src/__tests__/tool.test.ts` | `--host` routes a host-only tool to the host while the sandbox runs; the sandbox refusal names `access.dockerSocket`; `ROOT` column and `rootLevel` field | US-001, US-003 |
| `.agro/cli/src/__tests__/tool.test.ts` | desktop exits 1 and prints `agro tool install tailscale --host` when the Tailscale check fails; the completion message prints `sudo tailscale up` and `sudo passwd <user>` | US-004 |
| `.agro/cli/src/__tests__/workspace.test.ts` | `--ref v0.14.0` passes `--branch v0.14.0`; a missing ref exits 1 and leaves no target; no `--ref` keeps the current argv; parser cases for `--ref` | US-005 |
| `.agro/evals/probes/agent-browser-host-boundary.sh` | passes with root-level entries present; fails when a non-root host argv contains `apt` | US-001 |
| Ubuntu 24.04 host, manual | commands of US-002 to US-005 with exit codes | US-006 evidence |

## Design Principles

- Simplicity is beauty, complexity is pain.
- Look at the current codebase first. Reach the goal with the smallest change.
- Write the tests first: red, green, refactor.
- One owner: `agro` owns tool versions and install steps.
- Keep each install idempotent through the existing `verifyArgv` probe.
- Reuse `installOnHost` and the `hostTools` receipt. Add no second install path.
- Add no comments to tracked code.

## Out of Scope

- A Tailscale auth key flow.
- A firewall policy beyond port 3389.
- Hosts other than Ubuntu.
- An uninstall for `docker` or `desktop`.
- An upgrade path from one code-server version to the next.
- A change in `mifunedev/agro-console`.

## Open Questions

1. The probe `tool-catalog-boundary.sh` reserves the id `docker` for the runtime catalog. Which id does the Docker Engine tool use?
   A. Keep `docker` and change the probe to allow the id `docker` in both catalogs.
   B. Use `docker-engine`, and change every `agro tool install docker` in the stories to `agro tool install docker-engine`.
   C. Other: <specify>.
2. The `tailscale` entry installs userspace binaries into `~/.local/bin`. A userspace `tailscaled` creates no `tailscale0` interface, and `sudo` does not find `~/.local/bin/tailscale` on its `secure_path`. The runbook uses the Tailscale daemon from the Ubuntu package. Which check gates the `desktop` entry?
   A. Require the packaged Tailscale daemon: `systemctl is-active tailscaled` exits 0. Change the refusal to name `<packaged tailscale install command>`.
   B. Keep the check `command -v tailscale`, and make `agro tool install tailscale --host` install the Ubuntu package as a root-level entry.
   C. Other: <specify>.
3. If the workspace target already holds a checkout and the operator passes `--ref`, what does `agro workspace create` do?
   A. Exit 1 and name the existing root.
   B. Reuse the checkout and print `--ref <ref> ignored: <root> already exists`.
   C. Run `git checkout <ref>` in the existing checkout.
4. `installOnHost` refuses when no AGRO workspace exists. On a fresh VM, the operator must run `agro workspace create --ref v0.15.0` before each `agro tool install --host`. Confirm this order, or exempt root-level entries from the workspace requirement.
5. The Docker apt key fingerprint is not in the issue. Supply `<docker apt key fingerprint>`, or approve that the implementation owner copies the fingerprint from Docker's install documentation and cites the source in the pull request.
6. Does `mifunedev/agro-web` need a matching page for the new tools and `--ref`? If yes, name the page `<agro-web page>`.

## Acceptance Criteria

- [ ] On a fresh Ubuntu 24.04 VM with passwordless `sudo`, `agro workspace create --ref v0.15.0` exits 0.
- [ ] On the same VM, after the workspace exists, `agro tool install docker --host` exits 0.
- [ ] On the same VM, `agro tool install code-server --host` exits 0.
- [ ] `npm test` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] No eval probe reports `REGRESSION`.
- [ ] CI is green on the pull request `FROM feat/1168-node-host-tools TO development`.
- [ ] AGRO `0.15.0` is released.

## Lessons

Filled by the advisor before undraft.
