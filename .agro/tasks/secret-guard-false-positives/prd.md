# PRD: Stop secret-guard false positives on trigger words

Status: DRAFT

Issue: [#1149](https://github.com/mifunedev/agro/issues/1149)

## User Stories

### US-001: Match shell-history access by command position

**Description:** As an agent, I want the Bash guard to deny the `history` command so that a commit message can contain the word.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/secret-exposure-guard.sh` exists, declares `# tier:`, `# source:`, and `# desc:` headers, and drives `.agro/hooks/deny-env-dump.sh` through the file-fixture driver pattern.
- [ ] Before the hook change, the probe exits 1 on `git commit -m "record history of X"`. The evidence records the command and the exit status.
- [ ] The probe asserts `allow` for `git commit -m "record history of X"` and `git commit -m "apply task-history signal"`.
- [ ] The probe asserts `deny` for `history`, `history | tail`, `bash -ic history`, `fc -l`, `cat ~/.zsh_history`, and `tail ~/.bash_history`.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.

The guard must deny the `history` command, not the word in an argument. The probe builds the word from parts, so that the probe source passes the guard.

### US-002: Exempt the jq filter argument from the secret-path check

**Description:** As an agent, I want the secret-path check to skip the filter argument of `jq`, so that `jq '.env' .claude/settings.json` reads the settings `env` block.

**Acceptance Criteria:**

- [ ] Before the hook change, the probe exits 1 on `jq '.env' .claude/settings.json`. The evidence records the command and the exit status.
- [ ] The probe asserts `allow` for `jq '.env' .claude/settings.json`, `jq -r '.env // {}' .claude/settings.json`, and `jq .env .claude/settings.json`.
- [ ] The probe asserts `deny` for `cat .env`, `cat ./app/.env.local`, `jq '.env' .env`, `jq -f .env data.json`, `jq --rawfile s .env -n '$s'`, and `jq -n '.' < .env`.
- [ ] The probe asserts `allow` for `cat .env.example`.
- [ ] After the hook change, `bash .agro/evals/probes/secret-exposure-guard.sh` exits 0.
- [ ] `CHANGELOG.md` `[Unreleased]` has one `### Fixed` entry that links #1149.

### US-003: Push only for the draft and before undraft

**Description:** As an operator, I want the advisor to push the task branch only twice so that CI runs once on the finished branch.

The operator added this story during execution. The advisor pushed after each accepted story because `/delegate` Integration step 2 and the `/git` "Draft PR for a task" procedure require a push per story.

**Acceptance Criteria:**

- [ ] `.agro/skills/delegate/SKILL.md` § Integration contains no push step.
- [ ] `.agro/skills/git/SKILL.md` § "Draft PR for a task" states that the advisor commits each accepted story and does not push it.
- [ ] `.agro/skills/git/SKILL.md` § "Ready for review" pushes the task branch once, before `gh pr ready`, and then runs `/ci-status`.
- [ ] `bash .claude/skills/eval/run.sh` reports no new red on `delegate-*`, `advisor-*`, or `prd-*` probes.

### US-004: Triage Close findings before issue creation

**Description:** As an operator, I want each Close finding folded, proposed as an issue, or dropped so that the issue queue holds only defects I approved.

The operator added this story after the ready check. This run opened three issues mid-run, and two of them covered one surface.

**Acceptance Criteria:**

- [ ] `.agro/skills/delegate/SKILL.md` § Close states the fold rule: fold a finding into the PR only when its fix is in a file the PR already changes and the PR caused or exposed the finding, or the finding breaks the chain in use.
- [ ] § Close states the issue rule: one proposed issue per defect surface, and a comment on an open issue that already covers the surface.
- [ ] § Close states that the advisor creates no issue before the operator approves the proposed issues at Close.
- [ ] § Close keeps the three outcomes: fixed in this PR, issue #N, or dropped with the reason.
- [ ] `bash .agro/evals/probes/advisor-execution-contract.sh` and `bash .agro/evals/probes/delegate-worker-boundary.sh` exit 0.

## Summary

`.agro/hooks/deny-env-dump.sh` is the Bash `PreToolUse` guard. `.claude/settings.json` wires it to the `Bash` matcher. `.codex/hooks/deny-env-dump.sh` calls it, so Codex inherits each fix.

Verified current behavior (advisor run of the hook, 2026-09-23):

| Command | Decision | Cause |
| --- | --- | --- |
| `git commit -m "record history of X"` | deny | `DENY` contains `\bhistory\b` with no position anchor. |
| `git commit -m "apply task-history signal"` | deny | Same cause. `-` is a word boundary. |
| `jq '.env' .claude/settings.json` | deny | `SECRET_PATH_DENY` matches `jq` from `READ_CMD`, then `\.env` inside the quoted filter. |
| `cat ~/.zsh_history`, `cat .env` | deny | Correct. |
| `cat .env.example` | allow | Correct. The template allowlist exempts it. |

Selected approach:

1. Replace the bare `\bhistory\b` term in `DENY` with two terms. The first term matches `history` at command position: line start, or after `;`, `&`, `|`, `(`, a backtick, or `$(`. The second term matches `history` as the argument of a shell `-c` flag cluster, such as `bash -ic history`. The history-file paths in `SECRET_PATH` stay unchanged.
2. Compute a second command string for the `SECRET_PATH_DENY` check only. In that string, replace the first positional argument after `jq` and its flags with a placeholder. Skip the replacement when the flags include `-f`, `-L`, or a long flag that contains `file`, because those flags take a path. The `DENY`, `DOCKER_INSPECT`, and `OPERATOR_PATH` checks keep the original command string.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
| --- | --- | --- |
| `.agro/hooks/deny-env-dump.sh` | `DENY`, `SECRET_PATH_DENY` check, `env_tokens` allowlist | The Bash guard. Both fixes land here. |
| `.codex/hooks/deny-env-dump.sh` | wrapper | Calls the shared hook. No change. |
| `.agro/hooks/deny-secret-paths.sh` | `DENY_PATH` | The file-tool guard. No change. It matches paths, not command text. |
| `.agro/evals/probes/secret-exposure-guard.sh` | new | Pins allow and deny decisions for both fixes. |
| `CHANGELOG.md` | `[Unreleased]` | One `### Fixed` entry. |

## Interface Integration Points

| Surface | Change Type | Description |
| --- | --- | --- |
| Claude Code Bash `PreToolUse` | behavior | Fewer false denials. Every listed secret shape stays denied. |
| Codex Bash hook | behavior | Inherits the same change through the wrapper. |

## Storage

N/A. The hook is stateless.

## Architectural Decisions

- The shared hook stays the single source of truth. The Codex wrapper and `.claude/hooks` (a symlink to `.agro/hooks`) need no change.
- The filter exemption applies only to the secret-path check. The `DENY` check keeps the original command string, so the exemption opens no path to a bulk environment dump.
- A misparsed `jq` flag leaves the filter in place. The failure mode is a false deny, never a false allow.
- The task adds one probe file and no probe machinery. No existing probe covers the history or `.env` command shapes. `docker-inspect-env-guard.sh` and `operator-config-guard.sh` cover other guards. A security-boundary change needs a regression pin for both directions.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
| --- | --- | --- |
| `.agro/evals/probes/secret-exposure-guard.sh` | US-001 allow and deny table | The history fix, and that history access stays denied. |
| `.agro/evals/probes/secret-exposure-guard.sh` | US-002 allow and deny table | The filter fix, and that `.env` reads stay denied, including `-f` and `--rawfile`. |
| `.agro/evals/probes/docker-inspect-env-guard.sh` | existing | No regression in the container-inspect guard. |
| `.agro/evals/probes/operator-config-guard.sh` | existing | No regression in the operator-path guard. |
| `bash .claude/skills/eval/run.sh` | all probes | No new red beyond `next-dev-prod` and `skills-vendored`. |

Each story adds its probe assertions first and records the probe exit 1 against the unchanged hook. Then the story changes the hook.

## Design Principles

- Deny on doubt. A parse gap produces a false deny, never a false allow.
- One source of truth: `.agro/hooks/deny-env-dump.sh`.
- Change the smallest set of patterns that removes the two reported false positives.
- Add no explanatory comments to the hook (root `AGENTS.md`, non-negotiable 5).

## Out of Scope

- `yq` filters. `yq '.env' <file>` stays denied.
- Other `.env` substrings in command text, such as `grep process.env src/`. That command stays denied.
- The `git checkout -- <file>` guard.
- `.agro/hooks/deny-secret-paths.sh`.

## Open Questions

None.

Resolved: the advisor run found that `jq -n 'env'` and `jq -n '$ENV'` return `allow`. Both print the full process environment. The operator chose a separate issue: [#1150](https://github.com/mifunedev/agro/issues/1150). This task stays at the two reported false positives.

## Acceptance Criteria

- [ ] `git commit -m "record history of X"` is allowed, and `cat ~/.zsh_history` is denied.
- [ ] `jq '.env' .claude/settings.json` is allowed, and `cat .env` is denied.
- [ ] `bash .agro/evals/probes/docker-inspect-env-guard.sh` and `bash .agro/evals/probes/operator-config-guard.sh` exit 0.
- [ ] `bash .claude/skills/eval/run.sh` reports no red beyond `next-dev-prod` and `skills-vendored`.

## Lessons

| Lesson | Evidence | Outcome |
| --- | --- | --- |
| A narrower deny pattern can open a false allow. List what the old pattern denied before you accept the new pattern. | The first US-001 commit (`02e77b74`) allowed `builtin history`, `command history`, and `sudo history`. The old bare-word term denied all three. The repair (`6754162b`) restored the deny. | fixed in this PR |
| The advisor pushed after each accepted story. `/delegate` § Integration and `/git` § "Draft PR for a task" required that push. The operator requires two pushes: one for the draft PR and one before undraft. | The task branch received a push after the US-001 and US-002 acceptances. | fixed in this PR: US-003 |
| `spec-task-artifact-contract` fails every completed core-chain task, and CI does not catch the failure. | The probe exits 1 after the US-003 acceptance. The CI checkout has no `development` ref, so the probe exits `SKIPPED`. The #1148 `/eval` ran before its last acceptance. | issue #1153 |
| The Bash guard allows `jq -n 'env'`, `jq -n '$ENV'`, and `docker inspect --format 'json'`. | The advisor found the `jq` forms during grounding. The US-001 worker found the literal `["\x27]` class in the container-inspect term. The advisor confirmed each `allow` on the base hook and on this branch. | issue #1150 (#1152 merged into it) |
| One issue per finding fills the queue, and issues created mid-run skip operator review. | The advisor opened #1150, #1152, and #1153 during this run. #1150 and #1152 cover one guard surface. | fixed in this PR: US-004 |
| A crashing hook prints nothing, and empty output means `allow`. | The first US-002 draft crashed under `set -u` and allowed every command. `docker-inspect-env-guard.sh` failed on that draft. `basename` on a `--flag=.env` token failed the same way before this PR. | dropped: a deny assertion in a probe fails when the hook crashes, so each guard probe catches a crash. This PR fixes the `basename` case and adds a `path_cmd` fallback. |
| A run of the full probe suite finds failures that the targeted story checks miss. | The targeted US-002 checks passed. The full `/eval` run found the 384-character changelog bullet. | dropped: the `/delegate` Close step already requires the full suite; the Close step caught the failure. |
