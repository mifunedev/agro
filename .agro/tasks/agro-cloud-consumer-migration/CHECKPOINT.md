# Phase 4 (#944) — durable checkpoint

Written 2026-09-09 while the lifecycle-matrix worker runs. Purpose: make the next
compaction cheap and lossless. Authoritative state remains `prd.json`; this is the
narrative index into it.

## Story state — 10 of 12

PASS: US-001, US-002, US-003, US-004, US-005, US-006, US-008, US-009, US-010, US-011
plus the US-012 prerequisite (`agro sandbox install` idempotency).

OPEN:
- **US-007a** — FAILS on measured product defects. The re-run that would clear it is BLOCKED on a missing container runtime, so the two gate gaps stay unanswered.
- **US-007b** — blocked on Q3, paid OVH infrastructure. Nothing touched.

`#939` and `#944` stay OPEN. `#945`'s gate is untouched: Phase 4 complete AND 90 days
AND three releases since the first public AGRO release (anchor v0.9.0, 2026-09-06;
earliest date 2026-12-05; one release observed).

## Worker ledger — native IDs for resumption

| ID | Native | Scope | Status |
|---|---|---|---|
| W1 | aa588cf40102fb5f1 | US-001 org inventory, US-008 migrate --check | ACCEPTED |
| W2 | ae551523e1c3b9519 | US-003/4/5 bootstrap + the readiness gate | ACCEPTED |
| W3 | ab16f3c765ba00e63 | US-006 node.rebuild, test reconciliation | ACCEPTED |
| W4 | ab4aa8ebb14cb9fb1 | US-002 classification, US-009 docs | ACCEPTED |
| W6 | a215de2cbdb589bf6 | US-010 website, orchestra | ACCEPTED |
| W7 | a195edc09e0a99ae6 | US-011 agro-web docs drift | ACCEPTED |
| W8 | a1a9a4ca502958aa1 | US-012 CLI idempotency | ACCEPTED |
| W9 | afeb96646cba27a88 | #1019 Part A recovery + probes | ACCEPTED |
| W10 | a29e0355c83c5e384 | US-008 migration rehearsal | ACCEPTED |
| W11 | ae493cb0a966bd2a6 | US-008 Cloud migration delivery | ACCEPTED |
| W12 | a4aa4d7b47120d4d2 | US-008 agro-web migration delivery | ACCEPTED |
| W13 | a6a674efc3f0b1ca5 | US-007a lifecycle matrix | DELIVERED partial: UID assessment done; ohproxy + A/B re-run BLOCKED on missing Docker |
| W14 | a7af21d0c2cff9458 | comment cleanup | ACCEPTED |

## Trees carrying deliverable work

| Repo | Worktree | Branch | Base | State |
|---|---|---|---|---|
| openharness-cloud | `.worktrees/944-integrate2` | feat/944-integration2 | 0aa8f99 | staged R100 migration + unstaged source/docs; green |
| agro-web | `.worktrees/944-docs` | feat/944-docs-drift | 409ef104 = origin/main | staged R100 migration + docs; green |
| website | `.worktrees/944-refs` | feat/944-agro-runtime-references | fd60500 | 7 files; lint+build green |
| orchestra | `.worktrees/944-name` | feat/944-agro-runtime-name | 2c7ccd28 | 1 line |
| agro | `.worktrees/feat/944-agro-cloud-consumer-migration` | same | b10ecac3 | task record; `.agro/tasks/*` is gitignored, needs `git add -f` |
| agro | `.worktrees/bug/944-sandbox-install-idempotent` | bug/944-sandbox-install-preserve-config | b10ecac3 | CLI fix + 9 tests |
| agro | `.worktrees/bug/1019-boot-recovery` | bug/1019-boot-recovery | b10ecac3 | runbook, requirements, 2 probes |

Cloud suite baseline to preserve: type-check 0, test 0 — shared **119**, db 189,
gateway 37, provisioner 84, web 2898 across 126 files.

