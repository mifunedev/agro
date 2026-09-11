# PRD: compose-env-path-parity

Issue: `mifunedev/agro` #935
Branch: `bug/935-compose-env-path-parity` (off `development`, isolated worktree)
Task folder: `.agro/tasks/compose-env-path-parity/`

## Knowledge Context

- **Base commit**: `ed9ac89450103cfe71ff4c7c7fec7ea1009d5713`
- **Knowledge used**: `compose-env-boundary`
- **Grounded against**:
  - `.agro/evals/probes/compose-config-path-parity.sh`
  - `.agro/scripts/docker-compose.sh`
  - `.agro/scripts/install.sh`
  - `.agro/scripts/__tests__/compose-args.test.ts`
  - `.github/workflows/ci-harness.yml`
  - `.agro/knowledge/source/compose-env-boundary.md`

`compose-env-boundary` describes the registry route, which passes a rendered
`compose.env` as `--extra-env-file` and writes no `.devcontainer/.env`. This task
touches the in-checkout route instead — the `ENV_FILE` preference at
`.agro/scripts/docker-compose.sh:70-71` and the probe that asserts against it. The
page's claims were re-read and none of them constrain this change.

Every claim below was re-grounded by execution, not by recall. The reproduction
transcript is `## 2. Validation evidence`.

## Expected Knowledge Impact

- Impact: **NOT-APPLICABLE (predicted)**

The change is scoped to one Tier-A probe plus a new test. No knowledge page declares
`.agro/evals/probes/compose-config-path-parity.sh` as a source. `compose-env-boundary`
lists the sibling probe `compose-env-boundary.sh` but not this one, and none of its
claims describe the wrapper's environment-file preference order. The prediction is
non-authoritative; `## 6` of the execute pipeline derives the real answer from the
actual diff.

## Plan Reconciliation

- Intent preserved: **YES**

Planning base and execution base are the same commit
(`ed9ac89450103cfe71ff4c7c7fec7ea1009d5713`), so nothing the plan rests on moved.

