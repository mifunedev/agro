# PRD: agro hands commands

Status: DRAFT

## User Stories

### US-001: Brain console client

**Description:** As an agent on a brain, I want `agro hands` to call the console API with the brain token. Then I manage hands without curl and without seeing the token.

**Acceptance Criteria:**

- [ ] A shared console client in `.agro/cli/src/lib/` serves both `agro node` and `agro hands`. `agro node` keeps its behaviour, and its tests pass unchanged.
- [ ] `agro hands` reads the token from `/home/sandbox/.agro/brain-token` and the console URL from `/home/sandbox/.agro/brain-console-url`. `AGRO_CONSOLE_TOKEN` and `AGRO_CONSOLE_URL` override both, as in `agro node`.
- [ ] When the token file is missing, `agro hands` exits 2 with "not on a brain: /home/sandbox/.agro/brain-token not found" and sends no request.
- [ ] No output, error message, or log line holds the token. A test feeds a known token and checks every captured output for it.
- [ ] `agro hands list [--json]` prints the hands from `GET /api/nodes`: index, alias, status, spec, and SSH host.
- [ ] `agro hands create [--name <name>] [--spec <spec>]` sends `POST /api/nodes` with `profile: "sandbox"`, waits until the hand runs, and prints its index, alias, and SSH host.
- [ ] `agro hands fork|pause|resume <hand>` and `agro hands destroy <hand> [--yes]` call the matching route. `<hand>` accepts `#<index>`, `<index>`, an alias, or a uuid.
- [ ] A 403 prints the console error code (`BRAIN_TOKEN_FORBIDDEN` or `BRAIN_TOKEN_TARGET_FORBIDDEN`) and exits 1 with no retry.
- [ ] `npm --prefix .agro/cli run typecheck` and `pnpm test:scripts` exit 0.

### US-002: Projects on hands over SSH

**Description:** As an agent on a brain, I want to move a project to a hand, run commands there, and fetch the result. Then a hand does the heavy work and the brain keeps the history.

**Acceptance Criteria:**

- [ ] `agro hands create --project <owner>/<repo>` prepares `~/projects/<owner>/<repo>` on the hand with `git init` and `receive.denyCurrentBranch updateInstead`. The command adds the remote `hand-<index>` to the brain project at `~/.agro/workspaces/harness/projects/<owner>/<repo>` and pushes the current branch.
- [ ] `agro hands create --clone <owner>/<repo>` runs `git clone` on the hand into `~/projects/<owner>/<repo>` with the hand's own git credential. The brain pushes nothing.
- [ ] `agro hands exec <hand> [--project <owner>/<repo>] -- <command>` runs the command over SSH. With `--project`, the command runs in the project folder. `agro hands exec` exits with the exit status of the command.
- [ ] `agro hands fetch <hand> --project <owner>/<repo>` runs `git fetch hand-<index>` in the brain project.
- [ ] Every SSH call uses `sandbox@<sshHost>` from the console and the default brain key, with no `-i` flag.
- [ ] Tests run each command against a fake SSH runner and a temporary git repository. The tests pin the remote name, the paths, and the exit status.
- [ ] `npm --prefix .agro/cli run typecheck` and `pnpm test:scripts` exit 0.

### US-003: Hands skill and docs

**Description:** As an agent on a brain, I want a short skill that tells me when and how to use hands. Then I choose hands for the right work and clean up after myself.

**Acceptance Criteria:**

