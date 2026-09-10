# AGRO cutover runbook

This runbook holds the operator actions for Phase 3 of the AGRO migration
([#943](https://github.com/mifunedev/agro/issues/943)). The reader is the
operator with admin rights. Each command runs on the operator's host, from any
directory, unless the step names another location. The SLA classification of
each retained surface is in the
[compatibility contract](agro-compatibility.md#phase-3--agro-is-the-canonical-external-identity).

Placeholders: `<zone-id>` is the Cloudflare zone ID of `mifune.dev`;
`<cloudflare-api-token>` is a Cloudflare API token with the `Zone.Dynamic
Redirect` edit permission; `token-file` is a file that holds the GitHub
dispatch token. Never paste a token into a command line, a chat, or a log.

## Preconditions

- [ ] The US-001 web PR [mifunedev/openharness-web#46](https://github.com/mifunedev/openharness-web/pull/46) is merged.
- [ ] The core PR [#1015](https://github.com/mifunedev/agro/pull/1015) is green.
- [ ] The operator account has admin rights on `mifunedev/openharness`, on
      `mifunedev/openharness-web`, and on the Cloudflare zone `mifune.dev`.
- [ ] The DNS record `agro.mifune.dev` exists in Cloudflare (proxied; the host
      answers `421` until step 5).
- [ ] The GHCR package `mifunedev/agro` is public.
- [ ] The dispatch token is issued: a fine-grained token with **Contents: Read
      and write** on the docs repository, saved in `token-file`, not yet stored
      in GitHub.
- [ ] The US-004 web PR (branch `feat/943-agro-web-identity`, stacked on #46)
      is open and green.

## Actions

Run the steps in order. Record the output of each step in
`.agro/tasks/agro-identity-cutover/cutover-record.md`.

### 1. Record the repository IDs and the endpoint status before the cutover

```bash
gh repo view mifunedev/openharness --json id,name,url
gh repo view mifunedev/openharness-web --json id,name,url
for host in oh.mifune.dev agro.mifune.dev; do
  for path in /install.sh /get-oh.sh /oh.js /get-agro.sh /agro.js; do
    printf '%s%s ' "$host" "$path"
    curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://$host$path"
  done
done
```

Expected output: the core ID is `R_kgDORyBFdg` and the web ID is
`R_kgDOTHLFeQ`. On `oh.mifune.dev`, `/install.sh` prints `302` with a
`raw.githubusercontent.com` URL, `/get-oh.sh` and `/oh.js` print `200`, and
`/get-agro.sh` and `/agro.js` print `404`. Every `agro.mifune.dev` path prints
`421`.

### 2. Rename the core repository

```bash
gh repo rename agro --repo mifunedev/openharness --yes
gh repo view mifunedev/agro --json id,nameWithOwner
```

Expected output: `nameWithOwner` is `mifunedev/agro` and `id` is still
`R_kgDORyBFdg`.

### 3. Rename the web repository

```bash
gh repo rename agro-web --repo mifunedev/openharness-web --yes
gh repo view mifunedev/agro-web --json id,nameWithOwner
```

Expected output: `nameWithOwner` is `mifunedev/agro-web` and `id` is still
`R_kgDOTHLFeQ`.

### 4. Update the description, the homepage, and the topics of both repositories

```bash
gh repo edit mifunedev/agro \
  --description "AGRO — Agent Governance Runtime Orchestrator. A portable home for autonomous coding agents." \
  --homepage https://agro.mifune.dev \
  --add-topic agro --add-topic coding-agents --add-topic devcontainer
gh repo edit mifunedev/agro-web \
  --description "Documentation site for AGRO (agro.mifune.dev)" \
  --homepage https://agro.mifune.dev \
  --add-topic agro --add-topic docusaurus
gh repo view mifunedev/agro --json description,homepageUrl,repositoryTopics
gh repo view mifunedev/agro-web --json description,homepageUrl,repositoryTopics
```

Expected output: both `homepageUrl` values are `https://agro.mifune.dev`, and
each topic list holds `agro`. Keep every topic that the repository already
carries.

### 5. Set the Pages custom domain, then merge the US-004 web PR

Run the domain change first. The US-004 web PR adds the `CNAME` file for
`agro.mifune.dev`, and the file must match the Pages setting.

```bash
gh api -X PUT repos/mifunedev/agro-web/pages -f cname=agro.mifune.dev -F https_enforced=false
gh api repos/mifunedev/agro-web/pages --jq '{cname, https_enforced, state: .https_certificate.state}'
```

Expected output: `cname` is `agro.mifune.dev` and `state` is `new` or
`authorization_created`. Wait until `state` is `approved`, then enforce HTTPS:

```bash
gh api -X PUT repos/mifunedev/agro-web/pages -F https_enforced=true
gh api repos/mifunedev/agro-web/pages --jq '.https_enforced'
```

Expected output: `true`. If `state` stays below `approved` for more than 30
minutes, set the `agro.mifune.dev` record to **DNS only** in Cloudflare, wait
for `approved`, then set the record back to **Proxied**.

Merge the US-004 web PR (branch `feat/943-agro-web-identity`) from the GitHub
UI. Wait for the `pages.yml` run on `main` to succeed:

```bash
gh run list --repo mifunedev/agro-web --workflow pages.yml --branch main --limit 1
```

Expected output: the newest run shows `completed` and `success`.

### 6. Add the Cloudflare rules for `oh.mifune.dev`

Cloudflare applies the first redirect rule that matches, so the executable-path
rules come before the catch-all rule. The list order below is the rule order.

Rules (Cloudflare dashboard: **Rules → Redirect Rules**; expression filter
with a dynamic target):

| Order | Name | When incoming requests match (expression) | Then (target expression) | Status | Preserve query string |
|---|---|---|---|---|---|
| 1 | `agro-install-sh` | `http.request.uri.path eq "/install.sh" and http.host in {"oh.mifune.dev" "agro.mifune.dev"}` | `"https://raw.githubusercontent.com/mifunedev/agro/main/.agro/scripts/install.sh"` | 302 | off |
| 2 | `agro-legacy-artifacts` | `http.host eq "oh.mifune.dev" and http.request.uri.path in {"/get-oh.sh" "/oh.js" "/get-agro.sh" "/agro.js"}` | `concat("https://agro.mifune.dev", http.request.uri.path)` | 302 | on |
| 3 | `agro-docs-catch-all` | `http.host eq "oh.mifune.dev" and not http.request.uri.path in {"/install.sh" "/get-oh.sh" "/oh.js" "/get-agro.sh" "/agro.js"}` | `concat("https://agro.mifune.dev", http.request.uri.path)` | 301 | on |

The same three rules as one API call (the entrypoint ruleset of the
`http_request_dynamic_redirect` phase; the call replaces every rule in that
phase):

```bash
curl -sS -X PUT "https://api.cloudflare.com/client/v4/zones/<zone-id>/rulesets/phases/http_request_dynamic_redirect/entrypoint" \
  -H "Authorization: Bearer <cloudflare-api-token>" \
  -H "Content-Type: application/json" \
  --data @- <<'JSON'
{
  "rules": [
    {
      "description": "agro-install-sh",
      "expression": "http.request.uri.path eq \"/install.sh\" and http.host in {\"oh.mifune.dev\" \"agro.mifune.dev\"}",
      "action": "redirect",
      "action_parameters": {
        "from_value": {
          "status_code": 302,
          "target_url": { "value": "https://raw.githubusercontent.com/mifunedev/agro/main/.agro/scripts/install.sh" },
          "preserve_query_string": false
        }
      }
    },
    {
      "description": "agro-legacy-artifacts",
      "expression": "http.host eq \"oh.mifune.dev\" and http.request.uri.path in {\"/get-oh.sh\" \"/oh.js\" \"/get-agro.sh\" \"/agro.js\"}",
      "action": "redirect",
      "action_parameters": {
        "from_value": {
          "status_code": 302,
          "target_url": { "expression": "concat(\"https://agro.mifune.dev\", http.request.uri.path)" },
          "preserve_query_string": true
        }
      }
    },
    {
      "description": "agro-docs-catch-all",
      "expression": "http.host eq \"oh.mifune.dev\" and not http.request.uri.path in {\"/install.sh\" \"/get-oh.sh\" \"/oh.js\" \"/get-agro.sh\" \"/agro.js\"}",
      "action": "redirect",
      "action_parameters": {
        "from_value": {
          "status_code": 301,
          "target_url": { "expression": "concat(\"https://agro.mifune.dev\", http.request.uri.path)" },
          "preserve_query_string": true
        }
      }
    }
  ]
}
JSON
```

Expected output: JSON with `"success": true` and three rules in order.

The `/install.sh` redirect exists today as `<existing /install.sh mechanism>`
(a Worker route or an older rule). Retire that mechanism after rule 1 is
active, so that one rule owns the path. The alternative in the PRD's open
question, an origin-host override that serves the bytes from `oh.mifune.dev`
itself, is a valid choice; this runbook documents the redirect form only.

Sequencing hazard: rule 1's target names `.agro/scripts/install.sh` on `main`.
That path does not exist on `main` yet. `main` still carries
`.oh/scripts/install.sh`, because `main` predates the `.oh/` to `.agro/`
rename. Keep the rule target on the `.oh/` path until the release that
carries the rename lands on `main`. Change the target to
`https://raw.githubusercontent.com/mifunedev/agro/main/.agro/scripts/install.sh`
in the same change window as that release, never before it. An earlier
change breaks the endpoint, because the target path does not exist yet.

### 7. Store the dispatch secret and the docs repository variable

```bash
gh secret set AGRO_WEB_DISPATCH_TOKEN --repo mifunedev/agro < token-file
gh variable set AGRO_WEB_REPO --repo mifunedev/agro --body mifunedev/agro-web
gh secret list --repo mifunedev/agro
gh variable list --repo mifunedev/agro
```

Expected output: the secret list holds `AGRO_WEB_DISPATCH_TOKEN` and the
variable list holds `AGRO_WEB_REPO` with the value `mifunedev/agro-web`. After
`gh secret set` returns, delete `token-file`.

### 8. Update the `origin` remote of each operator checkout

Run the snippet below in each checkout of the core repository. The snippet changes
`origin` only when the normalized fetch URL names the old canonical
repository; a fork stays untouched.

```bash
url="$(git remote get-url origin)"
normalized="$(printf '%s\n' "$url" | sed -E 's#^(https://github\.com/|ssh://git@github\.com/|git@github\.com:)##; s#\.git$##')"
if [ "$normalized" = "mifunedev/openharness" ]; then
  git remote set-url origin "${url%/openharness*}/agro${url##*openharness}"
fi
git remote get-url origin
```

Expected output: `https://github.com/mifunedev/agro.git` or
`git@github.com:mifunedev/agro.git` for a canonical checkout; the unchanged
URL for a fork.

## Verification matrix

Run every check after step 8. The first line of a script or a bundle starts
with `#!`, so `curl -fsSL <url> | head -c 2` prints `#!` when the endpoint
returns a body.

| Host and path | Expected status | Resolves to | Check |
|---|---|---|---|
| `https://oh.mifune.dev/install.sh` | 302 | the raw `install.sh` on `main` of `mifunedev/agro` | `curl -fsSL https://oh.mifune.dev/install.sh \| head -c 2` prints `#!` |
| `https://oh.mifune.dev/get-oh.sh` | 302 | `https://agro.mifune.dev/get-oh.sh` | `curl -fsSL https://oh.mifune.dev/get-oh.sh \| head -c 2` prints `#!` |
| `https://oh.mifune.dev/oh.js` | 302 | `https://agro.mifune.dev/oh.js` | `curl -fsSL https://oh.mifune.dev/oh.js \| head -c 2` prints `#!` |
| `https://oh.mifune.dev/get-agro.sh` | 302 | `https://agro.mifune.dev/get-agro.sh` | `curl -fsSL https://oh.mifune.dev/get-agro.sh \| head -c 2` prints `#!` |
| `https://oh.mifune.dev/agro.js` | 302 | `https://agro.mifune.dev/agro.js` | `curl -fsSL https://oh.mifune.dev/agro.js \| head -c 2` prints `#!` |
| `https://agro.mifune.dev/install.sh` | 302 | the raw `install.sh` on `main` of `mifunedev/agro` | `curl -fsSL https://agro.mifune.dev/install.sh \| head -c 2` prints `#!` |
| `https://agro.mifune.dev/get-oh.sh` | 200 | the Pages static file | `curl -fsSL https://agro.mifune.dev/get-oh.sh \| head -c 2` prints `#!` |
| `https://agro.mifune.dev/oh.js` | 200 | the Pages static file | `curl -fsSL https://agro.mifune.dev/oh.js \| head -c 2` prints `#!` |
| `https://agro.mifune.dev/get-agro.sh` | 200 | the Pages static file | `curl -fsSL https://agro.mifune.dev/get-agro.sh \| head -c 2` prints `#!` |
| `https://agro.mifune.dev/agro.js` | 200 | the Pages static file | `curl -fsSL https://agro.mifune.dev/agro.js \| head -c 2` prints `#!` |

Record the status matrix with the loop from step 1; the `oh.mifune.dev` rows
now print `302` with an `agro.mifune.dev` or `raw.githubusercontent.com`
redirect URL, and the `agro.mifune.dev` rows print `200` or `302`.

Repository, image, and dispatch checks:

```bash
gh repo view mifunedev/openharness --json nameWithOwner
git ls-remote https://github.com/mifunedev/openharness.git HEAD
docker buildx imagetools inspect ghcr.io/mifunedev/agro:latest --format '{{json .Manifest.Digest}}'
docker buildx imagetools inspect ghcr.io/mifunedev/openharness:latest --format '{{json .Manifest.Digest}}'
gh run list --repo mifunedev/agro-web --workflow pages.yml --event repository_dispatch --limit 1
```

Expected output, in order: `nameWithOwner` is `mifunedev/agro`; `ls-remote`
prints one SHA and `HEAD`; the two digests are equal; the newest
`repository_dispatch` run shows `completed` and `success`. The dispatch run
appears after the next release from `main`. If no release is due, run
`gh workflow run pages.yml --repo mifunedev/agro-web --ref main` and label the
record as a stand-in.

## Rollback

Each rollback step reverses one action above. Run only the steps that the
failure needs.

1. Pages domain: `gh api -X PUT repos/mifunedev/agro-web/pages -f cname=oh.mifune.dev`,
   then revert the `CNAME` file on `main` of `mifunedev/agro-web` to
   `oh.mifune.dev`. Expected output: `cname` reads `oh.mifune.dev`.
2. Cloudflare rules: set `"enabled": false` on each of the three rules in the
   dashboard, or send the step 6 payload again with `"enabled": false` in each
   rule. Expected output: `oh.mifune.dev` serves the Pages site again.
3. Dispatch: `gh secret delete AGRO_WEB_DISPATCH_TOKEN --repo mifunedev/agro`.
   Expected output: the next `notify-docs` job prints
   `::notice::Secret AGRO_WEB_DISPATCH_TOKEN is not set` and exits 0.
4. Repository names: **not reverted**. GitHub keeps the redirect from the old
   name in both directions of time, and a second rename breaks the redirect
   that consumers already follow.
5. Migrated filesystem state (`.agro/`, `agro.json`, `~/.agro`): **never
   reverted**. The compatibility resolver reads both generations.
