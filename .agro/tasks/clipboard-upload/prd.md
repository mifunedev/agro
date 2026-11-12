# PRD: Clipboard image uploads

Status: DRAFT

Operator approved this plan with choices 1A and 2A on 2026-11-12.

## User Stories

### US-001: Probe the service execution path

**Description:** As an operator, I want a verified runtime path so that the upload service runs inside the intended boundary.

**Acceptance Criteria:**

- [ ] Record the sandbox marker, Node version, tmux availability, bundle entry point, and browser access route in `evidence/runtime-probe.md`.
- [ ] Before service startup, confirm port 3500 has no listener. For a busy port, report the listener PID; leave the listener running.
- [ ] Verify access from the operator-facing browser route to a temporary loopback listener inside the sandbox.
- [ ] Record the image-path visibility contract for agents in another worktree or execution target.
- [ ] Stop every probe process. Create no cloud resources and change no existing sandbox lifecycle.

### US-002: Persist ordered image and caption batches

**Description:** As a headless agent, I want image files paired with captions so that I can open each image in context.

**Acceptance Criteria:**

- [ ] Add a Node HTTP service with an authenticated upload endpoint and a health endpoint.
- [ ] Save each completed batch in a new private directory under the current user's AGRO home, scoped by canonical project path.
- [ ] Write a versioned JSON manifest with stable image IDs, order, absolute paths, MIME types, byte lengths, and captions.
- [ ] Generate filenames on the server. Never use client filenames as filesystem paths or shell input.
- [ ] Accept PNG, JPEG, and WebP only when MIME types match file signatures. Reject SVG and HTML.
- [ ] Enforce proposed limits of 10 images, 10 MiB per image, 50 MiB per request, and 2000 characters per caption.
- [ ] Reject unauthorized requests, foreign origins, malformed payloads, traversal attempts, and symlink destinations in automated tests.
- [ ] Publish a batch manifest only after all files complete. Remove incomplete files on failure and preserve existing batches.
- [ ] Return a copyable prompt that names the manifest and instructs an image-capable agent to open every image.
- [ ] Never commit uploads, dispatch agents, execute captions, or claim that a path alone provides visual model input.

### US-003: Add clipboard lifecycle commands

**Description:** As an operator, I want start and stop commands so that uploads remain available after terminal disconnect.

**Acceptance Criteria:**

- [ ] Add `agro clipboard start [--port <port>]` and `agro clipboard stop` to command dispatch and help.
- [ ] Use port 3500 by default. Reject missing, malformed, zero, and out-of-range port values.
- [ ] Start the same installed CLI bundle in a named detached tmux session scoped to the canonical project path.
- [ ] Quote every launch argument. Keep filenames and captions out of the launch command.
- [ ] Confirm service identity and HTTP readiness before reporting success. Report startup errors and port conflicts.
- [ ] Make repeated start and stop calls safe. Reject conflicting start options without replacing a running service.
- [ ] Stop only the session owned by this project. Preserve batches and unrelated sessions or listeners.
- [ ] Refuse unintended host execution with a sandbox entry instruction. Do not provision or restart a sandbox.
- [ ] Bind only to loopback. Use operator-managed forwarding or an authenticated proxy for browser access.
- [ ] Verify standalone bundle startup from outside the source checkout with no source-relative asset dependency.

### US-004: Add the themed browser upload page

**Description:** As an operator, I want a simple upload page so that I can paste multiple images and describe each image.

**Acceptance Criteria:**

- [ ] Support clipboard image paste, file selection, and drag-and-drop with multiple image previews.
- [ ] Keep each editable caption associated with its stable image ID through additions and removals.
- [ ] Show upload progress, validation errors, completed paths, and a copyable agent prompt.
- [ ] Render captions and filenames as text. Never interpret them as HTML.
- [ ] Provide keyboard-accessible controls, visible focus, labels, and a layout usable at desktop and mobile widths.
- [ ] Default to the browser's preferred color scheme. Persist an explicit light or dark selection in browser storage.
- [ ] Use the Studio reference palette: warm paper, near-black ink, green accents, and restrained typography.
- [ ] Bundle page assets with the CLI. Load no fonts, scripts, or styles from a third-party service at runtime.
- [ ] Verify in browser using agent-browser skill.

### US-005: Document and prove the complete journey

**Description:** As a reviewer, I want reproducible evidence so that I can verify uploads and lifecycle behavior before merge.

**Acceptance Criteria:**