## The readiness gate — verified by the advisor, re-run still required

`infra/cloud-init/cloud-config.yaml`: `:98` install → `:99` `run_step wait_sandbox_ready`
(immediate successor) → `:102` `echo ok` → `:103` marker. Polls
`docker exec <name> systemctl is-active openharness-bootstrap.service` using the rebuild
helper's own constants (10s probe, 5s interval, 20 attempts, 300s deadline). `active`
proceeds; `failed` exits immediately; deadline fails. Via `run_step`, so `fail` writes
`failed:<code>` and exits — the harness install, `ok` and the marker are unreachable on
failure. `failed:1` = unit failed, `failed:2` = deadline. Zero new comment lines.

**Two gaps the fix cannot settle itself — the re-run must answer both:**
1. Is that unit the completion signal on a container's FIRST boot, or only
   post-recreate? Fails closed if not, but must be observed.
2. Does the 300s deadline survive a cold pull plus first-boot seeding? The rebuild
   budget assumes an already-pulled image. If config A starts failing `failed:2` the
   answer is a larger attempt count, NOT removing the gate.

## Unresolved decisions — operator only, none inferred

- **OD-1 default harnesses.** Priced, not decided. Install-three was measured to fail
  every node's bootstrap pre-gate (`status=failed:243`); availability depends on the
  re-run confirming config B now reaches `ok` with the marker. Correct id is `pi`.
- **Surface 4a contract.** Deliberately unresolved rather than weakening the DoD.
  Bootstrap-watch-only (docs fix; advisor's recommendation, since README:363,
  quickstart:591 and runtime-settings-runbook:157 already say "watch") versus a
  persistent re-attachable session (product change delivering what index.ts:791
  promises). Either way the silent `no sessions`/exit 1 after a SUCCESSFUL boot needs
  fixing.
- **Q3 paid OVH.** US-007b blocked. No live infrastructure touched.
- **#1019 Part B.** R3 supersede-vs-yank and R4 the LEGACY_IMAGE pin written with
  evidence both ways, deliberately undecided. Publication unauthorized.

## Open defects found but NOT fixed

- UID/GID divergence breaks attach surface (c); the UID-sync path is gated on a
  checkout bind image-only nodes never have. Today's 1000/1000 is coincidence.
  Write-up + fail-before-mutation ASSESSMENT in flight; no remap or chown permitted.
- `sandbox rebuild` does not always recreate the container.
- A failed rebuild leaves the sandbox stopped with no rollback.
- `agro config set` prints `oh.json:` while writing `agro.json`.
- AGRO Dockerfile:101-102 bakes `--dangerously-skip-permissions` /
  `--dangerously-bypass-approvals-and-sandbox` aliases for binaries it no longer ships.

## Must appear in PR bodies

- Why the sandbox image is NOT pinned to 0.9.0 — the cleanup removed the only source
  reference to #1019. The constraint survives as a test asserting
  `doesNotMatch(/agro:0\.9\.0/)`, but the provenance does not.
- OA-1: audit existing `nodes.container_name` values —
  `container_name !~ '^[a-z0-9][a-z0-9-]*$'`. Empty result makes the create-boundary
  tightening a production no-op.
- OA-2: stage the migrating commit with `git add -A`; rename detection does not fire
  in `git status --short` and it reads as a mass deletion until staged.
- OA-3: operators must upgrade past CLI 0.7.0, which has no `migrate` verb.
- Three deliberate agro-web divergences from `agro@main`: the `sshd.md` commands that
  exit non-zero upstream, the PII placeholders where main hardcodes a real name and
  email, and the site-served `get-agro.sh` URL.
- No phase- or EPIC-closing trailer on any partial or prerequisite PR.

## Environment blockers and gotchas

