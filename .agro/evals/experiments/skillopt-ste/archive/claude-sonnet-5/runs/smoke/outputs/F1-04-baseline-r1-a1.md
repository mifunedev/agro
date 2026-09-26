# RFC: Compatibility-first migration from <legacy-tool-name> to AGRO

Status: Accepted. Epic [#939](https://github.com/mifunedev/agro/issues/939);
phases [#940](https://github.com/mifunedev/agro/issues/940) →
[#945](https://github.com/mifunedev/agro/issues/945).

This record captures the decisions the operator settled before Phase 0 execution.
This record cites the epic and does not restate the epic.

## Decisions

| ID | Decision | Consequence |
|---|---|---|
| Q1 | `agro update` upgrades the installed CLI. `init` stays retired. | CLI upgrades never equip a checkout, vendor skills, write config, migrate namespaces, pull images, or restart containers. Legacy `agro vendor` keeps its project-payload behavior through the compatibility window. Legacy `agro vendor` routes to the shared payload implementation. |
| Q2 | The host home holds registry state, not a managed source checkout. | `~/.agro/sandboxes/<name>/` replaces `~/.agro/sandboxes/<name>/`. The registry has no `~/.agro/source/` directory. `~/.agro` stays intact until the operator authorizes a verified transfer or cleanup. AGRO never treats `~/.agro` as registry content. |
| Q3 | The sandbox is the only canonical setup model. | AGRO provides no `agro project update` command and no arbitrary-repository payload setup command. The image supplies the initial workspace. |
| Q4 | Before either optional GitHub prompt, the operator completes `gh auth login`, `gh auth setup-git`, and a successful `gh auth status` inside the sandbox. | The agent sends the private-versioning prompt and the upstream-contribution prompt only after that check passes. Provider authentication alone does not satisfy that check. |

## Architecture

The migration keeps one runtime implementation with temporary compatibility
entry points. The final state excludes a bulk rename, a second CLI, and two
writable control planes.

- The compatibility contract has one definition, two boot-safe forms
  (`compat.ts`, `paths.sh`), and shared test vectors. Equivalence means byte
  identity. AGRO fails closed when the two forms diverge. `AGRO_*` wins
  conflicting aliases. The warning names the conflicting keys only.
- The migration engine plans before it mutates. The migration engine
  revalidates before it applies a plan. The migration engine locks against
  concurrent writers and refuses symlink escapes. The migration engine uses
  same-filesystem renames and reports partial results explicitly. The
  migration engine offers no force option.
- Compatibility lasts at least <duration> or at least three releases from the
  first public AGRO release, whichever is longer. Version lineage stays `0.x`.

Phase ordering is a hard constraint: #940 → #941 → #942 → #943 → #944 → #945.
Each phase stops at its exit gate. A later phase cannot repair a missing gate.

## Phase 0 contract

See [`docs/agro-compatibility.md`](../agro-compatibility.md) for the resolver,
precedence, migration engine, and inventory that Phase 0 delivers. See the
same document for the legacy references intentionally left for later phases.

## Phase 1 contract

See [`docs/agro-compatibility.md` § Phase 1 — entry points and artifacts](../agro-compatibility.md#phase-1--entry-points-and-artifacts)
for the `agro`/`oh` executable-name identity. The same section covers the
`@mifune/agro` package and `@mifune/agro` shim, and `agro update` versus
`agro vendor`. The same section also covers the artifact-only `get-agro.sh`
and its `AGRO_*` aliases, the dual-published release artifacts, and the
defaults Phase 1 leaves unchanged.
