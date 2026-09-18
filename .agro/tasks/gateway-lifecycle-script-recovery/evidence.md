# Evidence — gateway-lifecycle-script-recovery

**Issue**: mifunedev/agro#1080 · **PR**: mifunedev/agro#1081 · **Base**: `development`
**Branch**: `bug/1080-gateway-lifecycle-script-recovery`
**Commits**: `88d370ac`, `ebd89a74`, `ec8654a2`, `2cdd3671`, `008f2a71` (+ the evidence commit)
**Head this document describes**: `008f2a71` and later. Figures superseded by the simplicity loop are marked as such rather than deleted.
**Advisor**: active session. Every gate command below was run by the advisor, not read from a worker report.

---

## 0. Why this is better than not doing it

**Before.** An operator ran `agro gateway pi` and got:

```
missing lifecycle script /home/sandbox/harness/.oh/scripts/gateway.sh — the vendored .oh/ payload looks incomplete; run `oh update` to re-vendor it
```

Every instruction in that sentence is a dead end for the operator who sees it:

- The payload is **not** incomplete. The checkout is a complete `.agro/` workspace.
- Re-vendoring changes nothing. The control plane is already present.
- On current source the same message says `agro update`, which is **CLI self-upgrade**, not vendoring — and for an image installation it **refuses outright** (`self-upgrade.ts:185-191`).

So the error told its most likely reader to run a command that cannot help, and in the most common case cannot even execute. The cost of that is an operator burning a debugging cycle on the message's own advice before suspecting the CLI.

**After.** The same failure now names a route the reader can act on. The two routes, verbatim from `runner.ts:71-77`:

- image installation → `the sandbox image ships this CLI; pull a newer image on the host (<bin> stop, then <bin> sandbox install docker --name <name>)`
- any other installation → ``run `oh update` to re-vendor the control-plane payload``

**Measured cost**, recomputed at the final head `008f2a71` after two rounds of simplification:

| Area | Added | Removed | Net |
|---|---|---|---|
| Non-test source (`lib/`, `commands/`) | 29 | 7 | **+22** |
| Tests | 46 | 2 | +44 |
| Docs + CHANGELOG | 66 | 0 | +66 |

Non-test source breaks down as `install-kind.ts` +17 (new module), `runner.ts` +9 net, `self-upgrade.ts` **−4 net** — it now imports two helpers it used to own. One new module, three tests. No new dependency, no behavior change to any passing path.

The first draft of this document reported **+44** net non-test source. The simplicity loop halved that to **+22**; the earlier figure described a tree that no longer exists and is superseded here.

**Measured benefit is partial and stated as such.** The routing correctness is *measured* — **two** tests fail against the old message and pass against the new one (§2). A third test guards the retained incomplete-payload branch and passes both before and after; it is coverage, not evidence of the fix, and is not counted as decisive. The operator-time saving is *claimed, unmeasured*: no telemetry exists on how long anyone spent following the old advice.

**What this does not fix, and cannot.** The operator's original failure came from the **stale v0.9.0 bundle**, which hardcodes its own text. No change to current source alters what an already-installed binary prints. This work improves the message for every sandbox built from a current image, and adds documentation for operators stuck on an old one. That boundary is the honest scope, and it is why part of the deliverable is docs rather than code.

---

## 1. What the plan asked for

The operator asked for triage of `agro gateway pi` failing with a missing lifecycle script, and a solution shipped as a pull request — without starting or stopping a live gateway, exposing tokens, mutating the installed CLI, or papering the problem over with a `.oh` symlink.

The approved PRD set five goals: an installation-aware diagnostic (G1), a generation-skew diagnosis (G2), decisive regression coverage (G3), operator recovery documentation (G4), and a user-visible changelog entry (G5).

---

## 2. What was built

### Cause, separated by layer (D1)

Captured read-only. No gateway process was started or stopped; no token or credential value appears in any artifact.

| Measurement | Command | Result |
|---|---|---|
| Installed bundle | `node -e '…require("/opt/oh/package.json")'` | `@mifune/agro 0.9.0` |
| Current source | `node -e '…require(".agro/cli/package.json")'` | `@mifune/agro 0.12.2` |
| CLI resolution | `readlink -f /usr/local/bin/agro` | `/opt/oh/dist/agro.js` |
| Hardcoded paths in bundle | `grep -o '\.oh/scripts/[a-z-]*\.sh' /opt/oh/dist/agro.js` | 6 literals, incl. `gateway.sh` |
| Same in current non-test source | `grep -rn '\.oh/scripts/' .agro/cli/src \| grep -v __tests__` | **0 occurrences** |
| Checkout generation | `ls -d .agro .oh` | `.agro` exists; `.oh` absent |