- **`python3` is gone** from this environment mid-session; bookkeeping moved to node.
- A monthly spend cap terminated two workers earlier. Resolved — a terminated
  invocation is not a standing refusal, and stale request IDs in notifications made an
  old failure look current.
- The local `openharness-web` parent checkout (`bd9f104`) is an ANCESTOR of
  `origin/main` and still carries `CNAME: oh.mifune.dev`. Working from it would
  reintroduce the pre-Phase-3 domain. The PR worktree is correctly grounded.
- Safety net blocks: bare `git stash`, `git checkout -- .`, `rm -rf` outside cwd,
  `.config/` reads, compound heredocs in strict mode.

## Advisor errors recorded, for the retro

Misread a bare "0" as an operator confirmation that host artifacts were clean and wrote
that into this checkpoint; it was a survey dismissal. Corrected within the turn, but it
was a fabricated confirmation in a durable record — the exact failure mode this file
exists to prevent.

Transposed W1/W3 native IDs and sent each the other's brief (W1 caught it). Marked
US-008 passing on rehearsal evidence. Told workers the Cloud repo's AGENTS.md forbids
comments — it has no AGENTS.md. Invented a sibling-style exception to the comment rule
and withdrew it. Called a moving tag immutable. Relayed a caveat's line placement from
a worker report without opening the file — it was after the command it warned about.
Did not notice a public quickstart concealed the #1019 cold-boot failure while
simultaneously tracking that failure as a blocker.


## 2026-09-09 update — US-007a re-run BLOCKED, two hazards found

**Docker is gone from this environment.** Verified by the advisor and independently by review: the Docker CLI is PRESENT but /var/run/docker.sock is ABSENT — no daemon reachable,
no socket at any path, container changed (395299dff1d9, was e73e5123a864), docker gid
moved 117 -> 1001. Items 1 (ohproxy no-shell) and 3 (A+B re-run) are BLOCKED on a
missing container runtime — an exact capability blocker, not a skip. US-007a stays
FAILING and its two gaps remain unanswered:
  a. is openharness-bootstrap.service the completion signal on a FIRST boot?
  b. does the 300s deadline survive a cold pull plus first-boot seeding?
Suggestive but NOT an answer: pre-fix runs showed seed-to-active ~4s twice and the
probe sequence (empty) -> activating -> active, with (empty) treated as keep-polling
(fail-closed). The pull was never inside the measured window.

**HAZARD 1 — the live checkout's working tree silently reverts .devcontainer/ to the
pre-AGRO generation.** Advisor-verified: HEAD b10ecac3 has AGRO_HOME_MOUNT and zero
oh-seed; the working tree has ZERO AGRO_HOME_MOUNT and THREE oh-seed, across 4 modified
files (129/132). A `docker build -f .devcontainer/Dockerfile .` from this tree yields a
LEGACY image, not the AGRO candidate — a re-run would test the wrong artifact and could
be reported as a pass. BUILD FROM HEAD OR A CLEAN WORKTREE. The checkout was left
untouched; not stashed, not reverted, because it is not this task's to resolve.

**HAZARD 2 — ohproxy confinement is partly outside the accepted generator.**
`restrict` does NOT block command execution; confinement rests on the account's
/usr/sbin/nologin shell plus PermitTTY no. buildHostProxyAssets() emits the key line and
sshd block but NOT the account. So the load-bearing part of that boundary is
ungenerated — which is exactly why the no-shell check must be observed, not reasoned.

**UID/GID assessment DELIVERED** (assessment only; nothing implemented, remapped or
chowned). Checkable condition: uid/gid(sandbox@node) == uid/gid(sandbox@image) before
first boot; stronger form owner(P) == C AND H can write P. Container uid is pinned
(Dockerfile:60). Node uid is ASSUMED — the cloud-config users: entry has no uid: field,
so 1000 is emergent from base-image passwd ordering. The adaptive usermod -u path
(entrypoint.sh:169-185) is gated at :161 on a checkout bind image-only nodes never have,
while the destructive chown runs unconditionally: the mechanism that could save you is
unreachable on exactly the deployment that needs it. Proposed guard is detection-only,
sits between install_agro and agro sandbox install docker (the only window before the
chown), compares node stat against `docker run --rm <image> id -u sandbox`, costs ~1s
and no extra network, and yields failed:3 alongside the gate's failed:1/failed:2.
Limits: new provisioning only; does not cover the rebuild path; reads the baked uid.

