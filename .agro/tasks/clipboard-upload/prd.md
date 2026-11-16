# PRD: Clipboard and file uploads

Status: DRAFT

The operator approved the original plan and shipping on 2026-11-12.
The operator then requested colocation under `~/.agro/` and support for files alongside images.
This revision applies those explicit requests to the existing unmerged PR #1613.

## User Stories

### US-001: Probe the service execution path

**Description:** As an operator, I want a verified runtime path so that uploads run inside the intended boundary.

**Acceptance Criteria:**

- [ ] Record the sandbox marker, Node version, tmux availability, bundle entry point, and browser access route.
- [ ] Check ports before startup. Report an occupied port without stopping its listener.
- [ ] Verify browser access to sandbox loopback. Record the absolute-path visibility contract for isolated workers.
- [ ] Stop every probe process. Create no cloud resources or unrelated lifecycle changes.

### US-002: Persist ordered file and caption batches

**Description:** As a headless agent, I want file attachments paired with captions so that I can inspect each attachment in context.

**Acceptance Criteria:**

- [ ] Accept `POST /api/batches` JSON with an ordered `files` array containing name, MIME type, canonical base64 data, and caption.
- [ ] Save arbitrary file bytes as inert attachments. Never render, serve, extract, or execute uploaded files.
- [ ] Validate PNG, JPEG, and WebP signatures when clients declare those MIME types. Treat other formats as generic files.
- [ ] Allow empty generic files. Reject empty or invalid declared raster images.
- [ ] Enforce 1 to 10 files, 10 MiB per file, 50 MiB per raw request, and 2000 characters per caption.
- [ ] Generate filenames on the server. Preserve only a bounded safe extension for generic files; never use a client path.
- [ ] Write a schema-version-1 manifest with ordered `files` entries: stable ID, absolute path, MIME type, byte length, caption, original name, and image/file kind.
- [ ] Return the manifest path, ordered files, and a prompt that requires file-reading tools and image-capable reads for raster images.
- [ ] Preserve authentication, loopback Host/Origin checks, private permissions, symlink refusal, atomic publication, and failed-batch cleanup.
- [ ] Test mixed images/text/PDF/binary bytes, inert HTML/SVG/script files, caption order, validation, concurrency, and prior-batch preservation.
- [ ] Add a standalone-bundle regression for default `HOME/.agro/clipboard/` storage with `AGRO_HOME` unset and no sibling `.clipboard` tree.
- [ ] Update public command help to describe file batches, not image-only batches.

### US-003: Add clipboard lifecycle commands

**Description:** As an operator, I want start and stop commands so that uploads remain available after terminal disconnect.

**Acceptance Criteria:**

- [ ] Provide `agro clipboard start [--port <port>]` and `agro clipboard stop`, with default port 3500 and strict port validation.
- [ ] Run the installed CLI bundle in a project-scoped named tmux session. Quote launch arguments and keep tokens in private state.
- [ ] Verify service identity and readiness. Require idempotent lifecycle operations. Reject conflicting options and foreign sessions.
- [ ] Preserve batches and unrelated processes. Refuse unintended host execution. Bind only to loopback.
- [ ] Ship the service and page in the standalone bundle without checkout-relative assets.

### US-004: Add the themed browser upload page

**Description:** As an operator, I want one upload page so that I can paste images or attach files with distinct captions.

**Acceptance Criteria:**

- [ ] Support image clipboard paste and arbitrary file selection/drop, including empty text files.
- [ ] Preview PNG, JPEG, and WebP only. Show inert file metadata for other formats; never create active document previews.
- [ ] Keep captions associated with stable attachment IDs through additions and removals.
- [ ] Enforce the server's count, byte, request, and caption limits before upload.
- [ ] Send the `files` contract and show saved paths plus the file-aware agent prompt.
- [ ] Preserve captions and attachments after authentication, network, and server failures.
- [ ] Render filenames, captions, and errors as text, never HTML.
- [ ] Keep accessible labels, keyboard controls, visible focus, live status, progress, copy fallback, and responsive layout.
- [ ] Default to browser color preference and persist an explicit light or dark selection.
- [ ] Use the verified Studio palette and embedded offline assets without new runtime dependencies.
- [ ] Verify in browser using agent-browser skill.

### US-005: Document and prove the complete journey

**Description:** As a reviewer, I want reproducible evidence so that I can verify mixed attachments and lifecycle behavior before merge.

**Acceptance Criteria:**

