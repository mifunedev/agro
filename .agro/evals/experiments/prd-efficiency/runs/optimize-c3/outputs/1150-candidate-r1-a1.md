# PRD: Close env-guard false allows for jq env and quoted docker json

Status: DRAFT

## User Stories

### US-001: Deny jq filters that read the environment

**Description:** As an operator, I want the guard to deny jq environment reads so that secrets stay out of transcripts.

**Acceptance Criteria:**

- [ ] The hook `.agro/hooks/deny-env-dump.sh` emits `permissionDecision: "deny"` for the command `jq -n 'env'`.
- [ ] The hook emits `deny` for the command `jq -n '$ENV'`.
- [ ] The hook emits `deny` for the command `jq -n env`.
- [ ] The hook emits no output for the command `jq '.env' .claude/settings.json`.
- [ ] The probe `.agro/evals/probes/secret-exposure-guard.sh` asserts the three deny cases and the allow case.
- [ ] Before the hook fix, the new probe assertions exit 1. After the hook fix, the probe exits 0.

### US-002: Deny single-quoted docker inspect json formats

**Description:** As an operator, I want every quoted json format denied so that `Config.Env` stays hidden.

**Acceptance Criteria:**

- [ ] The hook emits `deny` for the command `docker inspect --format 'json' web`.
- [ ] The hook emits `deny` for the command `docker inspect -f 'json' web`.
- [ ] The hook still emits `deny` for `docker inspect --format json web` and for the double-quoted form.
- [ ] The hook emits no output for `docker inspect --format '{{json .State.Health}}' agro`.
- [ ] The probe `.agro/evals/probes/docker-inspect-env-guard.sh` asserts both single-quoted forms.
- [ ] Before the hook fix, the new probe assertions exit 1. After the hook fix, the probe exits 0.

## Summary

The hook `.agro/hooks/deny-env-dump.sh` has two false allows.

First, the `DENY` terms at lines 15 and 16 match a bare `env` only before `|`, `>`, `;`, `&`, or the end of the command. A quote after `env` matches no term. No term names `$ENV`. The fix adds one `DENY` term for a jq call whose filter reads the `env` builtin or `$ENV`. The term excludes a `.env` field access.

Second, line 39 writes the quote class as `["\x27]` inside a single-quoted bash string. `grep -E` reads that class as literal characters, so a single quote never matches. The fix builds that term in a double-quoted string with the class `[\"']`.

The issue gives the reproduction commands. Each story turns them into red probe assertions first.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` (lines 15-33) | Add the jq environment-read term. |
| `.agro/hooks/deny-env-dump.sh` | `DOCKER_FMT_UNSAFE` (line 39) | Fix the quote class for the `json` format value. |
| `.agro/hooks/deny-env-dump.sh` | `mask_jq_filters`, `SECRET_PATH_DENY` | Keep unchanged. The #1149 allow for `jq '.env' .claude/settings.json` depends on these symbols. |
| `.agro/evals/probes/secret-exposure-guard.sh` | assertions | Add the jq deny and allow cases. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `assert` | Add the two single-quoted json cases. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Bash `PreToolUse` hook | Behavior | The hook denies four more command shapes. The deny messages stay unchanged. |

## Storage

N/A. The hook is stateless.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` stays the single source of truth for the guard. Provider mirrors link to the file.
- The jq term goes into `DENY`, so the existing secret-exposure deny message covers the term.
- The jq term matches `env` only when a character outside `[A-Za-z0-9_.$]` precedes `env` and a word boundary follows `env`. The rule keeps `.env` fields and names such as `envfile` allowed.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-exposure-guard.sh` | deny `jq -n 'env'`, `jq -n '$ENV'`, `jq -n env`; allow `jq '.env' .claude/settings.json` | US-001 |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | deny `docker inspect --format 'json' web`, `docker inspect -f 'json' web` | US-002 |
| `.agro/skills/eval/run.sh` | full probe suite | No new REGRESSION. |

Follow the fault-injection rule in `.agro/evals/AGENTS.md`. Drive each new assertion red against the unfixed hook before the fix lands. Use the file-fixture driver pattern for commands that hold quotes or `$`.

## Design Principles

- Change the smallest set of regex terms that closes each gap.
- Add no comments to tracked code.
- Keep each probe a deterministic 3-state oracle.

## Out of Scope

- A general rewrite of the guard into a parser.
- Other jq builtins that read the environment indirectly, such as `$__loc__` or `input_filename`.
- Changes to the deny message text.

## Open Questions

1. The issue names an eval runner under the .claude skills directory. Git does not track that runner. Git tracks the runner at `.agro/skills/eval/run.sh`. This plan uses the tracked path. Confirm the tracked path.
2. The new term denies `jq -n 'env.HOME'`, a read of one variable. Confirm that the guard must deny the `env.HOME` shape.

## Acceptance Criteria

- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no REGRESSION that the base commit does not report.
- [ ] The diff changes no file outside `.agro/hooks/deny-env-dump.sh` and the two probes.

## Lessons

Filled by the advisor before undraft.
