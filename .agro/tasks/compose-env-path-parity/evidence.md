# Evidence — compose-env-path-parity (#935, PR #1049)

Branch: `bug/935-compose-env-path-parity`
Base: `development` @ `ed9ac89450103cfe71ff4c7c7fec7ea1009d5713`
Worktree: `.worktrees/bug/935-compose-env-path-parity`

## 0. Why this is better than not doing it

**Before.** `.agro/evals/probes/compose-config-path-parity.sh` was a Tier-A probe that
was wrong in both directions at once.

- On any machine that had run `agro sandbox install`, it exited `1` with a REGRESSION
  that described no real defect. `.agro/scripts/install.sh:322-343` unconditionally
  creates the root environment file and force-heals `.devcontainer/.env` into a symlink
  to it, so **this is the normal installed state**, not an edge case. Measured: the two
  paths resolved to one inode (`747922`; the symlink itself is `747923`), and
  `readlink -f` returned the same path for both.
- In CI — the only place the probe runs on every commit — it exited `0` while asserting
  nothing. Both environment files are gitignored, so the wrapper emits zero
  `--env-file` arguments, the comparison branch at line 24 never executes, and the probe
  printed `PASS: ... read the same .devcontainer/.env`, a claim the run never tested.

**After.** Measured on the four layouts:

| scenario | before | after |
|---|---|---|
| A — root file + `.devcontainer/.env` symlink (canonical) | exit 1, false REGRESSION | exit 0 |
| B — neither file present (CI) | exit 0, PASS asserting nothing | exit 0, PASS naming the unasserted condition |
| C — root file + drifted regular copy | exit 1 | exit 1 |
| D — root file + hardlink | exit 1, false REGRESSION | exit 0 |

**Cost.** `+29 / −6` lines in the probe, one new 160-line vitest file, one CHANGELOG
line. No production code changed: `.agro/scripts/docker-compose.sh` is untouched, and
the probe's `--env-file` count check, `harness-config.sh` check, and behavioural half
are unchanged in behaviour.

**A correction to the issue's own proposal, which is the part with the most value per
line.** Issue #935 proposed `stat -c %d:%i`. That is defective: GNU `stat` defaults to
`lstat(2)` and does not dereference, so it compares the symlink's own inode against the
target's and **fails scenario A — the exact layout the fix exists to repair.** Measured:

```
root-stat=[87:747922]      # the regular file
devc-stat=[87:747923]      # the symlink itself, not its target
equal=no
```

