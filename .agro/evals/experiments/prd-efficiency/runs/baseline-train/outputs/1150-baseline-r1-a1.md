# PRD: Close the secret-guard false allows for jq env and quoted inspect json

Status: DRAFT

Issue: [#1150](https://github.com/mifunedev/agro/issues/1150) (#1152 merged into it)

## User Stories

### US-001: Deny a jq call that reads the env builtin or `$ENV`

**Description:** As an operator, I want the Bash guard to deny a `jq` read of `env` or `$ENV` so that an agent cannot print the environment through `jq`.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 1 on `jq -n 'env'`. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `jq -n 'env'`, `jq -n '$ENV'`, `jq -n "env"`, `jq -n '$ENV.HOME'`, `jq -n 'env.HOME'`, `jq -n '1 | env'`, `jq -n '{e: env}'`, and `jq --arg k v -n 'env'`.
- [ ] The probe keeps its `allow` assertions for `jq '.env' .claude/settings.json`, `jq -r '.env // {}' .claude/settings.json`, and `jq .env .claude/settings.json`.
- [ ] The probe asserts `allow` for `jq -r '.environment' x.json` and `jq '.x | .env' .claude/settings.json`.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] The probe `# desc:` header names the jq env check.

### US-002: Deny a single-quoted json format value on docker inspect

**Description:** As an operator, I want the container-inspect guard to deny a `json` format value in every quoting form so that an agent cannot print `Config.Env` through `--format 'json'`.

**Acceptance Criteria:**

- [ ] Before the hook change, `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 1 on `docker inspect --format 'json' web`. The evidence records the command and the exit status.
- [ ] The probe asserts `deny` for `docker inspect --format 'json' web`, `docker inspect -f 'json' web`, and `docker inspect --format='json' web`.
- [ ] The probe keeps its `allow` assertions for narrow templates, such as `docker inspect --format '{{.State.Health.Status}}' agro`.
- [ ] After the hook change, `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.
- [ ] No `DOCKER_FMT_UNSAFE` line in `.agro/hooks/deny-env-dump.sh` contains `\x27`.
- [ ] `CHANGELOG.md` `[Unreleased]` `### Fixed` has one entry that links #1150.

## Summary

`.agro/hooks/deny-env-dump.sh` is the Bash `PreToolUse` guard. `.claude/settings.json` wires it to the `Bash` matcher. `.codex/hooks/deny-env-dump.sh` calls it. #1149 (PR #1151, merge `90707bd`) is on `development`.

Verified current behavior (advisor run of the hook on `90707bd`, 2026-09-26):

| Command | Decision | Cause |
| --- | --- | --- |
| `jq -n 'env'`, `jq -n "env"`, `jq -n '$ENV'` | allow | No `DENY` term matches a quoted `env` or `$ENV`. |
| `jq -n '$ENV.HOME'`, `jq -n 'env.HOME'`, `jq -n '[$ENV]'`, `jq -n '{e: env}'` | allow | Same cause. |
| `jq -n env`, `jq -n 'env \| keys'` | deny | The bare-`env` `DENY` terms match by accident. |
| `jq '.env' .claude/settings.json` | allow | Correct. #1149 fixed it. |
| `docker inspect --format 'json' web`, `-f 'json'`, `--format='json'` | allow | `DOCKER_FMT_UNSAFE` writes the quote class as `["\x27]` inside a single-quoted string. `grep -E` reads the class as `"`, `\`, `x`, `2`, `7`. |
| `docker inspect --format json web`, `--format "json"` | deny | Correct. |

Selected approach:

1. Add one `DENY` term: a `jq` token, then any text, then `$ENV` or an `env` token. The `env` token has no `.`, `$`, `/`, `-`, `_`, or alphanumeric character before it. The `env` token has no `/`, `-`, `_`, or alphanumeric character after it. The advisor prototype of this term:

   ```bash
   DENY+='|(^|[^A-Za-z0-9_-])jq\b.*(\$ENV\b|(^|[^A-Za-z0-9_.$/-])env([^A-Za-z0-9_/-]|$))'
   ```

2. In the `DOCKER_FMT_UNSAFE` `json` term, replace each `["\x27]` with `["'\'']`.

The advisor ran the prototype on a copy of the hook. Each US-001 and US-002 `deny` case returned `deny`. Each `allow` case returned `allow`. `jq . env.json` returned `deny`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
| --- | --- | --- |
| `.agro/hooks/deny-env-dump.sh` | `DENY` | US-001 adds the jq env term. |
| `.agro/hooks/deny-env-dump.sh` | `DOCKER_FMT_UNSAFE` | US-002 fixes the quote class. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Calls the shared hook. No change. |
| `.agro/evals/probes/secret-exposure-guard.sh` | `assert` table | US-001 adds the jq env cases. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `assert` table | US-002 adds the single-quoted cases. |
| `CHANGELOG.md` | `[Unreleased]` `### Fixed` | One entry for #1150. |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| Claude Code Bash `PreToolUse` | behavior | Two false allows become denies. The #1149 allows stay. |
| Codex Bash hook | behavior | Inherits the change through the wrapper. |