- [ ] Update CLI guidance, lifecycle, connection, security, and Unreleased changelog documentation for images and generic files.
- [ ] Document formats, limits, default private storage, retention, explicit tool reads, and isolated-worker transfer requirements.
- [ ] Run a fresh-state journey with `AGRO_HOME` unset. Verify state, logs, manifests, and files under `~/.agro/clipboard/`.
- [ ] Keep review-owned project/input state under `~/.agro/reviews/clipboard-1612/`; create no sibling home `.clipboard-*` directory.
- [ ] Record start, repeated start, mixed image/file upload with distinct captions, manifest bytes, prompt copy, stop, repeated stop, and an occupied-port failure.
- [ ] Capture annotated screenshots of light mode, dark mode with mixed captions, and handoff paths under `~/.agro/`.
- [ ] Replace evidence only after a real rerun. Label retained historical probe results as historical rather than rewriting observations.
- [ ] Commit sanitized screenshots and embed full-head-SHA links with exact callouts in the PR description.
- [ ] Verify in browser using agent-browser skill.
- [ ] Stop all owned processes. After preservation checks, delete only review-owned resources.
- [ ] Apply the operator's explicit refinement request and prior shipping approval; keep the PR draft until new exact-head CI passes.

## Summary

The existing unmerged implementation provides authenticated image uploads, captions, a themed page, and detached lifecycle commands.
Production already stores data under the AGRO state home. Earlier evidence used a temporary sibling-home override.
The operator requested general files and colocation under `~/.agro/`.

Extend ingestion to inert files, retain raster image validation, and refresh the real journey with default storage.
The existing code passed 3281 tests, both typechecks, build, audit, and four CI checks before this refinement.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/cli/src/lib/clipboard/server.ts` | HTTP validation and limits | Accept mixed file batches. |
| `.agro/cli/src/lib/clipboard/storage.ts` | Batch persistence and prompt | Store ordered files without execution. |
| `.agro/cli/src/lib/clipboard/page.ts` | `CLIPBOARD_PAGE` | Provide mixed file/image controls and captions. |
| `.agro/cli/src/commands/clipboard.ts` | `runClipboard` | Preserve lifecycle and update help terminology. |
| `.agro/cli/src/cli.ts` | `printAgroHelp` | Describe file upload capability. |
| `.agro/cli/src/lib/layout.ts` | `resolveUserStateHome` | Retain the default `~/.agro/` source of truth. |
| `.agro/cli/src/__tests__/bundle-identity.test.ts` | Standalone smoke tests | Prove default storage and packaged upload. |
| `docs/lifecycle-commands.md` | Clipboard command reference | Explain mixed uploads and retention. |
| `CHANGELOG.md` | Unreleased | Record the requested capability. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| Host and sandbox | Applied | Host owns git; sandbox owns ingestion and application verification. |
| Lifecycle door | Applied | Keep existing `agro clipboard start/stop`; add no process manager. |
| Canonical and provider surfaces | Applied | Edit canonical `.agro/cli/` and verify provider links. |
| Root and scaffold | Applied | Ship the existing CLI bundle; add no scaffold or registry settings. |
| Interactive and headless processes | Applied | Keep the service in named tmux and explicit private forwarding. |
| Local and remote operation | Applied | Retain loopback binding and disconnect independence. |
| Parallel operation | Applied | Use one worker at a time in the task worktree; preserve project-scoped state. |
| Public documentation | Applied | Update file terminology, safe handling, default storage, and evidence. |
| Verification | Applied | Test arbitrary bytes, image validation, UI, standalone storage, and fresh browser evidence. |
| Compose publishing and bootstrap | Not applicable | Add no public port or autostart. |

## Storage

Keep `${AGRO_HOME:-$HOME/.agro}/clipboard/<project-id>/batches/<batch-id>/`.
State and startup logs remain in the project-specific clipboard directory.
Use private directories and files, generated names, and atomic completed batches.
The refreshed journey leaves `AGRO_HOME` unset and isolates its project under `~/.agro/reviews/clipboard-1612/`.
Do not migrate or delete unrelated existing data. The earlier review-only sibling directory no longer exists.

## Architectural Decisions

Classification: ARCHITECTURAL. General files expand the ingestion contract, not the execution boundary.

Keep the existing dependency-free HTTP service, private filesystem store, tmux lifecycle, and bundled page.
Options considered: add document processing, restrict uploads to a new format allowlist, or store arbitrary bytes inertly.
Choose inert storage. It satisfies file attachment without parsers, extraction, active previews, or execution.

Replace the unpublished `images` request and manifest fields with `files` before this feature's first merge.
Keep schema version 1 for this unreleased contract; do not add a dormant compatibility adapter.
Each entry records an image/file kind. Only validated PNG/JPEG/WebP entries use image previews.
Preserve safe extensions for generic tool discovery, but generate the actual file basename.

Retain token authentication, exact loopback origin policy, bounded bodies, and private storage.
Treat content and captions as untrusted data. Agent tools inspect files explicitly.
The design needs no new database, package, provider bridge, automatic file processing, or storage migration.
Falsifier: if uploaded files become executable or browser-served content, reject the implementation.
Decision record: NONE. Keep the bounded contract in this PR and its tests.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/cli/src/lib/clipboard/__tests__/server.test.ts` | Mixed formats, empty files, signatures, safe extension, limits, auth, atomicity | Inert ingestion boundary. |
| `.agro/cli/src/lib/clipboard/__tests__/page.test.ts` | Generic selection/drop, preview safety, captions, new payload, retries | Browser attachment behavior. |
| `.agro/cli/src/__tests__/bundle-identity.test.ts` | Mixed upload and default home without override | Packaged service and colocation. |
| `.agro/cli/src/__tests__/clipboard.test.ts` | Existing parser, session, quoting, readiness | Lifecycle preservation. |
| `.agro/cli/src/__tests__/cli-first-help.test.ts` | File terminology and default port | Discoverability. |
| `.agro/cli/src/__tests__/docs-reference.test.ts` | Verbs, links, paths | Documentation integrity. |
| `.agro/tasks/clipboard-upload/evidence/` | Fresh mixed upload and annotated screenshots | Human review evidence. |

