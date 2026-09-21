# An `agro workspace` verb that owns host workspace lifecycle

Issue: [#1086](https://github.com/mifunedev/agro/issues/1086). RFC: #1070.
Prefix: `feat`. Base branch: `development`. Repository: `mifunedev/agro`.

## Intent

Add `agro workspace` as the door for host workspace lifecycle, and stop
`agro harness install` and `agro tool install` from creating workspaces.

An operator creates a host AGRO workspace only as a side effect of an install
today. `installOnHost` prompts `Workspace name [default]:` and clones
`mifunedev/agro` into `~/.agro/workspaces/<name>`
(`.agro/cli/src/commands/harness.ts:396-424`). `agro tool install` carries a
second copy of that wizard (`.agro/cli/src/commands/tool.ts:437-455`) that
prompts for a free-form path instead of a name, so a tool install can record a
`harnessRoot` outside `~/.agro/workspaces/`.

`agro harness install <id> --workspace beta` already clones a workspace without a
prompt (`harness.ts:350`, `:372-374`, `:404-412`). The capability exists. The
missing piece is a door that creates a workspace without installing a harness.

## Architecture decision

The verb composes machinery that already exists. `workspace create` runs
`assertWorkspaceName`, both state-home guards, and `ensureHostWorkspace` — the
sequence `installOnHost` runs today, lifted into its own command. `workspace
list` mirrors `registry.listEntries`: the command scans `workspacesRoot()`, keeps
every directory matching `SANDBOX_NAME_PATTERN`, and requires a `.git` marker in
each child. The build adds no metadata file, so the RFC's objection to a second
registry does not apply. No new abstraction appears, and none retires.

`create` never writes `harnessRoot`. The two install paths remain the only
writers of that key, which preserves their present behavior: the last explicitly
selected root becomes the recorded default. This decision removes a
contradiction, because `harness.ts:490` and `tool.ts:492` write `harnessRoot` on
every host install, so any rule that made `create` guard the same key would lose
to the next install.

The refusal names the workspaces that exist. A fresh operator runs `agro
workspace create alpha`, `harnessRoot` stays unset, and `resolveHarnessRoot`
returns the absent `~/.agro/workspaces/default`. Each refusal therefore lists
every workspace that `listHostWorkspaces` finds and names both `--workspace
<name>` and `${bin} workspace create`.

The advisor judged this change **not architecture-significant**. The RFC at #1070
and a recorded council round already performed the structural deliberation, the
operator settled every open decision, and the build introduces no abstraction and
crosses no isolation boundary. No `/architect` pass runs.

## Definition of Done

| ID | Observable outcome | Verification and expected result | Evidence | Owner |
|---|---|---|---|---|
| D1 | `agro workspace create [<name>]` clones `mifunedev/agro` into `~/.agro/workspaces/<name>`, reuses an existing checkout, and honors `--path <dir>`. Both state-home guards fire. The command refuses an invalid name. The command never writes `harnessRoot`. | `pnpm test` runs the new `workspace.test.ts` cases for clone, reuse, `--path`, invalid name, split state home, root-is-state-home, and an unchanged `harnessRoot`. Every case passes. | `workspace.test.ts` output in `evidence.md` | advisor |
| D2 | `agro workspace list` reports every child of `~/.agro/workspaces/` that matches the name pattern and holds a `.git` marker, marks the recorded default, and supports `--json`. An empty registry prints a hint that names `${bin} workspace create`. | `pnpm test` runs list cases for two workspaces, one non-matching directory, one non-git directory, the empty registry, and the `--json` shape. Every case passes. | same | advisor |
| D3 | `harness install --host` and `tool install --host` create no workspace. Neither file calls `ensureHostWorkspace`. Both verbs exit 1 when no workspace resolves, and the refusal names `${bin} workspace create` plus every workspace that exists. | `pnpm test` runs the updated refusal cases in `harness.test.ts` and `tool.test.ts`. Both files pass. `! grep -q 'ensureHostWorkspace(' .agro/cli/src/commands/harness.ts .agro/cli/src/commands/tool.ts` exits 0. | test output and command output | advisor |
| D4 | A tier-A probe asserts the door and the decoupling. The probe turns red when a worker reverts the decoupling. | `bash .agro/evals/probes/host-workspace-door.sh` exits 0 and prints `PASS:` on stderr. A worker then restores an `ensureHostWorkspace(` call in `harness.ts`, reruns the probe, reads exit 1 with `REGRESSION:`, and reverts the file. | both probe outputs in `evidence.md` | advisor |
| D5 | `agro workspace` appears in `printOhHelp`. `agro workspace --help` documents both subcommands. `docs/lifecycle-commands.md` carries the verb in its table and in a per-verb section. `docs/harnesses/overview.md` describes the new door instead of the removed prompt. `CHANGELOG.md` carries one `### Added` entry and one `### Changed` entry under `## [Unreleased]`. | `pnpm test` runs the help assertion and the new docs-sync assertion in `workspace.test.ts`. Both pass. `bash .agro/evals/probes/changelog-entry-length.sh` prints `PASS`. `bash .agro/skills/ste/scripts/ste-check.sh docs/lifecycle-commands.md docs/harnesses/overview.md` reports no finding introduced by this build, and the total does not rise above the 47 measured at commit `4ef3b179`. The advisor reads the prose diff. | test output, probe output, and the diff | advisor |
| D6 | The suite and the type checker are green. | `pnpm test` reports 0 failures. `pnpm typecheck` exits 0. `bash .agro/skills/eval/run.sh` reports no probe that turns from PASS to REGRESSION against the base commit. | `eval-result.json` and run output | advisor |
| D7 | The verb works end to end on the host against a throwaway state home. | The advisor runs the sequence under **Verification** with `AGRO_HOME=$(mktemp -d)`. Each step prints the output that the sequence states. | transcript in `evidence.md` | advisor |
| D8 | A PR stands open against `mifunedev/agro:development`, and the advisor reports its observed CI state. Nobody merges it. | `gh pr view` shows an open PR titled `FROM feat/1086-agro-workspace-verb TO development`. `/ci-status` reports the CI result. The merge state stays untouched. | PR URL in `evidence.md` | advisor |
| D9 | The two knowledge pages that declare a dependency on the changed files match the shipped behavior. | `bash .agro/evals/probes/wiki-readme-index.sh` exits 0. Each affected page ends `UPDATED`, `REVERIFIED`, or `NOT-AFFECTED (<reason>)`, and every `kind: repo` page whose claims were re-read carries an advanced `verified_at:`. | knowledge-impact output in `evidence.md` | advisor |

## Non-goals

- `agro workspace use <dir>`. The operator scoped this build to create and list.
- `agro workspace status`. The install refusal already prints the resolved root,
  the workspaces that exist, and the next command.
- `agro workspace remove`. This build never deletes an operator's checkout.
- A `--default` flag on `create`.
- `--workspace <name>` on `tool install`.
- A new registry file. `~/.agro/config.json` keeps one pointer, `harnessRoot`.
- Any change to `~/.agro/sandboxes/`, `resolveProjectRoot`, the `~/.local`
  prefix, provider linking, or any in-sandbox path.
- A merge. The advisor opens the PR and readies it. The operator merges.

## Implementation steps

| Step | Action and files | Dependencies | Execution context | DoD IDs |
|---|---|---|---|---|
| 1 | Add `listHostWorkspaces(env, home)` and `resolveExistingWorkspace(...)` to `.agro/cli/src/lib/host-workspace.ts`. `listHostWorkspaces` scans `workspacesRoot()` from `host-config.ts`, filters on `SANDBOX_NAME_PATTERN`, and requires a `.git` marker, which mirrors `registry.ts:44-53`. `resolveExistingWorkspace` returns the root, or a refusal string that names `${bin} workspace create` and every workspace that exists. The import from `host-config.ts` adds no cycle, because `host-workspace.ts:1-4` imports only `compat.js` and `runner.js`. | none | host; the feature worktree | D2, D3 |
| 2 | Add `.agro/cli/src/commands/workspace.ts`, which exports `WorkspaceIO`, `WorkspaceOptions`, `runWorkspaceCreate`, and `runWorkspaceList`. Follow `commands/harness.ts`: injected `io.stdout` and `io.stderr`, an injectable `LifecycleRunner`, `renderTable` for human output, `JSON.stringify(x, null, 2)` for `--json`, numeric exit codes, and a `${bin} workspace: ` error prefix. `runWorkspaceCreate` writes no host config. | 1 | same | D1, D2 |
| 3 | Wire the verb in `.agro/cli/src/cli.ts`. Add one `printOhHelp` usage line, a `printWorkspaceHelp(bin)`, and a `WorkspaceArgs` type. Add a `parseWorkspaceArgs` token loop that accepts `--json`, `--path <v>`, `--path=<v>`, and one positional name. Add an `if (first === "workspace")` branch above the compose-verb branch at `cli.ts:1365`. Reject `--path` together with a positional name. | 2 | same | D1, D2, D5 |
| 4 | Decouple `.agro/cli/src/commands/harness.ts`. Delete the `Workspace name [default]:` prompt at `:396-403` and the `ensureHostWorkspace` block at `:412-424`. Call `resolveExistingWorkspace` instead, and return 1 on a refusal. Keep the host confirmation, the sticky-root notice, both state-home guards, and the `harnessRoot` write at `:490`. Delete the now-unused import at `:26`. | 1 | same | D3 |
| 5 | Decouple `.agro/cli/src/commands/tool.ts` the same way. Delete the `Harness root [<root>]:` prompt at `:437-439` and the `ensureHostWorkspace` block at `:446-455`. Keep the `harnessRoot` write at `:492`. Delete the now-unused import. | 1 | same | D3 |
| 6 | Add `.agro/cli/src/__tests__/workspace.test.ts`. Use the house idiom: the `vi.mock("../cli.js", …)` import shim at `harness.test.ts:27-36`, a temporary `AGRO_HOME`, a fake `LifecycleRunner` that records the `git clone` call, and `captureStdout` at `harness.test.ts:183-189`. Assert `/^ {2}oh workspace /m` against `printOhHelp`, which matches `harness.test.ts:192-194`. Add a docs-sync assertion for `docs/lifecycle-commands.md` in the style of `compose-verbs.test.ts:166-169`, written as a new assertion because `workspace` is not a compose verb. Update the nine assertions that reference the removed prompts: `harness.test.ts:646,670,699,940,1166,1261,1283` and `tool.test.ts:802,876`. | 2, 3, 4, 5 | same | D1, D2, D3, D5 |
| 7 | Add the tier-A probe `.agro/evals/probes/host-workspace-door.sh`. Resolve `ROOT` from `${BASH_SOURCE[0]}`. Use the `problems=()` and `need()` shape at `advisor-execution-contract.sh:42-50`. Assert four claims: `printOhHelp` in `cli.ts` names `workspace`; `docs/lifecycle-commands.md` documents the verb; neither `commands/harness.ts` nor `commands/tool.ts` calls `ensureHostWorkspace(`; both files point the operator at the `workspace create` door. Accept the product set on every prose and source pin, per [[pattern-evals-product-name-literal-pinning]]. Escape every backtick inside a `problems+=()` message, per [[pattern-evals-probe-failure-path-untested]]. Exit 2 with a `SKIPPED:` reason when any source file is absent. | 3, 4, 5 | same | D4 |
| 8 | Update the prose. Add `agro workspace` to the verb table at `docs/lifecycle-commands.md:40-59` and write a per-verb section. Rewrite `docs/harnesses/overview.md:36-44`, `:77-86`, and `:118-124`, which hold the only description of the removed wizard. Add two `## [Unreleased]` entries to `CHANGELOG.md`. Leave `README.md` unchanged, because it states nothing about host workspace creation. | 3, 4, 5 | same | D5 |
| 9 | Update the two knowledge pages that declare a dependency on the changed files. Add the host workspace registry and the `workspace` verb to `.agro/knowledge/source/oh-cli-portable-lifecycle.md`, and correct the install narrative in `.agro/knowledge/source/fresh-machine-setup.md`. Advance `verified_at:` on each page whose claims a worker re-read. Regenerate `.agro/knowledge/README.md`. | 8 | same | D9 |
| 10 | Accept the work. Run `pnpm typecheck`, `pnpm test`, the probe in both directions, `bash .agro/skills/eval/run.sh`, and the D7 host sequence. Write `evidence.md`. Open the PR and report CI. | 1-9 | same | D4, D6, D7, D8 |

### Bounded write sets

- **W1 (implementation):** `.agro/cli/src/lib/host-workspace.ts`,
  `.agro/cli/src/commands/workspace.ts`, `.agro/cli/src/cli.ts`,
  `.agro/cli/src/commands/harness.ts`, `.agro/cli/src/commands/tool.ts`.
- **W2 (tests and probe):** `.agro/cli/src/__tests__/workspace.test.ts`,
  `.agro/cli/src/__tests__/harness.test.ts`, `.agro/cli/src/__tests__/tool.test.ts`,
  `.agro/evals/probes/host-workspace-door.sh`.
- **W3 (prose and knowledge):** `docs/lifecycle-commands.md`,
  `docs/harnesses/overview.md`, `CHANGELOG.md`,
  `.agro/knowledge/source/oh-cli-portable-lifecycle.md`,
  `.agro/knowledge/source/fresh-machine-setup.md`, `.agro/knowledge/README.md`.

Steps 3 and 5 both edit `cli.ts` and `tool.ts`, so no two writers may run in
parallel. One worker owns W1, W2, and W3 in sequence.

## Advisor orchestration

One active owner runs this build. That session decides, dispatches, verifies,
accepts, commits, and publishes. The owner makes no tracked implementation edit.
Every code, test, probe, prose, and knowledge change belongs to a bounded worker.

Delegation produces one worker. The change spans about 300 lines of production
code across 11 files. W1 and W2 share `cli.ts` and the final function signatures.
W3 documents the exact flags and messages that W1 emits. A second worker would
buy a handoff and no parallelism. The advisor accepts at two checkpoints instead.

The advisor reads each artifact, runs the task's own verification commands, and
reads their real exit statuses. A worker's completion report is never acceptance.
A failed verification returns to the same worker with the observed output. The
advisor repairs no worker output.

| Task | Complexity and selection reason | Requested model / reasoning | Dependencies | Read scope; owned write paths; exclusions | Execution directory; worktree; worker type; continuation | Deliverable | Verification and evidence destination | DoD IDs; acceptance owner; repair route |
|---|---|---|---|---|---|---|---|---|
| T1 | Medium-high. The command, the CLI wiring, the two decoupled install paths, and their tests share files and signatures, so the work does not split. | Opus, reasoning `high` | none | Read `.agro/cli/src/**`, `.agro/evals/probes/*.sh`, `.agro/evals/README.md`. Write W1 and W2 only. Exclude `docs/**`, `README.md`, `CHANGELOG.md`, `.agro/knowledge/**`, `.agro/tasks/**`, `.agro/cli/src/lib/registry.ts`, and the `HostConfig` schema in `.agro/cli/src/lib/host-config.ts`. | `.worktrees/feat/1086-agro-workspace-verb` under `~/.agro/workspaces/agro`; isolated worktree; `general-purpose`; continue with `SendMessage`. | Steps 1-7: the verb, the decoupling, `workspace.test.ts`, the nine updated assertions, and the probe. | `pnpm typecheck` exits 0. `pnpm test` reports 0 failures. `bash .agro/evals/probes/host-workspace-door.sh` exits 0, and the same probe exits 1 under fault injection. `! grep -q 'ensureHostWorkspace(' .agro/cli/src/commands/harness.ts .agro/cli/src/commands/tool.ts` exits 0. Paste all outputs into `.agro/tasks/agro-workspace-verb/progress.txt`. | D1, D2, D3, D4; advisor accepts; repairs return to T1. |
| T2 | Low. The prose and the knowledge pages are mechanical, and they follow the accepted implementation. The same worker continues, because it already holds the flag and message surface. | Opus, reasoning `low`; same worker as T1 | T1 accepted | Read `.agro/cli/src/commands/workspace.ts`, `.agro/cli/src/cli.ts`, `docs/lifecycle-commands.md`, `docs/harnesses/overview.md`, `CHANGELOG.md`, `.agro/knowledge/**`, `.agro/skills/ste/SKILL.md`, `.agro/skills/wiki/references/schema.md`. Write W3 only. Exclude all of `.agro/cli/src/**`. | Same worktree; `general-purpose`; continue with `SendMessage`. | Steps 8-9: two docs sections, the rewritten harness-overview passages, two CHANGELOG entries, and the two updated knowledge pages. | `bash .agro/skills/ste/scripts/ste-check.sh docs/lifecycle-commands.md docs/harnesses/overview.md` reports 0 findings. `bash .agro/evals/probes/changelog-entry-length.sh` prints `PASS`. `bash .agro/evals/probes/wiki-readme-index.sh` exits 0. `pnpm test` reports 0 failures. Paste outputs into `progress.txt`. | D5, D9; advisor accepts; repairs return to T2. |
| A1 | Advisor-owned close-out. Acceptance, host verification, and publication stay with the owner, and no worker may perform them. | advisor session; `inherit` | T2 accepted | Read the full branch diff. Write `.agro/tasks/agro-workspace-verb/evidence.md`, `progress.txt`, and `eval-result.json`. Exclude every source path under `.agro/cli/`, `docs/`, and `.agro/knowledge/`. | `~/.agro/workspaces/agro`; the feature branch; no worker; not delegated. | Step 10: `evidence.md`, the eval result, the open PR, and the reported CI state. | `bash .agro/skills/eval/run.sh` shows no PASS-to-REGRESSION transition. The D7 host sequence prints the stated output at each step. `gh pr view` shows the PR open and unmerged. `/ci-status` reports the CI result. | D4, D6, D7, D8; advisor accepts; the advisor repairs by returning the failing criterion to T1 or T2. |

### T1 brief

Work in the worktree `.worktrees/feat/1086-agro-workspace-verb` under
`~/.agro/workspaces/agro`. Implement steps 1 to 7. Add the `agro workspace` verb
with the subcommands `create` and `list`. Follow
`.agro/cli/src/commands/harness.ts` for every convention: injected IO, an
injectable `LifecycleRunner`, `renderTable`, `--json` through
`JSON.stringify(x, null, 2)`, numeric exit codes, and a `${bin} workspace: `
error prefix. Reuse `workspacesRoot`, `workspaceRoot`, `assertWorkspaceName`,
`defaultHarnessRoot`, and `resolveHarnessRoot` from
`.agro/cli/src/lib/host-config.ts`. Reuse `ensureHostWorkspace`,
`stateHomeRefusal`, `stateHomeRootRefusal`, and `AGRO_REPO_URL` from
`.agro/cli/src/lib/host-workspace.ts`. Add no metadata file: `list` scans the
directory the way `.agro/cli/src/lib/registry.ts:44-53` does.
`runWorkspaceCreate` must never write `harnessRoot`. Then remove the
workspace-creation wizard from `commands/harness.ts` and `commands/tool.ts`.
After your edit, neither file may call `ensureHostWorkspace`, and both must exit
1 with a refusal that names `${bin} workspace create` and lists every workspace
that exists. Write every user-facing string with `${bin}`, never with a literal
`agro`. Update the nine existing assertions listed in step 6. Add the tier-A
probe per `.agro/evals/README.md`, pin the product set rather than one product
name, escape every backtick inside a `problems+=()` message, and prove the probe
red by fault injection before you revert. Confirm that the injected fault
actually changes the file before you trust the red result. Write no file under
`docs/`, `README.md`, `CHANGELOG.md`, or `.agro/knowledge/`. Report the verbatim
output of `pnpm typecheck`, `pnpm test`, and both probe runs.

### T2 brief

Continue in the same worktree after the advisor accepts T1. Document the shipped
behavior. Add `agro workspace` to the verb table at
`docs/lifecycle-commands.md:40-59`, and write a per-verb section that matches the
neighboring sections. Rewrite the three passages in `docs/harnesses/overview.md`
that describe the removed wizard: the precedence table at `:36-44`, the
`Workspace name [default]:` paragraph at `:77-86`, and the flag table at
`:118-124`. Change `README.md` nowhere. Add two entries under `## [Unreleased]`
in `CHANGELOG.md`: one `### Added` entry for the verb, and one `### Changed`
entry for the install-path behavior. Write each entry as one imperative sentence
of 250 characters or fewer, and link issue #1086. State what changed and its
effect on the user. State no reason. Then update the two knowledge pages that
declare a dependency on the changed files: add the host workspace registry and
the `workspace` verb to `.agro/knowledge/source/oh-cli-portable-lifecycle.md`,
and correct the install narrative in
`.agro/knowledge/source/fresh-machine-setup.md`. Follow
`.agro/skills/wiki/references/schema.md` § 3 for the body shape, advance
`verified_at:` on each page whose claims you re-read, and regenerate
`.agro/knowledge/README.md`. Apply `.agro/skills/ste/SKILL.md`, and leave
`ste-check.sh` with 0 findings on both changed docs. Write no file under
`.agro/cli/`.

### Waves

| Wave | Work and owner | Dependencies | Output or handoff | DoD IDs |
|---|---|---|---|---|
| 1 | T1 implements the verb, the decoupling, the tests, and the probe. The advisor then accepts, and reruns typecheck, the suite, and the probe in both directions. | none | the accepted W1 and W2 diff, or a repair returned to T1 | D1, D2, D3, D4 |
| 2 | T2 writes the docs, the CHANGELOG, and the knowledge pages. The advisor accepts, then runs A1: the eval suite, the D7 host sequence, `evidence.md`, the draft PR, `/audit pr`, `gh pr ready`, and `/ci-status`. | wave 1 | the PR URL and the observed CI state | D5, D6, D7, D8, D9 |

## Affected surfaces

- **Host and sandbox:** applied. The verb runs on the host only. The build
  changes no in-sandbox path, and it leaves `resolveProjectRoot` untouched. A
  worker builds and tests in the worktree. The advisor runs D7 on the host
  against a throwaway `AGRO_HOME`.
- **Lifecycle door:** applied. `agro` gains one verb. The same commit updates
  `printOhHelp`, `docs/lifecycle-commands.md`, and the probe.
- **Canonical and provider surfaces:** applied. Every edit lands under `.agro/`
  or `docs/`. The build patches no generated mirror and moves no symlink target.
- **Root and scaffold:** applied to the root orchestrator only. No scaffold
  template changes, and `agro.json` gains no field.
- **Interactive and headless processes:** applied. `workspace create` prompts for
  nothing. The command takes a name argument and defaults to `default`, so an
  unattended session can run the command. The two install paths keep their TTY
  checks and their non-interactive refusals.
- **Local and remote operation:** applied. The build starts no persistent process
  and stores no terminal-dependent state.
- **Parallel operation:** applied. One worker owns three sequential write sets.
- **Public documentation:** applied in this repository. A matching
  `mifunedev/agro-web` change falls outside this PR, and the PR body says so.
- **Verification:** applied. The build runs `pnpm typecheck`, `pnpm test`, one
  new tier-A probe with fault injection, `bash .agro/skills/eval/run.sh`, the D7
  host sequence, and CI.

## Verification

Run these commands from `~/.agro/workspaces/agro` on the feature branch.

```bash
pnpm typecheck
pnpm test
! grep -q 'ensureHostWorkspace(' .agro/cli/src/commands/harness.ts .agro/cli/src/commands/tool.ts; echo "absent=$?"
bash .agro/evals/probes/host-workspace-door.sh; echo "exit=$?"
bash .agro/skills/eval/run.sh
```

Expect `absent=0` and `exit=0`.

Inject a fault for D4. A probe is not green until a worker has seen it red.

```bash
# restore one ensureHostWorkspace call in commands/harness.ts, then:
bash .agro/evals/probes/host-workspace-door.sh; echo "exit=$?"     # expect exit=1
git checkout -- .agro/cli/src/commands/harness.ts
```

Run the D7 host sequence against a throwaway state home.

```bash
pnpm build
export AGRO_HOME="$(mktemp -d)"
AGRO="node .agro/cli/dist/agro.js"

$AGRO workspace create alpha    # clones; harnessRoot stays unset
$AGRO workspace create beta     # clones
$AGRO workspace list            # alpha and beta; neither marked default
$AGRO workspace list --json     # the same rows as JSON
$AGRO harness install codex --host          # exit 1; refusal names alpha, beta, and the create door
$AGRO harness install codex --host --workspace beta   # installs; records harnessRoot = beta
$AGRO workspace list            # beta marked default

unset AGRO_HOME
```

## Knowledge Context

- **Base commit**: `cf35b316acccc03092d8f8da97fe2a50d9b12a1f`
- **Queries**: `cli lifecycle host workspace registry`; `cli evals probes docs --patterns`
- **Knowledge used**: `[[oh-cli-portable-lifecycle]]`, `[[fresh-machine-setup]]`,
  `[[pattern-evals-product-name-literal-pinning]]`,
  `[[pattern-evals-unexercised-oracle]]`,
  `[[pattern-evals-probe-failure-path-untested]]`,
  `[[pattern-evals-negation-must-govern-token]]`
- **Grounded against**: `.agro/cli/src/cli.ts`,
  `.agro/cli/src/commands/harness.ts`, `.agro/cli/src/commands/tool.ts`,
  `.agro/cli/src/commands/sandbox.ts`, `.agro/cli/src/lib/host-config.ts`,
  `.agro/cli/src/lib/host-workspace.ts`, `.agro/cli/src/lib/registry.ts`,
  `.agro/cli/src/lib/product.ts`, `.agro/evals/README.md`,
  `.agro/evals/probes/eval-gate.sh`, `docs/lifecycle-commands.md`,
  `docs/harnesses/overview.md`, `README.md`, `package.json`
- **Conflicts discovered**: `[[oh-cli-portable-lifecycle]]` enumerates the
  lifecycle verbs and the sandbox registry, and it describes neither the host
  workspace registry under `~/.agro/workspaces/` nor the host install path in
  `harness.ts`. The page is incomplete rather than wrong. Step 9 repairs it at
  the knowledge-impact gate.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `oh-cli-portable-lifecycle`, `fresh-machine-setup`
- **Affected source paths**: `.agro/cli/src/cli.ts`,
  `.agro/cli/src/commands/harness.ts`, `.agro/cli/src/commands/tool.ts`,
  `.agro/cli/src/commands/workspace.ts`, `.agro/cli/src/lib/host-workspace.ts`,
  `docs/lifecycle-commands.md`, `docs/harnesses/overview.md`
- **Reason**: The build adds a top-level lifecycle verb and changes the host
  install flow. `oh-cli-portable-lifecycle` declares `.agro/cli/src/cli.ts` among
  its sources and enumerates the verb set. `fresh-machine-setup` declares
  `.agro/cli/src/commands/harness.ts` among its sources and narrates the host
  install path that this build changes.

## Plan Reconciliation

- **Source plan**: `.agro/plans/agro-workspace-verb/plan.md`
- **Intent preserved**: YES
- **Material deviations**: `none`
- **Constraints discovered during grounding**: Three, all from recalled patterns,
  and none contradicting the plan. First, the probe must pin the verb and accept
  the product set rather than one product name
  (`[[pattern-evals-product-name-literal-pinning]]`); the plan's
  `${bin} workspace create` pin is correct for source and too narrow for prose.
  Second, a `problems+=()` message must escape every backtick, or the failure
  branch crashes with exit 127 instead of reporting
  (`[[pattern-evals-probe-failure-path-untested]]`). Third, the fault injection
  must be confirmed to change the file, because a stale anchor turns the red run
  into a silent no-op (same page). Step 7 and the T1 brief carry all three.
- **Orchestration preserved**: YES. Every bounded assignment, requested model and
  reasoning setting, read scope, owned write path, exclusion, execution
  directory, worktree, worker type, continuation method, deliverable,
  verification command, evidence destination, covered DoD ID, acceptance owner,
  and repair route from the source plan appears above. The advisor added one
  assignment, T2's knowledge-page work, because `Expected Knowledge Impact` is
  `REQUIRED`; the addition widens no scope the operator excluded.
