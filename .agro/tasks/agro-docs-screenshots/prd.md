# PRD: Add annotated screenshots to the AGRO docs

Status: DRAFT

## User Stories

### US-001: Prepare a Console node for the capture

**Description:** As a docs maintainer, I want the Console browser editor on a free node. Then each screenshot shows the editor and the node host that a Console user sees.

**Acceptance Criteria:**

- [ ] The capture signs in to the local development Console as `dev+demo@agro.local`, and creates one free node with the SSH key of that account.
- [ ] The capture opens the node in **Connect** → **Browser editor (code-server)**.
- [ ] The node host runs the latest AGRO release, and `agro --version` prints that version in the editor terminal.
- [ ] agent-browser shows the editor in a 1280x720 viewport at device scale 1.5. Each PNG is 1920x1080, and the editor keeps a desktop layout.
- [ ] The git identity on the node is `Demo User <demo@example.com>`. The capture signs in to no other account. No screenshot shows a real name, email address, token, or public IP address.
- [ ] A teardown step lists the node and the key for the operator to delete.

### US-002: Add screenshots to the quickstart and installation pages

**Description:** As a new self-host user, I want to see each first command and its output. Then I recognize a correct result.

**Acceptance Criteria:**

- [ ] `docs/quickstart.md` shows the sandbox creation, the shell in the sandbox, and a harness install, each in the editor terminal.
- [ ] `docs/installation.md` shows `agro --version` after the install.
- [ ] Each image is a PNG at 1920x1080 in `docs/img/`, with a name of the form `<page>-<step>.png`.
- [ ] Each image has alt text and a `Callouts:` line under it that names each numbered callout.
- [ ] Verify in browser using agent-browser skill.

### US-003: Add screenshots to the lifecycle and connecting pages

**Description:** As a self-host user, I want to see the lifecycle commands and the ways to connect. Then I pick the correct command.

**Acceptance Criteria:**

- [ ] `docs/lifecycle-commands.md` shows `agro ps` and one other verb that the page documents, each with its output.
- [ ] `docs/connecting.md` shows the editor connected to the sandbox and one shell session.
- [ ] Each image follows the file, size, alt-text, and `Callouts:` rules of US-002.
- [ ] Verify in browser using agent-browser skill.

### US-004: Add screenshots to the harness, Herdr, and GitHub pages

**Description:** As a self-host user, I want to see a harness install, a Herdr workspace, and the GitHub sign-in. Then I complete each setup step.

**Acceptance Criteria:**

- [ ] `docs/harnesses/overview.md` shows `agro harness install <id>` and its output.
- [ ] `docs/integrations/herdr.md` shows a Herdr workspace with two panes.
- [ ] `docs/integrations/github.md` shows `gh auth status` for a signed-in demo account, or the first prompt of `gh auth login` when no demo account exists. No image shows a token or a one-time code.
- [ ] Each image follows the file, size, alt-text, and `Callouts:` rules of US-002.
- [ ] Verify in browser using agent-browser skill.

### US-005: Guard the images

**Description:** As a docs maintainer, I want CI to stop a missing image or a missing callout line. Then each docs page stays complete.

**Acceptance Criteria:**

- [ ] A test fails when an image link in `docs/` names a file that does not exist.
- [ ] The test fails when an image has no alt text, or has no `Callouts:` line within the next 3 lines.
- [ ] The test fails when a file in `docs/img/` has no reference from `docs/`, or when a PNG is not 1920x1080.
- [ ] The test is `.agro/scripts/__tests__/docs-images.test.ts`. The `ci-harness.yml` job runs the test through `pnpm test:scripts` on each change to `docs/**`.

### US-006: Manual review evidence

**Description:** As the operator, I want a recorded review of each page with its images. Then I accept the change from evidence.

**Acceptance Criteria:**

- [ ] Depends on US-001 through US-005.
- [ ] `.agro/tasks/agro-docs-screenshots/evidence/manual-review.md` holds an annotated screenshot of each changed page at 1280x720, from a local agro-web build that uses the changed `docs/`.
- [ ] The review confirms that each image loads and shows no personal data.
- [ ] The run stops each process that the run starts.

## Summary

The AGRO docs have no image. The site at `https://agro.mifune.dev/docs/agro/` copies the AGRO `docs/` folder from the latest release. The copy includes image files. An image under `docs/img/` therefore reaches the site with the next release. A relative link that leaves `docs/` becomes a GitHub link, so each image must live under `docs/`.

