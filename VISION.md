# AGRO vision

AGRO is an environment, not a methodology.

A modern coding harness already plans, remembers, writes code, and reviews its
own work. It cannot give itself an isolated runtime, a durable identity,
supervision that outlives a terminal, or a single policy source that holds
across harnesses. AGRO supplies those and stops.

This file sets the trajectory and the floor that changes are measured against.
`AGENTS.md` holds the rules that bind agents working here. When the two
disagree, `AGENTS.md` wins for conduct and this file wins for scope.
`AGENTS.md` asks for detailed explanation to live in `docs/`. A vision is scope,
not explanation, so it sits beside the rules it governs.

## Who AGRO is for

AGRO serves the operator: one person who runs several coding agents against work
they care about, on a machine they do not want to damage, and who often reaches
those agents from somewhere else.

The operator is the focus, and the only one. AGRO knows nothing of fleets,
consoles, or hosted operations, and gains nothing by learning. There is no
tenant above the operator, no plane above the sandbox, and no account the
workspace reports to.

A proposal that only makes sense when something manages many sandboxes at once
is out of scope here. That is a boundary of design, not of packaging: it holds
whatever else exists elsewhere.

## The workspace

The sandbox holds one workspace. The workspace is the harness repository at its
root, and any number of independent clones under `projects/<owner>/<repo>/`.

A project clone is its own git boundary, with its own remote, branches, history,
and worktrees. The harness is not their parent. It is the first instance of the
same rule.

This shape decides what the control plane is for. The control plane serves an
agent working on **any** repository in the workspace.

## The floor

Five primitives. Each prevents one failure that nothing else covers.

| Primitive | Failure it prevents |
| --- | --- |
| **P1 — Isolated runtime** | Agent work escapes onto the host. |
| **P2 — Durable identity** | Auth, tools, and history die with the container. |
| **P3 — Unattended supervision** | A disconnect ends the work. |
| **P4 — One door** | Host and sandbox drift into two systems. |
| **P5 — One policy source** | Harness choice changes behavior. |

The artifacts that realize them:

- **P1** — `.devcontainer/Dockerfile`, `docker-compose.yml` and its overlays, and
  the privilege block.
- **P2** — the named `workspace` volume at `/home/sandbox` and the repository
  bind at `/home/sandbox/harness`.
- **P3** — systemd as PID 1, `agro-bootstrap.service`, `agro-cron.service`,
  `cron-runtime.ts`, and the healthcheck.
- **P4** — the `agro` binary, `docker-compose.sh`, `paths.sh`, `manifest.json`,
  and the `agro.json` and `.env` split.
- **P5** — `.agro/hooks/`, `link-providers.sh` with its `--check` mode, and the
  environment-capability skills.

## The tax

The floor carries a stricter bar than anything above it, because its cost is
paid per project and per boot rather than once.

A tenant that serves one project costs that project. A line of the control plane
reaches every repository in the workspace. A line of the entrypoint runs on
every boot, for every operator, whether or not it applies.

Tenants are welcome. The bar is about where a thing plugs in, not whether it
deserves to exist.

## Four tests

Apply all four. A proposal that fails any one is a tenant, not core.

1. **Primitive test.** Which of P1 to P5 does it serve? No answer means no.
2. **Workspace test.** Does it serve an agent working on any repository in the
   workspace? A thing that only applies to AGRO's own repository is product
   operations, not control plane.
3. **Boot-path test.** The entrypoint may only do work that is true for every
   project.
4. **Journey test.** Every floor artifact appears in a numbered step of a real
   user journey, or is the reason a step does not fail. The second clause
   protects hooks, healthchecks, and link verification, which are invisible
   when they work.

"A test fails" is not an observable failure. Name the broken user path.

## Security posture

P1 is stated in one direction: agent work must not escape onto the host. The
other direction needs saying.

The sandbox holds live credentials. AGRO does not send anything out of it that
the operator did not ask for. No usage analytics, no telemetry, no attribution
to the project. A capability that moves data off the host is opt-in, is named in
the operator's own configuration, and passes the four tests before it is
considered at all.

The privilege posture is the operator's decision to make, and it must be visible
to them. Machinery that grants a harness elevated permission, relaxes a
confirmation, or bypasses a prompt belongs in configuration the operator can
read, not in an image layer or a boot-path side effect. Reporting and policy
live in [`SECURITY.md`](SECURITY.md).

## Skills

A skill earns its place when it teaches a harness to drive something AGRO
provides that the harness cannot discover on its own. The pack sorts three ways.

- **Environment capability.** Driving the terminal workspace, reaching a human
  from an unattended session, automating a browser, and the worktree and project
  clone mechanics that keep parallel work from colliding. These serve every
  repository in the workspace. They are floor.
