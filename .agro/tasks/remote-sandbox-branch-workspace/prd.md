# PRD: Remote-sandbox branch workspace

Status: DRAFT

## User Stories

### US-001: Forward AGRO_REF and clone the VM workspace at that ref

**Description:** As the advisor, I want `run.sh` to forward `AGRO_REF` and row `R02` to clone the workspace at that ref. Then a branch run tests the workspace scripts of the branch.

**Acceptance Criteria:**

- [ ] `.agro/skills/remote-sandbox/scripts/run.sh` adds `AGRO_REF` to the forwarded variables next to `INSTALL_URL`, `AGRO_JS_URL`, and `SANDBOX_IMAGE`.
- [ ] The `build under test:` line prints `agro_ref=<value>`, or `agro_ref=default branch` when `AGRO_REF` is unset.
- [ ] In host mode, row `R02` in `.agro/skills/remote-sandbox/checks/agro-rows.sh` runs `agro workspace create` with `--ref "$AGRO_REF"` only when `AGRO_REF` is set.
- [ ] Row `R02` adds `ref=<branch>@<short sha>` of `$HOME/.agro/workspaces/harness` to its `PASS` detail.
- [ ] A new case in `.agro/scripts/__tests__/remote-sandbox.test.ts` sets `AGRO_REF` and asserts that the check receives `AGRO_REF=<value>`. The existing forwarding case asserts `AGRO_REF=unset` when the variable is unset.
- [ ] A new case in `.agro/scripts/__tests__/remote-sandbox-suite.test.ts` asserts that `agro-rows.sh` holds `${AGRO_REF:+--ref "$AGRO_REF"}` on the `agro workspace create` line.
- [ ] Each new case fails before the change and passes after the change.
- [ ] `pnpm vitest run .agro/scripts/__tests__/remote-sandbox.test.ts .agro/scripts/__tests__/remote-sandbox-suite.test.ts` exits 0.
- [ ] `bash -n` exits 0 for `run.sh` and `agro-rows.sh`.

### US-002: Document branch validation scope

**Description:** As an operator, I want the remote-sandbox skill to state what a branch run validates. Then a reviewer knows which branch files the VM uses.

**Acceptance Criteria:**

- [ ] The variable table in `.agro/skills/remote-sandbox/SKILL.md` holds a row for `AGRO_REF`: default `default branch`, effect "the ref that row `R02` clones into the host workspace".
- [ ] The sentence that lists the forwarded variables names `AGRO_REF`.
- [ ] `SKILL.md` states the three sources of a branch run: `AGRO_JS_URL` sets the CLI bundle, `AGRO_REF` sets the host workspace scripts, and `SANDBOX_IMAGE` sets the sandbox image.
- [ ] `SKILL.md` states that image mode ignores `AGRO_REF`, because image mode uses the image seed.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/remote-sandbox/SKILL.md` exits 0.

### US-003: Record manual review evidence

**Description:** As the advisor, I want one exe.dev run with `AGRO_REF` set to the task branch. Then the PR shows that the VM workspace used the branch.

**Acceptance Criteria:**

- [ ] The story depends on US-001 and US-002.
- [ ] The operator approves the billable exe.dev run and the push of the task branch before the run starts.
- [ ] The advisor runs `AGRO_REF=<task branch> bash .agro/skills/remote-sandbox/scripts/run.sh exedev checks/agro-rows.sh` in a named tmux session.
- [ ] The run log shows `agro_ref=<task branch>` on the `build under test:` line.
- [ ] The run log shows `RESULT R02-workspace PASS` with `ref=<task branch>@<short sha>`, and the short sha equals the pushed head of the task branch.
- [ ] The run log ends with `remaining agro-matrix resources on exedev: 0` and `RUN DONE`.
- [ ] `.agro/tasks/remote-sandbox-branch-workspace/evidence/manual-review.md` holds the command, the `build under test:` line, each `RESULT` line, and the cleanup line.

## Summary

Issue #1327 reports that a remote-sandbox branch run tests only the CLI bundle. PR #1326 found the gap: the exe.dev run used `link-providers.sh` from `main`, not from the branch.

Verified current state:

- In host mode, row `R02` at `agro-rows.sh:30` runs `agro workspace create` with no ref.
- `ensureHostWorkspace()` in `.agro/cli/src/lib/host-workspace.ts` clones `https://github.com/mifunedev/agro.git`. `cloneInto()` passes `--branch <ref>` only when a ref is set.
- `agro workspace create [<name>] [--ref <ref>]` accepts a ref (`cli.ts:341`, `cli.ts:1410-1418`).
- The default branch of `mifunedev/agro` is `main`.
- `run.sh:29` forwards only `INSTALL_URL`, `AGRO_JS_URL`, and `SANDBOX_IMAGE`. `run.sh:30` prints the `build under test:` line.
- `remote-sandbox.test.ts:153-167` asserts the forwarded variables through a fake check.

