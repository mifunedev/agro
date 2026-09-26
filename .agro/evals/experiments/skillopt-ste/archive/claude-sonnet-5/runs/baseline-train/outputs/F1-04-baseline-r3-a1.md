# RFC: Compatibility-first migration from `<legacy-system>` to AGRO

Status: Accepted. Epic [#939](https://github.com/mifunedev/agro/issues/939);
phases [#940](https://github.com/mifunedev/agro/issues/940) →
[#945](https://github.com/mifunedev/agro/issues/945).

This record captures the decisions the operator settled before Phase 0 execution.
This record cites the epic. This record does not restate the epic content.

## Decisions

| ID | Decision | Consequence |
|---|---|---|
| Q1 | `agro update` upgrades the installed CLI. `init` stays retired. | `agro update` does not set up a checkout, vendor skills, or write configuration. `agro update` does not migrate namespaces, pull images, or restart containers. Legacy `agro vendor` keeps its project-payload behavior through the compatibility window. Legacy `agro vendor` routes to the shared payload implementation. |
| Q2 | The host home directory holds registry state, not a managed source checkout. | `<legacy-registry-path>/sandboxes/<name>/` replaces `~/.agro/sandboxes/<name>/`. There is no `~/.agro/source/`. `~/.agro` stays intact until the operator authorizes a verified transfer or cleanup. `~/.agro` is never registry content. |
| Q3 | The sandbox is the only canonical setup model. | AGRO offers no `agro project update` command. AGRO offers no arbitrary-repository payload setup command. The sandbox image supplies the initial workspace. |
| Q4 | Before either optional GitHub prompt, the operator runs `gh auth login`, then runs `gh auth setup-git`, then confirms `gh auth status` succeeds, all inside the sandbox. | The agent sends the private-versioning prompt and the upstream-contribution prompt only after `gh auth status` succeeds. Provider authentication alone does not satisfy the `gh auth status` requirement. |

## Architecture

AGRO uses one runtime implementation with temporary compatibility entry points.
The final state contains no bulk rename, no second CLI, and no two writable
control planes.

- The compatibility contract has two boot-safe forms, `compat.ts` and
  `paths.sh`, and shared test vectors. Equivalence means byte-identical output.
  A divergence fails closed. When aliases conflict, `AGRO_*` wins, and the
  system logs a warning that names the conflicting keys only.
- The migration engine plans before it mutates state. The migration engine
  revalidates a plan before it applies the plan. The migration engine locks
  against concurrent writers, refuses symlink escapes, and uses
  same-filesystem renames. The migration engine reports partial results
  explicitly. The migration engine offers no force option.
- Compatibility lasts at least `<duration>` and at least three releases from
  the first public AGRO release, whichever period is longer. The version
  lineage stays at `0.x`.

Phase ordering is a hard constraint: #940 → #941 → #942 → #943 → #944 → #945.
Each phase stops at its exit gate. A later phase cannot repair an earlier
phase's missing gate.

## Phase 0 contract

See [`docs/agro-compatibility.md`](../agro-compatibility.md) for the resolver,
the precedence rules, the migration engine, and the inventory that Phase 0
delivers. See the same document for the legacy references left for later
phases.

## Phase 1 contract

See [`docs/agro-compatibility.md` § Phase 1 — entry points and artifacts](../agro-compatibility.md#phase-1--entry-points-and-artifacts)
for the `agro`/`oh` executable-name identity. See the same section for the
`@mifune/agro` package and the `@mifune/agro` shim. See the same section for
`agro update` versus `agro vendor`. See the same section for the artifact-only
`get-agro.sh` script and its `AGRO_*` aliases. See the same section for the
dual-published release artifacts and the defaults that Phase 1 leaves
unchanged.
