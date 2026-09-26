# PRD: Secret guard false positives

Status: DRAFT

## User Stories

### US-001: Match shell-access words only in command position

**Description:** As an agent, I want quoted words to pass the guard so that benign commit messages run.

**Acceptance Criteria:**

- [ ] A red test first shows that the hook denies `git commit -m "record history of X"`.
- [ ] After the fix, `.agro/hooks/deny-env-dump.sh` emits no decision for `git commit -m "record history of X"`.
- [ ] The hook still denies `history`, `history | tail`, `fc -l`, and `cat ~/.zsh_history`.

### US-002: Match env files only as file paths

**Description:** As an agent, I want jq filter keys to pass the guard so that settings reads run.

**Acceptance Criteria:**

- [ ] A red test first shows that the hook denies `jq '.env' .claude/settings.json`.
- [ ] After the fix, the hook emits no decision for `jq '.env' .claude/settings.json` and for `jq '.env // {}' .claude/settings.json`.
- [ ] The hook still denies `cat .env`, `cat ./app/.env.local`, and `jq . .env`.
- [ ] The hook still allows `cat .env.example`.

## Summary

The Bash guard is `.agro/hooks/deny-env-dump.sh`. The `DENY` pattern at line 23 is `\bhistory\b`. That pattern matches the word anywhere, also inside a quoted commit message. The `SECRET_PATH` pattern at line 42 matches any `.env` token. The token loop at line 100 then treats a jq filter such as `'.env'` as a file. This plan narrows both matches. The history rule matches `history` and `fc -l` only at a command start: line start, or after `;`, `&`, `|`, `(`, or `$(`. The history-file paths stay in `SECRET_PATH` lines 66 to 70. The env rule ignores the filter argument of `jq` before the path match. The deny messages stay unchanged. A new probe proves the allow and deny cases.

## Key Integration Points
| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` line 23 | Change the history rule to command position and add `fc -l`. |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH`, `SECRET_PATH_DENY`, env token loop at line 100 | Skip the jq filter argument before the `.env` path match. |
| `.codex/hooks/deny-env-dump.sh` | provider mirror | Do not edit. Confirm that the mirror resolves to the canonical hook. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | existing probe | Pattern for the new probe. The probe must stay green. |
| `.agro/evals/probes/operator-config-guard.sh` | existing probe | The probe must stay green. |

## Interface Integration Points
| Surface | Change Type | Description |
|---|---|---|
| PreToolUse Bash hook | Behavior | The hook emits no decision for the two false-positive commands. All other decisions stay the same. |

## Storage

N/A. The hook is stateless.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` is the one source of truth. Provider mirrors receive the change through symlinks.
- The fix narrows the match. The fix adds no allow list and no new deny message.
- Shell-history files stay denied by `SECRET_PATH`, independent of the command word.
- The hook identifies the jq filter as the first argument after `jq` that is not an option. The hook removes that argument before the `.env` path match. A later file argument such as `.env` stays in scope.

## Test Plan (TDD)
| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/evals/probes/secret-guard-false-positives.sh` | the hook allows a commit message with the word history; the hook denies `history`, `fc -l`, and `cat ~/.zsh_history` | US-001 |
| new file `.agro/evals/probes/secret-guard-false-positives.sh` | the hook allows `jq '.env' .claude/settings.json` and `cat .env.example`; the hook denies `cat .env` and `jq . .env` | US-002 |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | all existing cases | No regression |
| `.agro/evals/probes/operator-config-guard.sh` | all existing cases | No regression |

## Design Principles

- Change the canonical `.agro/` hook. Do not patch a provider mirror.
- Prefer the smallest regex change that removes the false positive.
- Keep every existing deny case denied. A missed secret costs more than a false positive.
- Add no comments to tracked code.

## Out of Scope

- The Read-tool hook `.agro/hooks/deny-secret-paths.sh`.
- The deny list in `.claude/settings.json`.
- The `git checkout --` guard that the issue mentions in passing.
- Changes to the deny message text.

## Open Questions

1. Must the probe run the hook through the provider mirror path as well as the canonical path? The default is the canonical path only.
2. Does `docs/security-considerations.md` describe the history rule in words that the new rule makes wrong? The implementer checks the file and updates the matching sentence.

## Acceptance Criteria

- [ ] The new file `.agro/evals/probes/secret-guard-false-positives.sh` exits 0 when `bash` runs it.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `bash .agro/evals/probes/operator-config-guard.sh` exits 0.
- [ ] The diff changes no file under `.codex/hooks` and no file under `.claude/hooks`.

## Lessons

Filled by the advisor before undraft.
