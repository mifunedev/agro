FROM bug/1150-secret-guard-false-allows TO development

Closes #1150

## Stories

- [x] US-001: Deny jq access to the process environment
- [x] US-002: Deny a quoted json format in container inspect

## What the issue asked for

The Bash secret guard (`.agro/hooks/deny-env-dump.sh`) allowed two commands that print secrets:

- A `jq` filter that reads the process environment, such as `jq -n 'env'` or `jq -n '$ENV'`.
- `docker inspect` with a single-quoted `json` format, such as `--format 'json'`, which prints `Config.Env`.

## What was built

- US-001: The guard denies a `jq` filter that contains `$ENV` or a bare `env` word, including single-field reads such as `env.HOME` and `$ENV.GH_TOKEN`. The check reads only the filter argument that the existing `JQ_CALL` parse finds, so `jq '.env' file` and `jq '.x' env.json` stay allowed.
- US-002: The `DOCKER_FMT_UNSAFE` `json` term now matches single and double quotes. The old class `["\x27]` sat in a single-quoted bash string, so `grep -E` read it as literal characters. `--format 'json'`, `-f 'json'`, and `--format='json'` are denied. Narrow `--format` templates stay allowed.
- `CHANGELOG.md` `[Unreleased]` `### Fixed` has one entry that links #1150.

## Where it diverged

- The plan says to use the filter from the `mask_jq_filters` parse. The change adds `jq_filters`, which uses the same `JQ_CALL` and `JQ_PATH_FLAG` patterns and also stops at `--arg`, `--argjson`, `--slurpfile`, `--rawfile`, and `--indent`. When the parse finds no filter, the check reads the rest of the command after `jq`. This is deny on doubt, as the plan says.

## What remains unverified

- The Codex wrapper `.codex/hooks/deny-env-dump.sh` was not run. It calls the shared hook without change.
- CI did not run. The branch is not pushed.
- The red-before-green probe runs against the unchanged hook were not recorded in this commit.
- Known false deny from the fallback path: a command that contains the word `jq` followed later by the word `env` in ordinary text is denied. Example: a `git commit -m` message that names both words. This PR hit it while committing. Issue #1155 tracks the guard reading ordinary argument text.

## Verification

```
$ bash .agro/evals/probes/secret-exposure-guard.sh; echo exit=$?
PASS: the secret-exposure guard denies shell-hist access by command position and hist-file reads, allows the word inside ordinary arguments, exempts the jq filter from the secret-path check, and still denies env-file reads and jq filters that read the process environment
exit=0

$ bash .agro/evals/probes/docker-inspect-env-guard.sh; echo exit=$?
PASS: container inspect is denied for env-exposing shapes and allowed for narrow --format field reads; deny-list mirrors the env patterns without blanket-blocking inspect
exit=0

$ bash .agro/evals/probes/changelog-entry-length.sh
PASS: all [Unreleased] changelog entries are at most 250 characters

$ bash .claude/skills/eval/run.sh
next-dev-prod                    REGRESSION  unchanged
skills-vendored                  REGRESSION  unchanged
```

Both regressions are unchanged from the base and come from sandbox state (a running `next dev` process and the provider layout). No new red.

## Lessons

- The guard allows an environment dump through a script interpreter (`python3 -c` with `os.environ`, `perl -e` with `%ENV`): issue #1155.
- The secret-path check denies a command that names `.env` inside a search pattern, such as `grep process.env src/index.ts`: issue #1155.
- The guard reads the text of every argument, so notes or messages that name a guarded command trigger it: dropped as a separate item; issue #1155 covers the pattern-text surface.
- `spec-task-artifact-contract` fails every completed core-chain task: issue #1153 (open).

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [x] Every acceptance criterion in the linked issue is met
- [ ] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
