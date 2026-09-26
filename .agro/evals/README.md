# Evals

This directory holds these surfaces:

| Path | Purpose |
| --- | --- |
| `probes/`, `RESULTS.md` | Deterministic regression checks and current results. |
| `capability/` | Hand-scored end-to-end capability tasks and their scoreboard. |
| `datasets/` | Verifiable trajectory examples and scorer schemas. |
| `decisions/` | Append-only skill-change proposals and verdicts. |
| `experiments/` | Frozen optimization experiments: corpus, verifier, runners, and evidence. |

Read [AGENTS.md](AGENTS.md) before producing eval artifacts.
Use the [canonical eval skill](../skills/eval/SKILL.md) to run probes.
The [source eval reference](https://github.com/mifunedev/agro/blob/main/docs/evals.md)
explains the oracle, scoreboard schema, runner, CI gate, and correction-surface triage.
