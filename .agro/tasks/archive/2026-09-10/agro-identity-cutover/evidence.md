# Evidence — agro-identity-cutover (#943)

Written at commit `f27b0003`, after the full cutover: repository renames, Pages domain, and the Cloudflare redirect rules. Correlates to the
eval run recorded in `eval-result.json` and the simplicity review in
`simplicity-review.json`, both keyed to that commit.

**Terminal state: `READY`.** All seven stories pass, the cutover is complete, and
all seven CI checks pass at `8f142cfa`. The operator authorized remediating the
advisory fallout that had blocked the build; that work is below.

**The cutover is complete.** The operator performed the Pages custom-domain
change, then issued a scoped Cloudflare token and asked the advisor to apply the
redirect rules. Both hosts now serve correctly: `agro.mifune.dev` is canonical,
and every `oh.mifune.dev` path redirects to it while the five executable paths
keep returning a script body.

The release dispatch is now configured: `AGRO_WEB_DISPATCH_TOKEN` is stored on
`mifunedev/agro` and `AGRO_WEB_REPO` points at `mifunedev/agro-web`. Its
authorization is proven only by the next real release.

## 0. Why this is better than not doing it

**Before.** The next release push to `main` would have been the first carrying the
`.oh/` → `.agro/` rename. The docs site built `oh.js` from `.oh/cli` and mirrored
`get-oh.sh` from `.oh/scripts` at that ref, so that release would have broken the
site build, the installer mirror, and every `oh.mifune.dev` installer URL at once.
The core repository also sent no release dispatch, so the mirror refreshed only on
a daily schedule, leaving up to 24 hours where a published release and the
installers people actually download disagreed.

**After.** The pipeline reads `.agro/` first and falls back to `.oh/`, proven by
building against both layouts. Both repositories are renamed, and the canonical
host now serves the documentation and every mirrored artifact:

```
oh.mifune.dev/install.sh    302 -> raw install.sh          body=#!
oh.mifune.dev/get-oh.sh     302 -> agro.mifune.dev/get-oh.sh    body=#!
oh.mifune.dev/oh.js         302 -> agro.mifune.dev/oh.js        body=#!
oh.mifune.dev/get-agro.sh   302 -> agro.mifune.dev/get-agro.sh  body=#!
oh.mifune.dev/agro.js       302 -> agro.mifune.dev/agro.js      body=#!
agro.mifune.dev  same five paths                           body=#!
oh.mifune.dev/docs/quickstart  301 -> canonical, follows to 200
```

`/get-agro.sh` and `/agro.js` did not exist as endpoints before this work. A clean
`node:22-slim` container installs `oh 0.9.0` through the legacy host and
`agro 0.9.0` through the canonical host, each in one piped command.

**Cost.** 8 commits on the core branch, `netAdded` 2105 lines across ~100 files,
two docs-site PRs, 8 bounded worker dispatches with 4 repair rounds. Most of the
line count is mechanical name substitution, which is the point of the phase.

**Measured:** the pipeline-break risk is gone (both-ref builds exit 0); the mirror
gap shrinks from a day to a dispatch. **Claimed, unmeasured:** that the AGRO name
reads more clearly to a new user.

## 1. What the plan asked for

Phase 3 of the compatibility migration: AGRO becomes the canonical external
identity. Rename both repositories in place, teach the docs pipeline the `.agro/`
source contract *before* any rename, make `agro.mifune.dev` canonical, put AGRO
names in release metadata and add a release dispatch, and keep every
`oh.mifune.dev` entry URL shell-safe. Retire nothing. External actions stay with
the operator.

## 2. What was built