- [ ] Update CLI package guidance, lifecycle commands, connection guidance, security guidance, and the Unreleased changelog.
- [ ] Document start, stop, default port, access setup, limits, upload storage, retention, and manual deletion after the service stops.
- [ ] Document that an agent must open image files and that isolated execution targets need explicit image transfer.
- [ ] Start the command journey from fresh temporary state. Include a newly created input path.
- [ ] Record start, upload, repeated start, stop, repeated stop, and an occupied-port failure in `evidence/manual-review.md`.
- [ ] Capture annotated screenshots of light mode, dark mode, and multiple images with distinct captions.
- [ ] Commit sanitized evidence images and embed full-commit-SHA screenshot links with callouts in the PR description.
- [ ] Verify in browser using agent-browser skill.
- [ ] Stop each test service. Remove only temporary resources created by the journey.
- [ ] Ask the operator for final decisions and shipping confirmation before the final push and PR undraft.

## Summary

AGRO has no browser image upload service. The CLI ships as one executable bundle.
Existing tmux helpers provide detached session management. Existing evidence tooling pairs media with a manifest.
The installed Pi worker transport does not automatically forward image attachments.

The proposed service keeps ingestion separate from agent execution. It stores ordered image and caption batches on the sandbox filesystem.
The browser provides a prompt with explicit image-read instructions. This baseline needs no provider adapter.
Four read-only explorers covered lifecycle, handoff, theme, and verification. No implementation has started.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/command-table.ts` | `AGRO_COMMANDS`, `isOneOf` | Register the public command and verbs. |
| `.agro/cli/src/cli.ts` | `main`, `printAgroHelp` | Dispatch clipboard commands and expose help. |
| `.agro/cli/src/lib/tmux.ts` | `hasSession`, `newSession`, `killSession` | Reuse detached session management. |
| `.agro/cli/src/lib/execution/detect.ts` | `runningInsideSandbox` | Preserve the execution boundary. |
| `.agro/cli/build.mjs` | esbuild configuration | Preserve single-bundle distribution. |
| `.agro/cli/src/commands/clipboard.ts` (proposed) | Command parser and lifecycle | Own start, readiness, and stop. |
| `.agro/cli/src/lib/clipboard/` (proposed) | HTTP service, storage, page | Own ingestion and browser presentation. |
| `docs/lifecycle-commands.md` | Verb reference | Document the public command. |
| `CHANGELOG.md` | Unreleased | Record the user-visible feature. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Host and sandbox | Applied | Manage git on the host. Run the service inside the sandbox. Use `agro run` for host verification. |
| Lifecycle door | Applied | Add clipboard start and stop through `agro`; do not add autostart. |
| Canonical and provider surfaces | Applied | Change `.agro/cli/`; leave provider mirrors unchanged and verify links. |
| Root and scaffold | Applied | Ship the bundle and vendored CLI sources. Add no initialized-project scaffold or registry fields. |
| Interactive and headless processes | Applied | Run the persistent upload listener in a named tmux session. |
| Local and remote operation | Applied | Survive terminal disconnect. Document explicit browser forwarding or approved proxy access. |
| Parallel operation | Applied | Scope session and storage identity by canonical project path; reject occupied ports. |
| Public documentation | Applied | Update package help and lifecycle, connection, and security documentation. |
| Verification | Applied | Run CLI, storage, HTTP, bundle, browser, and CI checks. |
| Compose publishing and bootstrap | Not applicable | Do not publish port 3500 automatically or start the service at boot. |

## Storage

Proposed location: `${AGRO_HOME:-$HOME/.agro}/clipboard/<project-id>/batches/<batch-id>/`.
Derive the project ID from the canonical project path. Generate batch and image IDs on the server.
Use private directory and file permissions. Refuse symlink-controlled storage paths.
Keep uploads until the operator removes them. Stop does not delete uploads.
Do not place access tokens inside manifests, prompts, screenshots, or request logs.

## Architectural Decisions

Classification: ARCHITECTURAL. The feature introduces an HTTP filesystem-write boundary and a service lifecycle.

Facts: `build.mjs` emits one CLI bundle. `lib/tmux.ts` supports exact session targets.
Constraint: AGRO requires detached headless processes and sandbox-owned agent data.
Constraint: accepted ADR #1575 places host verification behind the available ephemeral execution target.

Options: add a provider-specific agent bridge, create a separate web package, or extend the existing CLI bundle.
Recommendation: extend the CLI bundle with Node HTTP handling, embedded page assets, and existing tmux helpers.
This option avoids a new runtime package, process manager, database, or provider protocol.

Use a per-service random access token even for loopback access. Keep the browser token out of URL query strings.
Validate origins and bound all request bodies. Do not serve arbitrary filesystem paths or active uploaded content.
Bind only to loopback. The operator approved forwarding or an authenticated proxy, not direct remote binding.

Tradeoff: loopback forwarding requires setup. File-based handoff requires an explicit image-read tool call.
Falsifier: if an approved target harness cannot read shared image files, revise the handoff design before implementation.
Retirement: none; no existing upload path exists to replace.
Decision record: NONE. Capture the bounded service contract in this PR and its tests.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/__tests__/clipboard.test.ts` (proposed) | Parser, port, tmux identity, readiness, stop, isolation | Public lifecycle behavior. |
| `.agro/cli/src/lib/clipboard/__tests__/server.test.ts` (proposed) | Auth, origins, limits, signatures, atomic storage, captions, injection | HTTP and storage boundary. |
| `.agro/cli/src/__tests__/cli-first-help.test.ts` | Clipboard help and default port | CLI discoverability. |
| `.agro/cli/src/__tests__/bundle-identity.test.ts` | Installed-bundle page and upload smoke test | Distribution independence. |
| `.agro/cli/src/__tests__/docs-reference.test.ts` | Documented verbs and links | Documentation integrity. |
| `.agro/tasks/clipboard-upload/evidence/` (proposed) | Annotated browser journey and command transcript | Human review evidence. |

