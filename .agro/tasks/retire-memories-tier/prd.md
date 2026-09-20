# PRD — Retire the `.agro/memories/` tier

Issue: [#1116](https://github.com/mifunedev/agro/issues/1116)
Repo: `mifunedev/agro` · Remote: `origin` · Base: `development`
Task folder: `/home/sandbox/harness/.agro/tasks/retire-memories-tier/`

## Problem

`.agro/memories/` ships four tracked files — `AGENTS.md`, `SOUL.md`, `USER.md`,
`MEMORY.md` — and advertises an active contract its own guide states as "Read all
three at session start". No surface the harness reads performs that read.
`.agro/manifest.json` omits `memories/**` and ships `evals/**`, so an installed
project receives `memories-tier-defaults.sh` without its subject. The same
layering error was adopted once as the root `context/` tier (#220) and deleted
(#868) for the same recorded reason.

The operator chose retirement over the prior advisory O4 recommendation. This PRD
is the bounded retirement contract. It does not build O4 machinery.

## Goals

- Remove the shipped tier and its advertised contract.
- Leave both affected probes truthful, not weakened.
- Leave layout documentation and the changelog matching reality.

## Non-goals

Per-agent home instances, seeding, loaders, the `/home/sandbox` volume,
metadata-budget work, `skills-ref` conformance work, and probe cleanup unrelated
to this retirement and its two affected probes.

## Grounded state at the base commit

| Fact | Evidence |
| --- | --- |
| The tier tracks exactly four files | `git ls-files .agro/memories` |
| No copy anywhere is customized | `git diff ab86a8c3 -- .agro/memories/` is empty in both worktrees; `git status --porcelain -uall --ignored .agro/memories/` is empty in both; all eight `md5sum` values match pairwise |
| One commit ever touched the tier | `git log -- .agro/memories/` → `ab86a8c3` only |
| The tier never reached a tagged release | `CHANGELOG.md:16-17` sits under `## [Unreleased]` |
| The payload never shipped the tier | `.agro/manifest.json` `include` omits `memories/**` |
| Only two files reference the tier outside probes and the changelog | `.agro/README.md:14`, `docs/oh-directory-layout.md:18` and `:94` |
| `agents-md-fallback.sh` enumerates the tier guide | `.agro/evals/probes/agents-md-fallback.sh:20-21` |
| That probe also demands root docs and guides the payload excludes | `:20-21` names `.agro/logs/AGENTS.md` and root `AGENTS.md`; `:32` requires `docs/lifecycle-commands.md`; `manifest.json` ships neither root `docs/` nor `.agro/logs/**` |

## Decisions this PRD makes

**D-a. `memories-tier-defaults.sh` is removed, not replaced.** Every assertion in
it is scoped to `.agro/memories/` — the tracked file set, the identity and dated
entry scans, the `SOUL.md` headings, and the root-`AGENTS.md` mention. The
durable invariant behind it, "a public checkout ships nobody's real identity",
has no remaining subject once the tier is gone. Generalizing it to a repository
wide identity scan is a new guard over an unrelated surface: 28 tracked files
already match the probe's own email pattern, all of them fixtures, URLs, and
captured external prose. That guard is out of this contract's scope, and adding
it here would be scope creep rather than reconciliation.

**D-b. `agents-md-fallback.sh` is corrected and made deployment-aware.** Its
lesson — one reintroduced `CLAUDE.md` silences every `AGENTS.md` below it — is
durable and its subject survives. It is rewritten as:

1. *Universal, asserted everywhere*: no tracked `CLAUDE.md` anywhere in the tree.
2. *Universal, asserted everywhere*: every tracked `AGENTS.md`, derived from
   `git ls-files` rather than a hand-written list, is a real file and not a
   symlink. Deriving the set from git removes the stale `.agro/memories/AGENTS.md`
   entry as a consequence of the retirement instead of as a hand edit, and it
   cannot be satisfied by deleting a guide, because a deleted guide leaves the
   set smaller but never introduces a symlink.
3. *Source-checkout only*: the root `AGENTS.md` and the enumerated directory
   guides are tracked, and `docs/lifecycle-commands.md` documents the `2.1.277`
   floor. An installed project receives neither root `docs/` nor `.agro/logs/`,
   so asserting them there would fail on a correct deployment.

   Applicability is decided by one named subject —
   `git ls-files --error-unmatch docs/lifecycle-commands.md` — not by a blanket
   absent-subject rule, and the probe prints which mode it ran in. Both universal
   checks still assert in installed-project mode, so the mode is a narrowing of
   subject, not a SKIP.

**D-c. Changelog.** The two `### Added` bullets at `CHANGELOG.md:16-17` describe a
tier and a probe that will not exist in any release, so they are removed rather
than left to advertise absent behavior in the eventual release notes. One
`### Removed` bullet records the retirement, because operators tracking
`development` did receive the tier in a source checkout.

**D-d. Preservation.** No customized memory exists to preserve — see the grounded
state table. Deletion is therefore safe as a plain `git rm`. The upgrade
behavior for a fork that customized its copies after the base commit is stated in
the PR body, not in a tracked file, and no private content is read or published:
`agro update` is unaffected because the payload never carried `memories/**`, and a
fork that edited its copies sees an ordinary merge conflict or a delete it can
decline. If any worker finds a modified or extra file under `.agro/memories/`
during execution, it stops and reports a conflict instead of deleting it.

## Definition of Done

- **D1** — `.agro/memories/` and its four tracked files are removed. `.agro/` stays
  the canonical control plane. Customization is re-checked immediately before
  deletion and a conflict is reported rather than lost.
- **D2** — Both probes reconciled per D-a and D-b. No check weakened to reach
  green. No blanket absent-subject SKIP policy. The `CLAUDE.md` safety lesson is
  preserved and deployment applicability is verified rather than assumed.
- **D3** — `.agro/README.md:14`, `docs/oh-directory-layout.md:18` and `:94`, and
  `CHANGELOG.md` corrected per D-c. The public-docs surface in `mifunedev/agro-web`
  is assessed and its applied / not-applicable status stated with evidence.
- **D4** — The changed contracts verified in this source checkout and in a fresh
  manifest-installed project built through the real distribution path. Commands,
  actual exit codes, and expected results recorded. Negative tests prove each
  surviving guard fails on a deliberate violation in both modes. Baseline
  failures distinguished from introduced failures; neither suppressed.
- **D5** — `/audit implementation` and `/eval` gates complete. Advisor-run
  verification and acceptance evidence recorded under D-IDs in the PR body.
- **D6** — Isolated worktree, `/git` conventions, remote `origin`
  (`mifunedev/agro`), base `development`, every tracked edit assigned through
  `/delegate`. No merge, release, destroy, infrastructure restart, or shared
  setting change.
- **D7** — Open PR, `isDraft=false`, CI green for the exact final head SHA
  verified after the final push and undraft. Skipped and neutral checks reported
  accurately. PR URL, final head SHA, validation summary, and caveats returned.

## Knowledge Context

- **Base commit**: `4fc0cd7eb9adcba71653d797373b814184d5eb67`
- **Queries**: `evals probes memories docs manifest`
- **Knowledge used**: `[[pattern-evals-probe-failure-path-untested]]`,
  `[[pattern-evals-document-conformance-proxy-oracle]]`,
  `[[pattern-evals-tracked-only-scan-misses-uncommitted]]`,
  `[[pattern-evals-negation-must-govern-token]]`
- **Grounded against**: `.agro/evals/probes/memories-tier-defaults.sh`,
  `.agro/evals/probes/agents-md-fallback.sh`, `.agro/manifest.json`,
  `.agro/README.md`, `docs/oh-directory-layout.md`, `CHANGELOG.md`,
  `.agro/memories/*`, `.agro/tasks/council-openclaw-workspace/findings.md`
- **Conflicts discovered**: the prior findings assert that a grep for `memories`
  outside `evals/probes` returns nothing. It returns `.agro/README.md:14`,
  `docs/oh-directory-layout.md:18` and `:94`, and `CHANGELOG.md`. The repository
  wins; D3 exists because of it. `pattern-evals-probe-failure-path-untested`
  is why D4 requires an injected-fault negative test for every surviving check
  rather than a green run.

## Expected Knowledge Impact

- **Impact**: NOT-APPLICABLE
- **Expected entries**: `none`
- **Affected source paths**: `.agro/memories/**`, `.agro/evals/probes/{memories-tier-defaults,agents-md-fallback}.sh`, `.agro/README.md`, `docs/oh-directory-layout.md`, `CHANGELOG.md`
- **Reason**: no tracked knowledge page declares any of these paths as a source.
  The final answer is derived from the actual diff at the execution gate, not
  from this prediction.

## Plan Reconciliation

- **Source plan**: none — the operator's approved retirement scope is the source.
- **Intent preserved**: YES
- **Material deviations**: none
- **Constraints discovered during grounding**: the tier never reached a tagged
  release, which shapes D-c; `agents-md-fallback.sh` asserts on root `docs/` and
  `.agro/logs/`, which the payload excludes, which shapes D-b item 3.
- **Orchestration preserved**: YES — advisor keeps interpretation, verification,
  and acceptance; every tracked edit goes to a bounded `/delegate` worker; the
  advisor runs each gate command itself.

## Architecture significance

Judged once: retiring a reusable abstraction is architecture-significant in form,
but the decision is already made by the operator on recorded evidence after an
independent critique. `/architect` would re-deliberate a settled call and is not
run.

## Communication boundary

No Herdr messages to the supervisor. No `/escalate`, no `AGRO_SUPERVISOR_PANE`,
no Slack, no relay. Workers report through native worker output only. This
boundary is restated in every worker assignment. Escalation happens in the
advisor's normal output.
