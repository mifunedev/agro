# Gateway lifecycle-script diagnostic and recovery

**Issue**: mifunedev/agro#1080
**Base**: `development`
**Repo**: `mifunedev/agro`
**Branch**: `bug/1080-gateway-lifecycle-script-recovery`

## Operator intent preserved

The operator requested triage of `agro gateway pi` failing with
`missing lifecycle script /home/sandbox/harness/.oh/scripts/gateway.sh`, and a
solution shipped as a pull request. The operator authorized this bounded fix
through a ready-for-review PR. No second approval is required unless intent
materially changes. The advisor never merges.

## Problem

Two layers produce one symptom. They must stay separated.

**Old installed-bundle behavior.** `/usr/local/bin/agro` is a symlink to
`/opt/oh/dist/agro.js`. That bundle is `@mifune/agro` **v0.9.0**, installed at
image build time from `.agro/cli/` (`.devcontainer/Dockerfile:52-57`). It
predates the `.agro`/`.oh` generation pair and hardcodes `<root>/.oh/scripts/...`.
The checkout at `/home/sandbox/harness` is an `.agro` generation workspace with
no `.oh/` directory, so the hardcoded path cannot resolve. Current source is
v0.12.2. The reported failure is entirely explained by this version skew.

**Current-source behavior.** `requireLifecycleScript`
(`.agro/cli/src/lib/execution/runner.ts:70-79`) resolves the control dir through
`resolveProjectLayout` (`.agro/cli/src/lib/compat.ts:204-221`), so the path
resolution defect is already fixed in source. No runtime path bug is invented here.

**The defect that remains in current source** is the diagnostic itself. The
message says to run `` `<bin> update` `` to "re-vendor" the payload. That advice
is wrong twice:

1. Under the canonical `agro` product name, `update` is **CLI self-upgrade**, not
   payload vendoring. Vendoring is the legacy `oh update` verb
   (`.agro/cli/src/cli.ts:104-115`, `:182-226`, `:713`).
2. For an **image** installation — any `/opt/oh/` prefix, which is how the CLI is
   installed in every AGRO sandbox — self-upgrade *refuses*:
   `classifyInstallation` returns `{ kind: "image" }`
   (`.agro/cli/src/commands/self-upgrade.ts:70`, `:117`) and `refuseUnsupported`
   errors with "the sandbox image ships this CLI; pull a newer image on the host"
   (`:185-191`).

The operator population most likely to see this error is the one the message
cannot help.

## Goals

- G1. Make the missing-lifecycle-script diagnostic installation-aware, so the
  recovery it names is a command that can actually succeed for the reader.
- G3. Regression coverage that fails against the current diagnostic and passes
  against the corrected one.
- G4. Operator-facing recovery documentation for a sandbox already in this state.
- G5. A user-visible CHANGELOG entry.

## Non-goals

- No `.oh` → `.agro` symlink, in the checkout or anywhere else.
- No automatic boot-time installation or refresh of `/opt/oh`. That is an
  ownership change; it requires architecture review and operator approval, and
  `self-upgrade.ts` deliberately refuses image-managed updates.
- No change to Slack credentials, Slack configuration, or any live gateway.
- No mutation of `/opt/oh`, no global package installs, no infrastructure
  restart, no `oh update` against the operator's checkout.
- No change to `resolveProjectLayout` resolution semantics. They are correct.

## Affected surfaces (AGENTS.md checklist)

| Surface | Verdict |
|---|---|
| Host and sandbox | **Applied** — change is source-only in the checkout; recovery doc covers the host image refresh. |
| Lifecycle door | **Applied** — `requireLifecycleScript` backs `shell`, `stop`, `restart`, `logs`, `ps`, `destroy`, `gateway`; the diagnostic is shared by all. |
| Canonical and provider surfaces | **Applied** — edits land in `.agro/`; no provider mirror is patched. |
| Root and scaffold | **Applied** — affects the CLI both at root and in initialized projects. |
| Interactive and headless processes | **Not applicable** — no process lifecycle changes. |
| Local and remote operation | **Not applicable** — diagnostic text is process-local. |
| Parallel operation | **Applied** — worker runs in an isolated worktree. |
| Public documentation | **Applied (evaluate)** — recovery guidance is operator-facing; `agro-web` change assessed during execution, and reported as a gap if warranted. |
| Verification | **Applied** — Vitest CLI suite, `/eval` probe suite, head-specific CI. |

## User stories

1. **US1 — Installation-aware diagnostic.** As an operator whose sandbox CLI is
   image-installed, when a lifecycle script is missing I get a recovery
   instruction that can succeed, not a verb that refuses.
