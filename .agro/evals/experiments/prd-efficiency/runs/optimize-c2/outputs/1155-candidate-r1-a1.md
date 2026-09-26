# PRD: Close the env guard accuracy gaps

Status: DRAFT

Issue: [#1155](https://github.com/mifunedev/agro/issues/1155)

## User Stories

### US-001: Deny interpreter environment dumps

**Description:** As an operator, I want inline interpreter environment dumps denied so that secrets stay out of transcripts.

**Acceptance Criteria:**

- [ ] The hook `.agro/hooks/deny-env-dump.sh` returns `deny` for `python3 -c 'import os; print(dict(os.environ))'`.
- [ ] The hook returns `deny` for `perl -e 'print "$_=$ENV{$_}\n" for keys %ENV'`.
- [ ] The hook returns `deny` for `node -e 'console.log(process.env)'` through the new interpreter rule, and the deny reason names the interpreter environment read.
- [ ] The hook returns `allow` for `python3 -c 'import os; print(os.environ["HOME"])'` and for `node -e 'console.log(process.env.HOME)'`.
- [ ] The probe `.agro/evals/probes/secret-exposure-guard.sh` asserts each case above. The probe exits 1 when the new rule is removed from the hook.

### US-002: Allow `.env` inside search patterns

**Description:** As an agent, I want search patterns that contain `.env` allowed so that ordinary code searches run.

**Acceptance Criteria:**

- [ ] The hook returns `allow` for `grep process.env src/index.ts`.
- [ ] The hook returns `allow` for `grep "Config.Env" src/index.ts`.
- [ ] The hook returns `deny` for `grep TOKEN .env`, `cat .env`, and `cat ./app/.env.local`.
- [ ] Every existing assertion in `.agro/evals/probes/secret-exposure-guard.sh` still passes.
- [ ] The probe asserts each new case above. The probe exits 1 when the secret-path change is reverted.

## Summary

The Bash `PreToolUse` hook `.agro/hooks/deny-env-dump.sh` has two accuracy gaps. The advisor found both gaps during #1150 (PR #1154).

Verified current state:

- The `DENY` pattern list has no rule for an interpreter that reads the whole process environment. The hook allows `python3 -c` with `dict(os.environ)` and `perl -e` with `keys %ENV`.
- The hook denies `node -e 'console.log(process.env)'` only through `SECRET_PATH_DENY`. The `READ_CMD` alternative `\.` matches the dot in `console.log`, and `SECRET_PATH` then matches `.env)` in `process.env)`.
- `SECRET_PATH` starts with `\.env` and has no left boundary. The match is case-insensitive. Thus `process.env` and `Config.Env` match as secret-file paths after `grep`.

Selected approach:

1. Add one `DENY` rule for inline interpreter code. The rule matches an interpreter inline-code flag, such as `python3 -c`, `perl -e`, or `node -e`, followed by a whole-environment read in the same command segment. A whole-environment read is `os.environ` or `process.env` with no key access after it, or `%ENV` in Perl.
2. Give the `.env` alternative of `SECRET_PATH` a left boundary. The boundary is the start of the text, whitespace, a quote, a slash, `=`, or `<`. A `.env` token after a word character, such as `process.env`, is not a path.

The interpreter rule requires the inline-code flag. Thus the rule does not deny `grep process.env src/index.ts`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY`, deny reason in the first `emit deny` branch | Add the interpreter environment-dump rule. |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH`, `READ_CMD`, `SECRET_PATH_DENY`, `env_tokens` | Add the left boundary to the `.env` alternative. |
| `.agro/evals/probes/secret-exposure-guard.sh` | `assert`, `# desc:` header, final `PASS` line | Add allow and deny assertions for both gaps. |
| `docs/security-considerations.md` | Command guard description near line 56 | Add the interpreter rule to the list of denied patterns if the list names each rule. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Bash `PreToolUse` hook decision | Behavior change | New `deny` for inline interpreter environment dumps. New `allow` for search patterns that contain `.env` after a word character. |
| Provider mirrors `.claude/hooks` and `.codex/hooks/deny-env-dump.sh` | None | The mirrors call the canonical hook. Do not edit a mirror. |

## Storage

N/A. The hook is stateless. The hook reads one JSON object from stdin and writes one decision.

## Architectural Decisions

- `.agro/hooks/deny-env-dump.sh` is the one source of truth for the Bash guard. `.agro/scripts/link-providers.sh` exposes the hook to each provider.
- The interpreter rule is part of the first `DENY` tier. Its deny reason must name an interpreter environment dump.
- The boundary fix changes only the `.env` alternative of `SECRET_PATH`. The other secret-path alternatives stay unchanged.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-exposure-guard.sh` | `deny` for the `python3 -c`, `perl -e`, and `node -e` environment dumps | US-001 deny cases |
| `.agro/evals/probes/secret-exposure-guard.sh` | `allow` for single-key reads through `os.environ["HOME"]` and `process.env.HOME` | US-001 scope |
| `.agro/evals/probes/secret-exposure-guard.sh` | `allow` for `grep process.env src/index.ts` and `grep "Config.Env" src/index.ts` | US-002 allow cases |
| `.agro/evals/probes/secret-exposure-guard.sh` | `deny` for `grep TOKEN .env`, plus the existing env-file cases | US-002 deny cases |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | Existing cases | No regression in the inspect guard |
| `.agro/evals/probes/operator-config-guard.sh` | Existing cases | No regression in the operator-path guard |

Write the new assertions first. Run the probe and confirm that the probe exits 1 on the current hook. Then change the hook. Hold the sensitive tokens in shell variables, per `.agro/evals/AGENTS.md`.

Run the full suite with `bash .agro/skills/eval/run.sh`. The issue names the runner through the `.claude` mirror path, which git does not track.

## Design Principles

- Keep one canonical hook. Do not patch a provider mirror.
- Add no comments to the hook or the probe.
- Deny by structure, not by an unrelated term. Each deny must come from the rule that describes the risk.
- Prefer the smallest regular-expression change that closes each gap.

## Out of Scope

- Other interpreters, such as `ruby -e` or `deno eval`, unless the implementer adds them to the same rule at no extra cost.
- Interpreter scripts in files, such as `python3 dump.py`. The hook sees only the command text.
- The `deny-secret-paths.sh` hook and the `Read` deny list in `.claude/settings.json`.

## Open Questions

1. The issue reports a false deny for command text that only names a guarded command, such as notes passed to `jq --arg`. The issue gives no exact reproduction and no acceptance criterion for this case. Is this case in scope for this task, or does a separate issue track it?
2. Must the interpreter rule also cover `python -c` with `os.environ.items()`, `os.environ.copy()`, and `os.environb`? The plan assumes yes, because each form reads the whole environment.

## Acceptance Criteria

- [ ] The `python3 -c` and `perl -e` environment dumps from the issue return `deny`.
- [ ] `grep process.env src/index.ts` returns `allow`, and `grep TOKEN .env` returns `deny`.
- [ ] `.agro/evals/probes/secret-exposure-guard.sh` asserts both directions and exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no new REGRESSION against the base `.agro/evals/RESULTS.md`.
- [ ] No provider mirror file changes in the diff.

## Lessons

Filled by the advisor before undraft.
