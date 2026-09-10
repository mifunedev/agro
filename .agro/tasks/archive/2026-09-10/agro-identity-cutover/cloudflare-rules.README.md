# Cloudflare redirect rules — runbook step 6

Apply `cloudflare-rules.json` to the `mifune.dev` zone:

```bash
curl -sS -X PUT \
  "https://api.cloudflare.com/client/v4/zones/<zone-id>/rulesets/phases/http_request_dynamic_redirect/entrypoint" \
  -H "Authorization: Bearer <cloudflare-api-token>" \
  -H "Content-Type: application/json" \
  --data @.agro/tasks/agro-identity-cutover/cloudflare-rules.json
```

The `PUT` replaces every rule in the dynamic-redirect phase. Read the phase first
with `GET` on the same path and keep a copy, so a rollback can restore it.

Rule order matters. The executable paths come before the catch-all.

| Rule | Effect |
|---|---|
| `agro-install-sh` | `/install.sh` on either host returns the raw `install.sh` body by 302 |
| `agro-legacy-artifacts` | the four mirrored artifacts on the legacy host 302 to the same path on `agro.mifune.dev` |
| `agro-docs-catch-all` | every other legacy-host path 301s to the same path on `agro.mifune.dev` |

**The `agro-install-sh` target is deliberately the `.oh/scripts/` path on the old
repository name.** GitHub redirects the renamed repository, and `main` still
predates the `.oh/` to `.agro/` rename, so this is the only target that resolves
today. Change it to
`https://raw.githubusercontent.com/mifunedev/agro/main/.agro/scripts/install.sh`
in the same change window as the first release that carries the rename to `main`,
never before it.

Verify after applying:

```bash
for p in /install.sh /get-oh.sh /oh.js /get-agro.sh /agro.js; do
  printf '%s ' "$p"
  curl -fsSL "https://oh.mifune.dev$p" | head -c 2
  echo
done
```

Each line must print the path and `#!`.
