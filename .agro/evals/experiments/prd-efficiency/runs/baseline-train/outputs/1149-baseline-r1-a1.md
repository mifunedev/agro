# PRD: Secret guard false positives

Status: DRAFT

Source: GitHub issue #1149.

## User Stories

### US-001: Match shell-history access at the command position

**Description:** As an agent, I want the Bash guard to deny only shell-history access so that a quoted commit message can hold the word `history`.

**Acceptance Criteria:**

- [ ] `.agro/hooks/deny-env-dump.sh` returns no decision for `git commit -m "record history of X"`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns no decision for `git commit -m "apply task-history signal"`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for `history`, `history | grep foo`, `ls; history`, `fc -l`, and `cat ~/.zsh_history`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for `cat ~/.bash_history`.
- [ ] The new probe `.agro/evals/probes/secret-guard-false-positives.sh` asserts each case in this list and exits 0.

### US-002: Exclude a jq or yq filter from the secret-path scan

**Description:** As an agent, I want the Bash guard to skip a `jq` or `yq` filter in the path scan so that `jq '.env' .claude/settings.json` runs.

**Acceptance Criteria:**

- [ ] `.agro/hooks/deny-env-dump.sh` returns no decision for `jq '.env' .claude/settings.json`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns no decision for `jq '.env // {}' .claude/settings.json`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns `deny` for `cat .env`, `cat '.env'`, `jq . .env`, and `grep KEY .env.local`.
- [ ] `.agro/hooks/deny-env-dump.sh` returns no decision for `cat .example.env`.
- [ ] The probe `.agro/evals/probes/secret-guard-false-positives.sh` asserts each case in this list and exits 0.

### US-003: Align the settings deny list and the security documentation

**Description:** As an operator, I want each guard layer to match the hook so that no second layer denies the same command.

**Acceptance Criteria:**

