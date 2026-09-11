# PRD: CLI Naming Residue Cleanup

Tracks GitHub issue #1046 and closes every follow-up left open by #1042
(`e65e7a50`) and #1043 (`de4cbe8b`). The operator asked for one PR rather than a
queue of follow-ups.

## Introduction

Three merged changes left residue in four places. This task closes all of it,
and mints the three probes the retrospective nominated so the same classes
cannot recur silently.

| Item | Origin | Kind |
|---|---|---|
| 33 hardcoded `oh` literals in the command layer | #942 | Defect (#1046) |
| `SandboxRow.repo` JSON key | #1043 | Contract residue |
| Two docs naming `~/.oh` as the current path | #942 | Doc rot |
| `materialize()` selects the compose base from path presence | pre-#1042 | Architectural residue |
| Three nominated probes | retro 2026-09-11 | Guardrails |

## Goals

- Make every operator-facing message name the binary the operator invoked.
- Retire the last surface where `repo` and `checkout` disagree.
- Correct the two docs that present a legacy path as current, without touching
  the many that describe it correctly as legacy.
- Remove the need for the #1042 D-3 image pin by fixing its cause.
- Mint three probes so each closed class stays closed.

## User Stories

### US-001: Thread the resolved binary name through the command layer

**Description:** As an operator, I want every message to name the binary I
invoked, so that the CLI never teaches me a deprecated command.

**Acceptance Criteria:**

- [ ] The active `Product` (or its `bin`) reaches every command that prints an
      operator-facing message: `sandbox.ts`, `lifecycle.ts`, `tool.ts`,
      `harness.ts`, `update.ts`, `config.ts`
- [ ] All 33 hardcoded `oh` literals identified in #1046 read the threaded value
- [ ] Invoked as `agro`, a successful install ends with `next: agro shell <name>`
- [ ] Invoked as `oh`, the same install ends with `next: oh shell <name>`
- [ ] Error-recovery hints follow the same rule, including `sandbox.ts:223,246`,
      `lifecycle.ts:248`, `tool.ts:148,254`, `harness.ts:127,221`
- [ ] No literal `oh ` is substituted with a literal `agro ` — the resolution is
      always dynamic, per `.agro/cli/src/lib/product.ts:38`
- [ ] Tests pass
- [ ] Typecheck passes

### US-002: Probe the binary-name guardrail

**Description:** As the harness, I want a probe that fails when an
operator-facing binary name is hardcoded, so that #1046 cannot recur.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/continual-learning-20260911.sh` exists, tier A
- [ ] It fails when a tracked file under `.agro/cli/src/commands/` prints a
      hardcoded operator-facing `oh ` or `agro ` literal
- [ ] It does not flag `--repo-dir`, `gh` CLI flags, or legitimate uses of
      `LEGACY_PRODUCT.bin`
- [ ] It exits 2 with `SKIPPED` when `.agro/cli/src` is absent
- [ ] It passes on the tree produced by US-001 and fails on the tree before it
- [ ] Tests pass

### US-003: Retire the last `repo` / `checkout` disagreement

**Description:** As a consumer of `agro sandbox list --json`, I want the key to
match the rest of the CLI without my parser breaking.

**Acceptance Criteria:**

- [ ] `SandboxRow` carries a `checkout` key holding the value
      `configCheckout(config)` returns (`.agro/cli/src/commands/sandbox.ts:349`)
- [ ] The `repo` key remains present with the identical value, as a deprecated
      alias — this is additive, not a rename
- [ ] `docs/` records that `repo` is deprecated in the JSON output and names
      `checkout` as the supported key
- [ ] The human-readable table is unchanged
- [ ] Tests pass
- [ ] Typecheck passes

### US-004: Correct only the docs that present `~/.oh` as current

**Description:** As a reader, I want the legacy registry path described as
legacy, without losing the passages that correctly explain back-compatibility.

**Acceptance Criteria:**

