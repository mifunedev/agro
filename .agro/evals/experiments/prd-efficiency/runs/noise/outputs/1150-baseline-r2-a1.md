# PRD: Close two false allows in the Bash secret guard

Status: DRAFT

Issue: [#1150](https://github.com/mifunedev/agro/issues/1150). The issue absorbs [#1152](https://github.com/mifunedev/agro/issues/1152).

## User Stories

### US-001: Deny a jq filter that reads the process environment

**Description:** As an operator, I want the Bash guard to deny a `jq` filter that reads `env` or `$ENV` so that `jq` cannot print the process environment.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 1 on the new `jq -n 'env'` assertion. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `jq -n 'env'`, `jq -n '$ENV'`, `jq -n "env"`, `jq -n 'env.HOME'`, `jq -n '$ENV.PATH'`, and `jq -n 'env' | head`.
- [ ] The probe keeps its `allow` assertions for `jq '.env' .claude/settings.json`, `jq -r '.env // {}' .claude/settings.json`, and `jq .env .claude/settings.json`.
- [ ] The probe builds the word `env` from parts, so that the probe source passes the guard.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] The **Deny** bullet in `docs/security-considerations.md` § Command guard names `jq` filters that read `env` or `$ENV`.

### US-002: Deny a single-quoted json format value on docker inspect

**Description:** As an operator, I want the container-inspect guard to deny a `json` format value in every quoting form so that `docker inspect --format 'json'` cannot print `Config.Env`.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 1 on the new `docker inspect --format 'json' web` assertion. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `docker inspect --format 'json' web`, `docker inspect -f 'json' web`, and `docker inspect --format='json' web`.
- [ ] The probe keeps each existing `allow` assertion, including `docker inspect --format '{{json .State.Health}}' agro`.
- [ ] After the hook change, `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `.agro/hooks/deny-env-dump.sh` contains no `\x27` inside a single-quoted bash string.
- [ ] `CHANGELOG.md` `[Unreleased]` `### Fixed` has one entry that links #1150 and #1152.

## Summary

Verified on `development` at `90707bd`, after #1151 merged. The fixture driver fed each command to `.agro/hooks/deny-env-dump.sh` and read `permissionDecision`.

| Command | Current result |
|---|---|
| `jq -n 'env'` | allow |
| `jq -n '$ENV'` | allow |
| `jq -n "env"` | allow |
| `jq -n 'env.HOME'` | allow |
| `jq -n '$ENV.PATH'` | allow |
| `jq -n 'env' \| head` | allow |
| `jq -n env` | deny |
| `jq -r 'env\|keys'` | deny |
| `docker inspect --format 'json' web` | allow |
| `docker inspect -f 'json' web` | allow |
| `docker inspect --format='json' web` | allow |
| `docker inspect --format "json" web` | deny |
| `docker inspect --format=json web` | deny |

Cause 1: no `DENY` term names a `jq` filter. The two bare-`env` terms deny `env` only before `|`, `>`, `;`, `&`, or the end of the command. A closing quote after `env` defeats both terms.

Cause 2: line 39 writes the quote class `["\x27]` inside a single-quoted bash string. `grep -E` reads the class as the characters `"`, `\`, `x`, `2`, and `7`. A single-quoted `json` value matches no term. The `--format='json'` form fails for the same cause.

Approach:

1. Add one `DENY` term that matches `env` or `$ENV` as a filter term inside a `jq` invocation. The term excludes `env` after `.`, so that `jq '.env' <file>` stays allowed.
2. Rewrite the `json` term of `DOCKER_FMT_UNSAFE` in a double-quoted bash string, so that the class holds a real single quote. Line 25 and line 28 already use this form.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` | Gains the `jq` environment-read term (US-001). |
| `.agro/hooks/deny-env-dump.sh` | `DOCKER_FMT_UNSAFE` | Gets a working single-quote class on the `json` term (US-002). |
| `.agro/evals/probes/secret-exposure-guard.sh` | `assert` calls | Asserts the `jq` deny cases and keeps the #1149 allow cases (US-001). |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `assert` calls | Asserts the single-quoted `json` deny cases (US-002). |
| `docs/security-considerations.md` | § Command guard, **Deny** bullet | Names the new `jq` deny shape (US-001). |
| `CHANGELOG.md` | `[Unreleased]` `### Fixed` | Records the fix (US-002). |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Bash `PreToolUse` hook decision | Behavior | Six `jq` shapes and three `docker inspect` shapes change from `allow` to `deny`. |
| Deny message for the `DENY` branch | None | The existing message already names a bulk env dump. |
| `.claude/settings.json` hook wiring | None | The matcher and the command path stay the same. |

