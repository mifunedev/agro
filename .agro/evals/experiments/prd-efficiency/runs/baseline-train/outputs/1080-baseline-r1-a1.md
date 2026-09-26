# PRD: Lifecycle script recovery hint

Status: DRAFT

Source: `work/issue-1080.md` (issue #1080).

## User Stories

### US-001: Share the image-installation test

**Description:** As a CLI maintainer, I want one image-installation definition so that `agro update` and the lifecycle-script diagnostic agree.

**Acceptance Criteria:**

- [ ] `.agro/cli/src/lib/product.ts` exports the image root `/opt/oh/` and one predicate that tests a resolved executable path against that root.
- [ ] `kindOfTarget` in `.agro/cli/src/commands/self-upgrade.ts` uses the exported predicate. The file no longer declares its own `IMAGE_ROOT` constant.
- [ ] `.agro/cli/src/lib/product.ts` exports one function that returns the image-refresh procedure text. `refuseUnsupported` builds its `image` message from that function.
- [ ] The `image` refusal message in `refuseUnsupported` stays byte-identical to the current message.
- [ ] `pnpm test -- .agro/cli/src/__tests__/self-upgrade.test.ts` exits 0.

### US-002: Make the missing-script diagnostic installation-aware

**Description:** As a sandbox operator, I want a recovery step for my installation so that the error never names a refused `agro update`.

**Acceptance Criteria:**

- [ ] The error message from `requireLifecycleScript` still starts with `missing lifecycle script <absolute script path>`.
- [ ] The error message no longer contains the text `update\` to re-vendor it` with `agro` as the verb.
- [ ] If the running executable resolves under `/opt/oh/`, the message contains the image-refresh procedure text from US-001.
- [ ] If the running executable resolves under `/opt/oh/`, the message does not name `agro update` or `oh update`.
- [ ] If the running executable does not resolve under `/opt/oh/`, the message names `oh update` as the verb that re-vendors the `<control dir>/` payload.
- [ ] `requireLifecycleScript` takes an optional installation input, so a test selects the image case or the non-image case without a real `/opt/oh/` path.
- [ ] A new test case in `.agro/cli/src/__tests__/lifecycle.test.ts` asserts the image-case message. The case fails against commit `f14840b` and passes after the change.
- [ ] A new test case in `.agro/cli/src/__tests__/lifecycle.test.ts` asserts the non-image-case message. The case fails against commit `f14840b` and passes after the change.
- [ ] The existing case `errors naming the missing gateway.sh path without spawning` passes without an edit.
- [ ] `pnpm test -- .agro/cli/src/commands/__tests__/migrate-rehearsal.test.ts` exits 0. The `/missing lifecycle script/` pattern in that file stays unchanged.

### US-003: Document recovery for a sandbox with a stale image CLI

**Description:** As an operator with a stale image CLI, I want a runbook so that I can diagnose the generation mismatch and recover.

**Acceptance Criteria:**

- [ ] The new file `docs/repair-stale-image-cli.md` quotes the exact error line `missing lifecycle script /home/sandbox/harness/.oh/scripts/gateway.sh`.
- [ ] The runbook gives the inside-sandbox commands that identify the mismatch: `readlink -f /usr/local/bin/agro`, `agro --version`, and a listing that shows `.agro/` present and `.oh/` absent in the checkout.
- [ ] The runbook states that a CLI at v0.9.0 predates the `.agro`/`.oh` generation pair and resolves only `<root>/.oh/scripts/`.
- [ ] The runbook gives the host recovery procedure with the same text as the image-refresh procedure from US-001.
- [ ] The runbook states that the operator must not edit `/opt/oh` in a running sandbox and must not create a `.oh` → `.agro` symlink.
- [ ] `docs/README.md` links the runbook in the `## Reference` list, next to the other repair runbooks.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/repair-stale-image-cli.md` exits 0.
- [ ] `pnpm test -- .agro/cli/src/__tests__/docs.test.ts` exits 0.

## Summary

Verified current state:

- `requireLifecycleScript` (`.agro/cli/src/lib/execution/runner.ts:70-79`) resolves the control directory through `resolveProjectLayout`. The path defect from the report does not exist in current source (v0.12.2, `.agro/cli/package.json`).
- The same function tells the operator to run `` `${activeBin()} update` `` to re-vendor the payload. For the `agro` binary, `update` is CLI self-upgrade (`.agro/cli/src/cli.ts:182-226`). Payload vendoring is `oh update` (`docs/agro-compatibility.md:141-156`).
- `kindOfTarget` classifies every path under `/opt/oh/` as `image` (`.agro/cli/src/commands/self-upgrade.ts:70`, `:117`). `refuseUnsupported` refuses `agro update` for that kind (`:185-191`). Every AGRO sandbox installs the CLI there. The current advice therefore leads the most likely reader to a refusal.
- Callers: `runGateway` and the compose verbs in `.agro/cli/src/commands/lifecycle.ts:173`, `:199`, `:276`, `:289`, `:381`, and `DockerComposeTarget` in `.agro/cli/src/lib/execution/docker-compose-target.ts:143`.
- `resolveControlDir` (`.agro/cli/src/lib/compat.ts:148-186`) selects whichever generation directory exists. If both exist and differ, the function throws `CompatConflictError` before `requireLifecycleScript` runs. Current source therefore cannot reach the state "the resolved control directory is absent and the other generation's directory is present". The reachable generation mismatch is an old CLI bundle against a new checkout. Current source cannot detect that mismatch from inside the old bundle.

Selected approach:

1. Move the image-root test and the image-refresh procedure text into `lib/product.ts`, so that `self-upgrade.ts` and `runner.ts` share one source of truth. `lib/` does not import `commands/` today; this move keeps that direction.
2. Split the diagnostic in two. The image case gets the host image refresh. Every other case gets `oh update`. The `npm`, `standalone`, `source`, `legacy-package`, and `unknown` kinds share one re-vendor verb, so a two-way split carries the full distinction.
3. Diagnose the generation mismatch in the runbook, because the stale bundle is the only reachable mismatch. See Open Question 1.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/execution/runner.ts` | `requireLifecycleScript` | Builds the missing-script error. Primary change. |
| `.agro/cli/src/lib/product.ts` | new image-root predicate, new image-refresh text function | Single source for the image classification and the host procedure. |
| `.agro/cli/src/commands/self-upgrade.ts` | `IMAGE_ROOT`, `kindOfTarget`, `refuseUnsupported` | Consumes the shared predicate and text. Behavior stays the same. |
| `.agro/cli/src/commands/lifecycle.ts` | `runGateway`, compose verbs | Callers. The callers keep their current call signature. |
| `.agro/cli/src/lib/execution/docker-compose-target.ts` | `DockerComposeTarget` script lookup | Caller. The caller keeps its current call signature. |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | `runGateway` describe block | Regression cases. |
| `.agro/cli/src/__tests__/self-upgrade.test.ts` | image refusal cases | Guards the unchanged refusal text. |
| `docs/repair-stale-image-cli.md` | new runbook | Operator recovery. |
| `docs/README.md` | `## Reference` list | Runbook link. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro` / `oh` lifecycle verbs, stderr | Modified message | The missing-script error names the recovery step for the installation kind. The exit code stays the same. |
| `agro update` image refusal | None | The text stays byte-identical and comes from the shared function. |
| `docs/` | New runbook | Recovery for a sandbox with a stale image CLI. |
| `mifunedev/agro-web` | To confirm | See Open Question 2. |

## Storage

N/A. The change touches an error message, a shared constant, and documentation. The change persists no state.

## Architectural Decisions

- Source of truth: `lib/product.ts` owns the image root and the image-refresh text. `self-upgrade.ts` and `runner.ts` import both.
- The diagnostic reads `process.argv[1]` and resolves the path with `realpath` by default. A test passes the installation input directly.
- The change adds no `.oh` → `.agro` symlink. The change adds no boot-time install or refresh of `/opt/oh`, no Slack credential change, and no mutation of `/opt/oh` in a running sandbox.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/lifecycle.test.ts` | image installation: message has the host image-refresh text and no `update` verb | US-002 image branch |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | non-image installation: message names `oh update` and the `<control dir>/` payload | US-002 non-image branch |
| `.agro/cli/src/__tests__/lifecycle.test.ts` | existing missing `gateway.sh` path case | Path stays in the message |
| `.agro/cli/src/__tests__/self-upgrade.test.ts` | existing image refusal cases | US-001 refusal text unchanged |
| `.agro/cli/src/lib/__tests__/product.test.ts` | predicate: `/opt/oh/dist/agro.js` is image; `/usr/lib/node_modules/@mifune/agro/dist/agro.js` is not | US-001 predicate |
| `.agro/cli/src/commands/__tests__/migrate-rehearsal.test.ts` | full file | `/missing lifecycle script/` detection still matches |
| `.agro/cli/src/__tests__/docs.test.ts` | full file | Docs link integrity |

Write the two new `lifecycle.test.ts` cases first. Run the two cases against the unchanged source. Record the failure in `progress.txt`. Then implement the change.

Full gates, run from the repository root in the sandbox:

- `pnpm test` exits 0.
- `npm --prefix .agro/cli run typecheck` exits 0.

## Design Principles

- Follow `AGENTS.md`: no explanatory comments in tracked code, one source of truth for each policy, smallest truthful change.
- Give advice that the reader can execute. Never name a verb that refuses the reader's installation.
- Keep the error prefix and the script path stable, because tests and operators match on them.
- Work inside the sandbox. The change affects the root orchestrator CLI and every initialized project that vendors `.agro/cli/`.

## Out of Scope

- A `.oh` → `.agro` symlink.
- Automatic boot-time install or refresh of `/opt/oh`. That change alters ownership and needs architecture review and operator approval.
- Any change to Slack credentials.
- Any mutation of `/opt/oh` in a running sandbox.
- A fix to the v0.9.0 bundle itself.
- A change to `resolveProjectLayout` or `resolveControlDir`.

## Open Questions

1. The issue asks the CLI to name the generation mismatch when the other generation's control directory exists. Current source cannot reach that state (see Summary). This plan puts the mismatch diagnosis in the runbook only. Confirm, or pick another option:
   - A. Runbook only (this plan's default).
   - B. Also add a code branch for the other generation's `scripts/<rel>`, with a test that stubs `resolveProjectLayout`.
2. Does the `mifunedev/agro-web` site publish a troubleshooting page or the `agro update` text? If the site has that page, name the page. The named page must link the new runbook.
3. The `source` kind can also recover with `npm --prefix .agro/cli run build`. This plan gives `oh update` to every non-image kind, because a missing script is a payload defect, not a CLI build defect. Confirm.

## Acceptance Criteria

- [ ] Every story acceptance criterion passes.
- [ ] `pnpm test` exits 0 in the sandbox.
- [ ] `npm --prefix .agro/cli run typecheck` exits 0 in the sandbox.
- [ ] `grep -rn "IMAGE_ROOT\|/opt/oh/" .agro/cli/src --include='*.ts' --exclude-dir=__tests__` prints matches only in `.agro/cli/src/lib/product.ts`.
- [ ] `progress.txt` records the two new `lifecycle.test.ts` cases as failing before the implementation and passing after.
- [ ] The diff creates no `.oh` symlink and changes no file under `.devcontainer/`.

## Lessons

Filled by the advisor before undraft.
