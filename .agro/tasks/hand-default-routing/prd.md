# PRD: Default application runs to a running hand, else local Docker

Status: DRAFT

## User Stories

### US-001: Probe the runtimes on the brain and the hand

**Description:** As the advisor, I want a recorded runtime inventory of the brain and the hand so that the routing stories build on measured capabilities.

**Acceptance Criteria:**

- [ ] `.agro/tasks/hand-default-routing/evidence/probe.md` records, for `agro-supervisor` and for `agro-sbx-dev-001`: `systemctl is-active docker`, `docker info --format '{{.ServerVersion}}'` or its error, `ls -l /dev/kvm`, `msb --version`, group membership (`id -nG`), and `agro run --help` lines 1 to 4.
- [ ] The probe records `agro hands list --json` on the brain and the set of `status` values that it shows.
- [ ] The probe records `agro run --isolation microvm -- true` on the brain and on the hand, with each exit status. The probe records a refusal or a failure as the result and does not retry with weaker isolation.
- [ ] The probe changes no service, VM, or file outside the evidence folder. The microVM smoke run creates no persistent guest.

### US-002: Start Docker on the brain

**Description:** As an operator, I want the Docker engine enabled on `agro-supervisor` so that the local fallback `agro run` works when no hand is running.

**Acceptance Criteria:**

- [ ] `sudo systemctl enable --now docker` exits 0 on the brain, and `systemctl is-active docker` prints `active`.
- [ ] `docker info --format '{{.ServerVersion}}'` exits 0 as user `exedev` without `sudo`.
- [ ] From the harness root, `agro run -- true` exits 0, and `agro run -- sh -c 'id -u'` prints the uid of `exedev`.
- [ ] After a reboot-equivalent check, `systemctl is-enabled docker` prints `enabled`.

### US-003: Route application runs to a running hand, else local Docker

**Description:** As an agent, I want the sandbox skill to default application runs of committed work to a running hand, and otherwise to local Docker. Then heavy work leaves the brain, and the raw host never runs application work.

**Acceptance Criteria:**