One correction was made during planning and is already folded into the plan below:
the fix proposed in issue #935 (`stat -c %d:%i`) is itself defective, because GNU
`stat` defaults to `lstat` and therefore compares the symlink's own inode. The
resolved method is the dereferencing form. This refines the mechanism, not the
operator's intent, so it needs no re-approval. It is posted on the issue at
[comment 5628996672](https://github.com/mifunedev/agro/issues/935#issuecomment-5628996672).

## 1. Introduction

`.agro/evals/probes/compose-config-path-parity.sh` is a Tier-A probe. It must prove
that the `agro` wrapper path and the VS Code "Reopen in Container" path resolve the
same compose service from the same environment file.

The probe's structural half asserts the wrapper's emitted `--env-file` equals the
literal string `$ROOT/.devcontainer/.env`. After #887/#920 the root environment file
became the single secrets file and `.devcontainer/.env` became a symlink to `../.env`.
The wrapper prefers the root file. The literal assertion no longer matches reality.

The probe now fails in both directions. It reports REGRESSION on a correctly
installed operator machine. It reports PASS in CI while asserting nothing.

This PRD scopes a fix to the probe's structural assertion only.

## 2. Validation evidence

The claim was reproduced independently. It was not accepted from the issue.

### Direction 1 — false REGRESSION on a correct machine

A hermetic workspace was built under the session scratchpad. It contains a copy of
`.devcontainer/`, `.agro/scripts/{docker-compose.sh,compat.sh,check-host-port.sh}`,
and the probe at `.agro/evals/probes/`. The workspace holds a root environment file
and a `.devcontainer/.env` symlink to `../.env`, which is the canonical post-#887
layout.

Wrapper output:

```
$ docker-compose.sh --repo-dir <W> --print-argv config
docker compose --env-file <W>/.env -f <W>/.devcontainer/docker-compose.yml config
```

Probe output:

```
REGRESSION: compose config path parity broken:
  - the wrapper's --env-file is '<W>/.env', not .devcontainer/.env — path B auto-loads only the latter
exit 1
```

A directory listing proves both paths name one inode:

```
747922 -rw-r--r--  .env
747923 lrwxrwxrwx  .devcontainer/.env -> ../.env
```

`readlink -f` on both paths returns `<W>/.env`. The failure is a string mismatch with
no behavioural difference.

### The failure is the normal installed state, not an edge case

`.agro/scripts/install.sh:322-343` always creates the root environment file, then
forces the symlink and self-heals it:

```
ENV_FILE="$REPO_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then ... cp "$REPO_DIR/.example.env" "$ENV_FILE" ... fi

DEVCONTAINER_ENV_LINK="$REPO_DIR/.devcontainer/.env"
if [ ! -L "$DEVCONTAINER_ENV_LINK" ] || [ "$(readlink "$DEVCONTAINER_ENV_LINK")" != "../.env" ]; then
  rm -f "$DEVCONTAINER_ENV_LINK"
  ln -s ../.env "$DEVCONTAINER_ENV_LINK"
fi
```

Every machine that has run `agro sandbox install` reaches the state that makes the
probe red. This is more severe than the issue reports.

### Direction 2 — vacuous PASS where nothing was asserted

`.agro/scripts/docker-compose.sh:80-82` emits `--env-file` only when the chosen file
exists. In this orchestrator sandbox the wrapper emits none:

```
$ docker-compose.sh --repo-dir /home/sandbox/harness --print-argv config
docker compose -f /home/sandbox/harness/.devcontainer/docker-compose.yml config
```

`env_file_count` is therefore `0`. The probe's `elif (( env_file_count == 1 ))` branch
never runs, and the probe reports:

```
PASS: compose config path parity — the wrapper and the direct VS Code path read the same .devcontainer/.env and resolve the same service
exit 0
```

A second hermetic workspace scaffolded with no environment file at all reproduces the
same vacuous PASS. Both environment files are gitignored, and
`.github/workflows/ci-harness.yml:146-167` runs `bash .agro/skills/eval/run.sh` on a
fresh checkout, so CI always takes this path. The PASS line also states a fact the run
did not establish.

### The behavioural half is sound and is not part of this bug

The behavioural half builds a `mktemp -d` workspace and writes its own environment
file, so it is deterministic on every machine. It was exercised under the symlink
layout with `docker compose` present (`Docker Compose version v5.5.1`) and passed. The
`cp -R "$ROOT/.devcontainer/."` at line 47 carries the symlink into the temp
workspace, and the subsequent write at line 58 follows it; the values still resolve
identically and the half still passes. The briefing's assessment is confirmed.

### Comparison-method experiment

Four scenarios were run against four comparison methods. `A` = root file plus symlink.
`B` = neither file present. `C` = root file plus a drifted regular copy. `D` = root
file plus a hardlink.

| method | A symlink | B absent | C drifted copy | D hardlink |
|---|---|---|---|---|
| literal string (current) | REGRESSION (wrong) | PASS (vacuous) | REGRESSION | REGRESSION (wrong) |
| `readlink -f` | PASS | PASS (vacuous) | REGRESSION | REGRESSION (wrong) |
| `stat -c %d:%i` | **REGRESSION (wrong)** | PASS (vacuous) | REGRESSION | PASS |
| `stat -Lc %d:%i` | PASS | PASS (vacuous) | REGRESSION | PASS |

The issue's proposed `stat -c %d:%i` is incorrect. GNU `stat` uses `lstat` by default,
so it compares the symlink's own inode (`747923`) against the target's (`747922`) and
fails the canonical layout. Only the dereferencing form `stat -Lc %d:%i` is correct.

### Verdict

Issue #935 is **VALID**. Both directions reproduced. The fix proposed in the issue
contains a defect of its own, corrected below.

### Recorded limitation

The repository secret-exposure guard blocks commands that name environment-file paths.
It blocked a listing of the real repository root, a `grep` for the devcontainer
environment path, and a direct `stat` of the created fixtures. No repro claim in this
document depends on a blocked command. The wrapper's own `--print-argv` output and
directory listings that name only the containing directory supplied the same facts.
Creating fixtures inside the session scratchpad was permitted, so the four scenarios
above were genuinely executed, not inferred.

## 3. Goals

- The probe passes on a correctly installed machine where the wrapper emits the root
  environment file and `.devcontainer/.env` resolves to the same file.
- The probe fails when the two paths open different files.
- The probe never reports a PASS line that claims an assertion it did not make.
- The behavioural half continues to run in CI, where no environment file exists.
- `/eval` stays green.

## 4. Design decisions

### Decision 1 — the no-environment-file case

**Resolved: do not skip the probe. Skip only the environment-file assertion, record
that it was not asserted, and keep the behavioural half running.**

The issue proposes `SKIPPED` (exit 2). That is rejected. CI is the only place this
probe runs on every commit, and CI has no environment file. Exiting 2 there would
silence the sound behavioural half — the half that is the real parity oracle, because
it creates its own environment file and compares both resolution paths end to end.
Trading a real oracle for an honest-looking skip is a net loss of coverage.

The vacuous-PASS defect is a reporting defect, not a control-flow defect. The fix is
to stop claiming what was not checked, not to stop running.

One exit-code refinement follows. When the environment-file assertion was not made
*and* the behavioural half cannot run (no `docker compose`, or empty `config` output),
the probe has asserted nothing at all and must exit 2 with a message that says so.
Both branches already exit 2; only the message changes.

### Decision 2 — comparison method

**Resolved: compare file identity with the dereferencing form `stat -Lc %d:%i`, behind
a portability shim, and treat an unavailable shim as "not asserted" rather than as a
failure.**

Rationale, from the experiment table:

- The issue's `stat -c %d:%i` is wrong. It fails scenario A, the canonical layout.
- `readlink -f` is correct for A, B and C but raises a false REGRESSION for D, the
  hardlink. Device-and-inode identity is the property the probe actually cares about:
  do both paths open the same bytes. Path-string equality after resolution is a proxy
  that is wrong whenever two directory entries share one inode.
- `stat -Lc %d:%i` is correct in every scenario, and it still catches the case that
  matters operationally — scenario C, a `.devcontainer/.env` that has drifted into a
  stale regular-file copy.

Portability is the one cost. `stat -Lc` is GNU; BSD and macOS need `stat -Lf '%d:%i'`.
Operators run `agro` from macOS hosts, so the probe must try the GNU form, fall back to
the BSD form, and — if neither yields a value for both paths — record "identity not
determinable on this host" and skip that one assertion instead of failing. A probe must
never turn a missing tool into a REGRESSION.

## 5. User stories

### US-001: Replace the literal comparison with a portable identity comparison

**Description:** As a harness maintainer, I want the probe to compare file identity
instead of a path string, so a correctly installed machine stops reporting a false
REGRESSION.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/compose-config-path-parity.sh` no longer compares `$named`
      to `$ROOT/.devcontainer/.env` as a literal string.
- [ ] A helper resolves a path to a `device:inode` identity, trying `stat -Lc '%d:%i'`
      then `stat -Lf '%d:%i'`, and printing nothing when neither succeeds.
- [ ] When both identities resolve and are equal, the assertion passes.
- [ ] When both identities resolve and differ, `fails` gains an entry naming both
      paths.
- [ ] When either identity does not resolve, the assertion is recorded as not made and
      does not append to `fails`.
- [ ] The probe run in a workspace with a root environment file plus a
      `.devcontainer/.env` symlink to `../.env` exits `0`.
- [ ] The probe run in a workspace with a root environment file plus a drifted regular
      `.devcontainer/.env` exits `1` and names the mismatch.
- [ ] The probe run in a workspace with a root environment file plus a
      `.devcontainer/.env` hardlink exits `0`.
- [ ] `shellcheck` on the probe reports no new finding.

### US-002: Stop reporting a PASS that asserts nothing

**Description:** As a harness maintainer, I want the probe's output to state exactly
which assertions ran, so a green run in CI cannot be read as proof of path parity it
never established.

**Acceptance Criteria:**

- [ ] The probe tracks whether the environment-file assertion was made.
- [ ] When `env_file_count == 0`, the probe records that the wrapper emitted no
      `--env-file` and that the assertion was not made.
- [ ] The final `PASS:` line does not claim both paths read the same
      `.devcontainer/.env` unless the identity assertion actually ran.
- [ ] When the assertion did run, the `PASS:` line still states it.
- [ ] When the assertion did not run, the `PASS:` line names the behavioural half as
      the sole basis for the pass.
- [ ] Running the probe at the real repository root with no environment file present
      exits `0` with an output line that names the unasserted condition.

### US-003: Exit SKIPPED only when nothing at all was asserted

**Description:** As a harness maintainer, I want an exit code of 2 to mean the probe
learned nothing, so the eval report distinguishes a real pass from an empty run.

**Acceptance Criteria:**

- [ ] When the environment-file assertion was not made and `docker compose` is
      unavailable, the probe exits `2` with a message stating that neither half ran.
- [ ] When the environment-file assertion was not made and `docker compose config`
      produced no output, the probe exits `2` with the same class of message.
- [ ] When the environment-file assertion was made and the behavioural half cannot
      run, the probe exits `2` with the existing "structural half passed" message.
- [ ] A non-empty `fails` array still exits `1` in every branch, before any exit `2`.

### US-004: Lock the behaviour with a scenario-matrix regression test

**Description:** As a harness maintainer, I want the four layouts covered by an
automated test, so a future edit cannot quietly reintroduce a string comparison.

**Acceptance Criteria:**

- [ ] A test builds the four scenarios — symlink, absent, drifted regular copy,
      hardlink — in a temporary directory.
- [ ] The test asserts exit `0`, `0`, `1`, `0` respectively.
- [ ] The test asserts the absent-file run's output names the unasserted condition.
- [ ] The test lives beside the existing suite in `.agro/scripts/__tests__/` and runs
      under the repository's existing test command.
- [ ] The test does not read, write, or depend on the real repository environment file.
- [ ] The test is skipped, not failed, when `docker compose` is unavailable.

### US-005: Confirm the eval floor and the CI path

**Description:** As the advisor, I want proof the change holds the regression floor
before the PR is opened.

**Acceptance Criteria:**

- [ ] `/eval` runs green on the branch.
- [ ] `.agro/evals/RESULTS.md` shows no probe moving from PASS to REGRESSION.
- [ ] The probe's own row in `.agro/evals/RESULTS.md` is PASS.
- [ ] The CI `eval-probes` job is green on the pushed branch.
- [ ] A CHANGELOG entry is added per `.agro/skills/git/SKILL.md`.

## 6. Functional requirements

- FR-1: The probe must compare the wrapper's emitted `--env-file` to
  `$ROOT/.devcontainer/.env` by device-and-inode identity, not by path string.
- FR-2: Identity resolution must dereference symlinks.
- FR-3: Identity resolution must try `stat -Lc '%d:%i'` first and `stat -Lf '%d:%i'`
  second.
- FR-4: When identity cannot be resolved for either path, the probe must record the
  assertion as not made and must not append to `fails`.
- FR-5: When `env_file_count == 0`, the probe must record the assertion as not made,
  must not append to `fails`, and must continue to the behavioural half.
- FR-6: The probe must not emit a `PASS:` line claiming an assertion it did not make.
- FR-7: The probe must exit `2` when neither the environment-file assertion nor the
  behavioural half ran.
- FR-8: The probe must exit `1` whenever `fails` is non-empty, in every branch.
- FR-9: The existing `--env-file` count check at lines 22-23 must remain unchanged in
  behaviour.
- FR-10: The existing `harness-config.sh` check at lines 30-31 must remain unchanged.
- FR-11: The behavioural half at lines 43-78 must remain unchanged in behaviour.
- FR-12: `.agro/scripts/docker-compose.sh` must not be modified.

## 7. Non-goals

- Changing the wrapper's environment-file preference order. The root-file preference is
  correct and is out of scope.
- Changing which file `agro sandbox install` creates or links.
- Changing the probe's tier or its `# source:` provenance line.
- Adding a Tier-B behavioural eval.
- Making either environment file tracked in git.
- Relaxing or amending the secret-exposure guard.
- Reworking the behavioural half's temp-workspace construction.

## 8. Technical considerations

- The probe is Tier-A. `.github/workflows/ci-harness.yml:146-167` runs the suite via
  `bash .agro/skills/eval/run.sh` on every commit that touches `.agro/evals/**`.
- `set -euo pipefail` is active. A `stat` failure must be guarded with
  `2>/dev/null || true` or an explicit `if`, or the probe aborts instead of recording a
  soft skip.
- `stat` is absent on a minimal BusyBox image. FR-4 covers that case.
- The wrapper emits `--env-file` only when the file exists
  (`.agro/scripts/docker-compose.sh:80-82`). A count of `0` is normal, not an error.
- `.agro/scripts/__tests__/compose-args.test.ts:474` already asserts the install-time
  symlink form. The new test in US-004 complements it and must not duplicate it.
- Work happens in an isolated worktree per `.agro/skills/worktrees/SKILL.md`, on branch
  `bug/935-compose-env-path-parity` off `development`.

## 9. Success metrics

- The probe exits `0` on a machine that has run `agro sandbox install`, where it
  currently exits `1`.
- The probe exits `1` on a drifted `.devcontainer/.env`, which no method other than an
  identity check detects reliably.
- No probe in `.agro/evals/RESULTS.md` moves from PASS to REGRESSION.
- A green CI run on the branch no longer implies an unproven parity claim.

## 10. Open questions

- Should the "assertion not made" condition appear in `.agro/evals/RESULTS.md` as a
  distinct annotation on a PASS row, rather than only in the probe's stderr? Out of
  scope here; it would change the eval report schema.
- Should `install.sh` repair a `.devcontainer/.env` that is a drifted regular file
  rather than a symlink? It already does, via the `[ ! -L ]` test at
  `install.sh:339-343`. No action needed; recorded to close the question.
