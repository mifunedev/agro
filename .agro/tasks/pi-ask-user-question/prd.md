# PRD: Pi ask-user-question support

Status: DRAFT

## User Stories

### US-001: Probe the published package

**Description:** As an advisor, I want package compatibility evidence so that the integration uses a verified release.

**Acceptance Criteria:**

- [ ] Install Pi and `@juicesharp/rpiv-ask-user-question@2.15.0` in a fresh temporary directory inside the sandbox without model calls.
- [ ] Record the Pi version, package version, extension load result, and runtime checks in `evidence/probe.md`.
- [ ] Verify tool registration, a structured answer, cancellation, and non-interactive tool removal through the real package entry point.
- [ ] Remove temporary resources and leave the running advisor session unchanged.

### US-002: Declare and document the default package

**Description:** As an operator, I want structured questions in Pi so that the agent can request decisions instead of guessing.

**Acceptance Criteria:**

- [ ] Add a failing settings regression before the configuration change.
- [ ] Pin `npm:@juicesharp/rpiv-ask-user-question@2.15.0` exactly once in `.pi/settings.json` and its expected package list.
- [ ] Preserve existing package pins, model defaults, extensions, and skill discovery.
- [ ] Document project trust, package installation, fresh-session activation, terminal questions, cancellation, RPC fallback, and headless behavior in `docs/harnesses/pi.md`.
- [ ] State that project Pi settings do not ship through `agro vendor`.
- [ ] Add an issue-linked entry under `CHANGELOG.md` Unreleased.
- [ ] Run `pnpm exec vitest run .pi/extensions/__tests__/settings.test.ts` and the provider-link check successfully.

### US-003: Record manual integration evidence

**Description:** As a reviewer, I want reproducible evidence so that I can verify package discovery without spending model tokens.

**Acceptance Criteria:**

- [ ] Record user-entry-point installation and package-list commands in `evidence/manual-review.md` from a fresh temporary project path.
- [ ] Record fresh Pi runtime checks for package loading, structured answers, cancellation, and no-UI behavior.
- [ ] Record a failure command, its observed output, and its exit status.
- [ ] Run commands inside the sandbox with environment values inline, without env files or persistent services.
- [ ] Delete each temporary resource and preserve operator settings.

## Summary

AGRO declares default Pi packages in `.pi/settings.json`.
The settings regression pins the ordered package list.
The requested package publishes an `index.ts` Pi extension and needs no API key.
Version `2.15.0` registers `ask_user_question` and removes it when the host has no UI.
Its RPC path uses native select and input dialogs.
Use the existing package mechanism instead of adding a wrapper or a second question tool.
The operator requested planning and delegation through a PR.
The PR remains unmerged.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.pi/settings.json` | `packages` | Project package registry. |
| `.pi/extensions/__tests__/settings.test.ts` | `readPiSettings`, expected package list | Default-package regression. |
| `docs/harnesses/pi.md` | Default packages, Reconcile package updates | Operator setup and activation. |
| `.agro/manifest.json` | `rootInclude` | Confirms project settings are not vendored. No change required. |
| `CHANGELOG.md` | Unreleased, Added | User-facing change record. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Host and sandbox | Applied | The advisor manages git on the host. Workers run installation and verification through `agro run`. |
| Lifecycle door | Not applicable | No `agro` verb changes. |
| Canonical and provider surfaces | Applied | `.pi/settings.json` owns Pi-specific package declarations. Shared `.agro/` primitives remain unchanged. |
| Root and scaffold | Applied | Change this harness checkout only. Do not expand the vendor payload. |
| Interactive and headless processes | Applied | Reuse upstream terminal and RPC behavior. Verify no-UI tool removal. |
| Local and remote operation | Applied | Package declarations persist across sessions without an attached background process. |
| Parallel operation | Applied | Run sequential workers in one isolated task worktree. Preserve the dirty main checkout. |
| Public documentation | Applied | Update the Pi guide and changelog. |
| Verification | Applied | Run settings regression, provider-link check, full tests, typecheck, lint, and build. |

## Storage

The package pin persists in `.pi/settings.json`.
Pi manages installed package data in its own agent directory.
Do not commit installed dependencies or create question-state storage.

## Architectural Decisions

Classification: NOT-ARCHITECTURAL.
This change adds one package to an existing registry.
It changes no ownership boundary, lifecycle, shared API, or vendor contract.
Pin the reviewed npm release instead of copying third-party source.
US-002 depends on US-001. US-003 depends on US-002.
The package provides its own usage guidance. Do not add shared prompt policy.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.pi/extensions/__tests__/settings.test.ts` | Exact package list and existing defaults | The declared package is present without unrelated changes. |
| `.agro/tasks/pi-ask-user-question/evidence/probe.md` | Real package registration, answer, cancel, no UI | Compatibility before declaration. |
| `.agro/tasks/pi-ask-user-question/evidence/manual-review.md` | Fresh installation, listing, runtime checks, failure | Reproducible integration evidence. |
| `.agro/scripts/link-providers.sh` | `--check` | Provider links still resolve. |

Run host acceptance commands through `agro run --`.
Use `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` for final verification.
No root formatter or separate production lint exists beyond the declared scripts.

## Design Principles

Use one package declaration and one upstream tool.
Keep exact pins and existing defaults.
Do not add explanatory comments to code.
Preserve operator-local changes and running sessions.
Use no more than five workers per wave, below the operator limit of ten.

## Out of Scope

No Slack answer bridge, custom terminal UI, browser UI, or shared skill changes.
No global installation in the active advisor home.
No vendor payload expansion or default-package rollout to initialized projects.
No live model calls, new services, release, or merge.
Browser evidence does not apply because AGRO changes package configuration, not UI implementation.

## Open Questions

None.

## Acceptance Criteria

- [ ] The trusted project declares exactly one pinned ask-user-question package.
- [ ] The real package returns structured answers and cancellation, and removes its tool without UI.
- [ ] Existing Pi defaults and package pins remain unchanged.
- [ ] Documentation and manual evidence describe setup and runtime limitations.
- [ ] Repository checks and PR CI pass before the PR leaves draft.
- [ ] Operator-local `agro.json` changes remain outside the PR.

## Lessons

None.
