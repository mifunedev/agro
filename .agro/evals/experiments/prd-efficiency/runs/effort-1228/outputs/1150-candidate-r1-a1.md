# PRD: Deny jq environment filters and single-quoted docker json format

Status: DRAFT

## User Stories

### US-001: Deny jq filters that read the process environment

**Description:** As the operator, I want the Bash guard to deny a `jq` filter that reads the `env` builtin or `$ENV`. Then an agent cannot print the process environment through `jq`.

**Acceptance Criteria:**

- [ ] Red test first: before the hook change, `.agro/evals/probes/secret-exposure-guard.sh` exits 1 on the new `jq -n 'env'` assertion. The reproduction comes from issue #1150.
- [ ] The hook returns `deny` for `jq -n 'env'`.
- [ ] The hook returns `deny` for `jq -n '$ENV'`.
- [ ] The hook returns `deny` for `jq -n env`.
- [ ] The hook returns `allow` for `jq '.env' .claude/settings.json`.
- [ ] The hook returns `allow` for `jq -r '.env // {}' .claude/settings.json`.
- [ ] `.agro/evals/probes/secret-exposure-guard.sh` asserts each of the five commands above and exits 0.

### US-002: Deny a single-quoted json format value for docker inspect

**Description:** As the operator, I want the container-inspect guard to deny `--format 'json'` and `-f 'json'` so that an agent cannot read `Config.Env` through a single-quoted format value.

**Acceptance Criteria:**

- [ ] Red test first: before the hook change, `.agro/evals/probes/docker-inspect-env-guard.sh` exits 1 on the new `docker inspect --format 'json' web` assertion. The reproduction comes from the #1152 section of issue #1150.
- [ ] The hook returns `deny` for `docker inspect --format 'json' web`.
- [ ] The hook returns `deny` for `docker inspect -f 'json' web`.
- [ ] The hook still returns `deny` for `docker inspect --format json web` and `docker inspect --format "json" web`.
- [ ] The hook still returns `allow` for `docker inspect --format '{{json .State.Health}}' agro`.
- [ ] `.agro/evals/probes/docker-inspect-env-guard.sh` asserts both single-quoted forms and exits 0.

## Summary

Issue #1150 reports two false allows in `.agro/hooks/deny-env-dump.sh`.

First false allow: the `DENY` terms on lines 15 and 16 match a bare `env` only before `|`, `>`, `;`, `&`, or the end of the command. The command `jq -n env` ends with `env`, so line 16 denies it. The commands `jq -n 'env'` and `jq -n '$ENV'` end with a quote, so no term matches. The hook returns empty output, which means `allow`.

Second false allow: line 39 writes the quote class as `["\x27]` inside a single-quoted bash string. `grep -E` reads that class as five literal characters, not as a single quote. The line 8 `perl` expression reads `\x27` correctly, because `perl` decodes the escape. `grep -E` does not decode it.

Selected approach:

1. Add one `DENY` term that matches a `jq` call whose filter holds `$ENV` or a standalone `env` token. The term must not match `.env`, because #1149 allows `jq '.env' <file>`.
2. Replace `["\x27]` on line 39 with a class that holds a real single quote. Build the term with a double-quoted bash string, as lines 24 and 25 do.
3. Add the new assertions to the two existing probes. Add no new probe file.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` (lines 15-33) | Receives the new `jq` environment term. |
| `.agro/hooks/deny-env-dump.sh` | `DOCKER_FMT_UNSAFE` (line 39) | Receives the corrected quote class. |
| `.agro/hooks/deny-env-dump.sh` | `JQ_CALL`, `mask_jq_filters` (lines 79-100) | Masks `jq` filters for the secret-path check only. The new term must not depend on `path_cmd`. |
| `.agro/evals/probes/secret-exposure-guard.sh` | `assert` calls (lines 76-113) | Holds the #1149 `jq` assertions. Receives the US-001 assertions. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `assert` calls (lines 48-78) | Receives the US-002 assertions. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Bash `PreToolUse` hook decision | Behavior | Four more commands return `deny`. No allowed command in the probes changes. |
| Deny reason text | None | The existing reason on line 113 names `env`. The existing reason on line 119 names `--format json`. |

## Storage

N/A. The hook is stateless. It reads one JSON object on stdin and writes one decision.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` stays the single source of truth for the Bash guard.
- The new `jq` term matches the raw command `cmd`, not the masked `path_cmd`. The mask replaces the filter with `JQ_FILTER`, so a match on `path_cmd` cannot see the filter.
- A probe command that holds a guarded literal can trip the hook in the session that writes the probe. The worker follows the file-fixture driver pattern in `.agro/evals/AGENTS.md`, as `docker-inspect-env-guard.sh` line 47 does with `ENV_FIELD`.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-exposure-guard.sh` | deny `jq -n 'env'`, `jq -n '$ENV'`, `jq -n env` | US-001 deny direction. |
| `.agro/evals/probes/secret-exposure-guard.sh` | allow `jq '.env' .claude/settings.json`, `jq -r '.env // {}' .claude/settings.json` | US-001 allow direction and #1149 behavior. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | deny `--format 'json'`, `-f 'json'`, `--format "json"` | US-002 deny direction. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | existing allow cases | US-002 allow direction. |
| `bash .claude/skills/eval/run.sh` | full suite | No new red. |

Fault injection: revert each hook change in a disposable copy. Confirm that each probe exits 1 and names the new case.

## Design Principles

- Change the smallest set of regex terms that closes each gap.
- Add no comments to tracked code, per `AGENTS.md` principle 5.
- Keep each deny case paired with an allow case, so the guard does not over-block.

## Out of Scope

- Other `jq` environment paths, for example `$__loc__` or `input_filename`.
- A general parser for shell quoting.
- Changes to `.agro/hooks/deny-secret-paths.sh` or `.claude/settings.json`.
- Changes to the public documentation in `mifunedev/agro-web`. The guard terminology does not change.

## Open Questions

1. The new term denies `jq -n '$ENV.PATH'`, which reads one variable. Does the operator accept this deny, or must the guard return `ask` for a single-variable read?
   A. Deny every `$ENV` read.
   B. Deny `$ENV` and `env` alone, and return `ask` for `$ENV.<name>`.

## Acceptance Criteria

- [ ] `jq -n 'env'` and `jq -n '$ENV'` return `deny`.
- [ ] `jq '.env' .claude/settings.json` returns `allow`.
- [ ] `docker inspect --format 'json' web` and `docker inspect -f 'json' web` return `deny`.
- [ ] `.agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] `.agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no new red.

## Lessons

Filled by the advisor before undraft.
