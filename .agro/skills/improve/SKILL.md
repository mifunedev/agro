---
name: improve
description: |
  Find the single most meaningful next improvement to one repository through a
  five-lens council, and return one Council Brief. Default scope is the harness
  repository; pass a project under projects/ to scope the council to it.
  Advice only: the skill plans, delegates, merges, and releases nothing.
  TRIGGER when: /improve is invoked, or the operator asks for a consensus on the
  next or most meaningful improvement to the harness or a named project.
  Do NOT trigger for an audit verdict (/audit), a measured improvement loop
  (/rsi), a plan (/prd), or implementation.
argument-hint: "[projects/<owner>/<repo> | <owner>/<repo>]"
---

# Improve

Run one `/council` round with a fixed question and five fixed lenses, scoped to
one repository. `/council` owns dispatch, verification, the critic, outcomes,
and the brief. This skill owns only the scope, the question, and the lenses.

Arguments received: `$ARGUMENTS`

## 1. Resolve the scope

The harness root is the top level of the repository that holds this skill.

| Argument | Scope root |
|---|---|
| empty | the harness root |
| `projects/<owner>/<repo>` | that path under the harness root |
| `<owner>/<repo>` | `projects/<owner>/<repo>` under the harness root |
| any other value | invalid |

1. For invalid input, print `Usage: /improve [projects/<owner>/<repo> | <owner>/<repo>]` and stop.
2. Resolve the projects root with `bash .agro/scripts/agro-path projects --no-create`. If that command fails, use `projects/` under the harness root.
3. If the scope root is not a Git work tree, report `BLOCKED`. Name the remedy: clone the project with `/worktrees` § PROJECT CLONE. Do not clone it.
4. Record the node hostname, the scope root, its `origin` remote as `<owner>/<repo>`, and its current commit.
5. Read every `AGENTS.md` that applies to the scope root. For a project, also read `projects/AGENTS.md`.

## 2. Build the council brief

Pass this brief to `/council`. Replace each placeholder with the value from step 1.

- **Question:** What is the single most meaningful improvement to make to `<owner>/<repo>`, checked out at `<scope root>`?
- **Criteria:** (a) impact on the users and agents of the repository; (b) fit with the scope `AGENTS.md` rules; (c) evidence strength; (d) cost and reversibility.
- **Constraints:** Advice only. The improvement fits one bounded change, not a rewrite. Exclude new features with no evidence of demand.
- **Authorized sources:** the scope working tree, its Git history, and the public issues, pull requests, and Actions runs of `<owner>/<repo>` through `gh`. No session traces, no transcripts, and no secret values.
- **Budget:** five members, one proposal round, 500 words for each report, and at most one critic.
- **Member report:** Give the proposed improvement, other options, and no-change when viable. Cite evidence by `file:line`, issue, pull request, or commit. List counterevidence, assumptions, risks, unknowns, and a falsifier. Label each unmeasured claim as unmeasured.

## 3. Assign the five lenses

The operator selected five lenses for this skill. This selection replaces the
`/council` default of three. Give each member one lens. Dispatch the five members
in parallel, read-only.

| Lens | Scope of the search |
|---|---|
| Onboarding and lifecycle | The path from install to first useful result: README, docs, CLI or entry points, error messages, and drift between docs and behavior. |
| Reliability and verification | Recurring defect classes, fix and revert churn in history, CI workflows, test gaps, and release breakage. |
| Security and isolation | Trust boundaries, privilege, secret handling, network exposure, install paths, and guards. Describe a weakness by class, without exploit steps. |
| Agent and contributor context | `AGENTS.md` files, skills, hooks, conventions, and the context an agent must load. Contradictions, stale claims, and portability gaps. |
| Complexity and maintenance | Module size and churn, dormant or duplicate paths, accumulated state, and backlog themes. The deletion or consolidation that removes the most ongoing cost. |

If a lens has no useful scope in the repository, drop that lens and disclose the
reduced coverage. Follow `/council` § 2 when fewer than two lenses remain.

## 4. Return the brief

1. Follow `/council` § 4 and § 5. The five proposals rarely agree. Treat
   consensus as the advisor's verified judgment against the criteria, not a vote.
2. Verify each decisive claim against the scope root before acceptance.
3. If the recommendation claims a performance or cost gain, find a measurement of its falsifier in the authorized sources. The measurement must be at the current commit or newer than the last change to the measured path. If no such measurement exists, the outcome is `PARTIAL`.
4. Return one Council Brief with outcome `COMPLETE`, `PARTIAL`, or `BLOCKED`.
5. In **Next authorized step**, name `/prd` with the recommended change. Do not run `/prd`. For a `PARTIAL` outcome under step 3, name `/prd` with a task that measures the falsifier.

If the recommendation is a security weakness in a public repository, say that
`SECURITY.md` or the project's disclosure policy governs any issue or pull
request.

## Where to run

A hand node is an isolated development environment with its own checkout, for
example another AGRO sandbox or a remote VM. `/improve` runs on the local
harness or on a hand node.

- On a hand node, the scope resolves against the harness root of that node, not the operator's machine.
- The council reads only the scope root and public `gh` data. A hand node shares no mutable state with other nodes.
- Start the session on the hand node in Herdr, so that a terminal disconnect does not stop the council.
- Return the brief to the operator from the hand node. The brief names the node, the scope root, and the commit.

## Boundaries

- The skill writes no tracked file and changes no external state.
- Approval, `/prd`, `/delegate`, merge, and `/release` are outside this skill.
- A `/improve` brief is not approval to implement or publish.

## Examples

- `/improve` scopes the council to the harness root.
- `/improve mifunedev/agro-console` scopes the council to `projects/mifunedev/agro-console`.
- `/improve projects/acme/api` with no clone at that path reports `BLOCKED` and names `/worktrees` § PROJECT CLONE.
- `/improve ../other` prints the usage line and stops.
