# Knowledge production contract

The repository outranks derived knowledge. Use code and tests for implementation
truth and canonical docs, RFCs, and ADRs for intended-design truth.
If a page conflicts with its source, re-check the source before using the page.

- Follow the [wiki skill](../skills/wiki/SKILL.md) and its [canonical schema](../skills/wiki/references/schema.md) for entry production and lifecycle.
- Keep `sources:` as the single provenance and dependency declaration. Preserve evidence and verify claims before advancing freshness.
- Resolve `raw/` source paths relative to `.agro/knowledge/`; resolve other repository paths from the repository root.
- Keep shareable entries in tracked `source/` and `patterns/`, with tracked external captures in `raw/`.
- Keep per-machine scratch in ignored `local/`. Do not use local-only pages as inputs to `/wiki query` or to a plan.
- Promote scratch through `/wiki ingest`; moving a file by hand does not establish schema, provenance, or index validity.
- Do not hand-edit the generated `README.md` Index. `/wiki lint` owns its rows and ordering.
- Run `.agro/evals/probes/wiki-readme-index.sh` after entry metadata or index-generation changes.

The README preamble provides orientation. The generated Index starts at `## Index`.
