# RFC: Compatibility-first migration from AGRO to AGRO

Status: Accepted. Epic [#939](https://github.com/mifunedev/agro/issues/939);
phases [#940](https://github.com/mifunedev/agro/issues/940) →
[#945](https://github.com/mifunedev/agro/issues/945).

This record captures the decisions that the operator settled before Phase 0
execution. This record cites the epic. This record does not restate the epic.

## Decisions

| ID | Decision | Consequence |
|---|---|---|
| Q1 | `agro update` upgrades the installed CLI. `init` stays retired. | A CLI upgrade never equips a checkout. A CLI upgrade never vendors skills, writes config, migrates namespaces, pulls images, or restarts containers. Through the compatibility window, legacy `agro vendor` keeps its project-payload behavior. Legacy `agro vendor` routes to the shared payload implementation. |
| Q2 | The host home holds registry state. The host home holds no managed source checkout. | `~/.agro/sandboxes/<name>/` replaces `~/.agro/sandboxes/<name>/`. No `~/.agro/source/` directory exists. `~/.agro` stays intact until the operator authorizes a verified transfer or a verified cleanup. No command treats `~/.agro` as registry content. |
| Q3 | The sandbox is the only canonical setup model. | No `agro project update` command exists. No payload setup command for an arbitrary repository exists. The image supplies the initial workspace. |
| Q4 | Before either optional GitHub prompt, the operator completes three steps inside the sandbox: `gh auth login`, `gh auth setup-git`, and a successful `gh auth status`. | The two optional GitHub prompts are private versioning and upstream contribution. The agent sends each prompt only after the `gh auth status` check succeeds. Provider authentication does not satisfy the `gh auth status` check. |

## Architecture

The final state has one runtime implementation. Temporary compatibility entry
points call that implementation. The migration does not rename in bulk. The
final state has no second CLI. The final state has no two writable control
planes.

- One compatibility contract exists in two boot-safe forms: `compat.ts` and
  `paths.sh`. Both forms share one set of test vectors.
  - The two forms are equivalent only when their outputs are byte-identical.
  - If the two forms diverge, the check fails closed.
  - If an `AGRO_*` key conflicts with an alias, the `AGRO_*` key wins. The
    resolver then emits a warning. The warning names only the keys.
- The migration engine does these things:
  1. The engine plans before the engine mutates state.
  2. The engine revalidates the plan before the engine applies the plan.
  3. The engine locks against concurrent writers.
  4. The engine refuses symlink escapes.
  5. The engine uses same-filesystem renames.
  6. The engine reports partial results explicitly.
- The migration engine has no force option.
- Compatibility lasts for the longer of two periods: `<duration>` or three
  releases from the first public AGRO release. The version lineage stays `0.x`.

Phase order is a hard constraint: #940 → #941 → #942 → #943 → #944 → #945.
Each phase stops at its exit gate. A later phase cannot repair a missing gate.

## Phase 0 contract

[`docs/agro-compatibility.md`](../agro-compatibility.md) describes the resolver,
the precedence, the migration engine, and the inventory that Phase 0 delivers.
The same file lists the legacy references that Phase 0 leaves for later phases.

## Phase 1 contract

[`docs/agro-compatibility.md` § Phase 1 — entry points and artifacts](../agro-compatibility.md#phase-1--entry-points-and-artifacts)
describes these Phase 1 items:

- the `agro`/`oh` executable-name identity
- the `@mifune/agro` package and the `@mifune/agro` shim
- the difference between `agro update` and `agro vendor`
- the artifact-only `get-agro.sh` and its `AGRO_*` aliases
- the dual-published release artifacts
- the defaults that Phase 1 leaves unchanged