- [ ] `.agro/skills/hands/SKILL.md` covers when to use a hand and the create, exec, fetch, and destroy flow. The skill tells the agent to destroy or pause hands to save cost, never to read the token, and to stop on a 403. The skill warns that a fork copies credentials and points to `agro hands --help` for flags.
- [ ] The skill states that an agent install on a brain needs `agro harness install <name> --host`.
- [ ] The provider link check passes for the new skill (`bash .agro/scripts/link-providers.sh` in check mode).
- [ ] `command-table.ts` lists the `hands` verbs, and `docs/lifecycle-commands.md` documents them. The docs reference test passes.
- [ ] `CHANGELOG.md` `## [Unreleased]` names `agro hands` and the hands skill.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/hands/SKILL.md` reports no findings.

### US-004: Manual review on a live brain

**Description:** As the operator, I want one transcript of `agro hands` on a live brain. Then the PR shows the commands working end to end.

**Acceptance Criteria:**

- [ ] Before any live resource, a read-only `agro hands list` on the brain succeeds. If it fails, the story sets `blocked` and creates nothing.
- [ ] `evidence/manual-review.md` records a run of the built CLI on one live brain. The run covers `agro hands create --project <owner>/<repo>`, `agro hands list`, and `agro hands exec <hand> --project <owner>/<repo> -- git log --oneline`. The run then makes a commit on the hand and covers `agro hands fetch`, `agro hands fork`, and `agro hands destroy` for the hand and the fork.
- [ ] The transcript shows `agro hands exec` on a brain node refused with `BRAIN_TOKEN_TARGET_FORBIDDEN`.
- [ ] The advisor deletes each node, SSH key, and token of the round. The provider list at the end matches the list before the round.

## Summary

The agro-console side is complete on `task/684-sandbox-only-spike` (mifunedev/agro-console#740, ADR mifunedev/agro-console#738).

Verified facts:

- A brain holds a console token at `/home/sandbox/.agro/brain-token` with mode 0600.
- The token allows only `POST /api/nodes`, `GET /api/nodes`, `GET` and `DELETE /api/nodes/<ref>`, and `POST /api/nodes/<ref>/fork|pause|resume`. `<ref>` is a uuid, an index, or an alias in the brain organization. A create forces `profile: "sandbox"` and adds the brain SSH key.
- Each brain owns `~/.ssh/id_ed25519`, and its hands trust the key, so plain `ssh sandbox@<sshHost>` works from the brain.
- `.agro/cli/src/commands/node.ts` already calls the console API (`resolveConsoleConfig`, `callApi`, readiness polling, `AGRO_CONSOLE_TOKEN` and `AGRO_CONSOLE_URL`). US-001 moves that client into `.agro/cli/src/lib/` and reuses it.
- Nothing on a brain records the console URL today. The claim script holds it in `controlPlaneUrl` only (agro-console `packages/shared/src/cloud-init-base.ts`).

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/commands/node.ts` | `resolveConsoleConfig`, `callApi`, `nodePollDelayMs`, `toNode` | console client to share |
| `.agro/cli/src/commands/hands.ts` (new) | `runHands`, `handsHelp` | the `agro hands` verbs |
| `.agro/cli/src/lib/console-api.ts` (new) | the shared client | API calls, polling, error codes |
| `.agro/cli/src/command-table.ts` | `AGRO_COMMANDS`, a new `HANDS_VERBS` | verb registry |
| `.agro/cli/src/cli.ts` | top-level help, dispatch | wiring |
| `docs/lifecycle-commands.md` | command table | user docs |
| `.agro/skills/hands/SKILL.md` (new) | skill | agent guidance |
| `CHANGELOG.md` | `## [Unreleased]` | release notes |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `agro hands` | new command | list, create, fork, pause, resume, destroy, exec, fetch |
| Console API | consumer | the brain token routes of agro-console #740 |
| `/home/sandbox/.agro/brain-console-url` | new input | written by the agro-console brain claim |

## Storage

N/A. `agro hands` keeps no state. The console lists the hands, and git remotes in the brain project name each hand.

## Architectural Decisions

