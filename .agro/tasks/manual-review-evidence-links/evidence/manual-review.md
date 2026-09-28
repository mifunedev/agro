# US-006 manual review evidence

Each run below comes from the worktree of branch `wk/1239-us006`, in the sandbox.
This file trims each output to the lines that matter. Each exit status comes from the run.

## 1. Probe

```text
$ bash .agro/evals/probes/pr-manual-review.sh
PASS: PR template, /git gate, and reference hold the ## Manual review standard
exit=0
```

Red case. The run copies the repository root with `git archive HEAD` into a
`mktemp -d` directory under the session scratchpad. The run appends a
`### Visual Reference` line to the copy of `.github/ISSUE_TEMPLATE/feat.md`.

```text
$ T=$(mktemp -d -p "$SCRATCH" red.XXXX)
$ git archive HEAD | tar -x -C "$T"
$ printf '\n### Visual Reference\n\n<!-- Screenshots -->\n' >> "$T/.github/ISSUE_TEMPLATE/feat.md"
$ AGRO_PROBE_ROOT="$T" bash .agro/evals/probes/pr-manual-review.sh
REGRESSION: manual review PR section contract broken: feat.md has no ### Visual Reference
exit=1
$ rm -rf "$T"
exit=0
```

## 2. Check tests

```text
$ bash .agro/skills/git/scripts/tests/manual-review-check.test.sh
ok: branch ref fails
ok: SHA ref passes
ok: screenshot without callout text fails
ok: process substitution body passes
ok: pass shape passes
ok: branch-pinned shape fails
ok: shape without callouts fails
exit=0
```

## 3. Check fixtures

```text
$ bash .agro/skills/git/scripts/manual-review-check.sh .agro/skills/git/scripts/tests/fixtures/pass-body.md
exit=0

$ bash .agro/skills/git/scripts/manual-review-check.sh .agro/skills/git/scripts/tests/fixtures/fail-branch-ref-body.md
manual-review-check: line 6: ref "bug/1-example/.agro/tasks/example/evidence/step-01.png" does not start with a 40-character SHA:    <img src="https://github.com/example-org/example-repo/blob/bug/1-example/.agro/tasks/example/evidence/step-01.png?raw=true" width="720" alt="Home page shows Ready">
exit=1

$ bash .agro/skills/git/scripts/manual-review-check.sh .agro/skills/git/scripts/tests/fixtures/fail-no-callouts-body.md
manual-review-check: step has a screenshot and no Callouts: line: 1. Open the home page. Expected: the header shows "Ready".
exit=1
```

## 4. Annotation tests

```text
$ bash .agro/skills/agent-browser/scripts/tests/annotate-screenshot.test.sh
ok: two selectors exit 0
ok: PNG exists and is non-empty
ok: stdout has the Callouts line
ok: DOM holds no callout after the run
ok: missing selector exits 1
ok: error names the missing selector
ok: missing selector writes no PNG
ok: DOM clean after the missing-selector run
ok: no selector exits 2
ok: selector without label exits 2
exit=0
```

## 5. Annotated fixture screenshot

The run serves the fixture page from the named tmux session `us006-fixture`.
agent-browser 0.8.5 opens the page in the session `us006`.

```text
$ tmux new-session -d -s us006-fixture "cd .agro/skills/agent-browser/scripts/tests/fixtures && python3 -m http.server 18731 --bind 127.0.0.1"
$ curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18731/page.html
200
$ AGENT_BROWSER_SESSION=us006 agent-browser open http://127.0.0.1:18731/page.html
✓ Annotate fixture
exit=0
$ AGENT_BROWSER_SESSION=us006 bash .agro/skills/agent-browser/scripts/annotate-screenshot.sh "$PWD/.agro/tasks/manual-review-evidence-links/evidence/annotate-fixture.png" '#title=the card title' '#status=the Baseline time'
Callouts: 1 is the card title. 2 is the Baseline time.
exit=0
$ AGENT_BROWSER_SESSION=us006 agent-browser close
✓ Browser closed
exit=0
$ tmux kill-session -t us006-fixture
exit=0
$ tmux has-session -t us006-fixture
exit=1
$ curl -s -o /dev/null http://127.0.0.1:18731/page.html
exit=7
```

