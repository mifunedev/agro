FROM bug/1150-guard-false-allows TO development
Refs #1150

## Stories

- [x] US-001: Deny jq access to the process environment
- [x] US-002: Deny a quoted json format in container inspect

## What the issue asked for

The Bash secret guard allows two environment dumps: a `jq` filter that reads `env` or `$ENV`, and `docker inspect` with a single-quoted `json` format value (#1152, merged into #1150). The guard must deny both, and `jq '.env' .claude/settings.json` must stay allowed.

## What was built

- **US-001** `.agro/hooks/deny-env-dump.sh` denies a `jq` filter that reads `$ENV` or the `env` builtin, including single values such as `env.HOME`. The check reads only the filter found by the #1151 parse, so `jq '.env' <file>` and a file named `env.json` stay allowed. A parse gap (path or argument flags, a filter starting with `-`, a leftover `jq` word) makes the check read the rest of the call: false deny, never false allow.
- **US-002** The `DOCKER_FMT_UNSAFE` `json` term now matches single and double quotes, so `--format 'json'`, `-f 'json'`, and `--format='json'` are denied.

Evidence per criterion: [`prd.json`](../blob/bug/1150-guard-false-allows/.agro/tasks/guard-false-allows/prd.json) `notes`.

## Where it diverged

None. Each story passed on its first commit.

## What remains unverified

- `spec-task-artifact-contract` exits 1 locally once every story passes; CI skips it. Tracked in #1153.
- A `jq` program loaded with `-f` from a file is out of scope.

## Verification

```
bash .agro/evals/probes/secret-exposure-guard.sh       → exit 0
  same probe against the plan-commit hook (ee371605)   → exit 1 (jq -n 'env')
bash .agro/evals/probes/docker-inspect-env-guard.sh    → exit 0
  same probe against the pre-US-002 hook (8c988fc0)    → exit 1 (--format 'json')
bash .agro/evals/probes/operator-config-guard.sh       → exit 0
bash .agro/evals/probes/changelog-entry-length.sh      → exit 0
advisor adversarial run, 16 commands                   → 16/16 expected decision
bash .claude/skills/eval/run.sh (before US-002 accept) → exit 0; 159 probes; persistent reds next-dev-prod, skills-vendored only
```

## Lessons

- Interpreter environment dumps (`python3 -c`, `perl -e`) are allowed, and `.env` inside a search pattern is falsely denied → issue #1155 (one issue, both gaps).
- Notes that name a guarded command trigger the guard → dropped: use `--rawfile`; #1155 covers the surface.
- `spec-task-artifact-contract` fails completed core-chain tasks → issue #1153 (open).

Full table: [`prd.md` § Lessons](../blob/bug/1150-guard-false-allows/.agro/tasks/guard-false-allows/prd.md#lessons).

## Checklist

- [x] Title is `FROM <source-branch> TO <target-branch>`
- [x] Base branch is the repository's integration branch
- [x] Closing keyword links every issue this PR completes
- [x] Every acceptance criterion in the linked issue is met
- [x] Tests written **before** implementation (TDD): each story showed its probe exit 1 before the hook change
- [x] The repository's lint, typecheck, test, and build commands pass (`/eval`; CI below)
- [x] No new dependencies
- [x] Changelog updated

