# Verification evidence — retire `agro cloud` (#1050)

Base commit: `dd5ff0c0`. Verified by the advisor in the feature worktree, not taken from the implementation worker's report.

## D1 — no cloud surface remains

`grep -rn "oh cloud\|agro cloud\|OH_CLOUD\|CloudSettings\|runCloud\|cloud\.apiUrl\|OH_PROVISION_KEY\|OH_API_URL"` over the tree, excluding `node_modules`, `.git`, `dist`, and this task folder, returns only:

- `CHANGELOG.md:35` — the new `Removed` entry.
- `CHANGELOG.md:521` — the 2026-07-10 entry. History stays.
- `.agro/evals/probes/oh-config-surfaces.sh:94,97` — the guard that asserts `OH_CLOUD_CONFIG` never returns.
- `.agro/compat-inventory.json:40-43,57,68` — the ledger rows, retired in place.
- `docs/agro-compatibility.md:326-328` — the reconciliation paragraph.

No `CloudSettings`, `runCloud`, or cloud dispatch survives in CLI sources.

## D2 — tests and probes

Typecheck: `tsc --noEmit` exits 0 with no diagnostics.

Unit suite: 1429 passed, 2 failed.

The two failures are `migrate-rehearsal.test.ts > agro ps / oh ps resolves the migrated entry and reaches docker compose`. They are pre-existing and environmental. The advisor confirmed this by checking out `dd5ff0c0` into a separate worktree and running the same suite. The failure name sets are identical:

```
$ diff base-fails.txt feat-fails.txt
  (no output)
```

Cause: `docker compose` is on PATH, so `dockerComposeAvailable()` returns true, but no daemon is reachable, so `agro ps` exits 1. Nothing cloud-related. A full-suite run can cascade extra failures inside this one file; an isolated run of the file yields exactly these two on both trees.

Probes, all exit 0:

| Probe | Result |
|---|---|
| `oh-lifecycle-surface.sh` | PASS — the tier-A tripwire; `CLI_VERBS` no longer lists `cloud` |
| `oh-config-surfaces.sh` | PASS |
| `agro-compat-inventory.sh` | PASS — every `OH_*` identifier stays classified |
| `config-schema-parity.sh` | PASS — `.example.env`, `secrets.ts`, and `docs/configuration.md` agree |
| `changelog-entry-length.sh` | PASS — the new entry is 218 characters, under the 250 cap |
| `audit-stale-references.sh` | PASS |
| `operator-config-guard.sh` | PASS |

`python3` is absent from this container, so `oh-config-surfaces.sh:40` reports invalid JSON on any tree. The advisor ran that probe behind a scratchpad `python3` shim that validates JSON through `node`. Nothing was written to the repository. CI supplies a real `python3`.

## D3 — documentation

`config-schema-parity.sh` is the cross-surface oracle for D3 and passes. It checks `.example.env` against the `secrets.ts` allow-list and `docs/configuration.md`, which is the coherence a partial doc deletion would break.

## D4 — pull request

Recorded in the PR description and the closing session report.

## Deviation from the operator ruling

The operator chose a hard delete. One surface is retired in place instead: the six `.agro/compat-inventory.json` rows. That file is a ledger of deferred compatibility obligations, and `docs/agro-compatibility.md` recorded that the namespace cutover routed around Cloud deliberately. Deleting the rows would erase that record. The advisor raised this before implementation and the operator confirmed it.

The rows moved to the file's existing `obsolete` classification. That classification is forced, not merely apt: `agro-compat-inventory.sh` fails any non-obsolete row whose owning file the tree no longer mentions.
