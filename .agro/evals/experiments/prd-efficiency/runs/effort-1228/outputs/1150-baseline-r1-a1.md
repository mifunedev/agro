# PRD: Close two false allows in the secret-exposure guard

Status: DRAFT

## User Stories

### US-001: Deny jq filters that read the environment

**Description:** As the operator, I want the Bash guard to deny a `jq` filter that reads the `env` builtin or `$ENV` so that `jq` cannot print the process environment.

**Acceptance Criteria:**

- [ ] Before the hook change, the new probe cases exit 1 with a REGRESSION line for `jq -n 'env'` (red test, reproduction from issue #1150).
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for `jq -n 'env'`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for `jq -n '$ENV'`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for `jq -n 'env.HOME'` and for `jq -n '$ENV.PATH'`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for the double-quoted form `jq -n "env"`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns an empty output (allow) for `jq '.env' .claude/settings.json`, `jq -r '.env // {}' .claude/settings.json`, and `jq .env .claude/settings.json`.
- [ ] `.agro/evals/probes/secret-exposure-guard.sh` asserts each deny case and each allow case above.
- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] A disposable copy of the hook without the new term makes the probe exit 1 with a REGRESSION line that names the jq case.

### US-002: Deny a single-quoted json format value in docker inspect

**Description:** As the operator, I want the container-inspect guard to deny `--format 'json'` and `-f 'json'` so that an agent cannot read `Config.Env` through a single-quoted format value.

**Acceptance Criteria:**

- [ ] Before the hook change, the new probe case exits 1 with a REGRESSION line for `docker inspect --format 'json' web` (red test, reproduction from issue #1152 merged into #1150).
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for `docker inspect --format 'json' web`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for `docker inspect -f 'json' web`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for `docker inspect --format "json" web` and for `docker inspect --format json web`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns an empty output (allow) for `docker inspect --format '{{json .State.Health}}' agro`.
- [ ] `.agro/evals/probes/docker-inspect-env-guard.sh` asserts both single-quoted forms and the double-quoted form.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] A disposable copy of the hook with the old `["\x27]` class makes the probe exit 1 with a REGRESSION line that names the single-quoted case.

## Summary

Issue #1150 reports two false allows in `.agro/hooks/deny-env-dump.sh`. The advisor verified both gaps against the hook at `90707bd`.

Gap 1: the `DENY` terms at lines 15 and 16 match a bare `env` only before `|`, `>`, `;`, `&`, or the end of the command. The quoted filters `'env'` and `'$ENV'` end with a quote character, so no term matches. The unquoted `jq -n env` matches line 16 by position only.

Gap 2: line 39 writes the quote class as `["\x27]` inside a single-quoted bash string. `grep -E` reads `\x27` as literal characters, not as a single quote. The term therefore misses `'json'`.

The selected approach has two parts:

1. Add a jq-filter check. Reuse the `JQ_CALL` parse from #1149 to extract each jq filter. Deny the command when a filter names the `env` builtin or `$ENV`. A member access such as `.env` stays allowed.
2. Replace the quote class on line 39 with a class that contains a real single quote. Line 44 shows the pattern: build the term in a double-quoted string.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` (lines 15-33) | Current env-dump terms. The quoted jq filters match none of them. |
| `.agro/hooks/deny-env-dump.sh` | `JQ_CALL`, `JQ_PATH_FLAG`, `mask_jq_filters` (lines 79-98) | Existing jq filter parse from #1149. The new check reuses this parse. |
| `.agro/hooks/deny-env-dump.sh` | `DOCKER_FMT_UNSAFE` (lines 37-39) | Holds the broken `["\x27]` quote class on line 39. |
| `.agro/hooks/deny-env-dump.sh` | `emit`, the `if`/`elif` chain (lines 102-141) | Emits the decision. The jq check joins the first `deny` branch or adds a branch ahead of the `SECRET_PATH_DENY` branch. |
| `.agro/evals/probes/secret-exposure-guard.sh` | `decision_for`, `assert` (lines 20-45), jq cases (lines 76-116) | File-fixture driver and the existing `.env` allow cases. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `decision_for`, `assert`, `--format json` case (line 63) | Inline driver and the existing unquoted json case. |
| `.agro/evals/AGENTS.md` | Fault injection section | Requires a driven REGRESSION branch before a changed probe lands. |
| `.claude/skills/eval/run.sh` | eval runner | Runs the full probe suite. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Bash `PreToolUse` hook decision | Behavior change | Four jq filter shapes and two docker inspect shapes change from allow to deny. |
| Hook deny message | Unchanged | The jq check reuses the existing secret-exposure deny message. The docker fix reuses the existing container-inspect message. |

## Storage

N/A. The hook is stateless. The change adds no file, schema, or persisted state.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` stays the single source of truth for the Bash secret guard.
- The jq check inspects only the jq filter argument. The check does not scan other arguments, so `jq '.env' .claude/settings.json` stays allowed.
- The jq check treats `env` as the builtin only when no `.`, identifier character, or `$` comes before `env`. This rule keeps `.env`, `.foo.env`, and `$env_name` out of the match.
- The jq check matches `$ENV` with a word boundary after `ENV`.
- The docker fix changes only the quote class on line 39. No other `DOCKER_FMT_UNSAFE` term changes.
- US-002 depends on US-001 because both stories edit `.agro/hooks/deny-env-dump.sh`. Run the stories in sequence.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-exposure-guard.sh` | deny `jq -n 'env'`, `jq -n '$ENV'`, `jq -n 'env.HOME'`, `jq -n '$ENV.PATH'`, `jq -n "env"` | The jq env-builtin check denies each filter shape. |
| `.agro/evals/probes/secret-exposure-guard.sh` | allow `jq '.env' .claude/settings.json` and the existing cases at lines 76-81 | The #1149 allow cases stay green. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | deny `docker inspect --format 'json' web`, `docker inspect -f 'json' web`, `docker inspect --format "json" web` | The quote class matches every quoting form. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | existing allow cases at lines 70-83 | Narrow `--format` reads stay allowed. |
| `.claude/skills/eval/run.sh` | full suite | No probe turns red compared with the baseline run before the change. |

Hold each env-shaped token in a shell variable, as `ENV_FIELD` and `H` do in the current probes. Then the probe file itself does not trip the guard when an agent reads the file through Bash.

## Design Principles

- Keep one source of truth: fix the canonical hook. Do not add a mirror rule.
- Apply the smallest change that closes each gap.
- Follow `.agro/evals/AGENTS.md`: drive each new REGRESSION branch against a disposable broken copy of the hook.
- Add no explanatory comments to tracked code.

## Out of Scope

- Other jq ways to reach the environment, for example `input_filename` tricks or `--args` with `$__prog_args`.
- New entries in `.claude/settings.json` `permissions.deny`.
- The false deny on a `grep -E` pattern that contains `env|`. The guard denied such a command while this plan was written. File that gap as a separate issue.
- Public documentation in `mifunedev/agro-web`. The guard has no user-facing page for these shapes.

## Open Questions

None

## Acceptance Criteria

- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for `jq -n 'env'` and for `jq -n '$ENV'`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns an empty output (allow) for `jq '.env' .claude/settings.json`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for `docker inspect --format 'json' web` and for `docker inspect -f 'json' web`.
- [ ] `.agro/evals/probes/secret-exposure-guard.sh` and `.agro/evals/probes/docker-inspect-env-guard.sh` exit 0 and assert both directions.
- [ ] `bash .claude/skills/eval/run.sh` reports no probe that was green before the change as red after the change.

## Lessons

Filled by the advisor before undraft.
