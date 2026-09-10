---
title: "A tree-wide path sweep can re-indent one line inside a YAML block scalar and invalidate the workflow"
slug: pattern-rename-sweep-collapses-block-scalar-indent
kind: pattern
tags: [rename, yaml, workflows, github-actions, sweep, sed, perl, startup-failure, diff-review]
created: 2026-09-07
updated: 2026-09-07
sources:
  - .github/workflows/close-issues-on-development.yml@c2aae7c9
  - .github/workflows/close-issues-on-development.yml@6d2891f1
  - .agro/tasks/agro-namespace-cutover/evidence.md@4bd16f74
confidence: confirmed
---

# A tree-wide path sweep can re-indent one line inside a YAML block scalar and invalidate the workflow

## Relevant Source Files
- `.github/workflows/close-issues-on-development.yml@c2aae7c9` — the file as the rename left it, with one line of a `script: |` block moved to column 7.
- `.github/workflows/close-issues-on-development.yml@6d2891f1` — the repair, restoring the line to the block's own indentation.
- `.agro/tasks/agro-namespace-cutover/evidence.md@4bd16f74` — the whole-diff scan that proved this was the only damaged site.

## Summary
A search-and-replace across hundreds of files can rewrite a line's leading
whitespace as well as its content. Inside a YAML block scalar a line indented
less than the block terminates the scalar, so the mapping that follows sees
garbage and the workflow file becomes invalid. The damage is invisible in
review, because the changed token on the line is exactly the intended one.

## Detail
**Symptom.** Every push to the branch produced a red run of one workflow with no
jobs, no steps, and no log: `gh run view` said only "This run likely failed
because of a workflow file issue," and `gh run list` attributed the run to
`push` even though the workflow's only trigger was `pull_request`. The three real
CI workflows passed, and `gh pr checks` did not list the failure, so nothing in
the pull request's own status pointed at it.

**Root cause.** The rename rewrote `".oh",` to `".agro",` on a line inside a
`script: |` block. The replacement was correct; the line's twelve leading spaces
became six. YAML ends a block scalar at the first line indented less than the
block, so the parser then read `".agro",` as a mapping key. The file parsed as
valid YAML text in a naive check and as an invalid workflow at GitHub.

**Workaround.** After any tree-wide sweep, scan the diff for lines whose leading
whitespace changed, not just whose content did. Pair each removed line with the
added line at the same position within a hunk and compare the whitespace prefix:

```bash
git diff -U0 <base>..HEAD | node -e '<pair - and + lines per hunk; report pairs whose /^\s*/ differs>'
```

On a 620-file rename this reported exactly one pair, which was the defect. A
plain grep for the renamed token cannot find it, and a YAML well-formedness
check does not either — only the indentation comparison does. Treat a
zero-duration workflow run with no jobs as a parse failure of that file, and
diff the file against its pre-sweep revision before looking anywhere else.
