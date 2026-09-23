# Capability evidence contract

- Score real task instances against their acceptance criteria and per-axis rubrics.
- Record evidence for success, cost-time, and unattended completion separately.
- Supply the judgment axes explicitly. Never present runner arithmetic as automatic judgment.
- Treat `--check` output as evidence, not as a replacement for any judgment axis.
- Keep the task set held-out. Do not special-case the harness to pass a benchmark task.
- Never delete a task to inflate the score. Add representative tasks only through deliberate review.
- Preserve task ids. Keep one current scoreboard row per id; use history for earlier results.
- Compare like-for-like task sets. Disclose changed coverage, missing evidence, and scoring limitations.
- If scores stay flat while machinery grows, report the need for human redirect. Do not claim improvement from added machinery alone.

Use the [benchmark skill](../../skills/benchmark/SKILL.md) for benefit verdicts.
See the [source reference](https://github.com/mifunedev/agro/blob/main/docs/capability-benchmark.md)
for rubrics, runner usage, and instrument limits.
