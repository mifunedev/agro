# PRD: Close the env-guard interpreter and search-pattern gaps

Status: DRAFT

Issue: [#1155](https://github.com/mifunedev/agro/issues/1155)

## User Stories

### US-001: Deny interpreter commands that dump the whole environment

**Description:** As an operator, I want the Bash guard to deny inline interpreter environment dumps so that secrets stay out of the transcript.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 1 on `python3 -c 'import os; print(dict(os.environ))'`. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `python3 -c 'import os; print(dict(os.environ))'`.
- [ ] The probe asserts `deny` for `perl -e 'print "$_=$ENV{$_}\n" for keys %ENV'`.
- [ ] The probe asserts `deny` for `node -e 'console.log(process.env)'`.
- [ ] The probe asserts `allow` for `python3 -c 'import os; print(os.environ.get("HOME"))'` and `node -e 'console.log(process.env.HOME)'`.
- [ ] The probe asserts `allow` for `grep -rn os.environ src/`.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] The deny reason names the interpreter environment dump and tells the agent to ask the operator for one non-secret value.

### US-002: Match an env file only as a path component

**Description:** As an agent, I want the secret-path check to match `.env` only at the start of a path component so that a `.env` search pattern runs.

**Acceptance Criteria:**

- [ ] Before the hook change, the probe exits 1 on `grep process.env src/index.ts`. The evidence records the command and the exit status.
- [ ] The probe asserts `allow` for `grep process.env src/index.ts` and `grep "Config.Env" .claude/settings.json`.
- [ ] The probe asserts `deny` for `grep TOKEN .env`.
- [ ] Every earlier `deny` assertion in the probe still passes, including `cat ./app/.env.local`, `jq --from-file=.env data.json`, and `jq -n '.' < .env`.
- [ ] The probe asserts `deny` for `node -e 'console.log(process.env)'` after this change. The US-001 interpreter check supplies the deny, not the secret-path check.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] `cmp .agro/hooks/deny-env-dump.sh .claude/hooks/deny-env-dump.sh` exits 0.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` and `bash .agro/evals/probes/operator-config-guard.sh` exit 0.
- [ ] The `[Unreleased]` `### Fixed` section of `CHANGELOG.md` holds one bullet that links issue #1155, and `bash .agro/evals/probes/changelog-entry-length.sh` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no probe that was green on the base branch as red.

## Summary

The hook `.agro/hooks/deny-env-dump.sh` runs as the Bash `PreToolUse` guard. The issue records two accuracy gaps. The advisor found both gaps during #1150 (PR #1154).

Gap 1 is a false allow. No term in `DENY` (lines 15-33) names `os.environ` or `%ENV`, so the guard allows both dumps. The guard denies `node -e 'console.log(process.env)'` only through `SECRET_PATH_DENY` (line 75). In that match, the `.` entry of `READ_CMD` matches the `.` in `console.log`. `SECRET_PATH` matches `.env` in `process.env`. US-002 removes that accidental match, so US-001 must add an explicit interpreter check first.

Gap 2 is a false deny. The first `SECRET_PATH` entry `\.env[^[:space:]/"']*` (line 44) matches `.env` anywhere in a word. The token scan on line 150 has the same shape. The check therefore reads `process.env` and `Config.Env` as env-file paths.

Selected approach:

