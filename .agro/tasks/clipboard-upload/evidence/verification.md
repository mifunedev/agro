# US-005 verification

## Documentation-reference tests

All commands ran on the host through the task bundle, against the existing sandbox.
The first command used the wrong filter relative to the repository configuration:

```bash
node .agro/cli/dist/agro.js run --sandbox clipboard-review-1612 -- sh -lc 'cd /home/sandbox/harness/.agro/cli && npx vitest run src/__tests__/docs-reference.test.ts'
```

Exit 1: "No test files found, exiting with code 1".

The corrected repository-root filter selected all four tests:

```bash
node .agro/cli/dist/agro.js run --sandbox clipboard-review-1612 -- sh -lc 'cd /home/sandbox/harness && npx vitest run .agro/cli/src/__tests__/docs-reference.test.ts'
```

Exit 1: three tests passed; the runtime-path test reported ten existing ignored paths as missing.
The sandbox cannot resolve the linked worktree's host-side `.git` pointer.
The test uses `git check-ignore` to distinguish absent runtime paths from broken documentation.
Affected paths were `.devcontainer/.env`, `.agro/.image-seeded`, `.pi/tasks/`,
`.claude/settings.local.json`, and `.pi/bridge/`.
No clipboard path or anchor failed.

The final run used temporary bare Git metadata with the mounted checkout as its work tree.
This enabled `git check-ignore` to read the real checkout's ignore rules without changing tracked files.
The temporary metadata contained no commits or copied credentials.

```bash
node .agro/cli/dist/agro.js run --sandbox clipboard-review-1612 -- sh -lc 'test ! -e /tmp/clipboard-us005-git && git init --bare --quiet /tmp/clipboard-us005-git && cd /home/sandbox/harness && GIT_DIR=/tmp/clipboard-us005-git GIT_WORK_TREE=/home/sandbox/harness npx vitest run .agro/cli/src/__tests__/docs-reference.test.ts'
```

Exit 0: one test file passed; all four tests passed.
The worker removed `/tmp/clipboard-us005-git` after verification.
The advisor still owns clean-main acceptance and exact-head CI.

## STE

The worker extracted added lines from `git diff --unified=0` into a temporary Markdown file.
The extraction preserved code fences and did not alter tracked prose.

```bash
bash .agro/skills/ste/scripts/ste-check.sh /tmp/clipboard-us005-changed.md
bash .agro/skills/ste/scripts/ste-check.sh .agro/tasks/clipboard-upload/evidence/manual-review.md .agro/tasks/clipboard-upload/evidence/verification.md
```

Changed documentation prose: exit 0, no findings.
Evidence prose: exit 0, no findings.
The worker also reviewed conditions, actors, execution locations, and ambiguous references manually.

The full existing documents retain 15 baseline findings:

```bash
bash .agro/skills/ste/scripts/ste-check.sh .agro/cli/README.md docs/lifecycle-commands.md docs/connecting.md docs/security-considerations.md
```

Exit 1. The exact final findings follow:

```text
.agro/cli/README.md:17: VAGUE name the object of the verb instead of a pronoun
.agro/cli/README.md:23: VAGUE name the object of the verb instead of a pronoun
.agro/cli/README.md:63: VAGUE start the sentence with a named subject, not a bare pronoun
.agro/cli/README.md:87: VAGUE start the sentence with a named subject, not a bare pronoun
.agro/cli/README.md:89: PASSIVE rewrite in the active voice with a named actor
.agro/cli/README.md:97: PASSIVE rewrite in the active voice with a named actor
.agro/cli/README.md:98: LONG split this sentence: 47 words, cap is 25
.agro/cli/README.md:100: PASSIVE rewrite in the active voice with a named actor
.agro/cli/README.md:103: VAGUE name the object of the verb instead of a pronoun
.agro/cli/README.md:107: VAGUE start the sentence with a named subject, not a bare pronoun
.agro/cli/README.md:107: PASSIVE rewrite in the active voice with a named actor
.agro/cli/README.md:113: VAGUE start the sentence with a named subject, not a bare pronoun
.agro/cli/README.md:135: VAGUE start the sentence with a named subject, not a bare pronoun
docs/lifecycle-commands.md:730: PASSIVE rewrite in the active voice with a named actor
docs/connecting.md:175: PASSIVE rewrite in the active voice with a named actor
```

An independent scan of the four `HEAD` versions also exited 1 with the same 15 findings.
README baseline lines 112 and 134 moved to 113 and 135.
Lifecycle baseline line 670 moved to 730. Connecting baseline line 142 moved to 175.
No new or changed prose retains a finding.
The worker left unrelated prose unchanged.

## Other checks

- `git diff --check`: exit 0.
- Changelog entry: one Unreleased Added sentence, below 250 characters, linked to issue 1612.
- Browser assertions and diagnostics: see [manual review](manual-review.md).
- Screenshot review: all three images contain readable labels and no token.
- Scope review: only the five assigned documents and task evidence changed.
- Cleanup: the worker removed all owned service, relay, fixture, browser, temporary-home, request, input, helper, and test-metadata resources.
- No production source, tracker, PR, sandbox lifecycle, or unrelated listener changed.
- No push occurred. Operator shipping confirmation and advisor acceptance remain pending.
