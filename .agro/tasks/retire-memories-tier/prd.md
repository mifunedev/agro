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

---

# ADDENDUM — 2026-09-20: rationale reconciliation after an operator clarification

**Status: the retirement decision is REOPENED. The PR is back in draft. No merge.**

## The correction

The operator states that `.agro/memories/AGENTS.md:11`, "Read all three at session
start", was a stale reference to a previous `oh` implementation that the `agro`
implementation replaced. It was never a live AGRO requirement.

**This premise was load-bearing in my own rationale, and it was wrong.** The
Problem section above opens on it; US-001's description repeats it; the PR body
said "It is retired because it has no loader and duplicates a deleted design" and
"shipped an always-on contract". The clarification therefore did change the
rationale. It is recorded here rather than edited away.

I also over-claimed preservation scope. "No customized memory anywhere" is
wrong. I inspected exactly two locations: the root checkout
`/home/sandbox/harness` and the sibling worktree
`.worktrees/skill/1114-audit-responsibility-simplification`. I did not inspect
forks, other clones, other machines, the persistent `/home/sandbox` volume, or
any backup. The correct claim is narrower and is restated in D1 below.

## (1) Retirement reasons that remain independently sufficient

**None.**

Every reason that survives the correction supports a *repair*, not a deletion.

## (2) Reasons that collapse

| Reason | Why it collapses |
| --- | --- |
| R1 — the tier advertises a session-start read that nothing performs | The advertisement was stale `oh`-era prose, not an AGRO requirement. The defect is one sentence, not the directory. Nothing in AGRO asked for the load, so nothing in AGRO is unmet. |
| R2 — the tier repeats the root `context/` tier adopted in #220 and deleted in #868 | `CHANGELOG.md:340` records #868's reason as "No `SessionStart` hook ever loaded it — prose in `AGENTS.md` asked for it." That is R1 restated as precedent, so it collapses with R1. The precedent now argues only that prose must not promise an unimplemented load. |
| R3 — an installed project receives `memories-tier-defaults.sh` without its subject and the probe exits 1 | Verified true, and independently repaired in this branch. It is a distribution and probe-scoping defect. A probe that asserts on an unshipped subject is a broken probe; that says nothing about whether the subject should exist. |
| R4 — the tier is tracked in a public checkout, so it cannot hold real content, and it is shared mutable state across worktrees | This is the O4 layering argument the operator already rejected. It also mistakes the tier's purpose: the probe enforced "ships nobody's actual memories", so the tracked files were always defaults, never an instance. |
| R5 — the tier is unused | Already disclaimed in this PRD. It landed this same release; absence of demonstrated benefit is not evidence of absence of benefit. |

## (3) Retirement versus the smallest preserve-tier correction

The smallest correction that preserves the tier and fixes every defect that
survives the clarification:

| # | Correction | Defect it closes | Evidence |
| --- | --- | --- | --- |
| C1 | Rewrite `.agro/memories/AGENTS.md:11` so it states when a session reads these files under AGRO, without asserting an automatic session-start load | R1, the stale `oh`-era line | `.agro/memories/AGENTS.md:11` |
| C2 | Resolve the defaults-versus-instance confusion in the same guide | Real internal contradiction, see below | `.agro/memories/AGENTS.md:15-17` against `memories-tier-defaults.sh:31-41` |
| C3 | Make the two probes deployment-correct | R3 | already built in this branch for `agents-md-fallback.sh` |

**C2 is a genuine, independently verifiable defect and is not a retirement
reason.** The guide says the three files ship "filled with working defaults, not
placeholders. Edit them in place." `MEMORY.md:12-16` tells a session to add a
dated entry. `memories-tier-defaults.sh:31-41` failed the repository when
`MEMORY.md` carried a dated entry or `USER.md` carried a populated owner field.
So the canonical repository shipped a tier its own agents could never use as
instructed: following the guide turned the probe red. That is one document and
one probe scope to correct, not a directory to delete.

**Cost comparison.** Retirement removes 263 lines and closes C1, C2 and C3 by
removing their subject. The preserve-tier correction closes the same three
defects while keeping the capability, and its probe half is already written and
proven in this branch.

## (4) Does the approved retirement still meet the requested considerations?

**No — it needs a renewed decision.**

The operator approved retirement after an independent critique, and that critique
rested substantially on R1 and R2. With the stale-prose premise removed, the
approval rests on reasons that no longer stand on their own. I am not treating
the earlier approval as covering a decision whose premise has changed, and I am
not inferring from the clarification that the operator now wants a loader, an
on-demand contract, or any replacement design. The clarification corrects a fact;
it does not state a new requirement.

## What I am NOT doing

- Not implementing a different option. The branch is left exactly as built.
- Not deleting or reverting the probe repair before a decision, because it is
  independently correct either way — but see the note in (3) on what it would
  need if the tier is preserved.
