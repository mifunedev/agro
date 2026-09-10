# AGRO documentation

Start with the guides below for documentation maintained alongside AGRO.
The [docs website](https://agro.mifune.dev) is a separate presentation, with its
source in [`mifunedev/agro-web`](https://github.com/mifunedev/agro-web).

## Start here

AGRO gives AI coding agents a workspace you control: a Docker sandbox and shared
agent procedures around your chosen coding harness, locally or on a remote VM.

Start with the [README quickstart](../README.md#-quickstart): install AGRO, create
a sandbox, open Herdr, and configure your tools and coding harness. GitHub and
messaging setup are optional.

- [Installation](installation.md) — prerequisites and installation details.
- [Herdr](integrations/herdr.md) — the terminal workspace for interactive development.
- [Harnesses](harnesses/overview.md) — choose and authenticate a coding harness.
- [Connecting](connecting.md) — VS Code and remote access options.

## How the primitive pack ships

AGRO keeps shared skills and hooks in `.agro/skills/` and `.agro/hooks/`.
Codex and Pi access shared skills through `.agents/skills`; Claude Code uses
`.claude/skills`. Provider-specific configuration stays separate. See the
[directory layout](oh-directory-layout.md) for details.

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
- [Muse Code](harnesses/muse-code.md)
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

- [Lifecycle commands — the `agro` command reference](lifecycle-commands.md)
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