The image installs the CLI at build time (`.devcontainer/Dockerfile:51-57`), so a container can carry a CLI older than the checkout bound into it. **The reported failure is version skew, not a path-resolution bug in current source.** `requireLifecycleScript` already resolved the control dir through `resolveProjectLayout`.

The exact stale-bundle string was read out of the binary rather than reconstructed:

```
$ grep -o 'missing lifecycle script.\{0,160\}' /opt/oh/dist/agro.js
missing lifecycle script ${script} — the vendored .oh/ payload looks incomplete; run \`oh update\` to re-vendor it`
```

Note it hardcodes `oh update` rather than resolving the invoked bin — which is why the documentation quotes that spelling exactly.

### The correction (D2)

`requireLifecycleScript` now composes the retained incomplete-payload diagnosis with an installation-aware `recoveryRoute()`. `lib/install-kind.ts` owns `/opt/oh/` once; `self-upgrade.ts` imports `IMAGE_ROOT` from it rather than keeping a private copy, so there is one source of truth and `lib/` never imports from `commands/`.

**Affected surfaces (AGENTS.md):**

| Surface | Verdict |
|---|---|
| Host and sandbox | **Applied** — source-only change in the checkout; the recovery doc covers the host-side image refresh. |
| Lifecycle door | **Applied** — the diagnostic is shared by `shell`, `stop`, `restart`, `logs`, `ps`, `destroy`, `gateway`. |
| Canonical and provider surfaces | **Applied** — all edits in `.agro/`; no provider mirror patched. |
| Root and scaffold | **Applied** — affects the CLI at root and in initialized projects. |
| Interactive and headless processes | **Not applicable** — no process lifecycle change. |
| Local and remote operation | **Not applicable** — diagnostic text is process-local. |
| Parallel operation | **Applied** — all work in an isolated worktree; three bounded workers with disjoint owned paths. |
| Public documentation | **Applied, with a gap** — `docs/lifecycle-commands.md` updated. `mifunedev/agro-web` **not** assessed; see §4. |
| Verification | **Applied** — Vitest, `/eval`, `/audit implementation`, head-specific CI. |

### Decisive regression coverage (D3)

The advisor did **not** accept the worker's claim here. The check was re-run personally: revert the message to its pre-change form, run, restore, run.

**The retained tests are three, two of them decisive.** After US-003 was removed, `execution-target.test.ts` holds:

| Test | Asserts | Decisive? |
|---|---|---|
| `routes an image installation to the host image refresh…` | `sandbox install docker`; **not** `agro update` / `oh update` | **yes** — fails against the old message |
| `routes a non-image installation to the payload vendoring verb` | `` `oh update` ``; not the image route | **yes** — fails against the old message |
| `keeps the incomplete-payload diagnosis when neither control dir is present` | `incomplete` | **no** — passes before and after; guards the retained branch |

The decisiveness run was executed by the advisor at `88d370ac`, when a third decisive test (the since-deleted generation-skew case) still existed. That run reported `3 failed | 21 passed (24)`, failing on `sandbox install docker`, `` `oh update` ``, and `generation skew`. **The two tests that survive today were two of those three failures**; the third failure belonged to the removed story and is not claimed as current evidence:

```
 × routes an image installation to the host image refresh, not to a self-upgrade verb
 × routes a non-image installation to the payload vendoring verb
Expected: "sandbox install docker"
Received: "missing lifecycle script /tmp/…/.oh/scripts/gateway.sh — the vendored .oh/ payload looks incomplete; run `agro update` to re-vendor it"
```

Full suite after restoring the fix, and again at the final head `008f2a71` after both simplification rounds — advisor-run both times:

```
 Test Files  82 passed (82)
      Tests  1624 passed (1624)
