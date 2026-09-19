# Evidence — `agro-workspace-verb` (#1086)

PR [#1087](https://github.com/mifunedev/agro/pull/1087). Base `development` at
`cf35b316`. Audit run `audit-20260919T172553Z-1416459` → **`AUDIT-PASS`**.

## 0. Why this is better

An operator can create a host workspace without installing a harness. Before,
the only door was a wizard inside `agro harness install`, duplicated in
`agro tool install` with a different prompt — so a tool install could record a
`harnessRoot` outside `~/.agro/workspaces/` entirely. Two wizards became one
verb and one shared refusal. Cost: +367 production lines, −26 duplicated.

## 1. What the plan asked for

`agro workspace create` and `list`; both install paths resolve a workspace and
refuse when none exists; `create` writes no `harnessRoot`; a directory scan
rather than a registry file; a probe, docs, CHANGELOG, knowledge pages.
Excluded: `status`, `use`, `remove`, `--default`, `--workspace` on `tool install`.

## 2. What was built

Every acceptance criterion in `prd.json` passes. Observed on the host with a
throwaway `AGRO_HOME`:

| Behavior | Observed |
|---|---|
| `workspace create alpha` | cloned; **no config file written** |
| `workspace create alpha` again | `host workspace reused` |
| `workspace create "Bad Name"` / `create alpha --path /tmp/x` | exit 1, specific message each |
| `workspace list` / `--json` | both workspaces, default marked |
| `harness install codex --host` | exit 1, names the resolved root, `alpha, beta`, the create door, and `--workspace`/`--path` |
| `tool install herdr --host` | same shape without `--workspace` (correctly out of scope) |
| `harness install codex --host --workspace beta` | records `harnessRoot`, no `hostHarnesses` key; rerun leaves mtime unchanged |
| real `~/.agro/config.json` | byte-identical after |

Gates: `pnpm typecheck` 0 · `pnpm test` 6 failed / 1646 passed · `/eval` exit 0,
155 probes, 0 regressions · new probe `host-workspace-door` PASS and red under
five diff-confirmed injected faults.

The six unit failures are file-mode/exec-bit assertions bound to this sandbox's
umask, reproduced on clean `development` before this work. CI's
`Lint, Typecheck, Build & Test` passes.

**Knowledge impact** (union of `knowledge-impact.sh` and the prediction):

| Page | State |
|---|---|
| `oh-cli-portable-lifecycle` | UPDATED, `verified_at: d4466d81` |
| `fresh-machine-setup` | UPDATED, `verified_at: d4466d81` |
| `compose-env-boundary` | UPDATED, `verified_at: d4466d81` |
| `managed-agents` | REVERIFIED, pin unchanged — its only citation is untouched |

## 3. Where it diverged

- **`workspace status` cut** after a council round. The install refusal already
  prints the resolved root, the workspaces that exist, and the next command.
  DoD went 12 criteria → 8. Operator approved before the build.
- **A pre-existing defect fixed** (`027bdda1`). The already-installed early
  return preceded the `harnessRoot` write, so `--workspace` recorded nothing
  when the binary was already on PATH. Identical at `cf35b316`, so it predates
  this work; fixed because the design rests on the install paths being the only
  writers of that key.
- **One DoD criterion amended.** D5 required `ste-check` 0 findings on two whole
  documents; 47 of the findings predate this build in unrelated sections.
  Amended to "introduces none, does not raise the total" — measured 47 → 44.
- **Knowledge verification exceeded the plan.** Advancing `verified_at` claims
  every claim was re-read, so all 60 citations on the three re-pinned pages were
  read: 9 rotted line numbers corrected and one symbol removed that never
  existed (`isImageInstall`; `install-kind.ts` exports three things, not four).

## 4. What remains unverified

- **Gate-5 complexity signal SKIPPED.** `slop-metrics` reported
  `tool: unavailable`; `tsOverCcn: []` is the absence of a measurement, and
  `ccnMax: 10` is the threshold, not an observed maximum.
- **Three non-blocking simplicity findings open** (`SIMPLICITY-RESIDUAL`, loop
  terminated on a non-reducing round): the `WorkspaceResolution` union, the
  unexercised `--path`+`<name>` guard in `runWorkspaceCreate`, and a third copy
  of the width-computing table renderer.
- **The `--path`+`<name>` guard has no test.** The reviewer verified no test
  passes both arguments. Kept as deliberate defense in depth on an exported
  function; if it drifts from the parser's message, nothing fails.
- **Six unit assertions never ran green here.** They fail on clean
  `development` in this sandbox; CI is the only place that verdict exists.
- **`workspace create --path <dir>` exercised only by unit tests**, not on the host.
- **Both updated knowledge pages exceed the 900-word cap** and did before this
  build (now 3456 and 2005). No probe enforces it.
- **The pre-commit hook never ran** — `pnpm install` ran with scripts ignored,
  so husky never installed.
- **`gh` had to be upgraded to 2.101.0** for gate 3 and `/audit pr` to run at
  all; no earlier release carries `closingIssuesReferences`.