- [ ] `.agro/README.md:176` and `.agro/cli/README.md:101` name
      `${AGRO_HOME:-~/.agro}/sandboxes/<name>/` as the current path
- [ ] Passages that deliberately describe the legacy path as still resolving are
      **unchanged**, including `docs/configuration.md:27`,
      `docs/deployment-prebuilt-image.md:13`, `docs/lifecycle-commands.md:25`,
      and `docs/oh-directory-layout.md:44`
- [ ] `CHANGELOG.md` history is unchanged
- [ ] The `fresh-machine-setup` knowledge page's citation rot, recorded in
      `.agro/tasks/repo-flag-checkout-rename/evidence.md:284`, is corrected
- [ ] Prose passes the `/ste` checker
- [ ] Typecheck passes

### US-005: Select the compose base from the effective image mode

**Description:** As a maintainer, I want `materialize()` to choose the compose
base from what the sandbox will actually do, so that the #1042 D-3 pin is no
longer needed to compensate.

**Acceptance Criteria:**

- [ ] `materialize()` selects the build-capable base only when the sandbox will
      build, rather than whenever `checkout` is set
      (`.agro/cli/src/lib/registry.ts:93-99`)
- [ ] A unit test asserts which base is written for each combination of
      (checkout set or unset) x (`image.mode` build or image)
- [ ] The D-3 `image.ref` fill (`.agro/cli/src/commands/sandbox.ts:286-292`) is
      removed **only if** US-005 makes it unreachable, and a test proves a
      non-checkout `--checkout` path still resolves a runnable image
- [ ] If the pin cannot be removed safely without a Docker daemon, keep it, say
      so in `evidence.md`, and mark this criterion not met rather than guessing
- [ ] The three compose-string probes and `registry.test.ts` stay byte-identical
- [ ] Tests pass
- [ ] Typecheck passes

### US-006: Probe the surface-sweep guardrail

