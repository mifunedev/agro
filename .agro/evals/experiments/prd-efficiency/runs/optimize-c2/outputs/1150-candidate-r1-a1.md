# PRD: Close quoted-form bypasses in the secret-exposure guard

Status: DRAFT

## User Stories

### US-001: Deny jq filters that read the process environment

**Description:** As an operator, I want the guard to deny jq environment reads so that secrets stay out of transcripts.

**Acceptance Criteria:**

- [ ] The hook `.agro/hooks/deny-env-dump.sh` returns `deny` for `jq -n 'env'`.
- [ ] The hook returns `deny` for `jq -n '$ENV'`.
- [ ] The hook returns `deny` for `jq -n env.HOME` and for `jq -n '$ENV.PATH'`.
- [ ] The hook returns `deny` for `jq -n 'env'` after a flag cluster, for example `jq -rn 'env'`.
- [ ] The hook returns no output for `jq '.env' .claude/settings.json`. No output means `allow`.
- [ ] The hook returns no output for `jq -r '.env // {}' .claude/settings.json` and for `jq -n '{env: 1}'`.
- [ ] The jq check reuses the `JQ_CALL` parse. The hook holds one jq-filter parser, not two.
- [ ] The probe `.agro/evals/probes/secret-exposure-guard.sh` asserts each deny case and each allow case above.
- [ ] Before the hook change, the new deny assertions exit 1 with a `REGRESSION` line. This is the red test.

### US-002: Deny a single-quoted json inspect format

**Description:** As an operator, I want every quoted `json` inspect format denied so that `Config.Env` stays hidden.

**Acceptance Criteria:**

- [ ] The hook returns `deny` for `docker inspect --format 'json' web`.
- [ ] The hook returns `deny` for `docker inspect -f 'json' web`.
- [ ] The hook still returns `deny` for `docker inspect --format json web` and for `docker inspect --format "json" web`.
- [ ] The hook still returns no output for `docker inspect --format '{{json .State.Health}}' agro`.
- [ ] The `DOCKER_FMT_UNSAFE` quote class matches a literal single quote. The class contains no `\x27` escape inside a single-quoted bash string.
- [ ] The probe `.agro/evals/probes/docker-inspect-env-guard.sh` asserts both single-quoted forms.
- [ ] Before the hook change, the new assertions exit 1 with a `REGRESSION` line. This is the red test.

## Summary

The PreToolUse Bash hook `.agro/hooks/deny-env-dump.sh` has two false allows. The issue merges #1150 and #1152.

Gap 1: jq reads the full environment through the `env` builtin or the `$ENV` variable. The `DENY` term at line 16 matches a bare `env` at the end of the command. The term denies `jq -n env` only. The trailing quote in `jq -n 'env'` defeats the term. No term matches `$ENV`.

Gap 2: line 39 writes the quote class as `["\x27]` inside a single-quoted bash string. Bash passes the four characters of the escape to `grep -E` unchanged. The class matches a double quote, a backslash, `x`, `2`, and `7`, but not a single quote. The single-quoted `json` format value matches no term.

Merge #1151 at `90707bd` added `mask_jq_filters` and the `JQ_CALL` regex. The mask exempts a jq filter from the secret-path check. The mask makes `jq '.env' .claude/settings.json` allowed. This plan must keep that result.

Selected approach:

1. Add a jq environment check to the first deny branch. The check walks each jq call with the `JQ_CALL` regex. The check skips a call whose flags name a filter file. The check tests the filter text for the `env` builtin or `$ENV`.
2. Match `env` only as an identifier. Exclude a preceding `.`, `$`, `"`, letter, digit, or `_`. Exclude a following letter, digit, `_`, or `:`. The exclusions keep field access `.env`, the string `"env"`, and the object key `env:` allowed.
3. Rewrite line 39 as a double-quoted string with the class `[\"']`. Line 44 uses the same style.
4. Add the jq environment read to the reason text of the first deny branch.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY`, `JQ_CALL`, `JQ_PATH_FLAG`, `mask_jq_filters`, first `if` branch | Add the jq environment check and update the deny reason. |
| `.agro/hooks/deny-env-dump.sh` | `DOCKER_FMT_UNSAFE` line 39 | Fix the quote class. |
| `.agro/evals/probes/secret-exposure-guard.sh` | `assert`, `decision_for` | Add US-001 assertions. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `assert`, `decision_for` | Add US-002 assertions. |
| `.claude/settings.json` | `hooks.PreToolUse` line 94 | Wires the hook through the provider mirror. No change. |
| `CHANGELOG.md` | Unreleased entry | Record the fix per the /git skill. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Bash PreToolUse hook decision | Behavior | Four jq forms and two docker forms change from `allow` to `deny`. |
| Deny reason text | Wording | The first deny reason names the jq environment read. |

## Storage

N/A. The hook is stateless. The hook reads one JSON payload on stdin and writes one decision.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` is the canonical source. The `.claude/hooks` and `.codex/hooks` copies are provider mirrors. Do not edit a mirror.
- The jq check reuses the `JQ_CALL` regex. A second jq parser would drift from `mask_jq_filters`.
- The jq check denies every read of `env` or `$ENV`, including a single-key read. The issue asks for a deny on the builtin and the variable. The issue does not ask for an `ask` tier.
- A filter loaded with `-f` or `--from-file` stays outside the check. The hook cannot read the filter file content.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-exposure-guard.sh` | deny `jq -n 'env'`, `jq -n '$ENV'`, `jq -n env.HOME`, `jq -n '$ENV.PATH'`, `jq -rn 'env'` | US-001 deny direction |
| `.agro/evals/probes/secret-exposure-guard.sh` | allow `jq '.env' .claude/settings.json`, `jq -r '.env // {}' .claude/settings.json`, `jq -n '{env: 1}'` | US-001 allow direction and the #1149 result |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | deny `docker inspect --format 'json' web`, `docker inspect -f 'json' web`, `docker inspect --format "json" web` | US-002 deny direction |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | existing allow cases | US-002 allow direction |
| Full suite | `bash .claude/skills/eval/run.sh` | No new red probe |

Run order for each story:

1. Add the assertions to the probe.
2. Run the probe with `bash <probe path>`. The probe exits 1 and prints `REGRESSION`.
3. Change the hook.
4. Run the probe again. The probe exits 0 and prints `PASS`.

The implementer runs each probe in the sandbox. The live guard can deny a Bash command that holds a test string. If the guard denies the command, write a driver script to a file per `.agro/evals/AGENTS.md`.

## Design Principles

- Keep one source of truth. Edit the canonical hook, not a provider mirror.
- Keep the smallest change. Fix one regex and add one check.
- Keep both directions under test. Each new deny case has a matching allow case.
- Add no comments to tracked code, per the root contract.

## Out of Scope

- An `ask` tier for a single-key jq read such as `env.HOME`.
- Content checks on a jq filter file loaded with `-f` or `--from-file`.
- Other interpreters that read the environment, for example `python -c` or `node -e`.
- Changes to `.agro/hooks/deny-secret-paths.sh`.
- Changes to the public documentation in the mifunedev/agro-web repository. The guard has no user-facing documentation page.

## Open Questions

1. Should a single-key read such as `jq -n env.HOME` produce `ask` instead of `deny`? This plan uses `deny`.

## Acceptance Criteria

- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `bash .agro/evals/probes/operator-config-guard.sh` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no probe that was green on `development` at `90707bd` as red.
- [ ] `git diff --stat` shows no change under `.claude/hooks` or `.codex/hooks`.
- [ ] `CHANGELOG.md` holds one entry for the fix.

## Lessons

Filled by the advisor before undraft.
