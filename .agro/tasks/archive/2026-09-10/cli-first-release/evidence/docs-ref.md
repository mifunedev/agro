# Docs source and UI evidence

Core PR: https://github.com/mifunedev/agro/pull/1031
Web PR: https://github.com/mifunedev/agro-web/pull/54
Web head: `34485f68557a3f5deb1b1f5f9ef47462c1569ef6`

## Source identity

Agro-web resolves the requested ref to one commit SHA. It checks out that detached SHA for the CLI build. It fetches `get-agro.sh` and `get-oh.sh` by the same SHA. Moving-branch and invalid-ref tests fail closed.

Observed worker checks on web head `34485f68`:

```text
pnpm test: 28 passed
pnpm typecheck: passed
changed-Markdown STE: passed
pnpm run check:docs-drift: passed
pnpm build: passed
```

## Rendered UI

Browser preflight: `audit-20260910T001500Z-ui`, exit 0.

Agent-browser rendered:

- Desktop, 1280x720: `http://127.0.0.1:3000/docs/installation`
- Mobile, 414x896: `http://127.0.0.1:3000/docs/quickstart`

A read-only UI reviewer returned PASS for four checks:

1. The pages show npm `@mifune/agro` or `get-agro.sh`, then `agro sandbox install docker`.
2. The pages distinguish `agro update` from `oh update`.
3. The required path excludes clone, fork, `install.sh`, and `config repo`. Optional source workflows use optional or historical labels.
4. The pages show `ghcr.io/mifunedev/agro:latest` and describe the retained npm shim without canonical-release version parity.

Screenshot hashes are in `../ui-evidence.json`. Screenshots are not repository artifacts.
