---
title: "A repository scan over git ls-files passes on uncommitted files and fails once they are committed"
slug: pattern-evals-tracked-only-scan-misses-uncommitted
kind: pattern
tags: [evals, testing, git, inventory, ci, false-pass]
created: 2026-09-06
updated: 2026-09-08
sources:
  - .oh/cli/src/lib/__tests__/compat-inventory.test.ts@042d1f4d
  - .oh/cli/src/lib/__tests__/compat-inventory.test.ts@35905b44
  - .oh/evals/probes/agro-compat-inventory.sh@35905b44
  - .oh/tasks/agro-compat-foundation/progress.txt@70a8b072
  - .agro/knowledge/source/agro-web-pipeline.md@143cd6b8
  - .agro/compat-inventory.json@0b58c0a7
  - .agro/cli/src/lib/__tests__/compat-inventory.test.ts@a18e421a
confidence: provisional
---

# A repository scan over git ls-files passes on uncommitted files and fails once they are committed

## Relevant Source Files
- `.oh/cli/src/lib/__tests__/compat-inventory.test.ts@042d1f4d` — the scan that listed only `git ls-files`.
- `.oh/cli/src/lib/__tests__/compat-inventory.test.ts@35905b44`, `.oh/evals/probes/agro-compat-inventory.sh@35905b44` — the scan over tracked plus untracked non-ignored files.
- `.agro/knowledge/source/agro-web-pipeline.md@143cd6b8` — the documentation page whose prose tripped the scan.
- `.agro/compat-inventory.json@0b58c0a7` — the declaration that answered it.

## Summary
A test that enumerates the repository through `git ls-files` sees only what is
already tracked. Files written after the last commit are invisible to it, so
the local run is green, the commit lands, and CI — which scans the committed
tree — is the first place the new file is checked. Once the scan reads the whole
working tree, the reverse holds: every file it can see is in scope, documentation
prose included, so naming a legacy identifier in a sentence is as much a
declaration as using it in code.

## Detail
**Symptom.** `compat-inventory.test.ts` passed locally, then CI run
`34049065199` failed on `uninventoried: OH_<X> (docs/agro-compatibility.md)`: the
doc had been written and committed after the local test run and used a literal
placeholder that matched the identifier pattern.

**Root cause.** `git ls-files` with no flags lists the index. The local test ran
while the doc was untracked, so the scan never opened it. A pre-commit hook that
runs the same test has the same blind spot for files added in that commit only
when the hook runs before staging is complete; here the doc simply was not
part of the tree the test looked at.

**Workaround.** Enumerate the working tree, not the index:
`git ls-files -z --cached --others --exclude-standard`, de-duplicated. The scan
then fails on an untracked file the moment it is written, which is what a
fault-injection check needs anyway (`printf 'x=$OH_<FAULT>\n' > tmp.sh` must turn
the probe red without a `git add`).

**Second instance — prose counts as presence.** A knowledge page written to
*document* the docs-site build, `.agro/knowledge/source/agro-web-pipeline.md`,
named `OH_SCRIPTS_REF` in explanatory prose. The variable belongs to an external
repository and the page only described it, but the scan does not read intent: the
identifier was in the tree, so `compat-inventory.test.ts` and the
`agro-compat-inventory` probe both failed in CI run `34183658060` on
`mifunedev/agro` with `uninventoried: OH_SCRIPTS_REF
(.agro/knowledge/source/agro-web-pipeline.md)`. The page's own wiki probes were
green throughout, so nothing local pointed at the knowledge surface as the cause.

**Workaround (appended 2026-09-08).** Inventory the identifier; do not reword the
page. The entry added to `.agro/compat-inventory.json` classifies
`OH_SCRIPTS_REF` as `alias-sla` at phase 3 with `agro: AGRO_SCRIPTS_REF` and
names the external repository as its owner. Rewording would have hidden a real
compatibility fact to satisfy a scan, and the scan is right: documenting a legacy
identifier is a claim about it, and the inventory is where every such claim is
carried.