- [ ] `.agro/skills/sandbox/SKILL.md` § Select a route states the default in this order. First, an explicit location in the request wins. Second, a hand with status `running` in `agro hands list` takes application runs of committed work through `agro hands exec <hand> --project <owner>/<repo> -- agro run -- <command>`. Third, the route is `local/docker` with `agro run -- <command>`.
- [ ] The skill states that a hand with status `paused`, `stopped`, or `creating` does not count as a running hand. The skill also states that the default never resumes or creates a hand.
- [ ] The skill states that a failed `agro hands exec` stops and reports the error. The agent then offers `local/docker` and switches only after the operator agrees.
- [ ] The skill states that a missing Docker engine on the local route stops and reports, with no fallback to the raw host.
- [ ] The skill states that an inner loop on uncommitted edits stays on `local/docker`.
- [ ] The skill states that one agent at a time uses a project on a hand. Parallel agents on the same project use separate hands, because `agro hands` has no worktree support on a hand.
- [ ] `.agro/skills/sandbox/references/hands.md` § Choose when replaces "Keep short, light work on the brain." with the running-hand default. The section keeps the authority rule for billable create.
- [ ] `.agro/scripts/__tests__/fixtures/sandbox-routing/cases.json` adds four cases. R12 to R14 use the request "Run the test suite for mifunedev/widget." R12 has a running hand and expects route `hands` with owners `agro-hands` and `agro-run`. R13 has only a paused hand and expects `local/docker` with owner `agro-run`. R14 has no hand and expects `local/docker` with owner `agro-run`. R15 has a running hand and the request "Run the test suite for mifunedev/widget on this host.", and expects `local/docker` with owner `agro-run`.
- [ ] `helpers/sandbox-routing.ts` `caseIds` covers R1 to R15. `sandbox-routing.test.ts` expects R1 to R15 and uses R16 as the unknown case.
- [ ] `sandbox-skill.test.ts` asserts the running-hand default, the paused rule, the explicit-location override, the one-agent-per-project rule, and the no-raw-host rule in `SKILL.md` and `hands.md`.
- [ ] `decisions.json` holds 15 fresh decision-only records that the advisor collects against the final instruction files. Each record matches its oracle. The worker writes the file with provenance from `sourceProvenance()`.
- [ ] `docs/lifecycle-commands.md` § Hands from a brain states the default in one bullet.
- [ ] `CHANGELOG.md` `## [Unreleased]` names the routing default under Changed, with a link to the task issue.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/sandbox/references/hands.md` exits 0, and `SKILL.md` gains no new finding.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0, `corepack pnpm typecheck` exits 0, and `corepack pnpm test:scripts` passes except the known baseline failures.

### US-004: Record a live review through the routing tree

**Description:** As the operator, I want one transcript of a real committed run on the running hand and on local Docker with the hand paused. Then the PR shows both branches of the default.

**Acceptance Criteria:**

- [ ] Before any write, a read-only `agro hands list --json` shows `agro-sbx-dev-001` with status `running`. If the check fails, the story sets `blocked`. The story then runs no other command.
- [ ] `.agro/tasks/hand-default-routing/evidence/manual-review.md` records `agro hands exec agro-sbx-dev-001 --project ryaneggz/microsandbox-ubuntu-dind -- agro run -- sh -c 'for f in *.sh; do bash -n "$f" || exit 1; done'` with exit 0.
- [ ] The transcript records `agro hands pause agro-sbx-dev-001`. Next, the transcript records `agro hands list --json` with status `paused`. The transcript then records the same check through `agro run` in the brain project with exit 0. Last, the transcript records `agro hands resume agro-sbx-dev-001` with status `running`.
- [ ] The transcript records `agro hands exec no-such-vm -- true` with exit 1 and `no exe.dev VM named no-such-vm`, as the failure path.
- [ ] The transcript shows that the console tunnel `agro-console-tunnel` reconnects after the resume. `agro auth status` prints `login: dev`.
- [ ] The run creates, forks, and destroys no VM. A pause of `agro-sbx-dev-001` needs operator approval of this plan. `external`
- [ ] At the end, `ssh exe.dev ls --json` lists the same VMs, status, and tags as at the start.

## Summary

The operator set a routing policy for application work. When a hand is running, application runs of committed work default to the hand. When no hand is running, the work runs in Docker on the same host. The raw host never runs application work.

Verified facts on 2026-11-14 at `8850da14` (v0.37.0):

- `.agro/skills/sandbox/SKILL.md` § Select a route chooses the route from the intent of the request and has no hand default.
- `.agro/skills/sandbox/references/hands.md` line 18 says "Keep short, light work on the brain."
- `helpers/sandbox-routing.ts` fixes `caseIds` to R1 to R11; `sandbox-routing.test.ts` expects R1 to R11 and uses R12 as the unknown case.
- The brain has `/bin/docker`, `/bin/dockerd`, and `/bin/containerd`. `systemctl is-enabled docker` prints `disabled`, and `systemctl is-active docker` prints `inactive`. User `exedev` is in the groups `docker` and `kvm`, and `sudo -n true` succeeds.
- The brain has `/dev/kvm` and `msb 0.7.13`. The hand has `/dev/kvm`, `msb`, Docker 29.1.3, and the same groups.
- `agro hands list --json` on the brain prints `[{"name":"agro-sbx-dev-001","status":"running","sshHost":"agro-sbx-dev-001.exe.xyz"}]`.
- `.agro/skills/delegate/SKILL.md` § Dispatch record runs verification as `agro run -- <command>` on the host. This task keeps that rule (option B).

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/sandbox/SKILL.md` | § Select a route | route default |
| `.agro/skills/sandbox/references/hands.md` | § Choose when | running-hand default, paused rule |
| `.agro/scripts/__tests__/helpers/sandbox-routing.ts` | `caseIds`, `instructionFiles` | case set and provenance |
| `.agro/scripts/__tests__/fixtures/sandbox-routing/cases.json` | R12 to R15 | new routing cases |
| `.agro/scripts/__tests__/fixtures/sandbox-routing/decisions.json` | decision records | fresh observed evidence |
| `.agro/scripts/__tests__/sandbox-routing.test.ts` | case count, unknown case | grader tests |
| `.agro/scripts/__tests__/sandbox-skill.test.ts` | skill assertions | default wording |
| `docs/lifecycle-commands.md` | § Hands from a brain | public statement of the default |
| `CHANGELOG.md` | `## [Unreleased]` | change record |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `sandbox` skill routing | changed | A running hand takes application runs of committed work; otherwise `local/docker`. |
| brain host service | changed | US-002 enables the Docker engine on `agro-supervisor`. |
| `agro` CLI | none | No CLI change; the default lives in the skill. |

