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
token of `$ARGUMENTS` selects the operation. The remainder of `$ARGUMENTS` is the
argument string for that subcommand. This dispatcher holds the routing logic. This
dispatcher also holds the rules that all three operations share. The full procedure
for each subcommand lives in `references/`.

**Two surfaces, one owner each.** `.agro/knowledge/` owns the **data**. This skill
owns the **procedure**. No knowledge page lives under `.agro/skills/wiki/`. No
schema rule lives outside `references/schema.md`.

## Subcommands

| Subcommand | Argument form | Purpose | Reference |
|------------|---------------|---------|-----------|
| `ingest` | `<url\|path> [--slug <override>]` · `--from-draft <slug> [--allow-stale]` | Capture a source, or promote a draft into an entity page. `ingest` is the only authorized write path. | `references/ingest.md` |
| `query` | `<topic> [--patterns]` | Run a frontmatter OR-search over tracked knowledge. Read the top matches into context: 3 entity pages or fewer, 5 pattern pages or fewer. | `references/query.md` |
| `lint` | `[--dry-run]` | Run six correctness checks. Regenerate the `.agro/knowledge/README.md` index atomically. | `references/lint.md` |

## Dispatch

Parse `$ARGUMENTS`. The first whitespace-delimited token is the subcommand. The
rest of `$ARGUMENTS` is the argument string for the subcommand.

```bash
ARGUMENTS="${ARGUMENTS:-}"
SUB="${ARGUMENTS%% *}"          # first token
REST="${ARGUMENTS#"$SUB"}"      # everything after it
REST="${REST# }"               # trim one leading space
```

Route on `$SUB`. Then follow the matching reference document from start to end.
The instructions in the reference document are authoritative. This dispatcher does
not restate them.

| `$SUB` | Action |
|--------|--------|
| `ingest` | Read `references/ingest.md`. Execute the procedure with `$REST` as the argument string. |
| `query` | Read `references/query.md`. Execute the procedure with `$REST` as the `<topic>`. |
| `lint` | Read `references/lint.md`. Execute the procedure with `$REST`. The procedure accepts only `--dry-run`. |
| any other value, or an empty value | Print the usage line from `argument-hint`. Exit with code `<exit-code>`. Do not guess a subcommand. |

## Shared rules

These rules hold across all three subcommands. The reference documents assume
these rules.

- **Knowledge root**: Entity pages live at `.agro/knowledge/source/<slug>.md`.
  Pattern pages live at `.agro/knowledge/patterns/pattern-<subsystem>-<mode>.md`.
  Immutable external snapshots live at `.agro/knowledge/raw/<yyyy-mm-dd>-<slug>.md`.
  The entity-page glob and the pattern-page glob are flat. Neither glob descends
  into subdirectories.
- **Tracked by default**: Git tracks `source/`, `patterns/`, and `raw/` like all
  other repository content. Commit these directories with a plain `git add`. Do
  not use `-f` or a whitelist. `.agro/knowledge/local/` is the only ignored tier.
- **`local/` is never an input**: No query path reads `local/`. No planning flow
  reads `local/`. A page that only one machine can see must not inform a plan that
  another machine cannot reproduce. To promote a page, run `ingest`.
- **The repository outranks the knowledge base**: A page gives orientation, not
  authority. Before you rely on a material claim in a page, re-ground the claim
  against the sources that the page cites.
- **Canonical schema**: `.agro/skills/wiki/references/schema.md` owns these
  topics:
  - frontmatter fields
  - the three kinds
  - provenance forms
  - freshness
  - slug derivation
  - the word cap
  - cross-links
  - the confidence lifecycle
  - the body-merge strategy

  The reference documents and this dispatcher defer to `references/schema.md`.
  They never redefine the schema.
- **Frontmatter extraction**: Every consumer uses this canonical command without
  changes:
  ```bash
  awk '/^---$/{f=!f; next} f{print}' .agro/knowledge/source/<slug>.md
  ```
- **One freshness implementation**: `.agro/skills/wiki/scripts/knowledge-impact.sh`
  decides dependency-aware invalidation. `lint` calls the script with `--verified`.
  A build calls the script with `--changed <paths>`. No other code reimplements
  the script.
- **Orchestrator-only write gate**: Only the orchestrator runs these writes:
  - `ingest` writes, which cover snapshots and entity pages
  - pattern-page writes
  - the index regeneration in `lint`

  A sub-agent writes a draft proposal to `$TMPDIR/oh-wiki-drafts/<slug>.md`. The
  orchestrator then runs `/wiki ingest --from-draft <slug>` to promote the draft.
  If a sub-agent writes directly to `.agro/knowledge/`, the write is out of scope.
  `<actor>` can revert that write.
- **Index reflects the tracked entry set**: `lint` owns the Index table in
  `.agro/knowledge/README.md` as generated state. `lint` sorts the table by
  `updated:` in descending order. Never edit the Index table by hand.

## When NOT to use

- **Behavioral norm**: A topic such as "always do X" belongs in a rule or a skill,
  not in knowledge.
- **Session journal entry**: An entry such as "this run showed Y" belongs in the
  report for the run.
- **Recurring failure mode**: A recurring failure mode that a run revealed belongs
  in a `kind: pattern` entry. Name the entry for the failure mode, not for the run.
- **Proposal decision record**: A proposal decision record belongs in
  `.agro/evals/decisions/skill-impact.md`, not in a knowledge page.
- **Human-facing prose**: Human-facing prose belongs in `docs/`. Knowledge pages
  hold synthesis for LLM readers.
- **Full-text body search**: Use `grep` directly. `query` searches only
  frontmatter by design.

## See Also

- `.agro/skills/wiki/references/schema.md` — the canonical schema and the authoring rules
- `.agro/skills/wiki/references/ingest.md` · `query.md` · `lint.md` — the full procedures
- `.agro/skills/wiki/scripts/knowledge-impact.sh` — dependency-aware invalidation
- `.agro/knowledge/README.md` — the generated index
- `.agro/evals/decisions/skill-impact.md` — the skill-change ledger that the proposer reads
- `.agro/evals/probes/wiki-readme-index.sh` — the drift guard for the generated index
