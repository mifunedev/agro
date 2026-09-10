# Scope freeze — CLI-first release (US-001 / D1)

Recorded 2026-09-09T23:11:35Z by the /spec execute owner in
`/home/sandbox/harness/.worktrees/task/939-cli-first-release`.

## Ownership

- Sole implementation owner: this Pi session (`PI_SESSION_ID=01a0884f-353d-734c-ba38-36fb7486d652`, `PI_MODEL=grok-4.6`).
- Core worktree: `/home/sandbox/harness/.worktrees/task/939-cli-first-release` on `task/939-cli-first-release` at `3fbde75e58ea980bc307f00293398a903e773b40`, clean, tracking `origin/task/939-cli-first-release`. Branch is not checked out elsewhere.
- Root checkout `/home/sandbox/harness` stays on `development` and is not an implementation workspace.
- Paused work preserved: `/home/sandbox/harness/.worktrees/task/installer-dual-layout` (`task/1028-installer-dual-layout` at `75b593ea`, dirty local installer tests). No reuse. No second writer.
- Unaccepted drafts preserved, not imported: agro #1029 (`task/prep-d5-dispatch`), agro-web #53 (`task/pages-dispatch-contract`).

## Revalidated refs

| Input | Recorded | Current | Disposition |
|---|---|---|---|
| Agro accepted source | `75b593eabc376b6a0b55575086fa91d55344ddf9` | `origin/development` = `8ec63d2d` | Catch up. Drift is one commit: `skill: clarify Herdr monitor supervision guidance` on `.agro/skills/fanout/SKILL.md`. Not material to operator intent. |
| Planning PR head | `3fbde75e58ea980bc307f00293398a903e773b40` | matches worktree HEAD | Active planning artifacts. Planning-PR green CI is not implementation evidence. |
| Agro-web accepted source | `956bb1d723100b5779b02d617620fb9cf7193090` | `origin/main` matches | Active. Local `projects/mifunedev/openharness-web` `main` is `bd9f104` (behind 11) and is not the implementation checkout. |
| Released Agro | `823aabbd7324e08e3b685af6b0a5ef5c3467a15f`, `0.9.0` | commit exists | Post-publication / S6. Do not treat as candidate identity. |
| Issue #939 S1–S6 | current DoD | OPEN | This task covers source + candidate PR evidence only. S1/S2 live inventory, S5 version selection, S6 published-artifact checks remain out of scope. |
| #945 #944 #1019 | related | OPEN | Parked. Do not restore Phase 4/5 or advisory-boot gates. |
| Docker socket here | absent | `/var/run/docker.sock` missing | Use existing disposable Docker CI. No host repair. |

## Finding dispositions

| Finding | Disposition | Stories |
|---|---|---|
| Top-level `agro` help still describes `update` as control-plane vendoring (`cli.ts` `printOhHelp`). Command-specific agro help is already self-upgrade. Fresh image fallback is still `ghcr.io/mifunedev/openharness:latest` in `DEFAULT_SANDBOX_IMAGE` and image-only Compose. | active | US-002, US-004 |
| Core onboarding docs already describe npm/`get-agro.sh` then `agro sandbox install docker`. Review for remaining required-path clone/`install.sh`/`config repo` language and STE. | active (review + residual edits only) | US-003 |
| Agro-web installation/quickstart still present clone, `install.sh`, and `config repo` as onboarding. | active | US-009 |
| Workflows still auto-publish, wait, and deprecate `@mifune/openharness`. `/git` and `/release` still describe that contract. | active | US-005, US-006 |
| Docs builder can pass a SHA into branch-clone logic. | active | US-007, US-008 |
| `get-agro.test.ts` installs `FAKE_ARTIFACT` version-printing stub. | active | US-010 |
| Fresh seeding and persisted-file metadata need candidate-smoke assertions. | active | US-010, US-011 |
| Candidate runtime evidence on existing Docker CI. | active | US-012 |
| Complete implementation PRs, not planning-only #1031. | active | US-013 |
| GHCR alias promotion | retained | US-005 |
| Published legacy npm packages and shim source | retained | US-005, US-006 |
| Automatic legacy npm publication | ended (approved) | US-005 |
| 90-day / three-release compatibility window | withdrawn | do not restore |
| Phase 4/5, Cloud, orchestra, live migration, publication, merge | deferred / separate authority | US-013, S1–S6 |
| Digest-pinned legacy image proposal in #1029 | optional / unaccepted draft | do not import |
| Pages dispatch contract in agro-web #53 | optional / unaccepted draft | do not import |
| Paused installer-dual-layout work | paused | do not import or overwrite |
| Advertised URL / published-byte provenance | post-publication S6 | not candidate evidence |

## Approved npm / GHCR policy

- Normal release path: no legacy npm publish, wait, or deprecate.
- No replacement toggle or new publication workflow.
- Retain shim source and already-published versions.
- Retain GHCR alias promotion and checks.
- Keep automatic docs notification after finalization.
- Do not hide canonical failures with `continue-on-error`.

## Native worker capability (recorded before dispatch)

- Provider: Pi (`PI_CODING_AGENT=true`), session model `xai/grok-4.6`, session reasoning `medium`.
- Agent tool exposes `model` and `thinking` (`off|minimal|low|medium|high|xhigh`). No Sonnet. No per-worker effort frontmatter at this dispatch surface.
- Requested for T2/T4: model inherit, thinking high.
- Observed until worker self-report: model inherit session `grok-4.6`; thinking requested `high`; effort inherited session level, unobserved.
- Recursion: workers stay flat (`Max depth: 1`).

## Conflicts

None that change operator intent. Catch-up of `8ec63d2d` is a constraint, not a scope change.
