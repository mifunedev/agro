# Reference classification — #1058

Every tracked occurrence of the phrase `Open Harness`, grouped by class.
Command: `git grep -c "Open Harness"`. Base commit `e66b9627`.

Files: 131. Hits: 289.

## Classes

| Class | Hits | Files | Rule |
|---|---|---|---|
| `stale` | 161 | 68 | Current prose naming a retired product. This change rewrites it. |
| `historical` | 72 | 35 | Records what happened under the retired name. Never rewritten. |
| `deferred` | 18 | 6 | Current prose, deferred by operator decision to a follow-up. |
| `external` | 17 | 6 | An externally registered or legally attributed surface. Deferred to a follow-up. |
| `test-fixture` | 13 | 11 | A test or fixture asserting a retained default. Never rewritten. |
| `compatibility` | 7 | 4 | A retained SLA surface or legacy artifact name. Never rewritten. |
| `pinned` | 1 | 1 | A probe literal coupled to prose this change rewrites. Changed with it. |

## stale

| Hits | File |
|---|---|
| 1 | `.agro/README.md` |
| 3 | `.agro/cli/README.md` |
| 2 | `.agro/install/banner.sh` |
| 1 | `.agro/scripts/hermes-install-smoke.sh` |
| 4 | `.agro/scripts/install.sh` |
| 2 | `.agro/scripts/link-providers.sh` |
| 5 | `.agro/skills/audit/references/harness.md` |
| 2 | `.agro/skills/blog/references/loom-to-blog.md` |
| 2 | `.agro/skills/builder/SKILL.md` |
| 1 | `.agro/skills/builder/references/command.md` |
| 4 | `.agro/skills/builder/references/rule.md` |
| 1 | `.agro/skills/builder/references/skill.md` |
| 1 | `.agro/skills/cloudflared/SKILL.md` |
| 1 | `.agro/skills/git/SKILL.md` |
| 4 | `.agro/skills/harness-context/SKILL.md` |
| 4 | `.agro/skills/harness-context/references/hermes-gateway-slack.md` |
| 1 | `.agro/skills/harness-context/references/hermes-state-auth-split.md` |
| 2 | `.agro/skills/harness-context/references/shared-skills-symlink-migration.md` |
| 7 | `.agro/skills/harness-context/references/skill-source-of-truth.md` |
| 3 | `.agro/skills/herdr/SKILL.md` |
| 2 | `.agro/skills/herdr/references/command-map.md` |
| 1 | `.agro/skills/release/SKILL.md` |
| 1 | `.agro/skills/ste/references/rules.md` |
| 2 | `.agro/skills/strategic-proposal/SKILL.md` |
| 1 | `.agro/skills/t3/SKILL.md` |
| 1 | `.agro/skills/wiki/references/official-docs-research-wiki.md` |
| 1 | `.agro/skills/wiki/references/query.md` |
| 1 | `.agro/skills/wiki/references/schema.md` |
| 1 | `.codex/config.toml` |
| 1 | `.devcontainer/devcontainer.json` |
| 1 | `.devcontainer/entrypoint.sh` |
| 1 | `.example.env` |
| 1 | `.hadolint.yaml` |
| 1 | `.worktrees/AGENTS.md` |
| 5 | `AGENTS.md` |
| 1 | `CONTRIBUTING.md` |
| 1 | `README.md` |
| 2 | `SECURITY.md` |
| 1 | `docs/agro-compatibility.md` |
| 1 | `docs/artifact-contract-schema.md` |
| 1 | `docs/configuration.md` |
| 3 | `docs/contributing.md` |
| 1 | `docs/deployment-prebuilt-image.md` |
| 2 | `docs/glossary.md` |
| 2 | `docs/harness-manifest.md` |
| 1 | `docs/harnesses/claude-code.md` |
| 5 | `docs/harnesses/grok-build.md` |
| 5 | `docs/harnesses/hermes.md` |
| 7 | `docs/harnesses/muse-code.md` |
| 1 | `docs/harnesses/opencode.md` |
| 2 | `docs/harnesses/overview.md` |
| 9 | `docs/harnesses/pi.md` |
| 1 | `docs/installation.md` |
| 1 | `docs/integrations/github.md` |
| 2 | `docs/integrations/herdr.md` |
| 9 | `docs/integrations/langfuse.md` |
| 3 | `docs/integrations/pi-fff.md` |
| 1 | `docs/integrations/slack.md` |
| 5 | `docs/intro.md` |
| 1 | `docs/lifecycle-commands.md` |
| 2 | `docs/open-core.md` |
| 1 | `docs/repair-sandbox-boot-advisory.md` |
| 2 | `docs/resources.md` |
| 1 | `docs/runtimes/docker.md` |
| 9 | `docs/runtimes/microsandbox.md` |
| 4 | `docs/runtimes/overview.md` |
| 1 | `docs/security-considerations.md` |
| 1 | `projects/AGENTS.md` |

## pinned

| Hits | File |
|---|---|
| 1 | `.agro/evals/probes/agents-identity-contract.sh` |

## deferred

