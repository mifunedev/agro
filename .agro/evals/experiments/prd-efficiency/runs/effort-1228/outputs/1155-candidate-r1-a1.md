# PRD: Close the secret-guard interpreter and search-pattern gaps

Status: DRAFT

Issue: [#1155](https://github.com/mifunedev/agro/issues/1155) (found during #1150, PR #1154)

## User Stories

### US-001: Deny an interpreter command that dumps the process environment

**Description:** As an operator, I want the Bash guard to deny an inline interpreter environment dump so that an agent cannot print secrets.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 1 on `python3 -c 'import os; print(dict(os.environ))'`. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `python3 -c 'import os; print(dict(os.environ))'`, `perl -e 'print "$_=$ENV{$_}\n" for keys %ENV'`, and `node -e 'console.log(process.env)'`.
- [ ] The probe asserts `allow` for `python3 -c 'import os; print(os.environ["HOME"])'` and `node -e 'console.log(process.env.HOME)'`.
- [ ] The probe builds each sensitive token from shell variables, so that the probe source passes the guard.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

### US-002: Allow a search pattern that contains `.env`

**Description:** As an agent, I want the secret-path check to match `.env` only at the start of a path component so that `grep process.env src/index.ts` runs.

**Acceptance Criteria:**

- [ ] Before the hook change, the probe exits 1 on `grep process.env src/index.ts`. The evidence records the command and the exit status.
- [ ] The probe asserts `allow` for `grep process.env src/index.ts` and `grep "Config.Env" README.md`.
- [ ] The probe asserts `deny` for `grep TOKEN .env`, `cat .env`, and `cat ./app/.env.local`.
- [ ] Every existing assertion in `secret-exposure-guard.sh` still passes.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] `CHANGELOG.md` `[Unreleased]` `### Fixed` has one entry that links #1155, and the entry is at most 250 characters.

## Summary

The hook `.agro/hooks/deny-env-dump.sh` reads the Bash command from `tool_input.command` and tests the command against ordered checks.

Verified current state:

- The `DENY` list has no term for inline interpreter code. The issue reports that `python3 -c` and `perl -e` environment dumps return `allow`.
- `SECRET_PATH` starts with `\.env[^[:space:]/"']*` and has no left boundary. `SECRET_PATH_DENY` runs with `grep -qEi`. `grep process.env` and `grep "Config.Env"` therefore match `grep` followed by `.env`.
- The example exemption loop uses the same unbounded `.env` token pattern.

Selected approach:

1. Add an `INTERP_ENV` check. The check applies only to the text after an inline-code flag (`-c` or `-e`) of `python`, `python3`, `perl`, `node`, or `ruby`. The check denies a whole-environment read: `os.environ` without a following `[` or `.get(`, `%ENV`, `process.env` without a following `.` or `[`, and `ENV` without a following `[`.
2. Anchor the `.env` alternative of `SECRET_PATH` to the start of a path component: `(^|[^A-Za-z0-9_])\.env`. Apply the same anchor to the `env_tokens` pattern.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY`, new `INTERP_ENV` check, deny `if` chain | Denies interpreter environment dumps |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH`, `SECRET_PATH_DENY`, `env_tokens` loop | Matches env-file paths |
| `.agro/evals/probes/secret-exposure-guard.sh` | `decision_for`, `assert` | Asserts both directions |
| `.codex/hooks/deny-env-dump.sh` | provider link | Resolves to the canonical hook through `.agro/scripts/link-providers.sh` |
| `CHANGELOG.md` | `[Unreleased]` `### Fixed` | Records the fix |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Bash `PreToolUse` hook decision | Behavior | New `deny` for interpreter environment dumps. New `allow` for `.env` inside a search pattern. |

## Storage

N/A. The hook is stateless.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` stays the single source of truth. The task edits no provider mirror.
- The interpreter check reads only inline-code arguments. A search pattern such as `grep process.env` stays outside that check.
- Single-key reads stay allowed. The guard targets bulk environment dumps, consistent with the existing `printenv NAME` `ask` rule.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-exposure-guard.sh` | `python3 -c`, `perl -e`, `node -e` dumps return `deny` | US-001 |
| `.agro/evals/probes/secret-exposure-guard.sh` | single-key `os.environ["HOME"]` and `process.env.HOME` return `allow` | US-001 |
| `.agro/evals/probes/secret-exposure-guard.sh` | `grep process.env src/index.ts` and `grep "Config.Env" README.md` return `allow` | US-002 |
| `.agro/evals/probes/secret-exposure-guard.sh` | `grep TOKEN .env` and existing env-file reads return `deny` | US-002 |
| `bash .claude/skills/eval/run.sh` | full probe suite | No new red |

## Design Principles

- Apply the smallest regex change that closes each gap.
- Keep one canonical hook. Run the link check after the edit.
- Add no explanatory comments to the hook.
- Drive the probe REGRESSION branch against a disposable broken hook copy, per `.agro/evals/AGENTS.md`.

## Out of Scope

- An interpreter that reads a script file, for example `python3 dump.py`.
- A full shell parser for the hook.
- The `jq --arg` note text that names a guarded command. The issue names this case without a required behavior.

## Open Questions

1. Does the `jq --arg` note case require a fix in this task? This plan defers the case.
2. Does the interpreter list need entries beyond `python`, `python3`, `perl`, `node`, and `ruby`?

## Acceptance Criteria

- [ ] The `python3 -c` and `perl -e` environment dumps from #1155 return `deny`.
- [ ] `grep process.env src/index.ts` returns `allow`, and `grep TOKEN .env` returns `deny`.
- [ ] `.agro/evals/probes/secret-exposure-guard.sh` asserts both directions and exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no new red.

## Lessons

Filled by the advisor before undraft.