**Leftover artifacts — NOT VERIFIED, and no one has confirmed them.** The worker issued
two docker build commands before discovering the daemon was gone and could not verify
they never started (its log redirects targeted an already-deleted scratchpad, which
suggests they never began, but that is inference). The advisor briefly recorded here
that the operator had confirmed zero leftovers. THAT WAS WRONG — a lone "0" in the
transcript was a dismissal of an unrelated survey prompt, not an answer about host
state. Corrected 2026-09-09. Nobody has checked. Still outstanding for the host:
confirm agro-candidate:us007a, oh-node-host:us007a and any us007a-* container or volume
are absent; removal commands are in evidence section 16.4.


## 2026-09-09 — operator narrowed scope; PRs opened; website publication withheld

**Scope change, mid-turn, by the operator.** Immediate priority narrowed to
`mifunedev/agro` and `mifunedev/agro-web`. Cloud, orchestra and website are DEFERRED —
their existing work is preserved on its own draft PRs at operator instruction, not
proposed for merge. A follow-up authorization then explicitly permitted scoped
commits/pushes/draft-PR creation for those secondary repositories as a preservation
measure only. Nothing was reverted. No new implementation was performed on them.

**Story state is unchanged at 10 of 12.** US-007a still FAILS on measured product
defects; US-007b is still behind the unauthorized paid-OVH gate. #944 and #939 remain
OPEN, and no PR carries a closing trailer for either. #945's gate is untouched.

### Re-grounding, before anything was committed

Every branch was checked against its actual current target head. All six were already
exactly at their target — no rebase was needed:

| Repo | Base recorded | origin target at check time | Match |
|---|---|---|---|
| openharness-cloud | 0aa8f99 | origin/development 0aa8f99 | yes |
| agro-web | 409ef10 | origin/main 409ef10 | yes |
| website | fd60500 | origin/development fd60500 | yes |
| orchestra | 2c7ccd28 | origin/development 2c7ccd28 | yes |
| agro (x3) | b10ecac3 | origin/development b10ecac3 | yes |

### PRs opened

| Repo | Issue | PR | Head | Status |
|---|---|---|---|---|
| openharness-cloud | #144 | #145 | 4b4124c7caff31a84b2367b75472c7b8ef26ce2f | DRAFT — parked, deferred |
| orchestra | #982 | #983 | 1acc415bf347991ed2dbd3b0d0ac937b9006faa0 | DRAFT — parked, deferred |
| agro-web | #48 | #49 | 0b0a6d28da979d6eb4a92e5a798cef8c95f3e1c4 | READY |
| agro | #1021 | #1022 | 909b3ec3e294a2dcfad15bd3036730a094c07610 | READY |
| agro | #1019 (not closed) | #1023 | f8b72d7f5845d797039b8cfd8f87d7c23d9165c5 | READY |
| website | #65 (not filed) | NONE — withheld | 5e5f34cc45ed8ab174f1354b3cd2e97f62b1c3a9 | branch pushed, PR withheld |

### Website: the precise gate, and why no PR was opened

The operator flagged an unresolved Netlify credit/domain issue and forbade knowingly
triggering a deployment or paid action. Measured rather than assumed:

