# PRD: Deny piped, container, and encoded variants in the secret and operator-path guards

Status: APPROVED

## User Stories

### US-001: Deny stdin-fed interpreter scripts that read a secret from the environment

**Description:** As the operator, I want `deny-env-dump.sh` to inspect a script that a heredoc or a pipe feeds to an interpreter. Then a stdin script cannot read `DATABASE_URL` past the guard.

**Acceptance Criteria:**

- [ ] Red first: the worker adds the deny cases below to `.agro/scripts/__tests__/hooks.test.ts` and runs the file. The worker records that each new deny case fails before the hook change.
- [ ] The hook denies `node - <<'EOF'` with a body that reads `process.env.DATABASE_URL`.
- [ ] The hook denies `node <<'EOF'`, `python3 - <<'EOF'`, and `bash -s <<'EOF'` when the body reads the environment. Environment reads are `process.env`, `os.environ`, `getenv`, `%ENV`, `$ENV{`, and `ENV[`. A `$NAME` or `${NAME}` reference to a secret-named variable also counts.
- [ ] The hook denies a pipe into a bare interpreter, for example `echo 'console.log(process.env.DATABASE_URL)' | node`, and `printf '%s' "$x" | python3 -` when the left side names an environment read.
- [ ] The hook allows a stdin interpreter heredoc whose body reads no environment value, for example `node - <<'EOF'` with `console.log(1)`.
- [ ] The hook allows a prose heredoc that names `process.env.DATABASE_URL`: `gh pr create --body-file - <<'EOF'`, `git commit -F - <<'EOF'`, and `cat > notes.md <<'EOF'`.
- [ ] The denial reason names the remedy: the operator runs the command and pastes only the non-secret value.
- [ ] `corepack pnpm vitest run .agro/scripts/__tests__/hooks.test.ts` exits 0.

### US-002: Deny secret-named environment reads through container and remote exec

**Description:** As the operator, I want `deny-env-dump.sh` to deny `printenv`, `env`, and `echo` of a secret-named variable inside `docker exec`, `agro hands exec`, `ssh`, and `bash -c`. The guard then stops a container secret from reaching a database URL.

**Acceptance Criteria:**

- [ ] Red first: the worker adds the deny cases below to `.agro/scripts/__tests__/hooks.test.ts` and records that each new deny case fails before the hook change.
- [ ] The hook denies `docker exec db printenv POSTGRES_PASSWORD`; today the `ASK` pattern returns `ask` for this command.
- [ ] The hook denies the same read through `podman exec`, `kubectl exec`, `agro hands exec <name> --`, `ssh <host>`, and `bash -c 'printenv GH_TOKEN'`.
- [ ] The hook denies `docker exec db env | grep PASSWORD` and `docker exec db sh -c 'echo $POSTGRES_PASSWORD'`.
- [ ] The hook keeps `ask` for a local `printenv HOME`, and allows `docker exec db psql -c 'select 1'`.
- [ ] The denial reason names the remedy: the operator runs the command and pastes only the non-secret value.
- [ ] `corepack pnpm vitest run .agro/scripts/__tests__/hooks.test.ts` exits 0.

### US-003: Deny encoded operator and secret paths

**Description:** As the operator, I want `deny-env-dump.sh` to decode `base64 -d` and `xxd -r` payloads so that a `.config/` path carried as encoded text cannot pass the operator-path guard.

**Acceptance Criteria:**

