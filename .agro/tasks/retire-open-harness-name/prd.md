# PRD: retire the Open Harness product name from current prose

Issue: [#1058](https://github.com/mifunedev/agro/issues/1058)
Branch: `task/1058-retire-open-harness-name`

## Introduction

`package.json` names the product `agro`, "AGRO — Agent Governance Runtime
Orchestrator". `README.md` opens with AGRO. `AGENTS.md` opens with "Open
Harness — Orchestrator" and defines the whole system in that name.

`AGENTS.md` is the only always-on context file in this repository. `CLAUDE.md`
is its provider-compatibility symlink. Every agent session loads the retired
product name as its first authority, then reads a `README.md` and a
`package.json` that name a different product.

The earlier identity cutover, archived at
`.agro/tasks/archive/2026-09-10/agro-identity-cutover/`, swept the repository
and URL identity: `mifunedev/openharness` and `oh.mifune.dev`. That sweep
matched no prose. The phrase survived in the one file every session reads.

## Goals

- G-1: `AGENTS.md` names AGRO as the product and names no retired product name
  as current.
- G-2: Every tracked occurrence of the phrase carries a recorded class and a
  reason.
- G-3: The change rewrites the `stale` class only.
- G-4: The change breaks no probe, no test, and no published artifact name.
- G-5: The deferred classes leave a follow-up issue, so no occurrence is lost.

## Scope

`classification.md` in this folder records every occurrence. The operator scoped
this change to the `stale` and `pinned` classes: 69 files, 162 hits.

Deferred to a follow-up issue by operator decision:

| Class | Files | Reason |
|---|---|---|
| `external` | `NOTICE`, `.agro/cli/NOTICE`, `.agro/cli/legacy/NOTICE` | Legal attribution |
| `external` | `.pi/install/slack-manifest.json` | An externally registered application |
| `external` | `.devcontainer/*.service` | Unit names the earlier cutover placed out of scope |
| `deferred` | `.agro/knowledge/source/**` | A page edit triggers wiki re-verification |

## User Stories

### US-001: Rewrite the always-on context file

**Description:** As an agent session, I want the first authority I load to name
the current product so that it stops contradicting `package.json`.

**Acceptance Criteria:**

- [ ] `AGENTS.md` names AGRO as the product.
- [ ] The title, the opening role sentence, the product-identity section, and
      every glossary entry that defines the harness name AGRO.
- [ ] `AGENTS.md` names no retired product name as current.
- [ ] `CLAUDE.md` still resolves as a symlink to `AGENTS.md`.
- [ ] `.agro/evals/probes/agents-identity-contract.sh` pins the new heading and
      returns PASS.
- [ ] The probe change is the only probe edit in this story.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh AGENTS.md` exits 0.

### US-002: Rewrite the root and configuration surfaces

**Description:** As a reader arriving at the repository, I want every root file
to name one product.

**Acceptance Criteria:**

- [ ] `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.agro/README.md`,
      `projects/AGENTS.md`, and `.worktrees/AGENTS.md` name AGRO.
- [ ] `.example.env`, `.hadolint.yaml`, `.codex/config.toml`,
      `.devcontainer/devcontainer.json`, and `.devcontainer/entrypoint.sh` name
      AGRO in prose.
- [ ] No file under `.devcontainer/` with a `.service` extension is edited.
- [ ] No `NOTICE` file is edited.
- [ ] Every changed file keeps its current behavior; only prose changes.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed
      Markdown file.

### US-003: Rewrite the documentation surface

**Description:** As a documentation reader, I want no current page to name a
retired product.

**Acceptance Criteria:**

- [ ] Every file under `docs/` classified `stale` names AGRO.
- [ ] No file under `docs/rfcs/` is edited.
- [ ] `docs/glossary.md` defines AGRO and names the retired product only as a
      former name.
- [ ] `docs/agro-compatibility.md` keeps every retained surface name unchanged.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed file.

### US-004: Rewrite the skill and script surfaces

**Description:** As an agent loading a skill, I want the skill to name the
current product.

**Acceptance Criteria:**

- [ ] Every file under `.agro/skills/` classified `stale` names AGRO.
- [ ] No file under `.agro/skills/strategic-proposal/references/` is edited.
- [ ] No fixture under any `fixtures/` directory is edited.
- [ ] `.agro/scripts/install.sh`, `.agro/scripts/link-providers.sh`,
      `.agro/install/banner.sh`, `.agro/scripts/hermes-install-smoke.sh`, and
      `.agro/cli/README.md` name AGRO.
- [ ] `.agro/scripts/get-oh.sh` is not edited; it is the legacy installer.
- [ ] `bash .agro/scripts/link-providers.sh --check` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh` exits 0 on each changed
      Markdown file.

### US-005: Ship the classification and prove no collateral damage

**Description:** As a reviewer, I want the class of every occurrence recorded
and the gates green.

**Acceptance Criteria:**

- [ ] `.agro/tasks/retire-open-harness-name/classification.md` records every
      tracked occurrence with its class and the rule behind the class.
- [ ] The counts in the document match a fresh `git grep -c` at the tip.
- [ ] `bash .agro/skills/eval/run.sh` reports no new regression.
- [ ] `pnpm test` or the repository's test entry point reports no new failure.
- [ ] No occurrence in the `historical`, `compatibility`, `test-fixture`, or
      `external` class changed.

### US-006: Land the pull request and open the follow-up

**Description:** As a maintainer, I want the change on `development` and the
deferred work tracked.

**Acceptance Criteria:**

- [ ] `CHANGELOG.md` carries one entry under `## [Unreleased]` of at most 250
      characters that links the PR.
- [ ] A follow-up issue tracks the `external` and `deferred` classes and names
      each file.
- [ ] The PR title reads `FROM task/1058-retire-open-harness-name TO development`.
- [ ] The PR body carries `Closes #1058`.
- [ ] Every CI check passes.

## Functional Requirements

- FR-1: The change rewrites the `stale` class and the one `pinned` probe
  literal. It rewrites no other class.
- FR-2: `AGENTS.md` and `.agro/evals/probes/agents-identity-contract.sh` change
  in the same commit, because the probe pins a heading in that file.
- FR-3: No published artifact name changes: the GHCR image
  `ghcr.io/mifunedev/openharness`, the npm shim `@mifune/openharness`, the
  systemd unit `openharness-cron.service`, the `get-oh.sh` endpoints, and the
  marker filename `.openharness-root-pnpm-manifest.sha256`.
- FR-4: No versioned `CHANGELOG.md` section is edited.
- FR-5: Prose changes only. No behavior changes.
- FR-6: Every changed Markdown file passes `ste-check.sh`.

## Non-Goals

- NG-1: No retirement of a compatibility surface. The SLA governs that.
- NG-2: No change to the `.oh` and `OH_*` control-plane aliases.
  `.agro/compat-inventory.json` owns those.
- NG-3: No rename of generic uses of `harness` or the path
  `/home/sandbox/harness`.
- NG-4: No edit to the `external` or `deferred` classes; a follow-up issue owns
  them.
- NG-5: No new probe. The existing identity probe already guards the file.

## Technical Considerations

- TC-1: `.agro/evals/probes/agents-identity-contract.sh:13` runs
  `grep -qF '## What Open Harness is'` against `AGENTS.md`. Rewriting the
  heading without the probe turns the suite red.
- TC-2: `.agro/cli/src/lib/product.ts` sets `LEGACY_PRODUCT.title` to
  "Open Harness CLI". That string is the `oh` binary's own title and four tests
  assert it. It stays.
- TC-3: The phrase appears inside evidence records as a quoted search pattern,
  for example `grep -n 'OH_\|\.oh/\|Open Harness'`. A sweep that rewrites those
  corrupts the record of the check.
- TC-4: `AGENTS.md` is the always-on context for every session in this
  repository, so a defect in it reaches every later run.
- TC-5: `.agro/skills/ste/scripts/ste-check.sh` skips frontmatter, fenced
  blocks, and headings.

## Success Metrics

- SM-1: A new session loads `AGENTS.md` and reads one product name.
- SM-2: The suite and the test entry point stay green.
- SM-3: Every deferred occurrence carries a class and a follow-up issue number.

## Open Questions

- OQ-1: Does `docs/open-core.md` describe a former product boundary rather than
  the current one? US-003 decides per file and records the reason.

## Knowledge Context

- **Base commit**: `e66b9627234e3c6106525c7c516e34b0fc326396`
- **Queries**: `rename sweep naming --patterns`, `evals probes literal --patterns`, `docs product identity`
- **Knowledge used**: `[[pattern-rename-sweep-collapses-block-scalar-indent]]`,
  `[[pattern-evals-prose-literal-pinning]]`,
  `[[pattern-evals-product-name-literal-pinning]]`
- **Grounded against**: `AGENTS.md`, `package.json`, `README.md`,
  `.agro/evals/probes/agents-identity-contract.sh`, `.agro/cli/src/lib/product.ts`,
  `.agro/compat-inventory.json`, `.agro/scripts/registry-portability.md`,
  `.agro/tasks/archive/2026-09-10/agro-identity-cutover/prd.md`,
  `.agro/tasks/archive/2026-09-10/agro-identity-cutover/reference-classification.md`
- **Conflicts discovered**: The issue body estimated 277 occurrences across 128
  files. A fresh count at the base commit reports 289 across 131. The delta is
  the supervisor-skill task folder that #1057 merged, whose hits are evidence
  records that quote the phrase as a search pattern.

## Expected Knowledge Impact

- **Impact**: REQUIRED
- **Expected entries**: `pattern-rename-sweep-spares-the-pinned-literal`
- **Affected source paths**: `AGENTS.md`, `docs/**`, `.agro/skills/**`
- **Reason**: The task changes the harness's shared vocabulary and the always-on
  context file that every session reads.

## Plan Reconciliation

- **Source plan**: issue #1058
- **Intent preserved**: YES
- **Material deviations**: none
- **Constraints discovered during grounding**: Four constraints, none of which
  contradicts the approved intent.
  1. A probe pins the `AGENTS.md` product-identity heading. The heading and the
     probe change together.
  2. The coarse class rule over-captured. `NOTICE`, the Slack manifest, the
     systemd units, and the knowledge pages carry external or procedural blast
     radius. The operator scoped them to a follow-up.
  3. `LEGACY_PRODUCT.title` is a retained binary title with four asserting
     tests. It stays.
  4. An evidence record that quotes the phrase as a search pattern is a record
     of a check, not a product name.
- **Orchestration preserved**: NOT-APPLICABLE