- **Opening a PR on mifunedev/website triggers a Netlify Deploy Preview build.** Verified
  against three existing PRs (#64, #62, #60): each carries a
  `netlify/promptengineers/deploy-preview` check plus header/redirect/pages-changed
  checks, ~1m build each, on the `promptengineers` Netlify project.
- **A branch push does not.** After pushing `docs/65-agro-runtime-references`, the head
  carried 0 commit statuses and 0 check-runs.

So the work is preserved on the remote branch and the PR is deliberately not opened.
Opening it is the operator's call once the credit issue is resolved. The scoped website
issue was also not filed, since an issue without its PR serves nothing here.

Caveat on the branch-push evidence: the three no-PR branches used as controls
(feat/21-matrix-vibes, feat/614-add-fastmcp-support, master) all predate the Netlify
integration, so they are weak controls. The direct observation on the actual pushed head
— 0 statuses, 0 check-runs — is the load-bearing evidence.

### Verification performed at each exact head

- **Cloud** — `pnpm type-check` exit 0; shared 119, db 189, gateway 37, provisioner 84,
  web 2898 across 126 files. Matches the pre-change baseline on every count. The six
  readiness-gate tests were confirmed to actually EXECUTE (subtests 34-39), not merely
  to exist.
- **agro-web** — check:docs-drift PASS (44 files), typecheck exit 0, docusaurus build
  SUCCESS, theme-order PASS. Installer assets the new quickstart tells readers to curl
  were fetched live: get-agro.sh 200/8527B, agro.js 200/187989B, get-oh.sh 200/9493B,
  oh.js 200/187989B.
- **website** — next lint 0 warnings, next build succeeded, and the llm.txt generator
  was re-run to confirm its output matches the committed file (no drift).
- **agro CLI fix** — typecheck exit 0; sandbox.test.ts 26 passed; full suite 1255 passed,
  2 failed.
- **agro #1019** — pnpm-audit-ci-gate PASS; recovery probe SKIPPED (exit 2, non-live);
  full suite 1246 passed, 2 failed.

### The 2 agro suite failures are pre-existing, and this was proved rather than assumed

Both are in `.agro/cli/src/commands/__tests__/migrate-rehearsal.test.ts`, untouched by
either branch. A clean detached worktree at the base commit b10ecac3, with none of the
branch changes, reproduces the IDENTICAL 2 failures. Cause: `dockerComposeAvailable()`
runs `docker compose version`, which probes the Compose plugin binary (present) rather
than daemon reachability (absent). It therefore takes the "available" branch and asserts
exit 0 from a command that cannot succeed without a daemon.

### NEW FINDING — every CI path filter in agro is dead. Filed as #1020.

`git ls-files .oh` returns **0**; `git ls-files .agro` returns **760**. No workflow in
`.github/workflows/` references `.agro/` at all. Every path filter still names `.oh/**`,
which now matches nothing, so a change confined to the control plane triggers NO CI.

This is not cosmetic. The probe added by PR #1023 lives under `.agro/evals/` and is
therefore unreachable by any CI path — the exact failure shape of #981, now instantiated
repository-wide by the Phase 3 rename. `oh.json` and `.env.example` in those filters are
stale too; the harness ships `agro.json` and `.example.env`.

A coverage regression that reports green because nothing runs.

### Other issues filed

- **agro #1021** — `agro sandbox install` is not idempotent; a re-run discards an
  existing sandbox's configuration, silently unpinning `storage.homePath` on a node.
  Fixed by PR #1022.
- **openharness-cloud #144**, **orchestra #982**, **agro-web #48** — scoped consumer
  issues, each referencing #944/#939 without closing either.

### Corrections to earlier records

- CHECKPOINT.md said the agro-web docs branch needed the three deliberate divergences
  called out; they were verified in the tree before the PR body claimed them — the
  site-served get-agro.sh URL, `example.com` with RFC 5737 addresses instead of a real
  name and email, and the corrected sshd commands.
- The website post's `ghcr.io/mifunedev/openharness:0.9.0` reference was checked rather
  than "corrected" on assumption: `ghcr.io/mifunedev/agro:0.9.0` and
  `ghcr.io/mifunedev/openharness:0.9.0` resolve to the SAME digest,
  sha256:5ecfe69bbc0654ca733535d710c0c61fd5f7913945bef7d1beec97506f03e60c. The reference
  is accurate, merely legacy-named. Left as-is; not an advisor edit.
- The agro-web drift-rule inversion was verified against the harness tree rather than
  taken from the worker's report: agro ships `.example.env`, and `.env.example` does not
  exist. The old rule flagged the real filename and recommended a nonexistent one.

### Advisor errors this turn

- **Committed a `node_modules` symlink.** I had symlinked node_modules into the
  bug/1019-boot-recovery worktree to run its tests, then used `git add -A`. The symlink
  landed in the commit as mode 120000. Caught on reading my own commit stat, removed
  from the index and disk, amended before pushing. The pushed head f8b72d7f contains no
  node_modules path; the other four commits were audited and are clean too. `git add -A`
  after introducing untracked scaffolding is the hazard.
- **Left a build artifact in the website worktree.** Running `npm run build` there to
  verify the branch rewrote the TRACKED file `public/sw.js` (a minified service worker
  whose content is build-hash churn). It was deliberately NOT staged, so it is not in
  the commit, and NOT reverted, per the operator's instruction not to revert. It remains
  as an uncommitted modification in that worktree.

### Deferred, explicitly, and NOT counted as complete

Cloud (US-002, US-003, US-004, US-005, US-006, US-009, and the Cloud half of US-008),
orchestra, and website (US-010) are preserved and parked. Their PRs carry a stated
parked/deferred status. The EPIC's definition of done is NOT redefined by this narrowing:
those items remain part of #944, and #944 remains part of #939. #945's gate — Phase 4
complete AND 90 days AND three releases since the first public AGRO release (anchor
v0.9.0 2026-09-06; earliest date 2026-12-05; one release observed) — is unchanged.


## 2026-09-09 (later) — RETRACTION of #1020, website draft opened, all heads green

### RETRACTION — issue #1020 was FALSE and is closed as invalid

I filed mifunedev/agro#1020 claiming that every workflow path filter still named
`.oh/**`, which has no tracked files, and therefore that control-plane changes trigger
no CI — including the assertion that the probe added by PR #1023 was unreachable by any
CI path.

**All of that is wrong.** I ran `grep -rn '\.agro/' .github/workflows/` against the ROOT
CHECKOUT'S WORKING TREE and read the result as repository state. All six workflow files
are locally modified there, reverted to the pre-AGRO generation — the same silent
working-tree divergence already recorded in this file as HAZARD 1 for `.devcontainer/`.
I had documented that exact hazard and then walked into it again for a different
directory.

`origin/development` was correct all along: ci-harness.yml names `.agro/**`,
`.agro/skills/**`, `.agro/hooks/**`, `.agro/evals/**`, `.agro/knowledge/**`,
`agro.json` and `.example.env`; sandbox-boot-guard.yml names `.agro/**` and
`.agro/scripts/*`. Both `.agro/**` and `.oh/**` are listed, which is correct during the
alias SLA.

Disproof from real runs: PR #1022 (changes confined to `.agro/cli/src/**`) and PR #1023
(adds a probe under `.agro/evals/`) each ran 5 checks, all success, including the Eval
Probe Regression Gate. The probe I claimed was unreachable was gated green on its own PR.

#1020 is closed as not-planned with that correction written into it, and the three PR
bodies that cited it (#1022, #1023, #1024) were edited to remove the false claim and
carry the actual check results.

**Rule for the next session: grep the ref, not the worktree.** `git show
origin/<branch>:<path>` — never the working copy at /home/sandbox/harness.

### Website: draft PR opened without triggering a deploy

The operator asked whether Netlify documents a native skip directive for PR-opening
Deploy Previews. It does, and it is title-scoped:

- Netlify docs: "To avoid generating a Deploy Preview for a pull/merge request, add
  `[skip ci]` or `[skip netlify]` to **the title of the pull/merge request**."
- The commit-message form covers only branch and production deploys. That distinction is
  the documented cause of the "it was ignored" support reports; Netlify staff confirmed
  the PR title is the working mechanism and the docs were updated to say so.

So website PR #66 was opened as a DRAFT titled
`[skip netlify] FROM docs/65-agro-runtime-references TO development`. Metadata on the PR
only — no site configuration, billing or DNS was touched, and the Netlify credit issue
itself was not investigated.

**Verified no deploy launched:** 90+ seconds after opening, the head
5e5f34cc45ed8ab174f1354b3cd2e97f62b1c3a9 carries 0 commit statuses and 0 check-runs.
Existing PRs (#64, #62, #60) register their `netlify/promptengineers/deploy-preview`
check within about a minute, so a launched build would have appeared by then.

**`[skip netlify]` must stay in that title** until the credit issue is resolved.
Removing it and pushing a commit is what resumes previews.

### NEW FINDING — agro-web docs build hard-fails on a rate-limit 403. Filed as agro-web#50.

PR #49's first run failed with `ref mifunedev/agro@main does not resolve (... -> HTTP
403)`. Re-running the IDENTICAL commit with no change succeeded, so the message names
the wrong cause. Two compounding defects:

1. `.github/workflows/pages.yml`'s `Build site` step sets no `env:`, so
   `oh-source.mjs`'s `authHeaders()` finds neither GITHUB_TOKEN nor GH_TOKEN and the
   API call goes out unauthenticated — 60 requests/hour per IP, on shared runner IPs.
2. `isTransientStatus()` covers 408/429/5xx but NOT 403, which is what GitHub returns on
   primary rate-limit exhaustion. Exhaustion therefore falls through to
   "the mirror would publish something wrong" and hard-fails the deploy.

`mifunedev/agro` is public and the same URL returns 200 unauthenticated from a
non-exhausted address, so this is not a permissions problem. Not fixed here — filed,
with the token fix and the `x-ratelimit-remaining: 0` discriminator proposed.

### Final CI state — every PR verified at its exact head

| PR | Head | Checks |
|---|---|---|
| cloud #145 (draft) | 4b4124c7caff31a84b2367b75472c7b8ef26ce2f | 4/4 success |
| orchestra #983 (draft) | 1acc415bf347991ed2dbd3b0d0ac937b9006faa0 | 0 — `decks/**` is in test.yml's paths-ignore, and slides.yml only fires on a push to development. Absence of jobs is NOT green, and is reported as absence. |
| agro-web #49 (ready) | 0b0a6d28da979d6eb4a92e5a798cef8c95f3e1c4 | Build docs site success; Deploy to GitHub Pages skipped |
| agro #1022 (ready) | 909b3ec3e294a2dcfad15bd3036730a094c07610 | 5/5 success |
| agro #1023 (ready) | f8b72d7f5845d797039b8cfd8f87d7c23d9165c5 | 5/5 success |
| agro #1024 (ready) | 53f24aa207ceac8a608bf6f79a8f826ac3620868 | 5/5 success |
| website #66 (draft) | 5e5f34cc45ed8ab174f1354b3cd2e97f62b1c3a9 | 0 by design — `[skip netlify]` |

The accidentally committed node_modules symlink is confirmed ABSENT from every pushed
tree: `git ls-tree -r` over bug/1021-sandbox-install-idempotent and bug/1019-boot-recovery
returns 0 node_modules paths. #1022's head is 909b3ec3e294a2dcfad15bd3036730a094c07610 and
was never affected — the symlink was committed on the 1019 branch and amended away before
that branch was pushed.

### Story state is STILL 10 of 12

Nothing above changes it. US-007a still FAILS and its re-run is still blocked on the
absent Docker socket. US-007b is still behind the paid-OVH gate. #944 and #939 remain
OPEN, no PR carries a closing trailer for either, and #945's time-and-release gate is
untouched. Host cleanup remains UNVERIFIED — nobody has checked.


## 2026-09-09 (final) — agro-web#50 fixed and verified; website#66 body corrected

### agro-web#50 IMPLEMENTED — PR #51, head 55d4cfc5adec6fb77c1dfa0026aca6c1f55239f7

Bounded fix, on a fresh worktree off origin/main (409ef10) so it does not mix with the
docs PR:

1. `.github/workflows/pages.yml` — the `Build site` step now receives the job's own
   `secrets.GITHUB_TOKEN`. No new credential; it is the token the workflow already has.
   Unauthenticated the mirror call ran against 60 requests/hour per shared runner IP.
2. `scripts/oh-source.mjs` — `isTransientStatus(status)` becomes
   `isTransientResponse(res)`, reading the response rather than the status alone. A 403
   is transient ONLY with `x-ratelimit-remaining: 0`. Without that header a 403 stays
   FATAL, so a genuine auth failure or a bad ref still fails the deploy — treating every
   403 as transient would have been the dangerous fix. raw.githubusercontent.com sends no
   such header, so a 403 there stays fatal, which is correct since it is not
   quota-limited. Both call sites migrated, so there is one rule, not two. A
   rate-limited failure now reports "GitHub rate limit exhausted" instead of blaming the
   ref.
3. Tests — the repository had NO test runner. Added `pnpm test` (`node --test`, no new
   dependency) and `scripts/oh-source.test.mjs`, 9 tests: the exhausted-quota 403; the
   bare 403 and remaining=1/4999; 401 and a 403 carrying only retry-after; the UNCHANGED
   408/429/5xx behaviour; 400/404/409/410/422 still fatal; the header believed only on a
   403; a header-less response; and case-insensitive header matching. Wired as a GATING
   CI step on every event, unlike the advisory drift check, because this rule decides
   whether a bad mirror ships.

**Verified at the exact head, on the FIRST run — not a rerun.** Local: 9/9 tests,
typecheck exit 0, build SUCCESS, theme-order PASS, docs-drift PASS (39 files), and the
build exercised the real mirror path end to end (resolved agro@main at 823aabbd, wrote
get-agro.sh, get-oh.sh, agro.js, oh.js). CI run 34386051054: `Build docs site` success,
`Deploy to GitHub Pages` skipped. The CI LOG was read rather than trusting the green —
the new step executed (`# tests 9 / # pass 9 / # fail 0`) and `GITHUB_TOKEN: ***`
appears in the Build site step's env, so the token is genuinely in effect.

### website#66 body corrected — metadata only, no source change

Two corrections at the operator's direction:

1. **Removed the claim that a new cold boot is "not locally repairable."** A volume
   seeded during a FAILED fresh boot is repairable in place too, exactly like a
   previously-seeded one. What a local repair does not change is the published image
   DIGEST, so the next cold boot from that digest fails identically until a new image is
   published. Repairability and the image fix are separate questions; the earlier wording
   conflated them.
2. **Reframed the deploy claim as evidence, not guarantee.** The body now says GitHub
   reports 0 check-runs and 0 commit statuses on the head — *no deployment evidence
   observed on the GitHub side* — and states explicitly that this is not a guarantee from
   Netlify's backend and says nothing about billing, neither of which was queried and for
   neither of which a credential exists here.

`[skip netlify]` remains in the title and the PR remains a draft. The same conflation
survives in `posts/openharness-getting-started.md` itself; correcting published copy is a
content change and was explicitly out of scope, so it is flagged in the PR body rather
than silently edited.

### Story state STILL 10 of 12

Unchanged. US-007a still FAILS with its re-run blocked on the absent Docker socket;
US-007b still behind the paid-OVH gate. #944 and #939 OPEN, no closing trailer anywhere.
#945's gate untouched. Host cleanup still UNVERIFIED.