| Hits | File |
|---|---|
| 2 | `.agro/knowledge/source/crabbox-remote-exec-control-plane.md` |
| 4 | `.agro/knowledge/source/managed-agents.md` |
| 8 | `.agro/knowledge/source/molt-agentic-reinforcement-learning.md` |
| 1 | `.agro/knowledge/source/oh-cli-portable-lifecycle.md` |
| 1 | `.agro/knowledge/source/recursive-language-models.md` |
| 2 | `.agro/knowledge/source/runtime-isolation-landscape.md` |

## external

| Hits | File |
|---|---|
| 2 | `.agro/cli/NOTICE` |
| 2 | `.agro/cli/legacy/NOTICE` |
| 1 | `.devcontainer/openharness-bootstrap.service` |
| 1 | `.devcontainer/openharness-cron.service` |
| 9 | `.pi/install/slack-manifest.json` |
| 2 | `NOTICE` |

## compatibility

| Hits | File |
|---|---|
| 1 | `.agro/cli/src/commands/migrate.ts` |
| 1 | `.agro/cli/src/lib/migrate.ts` |
| 1 | `.agro/cli/src/lib/product.ts` |
| 4 | `.agro/scripts/get-oh.sh` |

## test-fixture

| Hits | File |
|---|---|
| 1 | `.agro/cli/src/__tests__/bundle-identity.test.ts` |
| 1 | `.agro/cli/src/__tests__/local-target.test.ts` |
| 1 | `.agro/cli/src/lib/__tests__/product.test.ts` |
| 1 | `.agro/evals/probes/builder-skill-consolidation.sh` |
| 1 | `.agro/evals/probes/cron-systemd-service.sh` |
| 2 | `.agro/evals/probes/entrypoint-pnpm-manifest-fingerprint.sh` |
| 1 | `.agro/scripts/__tests__/entrypoint-pnpm-install.test.ts` |
| 2 | `.agro/scripts/__tests__/install-prereqs.test.ts` |
| 1 | `.agro/scripts/__tests__/sandbox-healthcheck.test.ts` |
| 1 | `.agro/scripts/__tests__/standard-skills-link.test.ts` |
| 1 | `.agro/skills/audit/fixtures/artifact-contract.prd.json` |

## historical

| Hits | File |
|---|---|
| 1 | `.agro/knowledge/raw/2026-06-27-recursive-language-models.md` |
| 1 | `.agro/knowledge/raw/2026-07-17-audit-architecture.md` |
| 3 | `.agro/skills/strategic-proposal/references/open-harness-v2mom-council.md` |
| 1 | `.agro/tasks/archive/2026-09-10/agro-cli-entry/prd.json` |
| 3 | `.agro/tasks/archive/2026-09-10/agro-cloud-consumer-migration/consumer-inventory.md` |
| 2 | `.agro/tasks/archive/2026-09-10/agro-cloud-consumer-migration/local-lifecycle-evidence.md` |
| 9 | `.agro/tasks/archive/2026-09-10/agro-cloud-consumer-migration/local-lifecycle-transcript.log` |
| 1 | `.agro/tasks/archive/2026-09-10/agro-cloud-consumer-migration/prd.json` |
| 1 | `.agro/tasks/archive/2026-09-10/agro-compat-foundation/prd.json` |
| 1 | `.agro/tasks/archive/2026-09-10/agro-identity-cutover/cutover-record.md` |
| 1 | `.agro/tasks/archive/2026-09-10/agro-namespace-cutover/prd.json` |
| 1 | `.agro/tasks/archive/2026-09-10/cli-first-release/evidence/onboarding.md` |
| 1 | `.agro/tasks/archive/2026-09-10/cli-first-release/prd.json` |
| 1 | `.agro/tasks/archive/2026-09-10/compose-env-boundary/prd.json` |
| 1 | `.agro/tasks/archive/2026-09-10/hermes-child-container-layout/prd.json` |
| 1 | `.agro/tasks/archive/2026-09-10/hermes-child-container-layout/prd.md` |
| 1 | `.agro/tasks/archive/2026-09-10/muse-code/prd.json` |
| 1 | `.agro/tasks/archive/2026-09-10/repo-knowledge-loop/prd.json` |
| 1 | `.agro/tasks/cli-naming-residue-cleanup/prd.json` |
| 1 | `.agro/tasks/compose-env-path-parity/prd.json` |
| 1 | `.agro/tasks/repo-flag-checkout-rename/prd.json` |
| 1 | `.agro/tasks/retire-pi-dynamic-workflows/delegate-graph.json` |
| 1 | `.agro/tasks/retire-pi-dynamic-workflows/evidence.md` |
| 2 | `.agro/tasks/retire-pi-dynamic-workflows/prd.json` |
| 1 | `.agro/tasks/retire-pi-dynamic-workflows/prd.md` |
| 1 | `.agro/tasks/sandbox-install-mount-semantics/prd.json` |
| 1 | `.agro/tasks/supervisor-skill/evidence.md` |
| 10 | `.agro/tasks/supervisor-skill/prd.json` |
| 1 | `.agro/tasks/supervisor-skill/progress.txt` |
| 7 | `CHANGELOG.md` |
| 4 | `docs/rfcs/adr-0001-standards-scope.md` |
| 1 | `docs/rfcs/rfc-brain-hands-boundary.md` |
| 6 | `docs/rfcs/rfc-rsi-survey-mapping.md` |
| 1 | `docs/rfcs/rfc-runtime-support.md` |
| 1 | `docs/rfcs/rfc-selfimprove-roadmap.md` |

