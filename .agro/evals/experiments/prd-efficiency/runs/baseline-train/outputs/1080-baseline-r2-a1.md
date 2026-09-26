# PRD: Lifecycle Script Recovery Hint

Status: BLOCKED

Tracks GitHub issue #1080. Source: `work/issue-1080.md`.

## User Stories

### US-001: Installation-aware recovery hint

**Description:** As an operator who hits `missing lifecycle script`, I want a recovery command that works for my CLI installation so that I avoid a refused command.

**Acceptance Criteria:**

- [ ] `requireLifecycleScript` in `.agro/cli/src/lib/execution/runner.ts` no longer tells an `agro` caller to run `agro update`.
- [ ] If the installation kind is `image`, the error names the host image refresh: `agro stop <name>`, then `agro sandbox install docker --name <name>`.
- [ ] If the installation kind is `npm`, `standalone`, `source`, `legacy-package`, or `unknown`, the error names `oh update` as the command that re-vendors the control plane.
- [ ] If the invoked binary is `oh`, the error names `oh update` for every installation kind except `image`.
- [ ] The error keeps the literal prefix `missing lifecycle script <absolute script path>`, so the `CONFIG_RESOLUTION_FAILURES` pattern in `.agro/cli/src/commands/__tests__/migrate-rehearsal.test.ts` still matches.
- [ ] The installation kind comes from `classifyInstallation` in `.agro/cli/src/commands/self-upgrade.ts`. No second classifier exists.
- [ ] `npx vitest run .agro/cli/src/__tests__/compose-verbs.test.ts` exits 0.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.

### US-002: Regression tests for the hint

**Description:** As a maintainer, I want tests that fail against the current message and pass after the fix so that the dead-end advice cannot return.

**Acceptance Criteria:**

- [ ] The test case `fails with the %s re-vendor hint when the entry carries no script` in `.agro/cli/src/__tests__/compose-verbs.test.ts` is replaced by cases that assert the new hint per installation kind.
- [ ] One case asserts that an `image` installation invoked as `agro` gets the host image refresh and does not get the string `` `agro update` ``.
- [ ] One case asserts that a non-image installation invoked as `agro` gets `` `oh update` ``.
- [ ] One case asserts that a non-image installation invoked as `oh` gets `` `oh update` ``.
- [ ] Each new case fails when run against the unmodified `runner.ts`. The implementer records the failing run in `.agro/tasks/lifecycle-script-recovery-hint/evidence.md`.
- [ ] `npm test` exits 0 from the repository root.

### US-003: Recovery documentation for a stale image CLI

**Description:** As an operator whose sandbox already shows `missing lifecycle script /home/sandbox/harness/.oh/scripts/gateway.sh`, I want a recovery procedure so that I can restore `agro gateway` without guessing.

**Acceptance Criteria:**

