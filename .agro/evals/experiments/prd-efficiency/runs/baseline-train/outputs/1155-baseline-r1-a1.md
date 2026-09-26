# PRD: Close the interpreter env dump and the env pattern false deny

Status: DRAFT

Issue: [#1155](https://github.com/mifunedev/agro/issues/1155)

## User Stories

### US-001: Deny interpreter reads of the process environment

**Description:** As an operator, I want the Bash guard to deny inline interpreter reads of the environment so that an agent cannot print secrets.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 1 on the `python3 -c` case. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `python3 -c 'import os; print(dict(os.environ))'`.
- [ ] The probe asserts `deny` for `perl -e 'print "$_=$ENV{$_}\n" for keys %ENV'`.
- [ ] The probe asserts `deny` for `ruby -e 'p ENV.to_h'`.
- [ ] The probe asserts `deny` for `node -e 'console.log(process.env)'` and `node -p process.env`.
- [ ] The probe asserts `allow` for `python3 script.py`.
- [ ] The probe holds each environment token (`os.environ`, `%ENV`, `process.env`, `ENV`) in a shell variable, per `.agro/evals/AGENTS.md`.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

### US-002: Allow a search pattern that contains .env

**Description:** As an agent, I want the secret-path check to deny only real env-file tokens so that a search for `process.env` or `Config.Env` runs.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 1 on `grep process.env src/index.ts`. The evidence records the command and the exit status.
- [ ] The probe asserts `allow` for `grep process.env src/index.ts`, `rg process.env src`, `grep "Config.Env" src/config.go`, and `grep os.environ src/app.py`.
- [ ] The probe asserts `deny` for `grep TOKEN .env`, `grep process.env .env`, `grep foo .env.local`, and `sed -n 1p .envrc`.
- [ ] The probe asserts `deny` for `grep process.env key.pem`, `cat key.pem .env.example`, and `cat id_rsa .env.example`.
- [ ] The probe still asserts `deny` for `node -e 'console.log(process.env)'`. US-001 owns that check, so the case stays denied after the secret-path change.
- [ ] Every existing assertion in `secret-exposure-guard.sh` still passes, including `allow` for `cat .env.example`.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] `CHANGELOG.md` `[Unreleased]` `### Fixed` has one entry that links #1155, and the entry is at most 250 characters.

## Summary

`.agro/hooks/deny-env-dump.sh` is the Bash `PreToolUse` guard. `.codex/hooks/deny-env-dump.sh` calls the same hook.

Verified current behavior (advisor run of the hook on `27edb56`, 2026-09-26):

| Command | Decision | Cause |
| --- | --- | --- |
| `python3 -c 'import os; print(dict(os.environ))'` | allow | No term reads interpreter code. |
| `perl -e 'print "$_=$ENV{$_}\n" for keys %ENV'` | allow | No term reads interpreter code. |
| `ruby -e 'p ENV.to_h'`, `node -p process.env` | allow | No term reads interpreter code. |
| `node -e 'console.log(process.env)'` | deny | `READ_CMD` holds `\.`. The `.` in `console.log` matches as a read command. `SECRET_PATH` matches the later `.env`. The match is accidental. |
| `grep process.env src/index.ts`, `rg process.env src`, `grep "Config.Env" src/x.go` | deny | `SECRET_PATH_DENY` matches `.env` inside the pattern. The `env_tokens` loop denies each token whose basename is not an example file. |
| `grep os.environ src/app.py` | deny | The same `.` match in `READ_CMD`, then `.env` inside `.environ`. |
| `cat key.pem .env.example`, `cat id_rsa .env.example` | allow | The `env_tokens` loop sets `ALLOWED=1` when every `.env` token is an example file. The loop ignores the other secret path. The result is a false allow. |

Selected approach:

1. Add a `DENY`-level term for inline interpreter code. The term matches `python`, `python3`, `perl`, `ruby`, or `node` with an inline-code flag: `-c`, `-e`, `-E`, or `-p`. The same command segment must hold an environment token: `environ`, `%ENV`, `$ENV{`, `ENV`, or `process.env`.
2. In the secret-path check, count a `.env` token as an env file only when the token basename matches `^\.env`. The rule matches `DENY_PATH` in `.agro/hooks/deny-secret-paths.sh`.
3. In the secret-path check, deny when a secret path other than an env file matches, even when every env file is an example file. The change closes the `cat key.pem .env.example` false allow. US-002 must close the false allow, because the narrower env-file rule removes the accidental deny on `grep process.env key.pem`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
| --- | --- | --- |
| `.agro/hooks/deny-env-dump.sh` | `DENY`, `SECRET_PATH`, `SECRET_PATH_DENY`, `env_tokens` loop | The Bash guard. Both fixes land here. |
| `.agro/evals/probes/secret-exposure-guard.sh` | assertion list, `# desc:` header | US-001 and US-002 assertions. |
| `.agro/hooks/deny-secret-paths.sh` | `DENY_PATH` | The file-tool guard. `DENY_PATH` is the reference for the env-file basename rule. No change. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Calls the shared hook. No change. |
| `CHANGELOG.md` | `[Unreleased]` `### Fixed` | One entry. |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| Claude Code Bash `PreToolUse` | behavior | Denies inline interpreter environment reads. Allows search patterns that contain `.env`. |
| Codex Bash hook | behavior | Inherits the same change through the wrapper. |

## Storage

N/A. The hook is stateless.

## Architectural Decisions

- The shared hook stays the single source of truth.
- The interpreter term denies a single value read, such as `os.environ["HOME"]`, as well as a full dump. The #1150 `jq` check set this precedent: a single value can be a secret, and the guard cannot tell a secret name from a safe name.
- The interpreter term reads the raw command text. The term adds no argument parser.
- The env-file rule uses the token basename. A token is an env file when the basename starts with `.env`. The rule keeps the example, sample, and template exemption.
- `grep -e .env src` stays denied. The pattern token `.env` is the same text as an env file path, and the guard cannot tell the two apart. Deny on doubt.
- The stories extend the existing probe and add no probe file.
- US-002 depends on US-001. Without the interpreter term, the US-002 change turns `node -e 'console.log(process.env)'` from deny to allow.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
| --- | --- | --- |
| `.agro/evals/probes/secret-exposure-guard.sh` | US-001 deny and allow cases | The guard denies inline interpreter environment reads and allows an interpreter script run. |
| `.agro/evals/probes/secret-exposure-guard.sh` | US-002 deny and allow cases, all existing cases | The guard allows `.env` and `.environ` inside a search pattern, denies env-file reads, and denies other secret paths beside an example file. |
| `bash .claude/skills/eval/run.sh` | all probes | No new red beyond `next-dev-prod` and `skills-vendored`, the persistent red on 2026-09-26. |

Each story adds its probe assertions first and records the probe exit 1 against the unchanged hook. Then the story changes the hook.

Drive the probe from a file. The guard reads the raw command text, so an inline command that names an environment token is itself denied. Follow the file-fixture driver pattern in `.agro/evals/AGENTS.md`.

## Design Principles

- Deny on doubt. A parse gap produces a false deny, never a false allow.
- One source of truth: `.agro/hooks/deny-env-dump.sh`.
- Change the smallest set of patterns that closes the reported gaps.
- Add no explanatory comments to the hook (root `AGENTS.md`, non-negotiable 5).

## Out of Scope

- An interpreter that reads its program from a heredoc, a pipe, or a script file. The hook strips heredoc bodies, and the hook cannot read a script file.
- Other interpreters, such as `php`, `deno`, `bun`, and `lua`.
- Command text that only names a guarded command inside an argument, such as notes in `jq --arg`. The workaround is a notes file through `--rawfile`. The #1150 lessons record this decision.
- `yq` filters.

## Open Questions

None.

## Acceptance Criteria

- [ ] `python3 -c 'import os; print(dict(os.environ))'` and `perl -e 'print "$_=$ENV{$_}\n" for keys %ENV'` are denied.
- [ ] `grep process.env src/index.ts` is allowed, and `grep TOKEN .env` is denied.
- [ ] `cat key.pem .env.example` is denied.
- [ ] `.agro/evals/probes/secret-exposure-guard.sh` asserts both directions and exits 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no new red.

## Lessons

Filled by the advisor before undraft.
