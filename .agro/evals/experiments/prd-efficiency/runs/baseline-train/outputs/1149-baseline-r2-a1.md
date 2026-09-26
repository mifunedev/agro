# PRD: Bash guard false positives

Status: DRAFT

## User Stories

### US-001: Match shell-history access, not the bare word

**Description:** As an agent, I want the Bash guard to deny only shell-history access so that a commit message that contains the word `history` runs.

**Acceptance Criteria:**

- [ ] The new probe `.agro/evals/probes/bash-guard-false-positives.sh` exists, and the probe exits 1 against the unchanged hook.
- [ ] The hook returns no decision for `git commit -m "record history of X"`.
- [ ] The hook returns no decision for `git commit -m "apply task-history signal"`.
- [ ] The hook returns `deny` for `cat ~/.zsh_history`.
- [ ] The hook returns `deny` for `cat ~/.bash_history`.
- [ ] The hook returns `deny` for `history`.
- [ ] The hook returns `deny` for `ls; history | tail`.
- [ ] The hook returns `deny` for `fc -l`.
- [ ] `bash .agro/evals/probes/bash-guard-false-positives.sh` exits 0 after the change.

### US-002: Match `.env` paths, not a `jq` filter key

**Description:** As an agent, I want the Bash guard to ignore a `jq` filter key named `env` so that I can read `.claude/settings.json` with `jq`.

**Acceptance Criteria:**

- [ ] The probe gains the cases below, and the probe exits 1 before the hook change.
- [ ] The hook returns no decision for `jq '.env' .claude/settings.json`.
- [ ] The hook returns no decision for `jq '.env // {}' .claude/settings.json`.
- [ ] The hook returns no decision for `jq -r '.env' .claude/settings.json`.
- [ ] The hook returns `deny` for `cat .env`.
- [ ] The hook returns `deny` for `jq . .env`.
- [ ] The hook returns `deny` for `jq '.x' .env`.
- [ ] The hook returns no decision for `cat .example.env`.
- [ ] `bash .agro/evals/probes/bash-guard-false-positives.sh` exits 0 after the change.

### US-003: Document the narrowed guard

**Description:** As an operator, I want the security documentation and the changelog to state the narrowed match so that the documented guard matches the hook.

**Acceptance Criteria:**