2. **US2 — Generation-skew diagnosis.** As an operator on a workspace whose other
   generation's control dir exists, the error names the skew explicitly.
3. **US3 — Regression coverage.** As a maintainer, a test fails against the old
   diagnostic and passes against the corrected one.
4. **US4 — Recovery documentation and changelog.** As an operator with a sandbox
   already in this state, documented safe steps exist, and the change is visible
   in the CHANGELOG.

## Definition of Done mapping

| DoD | Satisfied by |
|---|---|
| D1 | This document's **Problem** section; evidence.md reproduction, read-only, no gateway started or stopped, no token printed. |
| D2 | **Goals** / **Non-goals** / **Affected surfaces**; smallest correction is diagnostic text plus tests plus docs. |
| D3 | US1–US4 implemented by bounded `/delegate` workers in an isolated worktree; failing-then-passing test evidence; CHANGELOG entry. |
| D4 | Advisor runs Vitest, `/eval`, and `/audit implementation` personally; real outputs and gaps recorded in evidence.md. |
| D5 | Ready-for-review PR to `mifunedev/agro` against `development`, linked to #1080, head-specific green CI verified. Never merged. |
| D6 | Recovery section in the docs deliverable and in evidence.md; no `/opt/oh` mutation, no global install, no restart, no `oh update` on the operator's checkout. |

## Knowledge Context

- **Base commit**: `f14840b982532e46459cfe7b620958dcb49326de`
- **Queries**: `cli lifecycle`, `sandbox install`, `evals probe`, `compat generation`
- **Knowledge used**: `[[oh-cli-portable-lifecycle]]`, `[[sandbox-dependency-installs]]`, `[[pattern-evals-prose-literal-pinning]]`
- **Grounded against**: `.agro/cli/src/lib/execution/runner.ts`, `.agro/cli/src/lib/compat.ts`, `.agro/cli/src/commands/self-upgrade.ts`, `.agro/cli/src/commands/lifecycle.ts`, `.agro/cli/src/cli.ts`, `.agro/cli/src/commands/update.ts`, `.agro/cli/package.json`, `.devcontainer/Dockerfile`, `/opt/oh/package.json`, `/opt/oh/dist/agro.js`
- **Conflicts discovered**: `none`. `[[oh-cli-portable-lifecycle]]` already records
  `requireLifecycleScript` resolving through the generation pair at
  `runner.ts:69-78`; current source confirms it at `:70-79`. The page does not
  describe the diagnostic's recovery advice, which is this task's subject.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `oh-cli-portable-lifecycle`
- **Affected source paths**: `.agro/cli/src/lib/execution/runner.ts`, `.agro/cli/src/commands/self-upgrade.ts`, `.agro/cli/src/__tests__/*`, `docs/`, `CHANGELOG.md`
- **Reason**: `runner.ts` and `self-upgrade.ts` are both declared sources of
  `oh-cli-portable-lifecycle`; changing the shared lifecycle diagnostic and its
  recovery route changes operator-facing lifecycle behavior the page describes.

## Plan Reconciliation

- **Source plan**: `/tmp/gateway-pr-contract.md`
- **Intent preserved**: YES
- **Material deviations**: **G2 / US-003 (generation-skew diagnosis) was dropped during execution.** Advisor verification found the branch unreachable for a real workspace: `resolveControlDir` (`.agro/cli/src/lib/compat.ts:179-186`) selects a control dir with `isDirectoryAt`, so an existing `.oh/` directory becomes the resolved control dir and the `!existsSync(controlDir)` guard never holds. Its test passed only because it created `.oh` as a regular file. It also could not reach the reported operator at all, because the error in that scenario is printed by the stale image-installed v0.9.0 bundle, whose text current source cannot change. Removed rather than repaired, per D2 (smallest supported correction). The story was deleted from `prd.json` rather than marked passing, so the completion oracle stays honest.
- **Constraints discovered during grounding**: The installed bundle is v0.9.0
  against v0.12.2 source, so the reported path failure cannot be reproduced from
  current source. The contract anticipates this (D3: "If code is already fixed, a
  grounded recovery/documentation/test solution is acceptable"). The remaining
  current-source defect is the diagnostic's recovery advice, which is grounded,
  not invented.
- **Orchestration preserved**: YES — every tracked edit is assigned to a bounded
  `/delegate` worker in an isolated worktree; the advisor runs each gate command
  personally and owns acceptance; no worker writes `prd.json` or `progress.txt`;
  no Herdr message is sent to the supervisor and no `/escalate` is invoked.
