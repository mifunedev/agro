FROM feat/1168-node-host-tools TO development

Closes #1168

## Stories

- [x] US-001: Install root-level host tools
- [x] US-002: Add the code-server tool
- [x] US-003: Add the docker tool
- [x] US-004: Add the desktop tool
- [x] US-005: Pin the workspace ref
- [x] US-006: Document and release

## What the issue asked for

Let `agro` build a dedicated node VM. `agro` must install root-level host tools through `sudo`. It must add `code-server`, Docker Engine, and an XFCE/XRDP desktop over Tailscale, and it must pin `agro workspace create` to a release ref. The changes ship in AGRO `0.15.0`.

## What was built

- US-001: `ToolEntry.hostInstallUser: "root"` marks a root-level host tool. If the user is not root, the host install runs the installer through `sudo -n --`. If `sudo -n true` fails, the command exits 1 before it changes anything, and the message names the tool and passwordless `sudo`. `agro tool list` shows `<kind> (root)` and a legend.
- US-002: `code-server` installs `4.129.0` into `~/.local/lib/code-server-4.129.0` and links it from `~/.local/bin/code-server`. The installer checks the SHA-256 for `amd64` and `arm64` and refuses any other architecture by name. It also checks the reported version. Uninstall removes the link and the directory. The tool installs in the sandbox and on the host.
- US-003: `docker-engine` is host-only and root-level. It installs `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin`, and `docker-compose-plugin` from Docker's Ubuntu apt repository after it checks the key fingerprint. It adds the invoking user to `docker` and runs `systemctl enable --now docker`. In the sandbox, the tool refuses and names `access.dockerSocket`.
- US-004: `desktop` is host-only and root-level. It installs system Tailscale from Tailscale's apt repository (key fingerprint checked) and `xfce4`, `xfce4-goodies`, `xrdp`, and `xorgxrdp`. It writes `~/.xsession`, adds `xrdp` to `ssl-cert`, and enables `xrdp`. An `nftables` table, which an `xrdp` `ExecStartPre` drop-in reapplies, accepts TCP 3389 only on `lo` and `tailscale0`. At the end, the command prints `sudo tailscale up` and `sudo passwd <user>`.
- US-005: `agro workspace create [<name>] --ref <ref>` (or `--ref=<ref>`) clones with `git clone --branch <ref>`. If the ref is missing, the command exits 1, names the ref, and removes a target directory that it created. Without `--ref`, the behavior does not change. `--ref` with `list` is refused.
- US-006: `docs/installation.md` and `docs/lifecycle-commands.md` list the new tools and state which ones are root-level. `CHANGELOG.md` has entries for US-001 to US-005. The root `package.json`, `.agro/cli/package.json`, and its lockfile are at `0.15.0`.

## Where it diverged

- The tool id is `docker-engine`, not `docker`. The id `docker` collided with the runtime catalog and the eval probes.
- `desktop` installs system Tailscale itself and does not require `agro tool install tailscale --host`. The `tailscale` tool installs a user binary with no `tailscaled` service, so `sudo tailscale up` and `tailscale0` would not exist.
- The script does not open port 3389 with a firewall rule. It rejects 3389 on all interfaces except `lo` and `tailscale0` with its own `nftables` table. SSH rules do not change.
- `docker-engine` and `desktop` have `uninstallArgv: null`, so `agro tool uninstall` refuses them.
- `harness-one-door.sh` and `agent-browser-host-boundary.sh` now check root-level host tools with a separate rule.

## What remains unverified

- All host installs (US-002 to US-005 on Ubuntu 24.04) are NOT RUN. The sandbox has no systemd and no root. mifunedev/agro-console#168 (US-007) runs them on a real VM.
- Unit tests and typecheck did not run in the commit environment. `.agro/cli/node_modules` is absent (`tsc: not found`), and vitest cannot resolve `agro-asset:` imports without the package setup. CI must prove them.
- The `0.15.0` release publishes only after the merge and promotion to `main`.

## Host install evidence

| Check | Command | Exit code |
|---|---|---|
| US-002 code-server | `agro tool install code-server --host && ~/.local/bin/code-server --version` | NOT RUN: no Ubuntu 24.04 host in the sandbox |
| US-002 uninstall | `agro tool uninstall code-server --host` | NOT RUN: same reason |
| US-003 docker-engine | `agro tool install docker-engine --host`; after a new login `docker run --rm hello-world && docker compose version` | NOT RUN: needs root and systemd |
| US-003 idempotence | second `agro tool install docker-engine --host` | NOT RUN: same reason |
| US-004 desktop | `agro tool install desktop --host`; TCP 3389 on the Tailscale address and on the public address | NOT RUN: needs root, systemd, and a tailnet |
| US-005 ref | `agro workspace create node --ref v0.15.0` | NOT RUN: tag `v0.15.0` does not exist before release |

## Verification

```
$ bash .agro/evals/probes/changelog-entry-length.sh
PASS: all [Unreleased] changelog entries are at most 250 characters
$ bash .agro/evals/probes/harness-one-door.sh             # exit 0
$ bash .agro/evals/probes/agent-browser-host-boundary.sh  # exit 0
$ bash .agro/evals/probes/tool-catalog-boundary.sh        # exit 0
$ npm --prefix .agro/cli run typecheck
sh: 1: tsc: not found                                     # exit 127, dependencies not installed
$ npx vitest run <4 changed test files>
Tests 66 passed (66); 3 files failed to import: Cannot find package 'agro-asset:.devcontainer/docker-compose.yml'
```

## Lessons

- The eval probes allowed only user-level host installs. Fixed in this PR: the id is `docker-engine`, and the probes check root-level tools with their own rule.
- The `tailscale` tool installs a user binary with no `tailscaled` service. Fixed in this PR: `desktop` installs system Tailscale.
- A host tool install needs an existing workspace. Fixed in this PR: the docs state the rule.
- A root-level host tool gets a user-level `hostTools` receipt, and uninstall refuses it. Proposed issue, pending operator approval.
- The public docs in `mifunedev/agro-web` do not name `code-server`, `docker-engine`, `desktop`, or `workspace create --ref`. Proposed issue, pending operator approval.
- The host installs have not run on a real VM. Dropped from this PR: mifunedev/agro-console#168 (US-007) runs them.

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [ ] Every acceptance criterion in the linked issue is met: host evidence and release are pending
- [x] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass: not run locally, CI pending
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
