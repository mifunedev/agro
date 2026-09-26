# RFC: Compatibility-first migration from AGRO to AGRO

Status: Accepted. Epic [#939](https://github.com/mifunedev/agro/issues/939);
phases [#940](https://github.com/mifunedev/agro/issues/940) →
[#945](https://github.com/mifunedev/agro/issues/945).

This document lists the decisions the operator confirmed before Phase 0
started. The document links to the epic. The document does not repeat the
epic's content.

## Decisions

| ID | Decision | Consequence |
|---|---|---|
| Q1 | `agro update` upgrades the installed CLI. `init` stays retired. | A CLI upgrade never equips a checkout, never vendors skills, never writes config, never migrates namespaces, never pulls images, and never restarts a container. Legacy `agro vendor` keeps its project-payload behavior through the compatibility window. Legacy `agro vendor` routes to the shared payload implementation. |
| Q2 | The host home holds registry state, not a managed source checkout. | `~/.agro/sandboxes/<name>/` replaces `~/.agro/sandboxes/<name>/`. There is no `~/.agro/source/`. `~/.agro` stays intact until the operator authorizes a verified transfer or cleanup. No process treats `~/.agro` as registry content. |
| Q3 | The sandbox is the only canonical setup model. | AGRO provides no `agro project update` command and no arbitrary-repository payload setup command. The image supplies the initial workspace. |
| Q4 | Before either optional GitHub prompt, the operator completes `gh auth login`, `gh auth setup-git`, and a successful `gh auth status` inside the sandbox. | The agent sends the private-versioning prompt and the upstream-contribution prompt only after that check passes. Provider authentication alone does not satisfy the check. |

## Architecture

The migration keeps one runtime implementation with temporary compatibility
entry points. The final state has no bulk rename, no second CLI, and no two
writable control planes.

- The compatibility contract has one definition, two boot-safe forms
  (`compat.ts`, `paths.sh`), and shared test vectors. Equivalence means byte
  identity. Divergence fails closed. `AGRO_*` wins over a conflicting alias;
  the warning names the conflicting keys only.
- The migration engine plans before it mutates. The migration engine
  revalidates a plan before it applies the plan. The migration engine locks
  against a concurrent writer. The migration engine refuses a symlink escape.
  The migration engine uses same-filesystem renames. The migration engine
  reports a partial result explicitly. The migration engine provides no force
  option.
- Compatibility lasts at least `<duration>` and at least three releases from
  the first public AGRO release, whichever is longer. The version lineage
  stays at `0.x`.

Phase ordering is a hard constraint: #940 → #941 → #942 → #943 → #944 → #945.
Each phase stops at its exit gate. A later phase cannot repair a missing gate
in an earlier phase.

## Phase 0 contract

See [`docs/agro-compatibility.md`](../agro-compatibility.md) for the resolver,
the precedence rules, the migration engine, and the inventory that Phase 0
delivers. The same document lists the legacy references left for later
phases.

## Phase 1 contract

See [`docs/agro-compatibility.md` § Phase 1 — entry points and artifacts](../agro-compatibility.md#phase-1--entry-points-and-artifacts)
for these Phase 1 items:

- the `agro`/`oh` executable-name identity;
- the `@mifune/agro` package and the `@mifune/agro` shim;
- `agro update` versus `agro vendor`;
- the artifact-only `get-agro.sh` and its `AGRO_*` aliases;
- the dual-published release artifacts;
- the defaults Phase 1 leaves unchanged.