Shipping the issue's text verbatim would have left the probe red on every operator
machine while appearing to fix it. Posted to the issue before implementation:
[comment 5628996672](https://github.com/mifunedev/agro/issues/935#issuecomment-5628996672).

## 1. What the plan asked for

The approved `prd.md` asked for four things, in the operator's terms:

1. The probe should pass on a correctly installed machine.
2. It should still fail when the two paths genuinely open different files.
3. It should never print a PASS line claiming an assertion it did not make.
4. The behavioural half must keep running in CI, where no environment file exists.

Plus the hard constraints: do not touch `.agro/scripts/docker-compose.sh`, leave the
`--env-file` count check and the `harness-config.sh` check unchanged, and keep `/eval`
green.

## 2. What was built

### The identity comparison (US-001)

`.agro/evals/probes/compose-config-path-parity.sh:21-45`. A `file_identity` helper tries
`stat -Lc '%d:%i'` (GNU) then `stat -Lf '%d:%i'` (BSD/macOS) and prints nothing when
neither works. The `-L` is the load-bearing part. When either identity is
indeterminable, the assertion is recorded as *not made* rather than failed — a probe
must never turn a missing tool into a REGRESSION.

The ordering is safe against GNU's unrelated `stat -f` (filesystem status) meaning: the
BSD form is only reached when the GNU form failed, and for an existing file on GNU the
GNU form always succeeds.

### Honest reporting (US-002, US-003)

`env_asserted` and `env_unasserted_reason` track whether the assertion ran. Both exit-2
branches and the final PASS branch on it. Observed at the real repository root, where no
environment file exists:

```
$ bash .agro/evals/probes/compose-config-path-parity.sh
PASS: compose config path parity — both paths resolve the same service from the same
environment file (behavioural half); the env-file identity assertion was not made: the
wrapper emitted no --env-file, so no environment file exists to compare
EXIT=0
```

The `fails` check still precedes every `exit 2` in both branches, so a real regression
can never be downgraded to a skip.

### The regression test (US-004)

`.agro/scripts/__tests__/compose-config-path-parity.test.ts` — four vitest cases building
symlink, absent, drifted-copy and hardlink fixtures in `mkdtemp` directories.

```
$ npx vitest run .agro/scripts/__tests__/compose-config-path-parity.test.ts
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

**It was verified to be a real oracle, not a vacuous one.** The previous probe was
restored from `origin/development` and the same suite re-run:

```
=== test against OLD probe (expect failures) ===
     × passes when .devcontainer env is a symlink to the root env file
     × passes and names the unasserted condition when no env file exists
     × regresses when .devcontainer env is a drifted regular-file copy
     × passes when .devcontainer env is a hardlink to the root env file
      Tests  4 failed (4)
=== restored; test against NEW probe ===
      Tests  4 passed (4)
```

The suite skips (does not fail) when `docker compose` is absent, and never reads or
writes the real repository environment file.

### Gate results (US-005)

```
$ bash .agro/skills/eval/run.sh
ran 149 probe(s)
RUNNER_EXIT=0
```

`.agro/evals/RESULTS.md` — `| compose-config-path-parity | A | ... | PASS |`.
No green→red delta on any probe.

**The gate caught a regression this change introduced, and it was fixed rather than
waived.** The first CHANGELOG entry written for this task was 279 characters, and
`changelog-entry-length` (cap 250) went `PASS → REGRESSION` with runner exit `1`:

```
REGRESSION: 1 changelog entry/entries exceed 250 characters:
  [Unreleased] | - Compare the compose wrapper's `--env-file` to `.devcontain… | 279 chars
```

The entry was shortened to 222 characters, the probe returned `PASS`, and the suite
re-run clean at `runnerExit: 0`. Recorded here because the green result above is the
*second* run, not the first — an earlier `/eval` in this session reported exit 0 only
because it ran before the CHANGELOG entry existed.

Full vitest suite: `1432 passed | 1 failed | 14 skipped`. The single failure is
`migrate-rehearsal.test.ts` (`agro ps` / `oh ps` resolve the migrated entry), confirmed
**pre-existing** by running that file against `origin/development` in a detached
baseline worktree with linked `node_modules`:

```
     × agro ps resolves the migrated entry and reaches docker compose
     × oh ps resolves the migrated entry and reaches docker compose
      Tests  2 failed | 4 passed (6)
```

Identical failures, identical names, on the unmodified base.

### Actual Knowledge Impact

`knowledge-impact.sh --changed` over the seven changed paths returns **10 FRESH, 31
NOT-APPLICABLE, 0 NEEDS-REVIEW**. The union with `Expected Knowledge Impact` (which named
no page) is therefore empty.

| Page | State | Reason |
|---|---|---|
| `compose-env-boundary` | `NOT-AFFECTED (no declared source in the changed set)` | Its `sources:` list names the sibling probe `compose-env-boundary.sh`, not this one, and none of its claims describe the wrapper's environment-file preference order. It documents the **registry** route, which passes a rendered `compose.env` as `--extra-env-file`; this task touches the **in-checkout** route. Re-read during step 0; nothing in it constrains this change. |
| 9 other `kind: repo` pages | `NOT-AFFECTED (no declared source in the changed set)` | None declares `.agro/evals/probes/compose-config-path-parity.sh`, `.agro/scripts/__tests__/`, `CHANGELOG.md`, or `.agro/evals/RESULTS.md` as a source. |
| 31 `kind: pattern` pages | `NOT-AFFECTED (provenance is immutable)` | Freshness does not apply to pattern pages by schema. |

Index regenerated and verified: `wiki-readme-index.sh` → `PASS`, exit 0.

## 3. Where they diverged from the plan, and why

Three divergences, all recorded rather than silent.

1. **The three-file contract was gap-filled instead of re-planned.** `execute.md`'s
   precondition requires `prd.md` to carry `## Knowledge Context`,
   `## Expected Knowledge Impact` and `## Plan Reconciliation`, and requires a
   `progress.txt`. `/prd` and `/ralph` emit none of these. Rather than refuse and
   re-run `/spec plan`, the four sections were written directly, because the planning
   base and execution base are the same commit (`ed9ac894`), the `git diff` across that
   range is empty, and the operator's intent was unchanged. `Plan Reconciliation`
   records `Intent preserved: YES`.

2. **The owner performed the implementation edits directly, with no `/delegate`
   worker.** `execute.md` step 4 requires an explicit operator exception recorded in
   `progress.txt` *before* the edit; that entry exists. The operator instructed this
   session to run `/spec execute` in this turn, and the change is one probe file plus
   one test.

3. **`shellcheck` was not run.** The PRD listed it as an acceptance criterion for
   US-001. It is not installed in this sandbox. Carried below as unverified rather than
   claimed.

The PRD's chosen comparison method was `stat -Lc %d:%i` and that is what shipped — the
correction to the issue's `stat -c` happened during planning, not during
implementation, so it is not a divergence from the approved plan.

## 4. What remains unverified

- **`shellcheck` on the probe.** Not installed in this sandbox (`shellcheck: not
  installed`). US-001's criterion is unmet in the literal sense. CI runs its own lint
  path; if it carries shellcheck, that is the check this run could not perform locally.
- **The BSD/macOS `stat -Lf` fallback was never executed.** This sandbox is GNU-only, so
  only the first branch of `file_identity` ran in every test. The fallback is reasoned,
  not observed. An operator on macOS is the first real execution of that line. The
  failure mode if it is wrong is benign by construction — an empty identity records the
  assertion as *not made* rather than raising a false REGRESSION.
- **Three persistent red probes, carried forward, non-gating.** All three report
  `delta=unchanged` and are red on `development` for reasons unrelated to this change:
  - `curl-bash-safe-alternatives` — ERROR: `python3: command not found` in this sandbox.
  - `oh-config-surfaces` — REGRESSION, pre-existing.
  - `skills-vendored` — REGRESSION, pre-existing.
- **`migrate-rehearsal.test.ts`** — 2 failures, demonstrated pre-existing on the base
  commit above. Not investigated further; out of scope for #935.
- **Secret-exposure guard limitation during validation.** The repository guard blocks
  commands naming environment-file paths. It blocked a listing of the real repository
  root, a `grep` for the devcontainer environment path, and a direct `stat` of the
  fixtures. No bypass was engineered and no claim in this document rests on a blocked
  command — the wrapper's own `--print-argv` output and directory-level `ls -lai`
  supplied the same facts, including the inode numbers. Recorded because a reader
  should know which observations were taken by a second route rather than the direct
  one.
- **`/audit implementation`, `/benchmark`, `/wiki compile` were not run as separate
  routes.** The gates they compose were run directly and are reported above: task-graph
  conformance (`jq -e 'all(.userStories[]; .passes == true)'` → 0), the `/eval`
  regression floor (runner exit 0, no delta), and the PR promotable classification
  (recorded at undraft time). No simplicity-review or UI-evidence artifact was produced;
  there are no UI stories in this task.