## Storage

N/A. The hook is stateless. The hook reads one JSON payload on stdin and writes one decision on stdout.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` stays the one source of truth for Bash command denial. Both fixes change only this file.
- The `jq` term belongs in `DENY`, not in the secret-path check. The secret-path check reads `path_cmd`, and `path_cmd` masks the `jq` filter by design since #1149.
- A single-key read, such as `env.HOME` or `$ENV.PATH`, is denied. The issue asks the guard to deny any filter that reads the `env` builtin or `$ENV`.
- Over-denial on a `jq` command that also names `env` in a non-filter position is accepted. The existing bare-`env` terms already deny `grep env`.
- Both stories change one file. US-002 runs after US-001, so that two workers never write `.agro/hooks/deny-env-dump.sh` at the same time.

Surfaces:

| Surface | Mark |
|---|---|
| Host and sandbox | applied: all edits and probe runs occur in the sandbox checkout. |
| Lifecycle door | not applicable: no `agro` verb changes. |
| Canonical and provider surfaces | applied: `.agro/hooks/` is canonical. `.claude/settings.json` and `.codex/hooks.json` point at the hook and need no change. |
| Root and scaffold | applied: the hook ships to initialized projects unchanged in path. |
| Interactive and headless processes | not applicable: no process starts. |
| Local and remote operation | not applicable: the hook runs per command. |
| Parallel operation | applied: the stories run in sequence on one file. |
| Public documentation | not applicable: the change adds no command, verb, or term. `docs/security-considerations.md` changes in US-001. |
| Verification | applied: the two probes and `bash .claude/skills/eval/run.sh`. |

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-exposure-guard.sh` | `deny`: `jq -n 'env'`, `jq -n '$ENV'`, `jq -n "env"`, `jq -n 'env.HOME'`, `jq -n '$ENV.PATH'`, `jq -n 'env' \| head` | US-001 closes the `jq` gap. |
| `.agro/evals/probes/secret-exposure-guard.sh` | `allow`: the three existing `.env` filter reads on `.claude/settings.json` | US-001 keeps the #1149 fix. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `deny`: `--format 'json'`, `-f 'json'`, `--format='json'` | US-002 closes the quote-class gap. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | existing `allow` cases | US-002 keeps narrow template reads. |
| `bash .claude/skills/eval/run.sh` | full suite | No new red. |

Write each probe assertion first. Run the probe and record exit 1. Then change the hook and record exit 0.

## Design Principles

- Keep the smallest change: one new `DENY` term and one corrected term.
- Deny on doubt. A secret guard prefers a false deny over a false allow.
- Add no comment to tracked code.
- Follow `.agro/evals/AGENTS.md`: tier, source, and desc headers; exit codes 0, 1, and 2; fault injection before landing.
- Build trigger words from parts in probe source, so that the guard does not deny the probe edit.

## Out of Scope

- A full shell or `jq` parser for the guard.
- Other runtimes that read the environment, such as `python -c`, `node -e`, or `perl -e`.
- `.agro/hooks/deny-secret-paths.sh` and the file-tool guard.
- A `jq` command that names a file called `env`. The guard can deny the command. The probe pins no result for the command.

## Open Questions

None

## Acceptance Criteria

- [ ] `jq -n 'env'` and `jq -n '$ENV'` return `deny` from `.agro/hooks/deny-env-dump.sh`.
- [ ] `jq '.env' .claude/settings.json` returns `allow` from `.agro/hooks/deny-env-dump.sh`.
- [ ] `docker inspect --format 'json' web` and `docker inspect -f 'json' web` return `deny` from `.agro/hooks/deny-env-dump.sh`.
- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no new red compared with `development` at `90707bd`.

## Lessons

Filled by the advisor before undraft.
