# PRD: Close secret-guard false allows for jq env and quoted docker json

Status: DRAFT

Issue: [#1150](https://github.com/mifunedev/agro/issues/1150) (#1152 merged into it)

## User Stories

### US-001: Deny a jq filter that reads the env builtin or `$ENV`

**Description:** As an operator, I want the Bash guard to deny a `jq` filter that reads `env` or `$ENV` so that an agent cannot print the process environment.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 1 on `jq -n 'env'`. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `jq -n 'env'`, `jq -n '$ENV'`, `jq -n 'env.HOME'`, `jq -n '$ENV.PATH'`, `jq -n '{a: env}'`, `jq -n 'null | env'`, and `jq --arg k v -n '$ENV'`.
- [ ] The probe asserts `deny` for `jq -n env`.
- [ ] The probe asserts `allow` for `jq '.env' .claude/settings.json`, `jq -r '.env // {}' .claude/settings.json`, `jq .env .claude/settings.json`, and `jq '.environment' data.json`.
- [ ] The probe builds each `env` and `ENV` token from parts, so that the probe source passes the guard.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

### US-002: Deny a single-quoted json format value on docker inspect

**Description:** As an operator, I want the container-inspect guard to deny a `json` format value in every quoting form so that an agent cannot read `Config.Env` through `--format 'json'`.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 1 on `docker inspect --format 'json' web`. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `docker inspect --format 'json' web`, `docker inspect -f 'json' web`, and `docker inspect --format='json' web`.
- [ ] The probe keeps its existing `deny` for `docker inspect --format json web` and its existing `allow` for `docker inspect --format '{{json .State.Health}}' agro`.
- [ ] `grep -c 'x27' .agro/hooks/deny-env-dump.sh` prints `1`. The one match is the `perl` substitution on line 8.
- [ ] After the hook change, `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `CHANGELOG.md` `[Unreleased]` has one `### Fixed` entry that links #1150.

## Summary

`.agro/hooks/deny-env-dump.sh` is the Bash `PreToolUse` guard. `.claude/settings.json` wires the guard to the `Bash` matcher through the `.claude/hooks` symlink. `.codex/hooks/deny-env-dump.sh` calls the shared hook, so Codex inherits each fix.

Verified current behavior (advisor run of the hook at `90707bd`, 2026-09-26):

| Command | Decision | Cause |
| --- | --- | --- |
| `jq -n 'env'` | allow | The `DENY` term for `env` needs a following `\|`, `>`, `;`, `&`, or the end of the command. The closing quote is none of these. |
| `jq -n '$ENV'` | allow | No term names `$ENV`. |
| `jq -n 'env.HOME'`, `jq -n '$ENV.PATH'`, `jq -n '{a: env}'` | allow | Same causes. |
| `jq -n env` | deny | The `DENY` term for `env` at the end of the command matches. |
| `jq -n '$ENV \| keys'` | deny | The `DENY` term for `env` before `\|` matches. |
| `jq '.env' .claude/settings.json` | allow | Correct. #1149 exempts the filter from the secret-path check. |
| `docker inspect --format 'json' web` | allow | Line 39 writes the quote class as `["\x27]` in a single-quoted bash string. `grep -E` reads the class as `"`, `\`, `x`, `2`, and `7`. |
| `docker inspect -f 'json' web`, `docker inspect --format='json' web` | allow | Same cause. |
| `docker inspect --format json web`, `docker inspect --format "json" web` | deny | Correct. |

Selected approach:

1. Add one term to `DENY`. The term matches a `jq` call whose remaining command text holds `$ENV` or a standalone `env` token. A standalone `env` token has no `.`, `$`, letter, digit, `_`, `/`, or `-` directly before it, and no letter, digit, `_`, or `-` directly after it. The term scans to the end of the command, not to the next `|`, so that a `|` inside the filter cannot end the scan. The term does not depend on the `JQ_CALL` filter parse, so that a misparsed flag such as `--arg k v` cannot hide the filter.
2. Replace `["\x27]` in `DOCKER_FMT_UNSAFE` with a bracket class that holds `"` and a literal single quote. The bash spelling inside the single-quoted string is `["'\'']`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
| --- | --- | --- |
| `.agro/hooks/deny-env-dump.sh` | `DENY` | US-001 adds the `jq` env term. |
| `.agro/hooks/deny-env-dump.sh` | `DOCKER_FMT_UNSAFE` | US-002 fixes the quote class. |
| `.agro/evals/probes/secret-exposure-guard.sh` | `assert` calls | US-001 adds the `jq` env assertions. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `assert` calls | US-002 adds the single-quoted `json` assertions. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Calls the shared hook. No change. |
| `CHANGELOG.md` | `[Unreleased]` | One `### Fixed` entry. |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| Claude Code Bash `PreToolUse` | behavior | Denies the reported `jq` and `docker inspect` shapes. Every current `allow` in both probes stays `allow`. |
| Codex Bash hook | behavior | Inherits the same change through the wrapper. |
| `mifunedev/agro-web` | none | The public documentation does not list individual guard patterns. |

## Storage

N/A. The hook is stateless.

## Architectural Decisions

- The shared hook stays the single source of truth. The Codex wrapper and the `.claude/hooks` symlink need no change.
- The `jq` env term lives in `DENY`, so that the guard emits the existing deny message and runs no new branch.
- `DENY` runs with `grep -Ei`. The new term therefore also matches `ENV` and `Env` tokens. The resulting false denies, such as `jq -n '{Env: 1}'`, are accepted: deny on doubt.
- The `jq` env term scans the original command string, not `path_cmd`. The #1149 filter mask applies only to the secret-path check.
- Each story extends an existing probe. The task adds no probe file and no probe machinery.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
| --- | --- | --- |
| `.agro/evals/probes/secret-exposure-guard.sh` | US-001 deny and allow table | The `jq` env fix, and that `jq '.env' .claude/settings.json` stays allowed. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | US-002 deny table plus the existing table | The quote-class fix, and no regression in narrow `--format` reads. |
| `.agro/evals/probes/operator-config-guard.sh` | existing | No regression in the operator-path guard. |
| `bash .claude/skills/eval/run.sh` | all probes | No new red against the base run on `development`. |

Each story adds its probe assertions first and records the probe exit 1 against the unchanged hook. Then the story changes the hook.

## Design Principles

- Deny on doubt. A parse gap produces a false deny, never a false allow.
- One source of truth: `.agro/hooks/deny-env-dump.sh`.
- Change the smallest set of patterns that closes the reported false allows.
- Add no explanatory comments to the hook (root `AGENTS.md`, non-negotiable 5).

## Out of Scope

- A `jq` filter loaded from a file through `-f` or `--from-file`. The guard cannot read the file content.
- Other `jq` builtins that expose process state, such as `$__prog_args` or `input_filename`. Neither builtin prints the environment.
- `yq`, `gojq`, and other `jq`-compatible tools.
- `.agro/hooks/deny-secret-paths.sh`.

## Open Questions

None.

## Acceptance Criteria

- [ ] `jq -n 'env'` and `jq -n '$ENV'` are denied.
- [ ] `jq '.env' .claude/settings.json` is allowed.
- [ ] `docker inspect --format 'json' web` and `docker inspect -f 'json' web` are denied.
- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh`, `bash .agro/evals/probes/docker-inspect-env-guard.sh`, and `bash .agro/evals/probes/operator-config-guard.sh` exit 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no new red against the base run on `development`.

## Lessons

Filled by the advisor before undraft.