The screenshot is `annotate-fixture.png` in this folder.

## 6. STE check

```text
$ bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/agent-browser/SKILL.md .agro/skills/git/SKILL.md .agro/skills/git/references/manual-review.md
ste-check: no findings in 3 file(s).
exit=0
```

## 7. Repair of mifunedev/agro-console#185 and #197

mifunedev/agro-console is a private repository. This file records counts only
and no body text.

| Command | #185 | #197 |
|---|---|---|
| `gh pr view N -R mifunedev/agro-console --json body -q .body \| grep -cE 'blob/(feat\|bug)/'` | 0 | 0 |
| `bash .agro/skills/git/scripts/manual-review-check.sh <(gh pr view N -R mifunedev/agro-console --json body -q .body) \| grep -c 'SHA'` | 0 | 0 |
| `gh pr view N -R mifunedev/agro-console --json body -q .body \| grep -cE 'blob/[0-9a-f]{40}/'` | 32 | 3 |
| `manual-review-check.sh` findings with `no Callouts: line` | 13 of 13 | 2 of 2 |
| `manual-review-check.sh` exit status | 1 | 1 |

`grep -c` exits 1 when the count is 0. The link check of each repaired body
finds no branch ref. The check exits 1 on each body because each finding is a
screenshot step with no `Callouts:` line. The PRD puts new annotations for #197
out of scope.

Deviation. US-006 asks for one screenshot each of the repaired #185 and #197
bodies. This repository is public, and the #185 and #197 pages are private.
The evidence folder holds no screenshot of those pages. The counts above
replace those screenshots.

## Manual review

**A. The PR body check**

Prerequisites: a checkout of the AGRO harness. Runs in the sandbox, local.

1. Run the probe:

   ```bash
   bash .agro/evals/probes/pr-manual-review.sh
   ```

   Expected output: `PASS: PR template, /git gate, and reference hold the ## Manual review standard`. Expected exit status: 0.

2. Run the check on the pass fixture:

   ```bash
   bash .agro/skills/git/scripts/manual-review-check.sh .agro/skills/git/scripts/tests/fixtures/pass-body.md
   ```

   Expected output: none. Expected exit status: 0.

3. Failure path. Run the check on the branch-ref fixture:

   ```bash
   bash .agro/skills/git/scripts/manual-review-check.sh .agro/skills/git/scripts/tests/fixtures/fail-branch-ref-body.md
   ```

   Expected output starts with `manual-review-check: line 6: ref "bug/1-example/.agro/tasks/example/evidence/step-01.png" does not start with a 40-character SHA`. Expected exit status: 1.

4. Failure path. Run the check on the fixture with no callouts:

   ```bash
   bash .agro/skills/git/scripts/manual-review-check.sh .agro/skills/git/scripts/tests/fixtures/fail-no-callouts-body.md
   ```

   Expected output: `manual-review-check: step has a screenshot and no Callouts: line: 1. Open the home page. Expected: the header shows "Ready".`. Expected exit status: 1.

**B. The annotated screenshot**

1. Open `annotate-fixture.png`. Expected: callout 1 marks "Recovery point", and
   callout 2 marks "Baseline 12:04".
   <details><summary>Screenshot</summary>

   <img src="https://github.com/mifunedev/agro/blob/<commit-sha>/.agro/tasks/manual-review-evidence-links/evidence/annotate-fixture.png?raw=true" width="720" alt="Fixture card with two numbered callouts">
   </details>
   Callouts: 1 is the card title. 2 is the Baseline time.

**C. Cleanup**

1. No step in A or B creates a resource.