Write failing tests before each implementation change.
Run the full suite, frozen install, both typechecks, build, and security audit in clean-main sandbox acceptance.
Restore the operator's exact `agro.json` edits after each acceptance run.
Root lint and format scripts are placeholders; substantive CI lint and boot checks must pass on the pushed head.

## Design Principles

Keep one lifecycle door and one distributable bundle. Preserve user files as bytes, not executable behavior.
Keep captions and content untrusted. Require explicit downstream file reads.
Use the Studio reference palette from `github.com/ryaneggz/studio` without external runtime assets.
Preserve existing operator configuration. Add no explanatory comments to tracked code.

## Out of Scope

Document conversion, OCR, archive extraction, executable processing, malware scanning, public downloads, and cloud storage are outside this change.
Automatic agent dispatch, public tunnels, image history, retention jobs, and storage migration are outside this change.
Do not merge the PR or cut a release.

## Open Questions

None. The operator requested files alongside images and colocation under `~/.agro/`.
Apply existing file-count, byte, caption, authentication, and retention limits to the refinement.

## Acceptance Criteria

- [ ] Images and arbitrary files retain distinct captions and bytes in an ordered manifest.
- [ ] Generic files remain inert; raster validation and all existing security boundaries remain active.
- [ ] Default storage and the refreshed review use `~/.agro/`, with no sibling-home `.clipboard` state.
- [ ] Start/stop, default port 3500, idempotence, ownership checks, and standalone packaging remain verified.
- [ ] Light/dark browser evidence shows mixed attachments and AGRO-colocated handoff paths in the PR description.
- [ ] The full local suite and exact-head CI pass before the existing PR returns to ready for review.

## Lessons

- Claim: review overrides can obscure the production storage location.
  Evidence: production already used `~/.agro/clipboard/`; the old journey used a temporary sibling-home override.
  Outcome: fixed in this PR. A default-home regression and new browser screenshots prove the real AGRO storage path without `AGRO_HOME`.
- Claim: general file support does not require active document processing.
  Evidence: mixed byte tests and browser checks preserve captions while HTML/SVG receive metadata only.
  Outcome: fixed in this PR. Generic attachments remain inert; agents use explicit file tools.
- Claim: deep equality on a large binary fixture can exhaust the test heap.
  Evidence: the interrupted backend run failed during a 10 MiB comparison; `Buffer.equals` completed the same byte check.
  Outcome: fixed in this PR. The byte-limit regression retains its full-size fixture without a deep object diff.
- Claim: unrelated provider-link tests can exceed their existing time budget under shared load.
  Evidence: three unchanged tests timed out at 5 seconds; the unchanged full retry passed all 3309 tests with original timeouts.
  Outcome: dropped, because no provider-link source changed and the retry verified the complete suite without relaxed limits.
- Claim: workers must leave commit hooks enabled.
  Evidence: one worker supplied a hooks override; inspection found only sample hooks, and later commits used normal hooks.
  Outcome: dropped, because no active hook existed to skip and the advisor completed independent clean-main acceptance.
