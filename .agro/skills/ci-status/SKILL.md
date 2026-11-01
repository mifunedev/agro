---
name: ci-status
description: |
  Check the CI pipeline status for the current branch after pushing changes.
  Reports exactly one of PASS, FAIL, NO-RUN, or TIMEOUT, with failure details,
  and makes no edit. Use this after every push to confirm your changes are
  truly done — CI must be green.
  TRIGGER when: after git push, after committing changes, when asked to check CI,
  or when verifying that work is complete.
---

# CI Status

`/ci-status` reads CI state and reports exactly one result: PASS, FAIL, NO-RUN,
or TIMEOUT. `/ci-status` makes no edit and stops after the report.
[`/delegate` § Acceptance](../delegate/SKILL.md#acceptance) owns the repair.

## Instructions

1. **Identify the current branch, commit, and target repo:**

```bash
BRANCH=$(git branch --show-current)
SHA=$(git rev-parse --short HEAD)
echo "Branch: $BRANCH | Commit: $SHA"

# Set REPO_OVERRIDE=owner/name to target another fork; otherwise use the checkout's origin.
if [ -n "$REPO_OVERRIDE" ]; then
  case "$REPO_OVERRIDE" in
    */*) REPO="$REPO_OVERRIDE" ;;
    *) echo "ERROR: --repo must be owner/name format (got '$REPO_OVERRIDE')"; exit 1 ;;
  esac
else
  REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
fi
[ -n "$REPO" ] || { echo "ERROR: could not derive repo — is gh authenticated? Try: gh auth login"; exit 1; }
echo "Repo: $REPO"
```

2. **Prefer an open PR's checks (PR-first path):**

With stacked PRs on one head branch, `/ci-status` uses the most recent PR. No open PR routes to steps 3 and 4.

```bash
PR_NUMBER=$(gh pr list --head "$BRANCH" --state open --repo "$REPO" \
  --json number --jq '.[0].number')

if [ -n "$PR_NUMBER" ]; then
  echo "Open PR found: #$PR_NUMBER — waiting for PR checks"
  timeout 900 gh pr checks "$PR_NUMBER" --repo "$REPO" --watch
  echo "rc=$?"
else
  echo "No open PR for branch $BRANCH — using branch-runs fallback"
fi
```

When `gh pr checks` prints no rows, run the command below:

```bash
gh pr view "$PR_NUMBER" --repo "$REPO" --json mergeable --jq .mergeable
```

When the command prints `CONFLICTING`, report NO-RUN with this cause: the PR
conflicts with its base branch, and GitHub runs no `pull_request` workflow
until the author merges the base branch. For any other value, report NO-RUN.

Otherwise, exit code 0
reports PASS, exit code 124 reports TIMEOUT, and another nonzero exit code
reports FAIL. On FAIL, take `RUN_ID` from the failing check link and go to
step 5.

3. **No-PR fallback: find the latest CI run for this branch:**

```bash
gh api "repos/$REPO/actions/runs?branch=$BRANCH&per_page=1" \
  --jq '.workflow_runs[0] | {id: .id, status: .status, conclusion: .conclusion, head_sha: .head_sha[:7], name: .name}'
```

When the query returns no run, report NO-RUN.

4. **Wait for the run, at most 900 seconds:**

```bash
RUN_ID=<id from step 3>
timeout 900 gh run watch "$RUN_ID" --repo "$REPO" --exit-status
echo "rc=$?"
```

Exit code 0 reports PASS. Exit code 124 reports TIMEOUT. Another nonzero exit
code reports FAIL.

5. **On FAIL, get the failure details:**

```bash
# Get the failed job ID
JOB_ID=$(gh api "repos/$REPO/actions/runs/$RUN_ID/jobs" \
  --jq '.jobs[] | select(.conclusion == "failure") | .id')

# Get the failure context (15 lines before the error)
gh api "repos/$REPO/actions/jobs/$JOB_ID/logs" 2>&1 \
  | grep -B 15 "Process completed with exit code" | head -25
```

6. **Report exactly one result:**

- **PASS**: Report "CI green" with the run URL.
- **FAIL**: Report the failing step and the error message.
- **TIMEOUT**: The wait reached 900 seconds with a check still pending. Report the pending checks.
- **NO-RUN**: No workflow's `on:` filter matched the push, or `PR_NUMBER` was set but `gh pr checks` returned no rows (the PR exists but no workflows were triggered yet). When `mergeable` is `CONFLICTING`, the cause is a merge conflict with the base branch. *(Note: the workflow names below reflect this harness's layout and may differ in other checkouts.)*
  - `ci-harness.yml` — `.agro/**`, `docs/**`, `.devcontainer/**`, `package.json`, `pnpm-lock.yaml`, itself
  - `sandbox-boot-guard.yml` — `.devcontainer/**`, `.agro/cli/**` except `__tests__/**` and `*.md`, the boot-path scripts `docker-compose.sh`, `check-host-port.sh`, `paths.sh`, `provision-python.sh`, `sandbox-healthcheck.sh`, `sandbox-boot-smoke.sh`, `sandbox-upgrade-smoke.sh`, `cli-first-install-smoke.sh`, `verify-sandbox-image.sh`, `install.sh`, and `link-providers.sh` in `.agro/scripts/`, `.agro/install/**`, `agro.json`, `.example.env`, `.dockerignore`, itself
  - `release.yml` — every push to `main` or `master`; validation precedes automatic release publication

  Diagnose with: `git diff --name-only HEAD~1 HEAD` and compare against each workflow's `on:` block.

## CI Pipeline Steps

This project's CI (`CI: Harness`) runs these steps in order:

1. Security audit (`pnpm run security:audit`)
2. Install (`pnpm install --frozen-lockfile`)
3. Typecheck (`pnpm run typecheck`)
4. Build (`pnpm run build:harness`)
5. Test (`pnpm test:scripts`)

Sibling job: Boot Path Lint (shellcheck + hadolint).

Run the checks locally before pushing: `pnpm run typecheck && pnpm run build:harness && pnpm test`.