- `agro hands` is a thin client of the console API. The console is the source of truth for hands.
- The token never leaves the token file except as a bearer header on the request.
- SSH uses the default brain key and the `sshHost` from the console.
- A hand remote is `hand-<index>`, because an index is never reused.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/commands/__tests__/hands.test.ts` | each verb with a fake fetch; missing token file; 403 codes; the token never in output | US-001 |
| `.agro/cli/src/commands/__tests__/hands-project.test.ts` | create --project and --clone, exec exit status, fetch, against a fake SSH runner and a temp git repo | US-002 |
| `.agro/cli/src/commands/__tests__/node*.test.ts` | unchanged `agro node` behaviour after the shared client | US-001 |
| `.agro/cli/src/__tests__/docs-reference.test.ts` | the hands verbs in the docs | US-003 |

## Design Principles

- Follow the harness `AGENTS.md`. Change canonical `.agro/` sources only, and add no comments to tracked code.
- Reuse the `agro node` client. Do not build a second one.
- Keep the skill short. The CLI help stays the one source for flags.

## Out of Scope

- The agro-console pin bump of the agro CLI (`config.yaml` `platform.apps` agro, now 0.33.0). That bump follows the release.
- Console-side changes apart from the brain console URL file.
- The Tailscale conflict fix in `.agro/cli/src/lib/tools/catalog.ts` (a separate follow-up issue).
- Updating `agro node --profile agro` and its app flags to the console role model.

## Open Questions

None. The operator approved these decisions on 2026-11-11:

1. Console URL on a brain: the agro-console brain claim writes the URL to `/home/sandbox/.agro/brain-console-url` (mode 0600), next to the token. That change lands on agro-console `task/684-sandbox-only-spike` as its own story. `agro hands` reads the file, and `AGRO_CONSOLE_URL` overrides it.
2. The Tailscale conflict between `agro tool setup t3-mobile enable` and the desktop tool is a separate follow-up issue, outside this plan.
3. Live budget for US-004: about 0.3 instance-hour on the local agro-console stack, with at most 2 nodes and 1 pool VM. The built `agro.js` runs on the brain, so the round needs no release and no new image.
4. `agro node --profile agro` with its app flags gets a follow-up after this task, with `--role brain|hands` and `--tools`.

## Acceptance Criteria

- [ ] `npm --prefix .agro/cli run typecheck`, `pnpm test:scripts`, and `pnpm run build:harness` exit 0.
- [ ] CI on the task PR passes.
- [ ] US-004 shows `agro hands` driving a hand end to end from a live brain.
- [ ] No node, SSH key, or token that the task created remains.

## Lessons

1. **`agro hands fork` sent no body.** Claim: the console fork route requires `spec`, so the first live fork returned HTTP 400. Evidence: `evidence/manual-review.md` round 1. Outcome: fixed in this PR (`108b5f9db`).
2. **A brain-token fork had no SSH key and no fork id.** Claim: the console added the brain key on create only. The fork response named the source node. Evidence: round 1, fork #366. Outcome: fixed in mifunedev/agro-console#746 (issue mifunedev/agro-console#745), merged into `task/684-sandbox-only-spike`.
3. **The fork id exists before the fork node.** Claim: mifunedev/agro-console#746 reserves `forkId`, so a lookup returns 404 until the disk copy ends. Evidence: the #746 report. Outcome: fixed in this PR (`0ae524d73`); only the fork wait treats 404 as pending.
4. **An unquoted `#<index>` starts a shell comment.** Claim: `agro hands exec #7 -- ls` passes no hand. Evidence: US-003 report. Outcome: fixed in this PR (`67c346162`); the help, skill, and docs lead with the bare index.
5. **A brain had no console URL.** Claim: the URL existed only inside the claim script. Evidence: grounding of US-001. Outcome: fixed in mifunedev/agro-console#744 (issue mifunedev/agro-console#743), merged; round 2 read the file with no override.
6. **The first live round passed its budget.** Claim: pool resets started refills, so round 1 used 0.42 instance-hour against 0.3. Evidence: `evidence/cleanup.md`. Outcome: dropped, a process observation. Round 2 held the pool at 0 and used 0.26.
7. **`agro node` still sends the retired app flags.** Claim: `agro node create --profile agro --t3 --code-server` sends fields that the console role model ignores. Evidence: grounding of US-001. Outcome: dropped for this PR. The operator approved a follow-up after this task.
