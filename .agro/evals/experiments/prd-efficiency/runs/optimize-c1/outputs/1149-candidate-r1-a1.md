# PRD: Secret guard false denies on trigger words

Status: DRAFT

## User Stories

### US-001: Match shell-history commands by command position

**Description:** As an agent, I want the guard to allow the word `history` inside a quoted argument so that my commit messages can name the word.

**Acceptance Criteria:**

- [ ] The new file `.agro/evals/probes/secret-guard-trigger-words.sh` exists, is executable, and declares the `# tier:`, `# source:`, and `# desc:` headers.
- [ ] Before the hook change, the probe exits 1 on the case `git commit -m "record history of X"`. This is the red test.
- [ ] The probe asserts `allow` from `.agro/hooks/deny-env-dump.sh` for `git commit -m "record history of X"` and for `git commit -m "apply task-history signal"`.
- [ ] The probe asserts `deny` for `history`, `history | tail -5`, `ls; history`, `echo $(history)`, `fc -l`, and `cat ~/.zsh_history`.
- [ ] After the hook change, `bash .agro/evals/probes/secret-guard-trigger-words.sh` exits 0.

### US-002: Match env-file paths, not jq filter keys

**Description:** As an agent, I want the guard to allow a `jq` filter key named `env` so that I can read `.claude/settings.json`.

**Acceptance Criteria:**

- [ ] Before the hook change, the probe exits 1 on the case `jq '.env // {}' .claude/settings.json`. This is the red test.
- [ ] The probe asserts `allow` for `jq '.env' .claude/settings.json` and for `jq '.env // {}' .claude/settings.json`.
- [ ] The probe asserts `deny` for `cat .env`, `jq -r . .env`, `jq '.env' .env`, and `yq '.env' .env`.
- [ ] The probe asserts `allow` for `cat .env.example`. This case keeps the template exemption.
- [ ] After the hook change, `bash .agro/evals/probes/secret-guard-trigger-words.sh` exits 0.

### US-003: Update the guard documentation and changelog

**Description:** As an operator, I want the security document and the changelog to state the narrowed matches so that the documented guard matches the hook.

**Acceptance Criteria:**

- [ ] `docs/security-considerations.md` states that the command guard matches `history` only at a command position.
- [ ] `docs/security-considerations.md` states that the command guard skips the filter argument of `jq` and `yq` when the guard looks for secret file paths.
- [ ] `docs/security-considerations.md` no longer cites `deny-env-dump.sh:20-23` for the HEREDOC strip. The citation names the current line range.
- [ ] `CHANGELOG.md` holds one new entry that names issue #1149.

## Summary

The Bash guard `.agro/hooks/deny-env-dump.sh` scans the raw command string. Two patterns in that guard deny benign commands.

1. `DENY+='|\bhistory\b'` at line 23 matches the word `history` anywhere in the command. A `git commit -m` message that names the word triggers the deny. The `-` in `task-history` forms a word boundary, so that message also triggers the deny.
2. `SECRET_PATH` at line 42 starts with `\.env` and has no left boundary. `SECRET_PATH_DENY` at line 73 matches when a read command, which includes `jq`, precedes that text. The `jq` filter `.env // {}` matches. The template check at lines 100 to 110 then finds the token `.env` with no `example`, `sample`, or `template` word. The guard denies the command.

The shell-history files stay covered by a second rule. `SECRET_PATH` lines 66 to 70 list `.bash_history`, `.zsh_history`, and the other history files. `SECRET_PATH_DENY` denies a read of each file.

The selected approach has two parts:

1. Replace `\bhistory\b` with a command-position match. The match requires the start of the command, `;`, `&`, `|`, `(`, a backtick, or `$(` ahead of `history`, with optional whitespace between them. A word inside a quoted argument does not match.
2. Compute a copy of the command with the filter argument of `jq` and `yq` removed. The filter argument is the first non-option argument after `jq` or `yq`. Use that copy for the `SECRET_PATH_DENY` match at line 98 and for the env-token scan at line 100. The real file arguments stay in the copy, so `jq '.env' .env` still matches.

