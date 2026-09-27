# PRD: Secret guard false positives on trigger words

Status: DRAFT

## User Stories

### US-001: Match shell-history access, not the bare word

**Description:** As an application agent, I want the Bash guard to deny shell-history reads only so that a commit message that holds the word `history` runs.

**Acceptance Criteria:**

- [ ] A red test in `.agro/evals/probes/secret-guard-false-positives.sh` feeds `git commit -m "record history of X"` to `.agro/hooks/deny-env-dump.sh`. The test fails before the fix and passes after the fix.
- [ ] The hook emits no decision for `git commit -m "record history of X"`.
- [ ] The hook emits `deny` for `history`, `history | tail`, `fc -l`, and `cat ~/.zsh_history`.
- [ ] The hook emits `deny` for `cat ~/.bash_history`.

### US-002: Match env file paths, not a jq key

**Description:** As an application agent, I want the Bash guard to deny `.env` file reads only so that a `jq` filter on the `env` key runs.

**Acceptance Criteria:**

- [ ] The probe feeds `jq '.env' .claude/settings.json` and `jq '.env // {}' .claude/settings.json` to the hook. The hook emits no decision for either command.
- [ ] The hook emits `deny` for `cat .env`, `cat .env.local`, `cat app/.env`, and `jq . .env`.
- [ ] The hook emits no decision for `cat .env.example`.

### US-003: Keep existing guard probes green

**Description:** As the operator, I want the existing guard probes to pass so that the fix removes no protection.

**Acceptance Criteria:**

- [ ] `bash .agro/evals/probes/operator-config-guard.sh` exits 0.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `bash .agro/evals/probes/secret-guard-false-positives.sh` exits 0.

## Summary

Issue #1149 reports two false positives in the Bash guard. The guard is `.agro/hooks/deny-env-dump.sh`. The `DENY` pattern at line 23 is `\bhistory\b`. That pattern matches the word anywhere in the command text, quoted arguments included. The `SECRET_PATH` pattern at line 42 is `\.env[^[:space:]/"']*`. The `SECRET_PATH_DENY` pattern joins that pattern to `READ_CMD`, and `READ_CMD` includes `jq`. So a `jq` filter `.env` matches as an env file path.

The selected approach:

1. Replace `\bhistory\b` with a pattern that matches `history` only at command position. Command position is the start of the command or a position after `;`, `&`, `|`, `(`, or a newline. The pattern also allows arguments after the word.
2. Replace the `.env` alternative with a pattern that matches `.env` only as a path component. The path component starts at a word start or after `/`. The path component ends at a word end or at a `.<suffix>`.
3. For `jq` and `yq`, exclude the first non-flag argument from the path match. That argument is the filter.

The history-file paths in `SECRET_PATH` (lines 66 to 70) stay unchanged. Those paths already deny `cat ~/.zsh_history`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` (line 23 `\bhistory\b`, line 24 `fc -l`) | Shell-history command match |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH` (line 42), `READ_CMD` (line 72), `SECRET_PATH_DENY` (line 73) | Env file path match |
| `.agro/hooks/deny-env-dump.sh` | `env_tokens` loop (lines 100 to 110) | Example, sample, and template allow list |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Codex entry point; must still resolve to the canonical hook |
| `.agro/evals/probes/operator-config-guard.sh` | `decision_for` | Pattern for the new probe |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Bash PreToolUse hook decision | Behavior change | Fewer false `deny` decisions; the deny message stays unchanged |
| `.agro/evals/probes/` | New file | `secret-guard-false-positives.sh` |

## Storage

N/A. The hook is stateless.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` stays the single source of truth. The Codex wrapper is not edited.
- `.agro/hooks/deny-secret-paths.sh` is not changed. That hook checks tool path arguments, not command text, and the issue reports no false positive there.
- The probe follows the tier-A probe shape of `operator-config-guard.sh`: exit 0 for PASS, exit 1 for REGRESSION, exit 2 for SKIPPED.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-guard-false-positives.sh` | `git commit -m "record history of X"` allow; `history`, `history \| tail`, `fc -l`, `cat ~/.zsh_history`, `cat ~/.bash_history` deny | US-001 |
| `.agro/evals/probes/secret-guard-false-positives.sh` | `jq '.env' .claude/settings.json`, `jq '.env // {}' .claude/settings.json`, `cat .env.example` allow; `cat .env`, `cat .env.local`, `cat app/.env`, `jq . .env` deny | US-002 |
| `.agro/evals/probes/operator-config-guard.sh`, `.agro/evals/probes/docker-inspect-env-guard.sh` | existing cases | US-003 |

## Design Principles

- Change the smallest set of patterns that fixes the two false positives.
- Remove no deny case that a current probe covers.
- Add no tracked comments, per `AGENTS.md` principle 5.
- Pass hook input to the probe through a file, so that the probe command itself does not trip the guard.

## Out of Scope

- The `git checkout --` denial that the issue mentions. The issue names that denial as a related guard and gives no acceptance criterion for it.
- Changes to `.agro/hooks/deny-secret-paths.sh`.
- A full shell parser for the hook.

## Open Questions

1. The guard sees `history` in a quoted argument at command position, for example `bash -c "history"`. Must the guard deny that form? This plan denies the form only when `history` follows `;`, `&`, `|`, `(`, a newline, or a quote at the start of a `-c` argument. <operator decision>
2. Must `jq` read of a real `.env` file stay denied when the filter is `.env`, for example `jq '.env' .env`? This plan denies that command, because the second argument is an env file path.

## Acceptance Criteria

- [ ] `git commit -m "record history of X"` gets no decision from the hook; `cat ~/.zsh_history` gets `deny`.
- [ ] `jq '.env' .claude/settings.json` gets no decision from the hook; `cat .env` gets `deny`.
- [ ] Each existing guard probe in `.agro/evals/probes/` exits 0.

## Lessons

Filled by the advisor before undraft.
