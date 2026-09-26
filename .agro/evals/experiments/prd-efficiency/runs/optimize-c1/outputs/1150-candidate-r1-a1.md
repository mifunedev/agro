# PRD: Close secret guard env dump gaps

Status: DRAFT

## User Stories

### US-001: Deny jq filters that read the process environment

**Description:** As the operator, I want the Bash guard to deny a `jq` filter that reads `env` or `$ENV` so that `jq` cannot print the environment.

**Acceptance Criteria:**

- [ ] Red first: before the hook change, the new deny asserts in `.agro/evals/probes/secret-exposure-guard.sh` fail for `jq -n 'env'` and `jq -n '$ENV'`, and the probe exits 1.
- [ ] The hook `.agro/hooks/deny-env-dump.sh` returns `deny` for `jq -n 'env'`, `jq -n '$ENV'`, `jq -n "env"`, `jq -n '$ENV.HOME'`, `jq -n 'env.HOME'`, and `jq -rn 'env | keys'`.
- [ ] The hook returns `allow` for `jq '.env' .claude/settings.json`, `jq -r '.env // {}' .claude/settings.json`, and `jq .env .claude/settings.json`.
- [ ] The hook still returns `deny` for the unquoted form `jq -n env`.
- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

### US-002: Deny single-quoted json docker inspect formats

**Description:** As the operator, I want the container-inspect guard to deny a `json` format value in every quoting form so that an agent cannot read `Config.Env` through `--format 'json'`.

**Acceptance Criteria:**

