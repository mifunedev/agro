# PRD: Close the Bash secret-guard false allows

Status: DRAFT

Issue: [#1150](https://github.com/mifunedev/agro/issues/1150) (includes #1152)

## User Stories

### US-001: Deny jq access to the process environment

**Description:** As an operator, I want the Bash guard to deny a `jq` filter that reads `env` or `$ENV` so that an agent cannot print secrets through `jq`.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 1 on `jq -n 'env'`. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `jq -n 'env'`, `jq -n '$ENV'`, `jq -n 'env.HOME'`, `jq -n '$ENV.GH_TOKEN'`, `jq -n '[env[]]'`, and `jq -n "\$ENV"`.
- [ ] The probe asserts `allow` for `jq '.env' .claude/settings.json`, `jq -r '.env // {}' .claude/settings.json`, and `jq '.x' env.json`.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

### US-002: Deny a quoted json format in container inspect

**Description:** As an operator, I want the container-inspect guard to deny a `json` format value in every quoting form so that `docker inspect` cannot print `Config.Env`.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 1 on `docker inspect --format 'json' web`. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `docker inspect --format 'json' web`, `docker inspect -f 'json' web`, and `docker inspect --format='json' web`.
- [ ] Every existing assertion in `docker-inspect-env-guard.sh` still passes, including the `allow` cases for narrow `--format` templates.
- [ ] After the hook change, `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `CHANGELOG.md` `[Unreleased]` `### Fixed` has one entry that links #1150, and the entry is at most 250 characters.

## Summary

`.agro/hooks/deny-env-dump.sh` is the Bash `PreToolUse` guard. #1151 added `mask_jq_filters`, which finds the filter argument of each `jq` call for the secret-path check.

Verified current behavior (advisor run of the hook on `development` at `90707bd2`, 2026-09-23):

| Command | Decision | Cause |
| --- | --- | --- |
| `jq -n env` | deny | The `DENY` term for a bare `env` at the end of the command matches. |
| `jq -n 'env'`, `jq -n '$ENV'`, `jq -n 'env.HOME'`, `jq -n '[env[]]'` | allow | No term reads the `jq` filter. |
| `jq -r 'env \| keys'` | deny | The `DENY` term for `env` before `\|` matches. The match is accidental. |
| `docker inspect --format json web`, `--format "json"` | deny | `DOCKER_FMT_UNSAFE` matches. |
| `docker inspect --format 'json' web`, `-f 'json'`, `--format='json'` | allow | The quote class `["\x27]` sits in a single-quoted bash string. `grep -E` reads it as the literal characters `"`, `\`, `x`, `2`, and `7`. |

Selected approach:

1. Add a `DENY`-level check on the `jq` filter text. Use the filter that the `mask_jq_filters` parse finds. Deny when the filter contains `$ENV`, or the word `env` that no `.`, identifier character, or `$` precedes. The check reads the filter argument only, so a file named `env.json` stays allowed.
2. Fix the quote class in the `DOCKER_FMT_UNSAFE` `json` term so that it matches a single quote and a double quote.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
| --- | --- | --- |
| `.agro/hooks/deny-env-dump.sh` | `DENY`, `JQ_CALL`, `mask_jq_filters`, `DOCKER_FMT_UNSAFE` | The Bash guard. Both fixes land here. |
| `.agro/evals/probes/secret-exposure-guard.sh` | assertion list | US-001 assertions. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | assertion list | US-002 assertions. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Calls the shared hook. No change. |
| `CHANGELOG.md` | `[Unreleased]` `### Fixed` | One entry. |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| Claude Code Bash `PreToolUse` | behavior | Denies the listed environment reads. |
| Codex Bash hook | behavior | Inherits the same change through the wrapper. |

## Storage

N/A. The hook is stateless.

## Architectural Decisions

- The shared hook stays the single source of truth.
- The `jq` check denies a single value read, such as `env.HOME`, as well as a full dump. A single value can be a secret. The guard cannot tell a secret name from a safe name in a `jq` path.
- The `jq` check reads the filter argument from the existing parse. It adds no second parser.
- When the parse finds no filter argument for a `jq` call, the check reads the whole text of that call. A parse gap produces a false deny. A filter that `-f` loads from a file stays out of scope.
- The tasks extend the two existing probes and add no probe file.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
| --- | --- | --- |
| `.agro/evals/probes/secret-exposure-guard.sh` | US-001 deny and allow cases | The guard denies `jq` environment reads and allows `jq` field reads named `env`. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | US-002 deny cases and all existing cases | The guard denies every quoting form of a `json` format value and allows narrow templates. |
| `bash .claude/skills/eval/run.sh` | all probes | No new red beyond `next-dev-prod`, `skills-vendored`, and `spec-task-artifact-contract` after the last acceptance (#1153). |

Each story adds its probe assertions first and records the probe exit 1 against the unchanged hook. Then the story changes the hook.

## Design Principles

- Deny on doubt. A parse gap produces a false deny, never a false allow.
- One source of truth: `.agro/hooks/deny-env-dump.sh`.
- Change the smallest set of patterns that closes the two reported false allows.
- Add no explanatory comments to the hook (root `AGENTS.md`, non-negotiable 5).

## Out of Scope

- A `jq` program that `-f` or `--from-file` loads from a file.
- Other `.env` substrings in command text, such as `grep "Config.Env" <file>`. The secret-path check still denies that command.
- `yq` filters.
- `spec-task-artifact-contract` (#1153).

## Open Questions

None.

## Acceptance Criteria

- [ ] `jq -n 'env'` and `jq -n '$ENV'` are denied.
- [ ] `jq '.env' .claude/settings.json` is allowed.
- [ ] `docker inspect --format 'json' web` and `docker inspect -f 'json' web` are denied.
- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh` and `bash .agro/evals/probes/docker-inspect-env-guard.sh` exit 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no new red.

## Lessons

| Lesson | Evidence | Outcome |
| --- | --- | --- |
| The Bash guard allows an environment dump through a script interpreter. | The advisor ran the hook on this branch: `python3 -c` with `os.environ` and `perl -e` with `%ENV` return `allow`. | issue #1155 |
| The secret-path check denies a command that names `.env` inside a search pattern. | The hook denied the advisor's `grep "Config.Env" .claude/settings.json` during grounding. `grep process.env src/index.ts` returns `deny`. | issue #1155 (folded with the interpreter gap) |
| The guard reads the text of every command argument, so notes that name a guarded command trigger the guard. | The guard denied the advisor's `jq --arg n '<notes>'` call because the notes named a container-inspect command. | dropped: the workaround is a notes file through `--rawfile`; issue #1155 covers the pattern-text surface. |
| `spec-task-artifact-contract` fails every completed core-chain task. | After the US-002 acceptance, `bash .agro/evals/probes/spec-task-artifact-contract.sh` exits 1 and reports `progress.txt` as missing for `guard-false-allows`. | issue #1153 (open; no new issue) |
