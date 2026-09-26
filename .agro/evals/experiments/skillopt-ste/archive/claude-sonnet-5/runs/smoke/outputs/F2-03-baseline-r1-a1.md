---
name: wiki
description: |
  Dispatch three subcommands: ingest, query, or lint. This skill manages tracked
  knowledge. .agro/knowledge/ owns source pages, patterns, and raw snapshots.
  Local scratch is excluded. Canonical schema: .agro/skills/wiki/references/schema.md.
  Procedures: references/{ingest,query,lint}.md.
  TRIGGER when: the user asks to ingest a URL, a path, or a draft. TRIGGER when:
  the user asks to query the wiki before planning. TRIGGER when: the user asks
  to lint the index or review status.
argument-hint: "ingest <url|path> [--slug <override>] | ingest --from-draft <slug> [--allow-stale] | query <topic> [--patterns] | lint [--dry-run]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch
---

# Wiki

The `wiki` skill dispatches three subcommands over the harness knowledge base.
The first token of `$ARGUMENTS` names the subcommand. The remaining tokens form
that subcommand's argument string. This dispatcher holds the routing logic and
the rules shared by all three subcommands. Each subcommand's full procedure
lives in `references/`.

**Two surfaces, one owner each.** `.agro/knowledge/` owns the **data**. The
`wiki` skill owns the **procedure**. No knowledge page lives under
`.agro/skills/wiki/`. No schema rule lives outside `references/schema.md`.

## Subcommands

| Subcommand | Argument form | Purpose | Reference |
|------------|---------------|---------|-----------|
| `ingest` | `<url\|path> [--slug <override>]` · `--from-draft <slug> [--allow-stale]` | Capture a source or promote a draft into an entity page (the only authorized write path) | `references/ingest.md` |
| `query` | `<topic> [--patterns]` | Frontmatter OR-search over tracked knowledge; read the top matches into context (≤3 entity, ≤5 pattern) | `references/query.md` |
| `lint` | `[--dry-run]` | Six correctness checks + atomic `.agro/knowledge/README.md` index regeneration | `references/lint.md` |

## Dispatch

Parse `$ARGUMENTS`. The first whitespace-delimited token is the subcommand. The
remaining tokens form the subcommand's argument string.

```bash
ARGUMENTS="${ARGUMENTS:-}"
SUB="${ARGUMENTS%% *}"          # first token
REST="${ARGUMENTS#"$SUB"}"      # everything after it
REST="${REST# }"               # trim one leading space
```

Route on `$SUB`. Follow the matching reference document end-to-end. Its
instructions are authoritative. This dispatcher does not restate them:

| `$SUB` | Action |
|--------|--------|
| `ingest` | Read `references/ingest.md`. Execute it with `$REST` as its argument string. |
| `query` | Read `references/query.md`. Execute it with `$REST` as the `<topic>`. |
| `lint` | Read `references/lint.md`. Execute it with `$REST`. `lint` recognizes only `--dry-run`. |
| any other value of `$SUB`, including an empty value | Print the usage line from `argument-hint`. Exit with `<exit code>`. Do not guess a subcommand. |

## Shared rules

The following rules hold across all three subcommands. The reference docs
assume these rules.

- **Knowledge root**: an entity page lives at `.agro/knowledge/source/<slug>.md`.
  A pattern page lives at `.agro/knowledge/patterns/pattern-<subsystem>-<mode>.md`.
  An immutable external snapshot lives at
  `.agro/knowledge/raw/<yyyy-mm-dd>-<slug>.md`. Both entry globs stay flat;
  neither glob descends into subdirectories.
- **Tracked by default**: the repository tracks `source/`, `patterns/`, and
  `raw/` like any other content, through a plain `git add` with no `-f` flag
  and no whitelist entry. `.agro/knowledge/local/` is the only ignored tier.
- **`local/` is never an input**: no query path and no planning flow reads
  `local/`. A page visible on one machine must not inform a plan that another
  machine cannot reproduce. Only `ingest` promotes local content into a
  tracked page.
- **The repository outranks the knowledge base**: a knowledge page provides
  orientation, not authority. Before relying on a claim in a page, re-ground
  the claim against the sources the page cites.
- **Canonical schema**: `.agro/skills/wiki/references/schema.md` defines the
  frontmatter fields, the three kinds, the provenance forms, the freshness
  rule, slug derivation, the word cap, cross-links, the confidence lifecycle,
  and the body-merge strategy. The reference docs and this dispatcher defer to
  that file. Neither redefines the schema.
- **Frontmatter extraction** (canonical): every consumer uses this method
  identically.
  ```bash
  awk '/^---$/{f=!f; next} f{print}' .agro/knowledge/source/<slug>.md
  ```
- **One freshness implementation**: `.agro/skills/wiki/scripts/knowledge-impact.sh`
  decides dependency-aware invalidation. `lint` calls this script with
  `--verified`. A build calls this script with `--changed <paths>`. No other
  code reimplements this script.
- **Orchestrator-only write gate**: only the orchestrator performs `ingest`
  writes (snapshots and entity pages), pattern-page writes, and `lint`'s index
  regeneration. A sub-agent proposes a draft to
  `$TMPDIR/oh-wiki-drafts/<slug>.md`. The orchestrator promotes that draft with
  `/wiki ingest --from-draft <slug>`. A sub-agent must not write directly to
  `.agro/knowledge/`; the orchestrator reverts such a write.
- **Index reflects the tracked entry set**: `lint` generates the Index table
  in `.agro/knowledge/README.md`, sorted by `updated:` descending. `lint` owns
  this table. Never hand-edit the Index table.

## When NOT to use

- A topic that is a **behavioral norm** ("always do X") → a rule/skill, not
  knowledge.
- A **session journal** entry ("this run showed Y") → the run's report.
- A recurring failure mode that a run reveals is different: record it as a
  `kind: pattern` entry, named for the failure mode, not for the run.
- A **proposal decision record** → `.agro/evals/decisions/skill-impact.md`,
  not a knowledge page.
- **Human-facing prose** → `docs/` (knowledge pages are LLM-readable
  synthesis).
- Full-text body search → direct `grep`.
- `query` searches frontmatter only, by design.

## See Also

- `.agro/skills/wiki/references/schema.md` — canonical schema and authoring rules
- `.agro/skills/wiki/references/ingest.md` · `query.md` · `lint.md` — full procedures
- `.agro/skills/wiki/scripts/knowledge-impact.sh` — dependency-aware invalidation
- `.agro/knowledge/README.md` — the generated index
- `.agro/evals/decisions/skill-impact.md` — the skill-change ledger the proposer reads
- `.agro/evals/probes/wiki-readme-index.sh` — drift guard for the generated index