- [ ] Red first: before the hook change, the new deny asserts in `.agro/evals/probes/docker-inspect-env-guard.sh` fail for `docker inspect --format 'json' web` and `docker inspect -f 'json' web`, and the probe exits 1.
- [ ] The hook returns `deny` for `docker inspect --format 'json' web`, `docker inspect -f 'json' web`, `docker inspect --format "json" web`, and `docker inspect --format json web`.
- [ ] The hook returns `allow` for `docker inspect --format '{{json .State.Health}}' agro`.
- [ ] No `DOCKER_FMT_UNSAFE` term in `.agro/hooks/deny-env-dump.sh` contains the text `\x27`.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` exits 0.

## Summary

Issue #1150 reports two false allows in `.agro/hooks/deny-env-dump.sh`. The issue merges #1152 as the second gap. PR #1151 (#1149) landed at `90707bd` on `development`.

Verified current state:

- The `DENY` list runs through `grep -qEi` against the raw command. No term names the `jq` builtin `env` or `$ENV`. The term `(^|[^A-Za-z0-9._/-])env[[:space:]]*$` denies `jq -n env` only because `env` ends the command. A quoted filter such as `'env'` ends with a quote, so no term matches it.
- `DOCKER_FMT_UNSAFE` builds its `json` term as a single-quoted bash string that contains `["\x27]?`. `grep -E` reads `\x27` as literal characters, not as a single quote. The term therefore misses `--format 'json'` and `-f 'json'`.
- `JQ_CALL`, `JQ_PATH_FLAG`, and `mask_jq_filters` already locate the `jq` filter argument for the secret-path tier. That tier runs only after the `DENY` tier.
- `.agro/evals/probes/secret-exposure-guard.sh` already asserts `allow` for `jq '.env' .claude/settings.json`. `.agro/evals/probes/docker-inspect-env-guard.sh` asserts `deny` for the unquoted `--format json web` form only.

Selected approach:

1. Add a case-sensitive jq-environment check to the deny tier. The check denies a `jq` call when the `jq` segment, up to the next `|`, `;`, or `&`, holds `$ENV` or the word `env`. The word `env` counts only when no identifier character, `.`, or `$` precedes it and no identifier character follows it. This rule keeps `.env` field access allowed and denies `env`, `env.HOME`, and `env | keys`. The check runs on the raw command, so the `--arg` and `-f` flag positions cannot hide the filter.
2. Rewrite the `DOCKER_FMT_UNSAFE` `json` term as a double-quoted bash string with the class `[\"']`, the same style that `SECRET_PATH` uses.
3. Extend both probes with deny and allow asserts before the hook change, then change the hook until both probes pass.
4. Add one `### Fixed` entry under `## [Unreleased]` in `CHANGELOG.md`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY`, a new case-sensitive jq-environment pattern, the first `if` branch that calls `emit deny` | US-001 deny rule for `env` and `$ENV` in a `jq` call |
| `.agro/hooks/deny-env-dump.sh` | `DOCKER_FMT_UNSAFE` (`json` term), `DOCKER_FMT`, `DOCKER_INSPECT` | US-002 quote class fix |
| `.agro/evals/probes/secret-exposure-guard.sh` | `assert`, `decision_for`, `SETTINGS_JSON` | US-001 regression probe, both directions |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | `assert`, `decision_for` | US-002 regression probe, both directions |
| `.codex/hooks/deny-env-dump.sh` | wrapper that calls `.claude/hooks/deny-env-dump.sh` | Inherits the fix through the `.claude/hooks` symlink; no edit |
| `CHANGELOG.md` | `## [Unreleased]` / `### Fixed` | One entry that cites #1150 and #1152 |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Bash `PreToolUse` hook decision | Behavior (stricter) | `jq` calls that read `env` or `$ENV` change from `allow` to `deny`. |
| Bash `PreToolUse` hook decision | Behavior (stricter) | `docker inspect` with a single-quoted `json` format value changes from `allow` to `deny`. |
| Deny reason text | Update | The first `emit deny` reason names the `jq` `env`/`$ENV` shape beside the other bulk env dumps. |

## Storage

N/A. The hook is stateless. The hook reads one JSON object on stdin and writes one decision on stdout.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` stays the single source of truth for Bash command policy. `.claude/hooks` is a symlink to `.agro/hooks`, and the Codex wrapper calls the same script. The change edits only the canonical file.
- The jq-environment check is case-sensitive. The `DENY` list runs with `grep -i`, which would make `$ENV` match the shell variable `$env`. The check therefore lives in a separate `grep -qE` pattern, evaluated in the deny branch.
- The check scans the whole `jq` segment, not only the filter slot that `JQ_CALL` extracts. A filter slot check misses `jq -n --arg k v 'env'`. The accepted cost: a quoted object key or file name that equals `env`, such as `jq '{env: 1}'`, is denied.
- The `json` format fix keeps the existing term shape and changes only the quote class.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-exposure-guard.sh` | deny: `jq -n 'env'`, `jq -n '$ENV'`, `jq -n "env"`, `jq -n '$ENV.HOME'`, `jq -n 'env.HOME'`, `jq -rn 'env \| keys'`, `jq -n --arg k v 'env'`, `jq -n env` | US-001 deny direction |
| `.agro/evals/probes/secret-exposure-guard.sh` | allow: the existing `.env` filter asserts on `.claude/settings.json` | US-001 allow direction after #1149 |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | deny: `docker inspect --format 'json' web`, `docker inspect -f 'json' web`, `docker inspect --format "json" web` | US-002 deny direction |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | allow: the existing narrow `--format` asserts, including `{{json .State.Health}}` | US-002 allow direction |
| `.agro/skills/eval/run.sh` | full probe suite | No new REGRESSION |

Run order for each story:

1. Add the asserts to the probe.
2. Run the probe. The probe exits 1 and names the new case.
3. Change the hook.
4. Run the probe. The probe exits 0.
5. Run `bash .agro/skills/eval/run.sh`. Compare the result with the base commit. No probe changes from PASS to REGRESSION.

The probes build commands in shell variables, per `.agro/evals/AGENTS.md`. Split the literal `$ENV` in the probe source, for example `E='$'; E+=ENV`, so that the probe file itself stays clear of the pattern.

## Design Principles

- Keep one canonical hook. Do not patch `.codex/hooks/deny-env-dump.sh` or a provider mirror.
- Add no code comments, per `AGENTS.md` principle 5.
- Prefer a stricter deny with a narrow, named false-positive cost over a precise rule with a known bypass.
- Assert both directions in each probe: the new deny cases and the allow cases from #1149.
- Drive each probe red before the hook change, per the fault-injection rule in `.agro/evals/AGENTS.md`.

## Out of Scope

- Other environment readers, such as `python -c 'import os; print(os.environ)'`, `node -e 'console.log(process.env)'`, or `perl -e 'print %ENV'`.
- The `jq` builtin `$__prog_args` and other `jq` builtins.
- A rewrite of `docs/security-considerations.md`. The doc lists deny categories, and "bulk env dumps" already covers the `jq` shapes.
- The `permissions.deny` list in `.claude/settings.json`.
- Public documentation in `mifunedev/agro-web`. The change adds no new user-facing term.

## Open Questions

1. The issue names `bash .claude/skills/eval/run.sh` as the runner. Git does not track that path. The tracked runner is `.agro/skills/eval/run.sh`. This plan uses the tracked runner. Confirm that the two paths run the same suite.
2. The plan accepts a deny for a quoted `jq` object key or file name that equals `env`. Confirm this cost, or ask for a filter-slot rule with the `--arg` bypass as the cost.

## Acceptance Criteria

- [ ] `jq -n 'env'` and `jq -n '$ENV'` return `deny` from `.agro/hooks/deny-env-dump.sh`.
- [ ] `jq '.env' .claude/settings.json` returns `allow` from `.agro/hooks/deny-env-dump.sh`.
- [ ] `docker inspect --format 'json' web` and `docker inspect -f 'json' web` return `deny` from `.agro/hooks/deny-env-dump.sh`.
- [ ] `.agro/evals/probes/secret-exposure-guard.sh` asserts both directions for the `jq` cases and exits 0.
- [ ] `.agro/evals/probes/docker-inspect-env-guard.sh` asserts both single-quoted `json` forms and exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no probe that changes from PASS to REGRESSION against the base commit.
- [ ] `CHANGELOG.md` holds one `### Fixed` entry under `## [Unreleased]` that cites #1150 and #1152.
- [ ] `git diff --name-only` lists only `.agro/hooks/deny-env-dump.sh`, the two probes, and `CHANGELOG.md`.

## Lessons

Filled by the advisor before undraft.