- [ ] `docs/lifecycle-commands.md` has a section that quotes the error string `missing lifecycle script`.
- [ ] The section tells the operator to run `agro --version` inside the sandbox to read the CLI version.
- [ ] The section states that an image CLI older than the `.agro`/`.oh` generation pair resolves `<root>/.oh/scripts/`, and that the fix is a newer image, not a vendoring command.
- [ ] The section gives the host procedure as numbered steps: `agro stop <name>`, then `agro sandbox install docker --name <name>`, then `agro ps <name>`.
- [ ] The section states that `agro update` refuses an image installation and gives the reason.
- [ ] The section does not propose a `.oh` → `.agro` symlink and does not propose a change to `/opt/oh` inside a running sandbox.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/lifecycle-commands.md` reports no finding in the new section.

## Summary

Verified current state:

- `requireLifecycleScript` (`.agro/cli/src/lib/execution/runner.ts:70-79`) resolves the control directory through `resolveProjectLayout` (`.agro/cli/src/lib/compat.ts:204-221`). The path resolution follows the directory on disk. The path defect from the report is already fixed in source.
- The error text ends with ``run `${activeBin()} update` to re-vendor it``. For the `agro` binary, `update` is CLI self-upgrade (`printSelfUpgradeHelp`, `.agro/cli/src/cli.ts:182-216`). The command that vendors `.agro/` is `oh update` (`printUpdateHelp`, `.agro/cli/src/cli.ts:218`).
- The sandbox image copies `.agro/cli/` to `/opt/oh/` and links `/usr/local/bin/agro` and `/usr/local/bin/oh` (`.devcontainer/Dockerfile:53-57`).
- `classifyInstallation` returns `{ kind: "image" }` for a target under `/opt/oh/` (`.agro/cli/src/commands/self-upgrade.ts:70`, `:117`). `refuseUnsupported` then refuses with the host image refresh (`:185-191`).
- Six call sites use `requireLifecycleScript`: `.agro/cli/src/commands/lifecycle.ts:173`, `:199`, `:276`, `:289`, `:381`, and `.agro/cli/src/lib/execution/docker-compose-target.ts:143`.
- The current test `compose-verbs.test.ts:124-138` asserts `` `${bin} update` `` for both `agro` and `oh`. That test locks in the defect for `agro`.

Selected approach: `requireLifecycleScript` calls `classifyInstallation(process.argv[1], defaultDeps(<version>))` and builds the hint from the kind. The image kind reuses the refresh procedure that `refuseUnsupported` already prints. Every other kind names `oh update`. A recovery section in `docs/lifecycle-commands.md` covers a sandbox that runs the old v0.9.0 bundle, because a code change cannot reach an already-built image.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/execution/runner.ts` | `requireLifecycleScript` | Builds the error text. Owns the change. |
| `.agro/cli/src/commands/self-upgrade.ts` | `classifyInstallation`, `defaultDeps`, `refuseUnsupported` | Source of the installation kind and of the image refresh wording. |
| `.agro/cli/src/lib/product.ts` | `activeBin` | Names the invoked binary. |
| `.agro/cli/src/lib/compat.ts` | `resolveProjectLayout`, `resolveControlDir` | Resolves the control directory. No change. |
| `.agro/cli/src/cli.ts` | `VERSION` | Supplies the running version to `defaultDeps`. |
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | `fails with the %s re-vendor hint…` | Existing assertion to replace. |
| `.agro/cli/src/commands/__tests__/migrate-rehearsal.test.ts` | `CONFIG_RESOLUTION_FAILURES` | Depends on the `missing lifecycle script` prefix. |
| `docs/lifecycle-commands.md` | new recovery section | Operator recovery procedure. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| CLI error text of `requireLifecycleScript` | Modified | The hint depends on the installation kind and the invoked binary. The prefix stays the same. |
| `docs/lifecycle-commands.md` | Added section | Recovery procedure for a stale image CLI. |
| `mifunedev/agro-web` | Possible mirror | See open question 3. |
| `CHANGELOG.md` | Added entry | One `Fixed` entry under the unreleased heading. |

## Storage

N/A. The change touches an error string and a document. No state persists.

## Architectural Decisions

- `classifyInstallation` stays the one source of truth for the installation kind. `requireLifecycleScript` consumes the kind and does not re-derive the kind from paths.
- `refuseUnsupported` stays the one source of the image refresh wording. The implementer extracts the shared text into one exported function or constant in `self-upgrade.ts` so that the two messages cannot drift.
- `resolveProjectLayout` and the control-directory resolution stay unchanged.
- The change adds no `.oh` → `.agro` symlink, no boot-time install or refresh of `/opt/oh`, no Slack credential change, and no mutation of `/opt/oh` on a running sandbox.
- Affected surfaces:
  - Host and sandbox: applied. The error fires on the host and in the sandbox. The code change is in `.agro/cli/`.
  - Lifecycle door: applied. Every verb that calls `requireLifecycleScript` gets the same hint.
  - Canonical and provider surfaces: not applicable. No skill or hook changes.
  - Root and scaffold: applied. Initialized projects receive the CLI through `oh update` and the image.
  - Interactive and headless processes: not applicable.
  - Local and remote operation: applied. The image refresh runs on the host that owns the sandbox.
  - Parallel operation: not applicable.
  - Public documentation: see open question 3.
  - Verification: `npm test`, `npm --prefix .agro/cli run typecheck`, and the STE checker.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | image installation invoked as `agro` | Hint names the host image refresh and omits `` `agro update` ``. |
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | npm installation invoked as `agro` | Hint names `` `oh update` ``. |
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | npm installation invoked as `oh` | Hint names `` `oh update` ``. |
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | any kind | Message starts with `missing lifecycle script ` and the absolute script path. |
| `.agro/cli/src/commands/__tests__/migrate-rehearsal.test.ts` | existing cases | Prefix match still holds. No edit expected. |

