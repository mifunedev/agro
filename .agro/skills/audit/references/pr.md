# Audit one pull request

Validate a positive PR number, optional `--repo owner/name`, and optional non-empty `--base branch` before starting. Resolve an omitted repository once with `gh repo view --json nameWithOwner -q .nameWithOwner` from `AUDIT_ROOT`. The expected base defaults to `development`; for a stacked PR pass its parent branch explicitly with `--base`. Acquire with `$AUDIT_ROOT/.agro/skills/audit/scripts/pr-acquire.sh pr --repo "$REPO" --pr "$N" --base "$BASE"`, then pipe the schema-versioned envelope to `$AUDIT_ROOT/.agro/skills/audit/scripts/pr-classify.sh`. Acquisition failure or incomplete evidence is unknown; never infer readiness. The scripted driver (`scripts/route-driver.sh`) performs this acquisition and classification and maps the result to the verdict tokens below.

Render one compact evidence table from classifier JSON: number, CI, mergeability, clean state, review decision, primary state, flags, and the distinct `readyForReview`/`readyToMerge` booleans. Do not re-derive fields.

Emit `PR-AUDIT-PROMOTABLE` iff `.promotable == true && .evidenceComplete == true`; emit `PR-AUDIT-BLOCKED` for complete non-promotable evidence; otherwise emit `PR-AUDIT-UNKNOWN`.

**A route that could not run did not classify anything.** When the installed `gh` cannot answer the query at all — no `gh` before 2.101.0 carries `closingIssuesReferences` — `pr-acquire.sh` exits `69` with a `TOOLING-BLOCKED:` line naming the field and the required version, and the driver emits `PR-AUDIT-TOOLING-BLOCKED`. That verdict is not a pass and never authorizes an undraft or a merge; it says the environment, not the pull request, is the problem. Reporting a tooling gap as `PR-AUDIT-BLOCKED` sends a reviewer to look for a defect that is not there.

This route writes no repository file. When the caller is an orchestrating workflow that must leave the reviewer proof in the PR (e.g. the advisor at `/git` § Ready for review), it — not this route — records the returned observations in the **PR body** per [`reviewer-evidence-doc.md`](reviewer-evidence-doc.md).

`--deep` may add bounded root-cause evidence for this PR but cannot alter classification. Diff correctness is outside audit scope. `--proof` is the sole focused write: preview the exact idempotent `<!-- pr-audit-proof -->` comment and require confirmation; `--dry-run` writes nothing. Re-acquire and classify immediately before a confirmed write, tagged `freshPreAction: true`. Never call `gh pr ready` or merge.