## Storage

N/A. The hook is stateless.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` stays the single source of truth. No wrapper or symlink changes.
- The jq env term joins `DENY`, so the deny uses the bulk-env-dump reason. The term runs on the original command string, not on `path_cmd`, because `path_cmd` masks the filter.
- The term scans from the `jq` token to the end of the command. A flag that takes arguments, such as `--arg k v`, cannot hide the filter. The cost is a false deny when `env` appears as a token later in the command, for example `jq . env.json`. Deny on doubt accepts that cost.
- `$ENV.HOME` and `env.HOME` read one value. The guard denies both forms. The issue asks for a deny on any read of `env` or `$ENV`.
- The fix adds no probe file. The two existing guard probes own the two surfaces.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
| --- | --- | --- |
| `.agro/evals/probes/secret-exposure-guard.sh` | US-001 deny and allow cases | The jq env deny, and the #1149 `.env` filter allows. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | US-002 single-quoted cases | The quote-class fix, and the narrow-template allows. |
| `.agro/evals/probes/operator-config-guard.sh` | existing | No regression in the operator-path guard. |
| `bash .claude/skills/eval/run.sh` | all probes | No red beyond the baseline that the advisor records before US-001. |

Each story adds its probe assertions first and records the probe exit 1 against the unchanged hook. Then the story changes the hook.

## Design Principles

- Deny on doubt. A parse gap produces a false deny, never a false allow.
- One source of truth: `.agro/hooks/deny-env-dump.sh`.
- Change the smallest set of patterns that closes the two reported false allows.
- Add no explanatory comments to the hook or the probes (root `AGENTS.md`, non-negotiable 5).
- Write each probe edit with a file tool, not with a Bash heredoc. The guard reads the Bash command text and denies a heredoc that contains a jq env case.

## Out of Scope

- A jq filter loaded from a file with `-f` or `--from-file`.
- `yq`, `gojq`, `jaq`, and other `jq` variants.
- Other quote-class defects outside `DOCKER_FMT_UNSAFE`. The hook has no other `\x27` in a `grep -E` pattern. The `perl` heredoc strip on line 8 reads `\x27` correctly.

## Open Questions

None.

## Acceptance Criteria

- [ ] `jq -n 'env'` and `jq -n '$ENV'` are denied.
- [ ] `jq '.env' .claude/settings.json` is allowed.
- [ ] `docker inspect --format 'json' web` and `docker inspect -f 'json' web` are denied.
- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh`, `bash .agro/evals/probes/docker-inspect-env-guard.sh`, and `bash .agro/evals/probes/operator-config-guard.sh` exit 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no red beyond the recorded baseline.

## Lessons

Filled by the advisor before undraft.
