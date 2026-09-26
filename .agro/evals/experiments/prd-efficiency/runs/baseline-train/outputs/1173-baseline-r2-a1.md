# PRD: README Discussions link

Status: DRAFT

## User Stories

### US-001: Link GitHub Discussions from the README

**Description:** As an AGRO user, I want a GitHub Discussions link in the README so that I have a public place for questions and setups.

**Acceptance Criteria:**

- [ ] In `README.md`, the line under `## 🤝 Contributing & community` that holds `[GitHub issues](https://github.com/mifunedev/agro/issues)` also holds a link to `https://github.com/mifunedev/agro/discussions`.
- [ ] On that line, the Discussions link comes after the GitHub issues link and uses the same ` · ` separator.
- [ ] `grep -c 'https://github.com/mifunedev/agro/discussions' README.md` prints `1`.
- [ ] `CHANGELOG.md` has exactly one new bullet under `## [Unreleased]` for this change, and the bullet links issue `#1173`.
- [ ] `bash .agro/evals/probes/changelog-entry-length.sh` exits 0.
- [ ] `bash .agro/evals/probes/curl-bash-safe-alternatives.sh` exits 0.
- [ ] `bash .agro/evals/probes/docs-20260911.sh` exits 0.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build` each exit 0.

## Summary

The `mifunedev/agro` repository has GitHub Discussions on. The Discussions categories are Q&A, Show and tell, and Ideas. The README does not link to Discussions.

Verified current state:

- `README.md` line 341 reads `[Contributing guide](docs/contributing.md) · [GitHub issues](https://github.com/mifunedev/agro/issues)`.
- `README.md` holds no `discussions` URL.
- `CHANGELOG.md` has a `## [Unreleased]` section with the subsections `### Added`, `### Removed`, and `### Changed`.
- `package.json` defines `lint`, `typecheck`, `test`, and `build`. The `lint` script only prints `No root lint configured`.

Selected approach: append ` · [GitHub Discussions](https://github.com/mifunedev/agro/discussions)` to `README.md` line 341. Add one bullet under `## [Unreleased]` → `### Added` in `CHANGELOG.md`.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `README.md` | `## 🤝 Contributing & community`, line 341 | Holds the community links. The new link goes here. |
| `CHANGELOG.md` | `## [Unreleased]` → `### Added` | Records the user-facing change. |
| `.agro/evals/probes/changelog-entry-length.sh` | `CAP=250` | Limits each `[Unreleased]` bullet to 250 characters. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `README.md` community section | Added link | Adds `[GitHub Discussions](https://github.com/mifunedev/agro/discussions)` after the GitHub issues link. |
| `mifunedev/agro-web` | N/A | The issue scopes the change to `README.md`. See Open Questions. |

## Storage

N/A. The change edits Markdown only and stores no state.

## Architectural Decisions

- `README.md` stays the source of truth for the community links in this repository.
- The link text is `GitHub Discussions`. This text matches the existing `GitHub issues` label style.
- The change adds no badge. The badge row holds external channels: Slack, X, Instagram, and LinkedIn.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| N/A: shell check | `grep -n 'GitHub issues' README.md` shows the issues link and the Discussions link on one line, in that order | Link placement |
| `.agro/evals/probes/changelog-entry-length.sh` | Existing probe | The new bullet is at most 250 characters |
| `.agro/evals/probes/docs-20260911.sh` | Existing probe | `README.md` still passes the README sweep |
| `.agro/evals/probes/curl-bash-safe-alternatives.sh` | Existing probe | `README.md` still passes the install-command check |
| `vitest.config.ts` suite | `pnpm test` | No regression |

A new automated test adds no value for one static link. The shell check and the existing probes cover the change.

## Design Principles

- Make the smallest realistic change: one line in `README.md` and one bullet in `CHANGELOG.md`.
- Add no explanatory comments to tracked files.
- Write the changelog bullet as one sentence in STE style.

## Out of Scope

- Changes to `docs/contributing.md`, `CONTRIBUTING.md`, or issue templates.
- Discussion category setup or moderation on GitHub.
- Changes to `mifunedev/agro-web`.
- A new badge or a new probe.

## Open Questions

1. Does `mifunedev/agro-web` need a matching Discussions link? The issue does not ask for one. This plan excludes it.
2. The plan takes the issue number `1173` from the input filename `work/issue-1173.md`. The issue metadata block shows `[issue#]`. Before the advisor creates the branch `task/1173-readme-discussions-link`, the operator must confirm the GitHub issue number `1173`.

## Acceptance Criteria

- [ ] `README.md` section `## 🤝 Contributing & community` links `https://github.com/mifunedev/agro/discussions` after the GitHub issues link.
- [ ] `CHANGELOG.md` has one new entry under `## [Unreleased]` for this change.
- [ ] `pnpm run lint`, `pnpm run typecheck`, `pnpm test`, and `pnpm run build` each exit 0.
- [ ] After operator approval, a draft PR exists with the title `FROM task/1173-readme-discussions-link TO development`.

## Lessons

Filled by the advisor before undraft.