The Mifune Console opens a node in code-server, and the editor terminal is a shell on the node host. The operator asked for screenshots from the Console editor at a zoom level that makes the terminal text readable.

mifunedev/agro-web#72 added screenshots to the Console guide with these rules: 1280x720 PNG files, numbered callouts, a `Callouts:` line under each image, and a CI guard.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `docs/*.md`, `docs/harnesses/overview.md`, `docs/integrations/*.md` | image links, `Callouts:` lines | Pages |
| `docs/img/` | PNG files | Image source |
| `.agro/skills/agent-browser/scripts/annotate-screenshot.sh` | callouts | Capture |
| `.agro/scripts/__tests__/docs-images.test.ts` | image guard | US-005 |
| mifunedev/agro-web `scripts/sync-agro-docs.mjs` | docs copy | Publishes the images |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `docs/` pages in this repo | Modified | Each listed page gets screenshots |
| `/docs/agro/*` on agro.mifune.dev | Modified | The next release publishes the images |

## Storage

The screenshots are PNG files in `docs/img/`. The capture sandbox is temporary, and the teardown deletes the sandbox.

## Architectural Decisions

- **Released behavior only.** The capture runs the latest AGRO release. A later release that changes a captured output needs a new capture.
- **No personal data.** The capture uses a demo git identity on a new free node. No image shows a token, a one-time code, or a host path of the operator.
- **One source.** The AGRO repo owns the images, beside the pages that show them. agro-web keeps no copy.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/scripts/__tests__/docs-images.test.ts` | missing file, missing alt text, missing `Callouts:` line, unreferenced file, wrong size | US-005 |
| `bash .agro/skills/ste/scripts/ste-check.sh <page>` | prose and `Callouts:` lines | US-002 to US-004 |
| `.agro/tasks/agro-docs-screenshots/evidence/manual-review.md` | each page with its images | US-006 |

## Design Principles

- Show the command and the result that the step names. Put one callout on each value that the reader checks.
- Use one theme, one viewport, and one font size for each image. The editor must look like a full desktop editor, not a small window.
- Apply `/ste` to each sentence and each `Callouts:` line.

## Out of Scope

- The Console guide. mifunedev/agro-web#72 covers it.
- Screenshots of the runtime, harness, and integration pages that US-002 to US-004 do not name.
- Mobile screenshots.

## Open Questions

None. The capture source is a free node in the local development Console of the operator, under the account `dev+demo@agro.local`. The capture uses a 1280x720 viewport at device scale 1.5. The image guard is `.agro/scripts/__tests__/docs-images.test.ts`. The advisor tried a local sandbox first and dropped it. Code-server inside a sandbox cannot run the host commands that the quickstart shows.

## Acceptance Criteria

- [ ] Each page in US-002 to US-004 shows at least one annotated screenshot.
- [ ] Each image shows the latest AGRO release and no personal data.
- [ ] CI fails on a missing image, a missing alt text, a missing `Callouts:` line, an unreferenced image, or a wrong size.
- [ ] Each changed page passes the STE checker.

## Lessons

- **A sandbox cannot host the capture.** Evidence: code-server inside a local sandbox could not run `agro sandbox install docker` or `agro shell`. Outcome: fixed in this PR. The capture used the browser editor of a free node in the development Console.
- **The Console starts each node one minor release behind the docs.** Evidence: the new node ran AGRO `0.17.0`, because the Console pins `DEFAULT_AGRO_VERSION` to `0.17.0`. The capture ran `agro self-upgrade` to reach `0.18.1`. Outcome: proposed agro-console issue, not open yet; it waits for operator approval.
- **The host-side harness install does not find a running sandbox.** Evidence: `agro harness install <id>` on the node host reported the running `agro-sbx-1` as absent. Outcome: proposed issue on agro, not open yet.
- **The onboarding banner reports wrong harness states.** Evidence: the banner marked alias-only harnesses as installed. Outcome: proposed issue on agro, not open yet.
- **A repeat harness install does not update.** Evidence: `agro harness install` on an installed harness printed "already installed", which contradicts "Updating a harness" in `docs/harnesses/overview.md`. Outcome: proposed issue on agro, not open yet.
- **Screenshots are hard to read in the docs column.** Evidence: the docs page shows each 1920x1080 image 703px wide. Outcome: the operator chose click-to-zoom, in mifunedev/agro-web#75.
- **Captures must show real output at one font size.** Evidence: the first set mixed font sizes and added CSS spacing between terminal rows. Outcome: fixed in this PR. Each image uses font size 18 and real terminal output.