- [ ] The "Command guard" section of `docs/security-considerations.md` states that the history tier matches `history` and `fc -l` only in command position.
- [ ] The "Command guard" section of `docs/security-considerations.md` states that the path tier ignores the first quoted filter argument of `jq`.
- [ ] `CHANGELOG.md` holds one `### Fixed` entry under `## [Unreleased]` that links issue [#1149](https://github.com/mifunedev/agro/issues/1149).

## Summary

The operator reported this defect in issue #1149. Two tiers of `.agro/hooks/deny-env-dump.sh` deny benign commands. The planning session verified each false positive below against the hook.

- `DENY+='|\bhistory\b'` at line 23 matches the word `history` anywhere in the command string. A quoted commit message therefore triggers the deny.
- `SECRET_PATH` at line 42 matches `\.env[^[:space:]/"']*` with no left boundary. `READ_CMD` at line 72 includes `jq`. The filter `'.env'` therefore reads as an env file path, and the basename allowlist at lines 99-110 does not exempt the filter.

The planning session ran the hook against each command in the stories. Each command returned `deny`. The existing probes `docker-inspect-env-guard.sh`, `operator-config-guard.sh`, and `devtcp-hook.sh` exit 0 today.

Selected approach:

1. Replace `\bhistory\b` and `\bfc[[:space:]]+-l` with a command-position match. A command position is the start of the string or a point after `;`, `&`, `|`, `(`, `{`, a backtick, or `$(`. Optional whitespace and one optional prefix word (`builtin`, `command`, `exec`, `sudo`) can come before the command word.
2. Keep the `SECRET_PATH` entries for `.bash_history`, `.zsh_history`, and the other history files. These entries continue to deny a read of a history file.
3. Before the `SECRET_PATH_DENY` match, remove the first quoted argument that follows `jq` and its short or long flags. Replace the argument with a neutral placeholder token. Apply the removal to a copy of the command that only the path tier reads.

`.codex/hooks/deny-env-dump.sh` calls the shared hook. `.claude/hooks` is a symlink to `.agro/hooks`. The change therefore reaches both harnesses from one file.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` (history and `fc -l` entries, lines 23-24) | Change the history match to command position. |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH_DENY` match (line 98), `env_tokens` scan (line 100) | Evaluate both against a command copy without the `jq` filter argument. |
| `.agro/evals/probes/bash-guard-false-positives.sh` | new probe | Pin the allow and deny cases of both stories. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `decision_for`, `assert` | Pattern to copy for the new probe. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | No change. The wrapper calls the shared hook. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| PreToolUse `Bash` hook decision | Modify | The hook allows the benign commands in US-001 and US-002. |
| `docs/security-considerations.md` | Modify | State the command-position and `jq` filter rules. |
| `CHANGELOG.md` | Modify | Add one `### Fixed` entry. |

## Storage

N/A. The hook is stateless. The hook reads one JSON payload from stdin and writes one decision to stdout.

## Architectural Decisions

- **Source of truth:** `.agro/hooks/deny-env-dump.sh` owns the Bash guard. Do not edit `.claude/hooks/` or `.codex/hooks/deny-env-dump.sh`.
- **History threat model:** The leak is the history file on disk. The path tier keeps the deny for a read of each history file. The command tier keeps the deny for `history` and `fc -l` in command position.
- **Accepted gap:** `bash -c 'history'` becomes allowed, because a quote comes before the command word. A non-interactive shell does not load history by default. A read of the history file stays denied.
- **Accepted residual false positive:** A quoted message such as `"fix; history"` still triggers the deny, because `;` comes before the word. Use `git commit -F <file>` for such a message.
- **No quote stripping for the path tier:** A general removal of quoted text would allow `cat ".env"`. Remove only the `jq` filter argument.
- **State management:** None.
- **Auth / scoping:** N/A.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/bash-guard-false-positives.sh` | allow `git commit -m "record history of X"`; allow `git commit -m "apply task-history signal"` | The history word in a quoted argument does not trigger the deny. |
| `.agro/evals/probes/bash-guard-false-positives.sh` | deny `history`; deny `ls; history \| tail`; deny `fc -l`; deny `cat ~/.zsh_history`; deny `cat ~/.bash_history` | Shell-history access stays denied. |
| `.agro/evals/probes/bash-guard-false-positives.sh` | allow `jq '.env' .claude/settings.json`; allow `jq '.env // {}' .claude/settings.json`; allow `jq -r '.env' .claude/settings.json` | A `jq` filter key does not trigger the path deny. |
| `.agro/evals/probes/bash-guard-false-positives.sh` | deny `cat .env`; deny `jq . .env`; deny `jq '.x' .env`; allow `cat .example.env` | Env file reads stay denied, and the template allowlist holds. |
| `.agro/evals/probes/docker-inspect-env-guard.sh`, `.agro/evals/probes/operator-config-guard.sh`, `.agro/evals/probes/devtcp-hook.sh` | existing cases | The change does not regress the other guard tiers. |

The implementation owner writes the probe cases first. Each probe case must fail against the unchanged hook before the hook changes.

## Design Principles

- Change one file of behavior: `.agro/hooks/deny-env-dump.sh`.
- Narrow each match. Do not remove a deny tier.
- Write the failing probe before the hook change.
- Add no explanatory comments to the hook. The probe carries the header fields that the eval runner reads.
- Follow the shape of `.agro/evals/probes/docker-inspect-env-guard.sh`.

## Out of Scope

- The `git checkout --` deny from `cc-safety-net`. That guard is a separate tool.
- `yq` filter keys. The same false positive can occur for `yq`. The issue names only `jq`.
- `.agro/hooks/deny-secret-paths.sh`. The file tools pass paths, not filters, so the defect does not apply.
- A shell parser for the hook.
- A `mifunedev/agro-web` change. The public site does not describe the guard patterns.

## Open Questions

None.

## Acceptance Criteria

- [ ] `git commit -m "record history of X"` is allowed, and `cat ~/.zsh_history` is still denied.
- [ ] `jq '.env' .claude/settings.json` is allowed, and `cat .env` is still denied.
- [ ] `bash .agro/evals/probes/bash-guard-false-positives.sh` exits 0.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `bash .agro/evals/probes/operator-config-guard.sh` exits 0.
- [ ] `bash .agro/evals/probes/devtcp-hook.sh` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `git diff --name-only` lists no file under `.claude/hooks/` or `.codex/hooks/`.
- [ ] `CHANGELOG.md` holds the `#1149` entry.

## Lessons

Filled by the advisor before undraft.
