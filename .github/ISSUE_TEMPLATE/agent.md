---
name: Agent
about: Provision a new agent workspace
title: "[AGENT] "
labels: agent
assignees: ""
---

## Identity

- **Name**: <!-- e.g. researcher, builder, alice -->
- **Role**: <!-- What is this agent responsible for? -->

## Context

<!-- What should this agent know? What projects, docs, or repos should it have access to? -->

---

## Workspace Setup

> An agent is a persistent, isolated workspace with its own branch, memory, and context. Agents are long-lived — they accumulate knowledge and work on multiple issues across their lifetime.

### Metadata

> **IMPORTANT**: The very first step should _ALWAYS_ be validating this metadata section to maintain a **CLEAN** development workflow.

```yml
agent: "<agent-name>"
branch: "agent/<agent-name>"
worktree_path: ".worktrees/agent/<agent-name>"
```

### 1. Provision the agent

```bash
agro sandbox install docker
```

This will:

- Build the Docker image and start the sandbox container (`docker compose up -d --build`)
- Mount the workspace and run the setup script

`agro sandbox install docker` does **not** create the per-agent branch or worktree. The `branch` (`agent/<agent-name>`) and `worktree_path` (`.worktrees/agent/<agent-name>`) fields from the Metadata block above are real conventions you create manually with `git worktree add` per the `/git` skill (`.agro/skills/git/SKILL.md`) §Worktrees:

```bash
git worktree add -b agent/<agent-name> .worktrees/agent/<agent-name> development
```

### 2. Enter the sandbox

```bash
agro shell <agent-name>
claude
```

The positional argument to `agro shell` is your **sandbox name** from `agro sandbox list`. Omit it when exactly one sandbox is registered or your current checkout identifies the sandbox. `agro shell` always connects as the `sandbox` user; use `docker exec -it -u <user> <container> zsh` when you need another one.

### 3. Verify

Run from the **host** (orchestrator side):

- [ ] Container is running (`agro ps`)

Run **inside the sandbox** (after `agro shell <agent-name>`):

- [ ] Project root is accessible (`ls ~/harness`)
- [ ] Harness identity lives at the repo root: `AGENTS.md` is present