- Not inferring a desired loader, an on-demand read contract, or a per-agent
  instance design from the clarification.

## D1 — corrected preservation claim

Inspected locations only: `/home/sandbox/harness` and
`/home/sandbox/harness/.worktrees/skill/1114-audit-responsibility-simplification`.
In both, the four files were byte-identical to the introducing commit `ab86a8c3`,
with no untracked or ignored extras. No claim is made about any other checkout,
fork, machine, volume, or backup.

## Gate conflict I owe rather than skipped

`.claude/skills/spec/references/execute.md` steps 8 and 9 mandate `/spec retro`
and `/wiki compile` on `AUDIT-PASS`. I reported them as "not Definition of Done
items", which exempted a mandated build gate because the authored DoD omitted it.
That was wrong. They are outstanding, and they are correctly deferred now only
because the rationale they would compile lessons from is itself unresolved.

---

# RECONCILIATION — 2026-09-20 — retirement superseded by PRESERVE/REPAIR

The operator explicitly approved **preserving and repairing** the
`.agro/memories/` tier. Retirement is superseded. Everything above this line is
retained as the historical record of a decision that was made, reopened, and
then replaced; none of it is edited away, and no claim that retirement remains
approved survives it.

The retirement stories US-001 through US-005 are **superseded**, not completed.
Their earlier `passes: true` values recorded acceptance of the retirement scope
and are not acceptance of this repair scope. `prd.json` now carries the repair
stories R-001 through R-006 and keeps the retirement stories under
`supersededStories`.

## Why repair rather than retirement

The retirement rationale collapsed under verification, recorded in the ADDENDUM
above and in `.agro/tasks/retire-memories-tier/provenance-verification.md`:

- R1, the missing loader, was a **stale `oh`-era sentence**, not an unmet AGRO
  requirement. The operator stated this and the introducing commit corroborates
  it: the same commit set the root rule to "a session reads when it works there".
- R2 restated R1 through the #868 precedent.
- R4 was contradicted by the introducing commit's own message, which chose
  tracked files that "edit in place".
- R3, the distribution and probe defect, **survives as a repair target**, not as
  a retirement reason. A probe that asserts on a subject the manifest does not
  ship is a broken probe, not a broken subject.

Two limits on the record above, stated because earlier drafts overstated them:
no claim is made that a loader never existed in any era — a `SessionStart`
search cannot establish that — and no global preservation claim is made. The
inspected locations were exactly `/home/sandbox/harness` and
`.worktrees/skill/1114-audit-responsibility-simplification`.

## The live defect the repair must fix

The shipped tier was unusable as instructed. `.agro/memories/AGENTS.md` said
"Edit them in place" and `MEMORY.md` told a session to add a dated entry, while
`memories-tier-defaults.sh:31-41` failed the repository for exactly that. The
canonical repository shipped a tier its own agents could not follow without
turning the suite red. Tracking the live instance is the defect; tracking a
template is the fix.

## Design decisions, fixed here before any worker starts

**Ownership.** `.agro/memories/AGENTS.md` is a tracked scoped contract.
`.agro/memories/templates/{SOUL,USER,MEMORY}.md` are tracked canonical
templates. `.agro/memories/{SOUL,USER,MEMORY}.md` are **live operator instances**
— excluded from Git and from the Docker build context, never overwritten, never
recursively cleaned, never published.

**Initialization attachment point**, decided from sources, not invented: the
existing workspace-directory initialization in `.devcontainer/entrypoint.sh`
(the `WORKTREES_PATH` / `PROJECTS_PATH` / `CRONS_PATH` block near line 526, which
already runs `mkdir -p` on every boot against the bound checkout). The repair
adds a non-overwriting seed beside it. It adds **no** new daemon, no second
lifecycle door, no new `agro` verb, and no global home-layer abstraction. A file
that already exists is left exactly as the operator left it.

**Loading.** Explicitly scoped and documented: a session reads these files when
it works on operator context or needs durable cross-session context, through the
directory contract. The universal session-start mandate is removed. **No
automatic loader is invented** — not a hook, not a `SessionStart` entry, not a
root `AGENTS.md` mandate.

**Isolation.** Each checkout and each worktree holds its own ignored live files.
No shared mutable home instance, no provider-specific silo, no persistent
agent-ID system.

**Role neutrality.** The shipped `SOUL.md` and `USER.md` defaults direct their
reader to "own the decision, the assignment, and the acceptance" — they tell
every reader to be the advisor. The templates must state durable character and
standing preferences without assigning the advisor role to a bounded worker.

## Explicitly out of scope

Wholesale workspace-map migration, O4 global home instances, automatic context
loaders, metadata budgeting, `skills-ref` conformance, probe or website cleanup
unrelated to this tier, and any merge, release, `destroy`, or restart.
