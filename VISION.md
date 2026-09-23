# AGRO vision

AGRO is a portable home for autonomous coding agents. It runs on your machine or
on a remote VM, around the coding harness you choose, and keeps working after
you disconnect.

This document explains the current state and direction of AGRO. It is for the
operators AGRO serves and the people who build it.

- Project overview: [`README.md`](README.md)
- Contribution guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Rules for agents working here: [`AGENTS.md`](AGENTS.md)

## The goal

AGRO is an environment, not a methodology.

A modern coding harness already plans, remembers, writes code, and reviews its
own work. It cannot give itself an isolated runtime, a durable identity,
supervision that outlives a terminal, or a single policy source that holds
across harnesses. AGRO supplies those and stops.

AGRO serves the operator: one person who runs several coding agents against work
they care about, on a machine they do not want to damage, and who often reaches
those agents from somewhere else. The operator is the focus, and the only one.

## Current focus

Every claim in this file that the code does not yet meet is listed here, with
the section it qualifies. An item is deleted when its claim becomes a fact.

Priority:

- **One policy for every harness (P5).** Claude Code runs the canonical
  `.agro/hooks/`. Codex runs one of them and one of its own. Pi runs its own
  path guard and `cc-safety-net`. T3 Code gets whatever the harness it drives
  enforces. The other five run with no policy enforcement.
- **A privilege posture the operator can see (Security).** The image, the
  compose file, and the entrypoint turn on permission bypasses for several
  harnesses instead of reading them from operator configuration.
- **A clean boot path (Test 3).** Much of the entrypoint is stack- or
  vendor-specific work. The `*-entrypoint-hook.sh` loop that could hold it ships
  no hooks, has no documented contract, runs as root, and runs after the work it
  would replace.

Next priorities:

- **Policy and skills in every repository (The workspace).** Hooks and skill
  links are wired in the AGRO repository only. Nothing wires them into a
  project clone.
- **`agro` verbs for project clones (The workspace).** No verb addresses
  `projects/<owner>/<repo>/`, and `agro-path` resolves only the `projects/`
  root.
- **A documented operator journey (Test 4).** The path an operator actually
  takes — an agent working in a project clone — is a few prose prompts in
  `README.md`, with no commands and no failure paths.
- **Docs checked against the code (P4).** Compose verbs and compose file names
  are checked. Nothing else fails when a doc names a verb, variable, or file
  that does not exist.
- **Preventive day-2 operation (P2).** Recovery and upgrade are documented in
  `docs/lifecycle-commands.md`. Backup and restore of the `workspace` volume,
  and refreshing a running sandbox's image outside a recovery, do not exist.

## Security

Security in AGRO starts with P1: agent work must not escape onto the host. The
other direction matters as much.

The sandbox holds live credentials. AGRO sends no usage analytics, telemetry, or
attribution to the project. A capability that moves data off the host is opt-in
and is named in the operator's own configuration.

The privilege posture is the operator's decision, and it must be visible to
them. Machinery that grants a harness elevated permission, relaxes a
confirmation, or bypasses a prompt belongs in configuration the operator can
read, not in an image layer or a boot-path side effect.

Security policy and reporting: [`SECURITY.md`](SECURITY.md)

## The workspace

The sandbox holds one workspace. The workspace is the AGRO repository at its
root, and any number of independent clones under `projects/<owner>/<repo>/`.

A project clone is its own git boundary, with its own remote, branches, history,
and worktrees. The AGRO repository is not their parent. It is the first
instance of the same rule.

This shape decides what AGRO is for. Everything under `.agro/` serves an agent
working on **any** repository in the workspace.

## The floor and add-ons

Five primitives. Each prevents one failure that nothing else covers.

| Primitive | Failure it prevents |
| --- | --- |
| **P1 — Isolated runtime** | Agent work escapes onto the host. |
| **P2 — Durable identity** | Auth, tools, and history die with the container. |
| **P3 — Unattended supervision** | A disconnect ends the work. |
| **P4 — One door** | Host and sandbox drift into two systems. |
| **P5 — One policy source** | Harness choice changes behavior. |

The artifacts that realize them are the floor:

- **P1** — `.devcontainer/Dockerfile`, `docker-compose.yml` and its overlays,
  and the capability and security settings in `docker-compose.yml`.
- **P2** — the named `workspace` volume at `/home/sandbox` and the repository
  bind at `/home/sandbox/harness`.
- **P3** — systemd as PID 1, `agro-bootstrap.service`, `agro-cron.service`,
  `cron-runtime.ts`, and the healthcheck.
- **P4** — the `agro` binary, `docker-compose.sh`, `paths.sh`, `manifest.json`,
  and the `agro.json` and `.env` split.
- **P5** — `.agro/hooks/` and `link-providers.sh` with its `--check` mode.

Everything else is an add-on. Two layers, two bars. The floor carries a
per-boot cost: a line under `.agro/` reaches every repository in the workspace,
and a line of the entrypoint runs on every boot, for every operator, whether or
not it applies. An add-on that serves one project costs only that project.
Add-ons are welcome. When a rule here reads as hostile to a feature, re-check
the layer: the bar is about where a thing plugs in, not whether it deserves to
exist.

### Four tests

Apply all four. A proposal that fails any one is an add-on, not floor.

1. **Primitive test.** Which of P1 to P5 does it serve? No answer means no.
2. **Workspace test.** Does it serve an agent working on any repository in the
   workspace? A thing that only applies to AGRO's own repository is not floor.
3. **Boot-path test.** The entrypoint may only do work that is true for every
   operator and every repository in the workspace.
4. **Journey test.** Every floor artifact appears in a numbered step of a real
   operator journey, or is the reason a step does not fail. The second clause
   protects hooks, healthchecks, and link verification, which are invisible
   when they work.

"A test fails" is not an observable failure. Name the broken operator path.

### How the floor grows

Recurring demand defines interfaces. When several independent requests wire in
the same kind of capability, the answer is a contract, not a queue of merges.
Land the seam, port the existing implementation onto it, and let the rest ship
against it.

## Skills

Every skill is an add-on. A skill earns its place in one of two ways.

- **Environment capability.** It teaches a harness to drive something AGRO
  ships that the harness cannot discover on its own: Herdr, reaching a human
  from an unattended session, the browser, and the worktree and project clone
  mechanics that keep parallel work from colliding.
- **Working practice.** Agents use it often and get better results with it:
  branch, pull request, and release conventions, requirements documents, plan
  formats, and prose style. AGRO does not require these; a harness is free to
  work its own way.

A skill stays only while it earns its place.

## What we will not add (for now)

- Managing many sandboxes at once, multi-user hosting, or any authority above
  the operator.
- A second lifecycle door beside `agro`.
- New policy for one harness that bypasses `.agro/hooks/`.
- Project-specific install or start work in the boot path.
- Telemetry, or anything that moves operator data off the host, on by default.

This list is a roadmap guardrail, not a law of physics. A real operator journey
and a real constraint can change it.

## What would change this file

- A sixth primitive appears: a failure no harness can prevent for itself that
  P1 through P5 do not cover.
- An operator journey proves an add-on is load-bearing, and it passes all four
  tests. It moves into the floor, and the floor is restated here.
- A current-focus item closes.
- A real operator journey and a real constraint change the list of what we will
  not add.
