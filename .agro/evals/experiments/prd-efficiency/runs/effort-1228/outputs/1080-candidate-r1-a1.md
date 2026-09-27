# PRD: Installation-aware missing lifecycle script diagnostic

Status: DRAFT

## User Stories

### US-001: Name the recovery that matches the installation

**Description:** As an operator, I want an error that names a working recovery so that I avoid a refused command.

**Acceptance Criteria:**

- [ ] A red test exists first. The test reproduces the issue: `requireLifecycleScript` throws for a root without `<controlDir>/scripts/gateway.sh` while `activeBin()` returns `agro`. The test fails against the current message, which contains `` `agro update` `` and the text `re-vendor it`.
- [ ] For an `image` installation, the message names the host image refresh: `<bin> stop`, then `<bin> sandbox install docker --name <name>`. The message does not contain `` `agro update` ``.
- [ ] For an `npm`, `standalone`, or `source` installation, the message names `oh update`, the verb that vendors the control plane, per `.agro/cli/src/cli.ts:222-226`.
- [ ] For an `unknown` or `legacy-package` installation, the message names `oh update` and the host image refresh.
- [ ] The existing case "fails with the %s re-vendor hint when the entry carries no script" in `.agro/cli/src/__tests__/compose-verbs.test.ts:124` asserts the new text and passes.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `<cli test command>` exits 0.

### US-002: Name a generation mismatch

**Description:** As an operator, I want the error to name a generation mismatch so that the message diagnoses version skew.

**Acceptance Criteria:**

- [ ] If the resolved control directory is `.oh` and `<root>/.agro/scripts/<rel>` exists, the message names the generation mismatch and names `.agro/` as the directory on disk.
- [ ] If the resolved control directory is `.agro` and `<root>/.oh/scripts/<rel>` exists, the message names the generation mismatch and names `.oh/` as the directory on disk.
- [ ] If neither generation holds the script, the message contains no generation-mismatch text.
- [ ] A test covers each of the three cases above and passes.

### US-003: Document recovery for an affected sandbox

**Description:** As an operator, I want a recovery procedure for a stale image CLI so that I recover without a change to `/opt/oh`.

**Acceptance Criteria:**

- [ ] `docs/repair-stale-image-cli.md` exists. The file quotes the error `missing lifecycle script /home/sandbox/harness/.oh/scripts/gateway.sh`.
- [ ] The file explains that `/usr/local/bin/agro` resolves to `/opt/oh/dist/agro.js`, and that `agro --version` reports the image copy.
- [ ] The file gives the host procedure: `agro stop <name>`, then `agro sandbox install docker --name <name>`, then `agro ps <name>`.
- [ ] The file states that the procedure does not mutate `/opt/oh` in a running sandbox and adds no `.oh` to `.agro` symlink.
- [ ] `docs/README.md` links the new file.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/repair-stale-image-cli.md` exits 0.

## Summary

The issue (`work/issue-1080.md`) reports two layers. The first layer is an old image bundle, `@mifune/agro` v0.9.0 at `/opt/oh/dist/agro.js`, that hardcodes `<root>/.oh/scripts/`. A host image refresh fixes that layer. This task changes no image.

The second layer is live in current source. `requireLifecycleScript` in `.agro/cli/src/lib/execution/runner.ts:70-79` resolves the control directory through `resolveProjectLayout` (`.agro/cli/src/lib/compat.ts:204`). The path resolution is correct. The error message tells the operator to run `` `${activeBin()} update` `` to re-vendor the payload. That advice is wrong for `agro`:

- `agro update` upgrades the CLI. `oh update` vendors the control plane (`.agro/cli/src/cli.ts:104-108`, `:182-226`).
- For an `image` installation, `classifyInstallation` returns `{ kind: "image" }` for a `/opt/oh/` prefix (`.agro/cli/src/commands/self-upgrade.ts:117`). `refuseUnsupported` then refuses with the host image refresh (`self-upgrade.ts:185-191`).

The selected approach builds the message from `classifyInstallation(process.argv[1], <deps>)`. The approach reuses the host refresh text that `refuseUnsupported` already holds. The approach also checks the other generation's control directory with `controlDirCandidates()` (`compat.ts:229`).

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/execution/runner.ts` | `requireLifecycleScript` | Throws the diagnostic. This task changes the message. |
| `.agro/cli/src/commands/self-upgrade.ts` | `classifyInstallation`, `refuseUnsupported`, `IMAGE_ROOT` | Source of the installation kind and the host refresh text. |
| `.agro/cli/src/lib/compat.ts` | `resolveProjectLayout`, `controlDirCandidates`, `GENERATIONS` | Source of the resolved and the other generation directory names. |
| `.agro/cli/src/lib/product.ts` | `activeBin` | Source of the invoked binary name. |
| `.agro/cli/src/commands/lifecycle.ts` | callers at lines 173, 199, 276, 289, 381 | Callers. No change. |
| `.agro/cli/src/lib/execution/docker-compose-target.ts` | caller at line 143 | Caller. No change. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `missing lifecycle script` error text | Modified | The recovery text depends on the installation kind and on the generation on disk. |
| `docs/repair-stale-image-cli.md` | Added | Operator recovery procedure. |
| `docs/README.md` | Modified | Link to the new procedure. |