- [ ] `.claude/settings.json` holds no `permissions.deny` entry that matches the bare substring `history` anywhere in a command.
- [ ] `.claude/settings.json` still holds `Bash(command=*cat*.bash_history*)` and `Bash(command=*cat*.zsh_history*)`.
- [ ] `docs/security-considerations.md` states that the guard matches shell-history access at the command position.
- [ ] `docs/security-considerations.md` states that the guard skips the filter argument of `jq` and `yq`.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/security-considerations.md` reports no new finding on the changed lines.

## Summary

Verified current state:

- `.agro/hooks/deny-env-dump.sh:23` adds `\bhistory\b` to `DENY`. The hook matches `DENY` against the full command string. A quoted commit message that holds the word `history` gets `deny`.
- `.agro/hooks/deny-env-dump.sh:42` starts `SECRET_PATH` with `\.env[^[:space:]/"']*`. `READ_CMD` at line 72 includes `jq` and `yq`. In `jq '.env' .claude/settings.json`, the filter text `.env` matches `SECRET_PATH`. The template exemption at lines 99-110 extracts the token `.env`, finds no `example`, `sample`, or `template` in the basename, and emits `deny`.
- `.agro/hooks/deny-env-dump.sh:8` strips HEREDOC bodies. The hook strips no quoted argument.
- `.codex/hooks/deny-env-dump.sh` calls the canonical hook through `.claude/hooks`, which is a symlink to `.agro/hooks`. The Codex path inherits each fix with no change.
- `.claude/settings.json:71` holds `Bash(command=*history*)`. This rule matches the same bare substring as the hook.
- The planning session for this PRD reproduced the defect: the hook denied a `grep` command whose pattern held the word `history`.

Selected approach:

1. Replace `\bhistory\b` in `DENY` with a pattern that matches `history` only as a command word. A command word starts the command or follows `;`, `&`, `|`, `(`, `` ` ``, or `$(`, with optional whitespace. Anchor `fc[[:space:]]+-l` the same way.
2. Keep history-file reads under `SECRET_PATH` (`\.bash_history\b`, `\.zsh_history\b`, and the others). `cat ~/.zsh_history` stays denied through `SECRET_PATH_DENY`.
3. Before the `SECRET_PATH_DENY` match and the template-exemption loop, build a scan copy of `cmd` that removes the first non-option argument after `jq` or `yq`. Match the scan copy only. Leave the file arguments of `jq` and `yq` in the scan copy.
4. Narrow `Bash(command=*history*)` in `.claude/settings.json`. The default is `Bash(command=history*)`. Open question 1 asks the operator to confirm.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` (lines 23-24) | Replace the bare `history` and `fc -l` alternatives with command-position patterns. |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH_DENY`, `env_tokens` loop (lines 98-110) | Match against a scan copy that omits the `jq` or `yq` filter argument. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | No change. The wrapper calls the canonical hook. |
| `.claude/settings.json` | `permissions.deny` entry `Bash(command=*history*)` | Narrow the entry to the command position. |
| `docs/security-considerations.md` | "Command guard" bullets (lines 56-61) | Describe the command-position match and the filter exemption. |
| `.agro/evals/probes/secret-guard-false-positives.sh` | new probe | Assert the allow and deny cases of US-001 and US-002. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| PreToolUse `Bash` hook decision | Behavior change | Fewer false `deny` decisions. Each current true `deny` case in the existing probes stays `deny`. |
| Claude Code `permissions.deny` | Rule change | One rule narrows from a substring match to a command-position match. |
| Deny reason text | No change | The deny messages keep their current wording. |

## Storage

N/A. The hook is stateless. The hook reads one JSON event on stdin and writes one decision on stdout.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` is the source of truth for the Bash guard. `.claude/hooks` and `.codex/hooks/deny-env-dump.sh` reach the canonical file. Edit only the canonical file.
- The guard keeps one policy per concern. `DENY` owns the `history` builtin and `fc -l`. `SECRET_PATH` owns history files and `.env` files.
- The fix narrows matching. The fix adds no allowlist of commit verbs and no quote-aware shell parser.
- The file guard `.agro/hooks/deny-secret-paths.sh` matches tool path arguments, not command text. The file guard is not affected.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-guard-false-positives.sh` | allow: `git commit -m "record history of X"`, `git commit -m "apply task-history signal"` | US-001 false positive removed. |
| `.agro/evals/probes/secret-guard-false-positives.sh` | deny: `history`, `history \| grep foo`, `ls; history`, `fc -l`, `cat ~/.zsh_history`, `cat ~/.bash_history` | US-001 true positives kept. |
| `.agro/evals/probes/secret-guard-false-positives.sh` | allow: `jq '.env' .claude/settings.json`, `jq '.env // {}' .claude/settings.json`, `cat .example.env` | US-002 false positive removed; template exemption kept. |
| `.agro/evals/probes/secret-guard-false-positives.sh` | deny: `cat .env`, `cat '.env'`, `jq . .env`, `grep KEY .env.local` | US-002 true positives kept. |
| `.agro/evals/probes/secret-guard-false-positives.sh` | `jq` check on `.claude/settings.json` for the narrowed rule | US-003 settings rule. |
| `.agro/evals/probes/operator-config-guard.sh` | existing cases | Regression floor. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | existing cases | Regression floor. |
| `.agro/evals/probes/devtcp-hook.sh` | existing cases | Regression floor. |

Procedure:

1. Write the new probe first. Follow `.agro/evals/AGENTS.md`: declare `# tier: A`, `# source:`, and `# desc:`; resolve paths from `${BASH_SOURCE[0]}`; return `0`, `1`, or `2`.
2. Hold each sensitive command string in a shell variable inside the probe file. The authoring session writes the probe with the Write tool, not with a Bash heredoc.
3. Run `bash .claude/skills/eval/run.sh --probe secret-guard-false-positives`. The probe exits 1 before the fix.
4. Change the hook. Run the probe again. The probe exits 0.
5. Drive the REGRESSION branch: in a disposable copy of the hook, restore `\bhistory\b`. The probe exits 1 and names the commit-message case.
6. Run `bash .claude/skills/eval/run.sh --tier A`. Each guard probe reports PASS.

## Design Principles

- Change the canonical `.agro/` primitive. Do not patch a provider mirror.
- Prefer a smaller truthful model: match the command word, not the vocabulary of the command text.
- Keep every current true positive. A fix that opens a read path to a secret fails the task.
- Add no explanatory comments to the hook. The probe cases state the intent.

## Out of Scope

- The `git checkout --` denial and the `git show HEAD:<file> >` workaround from #1147. Another guard (`cc-safety-net`) owns that decision.
- A full shell parser or a quote-aware tokenizer for the hook.
- Changes to `.agro/hooks/deny-secret-paths.sh`.
- Other false positives of the `echo`/`printf` secret-name rule or the `OPERATOR_PATH` rule.
- Changes to `mifunedev/agro-web`. The public documentation does not describe these patterns.

## Open Questions

1. Confirm the replacement for `Bash(command=*history*)` in `.claude/settings.json`.
   A. Narrow to `Bash(command=history*)` (default in this plan).
   B. Remove the entry and rely on the hook.
   C. Keep the entry unchanged and accept the Claude Code permission-layer false positive.
2. Confirm that the guard may allow `history` inside `bash -c '<command>'`. The command-position rule treats the quoted `-c` argument as text. The default in this plan accepts that gap, because the hook does not parse nested shells for any other rule.

## Acceptance Criteria

- [ ] `bash .claude/skills/eval/run.sh --probe secret-guard-false-positives` reports PASS.
- [ ] `bash .claude/skills/eval/run.sh --probe operator-config-guard` reports PASS.
- [ ] `bash .claude/skills/eval/run.sh --probe docker-inspect-env-guard` reports PASS.
- [ ] `bash .claude/skills/eval/run.sh --probe devtcp-hook` reports PASS.
- [ ] `git diff --name-only` lists no file under `.codex/` and no file under `.claude/hooks/`.
- [ ] `git diff --name-only` lists `.agro/hooks/deny-env-dump.sh` and no other file under `.agro/hooks/`.

## Lessons

Filled by the advisor before undraft.
