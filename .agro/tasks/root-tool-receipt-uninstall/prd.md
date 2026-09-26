# PRD: Root-level tool receipt and uninstall

Status: DRAFT

Issue: mifunedev/agro#1185. Epic: mifunedev/agro-console#180.

## User Stories

### US-001: A root-level tool receipt records no user prefix

**Description:** As an operator, I want each root-level tool receipt to state the install scope, so that `~/.agro/config.json` claims no `~/.local` install.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/host-config.ts` defines `HostToolReceipt` as a user receipt (the current `HostHarnessReceipt` shape) or a root receipt `{ scope: "root"; binary; installedAt; workspaceRoot? }`. `HostConfig.hostTools` uses `HostToolReceipt`. `hostHarnesses` keeps `HostHarnessReceipt`.
- [ ] `installOnHost` in `.agro/cli/src/commands/tool.ts` writes a root receipt with no `prefix` and no `binPath` when `entry.hostInstallUser === "root"`. A user-level tool receipt does not change.
- [ ] `validateHostConfig` accepts a root receipt without `prefix` and `binPath`. The function refuses a root receipt that has `prefix` or `binPath`.
- [ ] `validateHostConfig` still accepts a 0.15.0 receipt for `docker-engine` or `desktop` that carries `prefix` and `binPath`.
- [ ] Tests in `.agro/cli/src/__tests__/tool.test.ts` prove the root receipt shape after a `docker-engine` install and the unchanged `herdr` receipt shape.
- [ ] `pnpm vitest run .agro/cli/src/__tests__/tool.test.ts` passes, and `pnpm typecheck` exits 0.

### US-002: Uninstall refuses a root-level tool with a clear message

**Description:** As an operator, I want `agro tool uninstall` to explain how to remove a root-level tool, so that the refusal does not show install instructions.

**Acceptance Criteria:**

- [ ] `agro tool uninstall docker-engine` and `agro tool uninstall desktop` exit 1, with and without `--host` and `--force`.
- [ ] The refusal names the tool, states that `agro` does not remove system packages that it installed as root, and links the removal section of `docs/installation.md`.
- [ ] The refusal does not print the install text of `notInstallableReason`.
- [ ] The refusal leaves the `hostTools` receipt unchanged.
- [ ] `docs/installation.md` has a section that removes `docker-engine` and `desktop` by hand, with numbered steps. The `desktop` steps warn the operator to keep Tailscale if Tailscale was present before the install.
- [ ] The `agro tool` help in `.agro/cli/src/cli.ts` states that `uninstall` refuses root-level tools.
- [ ] Tests in `.agro/cli/src/__tests__/tool.test.ts` prove the exit code, the message, and the unchanged receipt for both tools.
- [ ] `pnpm vitest run .agro/cli/src/__tests__/tool.test.ts` passes, and `pnpm typecheck` exits 0.

## Summary

AGRO 0.15.0 added two root-level host tools, `docker-engine` and `desktop` (#1169). `installOnHost` runs them through `sudo -n`, then writes the same receipt as a user-level tool: `prefix` is `~/.local` and `binPath` is `~/.local/bin`. Neither tool installs there. `runToolUninstall` refuses any tool with `uninstallArgv: null`, and it prints `notInstallableReason`. For `docker-engine` and `desktop`, `notInstallableReason` explains the install, not the removal. `docs/installation.md` already states that `agro tool uninstall` refuses both tools.

Selected approach:

1. Give root-level tools their own receipt shape with no user paths.
2. Keep the refusal, and replace its text with removal guidance and a docs link.

The CLI keeps the refusal because an automatic uninstall would remove system packages that other software can depend on. The `desktop` install also skips Tailscale when `tailscaled` already exists, so the CLI cannot tell whether it owns Tailscale.

Affected surfaces:

- **Host and sandbox:** applied. Both tools are host-only.
- **Lifecycle door:** applied. Only `agro tool install` and `agro tool uninstall` change.
- **Canonical and provider surfaces:** not applicable. No skill or hook changes.
- **Root and scaffold:** applied. The CLI ships in `@mifune/agro`.
- **Interactive and headless processes:** not applicable.
- **Local and remote operation:** applied. The receipt lives in `~/.agro/config.json` on each host.
- **Parallel operation:** not applicable.
- **Public documentation:** applied. mifunedev/agro-web#63 documents the root-level tools and must state the refusal.
- **Verification:** applied. `pnpm test` (root vitest includes `.agro/cli/**/__tests__`) and `pnpm typecheck`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/host-config.ts` | `HostHarnessReceipt`, `HostConfig`, `validateReceipts` | Receipt types and validation |
| `.agro/cli/src/commands/tool.ts` | `installOnHost`, `runToolUninstall`, `uninstallOnHost` | Receipt write and uninstall refusal |
| `.agro/cli/src/lib/tools/catalog.ts` | `hostInstallUser`, `uninstallArgv`, `notInstallableReason` | Root-level tool entries |
| `.agro/cli/src/cli.ts` | `agro tool` help text | Help for `uninstall` |
| `docs/installation.md` | host tools section | Removal steps |
| `.agro/cli/src/__tests__/tool.test.ts` | receipt and uninstall tests | Proof |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `~/.agro/config.json` `hostTools` | Schema addition | Root receipt without `prefix` and `binPath` |
| `agro tool uninstall docker-engine\|desktop` | Message change | Removal guidance instead of install text; exit code stays 1 |
| `agro tool --help` | Text change | States the refusal |

## Storage

`~/.agro/config.json` on the host, key `hostTools`. A root receipt is `{ "scope": "root", "binary", "installedAt", "workspaceRoot" }`. The validator keeps accepting the 0.15.0 receipts that carry `prefix` and `binPath`.

## Architectural Decisions

- The receipt shape is the source of truth for the install scope. The catalog field `hostInstallUser: "root"` sets the scope at install time.
- The CLI refuses root-level uninstall. The docs own the removal steps.
- No migration rewrites existing 0.15.0 receipts. `tool uninstall` refuses root-level tools before the CLI reads a receipt.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/tool.test.ts` | root receipt after `docker-engine` host install; `herdr` receipt unchanged | US-001 |
| `.agro/cli/src/__tests__/tool.test.ts` | validator accepts root receipt, refuses root receipt with `prefix`, accepts 0.15.0 receipt | US-001 |
| `.agro/cli/src/__tests__/tool.test.ts` | uninstall of each root tool: exit 1, message, docs link, receipt unchanged, with `--host` and `--force` | US-002 |

## Design Principles

- The record states what happened on the host, nothing more.
- Do not remove system packages that other software can depend on.
- Keep one source of truth for removal steps: `docs/installation.md`.

## Out of Scope

- A release. The change ships with the next `@mifune/agro` release. agro-console pins `v0.15.0` and runs only `agro tool install desktop --host`.
- Automatic removal of `docker-engine` or `desktop`.
- The public docs. mifunedev/agro-web#63 covers them.

## Open Questions

None. The operator accepted the refusal on 2026-09-26. The CLI documents manual removal and runs no uninstall through `sudo -n`.

## Acceptance Criteria

- [ ] US-001 and US-002 have `passes: true` in `prd.json`.
- [ ] `pnpm test` and `pnpm typecheck` pass on the task branch.
- [ ] `CHANGELOG.md` has one entry under `## [Unreleased]` for the receipt and the refusal message.
- [ ] The PR body closes mifunedev/agro#1185.

## Lessons

Filled by the advisor before undraft.
