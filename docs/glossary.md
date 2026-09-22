# Glossary

A canonical, **descriptive** glossary of AGRO's core vocabulary — each
term defined as this repo actually uses it today, with a pointer to a canonical
source file. This is a plain reference page, not a standards document:
there are no normative requirements here, only working definitions.

Terms are listed alphabetically below.

## Layers

These names describe separate layers, not interchangeable jobs:

- **Model** — The LLM selected by a provider; it proposes text and tool calls, while the surrounding agent, harness, and policy decide where those requests run and what is allowed. See the **model** glossary entry.
- **Agent / CLI** — The process that wraps a model with tools, instructions, and session state, such as Claude Code, Codex, or Pi. It is the runtime: the active session owns the work. See the **agent** glossary entry.
- **Harness** — The repo, Docker sandbox, and `.agro/` control plane that give agents a reproducible workspace and lifecycle. See the **harness** glossary entry.
- **Policy** — The provider-portable rules and hooks that constrain agent behavior and tool use. See the **policy** and **tool** glossary entries.

- **advisor** — The active session's behavior of deciding, assigning bounded
  work, verifying the result, and accepting it. The advisor is a behavior, not an
  identity, a model, or a terminal, and it stays with the active session unless
  the operator requests a transfer. Source: [`AGENTS.md`](../AGENTS.md).

- **agent / coding agent** — The running model-plus-tools process that reads the
  workspace and drives the task: Claude Code, Codex, Pi, or another coding harness
  running inside the sandbox. The agent is the **runtime and the owner of the
  work**: it advises, assigns bounded work, and accepts the result, while bounded
  workers perform the tracked edits. A role never implies a separate session or
  process. The repository authors no agent definition files.
  Source: [`AGENTS.md`](../AGENTS.md).

- **harness** — The whole portable setup: one git repo that boots one Docker
  sandbox, wraps your project inside it, and versions the agent's identity,
  tools, and crons. "AGRO" names both this project and any
  single repo-per-sandbox instance of it. "Open Harness" is the former name of
  this project and names nothing current.
  Source: [`intro.md`](intro.md).

- **model** — The LLM an agent or CLI uses to produce reasoning, text, and
  tool-call requests. The model is only one part of an agent session; the
  harness, tools, and policy decide where it runs and which actions are allowed.
  Source: [`docs/harnesses/overview.md`](harnesses/overview.md).

- **orchestrator** — The root-level role that manages the sandbox lifecycle and
  git but does not write application code; its job is provisioning, scaffolding
  the workspace, and running lifecycle skills. Its instructions live in the root
  `AGENTS.md`, which every coding harness reads directly.
  Source: [`AGENTS.md`](../AGENTS.md).

- **policy** — The provider-portable conventions and guardrails the harness
  follows — for example the git workflow (branch names, commit format, PR
  targets, changelog discipline) recorded in the root `AGENTS.md`, alongside the
  hook-enforced security rules. Source: [`AGENTS.md`](../AGENTS.md).

- **primitive** — A reusable unit vendored directly into the `.agro/` control
  plane and exposed to each provider through a symlink. On this branch the
  hooks under `.agro/hooks/` are the whole set.
  Source: [`.agro/hooks/`](../.agro/hooks/).

- **rfc / adr** — A durable architecture decision, recorded as a GitHub issue
  titled `RFC:` or `ADR:` and indexed on the RFC/ADR page. Three states —
  `Draft`, `Accepted`, `Superseded` — and no further taxonomy. This is the only
  decision store; `/architect` points durable decisions here rather than
  creating another one. Source: [`docs/rfcs/README.md`](rfcs/README.md).

- **rule** — Ambient repository policy an agent carries without invoking
  anything: an `AGENTS.md` that applies to every task under its directory.
  Source: [`AGENTS.md`](../AGENTS.md).

- **runtime** — The always-on machinery that wakes the agent on a schedule: a
  tiny croner that reads scheduled-agent definitions from `crons/` and fires
  them inside the sandbox.
  Source: [`.agro/scripts/cron-runtime.ts`](../.agro/scripts/cron-runtime.ts).

- **sandbox** — The isolated Docker container the agent runs inside, built from
  `.devcontainer/`, so the agent works against your code without touching the
  host machine. Source: [`.devcontainer/`](../.devcontainer/).

- **session** — A terminal-backend run of an agent: a tmux session, a Herdr pane, or a
  plain shell. It is a *backend*, not an identity. Distinguish it from the
  **implementation owner** — the logical role that owns one task from the
  isolated worktree through the final PR gates. The decisions, validation,
  evidence, and PR finalization stay with the single agent that took it, whatever
  backend that agent happens to be running in.
  Source: [`sandbox-processes.md`](sandbox-processes.md).

- **tool** — A discrete action an agent can invoke — read a file, run a command,
  call an MCP server. Hooks under `.agro/hooks/` intercept tool calls to enforce
  policy before they run. Source: [`.agro/hooks/`](../.agro/hooks/).

- **worktree** — A separate git working directory under `.worktrees/` that
  isolates a branch so parallel work doesn't collide.
  Source: [`.worktrees/AGENTS.md`](../.worktrees/AGENTS.md).