No existing probe covers either case. `.agro/evals/probes/operator-config-guard.sh` and `.agro/evals/probes/docker-inspect-env-guard.sh` drive `deny-env-dump.sh` and must stay green.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` line 23 (`\bhistory\b`) | Replace with the command-position match. |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH_DENY`, the `elif` at line 98, `env_tokens` at line 100 | Match against the command copy without the `jq` or `yq` filter argument. |
| `.agro/hooks/deny-env-dump.sh` | the `perl` HEREDOC strip at lines 7 to 9 | Pattern for the filter strip. Use `perl` when present, as the HEREDOC strip does. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Calls the shared hook. No change. The Codex path inherits the fix. |
| `.agro/hooks/deny-secret-paths.sh` | `DENY_PATH` | File-tool guard. No change. The file tools do not receive a command string. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `decision_for`, `assert` | Driver pattern for the new probe. |
| `.agro/evals/probes/operator-config-guard.sh` | command-hook cases | Existing hook test. Must stay green. |
| `docs/security-considerations.md` | section 2, command guard | Documentation of the guard tiers. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| PreToolUse `Bash` hook decision | Behavior narrowed | `history` inside a quoted argument and a `jq` or `yq` filter key `env` no longer produce `deny`. |
| Deny reason strings | None | The emitted reason text stays unchanged. |

## Storage

N/A. The hook is stateless and reads one JSON payload from stdin.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` stays the one source of truth for the Bash guard. `.claude/hooks` is a symlink to `.agro/hooks`, and the Codex wrapper calls the same script.
- The history rule narrows to command position. The history files stay denied through `SECRET_PATH`. A non-interactive shell has no in-memory history, so `bash -c "history"` exposes no data. The guard does not need to deny that form.
- The filter strip removes only the filter argument of `jq` and `yq`. The strip keeps the file arguments. If the strip cannot identify the filter because an option takes a value, such as `--arg name value`, the guard can deny. That result is a false deny, not a leak.
- The `.claude/settings.json` deny list keeps the entry `Bash(command=*history*)`. See Open Questions.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/evals/probes/secret-guard-trigger-words.sh` | allow `git commit -m "record history of X"`, allow `git commit -m "apply task-history signal"` | US-001 quoted word allowed |
| new file `.agro/evals/probes/secret-guard-trigger-words.sh` | deny `history`, `history \| tail -5`, `ls; history`, `echo $(history)`, `fc -l`, `cat ~/.zsh_history` | US-001 history access still denied |
| new file `.agro/evals/probes/secret-guard-trigger-words.sh` | allow `jq '.env' .claude/settings.json`, allow `jq '.env // {}' .claude/settings.json`, allow `cat .env.example` | US-002 filter key and template allowed |
| new file `.agro/evals/probes/secret-guard-trigger-words.sh` | deny `cat .env`, `jq -r . .env`, `jq '.env' .env`, `yq '.env' .env` | US-002 env files still denied |
| `.agro/evals/probes/operator-config-guard.sh` | all existing cases | Existing hook test stays green |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | all existing cases | Existing hook test stays green |

Run each probe with `bash <probe path>`. Each probe must exit 0.

Write the probe with the file-write tool, not a Bash heredoc. The guard scans each Bash command, so a heredoc that holds the trigger words can trip the guard. Hold the trigger words in shell variables inside the probe, as `.agro/evals/probes/docker-inspect-env-guard.sh` holds `ENV_FIELD`. Drive the REGRESSION branch once against the unchanged hook before the fix, as `.agro/evals/AGENTS.md` requires.

## Design Principles

- Keep one source of truth for each policy. Change only the shared hook.
- Narrow a match to the access shape. Do not add an allowlist of messages.
- Prefer a false deny over a leak when the parse is uncertain.
- Add no comments to tracked code. The probe cases state the intent.

## Out of Scope

- The `git checkout --` deny that issue #1149 mentions. The issue names no pattern or acceptance criterion for that deny.
- Changes to `.agro/hooks/deny-secret-paths.sh`.
- Changes to the `permissions.deny` list in `.claude/settings.json`.
- A shell parser for the command string.
- Public documentation in `mifunedev/agro-web`. The change narrows internal guard behavior and adds no user-facing term.

## Open Questions

1. `.claude/settings.json` holds the deny entry `Bash(command=*history*)`. `docs/security-considerations.md` states that `bypassPermissions` skips the deny list. If a session runs in another permission mode, that entry still denies `git commit -m "record history of X"`. Decide whether this task narrows that entry. The default is no change.
2. The issue mentions a related guard that denied `git checkout --`. Decide whether that deny needs a separate issue.

## Acceptance Criteria

- [ ] `bash .agro/evals/probes/secret-guard-trigger-words.sh` exits 0.
- [ ] `bash .agro/evals/probes/operator-config-guard.sh` exits 0.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `git commit -m "record history of X"` produces no `deny` from `.agro/hooks/deny-env-dump.sh`, and `cat ~/.zsh_history` produces `deny`.
- [ ] `jq '.env' .claude/settings.json` produces no `deny` from `.agro/hooks/deny-env-dump.sh`, and `cat .env` produces `deny`.
- [ ] `git diff` shows no change under `.agro/hooks/` other than `.agro/hooks/deny-env-dump.sh`.

## Lessons

Filled by the advisor before undraft.