| Story | Artifact | Observed |
|---|---|---|
| US-001 web pipeline accepts `.agro/` | agro-web#46, merged `4f26a55` | build exit 0 against `development` (`.agro/` path) and `main` (`.oh/` fallback); `agro.js`/`oh.js` byte-identical; drift PASS |
| US-002 core names AGRO | `03c3d69b` | `pnpm test` 1246 passed; both typechecks 0; `link-providers.sh --check` 0; 8 probes 0; `reference-classification.md` covers every remaining old-name hit |
| US-003 release infra | `4d80868b` | 39 release tests pass; YAML validates; whitespace pair scan clean; `notify-docs` passes the secret only through `env:` and skips with `::notice::` |
| US-004 docs-site identity | agro-web#47, merged `409ef104` | build exit 0; drift PASS; `build/CNAME` = `agro.mifune.dev`; sitemap 66 agro / 0 legacy; deployed site serves `<title>AGRO` and a matching `CNAME` |
| US-005 runbook | `4db24429` | `ste-check.sh` 0; linked from the compatibility doc and the docs index; `curl-bash-safe-alternatives` 0 |
| US-006 operator cutover | `cutover-record.md`, `0b58c0a7`, `892f1413` | renames, metadata, defaults, Pages domain, installer references, and the three Cloudflare redirect rules all done and verified; only the dispatch token is deferred |
| US-007 knowledge and changelog | `143cd6b8` through `75efbf59` | `knowledge-impact.sh --verified` 0 needing review; wiki probes 0; `changelog-entry-length` 0 |

### Advisory remediation (operator-authorized, outside the #943 plan)

| Change | Commit | Verified |
|---|---|---|
| vitest bumped to ^4.1.11 | `a2c39ed0` | audit clean; suite, both typechecks, lint green |
| `.agro/scripts/agro-cutover-domain.sh` removed | `a2c39ed0` | blocking simplicity finding; 393 lines, no caller, no test, no reference |
| `security:audit` made CI-only, `pnpm:devPreinstall` removed | `189ba5a6` | install no longer queries the feed; both workflow gates intact and unweakened |
| Legacy upgrade fixture rebuilt | `b0fa4a76` | owner re-ran the smoke end to end: PASS, exit 0 |
| Audit-wiring contract folded into one probe | `b6f7d7c6` | owner injected a `prepare` hook the original probe never covered: 1 injected, 0 restored |
| Process-spawning rehearsal tests given explicit timeouts | `8f142cfa` | assertions unchanged, no retry, no global default touched |

Three CI rounds, three distinct real causes: the advisory failing every install,
an existing probe pinning the very hook the operator authorized removing, and a
test spawning `docker compose` under the 5000 ms default while its own setup
already allowed 180 s. None was masked.

### Cutover performed (US-006 partial)

Under the operator's explicit in-session authorization ("Authorize me for the gh
steps"), recorded in `progress.txt` before the first action:

| Step | Result |
|---|---|
| 1 record before-state | matched the runbook's expected values exactly |
| merge agro-web#46 | `4f26a55`; `pages.yml` on `main` completed success |
| 2 rename core | `R_kgDORyBFdg` → `mifunedev/agro`, id unchanged |
| 3 rename web | `R_kgDOTHLFeQ` → `mifunedev/agro-web`, id unchanged |
| 4 metadata | both `homepageUrl` = `https://agro.mifune.dev`; topics added, existing kept |
| 7b `AGRO_WEB_REPO` | set to `mifunedev/agro-web` |
| 8 origin remotes | root and web clone updated; the guard left forks alone |
| — retarget #47 | base `main`, MERGEABLE |

Old URLs still resolve: `git ls-remote` works on both old names and
`gh repo view mifunedev/openharness` returns `mifunedev/agro`. The GHCR package
`mifunedev/agro` is public. A `workflow_dispatch` of `pages.yml` stands in for the
release dispatch and completed success (run 34184320927); it is labelled a stand-in
because no release was due.

### Actual Knowledge Impact