- [ ] Red first: the worker adds the deny cases below to `.agro/scripts/__tests__/hooks.test.ts` and records that each new deny case fails before the hook change.
- [ ] When the command contains `base64 -d`, `base64 --decode`, `base64 -D`, or `xxd -r`, the hook decodes each literal payload token. The hook tests the decoded text against `OPERATOR_PATH` and `SECRET_PATH`.
- [ ] The hook denies `echo <base64 of "cat ~/.config/gh/hosts.yml"> | base64 -d | sh` and the same payload written with `> run.sh`.
- [ ] The hook denies a `base64 -d` or `xxd -r` decode that a shell runs (`| sh`, `| bash`, `$(...)`) inside `docker exec`, `agro hands exec`, `ssh`, or `bash -c`. The payload content does not matter.
- [ ] The hook allows `echo aGVsbG8= | base64 -d` and `base64 -d image.b64 > image.png`.
- [ ] The denial reason names the remedy. The operator pastes the value, or the agent names the path in prose through `--body-file` or a heredoc.
- [ ] Test sources build each encoded fixture at run time with `Buffer.from(...).toString("base64")`. No protected path appears as a literal in the test file.
- [ ] `corepack pnpm vitest run .agro/scripts/__tests__/hooks.test.ts` exits 0.

### US-004: Document the new denials

**Description:** As an agent reader, I want `docs/security-considerations.md` and `CHANGELOG.md` to state the new denials so that the documented heredoc remedy matches the hook.

**Acceptance Criteria:**

