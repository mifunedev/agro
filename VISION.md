# AGRO vision

AGRO is a portable home for autonomous coding agents. It runs on your machine or
on a remote VM, around the coding harness you choose, and keeps working after
you disconnect.

This document explains the current state and direction of AGRO. It is for the
operators AGRO serves and the people who build it.

- Project overview: [`README.md`](README.md)
- Contribution guide: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Rules for agents working here: [`AGENTS.md`](AGENTS.md)

When this file and `AGENTS.md` disagree, `AGENTS.md` wins for conduct and this
file wins for scope.

## The goal

AGRO is an environment, not a methodology.

A modern coding harness already plans, remembers, writes code, and reviews its
own work. It cannot give itself an isolated runtime, a durable identity,
supervision that outlives a terminal, or a single policy source that holds
across harnesses. AGRO supplies those and stops.

AGRO serves the operator: one person who runs several coding agents against work
they care about, on a machine they do not want to damage, and who often reaches
those agents from somewhere else.

The operator is the focus, and the only one. There is no authority above the
operator, no plane above the sandbox, and no account the workspace reports to.
A proposal that only makes sense when something manages many sandboxes at once
is out of scope.

## Current focus

Every claim in this file that the code does not yet meet is listed here. An item
closes when its claim becomes a fact.

Priority:

- **Policy enforcement for every harness.** The harness catalog ships nine
  harnesses. Claude Code and Codex run the canonical `.agro/hooks/` scripts. Pi
  enforces its own inline path guard, which does not read `.agro/hooks/`. The
  other six run with no policy enforcement.
- **A privilege posture the operator can see.** The image and the entrypoint
  write permission-bypass aliases and settings for several harnesses
  (`.devcontainer/Dockerfile`, `.devcontainer/entrypoint.sh`) instead of reading
  them from operator configuration.
- **A clean boot path.** A large share of the entrypoint is stack- or
  vendor-specific work that runs inline. The `*-entrypoint-hook.sh` loop exists,
  ships no hooks, has no documented contract, runs as root, and runs after the
  work it would replace. Test 3 cannot be enforced until that contract exists.

Next priorities:

- **`agro` verbs for project clones.** No verb addresses
  `projects/<owner>/<repo>/`. `agro-path` resolves only the `projects/` root.
  The rest of the shape lives in two `AGENTS.md` files, the `git` and
  `worktrees` skills, and `README.md`.
- **A documented operator journey.** The operator's actual path — an agent
  working in a project clone — is a few prose prompts in `README.md` with no
  commands and no failure paths.
- **Docs checked against the binary.** Compose verbs are checked from the binary
  to the docs. Nothing fails when a doc names a verb, variable, or file that the
  code does not have.
- **Preventive day-2 operation.** Recovery and upgrade are documented in
  `docs/lifecycle-commands.md` and `docs/repair-sandbox-boot-advisory.md`.
  Backup and restore of the `workspace` volume, and refreshing a running
  sandbox's image outside an error recovery, do not exist.

## Security

Security in AGRO starts with P1: agent work must not escape onto the host. The
other direction matters as much.

The sandbox holds live credentials. AGRO sends no usage analytics, telemetry, or
attribution to the project. A capability that moves data off the host is
opt-in, is named in the operator's own configuration, and passes the four tests
before it is considered.

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

This shape decides what the control plane is for. The control plane serves an
agent working on **any** repository in the workspace.

## The floor and tenants

Five primitives. Each prevents one failure that nothing else covers.

| Primitive | Failure it prevents |
| --- | --- |
| **P1 — Isolated runtime** | Agent work escapes onto the host. |
| **P2 — Durable identity** | Auth, tools, and history die with the container. |
| **P3 — Unattended supervision** | A disconnect ends the work. |
| **P4 — One door** | Host and sandbox drift into two systems. |
| **P5 — One policy source** | Harness choice changes behavior. |

The artifacts that realize them:

- **P1** — `.devcontainer/Dockerfile`, `docker-compose.yml` and its overlays,
  and the privilege block.
- **P2** — the named `workspace` volume at `/home/sandbox` and the repository
  bind at `/home/sandbox/harness`.
- **P3** — systemd as PID 1, `agro-bootstrap.service`, `agro-cron.service`,
  `cron-runtime.ts`, and the healthcheck.
- **P4** — the `agro` binary, `docker-compose.sh`, `paths.sh`, `manifest.json`,
  and the `agro.json` and `.env` split.
- **P5** — `.agro/hooks/`, `link-providers.sh` with its `--check` mode, and the
  environment-capability skills.

Two layers, two bars. The floor carries a per-boot tax: a line of the control
plane reaches every repository in the workspace, and a line of the entrypoint
runs on every boot, for every operator, whether or not it applies. Anything
that plugs in above the floor without joining it is a tenant. A tenant that
serves one project costs that project. Tenants are welcome. When a rule here
reads as hostile to a feature, re-check the layer: the bar is about where a
thing plugs in, not whether it deserves to exist.

### Four tests

Apply all four. A proposal that fails any one is a tenant, not floor.

1. **Primitive test.** Which of P1 to P5 does it serve? No answer means no.
2. **Workspace test.** Does it serve an agent working on any repository in the
   workspace? A thing that only applies to AGRO's own repository is not floor.
3. **Boot-path test.** The entrypoint may only do work that is true for every
   project.
4. **Journey test.** Every floor artifact appears in a numbered step of a real
   user journey, or is the reason a step does not fail. The second clause
   protects hooks, healthchecks, and link verification, which are invisible
   when they work.

"A test fails" is not an observable failure. Name the broken user path.

### How the floor grows

Recurring demand defines interfaces. When several independent requests wire in
the same kind of capability, the answer is a contract, not a queue of merges.
Land the seam, port the existing implementation onto it, and let the rest ship
against it.

## Skills

A skill earns its place in one of two ways. It teaches a harness to drive
something AGRO provides that the harness cannot discover on its own, or agents
use it often and get better results with it.

- **Environment capability.** Driving the terminal workspace, reaching a human
  from an unattended session, automating a browser, and the worktree and project
  clone mechanics that keep parallel work from colliding. These serve every
  repository in the workspace. They are floor.
- **Working practice.** Branch, pull request, and release conventions,
  requirements documents, plan formats, and prose style. These are tenants.
  They ship because they earn their place through use, and they stay only while
  that holds. AGRO does not require them; a harness is free to work its own way.

A skill that mixes categories gets split, not kept whole and not cut whole.

## What we will not add (for now)

- Fleet management, hosted control planes, multi-tenancy, or any authority above
  the operator.
- A second lifecycle door beside `agro`.
- Policy for one harness that bypasses `.agro/hooks/`.
- Project-specific install or start work in the boot path.
- Telemetry, or anything that moves operator data off the host, on by default.
- New floor skills when the capability can ship as a tenant.

This list is a roadmap guardrail, not a law of physics. A real journey and a
real constraint can change it.

## What would change this file

- A sixth primitive appears: a failure no harness can prevent for itself that
  P1 through P5 do not cover.
- A journey proves a tenant is load-bearing and it passes all four tests. It
  moves into the floor, and the floor is restated here.
- A current-focus item closes, and the claim it qualifies becomes a fact.

The current focus describes the repository today, not permanently. Each item is
expected to be deleted, and deleting one is the unit of progress this file
measures.
