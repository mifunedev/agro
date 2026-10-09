# Manual review (US-006)

This file records the manual review of the AGRO docs screenshots of #1359. The
review builds agro-web locally from the `docs/` folder of the AGRO branch
`feat/1359-agro-docs-screenshots` at commit
`5cb0c05dc8e0b26881f14165cd88e210ede12fce`. The review does not use a release.

## Setup

All steps run in the sandbox, local.

1. Make a detached agro-web worktree at `.worktrees/wk/agro-docs-review` from
   `origin/main` (`38df78c`).
2. Make a tarball of the branch `docs/` folder:

   ```bash
   git -C <agro-worktree> archive --format=tar.gz --prefix=agro-local/ -o <scratchpad>/src/agro-docs.tar.gz HEAD docs
   ```

3. Run the `syncAgroDocs` function of `scripts/sync-agro-docs.mjs` from a
   one-off node script in the scratchpad. The script gives `syncAgroDocs` a
   `fetchImpl` that returns the local tarball and a `resolve` that returns
   `v0.18.1`. The script uses no network. The transform adds the title and
   sidebar front matter and rewrites each outbound link to `v0.18.1`.
   Expected: `[sync-agro-docs] wrote docs/agro/ <- https://github.com/mifunedev/agro/archive/v0.18.1.tar.gz (mifunedev/agro@v0.18.1, 31 pages)`.
   `docs/agro/img/` holds 10 PNG files.
4. In the review worktree, run `pnpm install --frozen-lockfile`. Expected exit
   status: 0.
5. Run `pnpm exec docusaurus build`. `pnpm exec` skips the `prebuild` hook, so
   the `prebuild` hook does not replace `docs/agro/`. Expected:
   `[SUCCESS] Generated static files in "build".` Expected exit status: 0.
6. Run `pnpm serve --port 3298 --no-open`. Do not set `AGRO_SCRIPTS_REF`.
   Expected: `[SUCCESS] Serving "build" directory at: http://localhost:3298/`.
7. Open the site with `agent-browser` in the session `us006`.
8. Run `agent-browser set viewport 1280 720`. Expected: the viewport is
   1280x720 at device scale 1.

Each scenario uses these steps:

- The image check scrolls each `article img` into view, waits for the load, and
  reads `complete` and `naturalWidth`.
- Before the screenshot, the review moves the text after the image into a
  `span[data-review="callouts"]`. This change gives the `Callouts:` line a CSS
  selector. The change does not change the page look.
- The review scrolls the image top to 110px below the bottom of the sticky
  navbar. The navbar bottom is at 56px. The image top is at 166px.
- The review runs
  `.agro/skills/agent-browser/scripts/annotate-screenshot.sh evidence/<page>.png 'article img[src*="/<image>-"]=the embedded image' '[data-review="callouts"]=its Callouts line'`.
  Expected exit status: 0.

## Scenarios

**A. Quickstart**

1. Open `http://localhost:3298/docs/agro/quickstart`. Expected: the heading
   "Quickstart".
2. Check each article image. Expected: 3 images, each with `complete=true` and
   `naturalWidth` 1920: `quickstart-sandbox-install`, `quickstart-shell`, and
   `quickstart-harness-install`.
3. Scroll to `quickstart-sandbox-install`. Expected: under the image, the text
   "Callouts: 1 is the command. 2 is the started container. 3 is the next command."
   <details><summary>Screenshot</summary>

   <img src="https://github.com/mifunedev/agro/blob/<commit-sha>/.agro/tasks/agro-docs-screenshots/evidence/quickstart.png?raw=true" width="720" alt="The Quickstart page shows the sandbox install image and its Callouts line">
   </details>

   Callouts: 1 is the embedded image. 2 is its Callouts line.

**B. Installation**

1. Open `http://localhost:3298/docs/agro/installation`. Expected: the heading
   "Installation".
2. Check each article image. Expected: 1 image, `installation-version`, with
   `complete=true` and `naturalWidth` 1920.
3. Scroll to `installation-version`. Expected: under the image, the text
   "Callouts: 1 is the command. 2 is the installed version."
   <details><summary>Screenshot</summary>

   <img src="https://github.com/mifunedev/agro/blob/<commit-sha>/.agro/tasks/agro-docs-screenshots/evidence/installation.png?raw=true" width="720" alt="The Installation page shows the version image and its Callouts line">
   </details>

   Callouts: 1 is the embedded image. 2 is its Callouts line.

**C. Lifecycle commands**

1. Open `http://localhost:3298/docs/agro/lifecycle-commands`. Expected: the
   heading "Lifecycle commands (agro)".
2. Check each article image. Expected: 2 images, each with `complete=true` and
   `naturalWidth` 1920: `lifecycle-commands-ps` and
   `lifecycle-commands-sandbox-list`.
3. Scroll to `lifecycle-commands-ps`. Expected: under the image, the text
   "Callouts: 1 is the command. 2 is the running sandbox container."
   <details><summary>Screenshot</summary>

   <img src="https://github.com/mifunedev/agro/blob/<commit-sha>/.agro/tasks/agro-docs-screenshots/evidence/lifecycle-commands.png?raw=true" width="720" alt="The Lifecycle commands page shows the agro ps image and its Callouts line">
   </details>

   Callouts: 1 is the embedded image. 2 is its Callouts line.

**D. Connecting to the Sandbox**

1. Open `http://localhost:3298/docs/agro/connecting`. Expected: the heading
   "Connecting to the Sandbox".
2. Check each article image. Expected: 1 image, `connecting-editor-shell`, with
   `complete=true` and `naturalWidth` 1920.