Write failing tests before each implementation. Probe the environment before service design work.
Run `pnpm install --frozen-lockfile`, `pnpm run security:audit`, `pnpm run typecheck`, and `pnpm run build:harness`.
Run `pnpm test:scripts` and `npm --prefix .agro/cli run typecheck:build`.
The root lint and format scripts are placeholders; do not describe them as substantive validation.
Use the repository verification execution target when commands run on the host.
CI must pass on the exact pushed head before the advisor runs `gh pr ready`.

## Design Principles

Keep one lifecycle door and one distributable CLI bundle.
Keep image ingestion independent of harness selection. Treat captions and image content as untrusted input.
Follow the Studio reference at `github.com/ryaneggz/studio`, especially `brands/mifunedev/STYLE.md` and `brand.ts`.
Use warm light surfaces and neutral dark surfaces with green controls. Avoid decorative gradients and external asset dependencies.
Preserve the existing operator change in `agro.json`. Add no explanatory comments to tracked code.

## Out of Scope

Automatic agent injection, provider-specific attachment APIs, OCR, image transformation, cloud storage, public tunnels, and automatic publication are outside the proposed baseline.
Video, audio, arbitrary files, image history browsing, automatic retention jobs, and sandbox port publication are outside this change.
Do not merge the PR or cut a release. The operator owns merge.

## Open Questions

The operator approved file and caption handoff, loopback access, limits, and persistent local storage.
US-001 must verify the sandbox and browser route because the advisor runs on a VM without a sandbox marker.
Request final shipping confirmation after the operator can inspect the screenshots and completed behavior.

## Acceptance Criteria

- [ ] The operator approves the plan and resolves the handoff and access decisions before implementation.
- [ ] Public start and stop commands work with default port 3500 and preserve unrelated processes and uploaded batches.
- [ ] Multiple clipboard images retain their distinct captions and produce an agent-readable manifest and explicit image-read prompt.
- [ ] Light and dark browser journeys pass with annotated screenshots embedded in the PR description.
- [ ] Upload tests reject unauthorized, malformed, oversized, and unsafe content without writing outside the private batch store.
- [ ] The standalone bundle includes the service and page without source-checkout dependencies.
- [ ] The operator confirms final shipping. CI passes on the pushed head and the PR is not a draft.

## Lessons

- Claim: loopback access belongs to the service's execution namespace.
  Evidence: the probe reached sandbox loopback through an explicit private relay; host port publication did not supply that route.
  Outcome: fixed in this PR. Connection guidance names the sandbox endpoint and requires private forwarding or an authenticated proxy.
- Claim: image paths alone do not provide visual input to an agent.
  Evidence: ordered manifests retain captions, and the generated prompt requires an image-reading tool call for every image.
  Outcome: fixed in this PR. The page and documentation state the transfer requirements for isolated workers.
- Claim: the sandbox browser installer needs unavailable system libraries and privilege in this review environment.
  Evidence: installation failed; host Chromium completed the real upload journey through a temporary private relay.
  Outcome: dropped, because browser installation changes are outside this upload feature and the fallback verified the complete browser journey.
- Claim: existing full-document prose findings predate this change.
  Evidence: the verification artifact records 15 baseline findings and zero findings in added prose.
  Outcome: dropped, because unrelated prose changes would expand the scope without improving clipboard behavior.
