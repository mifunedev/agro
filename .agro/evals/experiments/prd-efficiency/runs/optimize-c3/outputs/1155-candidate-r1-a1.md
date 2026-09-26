# PRD: Secret guard interpreter and search-pattern accuracy

Status: DRAFT

## User Stories

### US-001: Deny interpreter environment dumps

**Description:** As an operator, I want interpreter environment dumps denied so that secrets stay out of transcripts.

**Acceptance Criteria:**

- [ ] The hook returns `deny` for `python3 -c 'import os; print(dict(os.environ))'`.
- [ ] The hook returns `deny` for `perl -e 'print "$_=$ENV{$_}\n" for keys %ENV'`.
- [ ] The hook returns `deny` for `node -e 'console.log(process.env)'` through the new interpreter rule, not through an unrelated term.
- [ ] The hook returns an empty output for `echo process.env`, because `echo` is not an interpreter.
- [ ] A red test comes first: the new probe cases fail on the base commit before the hook change.
- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

### US-002: Allow env text inside search patterns

**Description:** As an agent, I want search patterns with env text allowed so that code searches succeed.

**Acceptance Criteria:**

- [ ] The hook returns an empty output for `grep process.env src/index.ts`.
- [ ] The hook returns an empty output for `grep "Config.Env" README.md`.
- [ ] The hook still returns `deny` for `grep TOKEN .env`, `cat .env`, and `cat ./app/.env.local`.
- [ ] Every existing assertion in `.agro/evals/probes/secret-exposure-guard.sh` still passes.
- [ ] A red test comes first: the new allow cases fail on the base commit before the hook change.
- [ ] `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

## Summary

The hook `.agro/hooks/deny-env-dump.sh` has two accuracy gaps from issue 1155.
First, the `DENY` pattern set has no rule for a script interpreter that prints the whole process environment.
Second, the first `SECRET_PATH` alternative matches `.env` at any position in a token.
The `SECRET_PATH_DENY` grep runs with `-i`, so `Config.Env` also matches.
US-001 adds one interpreter rule to `DENY`. The rule applies only when the command invokes python, perl, node, or ruby.
US-002 anchors the env-file alternative at a path-token start: line start, whitespace, a slash, a quote, `=`, or `<`.
The same anchor applies to the `env_tokens` exemption grep.
The probe `.agro/evals/probes/secret-exposure-guard.sh` gets allow and deny cases for both gaps.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | `DENY` | Add the interpreter whole-environment rule (US-001). |
| `.agro/hooks/deny-env-dump.sh` | `SECRET_PATH`, `SECRET_PATH_DENY`, `env_tokens` | Anchor the env-file match at a path-token start (US-002). |
| `.agro/evals/probes/secret-exposure-guard.sh` | `assert`, `# desc:` header, final PASS line | Add cases for both gaps and update the description. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | No change. The implementer confirms that the wrapper delegates to the canonical hook. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Bash `PreToolUse` hook decision | Behavior | Interpreter environment dumps change from allow to deny. Search patterns with env text change from deny to allow. |
| Deny reason text | Text | The `DENY` reason names interpreter environment dumps. |

## Storage

N/A. The hook is stateless and reads one command from stdin.

## Architectural Decisions

- The canonical hook `.agro/hooks/deny-env-dump.sh` stays the single source of truth. Provider directories do not get a copy.
- The interpreter rule matches whole-environment reads only: `dict(os.environ)`, `os.environ` iteration, `%ENV`, and `process.env` as a whole object.
- The env-file anchor keeps the `-i` flag. The anchor alone rejects `Config.Env` and `process.env`.
- Surface check: host and sandbox, not applicable; lifecycle door, not applicable; canonical source, applied; public documentation, not applicable.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/evals/probes/secret-exposure-guard.sh` | deny for the `python3 -c`, `perl -e`, and `node -e` dumps | US-001 interpreter rule |
| `.agro/evals/probes/secret-exposure-guard.sh` | allow for `grep process.env src/index.ts` and `grep "Config.Env" README.md` | US-002 anchor |
| `.agro/evals/probes/secret-exposure-guard.sh` | deny for `grep TOKEN .env` | US-002 keeps env-file reads denied |
| `.agro/evals/probes/secret-exposure-guard.sh` | a fault injection against a disposable hook copy without each new rule | The REGRESSION branch names the gap |
| `.agro/skills/eval/run.sh` | the full probe suite | No new red |

## Design Principles

- Change the canonical hook only. Do not patch a provider mirror.
- Hold sensitive fixture tokens in shell variables, as the existing probe does with `H` and `JQ_ENV_VAR`.
- Add no comments to the hook or the probe.
- Prefer one narrow rule per gap over a general command parser.

## Out of Scope

- Single-key environment reads, for example `os.environ["HOME"]`.
- Interpreters other than python, perl, node, and ruby.
- The false deny for guarded command names inside `jq --arg` note text. See Open Questions.
- The eval runner path in the issue goes through a symlinked provider directory. This plan cites the canonical runner `.agro/skills/eval/run.sh`.

## Open Questions

1. The issue reports a false deny for guarded command names inside `jq --arg` notes. The issue acceptance criteria omit this case. Does the operator want this case in scope?
2. Must the guard deny or ask for single-key interpreter reads of secret-named variables, as `ASK` does for `printenv`?

## Acceptance Criteria

- [ ] The `python3 -c` and `perl -e` environment dumps from the issue return `deny`.
- [ ] `grep process.env src/index.ts` returns an empty output, and `grep TOKEN .env` returns `deny`.
- [ ] `.agro/evals/probes/secret-exposure-guard.sh` asserts both directions and exits 0.
- [ ] `bash .agro/skills/eval/run.sh` reports no new REGRESSION.

## Lessons

Filled by the advisor before undraft.
