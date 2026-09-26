# PRD: Secret guard accuracy for interpreter dumps and search patterns

Status: DRAFT

Issue: [#1155](https://github.com/mifunedev/agro/issues/1155) (found during #1150, PR #1154)

## User Stories

### US-001: Deny environment reads in inline interpreter code

**Description:** As an operator, I want the Bash guard to deny inline interpreter code that reads the environment so that an agent cannot print secrets.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 1 on the `python3 -c` environment dump. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `python3 -c 'import os; print(dict(os.environ))'`.
- [ ] The probe asserts `deny` for `perl -e 'print "$_=$ENV{$_}\n" for keys %ENV'`.
- [ ] The probe asserts `deny` for `node -e 'console.log(process.env)'` and `ruby -e 'p ENV'`.
- [ ] The probe asserts `deny` for `python3 -c 'import os; print(os.getenv("GH_TOKEN"))'`.
- [ ] The probe asserts `allow` for `python3 script.py` and `python3 -c 'print(1)'`.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

### US-002: Anchor the env-file path term to a path token

**Description:** As an agent, I want the secret-path check to match `.env` only at a path start so that the guard allows the search pattern `process.env`.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 1 on `grep process.env src/index.ts`. The evidence records the command and the exit status.
- [ ] The probe asserts `allow` for `grep process.env src/index.ts`, `grep "Config.Env" .claude/settings.json`, and `rg process.env src`.
- [ ] The probe asserts `deny` for `grep TOKEN .env`, `grep -r TOKEN .env.local`, `grep -n foo src/.env`, and `sed -n 1p .env`.
- [ ] The probe still asserts `deny` for `node -e 'console.log(process.env)'`.
- [ ] Every existing assertion in `secret-exposure-guard.sh` and `docker-inspect-env-guard.sh` still passes.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] The **Command guard** section of `docs/security-considerations.md` lists inline interpreter environment reads under **Deny**.
- [ ] `CHANGELOG.md` `[Unreleased]` `### Fixed` has one entry that links #1155. The entry has at most 250 characters.

## Summary

`.agro/hooks/deny-env-dump.sh` is the Bash `PreToolUse` guard. `.claude/hooks` is a symlink to `.agro/hooks`. `.codex/hooks/deny-env-dump.sh` calls the shared hook.

Verified current behavior. The planner ran the hook on `development` at `27edb56` on 2026-09-26. The planner used a file-fixture driver.

| Command | Decision | Cause |
| --- | --- | --- |
| `python3 -c 'import os; print(dict(os.environ))'` | allow | No term reads interpreter code. |
| `perl -e 'print "$_=$ENV{$_}\n" for keys %ENV'` | allow | No term reads interpreter code. |
| `ruby -e 'p ENV'`, `python3 -c '... os.getenv("HOME") ...'` | allow | No term reads interpreter code. |
| `node -e 'console.log(process.env)'` | deny | `SECRET_PATH_DENY` matches. `READ_CMD` holds `\.`, so the `.` in `console.log` acts as a read command, and `.env` in `process.env` acts as an env-file path. |
| `grep process.env src/index.ts`, `rg process.env src` | deny | The `SECRET_PATH` term `\.env[^[:space:]/"']*` has no left anchor. |
| `grep "Config.Env" .claude/settings.json` | deny | The same unanchored term matches, and `grep -i` ignores case. |
| `grep TOKEN .env.example` | allow | The template basename exemption applies. |
| `grep TOKEN .env`, `cat .env`, `grep -n foo src/.env` | deny | Correct. |

Selected approach:

