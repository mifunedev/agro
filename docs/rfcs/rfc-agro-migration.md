# RFC: Compatibility-first migration from AGRO to AGRO

Status: Accepted. Epic [#939](https://github.com/mifunedev/agro/issues/939);
phases [#940](https://github.com/mifunedev/agro/issues/940) →
[#945](https://github.com/mifunedev/agro/issues/945).

This record captures the decisions the operator settled before Phase 0 execution.
It cites; it does not restate the epic.

## Decisions

| ID | Decision | Consequence |
|---|---|---|
| Q1 | `agro update` upgrades the installed CLI. `init` stays retired. | CLI upgrades never equip a checkout, vendor skills, write config, migrate namespaces, pull images, or restart containers. Legacy `agro vendor` keeps its project-payload behavior through the compatibility window and routes to the shared payload implementation. |
| Q2 | The host home holds registry state, not a managed source checkout. | `~/.agro/sandboxes/<name>/` replaces `~/.agro/sandboxes/<name>/`. There is no `~/.agro/source/`. `~/.agro` stays intact until the operator authorizes a verified transfer or cleanup, and is never treated as registry content. |
| Q3 | The sandbox is the only canonical setup model. | No `agro project update` and no arbitrary-repository payload setup command. The image supplies the initial workspace. |
| Q4 | The operator completes `gh auth login`, `gh auth setup-git`, and a successful `gh auth status` inside the sandbox before either optional GitHub prompt. | Private versioning and upstream contribution are agent prompts sent only after that check. Provider authentication does not satisfy it. |

## Architecture

One runtime implementation with temporary compatibility entry points. No bulk
rename, no second CLI, no two writable control planes as the final state.

- One compatibility contract, two boot-safe forms (`compat.ts`, `paths.sh`),
  shared test vectors. Equivalence is byte identity; divergence fails closed;
  `AGRO_*` wins conflicting aliases with a warning that names keys only.
- A migration engine that plans before it mutates, revalidates before it applies,
  locks against concurrent writers, refuses symlink escapes, uses same-filesystem
  renames, and reports partial results explicitly. No force option.
- Compatibility lasts at least 90 days and at least three releases from the first
  public AGRO release, whichever is longer. Version lineage stays `0.x`.

Phase ordering is a hard constraint: #940 → #941 → #942 → #943 → #944 → #945.
Each phase stops at its exit gate; a later phase cannot repair a missing gate.

## Phase 0 contract

See [`docs/agro-compatibility.md`](../agro-compatibility.md) for the resolver,
precedence, migration engine, and inventory that Phase 0 delivers, and for the
legacy references intentionally left for later phases.

## Phase 1 contract

See [`docs/agro-compatibility.md` § Phase 1 — entry points and artifacts](../agro-compatibility.md#phase-1--entry-points-and-artifacts)
for the `agro`/`oh` executable-name identity, the `@mifune/agro` package and
`@mifune/agro` shim, `agro update` versus `agro vendor`, the artifact-only
`get-agro.sh` and its `AGRO_*` aliases, the dual-published release artifacts, and
the defaults Phase 1 leaves unchanged.