**Description:** As the harness, I want a probe that keeps rename tasks honest
about their affected surfaces.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/docs-20260911.sh` exists, tier A
- [ ] It fails when a flag or field documented as canonical in `docs/` is still
      presented as canonical under its deprecated spelling in any tracked
      `README.md`
- [ ] It covers repo-root `README.md`, `.agro/README.md`, and
      `.agro/cli/README.md`
- [ ] It passes on the current tree
- [ ] Tests pass

### US-007: Probe the CI-evidence guardrail

**Description:** As the harness, I want a probe that rejects treating an empty
check set as a pass.

**Acceptance Criteria:**

- [ ] `.agro/evals/probes/continual-learning-20260911b.sh` exists, tier A
- [ ] It fails when a tracked script or skill treats an empty CI check list as a
      settled or successful state
- [ ] It covers `.agro/skills/ci-status/`, `.agro/skills/audit/scripts/`, and
      `.agro/skills/spec/references/`
- [ ] It passes on the current tree, or names the exact offending site if it does
      not
- [ ] Tests pass

### US-008: Confirm the regression floor

**Description:** As the advisor, I want proof this change is contained.

**Acceptance Criteria:**

- [ ] `/eval` reports no regression
- [ ] `.agro/evals/probes/oh-devcontainer-restructure.sh`,
      `oh-home-mount.sh`, `oh-image-only-deploy.sh`, and
      `.agro/cli/src/lib/__tests__/registry.test.ts` are byte-identical
- [ ] `git diff development...HEAD -- .devcontainer/` is empty
- [ ] `.devcontainer/entrypoint.sh` is unchanged
- [ ] A CHANGELOG entry exists per `.agro/skills/git/SKILL.md`
- [ ] Tests pass
- [ ] Typecheck passes

## Functional Requirements

- FR-1: Every operator-facing message must name the invoked binary, resolved
  through `productFromArgv` rather than a literal.
- FR-2: A hardcoded operator-facing binary literal under
  `.agro/cli/src/commands/` must fail a probe.
- FR-3: `agro sandbox list --json` must emit `checkout`, and must keep `repo` as
  a deprecated alias carrying the same value.
- FR-4: Only documentation that presents `~/.oh` as the **current** path may
  change. Back-compatibility prose must stay as written.
- FR-5: `materialize()` must select the compose base from the effective image
  mode.
- FR-6: The D-3 image pin may be removed only when a test proves it is
  unreachable.
- FR-7: The compose files, `AGRO_REPO_DIR`, `AGRO_HOME_MOUNT`, and
  `.devcontainer/entrypoint.sh` must not change.

## Non-Goals

- Removing the `oh` binary, the `--repo` flag, or the `repo` config field.
  Deprecation timing is a separate decision.
- Renaming `AGRO_REPO_DIR` or any compose variable.
- Changing the human-readable `agro sandbox list` table.
- Editing probes outside the three this task mints.
- Any behavior change not named in FR-1 through FR-6.

## Technical Considerations

- **The bin mechanism already exists.** `.agro/cli/src/lib/product.ts:38`
  resolves the product from the invoked name. `cli.ts` threads it through help
  text. Only the command layer was left behind. This is a threading change, not
  a new abstraction.
- **`--repo-dir` is a different surface.** It is a `docker-compose.sh` flag and
  must survive untouched. The `--repo` flags throughout `.agro/skills/**` are
  `gh` CLI flags and are equally unrelated.
- **The `~/.oh` sweep is not mechanical.** Most hits describe the legacy path
  correctly. `git grep` finds the candidates; a human judgment call decides
  which are wrong. US-004 lists both sets explicitly.
- **US-005 carries the only real risk.** It is a behavior change to image
  selection, and no Docker daemon is available here, so it is provable only at
  unit level. It is ordered last for that reason. Landing US-001 through US-004
  with US-005 deferred is an acceptable outcome; guessing is not.

## Success Metrics

- A fresh `agro sandbox install docker` ends by naming `agro`, not `oh`.
- No surface remains where `repo` and `checkout` disagree.
- The three nominated probes are green and guard their classes.
- `/eval` reports no regression.

## Open Questions

- Should `agro sandbox list --json` emit a deprecation marker alongside the
  `repo` alias, or stay silent? Silent is the assumed default, matching the
  `--repo` flag's treatment in #1043.

## Knowledge Context

- **Base commit**: `de4cbe8b`
- **Knowledge used**: `oh-cli-portable-lifecycle`, `fresh-machine-setup`,
  `pattern-evals-product-name-literal-pinning`, `pattern-evals-unexercised-oracle`,
  `pattern-evals-probe-failure-path-untested`
- **Grounded against**: `.agro/cli/src/lib/product.ts`, `.agro/cli/src/cli.ts`,
  `.agro/cli/src/commands/`, `.agro/cli/src/lib/registry.ts`,
  `.agro/compat-inventory.json`, `.agro/evals/README.md`, `.agro/README.md`,
  `.agro/cli/README.md`, `docs/`

## Expected Knowledge Impact

- Impact: REQUIRED
- `fresh-machine-setup` carries citation rot recorded at
  `.agro/tasks/repo-flag-checkout-rename/evidence.md:284`. US-004 corrects it.
- `oh-cli-portable-lifecycle` describes the registry path and may need
  reverification after US-004.

## Plan Reconciliation

- Intent preserved: YES
- The planning base and the execution base are the same commit (`de4cbe8b`), so
  no drift reconciliation applies.
- **Surface sweep widened the affected set, not the intent.** A repo-wide
  `git grep` found operator-facing `oh` literals in two command-layer files the
  issue's hand-written table omits: `.agro/cli/src/commands/secret.ts` (5 sites)
  and `.agro/cli/src/commands/cloud.ts` (4 runtime sites plus the hardcoded
  `CLOUD_HELP` block). US-002's probe covers all of `.agro/cli/src/commands/`,
  so leaving them would force the probe to be scoped down to six files, which
  would make it decoration rather than an oracle. They are threaded under
  US-001. `.agro/cli/src/commands/migrate.ts` already threads `${bin}` and is
  the reference implementation.
- **The `~/.oh` sweep found one more wrong site in a listed file.**
  `.agro/cli/README.md:60` presents `~/.oh/sandboxes/<name>/` as what a fresh
  `agro sandbox install docker` writes. That is the same defect as `:101`, in
  the same file, and `.agro/tasks/repo-flag-checkout-rename/evidence.md:284`
  already recorded it. It is corrected under US-004.
  `.agro/cli/README.md:52` is left as written: it describes the `oh`/`agro`
  alias relationship, which is back-compatibility prose.

## US-009: Rename instructional `oh` commands in `docs/` to `agro`

**Description:** As a reader of the documentation, I want every command I am told
to run today to name `agro`, so that the docs never teach me the deprecated
binary — while every passage that explains legacy compatibility keeps saying
`oh`, because that is what it is about.

Added at the operator's direction after the initial eight stories landed, folding
the previously held-back `docs/` sweep into this PR.

**Acceptance Criteria:**

- [ ] Every instructional-current occurrence of `oh <lifecycle-verb>` under
      `docs/` names `agro` instead
- [ ] Every legacy-explanatory occurrence is **unchanged, byte for byte**
- [ ] `oh update` is **never** renamed: `agro update` self-upgrades the installed
      CLI (`cli.ts:1169-1181`) while `oh update` vendors the project payload, and
      `--from`, `--from-remote`, `--ref` and `--force` are refused under `agro`
      (`cli.ts:683-689`). They are different commands.
- [ ] `docs/agro-compatibility.md`, `docs/oh-directory-layout.md` and
      `docs/rfcs/**` are unchanged
- [ ] A passage that deliberately names both spellings is unchanged, including
      `docs/integrations/github.md:91`
- [ ] Paths, filenames and variables (`/opt/oh`, `~/.oh`, `.oh/`, `oh.json`,
      `OH_*`) are unchanged
- [ ] Every hit is classified instructional-current or legacy-explanatory, and
      the split is reported; a genuinely ambiguous hit is left and named
- [ ] `.agro/skills/t3/scripts/t3-code.sh:135` and
      `.agro/skills/escalate/scripts/escalate.sh:7` remain out of scope
- [ ] The four frozen files stay byte-identical to the recorded baseline
- [ ] Prose adds zero new `/ste` findings
- [ ] `/eval` reports no regression
- [ ] CI is green on the exact head

## US-010: Thread the invoked binary through the sandbox onboarding banner

**Description:** As an operator opening a sandbox shell, I want the onboarding
banner to name the binary I invoked, so that the most-read surface in the
product does not teach me the deprecated one.

Found while grounding US-009: `.agro/install/banner.sh` hardcodes `oh` at six
operator-facing sites and has no bin awareness. `banner.sh:187` prints
``Next: run `oh tool install herdr` `` — the direct analogue of the
`next: oh shell <name>` line this issue was filed about. Added at the operator's
direction.

**Acceptance Criteria:**

- [ ] `.agro/install/banner.sh` resolves the binary the way
      `.devcontainer/entrypoint.sh:133-134` already does, and never hardcodes it
- [ ] All six sites read the resolved value: `:84`, `:96`, `:111`, `:141`,
      `:181`, `:187`
- [ ] The resolved value defaults to `agro` and yields `oh` when the legacy
      binary is in use
- [ ] `.devcontainer/entrypoint.sh` is **not** edited
- [ ] `docs/harnesses/hermes.md:276` is updated to match what the banner now
      prints, and remains a true transcript
- [ ] The four frozen files stay byte-identical
- [ ] `/eval` reports no regression
- [ ] CI is green on the exact head