Write the new cases first. Run the new cases against the unmodified `runner.ts` and confirm that each case fails. The tests must control the installation kind without a real `/opt/oh/`. The implementer selects the seam: an injected classifier argument, or a stub of `process.argv[1]` plus a stub of the filesystem calls. See open question 2.

## Design Principles

- Repository: code is the source of truth. Add no explanatory comment.
- Repository: keep one source of truth for each policy. Reuse `classifyInstallation` and the `refuseUnsupported` wording.
- Repository: make the smallest change that preserves the operator's intent.
- Task: an error message names only a command that succeeds for the reader who sees the message.

## Out of Scope

- A `.oh` → `.agro` symlink.
- Automatic install or refresh of `/opt/oh` at boot.
- Any mutation of `/opt/oh` on a running sandbox.
- Any change to Slack credentials.
- A change to `resolveProjectLayout` or to generation resolution.
- A change to the behavior of `agro update` or `oh update`.

## Open Questions

1. The issue asks the error to name a generation mismatch when the other generation's control directory is the one on disk. In current source, `resolvePair` (`.agro/cli/src/lib/compat.ts:148-169`) selects whichever directory exists. The resolved directory is therefore never the absent one while the other exists, and a mismatch check in `requireLifecycleScript` has no reachable input. Only the old v0.9.0 bundle hits the mismatch, and a source change cannot reach that bundle. Select one:
   - A. Drop the mismatch check from code. US-003 documents the version skew. (Recommended.)
   - B. Add the CLI version and the resolved generation to the error text, so that a future skew shows in the message.
   - C. Add the mismatch check anyway as a guard against a future resolution change.
   - D. Other: `<specify>`.
2. Which test seam controls the installation kind?
   - A. `requireLifecycleScript` accepts an optional installation argument with a default from `classifyInstallation`. (Recommended.)
   - B. Tests stub `process.argv[1]` and the filesystem.
   - C. Other: `<specify>`.
3. Must `mifunedev/agro-web` receive the same recovery section as `docs/lifecycle-commands.md`?
   - A. Yes. Open a matching change in `mifunedev/agro-web`.
   - B. No. The source docs are sufficient.
4. For an `image` installation, the bundled CLI can also vendor its own payload with `oh update`. Must the image hint also name `oh update` as a second option, or only the host image refresh that the issue requests?
   - A. Only the host image refresh. (Matches the issue.)
   - B. Both, host image refresh first.

## Acceptance Criteria

- [ ] No code path in `.agro/cli/src/` prints `` `agro update` `` as a way to re-vendor the control plane.
- [ ] An `image` installation receives the host image refresh procedure from `requireLifecycleScript`.
- [ ] A non-image installation receives `oh update` from `requireLifecycleScript`.
- [ ] The new tests fail against the unmodified `runner.ts` and pass after the change.
- [ ] `npm test` exits 0 from the repository root.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `docs/lifecycle-commands.md` holds the recovery section from US-003.
- [ ] `CHANGELOG.md` holds one `Fixed` entry for the change.
- [ ] Open question 1 has an operator answer, and the implementation matches the answer.

## Lessons

Filled by the advisor before undraft.