## Storage

N/A. The task changes skill text, test fixtures, and one host service. It adds no persistent state.

## Architectural Decisions

- The skill owns the routing default. The CLI stays unchanged, so the default needs no release.
- Only status `running` selects a hand. A default never resumes, creates, or forks a hand.
- An explicit location in the request overrides the default.
- The raw host never runs application work. A missing runtime stops and reports.
- `/delegate` verification and acceptance stay on the local host (option B), because acceptance runs on the integrated branch in the main checkout.
- One agent at a time uses a project on a hand; parallel agents use separate hands, to keep non-negotiable 4 without new CLI machinery.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/sandbox-skill.test.ts` | default wording, paused rule, override, one-agent-per-project, no-raw-host rule | skill text |
| `.agro/scripts/__tests__/sandbox-routing.test.ts` | R1 to R15 set, unknown R16, observed replay | routing evidence |
| `.agro/tasks/hand-default-routing/evidence/manual-review.md` | hand run, paused fallback, failure path | live behavior |

## Design Principles

- Apply the root `AGENTS.md` rules: one source of truth, no explanatory comments in tracked code, smallest truthful model.
- Fail closed: an unavailable hand or a missing runtime stops and reports.
- Failure-environment criteria: US-004 covers an unknown VM and a paused hand. A fresh `known_hosts`, a container hostname, a malformed configuration file, and a `--json` caller do not apply, because the task changes no CLI code.

## Out of Scope

- Any change to the `agro` CLI or a release.
- `/delegate` routing changes (option A).
- The mifuntu base image (Phase C).
- Automatic resume or creation of hands.
- Worktree support for projects on a hand.

## Open Questions

None.

## Acceptance Criteria

- [ ] Each story in `prd.json` has `passes: true`.
- [ ] `agro run -- true` exits 0 on the brain.
- [ ] `corepack pnpm test:scripts` passes except the known baseline failures, and CI is green.
- [ ] The routing replay records 15 fresh decisions that match their oracles.
- [ ] `agro run --isolation microvm -- true` has a recorded exit status on the brain and on the hand.

## Lessons

1. Claim: `standard-skills-link.test.ts` times out inside `agro run` on this brain. Evidence: 4 cases fail with "Test timed out in 5000ms" on `origin/development` at `8850da14` under `agro run`, the same as on this branch (`evidence/baseline.md`). Outcome: dropped. The failure predates this PR, comes from container speed on the brain, and CI passes the file.
2. Claim: the console sign-in fails for about 30 seconds after a hand resume. Evidence: US-004 transcript; `agro auth status` printed `request failed: fetch failed` until the tunnel reconnected. Outcome: dropped. The reconnect loop restores the tunnel within the 60-second limit by design.
3. Claim: microVM isolation works on the brain and on the hand. Evidence: US-001 probe; `agro run --isolation microvm -- true` exits 0 on both hosts. Outcome: dropped. The finding is a capability fact, not a defect.
4. Claim: the code review found nine real defects in the first routing default. Evidence: `/code-review 1634` reported ten candidates. The default did not push before a hand run, and did not say which hand. The default also overrode isolation needs, ignored a failed `agro hands list`, and kept the uncommitted-edits rule outside the ordered steps. The docs read as CLI behavior, risky cases had no oracle, the status list duplicated the positive rule, and the prose test was brittle. Outcome: fixed in this PR (`b1d9ae66`).
5. Claim: a passing routing grade can hide a wrong command. Evidence: after `b1d9ae66`, R12 matched its route and owners but pushed to `origin`. The grader checks only route and owners. Outcome: fixed in this PR (`27d9869b` names `hand-<hand>` as the push target).
6. Claim: plan criteria that state routing rules need cases that exercise each rule. Evidence: the review found the override and the isolation gaps that the original R12 to R15 did not cover. Outcome: dropped. The observation is about process, and the PR retro records it.
