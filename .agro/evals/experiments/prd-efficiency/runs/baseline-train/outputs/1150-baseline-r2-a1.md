# PRD: Close secret-guard false allows for jq env and inspect json

Status: DRAFT

Issue: [#1150](https://github.com/mifunedev/agro/issues/1150) (#1152 merged into it)

## User Stories

### US-001: Deny a jq filter that reads the environment

**Description:** As an operator, I want the Bash guard to deny a `jq` read of `env` or `$ENV` so that an agent cannot print the process environment.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 1 on `jq -n 'env'`. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `jq -n 'env'`, `jq -n '$ENV'`, `jq -n env`, `jq -n 'env.HOME'`, `jq -n '$ENV.HOME'`, `jq -rn '[env]'`, `jq -n '. | $ENV'`, and `jq -n "\$ENV"`.
- [ ] The probe asserts `allow` for `jq '.env' .claude/settings.json`, `jq -r '.env // {}' .claude/settings.json`, `jq '.environment' data.json`, and `jq -r '.x' env.json`.
- [ ] The existing #1149 assertions in the probe stay unchanged.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

### US-002: Match a single-quoted json format value in the inspect guard

**Description:** As an operator, I want the container-inspect guard to deny a `json` format value in every quoting form so that `docker inspect --format 'json'` cannot print `Config.Env`.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 1 on `docker inspect --format 'json' web`. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `docker inspect --format 'json' web`, `docker inspect -f 'json' web`, `docker inspect --format='json' web`, and `docker inspect --format "json" web`.
- [ ] The existing allow assertions in the probe stay unchanged, including `docker inspect --format '{{json .State.Health}}' agro`.
- [ ] After the hook change, `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `grep -n 'x27' .agro/hooks/deny-env-dump.sh` prints only the `perl` heredoc line.
- [ ] `CHANGELOG.md` `[Unreleased]` `### Fixed` has one entry that links #1150 and names both false allows.

## Summary

`.agro/hooks/deny-env-dump.sh` is the Bash `PreToolUse` guard. `.claude/settings.json` wires it to the `Bash` matcher. The #1149 fix is in the tree: `CHANGELOG.md` `[Unreleased]` records it, and `.agro/evals/probes/secret-exposure-guard.sh` pins it.

Verified current behavior (hook run through a file fixture, 2026-09-26):

| Command | Decision | Cause |
| --- | --- | --- |
| `jq -n 'env'` | allow | The `DENY` terms for a bare `env` need `[\|>;&]` or the line end after `env`. The closing `'` blocks both terms. |
| `jq -n '$ENV'` | allow | No term names `$ENV`. |
| `jq -n env` | deny | The line-end `env` term matches. |
| `jq '.env' .claude/settings.json` | allow | Correct. `mask_jq_filters` hides the filter from the secret-path check. |
| `docker inspect --format 'json' web` | allow | Line 39 writes `["\x27]` inside a single-quoted bash string. `grep -E` reads the class as `"`, `\`, `x`, `2`, `7`. |
| `docker inspect -f 'json' web` | allow | Same cause. |
| `docker inspect --format='json' web` | allow | Same cause. |
| `docker inspect --format "json" web` | deny | Correct. `"` is in the class. |

Selected approach:

1. Add a `$ENV` term to `DENY`: `jq` as a word, then `$ENV` as a word later on the same command line. The term reads the raw command, so the term covers every quoting form, including `\$ENV`.
2. Add a check for the `env` builtin. The check reads only the `jq` filter argument. Reuse the `JQ_CALL` parse from `mask_jq_filters` to extract each filter. Deny the command when a filter contains `env` as a word with no `.`, `$`, letter, digit, or `_` before `env`. Use a case-sensitive match, because `jq` builtins are case-sensitive. Emit the existing `DENY` message.
3. Rewrite line 39 so that the quote class holds a real single quote, for example a double-quoted bash string with `[\"']`.

The `env` check reads the filter only. A raw-command `env` term denies `jq . env/data.json` and `jq '.x' f | grep env`. The `$ENV` check reads the raw command, because `$ENV` names the `jq` variable in almost every command that holds `jq`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
| --- | --- | --- |
| `.agro/hooks/deny-env-dump.sh` | `DENY`, `JQ_CALL`, `mask_jq_filters`, first `if` branch | US-001: the `$ENV` term and the filter-scoped `env` check. |
| `.agro/hooks/deny-env-dump.sh` | `DOCKER_FMT_UNSAFE` (line 39) | US-002: the quote-class fix. |
| `.agro/evals/probes/secret-exposure-guard.sh` | `assert` table | US-001 allow and deny assertions. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `assert` table | US-002 deny assertions. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Calls the shared hook. No change. |
| `CHANGELOG.md` | `[Unreleased]` `### Fixed` | One entry for #1150. |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| Claude Code Bash `PreToolUse` | behavior | Denies the `jq` environment reads and the single-quoted `json` inspect format. Every current allow in both probes stays allowed. |
| Codex Bash hook | behavior | Inherits the same change through the wrapper. |

## Storage

N/A. The hook is stateless.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` stays the single source of truth. `.claude/hooks` and the Codex wrapper need no change.
- The `env` check reuses the `JQ_CALL` parse. The task adds no second `jq` parser.
- A misparsed `jq` argument can produce a false deny, for example `jq --arg env prod '.x' data.json`. The failure mode is a false deny, never a false allow.
- Each story extends an existing probe. The task adds no probe file.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
| --- | --- | --- |
| `.agro/evals/probes/secret-exposure-guard.sh` | US-001 deny and allow table | The guard denies the `jq` environment reads. `jq '.env' .claude/settings.json` stays allowed after #1149. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | US-002 deny table plus existing allows | The guard denies the `json` format value in every quoting form. Narrow templates stay allowed. |
| `.agro/evals/probes/operator-config-guard.sh` | existing | No regression in the operator-path guard. |
| `bash .claude/skills/eval/run.sh` | all probes | No new red against the baseline set that the advisor records before US-001. |

Each story adds its probe assertions first and records the probe exit 1 against the unchanged hook. Then the story changes the hook. Each story drives the probe through the file-fixture driver pattern in `.agro/evals/AGENTS.md`.

## Design Principles

- Deny on doubt. A parse gap produces a false deny, never a false allow.
- One source of truth: `.agro/hooks/deny-env-dump.sh`.
- Change the smallest set of patterns that closes the three reported false allows.
- Add no explanatory comments to the hook (root `AGENTS.md`, non-negotiable 5).

## Out of Scope

- A `jq` filter loaded from a file through `-f` or `--from-file`. The hook cannot read the file content.
- An `env` builtin inside a double-quoted filter that also holds `$`, for example `jq -n "env | .\"$X\""`. `JQ_CALL` does not parse that form.
- `yq`, `gojq`, and other `jq` clones.
- Other environment readers, such as `python -c 'import os; print(os.environ)'` or `node -p process.env`.
- `.agro/hooks/deny-secret-paths.sh`.

## Open Questions

None.

## Acceptance Criteria

- [ ] `jq -n 'env'` and `jq -n '$ENV'` are denied.
- [ ] `jq '.env' .claude/settings.json` is allowed.
- [ ] `docker inspect --format 'json' web` and `docker inspect -f 'json' web` are denied.
- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh`, `bash .agro/evals/probes/docker-inspect-env-guard.sh`, and `bash .agro/evals/probes/operator-config-guard.sh` exit 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no red beyond the baseline set that the advisor records before US-001.

## Lessons

Filled by the advisor before undraft.