## Storage

N/A. The change reads the filesystem and writes no state.

## Architectural Decisions

- `classifyInstallation` stays the single source of truth for the installation kind. The diagnostic does not add a second `/opt/oh/` check.
- The host image refresh text has one source. Extract that text from `refuseUnsupported` into one exported function, and call the function from both sites.
- The change keeps ownership and lifecycle unchanged. The CLI does not repair `/opt/oh` and does not create a symlink.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/execution/__tests__/runner.test.ts` | image, npm, standalone, source, unknown installation kinds | US-001 message per kind |
| `.agro/cli/src/lib/execution/__tests__/runner.test.ts` | `.oh` resolved with `.agro` script on disk; reverse; neither | US-002 mismatch text |
| `.agro/cli/src/__tests__/compose-verbs.test.ts` | "fails with the %s re-vendor hint when the entry carries no script" | US-001 regression through `runComposeVerb` |
| `.agro/cli/src/commands/__tests__/<self-upgrade test file>` | image refusal text | Extraction keeps the refusal text unchanged |

## Design Principles

- Code is the source of truth. Add no comments to tracked code.
- Keep one source for each message fragment.
- Make the smallest change that corrects the advice.
- Write the red test before the fix.

## Out of Scope

- A `.oh` to `.agro` symlink.
- Automatic boot-time installation or refresh of `/opt/oh`.
- Any mutation of `/opt/oh` in a running sandbox.
- Any change to Slack credentials.
- A rebuild or publish of the sandbox image.

## Open Questions

1. Which command runs the CLI tests? `.agro/cli/package.json` shows `build` and `typecheck`. This plan did not verify a `test` script. The plan uses `<cli test command>`.
2. Does `requireLifecycleScript` take the installation as an injected argument for tests, or does the function call `classifyInstallation` with default filesystem dependencies? The plan prefers an injected argument with a default.
3. Which file holds the existing self-upgrade tests? The plan uses `<self-upgrade test file>`.
4. Does `mifunedev/agro-web` need a matching recovery page?

## Acceptance Criteria

- [ ] No `requireLifecycleScript` message tells an `image` installation to run `agro update`.
- [ ] Each installation kind receives a recovery verb that the CLI accepts for that kind.
- [ ] The generation-mismatch text appears only when the other generation holds the script.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0.
- [ ] `<cli test command>` exits 0.
- [ ] `docs/repair-stale-image-cli.md` passes `ste-check.sh`.

## Lessons

Filled by the advisor before undraft.
