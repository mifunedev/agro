# PRD: Stop secret-guard false positives on trigger words

Status: DRAFT

Issue: [#1149](https://github.com/mifunedev/agro/issues/1149)

## User Stories

### US-001: Match shell-history access by command position

**Description:** As an agent, I want the Bash guard to deny the `history` command so that a commit message can contain the word.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/secret-exposure-guard.sh` exists, declares `# tier:`, `# source:`, and `# desc:` headers, and drives `.agro/hooks/deny-env-dump.sh` through the file-fixture driver pattern.
- [ ] Before the hook change, the probe exits 1 on `git commit -m "record history of X"`. The evidence records the command and the exit status.
- [ ] The probe asserts `allow` for `git commit -m "record history of X"` and `git commit -m "apply task-history signal"`.
- [ ] The probe asserts `deny` for `history`, `history | tail`, `bash -ic history`, `fc -l`, `cat ~/.zsh_history`, and `tail ~/.bash_history`.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

The guard must deny the `history` command, not the word in an argument. The probe builds the word from parts, so that the probe source passes the guard.

### US-002: Exempt the jq filter argument from the secret-path check

**Description:** As an agent, I want the secret-path check to skip the filter argument of `jq`, so that `jq '.env' .claude/settings.json` reads the settings `env` block.

**Acceptance Criteria:**

- [ ] Before the hook change, the probe exits 1 on `jq '.env' .claude/settings.json`. The evidence records the command and the exit status.
- [ ] The probe asserts `allow` for `jq '.env' .claude/settings.json`, `jq -r '.env // {}' .claude/settings.json`, and `jq .env .claude/settings.json`.
- [ ] The probe asserts `deny` for `cat .env`, `cat ./app/.env.local`, `jq '.env' .env`, `jq -f .env data.json`, `jq --rawfile s .env -n '$s'`, and `jq -n '.' < .env`.
- [ ] The probe asserts `allow` for `cat .env.example`.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] `CHANGELOG.md` `[Unreleased]` has one `### Fixed` entry that links #1149.

## Summary

`.agro/hooks/deny-env-dump.sh` is the Bash `PreToolUse` guard. `.claude/settings.json` wires it to the `Bash` matcher. `.codex/hooks/deny-env-dump.sh` calls it, so Codex inherits each fix.

Verified current behavior (advisor run of the hook, 2026-09-23):

| Command | Decision | Cause |
| --- | --- | --- |
| `git commit -m "record history of X"` | deny | `DENY` contains `\bhistory\b` with no position anchor. |
| `git commit -m "apply task-history signal"` | deny | Same cause. `-` is a word boundary. |
| `jq '.env' .claude/settings.json` | deny | `SECRET_PATH_DENY` matches `jq` from `READ_CMD`, then `\.env` inside the quoted filter. |
| `cat ~/.zsh_history`, `cat .env` | deny | Correct. |
| `cat .env.example` | allow | Correct. The template allowlist exempts it. |

Selected approach:

1. Replace the bare `\bhistory\b` term in `DENY` with two terms. The first term matches `history` at command position: line start, or after `;`, `&`, `|`, `(`, a backtick, or `$(`. The second term matches `history` as the argument of a shell `-c` flag cluster, such as `bash -ic history`. The history-file paths in `SECRET_PATH` stay unchanged.
2. Compute a second command string for the `SECRET_PATH_DENY` check only. In that string, replace the first positional argument after `jq` and its flags with a placeholder. Skip the replacement when the flags include `-f`, `-L`, or a long flag that contains `file`, because those flags take a path. The `DENY`, `DOCKER_INSPECT`, and `OPERATOR_PATH` checks keep the original command string.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
| --- | --- | --- |
| `.agro/hooks/deny-env-dump.sh` | `DENY`, `SECRET_PATH_DENY` check, `env_tokens` allowlist | The Bash guard. Both fixes land here. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Calls the shared hook. No change. |
| `.agro/hooks/deny-secret-paths.sh` | `DENY_PATH` | The file-tool guard. No change. It matches paths, not command text. |
| `.agro/evals/probes/secret-exposure-guard.sh` | new | Pins allow and deny decisions for both fixes. |
| `CHANGELOG.md` | `[Unreleased]` | One `### Fixed` entry. |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| Claude Code Bash `PreToolUse` | behavior | Fewer false denials. Every listed secret shape stays denied. |
| Codex Bash hook | behavior | Inherits the same change through the wrapper. |

## Storage

N/A. The hook is stateless.

## Architectural Decisions

- The shared hook stays the single source of truth. The Codex wrapper and `.claude/hooks` (a symlink to `.agro/hooks`) need no change.
- The filter exemption applies only to the secret-path check. The `DENY` check keeps the original command string, so the exemption opens no path to a bulk environment dump.
- A misparsed `jq` flag leaves the filter in place. The failure mode is a false deny, never a false allow.
- The task adds one probe file and no probe machinery. No existing probe covers the history or `.env` command shapes. `docker-inspect-env-guard.sh` and `operator-config-guard.sh` cover other guards. A security-boundary change needs a regression pin for both directions.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
| --- | --- | --- |
| `.agro/evals/probes/secret-exposure-guard.sh` | US-001 allow and deny table | The history fix, and that history access stays denied. |
| `.agro/evals/probes/secret-exposure-guard.sh` | US-002 allow and deny table | The filter fix, and that `.env` reads stay denied, including `-f` and `--rawfile`. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | existing | No regression in the container-inspect guard. |
| `.agro/evals/probes/operator-config-guard.sh` | existing | No regression in the operator-path guard. |
| `bash .claude/skills/eval/run.sh` | all probes | No new red beyond `next-dev-prod` and `skills-vendored`. |

Each story adds its probe assertions first and records the probe exit 1 against the unchanged hook. Then the story changes the hook.

## Design Principles

- Deny on doubt. A parse gap produces a false deny, never a false allow.
- One source of truth: `.agro/hooks/deny-env-dump.sh`.
- Change the smallest set of patterns that removes the two reported false positives.
- Add no explanatory comments to the hook (root `AGENTS.md`, non-negotiable 5).

## Out of Scope

- `yq` filters. `yq '.env' <file>` stays denied.
- Other `.env` substrings in command text, such as `grep process.env src/`. That command stays denied.
- The `git checkout -- <file>` guard.
- `.agro/hooks/deny-secret-paths.sh`.

## Open Questions

None.

Resolved: the advisor run found that `jq -n 'env'` and `jq -n '$ENV'` return `allow`. Both print the full process environment. The operator chose a separate issue: [#1150](https://github.com/mifunedev/agro/issues/1150). This task stays at the two reported false positives.

## Acceptance Criteria

- [ ] `git commit -m "record history of X"` is allowed, and `cat ~/.zsh_history` is denied.
- [ ] `jq '.env' .claude/settings.json` is allowed, and `cat .env` is denied.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` and `bash .agro/evals/probes/operator-config-guard.sh` exit 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no red beyond `next-dev-prod` and `skills-vendored`.

## Lessons

Filled by the advisor before undraft.
