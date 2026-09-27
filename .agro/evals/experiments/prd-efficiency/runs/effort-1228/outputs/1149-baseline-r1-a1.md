# PRD: Secret guard false positives

Status: DRAFT

## User Stories

### US-001: Match shell-history access at command position only

**Description:** As an agent, I want the Bash guard to deny the `history` builtin and allow the word `history` inside an argument. Then commit messages and searches that name the word run without a workaround.

**Acceptance Criteria:**

- [ ] Red test first: the new probe `.agro/evals/probes/bash-guard-trigger-words.sh` asserts `allow` for `git commit -m "record history of X"`. The probe exits 1 against the unchanged hook.
- [ ] The probe asserts `allow` for `git commit -m "apply task-history signal"` and for `git grep -n -i 'history' -- .agro/hooks`.
- [ ] The probe asserts `deny` for each of these commands: `history`, `history | tail`, `ls; history`, `echo $(history)`, `builtin history`, `fc -l`, `cat ~/.zsh_history`, `tail ~/.bash_history`.
- [ ] The probe asserts `deny` for a two-line command whose second line is `history`.
- [ ] `bash .agro/evals/probes/bash-guard-trigger-words.sh` exits 0 after the change to `.agro/hooks/deny-env-dump.sh`.

### US-002: Exclude the jq and yq filter argument from the secret-path scan

**Description:** As an agent, I want the Bash guard to ignore a jq or yq filter that names the key `env`. Then I can read non-secret JSON such as `.claude/settings.json`.

**Acceptance Criteria:**

- [ ] Red test first: the probe asserts `allow` for `jq '.env' .claude/settings.json` and for `jq '.env // {}' .claude/settings.json`. The probe exits 1 against the hook from US-001.
- [ ] The probe asserts `allow` for `jq -r '.env | keys' .claude/settings.json`.
- [ ] The probe asserts `deny` for each of these commands: `cat .env`, `jq . .env`, `jq '.env' .env`, `yq '.env' .env.local`, `grep KEY .env`.
- [ ] The probe asserts `allow` for `cat .env.example`, which keeps the template allowlist intact.
- [ ] `bash .agro/evals/probes/bash-guard-trigger-words.sh` exits 0 after the change to `.agro/hooks/deny-env-dump.sh`.

### US-003: Document the narrowed patterns

**Description:** As an operator, I want the security documentation to state the narrowed patterns, so that the documented guard matches the hook.

**Acceptance Criteria:**

- [ ] The command-guard entry in `docs/security-considerations.md` states that the guard denies `history` at command position only.
- [ ] The same entry states that the guard skips the jq or yq filter argument during the secret-path scan.
- [ ] `CHANGELOG.md` holds one entry for this fix that names issue #1149.
- [ ] `bash .agro/evals/probes/changelog-entry-length.sh` exits 0.

## Summary

Issue #1149 reports two false positives in the Bash secret-exposure guard. The guard is `.agro/hooks/deny-env-dump.sh`. Claude Code reaches the guard through the symlink `.claude/hooks -> ../.agro/hooks`. Codex reaches the guard through the wrapper `.codex/hooks/deny-env-dump.sh`, which calls `.claude/hooks/deny-env-dump.sh`.

Verified current state:

- `deny-env-dump.sh:23` adds the pattern `\bhistory\b` to `DENY`. The pattern matches the word anywhere in the command text. During this planning session, the guard denied `git grep -n -i 'history' -- .agro/hooks`.
- `deny-env-dump.sh:11` replaces each newline with a space before any match. A command-position match must treat a newline as a command separator.
- `deny-env-dump.sh:42` starts `SECRET_PATH` with `\.env[^[:space:]/"']*`. `deny-env-dump.sh:73` joins `READ_CMD` and `SECRET_PATH` into `SECRET_PATH_DENY`. `READ_CMD` at line 72 includes `jq`, `yq`, and `grep`. So `jq '.env' .claude/settings.json` matches as a secret-file read.
- `deny-env-dump.sh:66-70` already denies `.bash_history`, `.zsh_history`, and other history files through `SECRET_PATH_DENY`. The `\bhistory\b` pattern does not match these paths, because `_` is a word character.
- `deny-env-dump.sh:8` strips heredoc bodies before the match. This behavior stays unchanged.

Selected approach:

1. Replace `\bhistory\b` with a pattern that matches `history` at command position. Command position is the start of the command, or the text after `;`, `&`, `|`, `(`, a backtick, `$(`, or a newline. An optional `builtin` or `command` prefix counts as command position.
2. Before the `SECRET_PATH_DENY` match, remove the first quoted argument that follows `jq` or `yq` and its option flags. The file arguments stay in the scanned text.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` line 23, newline flatten line 11 | Holds the `history` pattern to narrow |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH`, `READ_CMD`, `SECRET_PATH_DENY` lines 42-73, branch at line 98 | Holds the secret-path scan to narrow for jq and yq filters |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Calls the canonical hook; needs no change |
| `.claude/settings.json` | PreToolUse `Bash` hook at line 94 | Wires the canonical hook; needs no change |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `decision_for`, `assert` | Existing hook probe; gives the pattern for the new probe |
| `.agro/evals/probes/operator-config-guard.sh` | whole probe | Existing hook probe; must stay green |
| `docs/security-considerations.md` | command-guard entry, lines 56-61 | Documents the guard patterns |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| PreToolUse `Bash` hook decision | Behavior narrowed | The guard allows `history` inside an argument and a jq or yq filter that names `env` |
| Deny reason strings | Unchanged | The emitted text for each deny stays byte-identical |

## Storage

N/A. The hook is stateless. The hook reads one JSON event from stdin and writes one decision to stdout.

## Architectural Decisions

- The canonical source is `.agro/hooks/deny-env-dump.sh`. The Claude symlink and the Codex wrapper pick up the change without an edit.
- The fix narrows two patterns only. Every other pattern in `DENY`, `DOCKER_INSPECT`, `OPERATOR_PATH`, and `SECRET_PATH` keeps its current match set.
- When the guard cannot tell a filter from a path, the guard denies. An unquoted filter such as `jq .env file.json` stays denied.
- The file-tool guard `.agro/hooks/deny-secret-paths.sh` matches whole paths, not command text. That guard needs no change.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/bash-guard-trigger-words.sh` | `history` in a quoted argument or a search pattern: `allow` | US-001 false positive |
| `.agro/evals/probes/bash-guard-trigger-words.sh` | `history` at command position, `fc -l`, history-file reads: `deny` | US-001 keeps the protection |
| `.agro/evals/probes/bash-guard-trigger-words.sh` | quoted jq filter that names `env` on `.claude/settings.json`: `allow` | US-002 false positive |
| `.agro/evals/probes/bash-guard-trigger-words.sh` | `.env` file argument to `cat`, `jq`, `yq`, `grep`: `deny`; `.env.example`: `allow` | US-002 keeps the protection |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | existing cases | No regression in the inspect guard |
| `.agro/evals/probes/operator-config-guard.sh` | existing cases | No regression in the operator-path guard |
| `.agro/scripts/__tests__/hermes-links.test.ts` | existing cases | Hook links still resolve |

Run the full check with `bash .claude/skills/eval/run.sh --tier A` and `npm test -- .agro/scripts/__tests__/hermes-links.test.ts`.

## Design Principles

- Change the canonical `.agro/hooks/` source. Do not patch `.claude/hooks` or `.codex/hooks`.
- Narrow a pattern only as far as the issue requires. A false negative leaks a credential; a false positive costs one reworded command.
- Write no explanatory comments in the hook. The probe cases state the intent.
- Write the red test before the hook change.

## Out of Scope

- A general shell parser for the guard.
- An allowlist for a search pattern that names `.env`, such as `git grep -n 'cat .env'`. The guard denied this shape during this planning session. Open Questions tracks the shape.
- The guard that denied `git checkout --` in #1147. The issue names that guard as related but gives no expected behavior.
- Changes to `.agro/hooks/deny-secret-paths.sh`.
- Changes to the public documentation in `mifunedev/agro-web`. The guard is internal harness behavior.

## Open Questions

1. The guard denies a `grep` or `git grep` search pattern that names `.env` as text. Does the operator want a follow-up issue for that shape?
2. The guard does not deny a read through `$HISTFILE`. Does the operator want a follow-up issue for that shape?

## Acceptance Criteria

- [ ] `bash .agro/evals/probes/bash-guard-trigger-words.sh` exits 0.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `bash .agro/evals/probes/operator-config-guard.sh` exits 0.
- [ ] `bash .claude/skills/eval/run.sh --tier A` reports no REGRESSION row.
- [ ] `npm test -- .agro/scripts/__tests__/hermes-links.test.ts` exits 0.
- [ ] `git diff --stat` lists no file under `.claude/hooks` or `.codex/hooks`.

## Lessons

Filled by the advisor before undraft.
