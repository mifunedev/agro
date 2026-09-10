# US-001 · Organization-wide downstream dependency inventory

- **Issue:** [#944](https://github.com/mifunedev/agro/issues/944) (parent [#939](https://github.com/mifunedev/agro/issues/939))
- **Scan date:** 2026-09-08 (UTC)
- **Scope:** every repository in the `mifunedev` organization, scanned by content.
- **Coverage:** 32 of 32 organization repositories. 32 cloned, 32 scanned, 0 clone failures.

## Scan method

`gh search code` was **not** used as the source of truth: it omits private
repositories and caps results. Every repository was cloned and grepped.

### 1 · Enumerate

```bash
gh repo list mifunedev --limit 100 --json name,isArchived,isFork,visibility,updatedAt,defaultBranchRef
```

Returns 32 repositories, 1 archived (`serverless-chat`), 0 forks.

Coverage was cross-checked against the org record so that no repository was
invisible to the token:

```bash
gh api orgs/mifunedev --jq '{public_repos, total_private_repos}'
# {"public_repos":31,"total_private_repos":1}   -> 32 total, all 32 enumerated
gh api "orgs/mifunedev/repos?per_page=100&type=all" --jq 'length'   # 32
```

The scanning identity is `ryaneggz`, an owner of `mifunedev`. The one private
repository (`openharness-cloud`) cloned successfully.

### 2 · Clone and grep

For each repository:

```bash
git clone --depth 1 https://github.com/mifunedev/<name>.git <scratch>/<name>
git -C <scratch>/<name> rev-parse HEAD                  # recorded below
git -C <scratch>/<name> rev-parse --abbrev-ref HEAD     # default branch

PATTERN='mifunedev/openharness|@mifune/openharness|ghcr\.io/mifunedev/openharness|oh\.mifune\.dev|/get-oh\.sh|/oh\.js|openharness-release|oh\.json|OH_[A-Z]|openharness|OpenHarness'
git -C <scratch>/<name> grep -n -I -E "$PATTERN" -- .

# `.oh/` as a project control plane — tracked files, not prose mentions
git -C <scratch>/<name> ls-files | grep -E '(^|/)\.oh/'

# the executable `oh`
git -C <scratch>/<name> grep -n -I -E '(^|[`"'"'"' (])oh (shell|sandbox|tool|harness|ps|destroy|migrate|install|init|doctor|up|down|exec|run)\b' -- .
```

The pattern is deliberately **wider** than #944's list: it also matches bare
`openharness` / `OpenHarness`, so that prose and identifier hits that #944's
literal list would miss are still surfaced and classified. Clones were deleted
after each scan.

Root-marker presence was independently re-verified through the API, so the
`.oh/` finding does not depend on the clone pass:

```bash
for n in $(jq -r '.[].name' repos.json); do
  gh api "repos/mifunedev/$n/contents/" \
    --jq '[.[].name] | map(select(. == ".oh" or . == ".agro" or . == "oh.json" or . == "agro.json")) | join(",")'