3. Scroll to `connecting-editor-shell`. Expected: under the image, the text
   "Callouts: 1 is the node workspace in the **Explorer**. 2 is the command. 3 is the shell in the sandbox."
   <details><summary>Screenshot</summary>

   <img src="https://github.com/mifunedev/agro/blob/<commit-sha>/.agro/tasks/agro-docs-screenshots/evidence/connecting.png?raw=true" width="720" alt="The Connecting page shows the editor shell image and its Callouts line">
   </details>

   Callouts: 1 is the embedded image. 2 is its Callouts line.

**E. Harnesses Overview**

1. Open `http://localhost:3298/docs/agro/harnesses/overview`. Expected: the
   heading "Harnesses Overview".
2. Check each article image. Expected: 1 image, `harnesses-overview-install`,
   with `complete=true` and `naturalWidth` 1920.
3. Scroll to `harnesses-overview-install`. Expected: under the image, the text
   "Callouts: 1 is the command. 2 is the install target. 3 is the install result."
   <details><summary>Screenshot</summary>

   <img src="https://github.com/mifunedev/agro/blob/<commit-sha>/.agro/tasks/agro-docs-screenshots/evidence/harnesses-overview.png?raw=true" width="720" alt="The Harnesses Overview page shows the harness install image and its Callouts line">
   </details>

   Callouts: 1 is the embedded image. 2 is its Callouts line.

**F. Herdr**

1. Open `http://localhost:3298/docs/agro/integrations/herdr`. Expected: the
   heading "Herdr".
2. Check each article image. Expected: 1 image, `herdr-two-panes`, with
   `complete=true` and `naturalWidth` 1920.
3. Scroll to `herdr-two-panes`. Expected: under the image, the text
   "Callouts: 1 is the workspace in the **spaces** list. 2 is the first pane. 3 is the second pane."
   <details><summary>Screenshot</summary>

   <img src="https://github.com/mifunedev/agro/blob/<commit-sha>/.agro/tasks/agro-docs-screenshots/evidence/herdr.png?raw=true" width="720" alt="The Herdr page shows the two-pane image and its Callouts line">
   </details>

   Callouts: 1 is the embedded image. 2 is its Callouts line.

**G. GitHub**

1. Open `http://localhost:3298/docs/agro/integrations/github`. Expected: the
   heading "GitHub".
2. Check each article image. Expected: 1 image, `github-auth-status`, with
   `complete=true` and `naturalWidth` 1920.
3. Scroll to `github-auth-status`. Expected: under the image, the text
   "Callouts: 1 is the command. 2 is no signed-in account."
   <details><summary>Screenshot</summary>

   <img src="https://github.com/mifunedev/agro/blob/<commit-sha>/.agro/tasks/agro-docs-screenshots/evidence/github.png?raw=true" width="720" alt="The GitHub page shows the auth status image and its Callouts line">
   </details>

   Callouts: 1 is the embedded image. 2 is its Callouts line.

## Data check

The review opened each image in `docs/img/` at 1920x1080. Each image can show
only the login `sandbox`, the node-ID hostname
`152f0689-402f-40c5-862c-aba49a52e07d`, the sandbox container hostname
`67efef454e03`, demo values, and AGRO output. No image shows a public IP, an
email other than `demo@example.com`, a token, or a code.

| Image | Result |
|---|---|
| `quickstart-sandbox-install.png` | Pass. It shows the node-ID hostname, `Demo User`, `demo@example.com`, and `/home/sandbox`. |
| `quickstart-shell.png` | Pass. It shows the shell banner, `/home/sandbox/harness`, and the container hostname. |
| `quickstart-harness-install.png` | Pass. It shows a Herdr pane and the install output. |
| `installation-version.png` | Pass. It shows the node-ID hostname and `0.18.1`. |
| `lifecycle-commands-ps.png` | Pass. It shows `ghcr.io/mifunedev/agro:0.18.1` and the container status. |
| `lifecycle-commands-sandbox-list.png` | Pass. It shows `agro-sbx-1 docker ready -`. |
| `connecting-editor-shell.png` | Pass. It shows the node workspace file names and the shell banner. |
| `harnesses-overview-install.png` | Pass. It shows the container hostname and the install output. |
| `herdr-two-panes.png` | Pass. It shows `0.18.1` and `2.1.295 (Claude Code)`. |
| `github-auth-status.png` | Pass. It shows `You are not logged into any GitHub hosts.` No account shows. |

## Defects

The review records these defects. The review does not fix them.

1. US-006 in `prd.md` asks for page screenshots at 1920x1080. This review took
   the page screenshots at 1280x720, as the assignment asks.
2. At 1280x720, each image shows at 703px wide on the page, about 37% of
   the image size. The terminal text on the page is about 7px high. The page
   does not open the image at full size on a click.
3. In `harnesses-overview-install.png`, the install result line wraps after
   `authentic`. Callout 3 marks only the first line.
4. In `quickstart-harness-install.png`, the install result line wraps after
   `docs/harne`. Callout 2 marks only the first line.
5. In `github-auth-status.png`, the right edge of callout 2 cuts through the
   `g` of `gh auth login`.
6. `quickstart-shell.png` shows `opencode` as `not installed`, but
   `connecting-editor-shell.png` shows `opencode` as `installed`. The two
   captures show different sandbox states.

## Cleanup

1. Stop the server by PID: `kill 820010 820048`. Expected exit status: 0.
2. Run `ss -ltn | grep -c ':3298 '`. Expected: `0`.
3. Run `agent-browser close` in the session `us006`. Expected:
   "✓ Browser closed". `agent-browser session list` does not show `us006`.
4. Run
   `git -C /home/sandbox/harness/projects/mifunedev/agro-web worktree remove .worktrees/wk/agro-docs-review`
   without `--force`. Expected exit status: 0. `git worktree list` shows only
   the main checkout.
