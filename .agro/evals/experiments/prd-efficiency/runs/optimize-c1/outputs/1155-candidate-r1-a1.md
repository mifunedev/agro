# PRD: Close the secret guard interpreter and search-pattern gaps

Status: DRAFT

Source: issue #1155, found during #1150 (PR #1154).

## User Stories

### US-001: Deny interpreter whole-environment reads

**Description:** As the operator, I want the guard to deny an interpreter that prints the whole process environment. Then no agent leaks every secret through `python3 -c` or `perl -e`.

**Acceptance Criteria:**

- [ ] The hook returns `deny` for `python3 -c 'import os; print(dict(os.environ))'`.
- [ ] The hook returns `deny` for `perl -e 'print "$_=$ENV{$_}\n" for keys %ENV'`.
- [ ] The hook returns `deny` for `node -e 'console.log(process.env)'` through the new interpreter rule. The probe asserts this case.
- [ ] The hook returns no decision (allow) for `python3 -c 'import os; print(os.environ.get("HOME"))'`.
- [ ] The hook returns no decision (allow) for `perl -e 'print $ENV{HOME}'`.
- [ ] The deny reason text names interpreter environment reads.
- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

### US-002: Allow an env-shaped grep or rg search pattern

**Description:** As an application agent, I want the secret-path check to skip the `grep` and `rg` search pattern. Then a search for `process.env` or `Config.Env` runs.

**Acceptance Criteria:**

- [ ] The hook returns no decision (allow) for `grep process.env src/index.ts`.
- [ ] The hook returns no decision (allow) for `grep "Config.Env" README.md`.
- [ ] The hook returns no decision (allow) for `rg process.env .agro`.
- [ ] The hook returns `deny` for `grep TOKEN .env`.
- [ ] The hook returns `deny` for `grep -e TOKEN .env`.
- [ ] The hook returns `deny` for `grep -f .env data.txt`.
- [ ] The hook returns `deny` for `rg TOKEN ./app/.env.local`.
- [ ] The hook returns `deny` for `cat prod.env`.
- [ ] All jq assertions that exist at the base commit in `.agro/evals/probes/secret-exposure-guard.sh` still pass.
- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

### US-003: Record the guard change in the docs and the changelog

**Description:** As the operator, I want the docs and the changelog to state the new guard behavior. Then the documented deny list matches the hook.

**Acceptance Criteria:**

- [ ] The command-guard Deny bullet in `docs/security-considerations.md` names interpreter whole-environment reads.
- [ ] The Deny (paths) bullet in `docs/security-considerations.md` states that the guard skips the `grep` and `rg` search-pattern operand.
- [ ] `CHANGELOG.md` has one entry under `## [Unreleased]` in a `### Fixed` subsection that cites issue #1155.

## Summary

The hook `.agro/hooks/deny-env-dump.sh` scans the raw Bash command string. The provider path `.claude/hooks` is a symlink to `.agro/hooks`, so the change lands in the canonical file only.

Verified current state:

- The `DENY` list (lines 15-33) holds no rule for interpreter environment objects. The hook allows the `python3 -c` and `perl -e` dumps.
- The hook denies `node -e 'console.log(process.env)'` through `SECRET_PATH_DENY` (line 75). `READ_CMD` (line 74) holds the source-dot alternative. Inside `\b(...)\b`, that dot matches the dot in `console.log`. The secret-path alternative for env files (line 44) then matches the `.env` inside `process.env`.
- The env-file alternative on line 44 has no left anchor. It matches `.env` after any character, so it matches `process.env` and `Config.Env` (the check runs with `grep -i`). `grep` and `rg` are in `READ_CMD`, so a search pattern triggers the deny on line 162.
- `mask_jq_filters` (lines 83-98) already replaces a jq filter operand with `JQ_FILTER` before the secret-path check. It keeps the operand when a path flag (`JQ_PATH_FLAG`, line 81) reads a file.

Selected approach:

1. Add one interpreter rule to `DENY`. The rule requires the word `python`, `python3`, `perl`, or `node` earlier in the command. The rule then matches one of three whole-environment objects. The first object is `os.environ` with no `[` or `.get` after it. `os.environ` followed by `.copy`, `.items`, `.keys`, or `.values` also matches. The second object is the Perl hash `%ENV`. The third object is `process.env` with no `.` or `[` after it. A single-key read stays allowed. A search for `process.env` with no interpreter word stays allowed.
2. Generalize `mask_jq_filters` into one masking function that takes a call pattern, a path-flag pattern, and a placeholder. Run the function for jq and for `grep`, `egrep`, `fgrep`, and `rg`. For the search tools, the path flag is `-f` in a short-flag cluster or `--file`. The function keeps the operand when a path flag is present, so a pattern file is still checked.
3. Keep the env-file alternative on line 44 unanchored. An anchor would allow `cat prod.env`, which reads an env file.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` (lines 15-33), deny reason (line 136) | Holds the new interpreter rule and the updated reason text. |
| `.agro/hooks/deny-env-dump.sh` | `mask_jq_filters`, `JQ_CALL`, `JQ_PATH_FLAG`, `path_cmd` (lines 79-122) | Becomes the shared masking function for jq, `grep`, and `rg`. |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH_DENY`, `env_tokens` exemption (lines 148-163) | Reads `path_cmd`. The masked search pattern no longer reaches this check. |
| `.agro/evals/probes/secret-exposure-guard.sh` | `assert`, header `# source:` and `# desc:` | Gains the allow and deny assertions for both gaps. |
| `.claude/hooks/deny-env-dump.sh` | symlink through `.claude/hooks` | Provider mirror. Do not edit. |
| `docs/security-considerations.md` | section 2, command-guard bullets | Documents the guard deny list. |
| `CHANGELOG.md` | `## [Unreleased]` | Records the fix. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Bash `PreToolUse` hook decision | Behavior change | Interpreter whole-environment reads change from allow to deny. A `grep` or `rg` search pattern that contains `.env` changes from deny to allow. |
| Deny reason on line 136 | Text change | The reason lists interpreter environment reads. |

