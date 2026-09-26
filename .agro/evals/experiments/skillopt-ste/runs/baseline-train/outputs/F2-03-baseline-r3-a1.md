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

This skill dispatches one parameterized command over the harness knowledge
base. The first token of `$ARGUMENTS` selects the subcommand. The remaining
tokens form that subcommand's argument string. This dispatcher holds the
routing logic and the rules shared across the three subcommands. Each
subcommand's full procedure lives in `references/`.

**Two surfaces, one owner each.** `.agro/knowledge/` owns the data. This skill
owns the procedure. No knowledge page lives under `.agro/skills/wiki/`. No
schema rule lives outside `references/schema.md`.

## Subcommands

| Subcommand | Argument form | Purpose | Reference |
|------------|---------------|---------|-----------|
| `ingest` | `<url\|path> [--slug <override>]` · `--from-draft <slug> [--allow-stale]` | Capture a source or promote a draft into an entity page. `ingest` is the only authorized write path. | `references/ingest.md` |
| `query` | `<topic> [--patterns]` | Search frontmatter across tracked knowledge with OR logic, then load the top matches into context (≤3 entity, ≤5 pattern). | `references/query.md` |
| `lint` | `[--dry-run]` | Run six correctness checks, then atomically regenerate the `.agro/knowledge/README.md` index. | `references/lint.md` |

## Dispatch

Parse `$ARGUMENTS`. The first whitespace-delimited token is the subcommand.
The remaining text is that subcommand's argument string.

```bash
ARGUMENTS="${ARGUMENTS:-}"
SUB="${ARGUMENTS%% *}"          # first token
REST="${ARGUMENTS#"$SUB"}"      # everything after it
REST="${REST# }"               # trim one leading space
```

Route on `$SUB`, then follow the matching reference document from beginning to
end. That document's instructions are authoritative; this dispatcher does not
restate them. The table below lists the action for each value of `$SUB`.

| `$SUB` | Action |
|--------|--------|
| `ingest` | Read `references/ingest.md`. Execute it with `$REST` as its argument string. |
| `query` | Read `references/query.md`. Execute it with `$REST` as the `<topic>`. |
| `lint` | Read `references/lint.md`. Execute it with `$REST`. `lint` recognizes only `--dry-run`. |
| any other value of `$SUB` (including empty) | Print the usage line from `argument-hint`. Exit with `<exit code>`. Do not guess a subcommand. |

OPEN: name the exit code for an unmatched or empty `$SUB`. Owner: this
skill's maintainer, in `SKILL.md`.

## Shared rules

These rules hold across all three subcommands. The reference docs assume them.

- **Knowledge root**: an entity page lives at `.agro/knowledge/source/<slug>.md`.
  A pattern page lives at `.agro/knowledge/patterns/pattern-<subsystem>-<mode>.md`.
  An immutable external snapshot lives at
  `.agro/knowledge/raw/<yyyy-mm-dd>-<slug>.md`. The `source/` glob and the
  `patterns/` glob are both flat; neither one descends into subdirectories.
- **Tracked by default**: the operator commits `source/`, `patterns/`, and
  `raw/` like any other repository content, with a plain `git add`, no `-f`
  flag, and no whitelist. `.agro/knowledge/local/` is the only ignored tier.
- **`local/` is never an input**: no query path and no planning flow reads
  `.agro/knowledge/local/`. A page visible on one machine must not inform a
  plan that another machine cannot reproduce. The `ingest` subcommand handles
  promotion out of `local/`.
- **The repository outranks the knowledge base**: a knowledge page is
  orientation, not authority. Before you rely on a material claim from a
  page, re-ground the claim against the sources that page cites.
- **Canonical schema**: frontmatter fields, the three kinds, provenance forms,
  freshness, slug derivation, the word cap, cross-links, the confidence
  lifecycle, and the body-merge strategy all live in
  `.agro/skills/wiki/references/schema.md`. The reference docs and this
  dispatcher defer to that file. Neither one redefines the schema.
- **Frontmatter extraction**: every consumer uses this canonical command:
  ```bash
  awk '/^---$/{f=!f; next} f{print}' .agro/knowledge/source/<slug>.md
  ```
- **One freshness implementation**: `.agro/skills/wiki/scripts/knowledge-impact.sh`
  decides dependency-aware invalidation. `lint` calls the script with
  `--verified`. A build calls the script with `--changed <paths>`. No other
  code reimplements this logic.
- **Orchestrator-only write gate**: only the orchestrator writes snapshots,
  entity pages, and pattern pages, and only the orchestrator runs `lint`'s
  index regeneration. A sub-agent proposes a draft at
  `$TMPDIR/oh-wiki-drafts/<slug>.md`. The orchestrator promotes that draft
  with `/wiki ingest --from-draft <slug>`. A sub-agent that writes directly to
  `.agro/knowledge/` acts out of scope; the orchestrator may revert that
  write.
- **Index reflects the tracked entry set**: the `lint` subcommand generates
  the Index table in `.agro/knowledge/README.md` and sorts the table by
  `updated:` descending. Never hand-edit the Index table.

## When NOT to use

- A topic that is a **behavioral norm** (for example, "always do X") belongs
  in a rule or a skill, not in the knowledge base.
- A **session journal** entry (for example, "this run showed Y") belongs in
  the run's report. A *recurring failure mode* that the run reveals is
  different: write the failure mode as a `kind: pattern` entry, named for the
  mode, not for the run.
- A **proposal decision record** belongs in
  `.agro/evals/decisions/skill-impact.md`, not in a knowledge page.
- **Human-facing prose** belongs in `docs/`. A knowledge page holds
  LLM-readable synthesis, not human-facing prose.
- A full-text body search uses `grep` directly. `query` searches frontmatter
  only, by design.

## See Also

- `.agro/skills/wiki/references/schema.md` — canonical schema and authoring rules
- `.agro/skills/wiki/references/ingest.md` · `query.md` · `lint.md` — full procedures
- `.agro/skills/wiki/scripts/knowledge-impact.sh` — dependency-aware invalidation
- `.agro/knowledge/README.md` — the generated index
- `.agro/evals/decisions/skill-impact.md` — the skill-change ledger the proposer reads
- `.agro/evals/probes/wiki-readme-index.sh` — drift guard for the generated index
