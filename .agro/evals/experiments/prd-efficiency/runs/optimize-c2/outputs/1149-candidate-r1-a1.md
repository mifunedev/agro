# PRD: Secret guard false positives on quoted words

Status: DRAFT

## User Stories

### US-001: Match shell-history access by command position

**Description:** As an agent, I want commit messages that name history allowed so that benign commands run.

**Acceptance Criteria:**

- [ ] `.agro/hooks/deny-env-dump.sh` returns no decision for the command `git commit -m "record history of X"`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for the command `history`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for the command `ls; history | tail`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for the command `fc -l`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for the command `cat ~/.zsh_history`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for the command `cat ~/.bash_history`.
- [ ] Before the fix, the new probe returns exit code 1 on the commit-message case. After the fix, the new probe returns exit code 0.

### US-002: Ignore a jq filter key named env

**Description:** As an agent, I want a jq filter key named env allowed so that settings reads run.

**Acceptance Criteria:**

- [ ] `.agro/hooks/deny-env-dump.sh` returns no decision for the command `jq '.env' .claude/settings.json`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns no decision for the command `jq '.env // {}' .claude/settings.json`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for the command `cat .env`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for the command `jq . .env`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for the command `jq '.env' .env`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns no decision for the command `cat .env.example`.
- [ ] Before the fix, the new probe returns exit code 1 on the jq-filter case. After the fix, the new probe returns exit code 0.

## Summary

Issue #1149 reports two false denials from the Bash secret-exposure guard. Both denials occurred during #1147 and PR #1148.

Verified current state:

- `.agro/hooks/deny-env-dump.sh` line 23 adds `\bhistory\b` to the `DENY` pattern. The pattern matches the word anywhere in the command text, including inside a quoted argument.
- `.agro/hooks/deny-env-dump.sh` line 42 starts `SECRET_PATH` with `\.env[^[:space:]/"']*`. Line 72 lists `jq` in `READ_CMD`. Line 73 joins them into `SECRET_PATH_DENY`. The quoted jq filter `'.env'` matches as a path.
- Lines 100 to 110 collect `.env` tokens from the full command. The allow exception covers only example, sample, and template basenames.
- `.codex/hooks/deny-env-dump.sh` calls the canonical hook through `.claude/hooks`. The fix reaches Codex with no mirror edit.
- `.agro/hooks/deny-secret-paths.sh` checks file-tool paths, not Bash text. This task does not change it.
- Shell-history files stay denied through the `.zsh_history` and `.bash_history` entries in `SECRET_PATH`.

Selected approach:

1. Replace `\bhistory\b` with a command-position match. The match requires the start of the command, or a `;`, `&`, `|`, `(`, or `$(` before the word, with optional whitespace.
2. Before the `SECRET_PATH_DENY` test, build a path-scan copy of the command. In that copy, replace the first quoted argument of each `jq` or `yq` call with a fixed marker. Use the copy for the `SECRET_PATH_DENY` match and for the `.env` token collection.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` line 23 | Holds the shell-history word match to narrow. |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH`, `READ_CMD`, `SECRET_PATH_DENY`, `env_tokens` | Holds the secret-path match to run against the filter-stripped copy. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Calls the canonical hook. No change. |
| `.agro/evals/probes/operator-config-guard.sh` | `decision_for`, `fixture` | Shows the probe pattern for hook fixtures. Stays green. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | whole probe | Existing hook probe. Stays green. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Claude Code PreToolUse Bash hook | Behavior | Two benign command shapes change from `deny` to no decision. |
| Codex PreToolUse Bash hook | Behavior | Same change through the wrapper. |
| Deny reason text | None | The deny messages stay the same. |

## Storage

N/A. The hook is stateless. The hook reads one JSON event on stdin and writes one decision.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` stays the single source of truth for Bash command screening.
- The fix narrows two patterns. The fix adds no allowlist of command strings.
- The filter-stripped copy feeds only the secret-path checks. The `DENY`, `DOCKER_INSPECT`, and `OPERATOR_PATH` checks keep the full command.
- A jq filter that is not quoted stays in the scan. `jq . .env` stays denied.
- A file argument after the jq filter stays in the scan. `jq '.env' .env` stays denied.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| new file `.agro/evals/probes/secret-guard-precision.sh` | commit message with the history word allowed; `history`, `ls; history | tail`, `fc -l` denied | US-001 |
| new file `.agro/evals/probes/secret-guard-precision.sh` | `jq '.env'` and `jq '.env // {}'` on `.claude/settings.json` allowed; `cat .env`, `jq . .env`, `jq '.env' .env` denied; `cat .env.example` allowed | US-002 |
| new file `.agro/evals/probes/secret-guard-precision.sh` | `cat ~/.zsh_history` and `cat ~/.bash_history` denied | US-001 regression floor |
| `.agro/evals/probes/operator-config-guard.sh` | all existing cases | Existing hook behavior |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | all existing cases | Existing hook behavior |

Run each probe with `bash <probe path>`. Each probe must return exit code 0.

Write the new probe to the eval contract in `.agro/evals/AGENTS.md`. Declare the `# tier:`, `# source:`, and `# desc:` headers. Resolve paths from `${BASH_SOURCE[0]}`. Write each hook event to a fixture file. Hold each trigger word in a shell variable.

## Design Principles

- Keep one canonical hook. Do not edit the Codex wrapper.
- Prefer a narrow pattern to a string allowlist.
- Keep every existing true deny. A false allow is worse than a false deny.
- Add no comments to tracked code.

## Out of Scope

- Changes to `.agro/hooks/deny-secret-paths.sh`.
- Changes to the permission deny list in `.claude/settings.json`.
- Other false positives, such as the `git checkout --` denial that the issue mentions.
- Full shell parsing of quoted arguments.

## Open Questions

1. Does `docs/security-considerations.md` describe the shell-history match? If yes, update the text in the same change.
2. Does this change need a `CHANGELOG.md` entry under the git skill rules?
3. Does the mifunedev/agro-web site document the guard patterns? This plan assumes no public documentation change.

## Acceptance Criteria

- [ ] `git commit -m "record history of X"` gets no decision from `.agro/hooks/deny-env-dump.sh`.
- [ ] `cat ~/.zsh_history` gets `deny` from `.agro/hooks/deny-env-dump.sh`.
- [ ] `jq '.env' .claude/settings.json` gets no decision from `.agro/hooks/deny-env-dump.sh`.
- [ ] `cat .env` gets `deny` from `.agro/hooks/deny-env-dump.sh`.
- [ ] `bash .agro/evals/probes/operator-config-guard.sh` returns exit code 0.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` returns exit code 0.
- [ ] `bash .agro/evals/probes/secret-guard-precision.sh` returns exit code 0 for the new file `.agro/evals/probes/secret-guard-precision.sh`.

## Lessons

Filled by the advisor before undraft.