| Page | State |
|---|---|
| release-versioning | UPDATED — the chain now ends `notify-docs`; the omission that a release did not refresh the mirror is repaired |
| fresh-machine-setup | UPDATED — installer defaults and both entry points |
| oh-cli-portable-lifecycle | UPDATED — package metadata, then re-pinned after the CLI default flip |
| compose-env-boundary | REVERIFIED — only the image source label moved |
| managed-agents | REVERIFIED — link text only |
| plan-vs-built-reconciliation | REVERIFIED — `--repo` default text only |
| agro-web-pipeline | NEW `kind: repo` — the docs-site source contract |
| pattern-evals-tracked-only-scan-misses-uncommitted | UPDATED — gained this run's occurrence |
| pattern-wiki-frontmatter-edit-without-reindex | NEW `kind: pattern` |
| every other `kind: pattern` page | NOT-AFFECTED — provenance is immutable |

## 3. Where they diverged, and why

- **US-004 banner assets.** The criterion asked for regenerated banner assets. The
  only recipe belongs to a historical promo that must not change, and no
  current-default recipe exists, so no asset was regenerated. The renderer's
  product literals do read AGRO.
- **US-003 image order.** The worker first satisfied the agro-first order with a
  workflow `env` override. Rejected: the script default at
  `promote-release-latest.sh:89` was flipped instead, so one source of truth
  remains.
- **Token scope.** The PRD specified `actions: write`. `repository_dispatch`
  requires `contents: write`; the docs state the real requirement.
- **US-006 sequencing.** The runbook's Pages step (5) and Cloudflare step (6) must
  run back to back: switching the Pages custom domain away from `oh.mifune.dev`
  makes Pages stop answering for that host, and only the Cloudflare rules restore
  the executable paths. Step 6 needs zone credentials that are not in the sandbox,
  so step 5 was deliberately **not** performed. Performing it alone would have
  broken the very endpoints this phase promises to keep.
- **US-007 ordering.** The knowledge work ran before US-006 rather than after,
  because the pages describe repository state at HEAD. `oh-cli-portable-lifecycle`
  was re-pinned after the default flip.
- **Advisor exception.** The plan assigned the external actions to the operator.
  The operator authorized the GitHub-side subset in session; that authorization and
  its scope are recorded in `progress.txt` before the first action.

## 4. What remains unverified

- **The published 0.9.0 image and volumes already seeded from it remain broken.**
  Advisory GHSA-82fw-gwwq-j7x9 (published 2026-09-08T20:46:45Z) covers vitest
  >=2.1.0 <4.1.11. That image's seeded `/opt/oh-seed/package.json` pins vitest
  ^3.2.6 and wired `pnpm:devPreinstall` to `security:audit`, so its entrypoint's
  `pnpm install` fails and boot aborts. Reproduced inside the released image; log
  at `legacy-boot-install.log`. **Nothing in this branch repairs that image or
  those volumes.** The remediation below prevents recurrence and restores the
  fixture; it does not reach already-published artifacts.
- **Existing users are affected differently from the fixture.** A workspace volume
  whose `node_modules` is absent cannot boot on the released image. A user whose
  checkout can be updated recovers once the source pins a patched vitest; a user
  relying on the image's seeded manifest does not, because that copy is immutable.
  Remediating the CI fixture and recovering existing users are separate problems
  and neither is solved by editing the hook alone.
- **The release dispatch is configured but not yet exercised.** The operator has
  stored `AGRO_WEB_DISPATCH_TOKEN` on `mifunedev/agro`, and `AGRO_WEB_REPO` is set
  to `mifunedev/agro-web`. The docs site accepts the `agro-release` event on live
  `main` (`409ef10`), and a manual `workflow_dispatch` of `pages.yml` completed
  successfully, which proves the receiving workflow is healthy. **The token's
  authorization is still unproven**: confirming it requires calling the dispatch
  endpoint with the secret's value, which the advisor does not read. It is proven
  on the next real release, when `notify-docs` runs instead of printing its skip
  notice and a `repository_dispatch` run appears on the docs site.
