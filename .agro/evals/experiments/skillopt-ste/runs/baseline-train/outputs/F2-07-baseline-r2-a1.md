# `.agro/knowledge/` — durable repository knowledge

This directory holds derived repository knowledge. The `/wiki query` command reads
this knowledge on demand. The [local contract](AGENTS.md) defines source precedence,
provenance, index protection, and the tracked/local boundary. The
[wiki skill](../skills/wiki/SKILL.md) owns the procedures. The
[wiki schema](../skills/wiki/references/schema.md) owns the entry formats.

| Directory | Contents |
| --- | --- |
| `source/` | Tracked repository and external-topic synthesis. |
| `patterns/` | Tracked failure modes and observed strategies. The `--patterns` flag selects these entries. |
| `raw/` | Tracked immutable external captures. |
| `local/` | Ignored per-machine scratch. Default queries exclude this directory. |

## Index

| Slug | Title | Tags | Updated |
| --- | --- | --- | --- |
| sandbox-dependency-installs | Sandbox Dependency Installs | [sandbox, devcontainer, pnpm, dependencies, boot] | 2026-09-22 |
| pattern-wiki-undeclared-body-citation | A path cited in a page body but absent from sources: is invisible to the impact graph | [wiki, knowledge, freshness, sources, citations, impact-graph] | 2026-09-22 |
| pattern-evals-exemption-list-unearned | An exemption list entry that asserts nothing is a free pass for every later entry | [evals, probes, allowlist, exemption, goodhart, boundary, oracles] | 2026-09-22 |
| pattern-delegate-reasoned-reported-as-executed | Worker reports without an executed-versus-reasoned split read as uniformly confident | [delegate, workers, evidence, acceptance, verification, honesty] | 2026-09-22 |
| agro-cli-portable-lifecycle | AGRO CLI Portable Lifecycle | [cli, agro, lifecycle, standalone, registry, sandbox, workspace, host-install, remote-fetch, execution-target, update, self-upgrade, npm, install-kind, recovery] | 2026-09-22 |
| recursive-language-models | Recursive Language Models | [rlm, context-as-environment, weighted-trajectories, agent-harness, llm-agents, self-consistency, retired-experiment] | 2026-09-21 |
| compose-env-boundary | Compose Environment Boundary | [compose, devcontainer, oh-json, cli, entrypoint, boundary, installs, sandbox, registry, tracing, langfuse, secrets] | 2026-09-21 |
| pattern-wiki-verified-at-advanced-over-unread-citations | Advancing verified_at after re-reading only the citations you added launders staleness into freshness | [wiki, knowledge, verified-at, citation-rot, freshness, line-numbers, provenance] | 2026-09-19 |
| pattern-spec-procedure-executed-from-summary | A procedure executed from a subagent's summary loses every gate the summary compressed away | [spec, execute, subagents, orientation, gates, context-budget, delegate] | 2026-09-19 |
| pattern-evals-document-conformance-proxy-oracle | A probe that greps the rule text cannot detect an executor disobeying the rule | [evals, probes, oracle-design, proxy-measure, behavior, recurrence, spec] | 2026-09-19 |
| pattern-audit-gate-unrunnable-reads-as-defect | A gate that cannot run in the operator's environment is indistinguishable from a gate that failed | [audit, gh, version-skew, fail-closed, diagnosis, verification-environment] | 2026-09-19 |
| fresh-machine-setup | Fresh-Machine Setup Flow | [setup, onboarding, installation, agro, registry, workspace, host-install, gateway, ssh, github, slack] | 2026-09-19 |
| release-versioning | Release Versioning | [release, versioning, semver, calver, github-actions, ghcr, tags, workflow, package-json, agro, npm, repository-dispatch, docs-site] | 2026-09-09 |
| pattern-wiki-frontmatter-edit-without-reindex | A frontmatter edit without a reindex leaves the generated index stale while the freshness probe stays green | [wiki, knowledge, evals, probes, index, ci] | 2026-09-08 |
| pattern-evals-tracked-only-scan-misses-uncommitted | A repository scan over git ls-files passes while files stay uncommitted and fails after a commit adds the files | [evals, testing, git, inventory, ci, false-pass] | 2026-09-08 |
| agro-web-pipeline | AGRO Web Pipeline | [docs-site, agro-web, pages, repository-dispatch, mirror, installers, cloudflare, identity, release] | 2026-09-08 |
| plan-vs-built-reconciliation | Plan-vs-Built Reconciliation | [spec-execute, evidence, merge-gate, comprehension, audit, task-folder, review] | 2026-09-07 |
| pattern-rename-sweep-collapses-block-scalar-indent | A tree-wide path sweep can re-indent one line inside a YAML block scalar and invalidate the workflow | [rename, yaml, workflows, github-actions, sweep, sed, perl, startup-failure, diff-review] | 2026-09-07 |
| pattern-evals-probe-failure-path-untested | A probe's failure branch stays unexecuted until a fault injection reaches the branch | [evals, probes, fault-injection, false-pass, exit-code, anchors] | 2026-09-07 |
| pattern-evals-inherited-environment-diagnosis | An inherited environment label on a red probe outlives the environment and hides real defects | [evals, probes, environment, path, diagnosis, evidence, delegation, false-attribution] | 2026-09-07 |
| pattern-delegate-ledger-stale-at-acceptance | A run ledger written at dispatch and not updated at acceptance is itself the duplicate-worker hazard | [delegate, resume, ledger, duplicate-worker, acceptance, evidence] | 2026-09-07 |
| managed-agents | Scaling Managed Agents: Decoupling the brain from the hands | [agents, meta-harness, sessions, sandbox, resilience, security, scaling, anthropic, model-evolution] | 2026-09-07 |
| document-ingestion | Local Document Ingestion | [wiki, ingestion, markitdown, documents, provenance, security] | 2026-09-07 |
| audit-architecture | Audit Architecture | [audit, pr, workflow, safety, observability] | 2026-09-07 |
| pattern-scripts-sibling-dependency-standalone-copies | A script that gains a sourced sibling breaks every test and probe that copies it alone | [scripts, compose, testing, probes, bundling, registry, boot] | 2026-09-06 |
| pattern-evals-product-name-literal-pinning | Probes and tests that pin the product name beside a verb break after a rename or a templated executable name | [evals, probes, cli, docs, rename, false-failure] | 2026-09-06 |
| pattern-evals-negation-must-govern-token | A sentence-wide negation filter lets a forbidden routing target through | [evals, probes, negation, oracle-design] | 2026-09-06 |
| pattern-evals-environment-parity-false-delta | An eval run from a shell with a different PATH reports environment gaps as probe regressions | [evals, probes, environment, path, python, false-regression, worktree] | 2026-09-06 |
| pattern-delegate-worker-terminated-before-report | A delegated worker that dies after implementing but before verifying leaves complete files with no evidence | [delegate, spec, workers, rate-limit, verification, evidence] | 2026-09-06 |
| pattern-delegate-builtin-type-carries-own-model | A provider built-in worker type carries its own model; omitting `model` does not inherit | [delegate, model-policy, observation, subagents] | 2026-09-06 |
| pattern-audit-driver-tool-allowlist | A non-interactive audit driver without a tool allowlist reports every gate as unobtainable | [audit, spec, claude-p, permissions, allowlist, false-failure, verification-environment] | 2026-09-06 |
| pattern-evals-unexercised-oracle | A probe with no recorded failure has an unverified oracle | [evals, probes, oracles, skipped, fault-injection, continual-learning] | 2026-09-05 |
| pattern-spec-stubbed-runner-state-gap | Unit tests with a stubbed runner cannot see state a verb fails to persist | [spec, cli, testing, evidence, rehearsal, persistence] | 2026-09-03 |
| pattern-spec-simplify-round-seeded-non-reducing | A simplify round seeded with the audit's own measurement is non-reducing by construction | [spec, audit, simplify, netAdded, bookkeeping, monotone-stop] | 2026-09-03 |
| pattern-evals-probe-brief-under-enumeration | A probe brief derived from a name grep misses the probes that pin behaviour | [evals, probes, spec, delegate, blast-radius, briefing] | 2026-09-03 |
| pattern-cli-bundled-asset-relative-import | Bundling repository files by relative import breaks the build site that stages the package alone | [cli, esbuild, dockerfile, ci, bundling, build-context] | 2026-09-03 |
| pattern-audit-remote-head-verdict | The implementation audit's promotable gate classifies the pushed head, not the audited tree | [audit, spec, promotable, head-mismatch, ci, gh] | 2026-09-03 |
| pattern-spec-self-staling-reuse-record | A commit of a commit-keyed reuse record makes the record stale | [spec, evals, caching, provenance, freshness, build-cycle] | 2026-09-02 |
| pattern-evals-prose-literal-pinning | Contract probes that pin multi-word prose break on reflow, not on drift | [evals, probes, contract-text, grep, false-failure, documentation] | 2026-09-02 |
| wikiskill-experience-compilation | WikiSkill: Compiling Agent Experience into Persistent Knowledge (arXiv <arxiv-id>) | [skill-evolution, persistent-knowledge, continual-learning, harness-evolution, self-improvement, wiki, ablation, skill-transfer] | 2026-09-01 |
| pattern-wiki-ungated-check-drift | A report-only check with no dependent gate stops running | [wiki, lint, evals, probes, report-only, drift, gating] | 2026-09-01 |
| pattern-wiki-external-model-over-mapping | Mapping an external model onto the harness reimports a tier it deleted | [wiki, ingest, architecture, external-sources, scope-creep, design-review] | 2026-09-01 |
| pattern-evals-pipefail-early-exit | A short-circuiting reader turns a successful match into a failed pipeline | [evals, probes, bash, pipefail, sigpipe, false-failure, shell] | 2026-09-01 |
| pattern-docs-prohibition-by-example | Documenting a forbidden literal by quoting it violates the rule | [docs, evals, probes, vocabulary, guards, self-reference] | 2026-09-01 |
| recursive-self-improvement-survey | Recursive Self-Improvement in AI (survey, arXiv 2607.07663) | [rsi, self-improvement, verification-hierarchy, skill-libraries, harness-evolution, self-evaluation, model-collapse, capability-benchmark] | 2026-08-31 |
| runtime-isolation-landscape | Runtime Isolation Landscape (2026) | [runtime, isolation, sandbox, gvisor, firecracker, kata, microvm, cloudflare, e2b, daytona, fly, modal] | 2026-08-27 |
| molt-agentic-reinforcement-learning | Molt: A Scalable PyTorch-Native Training Framework for Agentic Reinforcement Learning | [agentic-rl, training, readability, observability, trajectories, async, correctness, agent-harness, nvidia] | 2026-08-27 |
| crabbox-remote-exec-control-plane | Crabbox — Remote-Exec Control Plane | [runtime, sandbox, remote-execution, fan-out, control-plane, crabbox, cloudflare-workers, ssh, rsync] | 2026-08-27 |
