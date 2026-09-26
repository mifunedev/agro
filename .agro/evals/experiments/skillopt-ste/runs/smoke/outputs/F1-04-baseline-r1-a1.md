# RFC: Compatibility-first migration from <legacy name> to AGRO

Status: Accepted. Epic [#939](https://github.com/mifunedev/agro/issues/939);
phases [#940](https://github.com/mifunedev/agro/issues/940) →
[#945](https://github.com/mifunedev/agro/issues/945).

This record captures the decisions that the operator settled before Phase 0
execution. This record cites the epic. This record does not restate the epic.

## Decisions

| ID | Decision | Consequence |
|---|---|---|
| Q1 | `agro update` upgrades the installed CLI. `init` stays retired. | A CLI upgrade never equips a checkout. A CLI upgrade never vendors skills, writes config, migrates namespaces, pulls images, or restarts containers. Legacy `agro vendor` keeps its project-payload behavior through the compatibility window. Legacy `agro vendor` routes to the shared payload implementation. |
| Q2 | The host home holds registry state. The host home holds no managed source checkout. | `~/.agro/sandboxes/<name>/` replaces `~/.agro/sandboxes/<name>/`. No `~/.agro/source/` directory exists. `~/.agro` stays intact until the operator authorizes a verified transfer or a verified cleanup. No component treats `~/.agro` as registry content. |
| Q3 | The sandbox is the only canonical setup model. | No `agro project update` command exists. No setup command exists for the payload of an arbitrary repository. The image supplies the initial workspace. |
| Q4 | Inside the sandbox, the operator runs `gh auth login`, then `gh auth setup-git`, then `gh auth status`. `gh auth status` must succeed before the agent sends either optional GitHub prompt. | The two optional GitHub prompts are the private-versioning prompt and the upstream-contribution prompt. The agent sends each prompt only after the `gh auth status` check succeeds. Provider authentication does not satisfy the `gh auth status` check. |

## Architecture

The final state has one runtime implementation. Temporary compatibility entry
points call that runtime implementation. The final state has no bulk rename, no
second CLI, and no second writable control plane.

- One compatibility contract exists in two boot-safe forms: `compat.ts` and
  `paths.sh`. Both forms share one set of test vectors.
  - Equivalence between the two forms means byte identity.
  - If the two forms diverge, the resolver fails closed.
  - If an `AGRO_*` key conflicts with an alias, the `AGRO_*` key wins. The
    resolver then prints a warning. The warning names only the keys, not the
    values.
- The migration engine applies these rules:
  - The engine writes a plan before the engine changes any file.
  - The engine revalidates the plan before the engine applies the plan.
  - The engine takes a lock against concurrent writers.
  - The engine refuses a symlink that escapes the target directory.
  - The engine moves files with same-filesystem renames.
  - The engine reports each partial result explicitly.
  - The engine has no force option.
- Compatibility lasts for the longer of two periods: `<duration>`, or three
  releases after the first public AGRO release. The version lineage stays at
  `0.x`.

Phase order is a hard constraint: #940 → #941 → #942 → #943 → #944 → #945.
Each phase stops at its exit gate. A later phase cannot repair a missing gate.

## Phase 0 contract

[`docs/agro-compatibility.md`](../agro-compatibility.md) describes the
deliverables of Phase 0: the resolver, the precedence rules, the migration
engine, and the inventory. The same file lists the legacy references that
Phase 0 leaves for later phases.

## Phase 1 contract

[`docs/agro-compatibility.md` § Phase 1 — entry points and artifacts](../agro-compatibility.md#phase-1--entry-points-and-artifacts)
describes these Phase 1 items:

- the identity of the `agro`/`oh` executable names
- the `@mifune/agro` package and the `@mifune/agro` shim
- the difference between `agro update` and `agro vendor`
- the artifact-only `get-agro.sh` script and its `AGRO_*` aliases
- the dual-published release artifacts
- the defaults that Phase 1 leaves unchanged