- **The `/install.sh` redirect target is on a deadline.** The `oh.mifune.dev`
  Redirect Rule and the `oh-redirect` Worker that serves the canonical host both
  name `.oh/scripts/install.sh` on `main`, which exists only because `main`
  predates the directory rename. The first release that carries the rename deletes
  that path, so **both** must move to the `.agro/` path in the same change window,
  never earlier. Recorded in the compatibility doc and runbook step 6.
- **A short-lived Cloudflare token was pasted into the session transcript** by the
  operator before the file-based hand-off could be used. The advisor deleted its
  local copy immediately after applying the rules and asked the operator to revoke
  it. Revocation is not verifiable from here.
- **The Cloudflare rulesets payload in the runbook was written from the API shape,
  not exercised against the live zone.** The existing `/install.sh` redirect
  mechanism (Worker or older rule) is still a placeholder the operator identifies.
  `/install.sh` currently redirects to the raw `.oh/scripts/install.sh` path on the
  old repository name and works only because GitHub redirects renamed repositories.
- **SIMPLICITY-RESIDUAL.** Six non-blocking findings at `a18e421a`, recorded in
  `simplicity-review.json`, none actioned. The owner's judgment on each:
  findings 3 and 4 (drop the Cloudflare dashboard table; drop the
  `vars.AGRO_WEB_REPO` indirection) are declined because the dashboard table and
  the API payload are two execution paths for an operator who may have only one,
  and the repository variable is written into an approved acceptance criterion and
  is already set in production. Findings 1, 2 and 6 are duplication that approved
  acceptance criteria require in both places. Finding 5 is the strongest: the
  release test does pin YAML prose, but the two assertions that matter guard
  against printing a secret, so they stay. A reviewer may disagree with any of
  these; none blocks.
- **Pre-existing red carried forward:** `skills-vendored`, delta unchanged, caused
  by the `cc-safety-net` binary being absent in this sandbox rather than by the
  diff. Eval runner exit 0.
- **One transient failure was not diagnosed.** A `pnpm test` run at `03c3d69b`
  reported three failures that did not reproduce on a clean rerun; the failing file
  names were not captured.
- **`/audit implementation` will fail gate 1 by design** while US-006 is open, since
  the gate reads unfinished stories from `prd.json`. The remaining gates were run
  individually and are recorded above.
- **A worker used a bare `git stash`** against its dispatch record. The tree was
  verified intact afterwards, but `stash@{0}` (`279b74a2`) is redundant and still
  present; the safety net blocks dropping it from this session.

## Artifact index

| Artifact | What it carries |
|---|---|
| `cutover-record.md` | The before-state, every action performed, and the post-cutover verification matrix |
| `reference-classification.md` | Every remaining `mifunedev/openharness` and `oh.mifune.dev` hit, classified historical, compatibility, test-fixture, generic, or flipped |
| `probe-fault-injection.md` | Per repinned probe: the injected change, the red exit it produced, and the restored exit |
| `eval-result.json` | The probe floor keyed to `9a7de4f7`, runner exit 0 |
| `simplicity-review.json` | Six non-blocking findings at `a18e421a` from a read-only reviewer |
| `simplify-rounds.json` | Round 1, `netAdded` 2105, not non-reducing |
| `delegate-graph.json`, `delegate-log.txt` | The nine bounded worker dispatches, their acceptance decisions, and the verification commands behind each |
| `progress.txt` | The per-story narrative, the recorded operator authorization, and the cold-boot escalation |
| `legacy-boot-install.log` | The captured `pnpm install` failure reproduced inside `ghcr.io/mifunedev/openharness:0.9.0` |
| `cloudflare-rules.json`, `cloudflare-rules.README.md` | The exact runbook step 6 payload and how to apply, verify, and time it |

Web pull requests: mifunedev/agro-web#46 (merged, `4f26a55`) and mifunedev/agro-web#47
(merged, `409ef104`). #47 was merged once the Pages domain was live, because `main`
still carried `static/CNAME` = `oh.mifune.dev` and the next scheduled build would
have deployed it and reverted the operator's domain change.
