---
name: wiki
description: |
  Dispatch one of three subcommands: ingest, query, or lint. This skill manages
  tracked knowledge. .agro/knowledge/ owns source pages, patterns, and raw
  snapshots. .agro/knowledge/local/ holds excluded local scratch.
  The canonical schema lives in .agro/skills/wiki/references/schema.md. The
  procedures live in references/ingest.md, references/query.md, and
  references/lint.md.
  TRIGGER when: the user asks to ingest a URL, a path, or a draft; the user asks
  to query the wiki before planning; or the user asks to lint the index or
  review its status.
argument-hint: "ingest <url|path> [--slug <override>] | ingest --from-draft <slug> [--allow-stale] | query <topic> [--patterns] | lint [--dry-run]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebFetch
---

# Wiki

This skill dispatches one parameterized command over the harness knowledge base.
The first token of `$ARGUMENTS` selects the operation. The remainder of
`$ARGUMENTS` is that subcommand's argument string. This dispatcher holds the
routing logic and the rules shared by all three operations. The full procedure
for each subcommand lives in `references/`.

**Two surfaces, one owner each.** `.agro/knowledge/` owns the **data**. This
skill owns the **procedure**. No knowledge page lives under
`.agro/skills/wiki/`. No schema rule lives outside `references/schema.md`.

## Subcommands

| Subcommand | Argument form | Purpose | Reference |
|------------|---------------|---------|-----------|
| `ingest` | `<url\|path> [--slug <override>]` · `--from-draft <slug> [--allow-stale]` | Capture a source or promote a draft into an entity page (the only authorized write path) | `references/ingest.md` |
| `query` | `<topic> [--patterns]` | Frontmatter OR-search over tracked knowledge; read the top matches into context (≤3 entity, ≤5 pattern) | `references/query.md` |
| `lint` | `[--dry-run]` | Six correctness checks + atomic `.agro/knowledge/README.md` index regeneration | `references/lint.md` |

## Dispatch

Parse `$ARGUMENTS`. The first whitespace-delimited token is the subcommand.
The rest of `$ARGUMENTS` is the subcommand's argument string.

```bash
ARGUMENTS="${ARGUMENTS:-}"
SUB="${ARGUMENTS%% *}"          # first token
REST="${ARGUMENTS#"$SUB"}"      # everything after it
REST="${REST# }"               # trim one leading space
```

Route on `$SUB`. Then read the matching reference document to its end and
follow it. Its instructions are authoritative; this dispatcher does not repeat
them:

| `$SUB` | Action |
|--------|--------|
| `ingest` | Read `references/ingest.md`. Execute it with `$REST` as its argument string. |
| `query` | Read `references/query.md`. Execute it with `$REST` as the `<topic>`. |
| `lint` | Read `references/lint.md`. Execute it with `$REST`. `lint` recognizes only `--dry-run`. |
| any other value, or an empty `$SUB` | Print the usage line from `argument-hint`, then exit with `<exit code>`. Do not guess a subcommand. |

## Shared rules

These rules hold across all three subcommands. The reference docs assume them.

- **Knowledge root**: entity pages live at `.agro/knowledge/source/<slug>.md`.
  Pattern pages live at
  `.agro/knowledge/patterns/pattern-<subsystem>-<mode>.md`. Immutable external
  snapshots live at `.agro/knowledge/raw/<yyyy-mm-dd>-<slug>.md`. The
  `source/` and `patterns/` globs are flat; neither descends into
  subdirectories.
- **Tracked by default**: `source/`, `patterns/`, and `raw/` are tracked like
  any other repository content. Commit them with a plain `git add`: no `-f`
  flag, no whitelist. `.agro/knowledge/local/` is the only ignored tier.
- **`local/` is never an input**: no query path reads `.agro/knowledge/local/`,
  and no planning flow reads it. A page visible on one machine must not inform
  a plan that another machine cannot reproduce. To promote a local page, run
  `ingest`.
- **The repository outranks the knowledge base**: a page is orientation, not
  authority. Before you rely on a material claim in a knowledge page, re-ground
  that claim against the sources the page cites.
- **Canonical schema**: the canonical schema lives in
  `.agro/skills/wiki/references/schema.md`. It defines frontmatter fields, the
  three kinds, provenance forms, freshness, slug derivation, the word cap,
  cross-links, the confidence lifecycle, and the body-merge strategy. The
  reference docs and this dispatcher defer to that schema; neither redefines
  it.
- **Frontmatter extraction**: every consumer uses this canonical command:
  ```bash
  awk '/^---$/{f=!f; next} f{print}' .agro/knowledge/source/<slug>.md
  ```
- **One freshness implementation**: `.agro/skills/wiki/scripts/knowledge-impact.sh`
  decides dependency-aware invalidation. `lint` calls it with `--verified`. A
  build calls it with `--changed <paths>`. Nothing else reimplements it.
- **Orchestrator-only write gate**: only the orchestrator writes. `ingest`
  writes (snapshots and entity pages), pattern-page writes, and `lint`'s index
  regeneration are all orchestrator-only actions. A sub-agent proposes a draft
  at `$TMPDIR/oh-wiki-drafts/<slug>.md`. The orchestrator promotes that draft
  by running `/wiki ingest --from-draft <slug>`. A sub-agent that writes
  directly to `.agro/knowledge/` acts out of scope; the orchestrator may
  revert that write.
- **Index reflects the tracked entry set**: `lint` generates the Index table
  in `.agro/knowledge/README.md` and sorts it by `updated:` in descending
  order. Do not hand-edit the Index table.

## When NOT to use

- A topic that states a **behavioral norm** (for example, "always do X")
  belongs in a rule or skill, not in knowledge.
- A **session journal** entry (for example, "this run showed Y") belongs in
  the run's report. A *recurring failure mode* that the run reveals is
  different: record it as a `kind: pattern` entry, named for the failure
  mode, not for the run.
- A **proposal decision record** belongs in
  `.agro/evals/decisions/skill-impact.md`, not in a knowledge page.
- **Human-facing prose** belongs in `docs/`. Knowledge pages hold
  LLM-readable synthesis, not human-facing prose.
- For a full-text body search, run `grep` directly. `query` searches
  frontmatter only, by design.

## See Also

- `.agro/skills/wiki/references/schema.md` — canonical schema and authoring rules
- `.agro/skills/wiki/references/ingest.md` · `query.md` · `lint.md` — full procedures
- `.agro/skills/wiki/scripts/knowledge-impact.sh` — dependency-aware invalidation
- `.agro/knowledge/README.md` — the generated index
- `.agro/evals/decisions/skill-impact.md` — the skill-change ledger the proposer reads
- `.agro/evals/probes/wiki-readme-index.sh` — drift guard for the generated index