Selected approach: add one forwarded variable, `AGRO_REF`, and pass it to the existing `--ref` flag of `agro workspace create`. The CLI already supports the ref, so the change stays in the skill scripts and the skill text.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/remote-sandbox/scripts/run.sh` | `fwd` loop (line 29), `build under test:` line (line 30) | Forwards variables into the VM. |
| `.agro/skills/remote-sandbox/checks/agro-rows.sh` | row `R02` (lines 25-31) | Creates the host workspace on the VM. |
| `.agro/cli/src/lib/host-workspace.ts` | `ensureHostWorkspace()`, `cloneInto()` | Clones the workspace. No change. |
| `.agro/scripts/__tests__/remote-sandbox.test.ts` | "runs the default check, forwards INSTALL_URL only, ..." | Asserts the forwarded variables. |
| `.agro/scripts/__tests__/remote-sandbox-suite.test.ts` | static assertions on `agro-rows.sh` | Asserts the row text. |
| `.agro/skills/remote-sandbox/SKILL.md` | variable table, forwarding sentence | Documents the variables. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `run.sh` environment | New variable | `AGRO_REF` selects the ref of the VM host workspace. |
| run log | Output change | The `build under test:` line and the `R02` detail show the ref. |
| `SKILL.md` | Documentation | The skill states the source of each part of a branch run. |

## Storage

N/A. The change adds no persistent state.

## Architectural Decisions

- `agro workspace create --ref` stays the single way to select the workspace ref. The skill does not clone by itself.
- An unset `AGRO_REF` keeps the current behavior: a clone of the default branch.
- Image mode keeps the image seed. `AGRO_REF` affects host mode only.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/remote-sandbox.test.ts` | `AGRO_REF` set: the check receives the value; unset: `AGRO_REF=unset` | US-001 forwarding |
| `.agro/scripts/__tests__/remote-sandbox-suite.test.ts` | `agro-rows.sh` passes `${AGRO_REF:+--ref "$AGRO_REF"}` to `agro workspace create` | US-001 row text |
| exe.dev run | `R02` detail shows `ref=<task branch>@<short sha>` | US-003 end-to-end proof |

## Design Principles

- Reuse the existing `--ref` flag. Add no new clone path.
- Keep the default behavior when the operator sets no ref.
- Do not add explanatory comments to tracked code.

## Out of Scope

- A branch-built sandbox image. `SANDBOX_IMAGE` already covers the image.
- `checks/fresh-install.sh`. The fresh-install check creates no workspace.
- The VM-boot image environment in issue #1320.

## Open Questions

None. The operator merged PR #1326. Its evidence file states the wrong workspace source, and the advisor records that finding in `## Lessons` of this task.

## Acceptance Criteria

- [ ] `pnpm test` exits 0.
- [ ] `pnpm typecheck` exits 0.
- [ ] The exe.dev run in US-003 shows `R02-workspace PASS` with the task branch ref.
- [ ] `CHANGELOG.md` `## [Unreleased]` holds one entry that links issue #1327.

## Lessons

1. Claim: the suite test did not guard row `R15` from PR #1326. Evidence: "keeps the in-VM row IDs" stopped at `R14`, and the coverage case built `R01` to `R14`. Outcome: fixed in this PR (`61e8bb07`).
2. Claim: the PR #1326 evidence file names the image seed as the VM workspace source. Evidence: row `R02` cloned `main` with no `--ref`. Outcome: dropped, because the PR #1326 body and issue #1327 carry the correction and the evidence file records a merged run.
3. Claim: the `/release` push command breaks under zsh. Evidence: `git push "$REMOTE" "$SHA:refs/heads/$TARGET"` applies the zsh `:r` modifier to `$SHA`, and the push for `v0.17.0` failed with `src refspec ... does not match any` until the advisor wrote `${SHA}`. Outcome: issue #1331.