## Storage

N/A. The hook is stateless. It reads one JSON object on stdin and writes one decision on stdout.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` is the one source of truth. The Claude and Codex paths reach the file through `.claude/hooks`.
- Argument position decides a search pattern. The guard masks the first non-flag operand of `grep` and `rg`, as it does for the jq filter. A lexical anchor on the env-file alternative cannot separate `process.env` from `prod.env`, so the plan rejects that option.
- The interpreter rule lives in `DENY`. `DENY` runs first, so the rule does not depend on the secret-path check.
- Surface review:
  - Host and sandbox: applied. The application agent edits and tests inside the sandbox.
  - Lifecycle door: not applicable. No `agro` verb changes.
  - Canonical and provider surfaces: applied. The edit is in `.agro/hooks/`. The `.claude/hooks` symlink needs no change.
  - Root and scaffold: applied. The hook ships to the orchestrator and to scaffolded projects through `.agro/scripts/link-providers.sh`. No scaffold code changes.
  - Interactive and headless processes: not applicable. No process starts.
  - Local and remote operation: not applicable. The hook runs per tool call.
  - Parallel operation: not applicable. The hook holds no shared state.
  - Public documentation: not applicable. The guard is internal. `mifunedev/agro-web` names no guard pattern.
  - Verification: applied. See the Test Plan.

## Test Plan (TDD)

Write each assertion before the hook change. Confirm that each new assertion fails against the base hook.

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-exposure-guard.sh` | `deny` for the `python3 -c` dump, the `perl -e` dump, and `node -e 'console.log(process.env)'` | US-001 deny direction |
| `.agro/evals/probes/secret-exposure-guard.sh` | `allow` for `os.environ.get("HOME")` under `python3 -c` and `$ENV{HOME}` under `perl -e` | US-001 single-key reads stay allowed |
| `.agro/evals/probes/secret-exposure-guard.sh` | `allow` for `grep process.env src/index.ts`, `grep "Config.Env" README.md`, `rg process.env .agro` | US-002 allow direction |
| `.agro/evals/probes/secret-exposure-guard.sh` | `deny` for `grep TOKEN .env`, `grep -e TOKEN .env`, `grep -f .env data.txt`, `rg TOKEN ./app/.env.local`, `cat prod.env` | US-002 deny direction |
| `.agro/evals/probes/docker-inspect-env-guard.sh`, `.agro/evals/probes/operator-config-guard.sh` | existing cases | No regression in the sibling guard probes |
| `.agro/skills/eval/run.sh` | full suite | No new REGRESSION |

Fault injection per `.agro/evals/AGENTS.md`: in a disposable copy of the repository, restore the base hook. Run the probe. The probe exits 1, and the message names the first failed case. Record the command and the exit code in `progress.txt` or in the PR body.

Hold each sensitive token in a shell variable inside the probe, as the existing `H` and `JQ_ENV_VAR` variables do.

## Design Principles

- Keep one source of truth: edit the canonical hook, never the provider mirror.
- Prefer the smaller rule. Reuse the jq masking shape instead of a second parser.
- Fail closed. When the masking function cannot place the operand, the guard keeps the operand and checks the operand.
- Add no comments to the hook or the probe. Express intent through names and assertions.

## Out of Scope

- Interpreters other than `python`, `perl`, and `node`, for example `ruby` or `php`.
- An interpreter program in a heredoc body. The hook strips heredoc bodies before the scan.
- The source-dot alternative in `READ_CMD`, which matches any interior dot. See Open Questions.
- Quoted note text passed to `jq --arg`. See Open Questions.
- The stale line citation `deny-env-dump.sh:20-23` in `docs/security-considerations.md`.

## Open Questions

1. The issue states that the secret-path check denies notes passed to `jq --arg`, for example a note that contains `cat .env`. The issue acceptance criteria omit this case. A fix must mask the `--arg` value but keep a value with `$(` or a backtick. Recommendation: defer to a follow-up issue.
2. The `\b\.\b` source-dot match in `READ_CMD` treats any interior dot as a read command. After this plan, `node -e 'console.log(process.env.HOME)'` stays denied through that match. Recommendation: defer to a follow-up issue, because the fix changes a separate rule.
3. A `grep` flag with a separate value, for example `-m 1`, moves the masked operand to the flag value. The real pattern then reaches the secret-path check and the guard denies. This result is a safe false deny. Recommendation: accept the result for this task.

## Acceptance Criteria

- [ ] The `python3 -c` and `perl -e` environment dumps from issue #1155 return `deny`.
- [ ] `grep process.env src/index.ts` returns no decision, and `grep TOKEN .env` returns `deny`.
- [ ] `.agro/evals/probes/secret-exposure-guard.sh` asserts both directions for both gaps and exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no new REGRESSION against the base commit.
- [ ] The fault-injection run of the probe against the base hook exits 1.
- [ ] `git diff --name-only` against the base commit lists no path under `.claude/`.

## Lessons

Filled by the advisor before undraft.
