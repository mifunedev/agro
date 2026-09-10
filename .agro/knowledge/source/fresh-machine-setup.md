---
title: "Fresh-Machine Setup Flow"
slug: fresh-machine-setup
kind: repo
tags: [setup, onboarding, installation, agro, registry, gateway, ssh, github, slack]
created: 2026-07-02
updated: 2026-09-10
sources:
  - README.md
  - docs/quickstart.md
  - docs/installation.md
  - docs/contributing.md
  - docs/deployment-prebuilt-image.md
  - docs/integrations/github.md
  - docs/integrations/debugmcp.md
  - docs/integrations/slack.md
  - docs/harnesses/hermes.md
  - .devcontainer/entrypoint.sh
  - .devcontainer/Dockerfile
  - .agro/cli/src/commands/harness.ts
  - .agro/scripts/link-providers.sh
  - .agro/scripts/hermes-install-smoke.sh
  - .agro/scripts/gateway.sh
  - .agro/scripts/get-agro.sh
  - .agro/cli/src/commands/tool.ts
  - .agro/cli/src/commands/sandbox.ts
  - .agro/cli/src/commands/lifecycle.ts
  - .agro/cli/src/cli.ts
  - docs/harnesses/claude-code.md
  - docs/integrations/herdr.md
  - docs/security-considerations.md
  - docs/repair-sandbox-boot-advisory.md
verified_at: 4de95a2c39f606486d7a53d6410248aa11380f15
related: [sandbox-dependency-installs, oh-cli-portable-lifecycle]
confidence: provisional
---

# Fresh-Machine Setup Flow

## Relevant Source Files

- `README.md` and `docs/quickstart.md`: mission, terminal-first setup, bounded first task, optional GitHub prompts, and cleanup.
- `docs/installation.md`: prerequisites, CLI entry points, installed versus installable components, and storage.
- `.agro/cli/src/commands/{sandbox,lifecycle,harness,tool}.ts` and `.agro/cli/src/cli.ts`: wizard, command routing, destruction, and install presence checks.
- `.devcontainer/{Dockerfile,entrypoint.sh}`: image contents, sudo configuration, dependency bootstrap, and runtime state.
- Provider and integration guides in `sources`: authentication, communication, and recovery references.

## Summary

AGRO gives the chosen coding harness a durable workspace and shared control plane. Shared procedures, bounded delegation, and evidence checks support local or remote development. Provider capabilities and enforcement differ (`README.md:16–23`).

Onboarding is sandbox-first: install the host CLI, create the sandbox, then enter Herdr. No fork or host-side harness checkout is required. VS Code attachment is optional.

The first-task endpoint is a new `hello.mjs` file plus independently observed output, not authentication alone. GitHub, private repositories, contribution, and Slack remain optional.

## Detail

### Setup and first task

Host prerequisites are Docker with Compose, Git, and Node.js ≥ 20. The recommended path uses `npm install -g @mifune/agro`, `agro sandbox install docker`, and `agro shell <name>`. A remote VM uses the same command sequence from its host shell (`README.md:34–54`).

Inside the sandbox, install Herdr with `agro tool install herdr`, then run `herdr`. In a Herdr pane, install Claude Code with `agro harness install claude-code`. Run `claude auth login`, complete the displayed OAuth instructions, and verify with `claude auth status`. The operator needs an Anthropic account with Claude Code access; usage can incur charges. Do not generalize provider-specific authentication into a universal device-login command (`README.md:59–77`).

Create a unique directory with `mktemp -d "$HOME/agro-first-task.XXXXXX"`. Chain directory entry and agent launch with `&&` so a failure cannot start the task in the harness checkout. The prompt limits work to one zero-dependency `hello.mjs`, requires `node hello.mjs`, and forbids installs, network access, git commands, commits, and other-directory changes. Another terminal runs the file by absolute path. Expected output is `Hello from AGRO!` followed by a newline (`README.md:84–102`).

### Installation and state

Fresh sandboxes require explicit coding-harness and Herdr installation. The image already contains Node, Git, `gh`, and other utilities. Bootstrap can run `pnpm install` when dependencies are missing or manifest inputs change (`.devcontainer/entrypoint.sh:487–504`). Harness and tool commands skip binaries that pass presence checks; reinstall is not an upgrade guarantee (`.agro/cli/src/commands/harness.ts:237–240`, `.agro/cli/src/commands/tool.ts:260–263`).

The wizard writes `~/.agro/sandboxes/<name>/agro.json`. Without `--repo`, the published image seeds the workspace. With `--repo`, the checkout binds at `/home/sandbox/harness` (`docs/quickstart.md:82–107`). Legacy state still resolves; `agro migrate` moves names explicitly. `agro update` upgrades the executable, whereas `oh update` vendors the project payload (`.agro/cli/src/cli.ts:1120–1147`). Installation documents `get-agro.sh` and the legacy `get-oh.sh` alternative. [[oh-cli-portable-lifecycle]] owns detailed routing; [[agro-web-pipeline]] describes the installer-serving site.

Home-mount files survive container stops and recreation when the mount remains. Running agents and servers do not. Herdr preserves metadata and layout, not terminated processes (`README.md:111`). `agro stop` keeps volumes. `agro destroy` deletes named volumes and the registry entry; host bind-mounted directories remain (`.agro/cli/src/commands/lifecycle.ts:323–373`). Back up credentials and workspace data before destruction.

### Trust and optional integrations

Host Docker socket access is effectively host root (`.agro/cli/src/commands/sandbox.ts:172–175`). Worktrees separate checkouts; worktrees are not security boundaries. The tracked sudoers rule requires a password (`.devcontainer/Dockerfile:61`). Locally enabled passwordless sudo removes that gate. Sandbox aliases skip agent permission prompts (`.devcontainer/Dockerfile:101–102`). Read the trust guide before granting credentials or mounts.

Before GitHub repository work, the operator manually runs `gh auth login`, `gh auth setup-git`, and `gh auth status`, then confirms the intended account. Quickstart preserves private-versioning and contribution prompts that recheck authentication before acting (`docs/quickstart.md:201–252`). GitHub recovery remains in `docs/integrations/github.md`.

Slack and Hermes gateways are optional named tmux services. Their guides own setup and verification. Hermes keeps program files in `~/.local/lib/hermes-agent` and project runtime state in `~/harness/.hermes`; its installer reconciles shared skills without authenticating a provider.

### Verification limits

Historical evidence includes the #950 registry-child trial (`.agro/tasks/sandbox-registry/evidence.md`), Claude auth-command checks, and gateway inspection. Those checks do not prove the revised clean-release path.

As of 2026-09-10, the advisor's live release and [#1019](https://github.com/mifunedev/agro/issues/1019) checks identify `v0.9.0` as the latest release, with a fresh-volume bootstrap failure. Source fixes still need release-image verification and publication. `docs/repair-sandbox-boot-advisory.md` repairs existing seeded volumes, not published images.

Revised guidance uses source inspection, not independent clean-install, provider-login, disconnect, or demo verification.

## System Relationships

| Location | Sequence or responsibility |
|---|---|
| Host | Install CLI → create sandbox → enter shell |
| Sandbox, Herdr | Install Claude Code → authenticate → perform scratch task |
| Separate sandbox terminal | Run `hello.mjs` → inspect output |
| Optional integrations | GitHub login before GitHub work; messaging setup before gateway use |
| Host lifecycle | Stop preserves volumes; destroy deletes named volumes |

## See Also

- [[sandbox-dependency-installs]]
- [[oh-cli-portable-lifecycle]]
