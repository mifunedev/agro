FROM bug/1150-guard-false-allows TO development

Closes #1150

## Stories

- [x] US-001: Deny jq access to the process environment
- [x] US-002: Deny a quoted json format in container inspect

## What the issue asked for

The Bash secret-exposure guard (`.agro/hooks/deny-env-dump.sh`) allowed two environment dumps:

- A `jq` filter that reads `env` or `$ENV`, such as `jq -n 'env'`.
- A single-quoted `json` format value in container inspect, such as `docker inspect --format 'json' web`.

## What was built

- US-001: The guard denies a `jq` filter that reads `env` or `$ENV`. This includes a single-value read such as `env.HOME`. The check reads only the `jq` filter argument, so `jq '.env' <file>` and `jq '.x' env.json` stay allowed.
- US-002: The container-inspect guard denies `--format 'json'`, `-f 'json'`, and `--format='json'`. The `json` term used the class `["\x27]` inside a single-quoted bash string, and `grep -E` read that class as literal characters. The class is now `["']`.
- `CHANGELOG.md` `[Unreleased]` `### Fixed` has one entry that links #1150.

## Where it diverged

None. The branch starts at `90707bd2`, the `development` commit that the plan grounded against, and targets `development`.

## What remains unverified

- I did not re-run the before-change exit 1 (AC1 of each story) in this commit session. `prd.json` records the advisor runs for AC1.
- I did not re-run the full `/eval` suite in this session. `prd.json` records the last full run: 159 probes, with the known reds `next-dev-prod` and `skills-vendored`.
- CI has not run. The branch is not pushed.

## Verification

```
$ bash .agro/evals/probes/secret-exposure-guard.sh      # exit 0
$ bash .agro/evals/probes/docker-inspect-env-guard.sh   # exit 0
$ bash .agro/evals/probes/operator-config-guard.sh      # exit 0
$ bash .agro/evals/probes/changelog-entry-length.sh     # exit 0
```

## Lessons

- The guard allows an environment dump through a script interpreter, such as `python3 -c` with `os.environ`. Tracked in issue #1155.
- The secret-path check denies a command that names `.env` inside a search pattern, such as `grep process.env src/index.ts`. Tracked in issue #1155.
- The guard reads the text of every command argument, so notes or commit messages that name a guarded pattern trigger it. Example: the new `jq` fallback denied a `git commit -m` whose message contained the words "jq" and "env". Workaround: pass the text from a file (`git commit -F`, `jq --rawfile`). Tracked in issue #1155.
- `spec-task-artifact-contract` fails every completed core-chain task. Tracked in issue #1153.

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [x] Every acceptance criterion in the linked issue is met
- [x] Tests written **before** implementation (TDD)
- [ ] The repository's lint, typecheck, test, and build commands pass (CI not run)
- [x] No new dependencies, or each one is justified above
- [x] Changelog and user-facing documentation updated, or this is a pure chore