- **Product operations.** Releasing AGRO itself, and this repository's own
  branch, pull request, and changelog conventions. These serve exactly one
  repository. Conventions belong in `AGENTS.md`, which already holds them.
- **Methodology.** Requirements documents, plan formats, and prose style. The
  harness owns these, on the same reasoning that removed the task, evaluation,
  knowledge, and memory machinery.

The current pack is retained by operator decision. The second and third
categories stay until they have somewhere to go; see Open questions. A skill
that mixes categories gets split, not kept whole and not cut whole.

## Promotion and migration

**Recurring demand defines interfaces.** When several independent requests wire
in the same kind of capability, the answer is a contract, not a queue of merges.
Land the seam, port the existing implementation onto it, and let the rest ship
against it.

**Transitional code declares its end, and the end is honored.** A compatibility
shim, a config migration, or a rename alias ships naming the release that
retires it, and is deleted in that release rather than left to accumulate.
Runtime code reads the current schema only.

AGRO carries no legacy generation today. `harness.yaml`, `.oh/`, `oh.json`,
`OH_*`, `~/.oh`, the `oh` executable, and `agro migrate` are gone, along with
the machinery that translated them. A shim that outlives its stated release is
a defect, not a courtesy: it is unreachable code that every operator still
pays for on every lifecycle call.

A change that invalidates existing operator configuration carries the migration
that detects the old shape, explains it, backs it up, and rewrites it — and
that migration declares its own end on arrival.

## What we will not add, for now

- A task system, an evaluation harness, a knowledge base, or a memory store.
  The harness owns these.
- Fleet management, shared control planes, multi-tenancy, or any notion of an
  authority above the operator.
- Reporting a sandbox's existence, health, or activity to anything the operator
  did not configure themselves.
- New methodology skills.
- Project-specific install or start work in the boot path.
- Anything that moves operator data off the host by default.
- Machinery that hides the sandbox boundary, the privilege posture, or a
  credential decision from the operator.
- A second door. Lifecycle work reaches the operator through `agro` or not at
  all.

This list is a roadmap guardrail, not a law of physics. A real journey and a
real constraint can change it.

## Known gaps

Stated plainly, because the tests above currently fail against the repository.
A claim in this file that the code does not meet belongs here, not in the
section that asserts it.

- **P5 covers two harnesses, not nine.** The harness catalog ships nine. Only
  Claude Code and Codex have a hook surface; the other seven run with no policy
  enforcement. Until that closes, "harness choice does not change behavior" is
  a goal, not a fact. Every surface that exists now reads the canonical
  `.agro/hooks/` source directly, so what is missing is coverage, not
  correctness.
- **The boot path is not clean, and the escape hatch is not a seam.** A large
  share of the entrypoint is stack- or vendor-specific work that runs inline.
  The `*-entrypoint-hook.sh` loop exists, ships no hooks, has no documented
  contract, runs as root, and runs after the work it would replace. The rule in
  test 3 cannot be enforced until that contract exists.
- **The one door does not know the workspace shape.** No `agro` verb addresses
  `projects/<owner>/<repo>/`. The shape lives in `agro-path`, two `AGENTS.md`
  files, and a skill.
- **The documented journeys are mostly AGRO repairing AGRO.** The operator's
  actual path — an agent working in a project clone — is a few prose prompts
  with no commands and no failure paths.
- **Documentation is not verified against the binary.** Nothing fails when a
  doc names a verb the CLI does not implement. The `agro migrate` references
  were found by reading, not by a check.

## Open questions

- **Where product-operations and methodology skills go.** Eviction without a
  destination does not happen. A separate repository, a published pack, or
  deletion are all defensible. Nothing is decided, and nothing moves until it
  is.
- **Preventive day-2 operation.** Recovery and upgrade are documented in
  `docs/lifecycle-commands.md` and `docs/repair-sandbox-boot-advisory.md`, and
  the `self-upgrade` and `vendor` split is taught there. What does not exist is
  the path that avoids the incident: backup and restore of the `workspace`
  volume, and refreshing a running sandbox's image outside an error recovery.

## What would change this file

- A sixth primitive appears: a failure no harness can prevent for itself that
  P1 through P5 do not cover.
- A journey proves a tenant is load-bearing. It moves into the floor, and the
  floor is restated here.
- A known gap closes, and the claim it qualifies becomes a fact.

The gaps and open questions above are the current state of the repository, not
a permanent description of it. Each entry is expected to be deleted, and
deleting one is the unit of progress this file measures.

Prefer ambitious outcomes and simple systems. Find the real constraint, then
choose the smallest model that makes correct behavior unsurprising.