```

**Freshness.** The decisiveness capture above is bound to `88d370ac` and has not been re-executed against `008f2a71`; the two surviving assertions are unchanged in content by the simplification commits, which only refactored their setup into a shared `diagnose()` helper. A reviewer who wants the capture at the current head can reproduce it by reverting `runner.ts`'s message and re-running `execution-target.test.ts`. Stated rather than silently carried as if it had been re-run.

A pre-existing test, `compose-verbs.test.ts:124-137`, asserted `` `${bin} update` `` as the recovery route — **the defect encoded as a passing test**. It now pins route-independent tokens, and the route contract lives in `execution-target.test.ts`, which controls `argv[1]` deliberately rather than depending on the host's install kind.

### Operator recovery and changelog (D6, G5)

`docs/lifecycle-commands.md` gained a recovery section that quotes the message operators actually see, states plainly that its own advice does not apply, confirms the skew with two read-only version reads, and recovers by refreshing the image **from the host**. It preserves the home volume and notes that only `agro destroy` removes it.

**Documented downtime, and the distinction D6 actually draws.** An earlier draft of this document claimed "nothing documented … restarts infrastructure". That was wrong as written, and conflated two different things:

- **What this run did.** No container was stopped, started, or recreated. No gateway was started or stopped. `/opt/oh` was not touched, nothing was installed globally, no service was restarted, and no vendoring update was run against the operator's checkout. D6 constrains *this run's actions*, and this run performed none of them.
- **What the documentation describes.** The recovery route is `agro stop <name>` then `agro sandbox install docker --name <name>` on the host. That **is** a restart: it stops the container and recreates it. It is operator-authorized and operator-initiated — the reader chooses the moment, and nothing in this change performs it for them.

Documenting an operator-initiated recovery that carries downtime is not the same as performing a restart, and D6 forbids the second, not the first. But a recovery step is only safe if its cost is stated before it is taken, so the section now discloses the downtime explicitly rather than mentioning only what survives:

> This recovery costs downtime. The two commands stop the container and create it again, so every agent, server, and job inside it stops. Only the sandbox home volume survives the recreation. You pick the moment, and nothing runs these commands for you.

Nothing documented mutates `/opt/oh`, installs packages globally, or re-vendors over the operator's checkout. A worker proposed an in-sandbox PATH-shadow workaround and correctly reported rather than documented it; the advisor excluded it — it leaves a CLI the image did not ship and does not survive a rebuild.

STE checker: **zero findings** in the new section's line range (27 findings elsewhere in the file are pre-existing).

CHANGELOG entry: 231 characters, under the 250 cap, probe PASS.

### Actual Knowledge Impact (D4)

Derived from the diff, not the prediction:

```
$ bash .agro/skills/wiki/scripts/knowledge-impact.sh --changed $(…)
NEEDS-REVIEW  oh-cli-portable-lifecycle  declared sources are in the changed set:
              .agro/cli/src/commands/self-upgrade.ts .agro/cli/src/lib/install-kind.ts docs/lifecycle-commands.md
