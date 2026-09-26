---
name: wiki
description: |
  Dispatch three subcommands: ingest, query, or lint. Manage tracked knowledge; .agro/knowledge/
  owns source pages, patterns, and raw snapshots; local scratch is excluded.
  Canonical schema: .agro/skills/wiki/references/schema.md. Procedures:
  references/{ingest,query,lint}.md.
  TRIGGER when: ingest a URL, path, or draft; query the wiki before planning;
  or lint the index or review status.
argument-hint: "ingest <url|path> [--slug <override>] | ingest --from-draft <slug> [--allow-stale] | query <topic> [--patterns] | lint [--dry-run]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch
---

# Wiki

This skill is one parameterized skill over the harness knowledge base. The first
token of `$ARGUMENTS` selects the subcommand. The rest of `$ARGUMENTS` is the
argument string for that subcommand. This dispatcher holds the routing logic. This
dispatcher also holds the rules that all three subcommands share. The full
procedure for each subcommand lives in `references/`.

**Two surfaces, one owner each.** `.agro/knowledge/` owns the **data**. This skill
owns the **procedure**. No knowledge page lives under `.agro/skills/wiki/`. No
schema rule lives outside `references/schema.md`.

## Subcommands

| Subcommand | Argument form | Purpose | Reference |
|------------|---------------|---------|-----------|
| `ingest` | `<url\|path> [--slug <override>]` · `--from-draft <slug> [--allow-stale]` | Capture a source, or promote a draft into an entity page. `ingest` is the only authorized write path. | `references/ingest.md` |
| `query` | `<topic> [--patterns]` | Run an OR-search over the frontmatter of tracked knowledge. Read the top matches into context: at most 3 entity pages and at most 5 pattern pages. | `references/query.md` |
| `lint` | `[--dry-run]` | Run six correctness checks. Regenerate the `.agro/knowledge/README.md` index atomically. | `references/lint.md` |

## Dispatch

Parse `$ARGUMENTS`. The first whitespace-delimited token is the subcommand. The
rest is the argument string for that subcommand.

```bash
ARGUMENTS="${ARGUMENTS:-}"
SUB="${ARGUMENTS%% *}"          # first token
REST="${ARGUMENTS#"$SUB"}"      # everything after it
REST="${REST# }"               # trim one leading space
```

1. Route on `$SUB` with the table below.
2. Follow the matching reference document from start to end. The reference
   document is authoritative. This dispatcher does not restate its instructions.

| `$SUB` | Action |
|--------|--------|
| `ingest` | Read `references/ingest.md`. Execute that procedure with `$REST` as its argument string. |
| `query` | Read `references/query.md`. Execute that procedure with `$REST` as the `<topic>`. |
| `lint` | Read `references/lint.md`. Execute that procedure with `$REST`. The procedure recognizes only `--dry-run`. |
| any other value, including an empty value | Print the usage line from `argument-hint`. Exit with code `<exit-code>`. Do not guess a subcommand. |

## Shared rules

These rules hold for all three subcommands. The reference documents assume these
rules.

- **Knowledge root**: Entity pages live at `.agro/knowledge/source/<slug>.md`.
  Pattern pages live at `.agro/knowledge/patterns/pattern-<subsystem>-<mode>.md`.
  Immutable external snapshots live at `.agro/knowledge/raw/<yyyy-mm-dd>-<slug>.md`.
  The entity glob and the pattern glob are flat. Neither glob descends into
  subdirectories.
- **Tracked by default**: Commit `source/`, `patterns/`, and `raw/` like other
  repository content. Use a plain `git add`, with no `-f` and no whitelist.
  `.agro/knowledge/local/` is the only ignored tier.
- **`local/` is never an input**: No query path reads `local/`. No planning flow
  reads `local/`. A page that one machine can see must not inform a plan that
  another machine cannot reproduce. To promote a page, run `ingest`.
- **The repository outranks the knowledge base**: A page gives orientation, not
  authority. Before you rely on a material claim, check the claim again against
  the sources that the page cites.
- **Canonical schema**: `.agro/skills/wiki/references/schema.md` owns these
  items: frontmatter fields, the three kinds, provenance forms, freshness, slug
  derivation, the word cap, cross-links, the confidence lifecycle, and the
  body-merge strategy. The reference documents and this dispatcher defer to
  `references/schema.md`. They never redefine these items.
- **Frontmatter extraction**: Every consumer uses this canonical command:
  ```bash
  awk '/^---$/{f=!f; next} f{print}' .agro/knowledge/source/<slug>.md
  ```
- **One freshness implementation**: `.agro/skills/wiki/scripts/knowledge-impact.sh`
  decides dependency-aware invalidation. `lint` calls the script with
  `--verified`. A build calls the script with `--changed <paths>`. No other code
  reimplements the script.
- **Orchestrator-only write gate**: Only the orchestrator performs these writes:
  - `ingest` writes, which cover snapshots and entity pages
  - pattern-page writes
  - the index regeneration that `lint` performs

  A sub-agent writes a proposed draft to `$TMPDIR/oh-wiki-drafts/<slug>.md`. The
  orchestrator promotes the draft with `/wiki ingest --from-draft <slug>`. A
  direct write from a sub-agent to `.agro/knowledge/` is out of scope. The
  `<actor>` can revert that write.
- **Index reflects the tracked entry set**: `lint` owns the Index table in
  `.agro/knowledge/README.md` as generated state. `lint` sorts the table by
  `updated:` in descending order. Never edit the table by hand.

## When NOT to use

- A topic that states a **behavioral norm** ("always do X") belongs in a rule
  or a skill, not in knowledge.
- A **session journal** entry ("this run showed Y") belongs in the report for
  that run. A *recurring failure mode* that a run revealed is different. That
  failure mode belongs in a `kind: pattern` entry. Name the entry for the
  failure mode, not for the run.
- A **proposal decision record** belongs in
  `.agro/evals/decisions/skill-impact.md`, not in a knowledge page.
- **Human-facing prose** belongs in `docs/`. Knowledge pages hold synthesis that
  an LLM reads.
- For a full-text body search, run `grep` directly. `query` searches only the
  frontmatter, by design.

## See Also

- `.agro/skills/wiki/references/schema.md` — the canonical schema and authoring rules
- `.agro/skills/wiki/references/ingest.md` · `query.md` · `lint.md` — the full procedures
- `.agro/skills/wiki/scripts/knowledge-impact.sh` — dependency-aware invalidation
- `.agro/knowledge/README.md` — the generated index
- `.agro/evals/decisions/skill-impact.md` — the skill-change ledger that the proposer reads
- `.agro/evals/probes/wiki-readme-index.sh` — the drift guard for the generated index
