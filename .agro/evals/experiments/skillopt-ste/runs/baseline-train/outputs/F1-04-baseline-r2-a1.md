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
| Q2 | The host home holds registry state. The host home does not hold a managed source checkout. | `~/.agro/sandboxes/<name>/` replaces `~/.agro/sandboxes/<name>/`. No `~/.agro/source/` directory exists. `~/.agro` stays intact until the operator authorizes a verified transfer or a verified cleanup. AGRO never treats `~/.agro` as registry content. |
| Q3 | The sandbox is the only canonical setup model. | No `agro project update` command exists. No payload setup command for an arbitrary repository exists. The image supplies the initial workspace. |
| Q4 | Inside the sandbox, the operator completes three steps before either optional GitHub prompt: `gh auth login`, `gh auth setup-git`, and a successful `gh auth status`. | The agent sends the private-versioning prompt and the upstream-contribution prompt only after that check passes. Provider authentication does not satisfy that check. |

## Architecture

The migration uses one runtime implementation with temporary compatibility entry
points. The final state has no bulk rename. The final state has no second CLI.
The final state has no two writable control planes.

- One compatibility contract has two boot-safe forms: `compat.ts` and
  `paths.sh`. The two forms share one set of test vectors.
  - Two outputs are equivalent only when the outputs are byte-identical.
  - If the two forms diverge, the check fails closed.
  - If an `AGRO_*` key conflicts with an alias, the `AGRO_*` key wins. The
    warning names the conflicting keys only.
- The migration engine follows these rules:
  1. The engine plans before the engine changes any file.
  2. The engine revalidates the plan before the engine applies the plan.
  3. The engine locks out concurrent writers.
  4. The engine refuses a symlink that escapes its target root.
  5. The engine renames files only within one filesystem.
  6. The engine reports each partial result explicitly.
  7. The engine offers no force option.
- Compatibility lasts for the longer of two periods: `<minimum duration>`, or
  three releases after the first public AGRO release.
- Version lineage stays `0.x`.

Phase order is a hard constraint: #940 → #941 → #942 → #943 → #944 → #945.
Each phase stops at its exit gate. A later phase cannot repair a missing gate.

## Phase 0 contract

Read [`docs/agro-compatibility.md`](../agro-compatibility.md) for the Phase 0
deliverables: the resolver, the precedence rules, the migration engine, and the
inventory. The same file lists the legacy references that Phase 0 leaves for
later phases on purpose.

## Phase 1 contract

Read [`docs/agro-compatibility.md` § Phase 1 — entry points and artifacts](../agro-compatibility.md#phase-1--entry-points-and-artifacts)
for these Phase 1 items:

- the `agro`/`oh` executable-name identity
- the `@mifune/agro` package and the `@mifune/agro` shim
- `agro update` compared with `agro vendor`
- the artifact-only `get-agro.sh` and its `AGRO_*` aliases
- the dual-published release artifacts
- the defaults that Phase 1 leaves unchanged