- [ ] `docs/security-considerations.md` § 2 states that `deny-env-dump.sh` inspects a heredoc body fed to an interpreter, and still ignores a prose heredoc.
- [ ] `docs/security-considerations.md` § 2 lists the container, remote exec, and encoded-path denials.
- [ ] `CHANGELOG.md` `## [Unreleased]` has a `### Fixed` entry that links [#1673](https://github.com/mifunedev/agro/issues/1673).
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh docs/security-considerations.md` exits 0.

### US-005: Capture the manual review evidence

**Description:** As the operator, I want a command transcript in `.agro/tasks/secret-guard-variants/evidence/manual-review.md` so that I can verify each variant without reading the regexes.

**Acceptance Criteria:**

- [ ] The transcript holds the output of `corepack pnpm vitest run .agro/scripts/__tests__/hooks.test.ts` with each new case name and its result.
- [ ] The transcript holds the output of `corepack pnpm test`, and names the 7 `herdr-default.test.ts` failures as the baseline on a node with no `zsh`.
- [ ] The transcript holds the output of `bash .agro/scripts/link-providers.sh --check`.
- [ ] The story runs no live resource, reads no environment secret, and starts no container.

## Summary

Issue [#1673](https://github.com/mifunedev/agro/issues/1673) reports three guard bypasses from the agro-console roadmap run.

Verified current state of `.agro/hooks/deny-env-dump.sh`:

- A `perl` pass replaces every heredoc body with `<<HEREDOC_STRIPPED` before any check runs. A `node - <<'EOF'` body that reads `process.env` therefore reaches no pattern.
- `INTERP_ENV_READ` denies an environment read only for inline code flags (`-c`, `-e`, `-p`, `--eval`, `--print`). A pipe into a bare `node` matches nothing.
- `ASK` returns `ask` for `printenv <NAME>`. The hook has no deny rule for a secret-named `printenv` through `docker exec` or `agro hands exec`.
- `OPERATOR_PATH` and `SECRET_PATH_DENY` match only the literal command text. A `base64` payload hides the path.

Selected approach: add three detectors to `deny-env-dump.sh`, each with failing-first tests in `hooks.test.ts`. The heredoc strip stays for prose. A new detector reads the raw heredoc body only when the heredoc feeds an interpreter.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/hooks/deny-env-dump.sh` | heredoc `perl` strip, `INTERP_CODE`, `INTERP_ENV_READ`, `SECRET_NAME`, `ASK`, `OPERATOR_PATH`, `SECRET_PATH`, `emit` | Canonical `Bash` guard. All three detectors land here. |
| `.agro/hooks/deny-secret-paths.sh` | `OPERATOR_PATH`, `DENY_PATH` | File-tool guard. No change; see Architectural Decisions. |
| `.agro/scripts/__tests__/hooks.test.ts` | `commandDecision`, `describe.concurrent("secret-exposure guard (deny-env-dump.sh)")`, `describe.concurrent("operator-config guard")` | Decision table tests. New cases join these tables. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Codex entry. The worker confirms that the wrapper calls the canonical hook and edits nothing there. |
| `.claude/settings.json` | `hooks.PreToolUse` | Wires the hook for `Bash`. No change. |
| `docs/security-considerations.md` | § 2 | Public description of the guards. |
| `CHANGELOG.md` | `## [Unreleased]` | User-facing change record. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `deny-env-dump.sh` decision for `Bash` | Modified | Three new `deny` shapes. One `ask` shape (`docker exec ... printenv <SECRET>`) becomes `deny`. |
| Denial reason text | Added | Each new reason names the guard remedy. |

## Storage

N/A. The hook is stateless. The hook reads one JSON object on stdin and writes one decision on stdout.

## Architectural Decisions

- Source of truth: `.agro/hooks/deny-env-dump.sh`. The Claude Code and Codex entries call this file. No mirror receives an edit.
- The encoded-path detector lands in `deny-env-dump.sh`, not in `deny-secret-paths.sh`. The issue names `deny-secret-paths.sh`. That hook checks only the file-tool path fields `file_path`, `notebook_path`, `path`, and `glob`. An encoded payload reaches the shell only through `Bash`, and `deny-env-dump.sh` holds the `Bash` operator-path check.
- The heredoc strip stays. A new pass reads the raw command before the strip. The pass selects a heredoc only when the heredoc command word is an interpreter in stdin mode. Stdin mode is `-` or no script operand for `node`, `nodejs`, `python[0-9.]*`, `perl`, and `ruby`. Stdin mode is `-s` or no script operand for `bash`, `sh`, and `zsh`.
- The hook denies a decode that a shell runs inside remote exec without a content check. The hook cannot verify a payload that a variable or a file supplies.
- Decoding uses `perl` core module `MIME::Base64` and `pack("H*")`. The existing hook already depends on `perl` and falls back when `perl` is absent.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/hooks.test.ts` | stdin heredoc deny cases for `node -`, `node`, `python3 -`, `bash -s`; pipe into bare `node` and `python3 -` | US-001 deny |
| `.agro/scripts/__tests__/hooks.test.ts` | prose heredoc allow cases for `gh pr create --body-file -`, `git commit -F -`, `cat > notes.md`; benign stdin script | US-001 no regression |
| `.agro/scripts/__tests__/hooks.test.ts` | `docker exec`, `podman exec`, `kubectl exec`, `agro hands exec`, `ssh`, `bash -c` with `printenv`, `env`, `echo` of a secret-named variable | US-002 deny |
| `.agro/scripts/__tests__/hooks.test.ts` | local `printenv HOME` stays `ask`; `docker exec db psql -c 'select 1'` allows | US-002 no regression |
| `.agro/scripts/__tests__/hooks.test.ts` | base64 and hex payloads of `.config/` and `.env` paths; decode run by a shell inside remote exec | US-003 deny |
| `.agro/scripts/__tests__/hooks.test.ts` | benign `base64 -d` decodes | US-003 no regression |
| all suites | `corepack pnpm test` | No other regression. 7 `herdr-default.test.ts` failures are the baseline on a node with no `zsh`. |

Run each test command in the worktree with `export PATH=$HOME/.local/share/fnm/aliases/default/bin:$PATH` first.

## Design Principles

- Keep one source of truth: edit `.agro/hooks/`, never a provider mirror.
- No explanatory comments in tracked code (AGENTS.md § 5).
- Prefer a narrow detector over a broad one. A false deny on prose costs the operator a retry.
- Each denial names the remedy, so an agent stops instead of trying a new variant.
- Workers never run a denied shape to prove a test. The tests feed JSON to the hook through `spawn`, so no secret read happens.

## Out of Scope

- `deny-secret-paths.sh` logic changes. Its inputs are literal file paths, and no encoded form reaches it.
- `cc-safety-net` matchers and `.pi/extensions/path-guard.ts`.
- Script files on disk that an interpreter runs by path, for example `node script.js`. `docs/security-considerations.md` already names this route as a known gap.
- Brief and skill wording. PR #1674 changed it.
- A user interface change. The evidence story writes a command transcript.

## Open Questions

None. The operator approved the plan on 2026-11-26 and resolved both questions:

1. 1A: the encoding check lives in `deny-env-dump.sh`, the `Bash` command hook.
2. 2A: the hook denies a local base64 or hex decode piped to a shell only inside remote exec or `bash -c`. The hook also denies a decode when the decoded text names a protected path.

## Acceptance Criteria

- [ ] Each of the three issue variants returns `deny`, and each denial reason names the guard remedy.
- [ ] Prose that names a protected path or a secret variable stays allowed through `--body-file` and through a heredoc to a non-interpreter.
- [ ] `corepack pnpm vitest run .agro/scripts/__tests__/hooks.test.ts` exits 0.
- [ ] `corepack pnpm test` shows no failure outside the 7 baseline `herdr-default.test.ts` failures.
- [ ] CI on the task PR reports PASS.

## Lessons

1. Claim: the first review found 9 important bypasses in the new detectors. Evidence: the `/code-review 1675` pass on `dc5f734a` listed 9 shapes. The shapes are stderr redirects (`2>&1`) that cut the heredoc head, stdin scripts through `docker exec` or `ssh`, and shell-body environment dumps. Other shapes are narrow read patterns, `/usr/bin/env` and `sudo -E` launch forms, and multi-stage pipes. The last shapes are heredoc decode payloads, spaced hex, and decoded commands that the hook checked only for paths. Outcome: fixed in this PR (`187e8bef`, `2d3da381`).
2. Claim: the first review nit says that `$AUTHOR` matches the secret name `AUTH` as a substring. Evidence: `SECRET_NAME` matching is a substring match in the existing `echo`/`printf` rule too. Outcome: dropped, because the stdin pass keeps the same semantics as the existing rule, and a prose heredoc is never inspected.
3. Claim: the second review found two prose regressions and three cheap parser gaps. Evidence: the hook denied a prose heredoc that quoted a payload, and the hook denied `find . -name 'env' | xargs ls`. The heredoc end line matched too loosely. Value-taking interpreter options hid stdin mode. The hook did not treat `base64 -di` and `--dec` as decode flags. Outcome: fixed in this PR (`b2e6e738`, `7c02f9be`, `6af2550b`).
4. Claim: the second review found four more evasion shapes. Evidence: `kubectl -n ns exec` global options and wrappers such as `timeout`, `env -0` and bare `export` through remote exec, payloads split across tokens or lines, the `xxd` dump format, and brace-group pipelines. Outcome: dropped. These shapes are deliberate evasion beyond the three issue variants. `docs/security-considerations.md` states that these guards prevent accidents, not deliberate evasion. The AGENTS.md rule and the brief rules from #1674 govern deliberate evasion. The review cap of 2 rounds stops further repair.
5. Claim: no third review pass covered the round-2 repairs. Evidence: the operator set a cap of 2 review rounds. The advisor verified each round-2 repair with `hooks.test.ts` (350 passed) and CI. Outcome: dropped, because the supervisor verifies the PR before `gh pr ready`.
6. Claim: a pre-existing false deny exists. The hook denies `echo 'console.log(process.env.X)' | grep X`. `SECRET_PATH_DENY` reads the `.` in `console.log` as the `.` command. The pattern later matches `.env`. Evidence: the US-001 worker found the false deny and changed its fixtures to avoid it. Outcome: dropped, because the false deny predates this PR and fails safe.
7. Claim: a worker amended an evidence commit after the advisor recorded the commit SHA. Evidence: `0c28ec6e` became `bc6f0db6`, and the advisor corrected `prd.json`. Outcome: dropped, because this lesson is a process observation.
