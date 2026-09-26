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

This skill dispatches three subcommands over the harness knowledge base. The
first token of `$ARGUMENTS` selects the subcommand. The rest of `$ARGUMENTS` is
that subcommand's argument string. This dispatcher holds the routing logic and
the rules shared by all three subcommands. The full procedure for each
subcommand lives in `references/`.

**Two surfaces, one owner each.** `.agro/knowledge/` owns the **data**; this
skill owns the **procedure**. No knowledge page lives under
`.agro/skills/wiki/`. No schema rule lives anywhere but `references/schema.md`.

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

Route on `$SUB`. Follow the matching reference document end to end. Its
instructions are authoritative; this dispatcher does not restate them.

| `$SUB` | Action |
|--------|--------|
| `ingest` | Read `references/ingest.md`. Execute it with `$REST` as its argument string. |
| `query` | Read `references/query.md`. Execute it with `$REST` as the `<topic>`. |
| `lint` | Read `references/lint.md`. Execute it with `$REST`. `lint` recognizes only `--dry-run`. |
| an unrecognized or empty `$SUB` | Print the usage line from `argument-hint`. Exit 1. Do not guess a subcommand. |

## Shared rules

These hold across all three subcommands; the reference docs assume them.

- **Knowledge root**: entity pages live at `.agro/knowledge/source/<slug>.md`.
  Pattern pages live at `.agro/knowledge/patterns/pattern-<subsystem>-<mode>.md`.
  Immutable external snapshots live at
  `.agro/knowledge/raw/<yyyy-mm-dd>-<slug>.md`. Both entry globs are flat;
  neither descends into subdirectories.
- **Tracked by default**: the orchestrator commits `source/`, `patterns/`, and
  `raw/` like any other repository content: a plain `git add`, no `-f`, no
  whitelist. `.agro/knowledge/local/` is the only ignored tier.
- **`local/` is never an input**: no query path reads it, and no planning flow
  reads it. A page visible on one machine must not inform a plan that another
  machine cannot reproduce. Promotion of a `local/` page goes through
  `ingest`.
- **The repository outranks the knowledge base**: a page is orientation, not
  authority. An agent must re-ground each material claim against the sources
  a page cites before it relies on the page.
- **Canonical schema**: frontmatter fields, the three kinds, provenance forms,
  freshness, slug derivation, the word cap, cross-links, the confidence
  lifecycle, and the body-merge strategy all live in
  `.agro/skills/wiki/references/schema.md`. The reference docs and this
  dispatcher defer to `references/schema.md`. Neither redefines it.
- **Frontmatter extraction** (canonical, used identically by every consumer):
  ```bash
  awk '/^---$/{f=!f; next} f{print}' .agro/knowledge/source/<slug>.md
  ```
- **One freshness implementation**: `.agro/skills/wiki/scripts/knowledge-impact.sh`
  decides dependency-aware invalidation. `lint` calls it with `--verified`. A
  build calls it with `--changed <paths>`. No procedure reimplements it.
- **Orchestrator-only write gate**: only the orchestrator writes: `ingest`'s
  writes (snapshots and entity pages), pattern-page writes, and `lint`'s index
  regeneration. A sub-agent proposes a draft at
  `$TMPDIR/oh-wiki-drafts/<slug>.md`. The orchestrator promotes the draft with
  `/wiki ingest --from-draft <slug>`. A sub-agent that writes directly to
  `.agro/knowledge/` acts out of scope; the orchestrator can revert that
  write.
- **Index reflects the tracked entry set**: `lint` owns
  `.agro/knowledge/README.md`'s Index table as generated state, sorted by
  `updated:` descending. Never hand-edit the Index table.

## When NOT to use

- A topic that states a **behavioral norm** (for example, "always do X")
  belongs in a rule or a skill, not in a knowledge page.
- A **session journal** entry (a run report stating "this run showed Y")
  belongs in the run's report, not in a knowledge page. A recurring failure
  mode that a run reveals differs: name a `kind: pattern` entry for the
  failure mode, not for the run.
- A **proposal decision record** belongs in
  `.agro/evals/decisions/skill-impact.md`, not in a knowledge page.
- **Human-facing prose** belongs in `docs/` (knowledge pages are
  LLM-readable synthesis, not human-facing prose).
- A **full-text body search** uses direct `grep`; `query` is intentionally
  frontmatter-only.

## See Also

- `.agro/skills/wiki/references/schema.md` — canonical schema and authoring rules
- `.agro/skills/wiki/references/ingest.md` · `query.md` · `lint.md` — full procedures
- `.agro/skills/wiki/scripts/knowledge-impact.sh` — dependency-aware invalidation
- `.agro/knowledge/README.md` — the generated index
- `.agro/evals/decisions/skill-impact.md` — the skill-change ledger the proposer reads
- `.agro/evals/probes/wiki-readme-index.sh` — drift guard for the generated index
