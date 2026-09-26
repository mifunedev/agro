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

Let `agro` provision a dedicated Ubuntu node: install root-level system tools on the host through `sudo`, add `code-server`, Docker Engine, and an XFCE/XRDP desktop behind Tailscale, and pin a host workspace to a release ref. Ship it as AGRO 0.15.0 so `mifunedev/agro-console` can pin that release.

## What was built

- US-001: `ToolEntry` gains `hostInstallUser: "root"`. A root-level host install runs through `sudo -n --` when the user is not root. When `sudo -n true` fails, the command exits 1, names the tool and passwordless `sudo`, and changes nothing. `agro tool list` marks root-level tools `(root)`.
- US-002: `code-server` installs a pinned 4.129.0 release, SHA-256 checked for `amd64` and `arm64`, into `~/.local/lib/code-server-4.129.0` with a link at `~/.local/bin/code-server`, on the host or in the sandbox. Uninstall removes both.
- US-003: `docker-engine` (host-only, root-level) installs Docker Engine, Buildx, and Compose from Docker's Ubuntu apt repository, adds the invoking user to `docker`, and enables the service. In a sandbox it refuses and names `access.dockerSocket`.
- US-004: `desktop` (host-only, root-level) installs XFCE, XRDP, and system Tailscale, and serves TCP 3389 only through Tailscale. It prints the remaining steps: `sudo tailscale up` and `sudo passwd <user>`.
- US-005: `agro workspace create [<name>] --ref <ref>` clones a branch or tag. An unknown ref exits 1 and leaves no target directory. Without `--ref`, behavior is unchanged.
- US-006: `docs/installation.md` and `docs/lifecycle-commands.md` document the tools, the root-level rule, and `--ref`. Root and CLI versions bump to 0.15.0 with a dated `## [0.15.0]` changelog section.

## Where it diverged

- The tool id is `docker-engine`, not `docker`: `docker` collided with the runtime catalog (`tool-catalog-boundary`).
- `desktop` installs system Tailscale from Tailscale's apt repository instead of requiring the `tailscale` tool: that tool installs user binaries with no `tailscaled` service, so `sudo tailscale up` and `tailscale0` would not exist.
- `harness-one-door` and `agent-browser-host-boundary` now check root-level tools with their own rule: host-only, no container `installArgv`, no `sudo` in the script, and root reached only through the `sudo -n` gate in `commands/tool.ts`.
- `agro tool uninstall` refuses `docker-engine` and `desktop` (`uninstallArgv: null`).

## What remains unverified

- The `## Host install evidence` required by US-006 on an Ubuntu 24.04 host: every command below is **NOT RUN**, because the sandbox has no systemd and no root. The agro-console node validation (mifunedev/agro-console#168, US-007) runs them.
  - `agro tool install code-server --host` then `~/.local/bin/code-server --version` — NOT RUN.
  - `agro tool install docker-engine --host`, then `docker run --rm hello-world` and `docker compose version` after a new login; second install is a no-op — NOT RUN.
  - `agro tool install desktop --host`; 3389 reachable on the Tailscale address and refused on the public address — NOT RUN.
  - `agro workspace create --ref v0.15.0` against the real remote — NOT RUN (unit tests cover tag, missing ref, and default).
- `npm --prefix .agro/cli run typecheck` did not run: `tsc` is not installed in this checkout (`sh: 1: tsc: not found`).
- The full `npm test` suite and full `/eval` did not run; only the targeted tests and probes below.
- AGRO 0.15.0 is not released and CI has not run: the branch is not pushed.

## Verification

```text
$ npx --no-install vitest run .agro/cli/src/__tests__/tool-catalog.test.ts .agro/cli/src/__tests__/tool.test.ts \
    .agro/cli/src/__tests__/workspace.test.ts .agro/cli/src/lib/__tests__/host-workspace.test.ts
 Test Files  4 passed (4)
      Tests  218 passed (218)

$ bash .agro/evals/probes/harness-one-door.sh             # exit 0, PASS
$ bash .agro/evals/probes/agent-browser-host-boundary.sh  # exit 0, PASS: host tool installers stay clear of the OS package manager
$ bash .agro/evals/probes/tool-catalog-boundary.sh        # exit 0, PASS: the three catalogs are disjoint and the large download stays gated
$ bash .agro/evals/probes/version-parity.sh               # exit 0, PASS: canonical version 0.15.0 agrees across package.json, .agro/cli/package.json, and CHANGELOG.md
$ bash .agro/evals/probes/changelog-entry-length.sh       # exit 0, PASS
```

## Lessons

- The eval probes allowed only user-level host installs, and `docker` collided with the runtime catalog — fixed in this PR (`docker-engine`, root-level probe rule).
- The `tailscale` tool installs a user binary with no `tailscaled` service — fixed in this PR (`desktop` installs system Tailscale).
- A host tool install needs an existing workspace — fixed in this PR (docs state the rule; the agro-console bootstrap runs `agro workspace create` first).
- A root-level host tool gets a user-level `hostTools` receipt, and uninstall refuses it — proposed issue, pending operator approval.
- `mifunedev/agro-web` does not document `code-server`, `docker-engine`, `desktop`, or `workspace create --ref` — proposed issue in `mifunedev/agro-web`, pending operator approval.
- The host installs have not run on a real VM — dropped from this PR; mifunedev/agro-console#168 (US-007) runs them on Ubuntu 24.04.

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [ ] Every acceptance criterion in the linked issue is met (host evidence, release, and CI pending)
- [ ] Tests written **before** implementation (TDD) (not verifiable from the working tree)
- [ ] The repository's lint, typecheck, test, and build commands pass (typecheck and full suite not run here)
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