1. Add a deny branch for inline interpreter code. The branch matches an interpreter word followed by an inline-code flag. The interpreter words are `python`, `python3`, `python3.N`, `perl`, `ruby`, `node`, and `nodejs`. The inline-code flags are `-c`, `-e`, `-E`, `-p`, `--eval`, `--print`, and a short flag cluster that ends in `c`, `e`, `E`, or `p`. The branch denies when the text after the flag holds an environment token. The environment tokens are `os.environ`, `os.getenv`, `%ENV`, `$ENV{`, the whole word `ENV`, and `process.env`. The token match is case-sensitive.
2. Anchor the `.env` term in `SECRET_PATH` to the start of a path component. The anchor is the start of the command, whitespace, a quote, `/`, `=`, `<`, `(`, or a backtick. Apply the same anchor to the `env_tokens` extraction for the template exemption.
3. US-001 lands first. After step 2, the `node -e` command no longer matches the secret-path check, so the step 1 branch must already deny it.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
| --- | --- | --- |
| `.agro/hooks/deny-env-dump.sh` | new interpreter pattern and deny branch | US-001 check. |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH`, `env_tokens` extraction | US-002 anchor. |
| `.agro/evals/probes/secret-exposure-guard.sh` | assertion list | US-001 and US-002 assertions. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Calls the shared hook. No change. |
| `docs/security-considerations.md` | **Command guard** section | US-002 documentation line. |
| `CHANGELOG.md` | `[Unreleased]` `### Fixed` | One entry. |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| Claude Code Bash `PreToolUse` | behavior | The hook denies inline interpreter environment reads. The hook allows `.env` text inside a word. |
| Codex Bash hook | behavior | Inherits the same change through the wrapper. |
| `mifunedev/agro-web` | none | The public site does not document the guard patterns. |

## Storage

N/A. The hook is stateless.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` stays the single source of truth.
- The interpreter check denies a single-value read, such as `os.getenv("HOME")`, as well as a full dump. This decision matches the `jq` decision in #1150: the guard cannot tell a secret name from a safe name in code.
- The interpreter check reads the text after the inline-code flag. The check adds no language parser.
- The `.env` anchor mirrors the `Read(file_path=**/.env*)` rule in `.claude/settings.json`: a path component that starts with `.env`. A file such as `prod.env` changes from deny to allow. The `Read` rule does not guard `prod.env` either.
- The interpreter deny branch has its own reason text. The reason tells the agent to ask the operator for the one non-secret value.
- The stories extend the existing probe and add no probe file.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
| --- | --- | --- |
| `.agro/evals/probes/secret-exposure-guard.sh` | US-001 deny and allow cases | The guard denies inline interpreter environment reads and allows interpreter calls without them. |
| `.agro/evals/probes/secret-exposure-guard.sh` | US-002 allow and deny cases | The guard allows `.env` text inside a word and denies env-file paths. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | all existing cases | The anchor change does not alter the container-inspect guard. |
| `bash .claude/skills/eval/run.sh` | all probes | The run shows no red probe beyond the reds of a branch-base run before US-001. |

Each story adds the probe assertions first and records the probe exit 1 against the unchanged hook. Then the story changes the hook. The probe holds sensitive tokens in shell variables and drives the hook through fixture files, per `.agro/evals/AGENTS.md`.

## Design Principles

- Deny on doubt. A parse gap produces a false deny, never a false allow.
- One source of truth: `.agro/hooks/deny-env-dump.sh`.
- Change the smallest set of patterns that closes the two reported gaps.
- Add no explanatory comments to the hook (root `AGENTS.md`, non-negotiable 5).

## Out of Scope

- Interpreter code that a script file or a heredoc supplies, such as `python3 script.py` or `python3 - <<EOF`. The hook strips heredoc bodies before the checks run.
- Other interpreters, such as `php -r`, `deno eval`, `bun -e`, and `awk` `ENVIRON`.
- A search pattern that is exactly `.env`, such as `grep '.env' src/app.ts`. The guard cannot tell that pattern from a path.
- Command text that only names a guarded command, such as notes passed to `jq --arg`. The workaround is a notes file through `--rawfile`. The issue acceptance criteria exclude this surface.
- `yq` filters.

## Open Questions

None.

## Acceptance Criteria

- [ ] `python3 -c 'import os; print(dict(os.environ))'` and `perl -e 'print "$_=$ENV{$_}\n" for keys %ENV'` are denied.
- [ ] `grep process.env src/index.ts` is allowed, and `grep TOKEN .env` is denied.
- [ ] `.agro/evals/probes/secret-exposure-guard.sh` asserts both directions, and `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no new red against the branch-base run.

## Lessons

Filled by the advisor before undraft.