2. Anchor the `.env` entry of `SECRET_PATH` to the start of a path component. Anchor the line 150 token scan the same way. A path component starts at the start of the text, after whitespace, or after one of `/`, `=`, `<`, `"`, `'`, `(`, or a backtick.
2. Anchor the `.env` entry of `SECRET_PATH` and the line 150 token scan to the start of a path component. A path component starts at the start of the text, after whitespace, or after one of `/`, `=`, `<`, `"`, `'`, `(`, or a backtick.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY`, the `if grep -qEi -- "$DENY"` branch (line 135) | The US-001 interpreter check follows this branch. |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH` (line 44), `SECRET_PATH_DENY` (line 75), `env_tokens` scan (line 150) | US-002 anchors the `.env` entry and the token scan. |
| `.agro/hooks/deny-env-dump.sh` | `emit` (line 125) | Both stories emit decisions through this function. |
| `.claude/hooks/deny-env-dump.sh` | whole file | `.claude/settings.json` line 94 runs this path. `ls -l` shows a regular file, not a symlink. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Line 6 calls `.claude/hooks/deny-env-dump.sh`. |
| `.agro/scripts/link-providers.sh` | provider hook list (line 16) | Lists the canonical hook for provider linking. |
| `.agro/evals/probes/secret-exposure-guard.sh` | `decision_for`, `assert` | Drives the hook through the file-fixture driver pattern. |
| `CHANGELOG.md` | `## [Unreleased]`, `### Fixed` (line 27) | Records the fix. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Bash `PreToolUse` decision | Behavior change | Inline `python`, `perl`, and `node` whole-environment dumps return `deny`. |
| Bash `PreToolUse` decision | Behavior change | A search pattern that contains `.env` inside a word returns `allow`. |
| Deny reason text | New message | The interpreter branch emits its own reason. |

## Storage

N/A. The hook is stateless. The hook reads the hook input on stdin and writes one decision to stdout.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` is the canonical source. Do not edit `.claude/hooks/deny-env-dump.sh` directly.
- The interpreter check requires both an interpreter name and a whole-environment reference. A text search for `os.environ` stays allowed.
- A single-key read, such as `os.environ["HOME"]` or `$ENV{HOME}`, stays allowed. The issue scopes the deny to whole-environment reads.
- The secret-path check keeps its `READ_CMD` gate. Only the `.env` anchor changes.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-exposure-guard.sh` | `python3 -c` `dict(os.environ)`, `perl -e` `keys %ENV`, `node -e` `process.env`: `deny` | US-001 false allows close. |
| `.agro/evals/probes/secret-exposure-guard.sh` | `os.environ.get("HOME")`, `process.env.HOME`, `grep -rn os.environ src/`: `allow` | US-001 adds no false deny. |
| `.agro/evals/probes/secret-exposure-guard.sh` | `grep process.env src/index.ts`, `grep "Config.Env" .claude/settings.json`: `allow`; `grep TOKEN .env`: `deny` | US-002 search-pattern gap closes. |
| `.agro/evals/probes/secret-exposure-guard.sh` | all existing env-file `deny` cases | US-002 keeps env-file reads denied. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | existing cases | The container-inspect branch holds. |
| `.agro/evals/probes/operator-config-guard.sh` | existing cases | The operator-path branch holds. |
| `.agro/evals/probes/changelog-entry-length.sh` | `### Fixed` bullet | The changelog bullet fits the length cap. |
| `.claude/skills/eval/run.sh` | full suite | No new red probe. |

Update the probe `# source:` header to name issue #1155. Update `# desc:` to name interpreter dumps and search patterns. Drive the REGRESSION branch against the pre-change hook in a disposable copy, per `.agro/evals/AGENTS.md`.

## Design Principles

- Keep one source of truth: edit `.agro/hooks/deny-env-dump.sh` only.
- Add no explanatory comments to tracked code.
- Deny by what the command does, not by a word that appears in an argument.
- Prove each gap red before the fix and green after the fix.
- Add the smallest regex change that closes each gap.

## Out of Scope

- Command text that only names a guarded command, such as notes passed to `jq --arg`. The `guard-false-allows` Lessons record the `--rawfile` notes-file workaround and drop that pattern.
- Interpreters other than `python`, `perl`, and `node`, such as `ruby` and `deno`.
- Interpreter programs inside a heredoc. Line 8 strips heredoc bodies before every check.
- Single-key environment reads.

## Open Questions

None.

## Acceptance Criteria

- [ ] The `python3 -c` and `perl -e` environment dumps from issue #1155 return `deny`.
- [ ] `grep process.env src/index.ts` returns `allow`, and `grep TOKEN .env` returns `deny`.
- [ ] `.agro/evals/probes/secret-exposure-guard.sh` asserts both directions and exits 0.
- [ ] `cmp .agro/hooks/deny-env-dump.sh .claude/hooks/deny-env-dump.sh` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no new red probe.

## Lessons

Filled by the advisor before undraft.
