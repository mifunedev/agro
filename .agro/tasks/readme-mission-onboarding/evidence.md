# Evidence — README mission and onboarding

PR: [#1037](https://github.com/mifunedev/agro/pull/1037). Closes [#1036](https://github.com/mifunedev/agro/issues/1036).

Content reviewed: `5215a23249e1738d3d0b73f05634c279ca935ec4`. Independent reviewer: `87f884da-c419-43d`.

Implementation audit: `audit-20260910T033433Z-1283430` — `AUDIT-PASS`.
Content PR audit: `audit-20260910T033417Z-1283114` — `PR-AUDIT-PROMOTABLE`.
Both classified the pushed content head above. A task-record-only commit requires a fresh final PR audit before promotion.

## Why this is better

The README now explains AGRO's durable workspace and shared control plane before showing one first task. The prior README stopped at authentication and mixed onboarding with operational reference material.

- README size: 2,497 → 1,144 whitespace-delimited words, a 54% reduction.
- README STE findings: 20 → 0.
- Independent editorial score: 51.5 → 84.5 out of 100.
- First-task specimen: the independent worker created one file and verified exact stdout, including the final newline.

The cost is coordinated edits to the README, linked guides, one existing test, and the existing onboarding knowledge page. No runtime feature, dependency, or documentation framework was added. Better reader activation remains claimed, unmeasured; editorial scores are judgments, not user-trial results.

## What the plan asked for

Implement the approved council recommendations. Make the mission clear, reduce the README's density, add a harmless first task, correct contradictory setup advice, and produce a verified PR. Preserve optional GitHub setup and accurate safety boundaries.

## What was built

The primary path separates host installation from sandbox work in Herdr. It installs one coding harness, authenticates it, creates a unique scratch directory, and asks for a zero-dependency program. A separate terminal command verifies the expected result.

Linked documents now distinguish base utilities, explicit harness/tool installation, and bootstrap dependencies. They explain the agro/oh update exception, host mounts, Docker socket authority, process persistence, and destructive teardown. The Slack guide no longer asks readers to print token values.

The Herdr ordering test now requires both anchors to exist before comparing their positions. Missing headings can no longer pass because `indexOf()` returns `-1`.

### Independent scorecard

| Dimension | Weight | Before | After |
|---|---:|---:|---:|
| Mission | 25% | 3 | 4.5 |
| Onboarding | 25% | 2.5 | 4 |
| Technical truth | 20% | 2.5 | 4 |
| Readability | 20% | 2.5 | 4.5 |
| Safety and scope | 10% | 2 | 4 |
| Weighted total | 100% | 51.5 | 84.5 |

The reviewer kept the README scores unchanged after linked-guide repairs. No score was raised to meet a target.

### Actual knowledge impact

`knowledge-impact.sh --changed` identified three pages:

| Page | State | Evidence |
|---|---|---|
| fresh-machine-setup | UPDATED, then REVERIFIED | Replaced obsolete endpoint, editor, install, and release assertions. Preserved provenance and rechecked after safety repairs at `c8b80942`. |
| managed-agents | NOT-AFFECTED | Read the page. The changed security paragraph does not change its architecture comparison, credential-boundary gap, or Docker-socket authority claim. No runtime boundary changed. |
| oh-cli-portable-lifecycle | NOT-AFFECTED | Read the page. The guide edits explain existing routing and install behavior; no lifecycle command, registry, or compatibility implementation changed. Unrelated historical assertions were not refreshed. |

The generated index probe passes. No new knowledge mechanism or pattern page was required.

## Where it diverged from the plan, and why

The intent is unchanged. Independent review expanded the repair paths to the directly linked security, Slack, connecting, Claude Code, and Herdr guides. These corrections remove contradictions encountered from the new README rather than create a second documentation project.

One existing test needed repair because it pinned retired prose. The repair also corrected two pre-existing missing-anchor false-pass assertions. No runtime tests or probes were weakened.

The automated custom link-check command was rejected by the safety guard. It was not retried or bypassed. The independent reviewer inspected every README local target and fragment manually and searched for inbound references to removed headings. No broken README local target or fragment was found. This does not claim a complete external-link crawl.

## What remains unverified

- Clean-host installation, Claude installation/authentication, Herdr operation, and disconnect/reconnect were not exercised in this documentation task.
- Latest release at the dated check was v0.9.0. [#1019](https://github.com/mifunedev/agro/issues/1019) remains open for the published-image bootstrap defect. The README warns about it and distinguishes existing-volume repair from a corrected image publication.
- [#1011](https://github.com/mifunedev/agro/issues/1011) retains independent released-workflow and refreshed-demo acceptance. No demo was created or certified here.
- [#1010](https://github.com/mifunedev/agro/issues/1010) retains deployed-site and broader public-entry consistency work. Core documentation changes do not establish agro-web parity. [Coordination comment](https://github.com/mifunedev/agro/issues/1010#issuecomment-5611993199).
- Local full tests had two failures in unchanged Docker-dependent migration tests. Both reproduced on the unchanged base. This sandbox has the Docker CLI but no host Docker socket. CI supplies Docker-capable verification.
- Eval has one unchanged persistent red, `skills-vendored`, and four skipped probes. No new regression occurred.
- Capability scores are historical. This change does not establish a measured capability-ceiling increase or user activation improvement.

## Observed output

Commands ran in the isolated branch worktree unless stated otherwise.

```text
$ wc -w README.md
1144 README.md

$ bash .agro/skills/ste/scripts/ste-check.sh README.md
ste-check: no findings in 1 file(s).

$ pnpm exec vitest run .agro/scripts/__tests__/herdr-default.test.ts .agro/scripts/__tests__/install-prereqs.test.ts
Test Files  2 passed (2)
Tests  15 passed (15)

$ pnpm run typecheck
> tsc --noEmit

$ pnpm run build
> node build.mjs
  dist/agro.js  208.1kb

$ pnpm test
Test Files  1 failed | 77 passed (78)
Tests  2 failed | 1369 passed (1371)
```

Typecheck and build exited 0. The full local test command exited 1. The two failures are `agro ps` and `oh ps` migration-rehearsal expectations at line 197. Running that same test file from base `42e85ec4` produced `2 failed | 4 passed (6)` and exit 1.

```text
$ PATH="/home/sandbox/.local/share/uv/python/cpython-3.13-linux-x86_64-gnu/bin:$PATH" bash .agro/skills/eval/run.sh
PERSISTENT RED (1) — not gating, no green->red delta:
  - skills-vendored (absorb .mifune submodule into .oh — the skills/hooks pack is vendored): REGRESSION, delta=unchanged — note: Hermes uses another runtime home; checking only this checkout's other providers
ran 146 probe(s); wrote /home/sandbox/harness/.worktrees/task/1036-readme-mission-onboarding/.agro/evals/RESULTS.md
EVAL_EXIT=0
```

Final-content counts: 141 PASS, 4 SKIPPED, 1 unchanged REGRESSION. The interpreter path was `/home/sandbox/.local/share/uv/python/cpython-3.13-linux-x86_64-gnu/bin`. `eval-result.json` binds this run to the content head.

```text
$ bash .agro/evals/probes/wiki-readme-index.sh
PASS: .agro/knowledge/README.md Index matches the tracked source/ and patterns/ frontmatter
```

The independent worker wrote `/home/sandbox/agro-first-task.yuWMTS/hello.mjs` using its file tool, then ran `node hello.mjs`. A second invocation asserted exact stdout:

```text
"Hello from AGRO!\n"
PASS: exact stdout, 17 bytes, final newline
```

The advisor read the one-line file and ran it independently:

```text
$ node /home/sandbox/agro-first-task.yuWMTS/hello.mjs
Hello from AGRO!
```

This verifies the specimen, not a Claude or clean-host onboarding session.

## Review and acceptance

Independent review initially requested five repairs. Commit `c8b80942` resolves all five. Re-review at `5215a232` returned `PASS` with no open simplicity findings.

The advisor confirmed PR/local head parity and ran the production audit boundary and route driver. Observed implementation output:

```text
task-graph: 3/3 stories pass
gate1: PASS
gate2: reused eval-result.json for HEAD 5215a23249e1738d3d0b73f05634c279ca935ec4 (runnerExit=0)
gate2: PASS
gate3: PASS
gate4: not applicable
gate5: metrics {"netAdded":515,"netRemoved":697,"shBranchPoints":0,"ccnMax":10,"tsOverCcn":[],"tool":"lizard 1.24.0"}
gate5: PASS (review 87f884da-c419-43d at 5215a23249e1738d3d0b73f05634c279ca935ec4, 0 finding(s), none blocking open)
AUDIT-EVIDENCE: AUDIT-PASS
```

The focused content PR audit reported `ci: PASS`, `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`, `evidenceComplete: true`, and `promotable: true`. Docker-capable CI passed all five checks on `5215a232`: [Harness CI](https://github.com/mifunedev/agro/actions/runs/34433597656), [Sandbox Boot Guard](https://github.com/mifunedev/agro/actions/runs/34433597718). Final record-only head acceptance will be recorded in the PR body after its fresh CI/audit.

## Improve-tail assessment

The task-scoped retro nominated no new probes. Existing literal-pinning knowledge and the repaired test cover the reusable finding; wiki compile has no new eligible candidate to promote.

Benchmark verdict: `BENEFICIAL` as a justified documentation hold, not measured capability growth. The regression floor held. The existing capability scoreboard remains unchanged at its historical 1.44/2.00. This change supplies reviewable documentation work in CB-001's scope while removing reader-facing text and adding no runtime machinery. The scorecard's historical baseline limitations still apply. This cycle did not groom or remeasure the capability suite; no unattended or activation improvement is claimed.