done
# agro -> .oh,oh.json   agro-web -> .oh   openharness-cloud -> .oh   (all others: none)
```

### 3 · Two required repositories

- `mifunedev/openharness-cloud` — the shallow clone landed on
  `0aa8f999c3ef79ff8c116517b192206e5d69ba45` (`development`), which matches the
  operator's clone at `projects/mifunedev/openharness-cloud`
  (`git -C … rev-parse origin/development` → the same SHA). That clone was read
  only through `rev-parse` and was not modified.
- `mifunedev/agro` — scanned at `823aabbd7324e08e3b685af6b0a5ef5c3467a15f`
  (`main`).

### 4 · Live-name probes

```bash
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" https://oh.mifune.dev            # 301 -> https://agro.mifune.dev/
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" https://oh.mifune.dev/get-oh.sh  # 302 -> https://agro.mifune.dev/get-oh.sh
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" https://oh.mifune.dev/oh.js      # 302 -> https://agro.mifune.dev/oh.js
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}" https://github.com/mifunedev/openharness  # 301 -> .../agro
curl -sL https://api.github.com/repos/mifunedev/openharness  # 301, follows to full_name "mifunedev/agro"
curl -sL -o /dev/null -w "%{http_code}" https://raw.githubusercontent.com/mifunedev/openharness/refs/heads/main/.oh/scripts/get-oh.sh  # 200, served directly
```

Every legacy host and repository name still resolves. A stale link is therefore
**degraded-but-working**, not broken. A stale *command* is a different matter and
is called out where it occurs.

## Classification categories (#944)

| # | Category | Disposition |
|---|---|---|
| 1 | AGRO runtime dependency / product-facing runtime reference | migrate now |
| 2 | runtime compatibility contract | migrate/alias per #939 |
| 3 | stable higher-level product/repository identity | retain |
| 4 | stable internal persistence/API identifier | retain |
| 5 | historical | retain |
| — | unrelated false positive | none |

## Repository table

`Hits` counts matched lines from the wide pattern above, before classification.
A high count is not a defect count: in `mifunedev/agro` and
`mifunedev/openharness-cloud` most matches are retained categories 2–5.

| Repository | Visibility | Archived | Scanned SHA | Default branch | Hits | Verdict |
|---|---|---|---|---|---|---|
| `12-factor-agents` | PUBLIC | no | `7a3827988d99c5b46b3857df7bcf4c9262dc5e76` | `main` | 0 | no active dependency |
| `a2a-langgraph` | PUBLIC | no | `00da082449166e1390e9e65a3da2949cb9563dac` | `master` | 0 | no active dependency |
| `agent-ui` | PUBLIC | no | `d8127b2f409212c72e78790572cb4ca1380b746f` | `master` | 0 | no active dependency |
| `agents` | PUBLIC | no | `50273004fa2797fb18bab7a8b6b4cddd109887c7` | `master` | 0 | no active dependency |
| `agro` | PUBLIC | no | `823aabbd7324e08e3b685af6b0a5ef5c3467a15f` | `main` | 2584 | compatibility to retain (plus default-branch release lag — see below) |
| `agro-web` | PUBLIC | no | `409ef104a3bf5a0b49f4cb68a1437e75938e8de0` | `main` | 414 | consumer to migrate now (partly) |
| `chat-extension` | PUBLIC | no | `b506ce270cef4067b002cf8693cce00a1ffc184b` | `master` | 0 | no active dependency |
| `chat-stream-full-stack` | PUBLIC | no | `e2837f98bf41225af9377b0d8ce9136d8ac4e507` | `master` | 0 | no active dependency |
| `chat-widget` | PUBLIC | no | `7527e289c7093f008c279d0bbbec9d5f91d0e604` | `master` | 0 | no active dependency |
| `chatbot-with-tools` | PUBLIC | no | `7e5d65f2987a278f23fb52398b0da02a187612c5` | `master` | 0 | no active dependency |
| `core` | PUBLIC | no | `49164102b72dd93e1d96985f7a9c5b0a664b800d` | `master` | 0 | no active dependency |
| `deployments` | PUBLIC | no | `f17c9d9d2627db156e49042de203766c19f54aa9` | `master` | 0 | no active dependency |
| `embed` | PUBLIC | no | `f81b0817b69cf934696e70614ff81a9ed37b961e` | `master` | 0 | no active dependency |
| `exec-server` | PUBLIC | no | `abd6f48554f2719d62355ba40e5b08c7dbcf128f` | `main` | 0 | no active dependency |
| `graphs` | PUBLIC | no | `4260ebc5182be0ebe35ae1ea2467b9386299604a` | `master` | 0 | no active dependency |
| `interpreter` | PUBLIC | no | `509a96464f675e92ed9a0b484a3678d99cef58e7` | `development` | 0 | no active dependency |
| `langserve` | PUBLIC | no | `63b0c05ba9db873cc2277567e80fd372a21208e5` | `master` | 0 | no active dependency |
| `llm-server` | PUBLIC | no | `9a712002f1820acd08063f6124d1ce189e0ee340` | `development` | 0 | no active dependency |
| `mcp-sse` | PUBLIC | no | `a3c10a47ec2579efa2645acc2b2695afbe2ff762` | `master` | 0 | no active dependency |
| `multi-agent-supervisor` | PUBLIC | no | `0bf7b11e46ae431b4533c4f3bd3212101c80711e` | `master` | 0 | no active dependency |
| `ollama` | PUBLIC | no | `24c7b9e973a047ae08fdda16573ff12f91dfc5c1` | `master` | 0 | no active dependency |
| `openharness-cloud` | PRIVATE | no | `0aa8f999c3ef79ff8c116517b192206e5d69ba45` | `development` | 1380 | consumer to migrate now |
| `orchestra` | PUBLIC | no | `2c7ccd281e9c69a00f30f5bd51a0ec1cd533c00d` | `development` | 1 | consumer to migrate now |
| `plugin` | PUBLIC | no | `6d67b229b832a454a7ef53dd2c38456d5f2ca490` | `master` | 0 | no active dependency |
| `ruska-cli` | PUBLIC | no | `89307452a865a4d900b229ead9853594fab7cd0a` | `development` | 0 | no active dependency |
| `sandboxes` | PUBLIC | no | `7bb15a1808558372c77091071e9b7c5281f6b65f` | `master` | 0 | no active dependency |
| `serverless-chat` | PUBLIC | **yes** | `44daefc85a1580eaac67dcb61be4186a57ba78b7` | `master` | 0 | no active dependency (archived, scanned anyway) |
| `skills` | PUBLIC | no | `eab0a146ae3fe05bfbde6e0628c8bf22b85657d2` | `master` | 14 | historical |
| `static` | PUBLIC | no | `fb1d7015cac0d0894a96fc5e8ff8995622b36ba3` | `master` | 0 | no active dependency |
| `website` | PUBLIC | no | `fd6050065c5c78956cecbd5ba0c92bed2108e8c0` | `development` | 93 | consumer to migrate now |
| `wiki` | PUBLIC | no | `da19ef5d8075ff2438b2f2832190ff941c7b2ee2` | `master` | 0 | no active dependency |
| `workspace` | PUBLIC | no | `9312c2f946df1a71dc13ea80021fbad0fbe1fda9` | `main` | 0 | no active dependency |

### Verdict counts

| Verdict | Repositories |
|---|---|
| consumer to migrate now | 4 (`openharness-cloud`, `website`, `agro-web`, `orchestra`) |
| compatibility to retain | 1 (`agro`) — its genuine compat surfaces are Phase 5 (#945); its `.oh/`/`oh.json` hits are default-branch release lag, not outstanding work |
| stable identity | 0 as a whole-repository verdict; applies per occurrence inside `openharness-cloud` and `website` |
| historical | 1 (`skills`) |
| no active dependency | 26 |
| not scannable | 0 |

## Per-repository detail

Only repositories with real hits appear here.

### `mifunedev/agro` @ `823aabb` — mostly category 2, Phase 5 business; partly release lag

Most of these are the deliberate Phase 0 compatibility surfaces. Per #944's
non-goals and #939's phasing, their **removal is Phase 5 (#945)**, not this
phase. Nothing here is proposed for removal. Summarized by surface, not
enumerated.

Two rows in the table below are **not** compatibility surfaces at all — they are
default-branch release lag. The distinction is spelled out after the table and
matters, because a grep cannot tell the two apart.

The repository carries its own machine-readable classification at
`.oh/compat-inventory.json` — 47 variables and 16 paths, each with a
classification (`alias-sla`, `migrate-later`, `retained-generic`, `obsolete`), an
owning file, and the AGRO spelling. That file, not this inventory, is the
authority for `mifunedev/agro`'s own surfaces.

| Surface | Evidence | Compat-inventory classification | #944 category |
|---|---|---|---|
| `.oh/` project control plane (539 tracked files) | `git ls-files \| grep '^\.oh/'` | `migrate-later`, phase 2 → `.agro/` | **not a compat surface — release lag.** Phase 2 is merged; `development` @ `b10ecac3` already has `.agro/`. `main` trails it. |
| `oh.json` project config | repository root | `migrate-later`, phase 2 → `agro.json` | **not a compat surface — release lag.** Same: `development` already has `agro.json`. |
| `.oh/scripts/get-oh.sh` installer | `.oh/scripts/` | `alias-sla`, phase 1, beside `get-agro.sh` | 2 |
| `.oh/scripts/install.sh` source-checkout installer | `.oh/scripts/` | `obsolete` | 2 |
| `dist/oh.js` CLI bundle | `.oh/cli/build.mjs` emits `dist/agro.js` and a byte-identical `dist/oh.js` | `alias-sla`, phase 1 | 2 |
| `@mifune/openharness` npm package | `.oh/cli/package.json` is `@mifune/agro`; the legacy name ships as a delegation shim | `alias-sla`, phase 1 | 2 |
| `ghcr.io/mifunedev/openharness` image | release workflow | `alias-sla`, phase 3 | 2 |
| `oh` executable and `oh.mifune.dev` host | `docs/lifecycle-commands.md`, `docs/agro-compatibility.md` | alias for the SLA window | 2 |
| 47 `OH_*` variables | `.oh/compat-inventory.json` — 11 `alias-sla`, 15 `migrate-later`, 14 `retained-generic`, 7 `obsolete` | see file | 2 (4 for the `retained-generic` ones) |
| `openharness-release-smoke-*` CI sandbox name, `openharness-release-reservation` user-agent | `.github/workflows/release.yml:194,209,217`; `.oh/scripts/reserve-github-release.mjs:57` | not catalogued | 4 — internal CI identifier |
| `.oh/tasks/*` (12 task folders, 52 files) | historical task records | — | 5 |

**Correction to PRD finding F4.** F4 states that only two org repositories carry
a `.oh/` directory. The scan shows **three**: `agro-web`, `openharness-cloud`,
and `mifunedev/agro` itself — the last being the runtime's own control plane, on
its default branch only. F4's count is correct once `mifunedev/agro` is excluded
as the subject rather than a consumer, but the literal claim is wrong. Note that
`agro`'s `.oh/` is neither a consumer dependency nor an unretired compatibility
surface; see the next paragraph.

**Second observation — this is release lag, not an unretired compatibility
surface. The two look identical to a grep and must not be conflated.**

The scan read `mifunedev/agro` at its **default branch**, `main` @ `823aabb`,
which is the v0.9.0 release point. That tree carries `.oh/` and `oh.json`. The
Phase 2 `.oh/` → `.agro/` and `oh.json` → `agro.json` namespace cutover is
**already implemented and merged**, on `development`:

```bash
gh api repos/mifunedev/agro/branches/development --jq .commit.sha
# b10ecac3d17d21c7abb45a2e814617e6b9b5ae50   (the PRD's record-repository SHA)
gh api "repos/mifunedev/agro/contents/?ref=development" \
  --jq '[.[].name] | map(select(startswith(".oh") or startswith(".agro") or . == "oh.json" or . == "agro.json")) | join(",")'
# .agro,agro.json
```

So what the table's 2584 hits and the 539 `.oh/` files show for `main` is
**default-branch release lag** — `main` predates the merged cutover and moves
when the next release ships. It is **not** a compatibility surface awaiting
Phase 5 retirement, and Phase 4 must not reimplement it.

The distinction matters because both states produce the same grep output:

| Observation on `main` @ `823aabb` | What it actually is |
|---|---|
| `.oh/` (539 files), `oh.json` at root | release lag — cutover merged to `development` @ `b10ecac3` |
| `oh` executable, `oh.mifune.dev`, `get-oh.sh`, `oh.js`, `@mifune/openharness`, `ghcr.io/mifunedev/openharness`, the `alias-sla` `OH_*` variables | genuine compatibility surfaces, live for the SLA window, retired by Phase 5 (#945) |

**Nothing in `mifunedev/agro` is Phase 4's business** under either reading.

### `mifunedev/openharness-cloud` @ `0aa8f99` — the primary downstream

1380 matched lines. 761 of them are Cloud's own product identity, 566 are inside
`.oh/tasks`. The classification below follows the PRD's "Cloud naming boundary"
table, which is not re-litigated here.

#### Category 1 — migrate now

| Identifier | Occurrences (file:line) | Justification |
|---|---|---|
| `https://github.com/mifunedev/openharness.git` clone URL | `packages/shared/src/workspace-bootstrap-assets.ts:9` (`CLONE_URL`), `infra/cloud-init/cloud-config.yaml:37`, `packages/shared/src/cloud-init.test.ts:98,457`, `infra/cloud-init/README.md:60`, `docs/browser-gateway-threat-model.md:134` | The runtime source the node clones. Replaced by artifact install (US-003), not renamed. |
| `mifunedev/openharness` in prose describing the node bootstrap | `README.md:20`, `apps/web/components/node-setup-guide.tsx:15`, `docs/browser-gateway-threat-model.md:129`, `docs/design/console-mvp.md:254`, `packages/shared/src/index.ts:191,786`, `packages/shared/src/workspace-bootstrap-assets.ts:2`, `apps/web/lib/create-node-bootstrap.ts:53,70`, `apps/web/lib/create-node-bootstrap.test.ts:130` | Product-facing runtime reference in operator/user copy and in hand-sync provenance comments. |
| `~/.openharness` managed source checkout (48 lines) | concentrated in `infra/cloud-init/cloud-config.yaml`, `packages/shared/src/{workspace-bootstrap-assets.ts,cloud-init.test.ts,index.ts}`, `apps/web/components/node-setup-guide.tsx`, `docs/{quickstart.md,browser-gateway-threat-model.md,design/console-mvp.md}`, `infra/cloud-init/README.md` | The checkout itself is removed by US-003. Not renamed to an AGRO-spelled checkout. |
| `make sandbox` / `make shell` (10 files) | `README.md`, `apps/provisioner/src/provision.ts`, `apps/web/components/node-setup-guide.tsx`, `apps/web/lib/{node-setup-presentation.test.ts,walkthrough-tours.ts}`, `docs/{browser-gateway-threat-model.md,design/console-mvp.md,quickstart.md,runtime-settings-runbook.md}`, `infra/cloud-init/README.md` | The `Makefile` was deleted from the runtime by #893. These commands do not exist. Replaced by `agro sandbox install docker`. |
| `oh cloud …` CLI invocation (≈20 lines) | `README.md:212,297,300,303,309,315,316,320`, `docs/quickstart.md:97,432,474,478,479,480,500,502,505,510,515,516` | Product-facing runtime CLI in operator docs. Migrates to `agro cloud`. |
| `npm install -g @mifune/openharness` in the prerequisites table | `docs/quickstart.md:35` — the **only** occurrence in the repository | A documentation line telling an operator to install the legacy CLI package. Not a dependency: absent from every `package.json` and from `pnpm-lock.yaml`. Evidence in the dedicated note below. |
| `OH_CODE_SERVER_ENABLED` (12) | node-side runtime variable | Node-side AGRO runtime variable. Migrates to `AGRO_CODE_SERVER_ENABLED` with Phase 0 compatibility (category 2 at the contract level). |
| `OH_IMAGE_ONLY` (5) | provisioning surface | Listed `obsolete` in `agro`'s compat inventory — probes assert it never returns. Cloud must not re-emit it. |
| `OH_CLOUD_API_URL` (1) | `agro`'s inventory marks it `migrate-later`, phase 4 — **this phase** | Cloud API base URL for the `agro cloud` CLI. |

`ghcr.io/mifunedev/openharness` (the runtime image) and `oh.mifune.dev` appear in
Cloud **only inside `.oh/tasks/*`** historical records (category 5). There is no
live Cloud reference to either. The 38 `ghcr.io/mifunedev/openharness*` and 11
`oh.mifune.dev` raw matches are all `openharness-cloud` images or `.oh/tasks`
prose.

#### Category 2 — migrate with a compatibility alias

`OH_CODE_SERVER_ENABLED` and `OH_CLOUD_API_URL` above; treated as category 1 work
in this phase but delivered as aliased contracts per #939.

#### Category 3 — retained product identity

| Identifier | Occurrences | Justification |
|---|---|---|
| `mifunedev/openharness-cloud`, `ghcr.io/mifunedev/openharness-cloud/{web,gateway,provisioner}`, `@openharness-cloud/*` npm scope | 761 matched lines across the repository | Cloud's own product, repository, image, and workspace identity. #944 explicitly forbids renaming these as part of runtime migration. |

#### Category 4 — retained internal identifiers

| Identifier | Occurrences | Justification |
|---|---|---|
| `OH_IMAGE_TAG` (21), `OH_ENV_FILE` (17) | `infra/control-plane/docker-compose*.yml`, `deploy/docker-compose*.yml`, `scripts/{compose.sh,oh-env.sh}`, `docs/environment-variables.md`, `.github/workflows/{compose-config.yml,runtime-settings-races.yml}` | Configure Cloud's **own** compose stack, not the AGRO runtime, and live in `.env` files on running control-plane hosts. Renaming them would break deployed hosts for grep cleanliness. |
| `~/.openharness-bootstrap-status`, `~/.openharness-bootstrap.log`, `/run/openharness-ready` (23) | cloud-init, provisioner, gateway | The internal contract between cloud-init, the provisioner, and the gateway. Existing nodes carry these paths. Only runtime-facing prose around them changes. |
| `docker-build-oh-sandbox` tmux session (4) | `apps/web/components/node-setup-guide.tsx`, `docs/design/console-mvp.md`, cloud-init | Internal session name that existing nodes already run under. |
| Postgres database `openharness`, `openharness-management-ed25519` secret path, `OPENHARNESS_MANAGEMENT_PRIVATE_KEY_FILE` | `infra/control-plane/docker-compose.yml:29,35,62,90,100,127,169`, `deploy/docker-compose{,.postgres,.web}.yml`, `deploy/README.md:145,152,178,268`, `scripts/db-reset.sh` | Durable persistence and secret identifiers on live deployments. #944 names database names explicitly as not to be changed for grep cleanliness. |

#### `@mifune/openharness` — a documentation line, not a dependency

Cloud does **not** depend on the legacy CLI package. There is exactly one
occurrence in the tree, and it is prose:

```bash
git grep -Fn "@mifune/openharness" 0aa8f99 -- .
# 0aa8f99:docs/quickstart.md:35:| Open Harness CLI | ≥ 0.2.0 | `oh --version` (`npm install -g @mifune/openharness`) |
```

It appears in no `package.json`, no workspace `package.json`, and not in
`pnpm-lock.yaml`. (The 7 `pnpm-lock.yaml` and 9 `package.json` matches counted by
the wide scan are all `@openharness-cloud/*` workspace names — category 3.)

`docs/quickstart.md:35` is therefore a **category 1 product-facing runtime
reference in operator documentation**, dispositioned under the docs story
(US-009) alongside the other `oh cloud …` lines in the same file. It is not a
dependency migration.

#### Category 5 — historical

566 matched lines inside `.oh/tasks/*` (129 tracked files, 12+ task folders):
prior PRDs, prompts, progress logs and evidence that record what the system *was*.
Summarized, not enumerated, per the anchor. Content must survive US-008 unmodified.
`docs/design/console-mvp.md` history and closed-issue links are likewise category 5.

### `mifunedev/website` @ `fd60500` — 6-hit code-search lead, resolved

The code-search figure of 6 undercounts. Content scanning finds **10 lines**
containing `oh.mifune.dev` and **22 lines** matching `mifunedev/openharness`.
Every one has an explicit disposition below.

`oh.mifune.dev` still 301-redirects to `agro.mifune.dev` and
`github.com/mifunedev/openharness` still 301-redirects to `mifunedev/agro`, so
every *link* below is **degraded-but-working**, not broken. The exception is
called out.

| file:line | Identifier | Category | Disposition and justification |
|---|---|---|---|
| `src/config/offerings.ts:4` | `docs: "https://oh.mifune.dev"` | 1 | Live marketing link constant; the canonical docs host is `agro.mifune.dev`. Degraded-but-working (301). Migrate. |
| `src/config/offerings.ts:3` | `openSource: "https://github.com/mifunedev/openharness"` | 1 | Live marketing link. Degraded-but-working (301). Migrate. **Caveat:** `src/lib/schema.ts:12` derives `OPEN_SOURCE_ID = ${OFFERING_URLS.openSource}#software`, a schema.org `@id`. Changing the URL changes a published structured-data identifier — a deliberate, acceptable change, but it must be a decision, not a side effect. |
| `src/sections/AgentPickerSection.tsx:6` | `DOCS_BASE_URL = "https://oh.mifune.dev"` | 1 | Live docs base for every link the section renders. Degraded-but-working. Migrate. |
| `src/sections/AgentPickerSection.tsx:233` | displayed text `mifunedev/openharness` | 1 | Product-facing runtime name rendered under a live GitHub star count. Migrate. |
| `src/sections/AgentPickerSection.tsx:186` | `repo.fullName === "mifunedev/openharness"` | 1 | **Verified not broken.** `src/lib/github.ts:59` builds `fullName` from the curated `owner`/`name`, not from the API response, so the match still succeeds. The GitHub API call itself 301-redirects and `fetch` follows it — probe returns `full_name: mifunedev/agro`, `stargazers_count: 37`. Migrate `github.ts` and this key together, or the star card silently falls back to `starsVerified: false` / "Count unavailable". |
| `src/lib/github.ts:34` | `name: "openharness"` in `FLAGSHIP[]` | 1 | Live GitHub API call at build time (ISR, hourly). Works via redirect today. Migrate. |
| `src/data/faqs.ts:48` | `github.com/mifunedev/openharness` and `oh.mifune.dev` in FAQ copy | 1 | Product-facing runtime references in published copy. Migrate. |
| `public/llm.txt:57,58,71` | `github.com/mifunedev/openharness`, `oh.mifune.dev` ×2 | 1 | **Generated artifact.** Do not hand-edit; regenerate. |
| `scripts/generate-llm-txt.mjs:111,112,125` | the same three strings | 1 | The generator is the real source. Migrate here; `public/llm.txt` follows. |
| `posts/openharness-getting-started.md:17,18,83,89` | `oh.mifune.dev` ×3, `github.com/mifunedev/openharness#-install` | 1 | Published tutorial. Links are degraded-but-working. |
| `posts/openharness-getting-started.md:48-49,55-56,62,72` | `git clone https://github.com/mifunedev/openharness.git ~/.openharness`, `make harness-config`, `nano harness.yaml`, `make sandbox && make shell` | 1 — **broken, not degraded** | This is the public instance of PRD finding F1, one step worse. The clone succeeds via redirect, but `Makefile` was deleted by #893 and `harness.yaml` no longer exists, so `make harness-config`, `make sandbox`, and `make shell` all fail. The organization's public getting-started tutorial does not work. Highest-value item outside Cloud. |
| `src/sections/{HeroSection,FooterSection,PricingSection,OpenHarnessValueSection,AboutSection}.tsx`, `src/app/{page,pricing/page,services/page}.tsx`, `src/components/brand/OpenHarnessBrandBar.tsx` (≈30 lines) | `OpenHarness*` component names, `openharness-value-heading` anchor, "Open Harness" brand copy | 1 for the rendered copy; 4 for the identifiers | The rendered strings name the runtime, which is now AGRO — category 1. The React component names and the DOM anchor id are internal identifiers with no external contract; renaming them is optional churn, so they are category 4 and may be left alone. Separating the two is what keeps this from becoming a mechanical rename. |
| `src/config/cloud-pricing.ts:7,45` | `repo: mifunedev/openharness-cloud`, `openharness-cloud#123` | 3 | Provenance comments naming Cloud's retained repository identity. Retain. |
| `src/lib/schema.ts:11` | `CLOUD_SERVICE_ID = ${SITE_URL}/#openharness-cloud` | 4 | Published schema.org `@id` for the Cloud service. A durable identifier; #944 forbids changing it for cleanliness. Retain. |
| `tasks/**` (≈30 lines across `ai-partner-offer-realign`, `cloud-pricing-page`, `fleet-pricing-calculator`, `mifune-website-refactor`) | `OpenHarness` in PRDs, prompts, progress logs; `mifunedev/openharness-cloud` issue/PR links | 5 | Historical task records. Summarized, not enumerated. Retain unmodified. |

Note: `text-oh-accent` / `ring-oh-focus` Tailwind tokens are lowercase design-system
names, not `OH_*` variables, and were not matched. Unrelated.

### `mifunedev/agro-web` @ `409ef10` — Phase 3 verified, **not clean**

Head commit is `Merge pull request #47 from mifunedev/feat/943-agro-web-identity`
— Phase 3 (#943). Phase 3 delivered the site's **identity**: `docusaurus.config.ts:16`
is `url: "https://agro.mifune.dev"`, `projectName: "agro-web"`, and
`docs/intro.md:12` documents the aliases explicitly. That much is confirmed clean.

The **docs body was not re-mirrored**. `scripts/check-docs-drift.mjs:3` states that
"the site keeps a hand-copied duplicate of the harness repo's `docs/`". Measured
against the copy source:

```
verb counts in docs/ over (agro|oh) (shell|sandbox|ps|stop|restart|logs|config|destroy|migrate|harness|tool)
  mifunedev/agro@823aabb   agro: 133   oh: 211
  mifunedev/agro-web@409ef10  agro:   0   oh: 317
```

`docs/lifecycle-commands.md:6` in `agro-web` reads ``# Lifecycle commands (`oh`)``
and "``oh`` is the only front door"; the same file in `mifunedev/agro` reads
``# Lifecycle commands (`agro`)``. The site published at `agro.mifune.dev`
therefore still presents `oh`, `.oh/`, `oh.json`, `~/.oh` and `OH_HOME` as the
canonical runtime surface, and is missing 14 pages that `mifunedev/agro@main`
now carries (including `agro-compatibility.md`, the very page the aliases refer to).

| Surface | Evidence | Category | Justification |
|---|---|---|---|
| `oh <verb>` as the canonical command across `docs/` (≈317 occurrences in 15+ pages, led by `installation.md`, `lifecycle-commands.md`, `quickstart.md`, `connecting.md`, `configuration.md`, `runtimes/*`, `harnesses/*`) | verb counts above | 1 | The published runtime documentation presents the compatibility alias as canonical. This is a product-facing runtime reference. |
| `docs/oh-directory-layout.md` — filename, title, and body describing `.oh/` as the control plane | whole file; line 13 links `github.com/mifunedev/agro/blob/main/.oh/README.md` | 1 | The link resolves today only because `agro@main` has not taken the Phase 2 rename. It becomes a 404 the moment it does. |
| `ghcr.io/mifunedev/openharness:latest` as the default image (`docs/deployment-prebuilt-image.md` ×11, `docs/docker-deployment.md` ×3, `docs/configuration.md:153`, `docs/quickstart.md:59`, `docs/installation.md:270`, `docs/runtimes/microsandbox.md` ×3) | — | 2 | **Deliberate.** `scripts/check-docs-drift.mjs:41` states GHCR references are not flagged because the image name is owned by the harness release workflow. `agro`'s compat inventory puts the default image-ref switch in phase 3 and keeps the legacy tags as intentional aliases. Not a Phase 4 defect. |
| `oh.mifune.dev/get-oh.sh` in `docs/installation.md:243,244`; `get-oh.sh`/`oh.js` mirroring in `scripts/{sync-external-scripts,build-oh-cli}.mjs`, `README.md:58,60`, `.github/workflows/pages.yml:14` | — | 2 | Deliberate compatibility mirroring. `scripts/oh-source.mjs:25` already defaults `REPO` to `mifunedev/agro` with `OH_GITHUB_REPO` as the legacy fallback, and `sourceCandidates()` falls back from `.agro/scripts/` to `.oh/scripts/`. Correct as built. |
| `docs/intro.md:12`, `docs/quickstart.md:42` naming the aliases | — | 2 | Documenting the compatibility contract is the intended behavior; `check-docs-drift.mjs:34-42` exempts lines that carry the word "compatibility". |
| `.github/workflows/pages.yml:19` `repository_dispatch: types: [agro-release, openharness-release]`; `contains(…, "mifunedev/openharness-web")` guards at lines 77, 83, 90 | — | 2 | Compatibility listeners. **Dormant:** `mifunedev/agro@823aabb` contains no `repository_dispatch` sender at all (`git grep -nE 'repository_dispatch\|event_type' .github .oh/scripts` → empty), matching the comment at `pages.yml:14-16`. The daily `schedule` cron is the only live refresh path. |
| `.oh/tasks/sandbox-registry-one-door/` (6 files) | `git ls-files '.oh/*'` | 5 | Historical task record. No live reference anywhere outside `.oh/` (`git grep sandbox-registry-one-door -- . ':!.oh/'` → empty). See `migrate-check.md`. |
| `blog/*` (49 lines), `promos/*` (9 lines) | dated posts and promo drafts | 5 | Dated records. `check-docs-drift.mjs:25-27` and `:40` deliberately exclude `blog/` and `promos/` from both the retired-command scan and the legacy-identity scan; turning them on is called an editorial decision, not a mechanical one. Retain. |

### `mifunedev/orchestra` @ `2c7ccd2` — 1 hit

| file:line | Identifier | Category | Justification |
|---|---|---|---|
| `decks/slides/onepager.html:242` | `Powered by Orchestra + OpenHarness` | **1 — decided** | The surrounding block is a present-tense "PLATFORM PROOF" panel whose own subtitle (line 243) reads "Mifune builds managed AI workers on **a production agent platform your team can inspect, extend, and own**", sitting directly above live contact routes (`mifune.dev/services`, `support@mifune.dev`, `console.mifune.dev`, lines 229–243). It names the runtime a reader is invited to go inspect and run today, not a past state — so category 1, migrate. One line, one word; lowest priority of the category-1 items. |

### `mifunedev/skills` @ `eab0a14` — 14 hits, all historical

No active dependency. Every hit is prose:

- `skills/ste/SKILL.md:137,170`, `skills/ste/references/examples.md:70,71,72,237`,
  `skills/ste/references/rules.md:414,444` — `openharness` used as an **illustrative
  container/volume name** inside Simplified-Technical-English before/after examples.
  Generic example text; renaming would not change any behavior. Category 5.
- `skills/ship-spec/SKILL.md:78,183,184,185,344` — references to a
  `tasks/openharness-v07-convergence/` template path **in a host repository**, not
  in this one. Category 5.
- `CHANGELOG.md:17` — records that the "Open Harness portability lint
  (openharness#758)" reported five cases. A changelog entry about the past.
  Category 5.

No `.oh/`, no `oh.json`, no `OH_*`, no `oh` executable invocation, no live URL.

## Action required in this phase

Category 1 and category 2 items **outside** `mifunedev/agro` itself:

1. **`mifunedev/openharness-cloud`** — the whole of US-003 through US-006 and
   US-009. Concretely: the `mifunedev/openharness` clone URL and `~/.openharness`
   checkout (removed, not renamed); `make sandbox` / `make shell` (replaced by
   `agro sandbox install docker`); `oh cloud …` → `agro cloud …` in `README.md`
   and `docs/quickstart.md`; `OH_CODE_SERVER_ENABLED` → `AGRO_CODE_SERVER_ENABLED`
   with an alias; `OH_CLOUD_API_URL` (marked phase 4 in `agro`'s own compat
   inventory); and no re-emission of the obsolete `OH_IMAGE_ONLY`. The single
   `@mifune/openharness` line at `docs/quickstart.md:35` rides along with the
   docs story (US-009) — Cloud has **no** dependency on that package.

2. **`mifunedev/website`** — `posts/openharness-getting-started.md` is the only
   item in the org that is **broken rather than degraded**: it publishes
   `make harness-config`, `make sandbox`, and `make shell`, none of which exist
   since #893 deleted the `Makefile`. Then the live constants
   (`src/config/offerings.ts:3,4`, `src/sections/AgentPickerSection.tsx:6`),
   the GitHub API target (`src/lib/github.ts:34` with its matching key at
   `AgentPickerSection.tsx:186`), the FAQ copy (`src/data/faqs.ts:48`), and
   `scripts/generate-llm-txt.mjs:111,112,125` with a regenerated `public/llm.txt`.
   Retain `src/lib/schema.ts:11`, `src/config/cloud-pricing.ts:7,45`, and `tasks/**`.

3. **`mifunedev/agro-web`** — re-mirror `docs/` from `mifunedev/agro`. The site at
   `agro.mifune.dev` still presents `oh` as the canonical verb in ~317 places and
   is missing 14 pages, including `agro-compatibility.md`. This reads as an
   incomplete Phase 3 (#943) delivery rather than newly discovered Phase 4 work;
   the routing decision belongs to the advisor. The GHCR image default and the
   `get-oh.sh`/`oh.js` mirroring are deliberate and must **not** be swept up in it.

4. **`mifunedev/orchestra`** — one word at `decks/slides/onepager.html:242`.
   Decided as category 1: the panel is present-tense platform proof beside live
   contact routes, not a historical note.

Nothing in the remaining 28 repositories requires action.

## Limitations

State these rather than claiming completeness:

1. **Default branch only.** Every clone was `--depth 1` on the default branch.
   Open branches and pull requests were not scanned. A legacy identifier
   introduced on an unmerged branch would not appear here.
2. **Point-in-time.** Every finding is pinned to the SHA in the table. `agro-web`
   in particular moves frequently.
3. **Tracked files only.** `git grep` reads the index. Untracked files, release
   assets, GitHub Pages build output, container images, and the CDN rules that
   serve `oh.mifune.dev/install.sh` (documented at `agro-web/README.md:61` as
   living **outside** any repository) are out of scope. The `oh.mifune.dev` →
   `agro.mifune.dev` 301 is likewise CDN configuration and appears in no repository
   scanned.
4. **`mifunedev/agro` summarized, not enumerated.** By instruction. Its
   `.oh/compat-inventory.json` is the authority for those 2584 lines; this
   inventory does not restate them and does not propose removing any.
5. **Default-branch lag is invisible to a grep.** Scanning `mifunedev/agro` at
   `main` reports `.oh/` and `oh.json` that the merged `development` tree no
   longer has. The same is true of any repository whose default branch trails a
   merged rename. Every hit count in this inventory is a default-branch count and
   must be read as such before it is read as outstanding work.
6. **No runtime behavior of Cloud was exercised.** This is a static inventory.
   PRD findings F1–F3 are cited from the PRD and corroborated by source lines;
   they were not reproduced against a running node.