```

| Page | State |
|---|---|
| `oh-cli-portable-lifecycle` | **UPDATED** — recovery route, `install-kind.ts`, and the image-skew failure mode recorded; the removed skew diagnosis recorded as a rejected approach. `updated:` → 2026-09-17, `verified_at:` → `ebd89a74`. |
| every other `kind: repo` page | **NOT-AFFECTED** — `knowledge-impact.sh` reports `FRESH`: no declared source is in the changed set. |
| every `kind: external` / `kind: pattern` page | **NOT-AFFECTED** — provenance immutable; freshness does not apply. |

`verified_at` was **not** accepted on partial coverage. The worker advanced it while having re-read only the sections it edited, and disclosed exactly that. It was sent back to re-read the whole page; that pass corrected **25 drifted line cites** and one wrong attribution (the `migrate --home` noop is in `commands/migrate.ts:191-197`, not `lib/migrate.ts:188-193`). The advisor spot-checked six of the corrections against source, including the substantive one, before accepting.

```
$ bash .agro/evals/probes/wiki-readme-index.sh
PASS: .agro/knowledge/README.md Index matches the tracked source/ and patterns/ frontmatter
```

---

## 3. Where it diverged from the plan, and why

**G2 / US-003 — the generation-skew diagnosis — was built, then deliberately removed.** This is the run's one material deviation.

It was implemented, tested green, and accepted. On re-reading the diff rather than the test result, the advisor found it defective on two independent grounds:

1. **Unreachable.** `resolveControlDir` (`compat.ts:179-186`) selects a control dir with `isDirectoryAt`. An existing `.oh/` **directory** therefore becomes the resolved control dir, so the branch's `!existsSync(controlDir)` guard cannot hold. Its test passed only because it created `.oh` as a regular **file** — a state no workspace has.
2. **Unreachable even if repaired.** The skew an operator suffers is printed by the stale v0.9.0 bundle. Current source cannot change what an already-installed binary prints, so a correctly-triggering branch would still never reach the reader it was written for.

Removed rather than repaired, per D2's "smallest supported correction". The story was **deleted from `prd.json`** rather than marked passing, so the completion oracle stays honest. This is a scope reduction the advisor made without a second operator approval, reading it as inside D2's mandate rather than a change to operator intent; it is one commit and fully reversible.

**US-004 was left inconsistent by that removal and has been reconciled.** Its second acceptance criterion still required "a test asserts the generation-skew message", a test deleted in `ebd89a74`, while the story was already marked `passes: true`. A criterion that names a deleted artifact cannot be satisfied, so `passes` was asserting against a contract no tree could meet. The criterion was replaced with the non-image-route assertion the surviving test actually makes, a criterion was added for the retained incomplete-payload branch (explicitly **not** claimed as decisive), and the runner was corrected to `npx vitest run` from the repository root. This was caught by a supervisor evidence check, not by the advisor.

**The simplicity loop ran two rounds and shrank the diff.** A fresh read-only reviewer who wrote none of the code reviewed at `ec8654a2` (five findings, none blocking) and again at `2cdd3671` (one finding, non-blocking). Four round-1 findings and the round-2 finding were applied even though none was blocking: a dead exported predicate, an unused injection parameter, a duplicated `toPosix`, and two pieces of test boilerplate. Net non-test source fell from **+44 to +22**. One round-1 finding was **rejected by the advisor**: deleting the two-row `agro update` / `oh update` table, on the grounds that confusion between those two verbs is the root cause of this defect and a scannable table is the durable artifact. Round 2's reviewer was told of that rejection, invited to disagree in prose, and agreed with the reasoning.

**A worker's justification was wrong and was corrected.** The implementer kept an empty-string guard on `process.argv[1]`, justifying it as preserving `classifyInstallation`'s precedent of treating empty `argv[1]` as unknown. That precedent does not transfer: `classifyInstallation` returns a kind plus a `reason`, where empty and missing differ, while `invokedFromImage` returns a boolean where both map to `false`. The clause is behaviorally dead — `realpathSync("")` throws and the catch already evaluates `"".startsWith("/opt/oh/")` to `false`. The guard stays because removing it deletes no line, not because it distinguishes anything. The advisor had accepted the original justification at face value before the round-2 reviewer corrected it.

**US-007 was removed from the task graph — an advisor graph-design error.** The first `/audit implementation` run (`audit-20260918T011135Z-2620257`) returned `AUDIT-FAIL` at gate 1: `5/7 stories pass`. One of the two was US-007, "ready-for-review PR". That story is **unsatisfiable by construction**: it can only pass once the PR is undrafted, and the undraft requires `AUDIT-PASS` over the same graph that scores it. Encoding the pipeline's terminal state as a story the pipeline audits is a cycle, and the audit was right to fail on it.

Removing it does **not** weaken D5. Publication remains gated by a fresh `/audit pr` promotable classification, a head-specific CI check, and the human merge boundary — none of which this graph controls. The other failing story, US-006, was legitimately incomplete at that moment: it requires the advisor to have run the gates, and the audit run itself was one of them. It is now `true` on real executed output.

**Two advisor briefing errors, corrected mid-run and recorded as the advisor's, not the workers':**

- The dispatch record prescribed `npm --prefix .agro/cli test`. No such script exists; the runner is `npx vitest run` from the repository root.
- The dispatch record omitted the 250-character CHANGELOG cap, so the first entry (337 chars) tripped `changelog-entry-length`.

**A verification near-miss worth recording.** The first decisiveness check used `python3`, which is absent in this sandbox. The command failed, no revert occurred, and the all-green result **proved nothing**. It was discarded rather than recorded as evidence, and the check was redone with node. A verification that silently no-ops and returns green is the failure mode most likely to launder an unchecked claim into evidence.

---

## 4. What remains unverified

- **`tsc` typecheck did not run.** `.agro/cli/node_modules` is absent in this worktree, so `tsc` reports hundreds of pre-existing `Cannot find module 'node:fs'` errors across untouched files. The change is type-checked only by vitest's transform. Pre-existing; **no install was performed** to close it, per D6.
- **Two `/eval` probes are red for reasons unrelated to this change.** Both were confirmed red on the **unchanged base checkout**, so they are environmental or pre-existing, not a green→red delta from this diff:
  - `curl-bash-safe-alternatives` — `ERROR: python3: command not found`. The same missing interpreter as the near-miss above.
  - `oh-config-surfaces` — `REGRESSION: agro.json is not valid JSON` in this sandbox.
  - `skills-vendored` — persistent red, `delta=unchanged`, already disclosed by the runner as non-gating.
  Eval runner exit: **0**. The only probe this change broke was `changelog-entry-length`, which was fixed and re-verified PASS.
- **`mifunedev/agro-web` was not assessed.** AGENTS.md asks whether user-facing terminology changes require a matching change there. The CLI's recovery wording changed, and no check was made against the public docs site. Stated as a gap rather than silently marked not-applicable.
- **The knowledge page exceeds its size guidance.** `oh-cli-portable-lifecycle` is ~3,180 words against the schema's ≤900-word guidance for architecture pages. Pre-existing; deliberately not trimmed, since trimming unrelated sections is outside this task's scope.
- **`confidence: provisional`** on that page was left unchanged.
- **The operator-time benefit in §0 is claimed, not measured.** No telemetry exists for it.
- **No end-to-end run of the new message against a real stale sandbox.** Doing so would require mutating an installed CLI or rebuilding a container, both excluded by D6. The routing is verified by unit tests with `argv[1]` controlled, not by a live reproduction.
