# README mission and first-task onboarding

## Introduction

Implement the README Advisor council recommendations approved by the operator's request to ship a completed PR. AGRO provides a durable workspace and shared control plane around the operator's chosen coding harness. Explain that existing mission without changing runtime behavior or product boundaries.

## Goals

- Make the README a concise product entrance rather than an operations reference.
- Document one first task with observable output after provider authentication.
- Correct known onboarding contradictions and keep optional setup separate.
- Provide independently reviewed evidence and a ready PR with green CI.

## User stories

### US-001: Explain AGRO and reach a first result

As a newcomer, I can understand AGRO and follow one documented path through a harmless first task.

Acceptance criteria:
- README leads with durable workspace, shared control plane, harness choice, and operator ownership.
- README contains one recommended setup path with separate host and sandbox steps, one provider, and a harmless task with exact expected output.
- README avoids absolute platform/security promises and distinguishes checkout isolation from container security.
- README explains Docker socket risk, permissions, persistence conditions, and destructive cleanup before the related action.
- Optional GitHub prompts, Slack, alternatives, configuration, and migration details move to linked guides rather than duplicate the main path.
- Target 900–1,200 README words or fewer when all required information remains clear.
- Typecheck passes.

### US-002: Reconcile directly linked onboarding sources

As a reader, I encounter consistent advice in the linked core guides.

Acceptance criteria:
- Quickstart, Installation, docs index, Introduction, open-core, and lifecycle reference agree with the README on the changed claims.
- Distinguish installable harnesses/tools from bootstrap dependency installation. Explain the agro/oh update exception without an unverified support-window promise.
- Preserve authentication and recovery guidance, existing demo links where relevant, and accurate legal boundaries.
- Resolve actual knowledge impact, including fresh-machine-setup. Do not advance freshness without reading the claims and sources.
- Add a concise Unreleased changelog entry linked to #1036.
- Typecheck passes.

### US-003: Verify and score the documentation change

As a reviewer, I can distinguish documentation improvements from untested release behavior.

Acceptance criteria:
- Record before/after word counts and independent scores for mission 25%, onboarding 25%, truth 20%, readability 20%, safety 10%.
- Review every changed document and verify the first-task specimen in isolated scratch without modifying the live workspace.
- Run STE on README and verify links plus relevant regression checks. Do not weaken probes to accept stale facts.
- Record eval deltas, independent simplicity review, knowledge decisions, and remaining release/demo/site gaps in committed evidence.
- Fresh PR audit confirms local/remote head parity, green CI, and promotability before undrafting. Human owns merge.
- Typecheck passes.

## Functional requirements

1. Prefer the current terminal-first setup, with VS Code as an optional attach path.
2. Keep local and remote operation available without inventing a remote-only audience.
3. Use a new scratch directory inside the sandbox for the first task. Do not alter harness source or require GitHub credentials.
4. Link to existing guides. Add no new documentation framework or validators without an observed missing check.

## Non-goals

No runtime changes, full-site rewrite, demo production, clean-host release trial, provider authentication changes, release publication, or merge. This documentation PR closes #1036 only. It supports but does not close #1009, #1010, or #1011. Their independent trial and deployed-site criteria remain separate.

## Knowledge Context

- **Base commit**: `42e85ec45e5d89be56f1efc9be715bbeb69990fa`
- **Queries**: `onboarding docs sandbox`; `onboarding docs sandbox --patterns`
- **Knowledge used**: `[[oh-cli-portable-lifecycle]]`, `[[fresh-machine-setup]]`, `[[release-versioning]]`, `[[pattern-evals-product-name-literal-pinning]]`, `[[pattern-audit-remote-head-verdict]]`, `[[pattern-cli-bundled-asset-relative-import]]`, `[[pattern-evals-probe-brief-under-enumeration]]`, `[[pattern-spec-simplify-round-seeded-non-reducing]]`
- **Grounded against**: `AGENTS.md`, `README.md`, `docs/README.md`, `docs/open-core.md`, `.agro/cli/src/cli.ts`, `.agro/cli/src/commands/sandbox.ts`, `.agro/cli/src/commands/lifecycle.ts`, `.devcontainer/entrypoint.sh`, `package.json`, live issues #1009 and #1011
- **Conflicts discovered**: Fresh-machine knowledge still ends at authentication, recommends VS Code, promises upgrade-by-reinstall, and says nothing installs at boot. Current sources and the EPIC outrank those claims. Latest release is v0.9.0; source inspection is not release-install evidence.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `fresh-machine-setup`; inspect `oh-cli-portable-lifecycle` if lifecycle prose changes
- **Affected source paths**: `README.md`, `docs/README.md`, `docs/quickstart.md`, `docs/installation.md`, `docs/intro.md`, `docs/open-core.md`, `docs/lifecycle-commands.md`
- **Reason**: Existing knowledge describes the onboarding endpoint and advice this PR corrects. No new reusable mechanism is introduced.

## Plan Reconciliation

- **Source plan**: `.agro/tasks/delegate-readme-council-2026-09-10/council-report.md` in the advisor checkout and the operator's implementation authorization
- **Intent preserved**: YES
- **Material deviations**: none
- **Constraints discovered during grounding**: #1010 and #1011 own broader outcomes than this README change; use bounded issue #1036. No claim of independently tested clean installation or a refreshed demo.
- **Orchestration preserved**: YES

## Advisor orchestration strategy

The active advisor owns task state, acceptance, commits, and PR finalization. One continuing general-purpose worker owns coupled tracked documentation edits in the isolated worktree. Request inherited model with high reasoning; effective settings stay unknown unless observed. A fresh read-only reviewer scores before/after and checks simplicity. Workers do not write prd.json or progress.txt, launch nested agents, push, or merge. Repair returns to the same documentation worker. Record assignments in delegate-graph.json and delegate-log.txt.

## Affected surfaces

- Host/sandbox: applied; label every command and execute review work inside the sandbox.
- Lifecycle door: applied; preserve agro commands and explain compatibility exceptions.
- Canonical/provider: applied; edit canonical docs, not provider mirrors.
- Root/scaffold: applied; explain sandbox-first adoption without changing scaffold ownership.
- Interactive/headless: applied; preserve Herdr/tmux/systemd distinctions without starting services.
- Local/remote: applied; bound persistence claims and retain both modes.
- Parallel: applied; one isolated writer, read-only review after it finishes.
- Public docs: applied; core docs change, agro-web follow-up remains with #1010.
- Verification: applied; source checks, specimen execution, STE, links, eval, typecheck, independent review, and current-head PR CI.
