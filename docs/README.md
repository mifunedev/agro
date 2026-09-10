# Open Harness docs

📖 **Full rendered docs & search → https://agro.mifune.dev**

GitHub-readable documentation for the core Open Harness repo. Prefer this index
for repo-local docs and [DeepWiki](https://deepwiki.com/mifunedev/agro)
for generated codebase navigation. The rendered Docusaurus site and blog archive
live in [`mifunedev/agro-web`](https://github.com/mifunedev/agro-web).

## Start here

AGRO gives your chosen coding harness a durable workspace and shared control plane, locally or on a remote VM. You own the workspace. Shared procedures, bounded delegation, and evidence checks support development across coding harnesses; provider capabilities and enforcement differ.

**Start with the terminal and Herdr:**

1. **Host:** Install the CLI with `npm install -g @mifune/agro`. Host prerequisites are Docker with Compose, Git, and Node.js ≥ 20.
2. **Host:** Run `agro sandbox install docker`. Leave SSH and the host Docker socket disabled for the first task.
3. **Host:** Enter with `agro shell <name>`.
4. **Sandbox:** Install Herdr with `agro tool install herdr`, then open it with `herdr`.
5. **Sandbox, Herdr pane:** Follow [Quickstart](quickstart.md#set-up-claude-code-inside-herdr) to install and authenticate Claude Code, then create and verify `hello.mjs` in a new scratch directory.

The first task needs provider access, not GitHub credentials. Read the [trust warnings](quickstart.md#before-you-start) before setup. Bootstrap can install workspace dependencies; installable harnesses and tools require explicit commands.

For optional VS Code and Remote-SSH access, see [Connecting to the sandbox](connecting.md).

## How the primitive pack ships

Open Harness vendors the shared skills/hooks primitive pack directly into the `.agro/` control plane (`.agro/skills/`, `.agro/hooks/`, `.agro/skills.lock`), tracked as ordinary files — `oh update` lays them down, so a fresh checkout has them with no submodule or network step. Codex and Pi use `.agents/skills`; Claude uses `.claude/skills`. Both surfaces link to `.agro/skills`. Fresh clones omit the retired `.codex/skills` and `.pi/skills` links but retain provider-specific configuration.

## Setup & first steps

- [Introduction](intro.md)
- [Quickstart](quickstart.md)
- [Installation](installation.md)
- [Creating a sandbox: `agro sandbox install docker`](deployment-prebuilt-image.md)
- [Connecting to the sandbox](connecting.md)
- [Contributing](contributing.md)
- [AGRO compatibility contract](agro-compatibility.md)
- [AGRO cutover runbook](agro-cutover-runbook.md)

## Harnesses

- [Overview](harnesses/overview.md)
- [Claude Code](harnesses/claude-code.md)
- [Codex](harnesses/codex.md)
- [Pi](harnesses/pi.md)
- [OpenCode](harnesses/opencode.md)
- [Hermes](harnesses/hermes.md)
- [Grok Build](harnesses/grok-build.md)
- [T3 Code](harnesses/t3code.md)

## Integrations

- [Herdr](integrations/herdr.md)
- [GitHub](integrations/github.md)
- [Slack](integrations/slack.md)
- [Langfuse](integrations/langfuse.md)
- [DebugMCP](integrations/debugmcp.md)
- [Pi dynamic workflows](integrations/pi-dynamic-workflows.md)
- [Pi fff file search](integrations/pi-fff.md)

## Reference

- [Lifecycle commands — the `agro` verb reference (`oh` is the alias)](lifecycle-commands.md)
- [Configuration — `agro.json` fields and the secrets split](configuration.md)
- [Security considerations](security-considerations.md)
- [Open-core boundary](open-core.md)
- [Repair-operator registry](repair-operator-registry.md)
- [Repair a sandbox boot blocked by a security advisory](repair-sandbox-boot-advisory.md)
- [Artifact-contract schema](artifact-contract-schema.md)
- [Registry portability contract and exception list](../.agro/scripts/registry-portability.md)
- [`.agro/` directory layout](oh-directory-layout.md)
- [Descriptive `.agro/harness.yml` example](harness-manifest.md)
- [Glossary](glossary.md)
- [RFC / ADR index](rfcs/README.md)
- [ADR-0001: #532 standards scope](rfcs/adr-0001-standards-scope.md)
- [Runtime support — axes taxonomy & the "supported runtime" contract (#592)](rfcs/rfc-runtime-support.md)
- [The brain/hands boundary — Phase-0 decisions for the execution seam (#733)](rfcs/rfc-brain-hands-boundary.md)
- [Self-improving harness roadmap curation (#525)](rfcs/rfc-selfimprove-roadmap.md)
- [Trace/event ledger RFC (#525 foundation)](rfcs/rfc-trace-ledger.md)
- [Property testing](property-testing.md)
- [Resources](resources.md)
