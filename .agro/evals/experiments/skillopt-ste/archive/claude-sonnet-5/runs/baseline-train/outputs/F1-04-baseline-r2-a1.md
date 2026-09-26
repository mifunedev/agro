# RFC: Compatibility-first migration from AGRO to AGRO

Status: Accepted. Epic [#939](https://github.com/mifunedev/agro/issues/939);
phases [#940](https://github.com/mifunedev/agro/issues/940) →
[#945](https://github.com/mifunedev/agro/issues/945).

This record captures the decisions the operator settled before Phase 0 execution.
This record cites the epic. This record does not restate the epic.

## Decisions

| ID | Decision | Consequence |
|---|---|---|
| Q1 | `agro update` upgrades the installed CLI. `init` stays retired. | CLI upgrades never equip a checkout, vendor skills, write config, migrate namespaces, pull images, or restart containers. Legacy `agro vendor` keeps its project-payload behavior through the compatibility window and routes to the shared payload implementation. |
| Q2 | The host home holds registry state, not a managed source checkout. | `~/.agro/sandboxes/<name>/` replaces `<legacy-registry-path>`. There is no `~/.agro/source/`. `~/.agro` stays intact until the operator authorizes a verified transfer or cleanup. AGRO never treats `~/.agro` as registry content. |
| Q3 | The sandbox is the only canonical setup model. | No `agro project update` and no arbitrary-repository payload setup command. The image supplies the initial workspace. |
| Q4 | The operator completes `gh auth login`, `gh auth setup-git`, and a successful `gh auth status` inside the sandbox before either optional GitHub prompt. | The agent sends the private-versioning prompt and the upstream-contribution prompt only after the operator completes that check. Provider authentication alone does not satisfy the check. |

## Architecture

One runtime implementation with temporary compatibility entry points. No bulk
rename, no second CLI, no two writable control planes as the final state.

- The compatibility contract has two boot-safe forms: `compat.ts` and
  `paths.sh`. Both forms share test vectors. Equivalence means byte identity.
  A divergence fails closed. `AGRO_*` wins a conflicting alias. The warning
  names only the conflicting keys.
- The migration engine plans before it mutates. The migration engine
  revalidates before it applies. The migration engine locks against
  concurrent writers. The migration engine refuses symlink escapes. The
  migration engine uses same-filesystem renames. The migration engine reports
  partial results explicitly. The migration engine has no force option.
- Compatibility lasts at least `<duration>` and at least three releases from
  the first public AGRO release, whichever is longer. Version lineage stays
  `0.x`.

Phase ordering is a hard constraint: #940 → #941 → #942 → #943 → #944 → #945.
Each phase stops at its exit gate. A later phase cannot repair a missing gate.

## Phase 0 contract

See [`docs/agro-compatibility.md`](../agro-compatibility.md) for the resolver,
precedence, migration engine, and inventory that Phase 0 delivers, and for the
legacy references intentionally left for later phases.

## Phase 1 contract

See [`docs/agro-compatibility.md` § Phase 1 — entry points and artifacts](../agro-compatibility.md#phase-1--entry-points-and-artifacts)
for the `agro`/`oh` executable-name identity, the `@mifune/agro` package and
`<legacy-shim-package>` shim, `agro update` versus `agro vendor`, the
artifact-only `get-agro.sh` and its `AGRO_*` aliases, the dual-published
release artifacts, and the defaults Phase 1 leaves unchanged.
