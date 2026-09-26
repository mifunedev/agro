# SkillOpt integration fit for US-006

Integration result: **`fit`**.

SkillOpt accepts a custom environment adapter. The adapter owns rollout and scoring. The adapter can shell out to `run-batch.sh`, so each attempt runs through the native Claude Code path. The loop edits one Markdown document. The loop sees only the items that the adapter loads. The adapter can hold the 240-attempt cap, because each attempt passes through the adapter.

One condition blocks the run today, but not the integration. The episodes and the recommended proposer both call `claude -p` on the operator account. That account is at its monthly spend limit for headless calls. The run starts only after the operator lifts the limit.

This file records research only. No step of this assessment called a model API.

## Sources (pinned)

Each claim below names a source file and a commit. `SkillOpt@79124b37` means the file at that SkillOpt commit. `GEPA@d771eb21` means the file at that GEPA commit. A claim marked **unverified** has no source read.

| Item | SkillOpt | GEPA |
|---|---|---|
| Source URL | `https://github.com/microsoft/SkillOpt` | `https://github.com/gepa-ai/gepa` |
| Owner | Microsoft (`LICENSE`: "Copyright (c) 2026 Microsoft Corporation") | Lakshya A Agrawal (`LICENSE`) |
| License | MIT (`LICENSE`, GitHub API `license.spdx_id`) | MIT (`LICENSE`, `pyproject.toml`) |
| Pin | `main` at `79124b37e9a6371e13b753f8bcd7adb1e493ade1`, 2026-09-06 | `main` at `d771eb21b5dd3228bc3f567293d2ccfc423fc900`, 2026-09-22 |
| Latest release | `v0.2.0` at `e4ea6a6771e797ef820cdd8bfea64c57e0481065`, published 2026-07-02 | `v0.1.4` at `8b0ce6cd99a234f6b74daf37558a2ac0ce18f975`, published 2026-07-15 |
| PyPI | `skillopt` 0.2.0 | `gepa` 0.1.4 |
| Python | `>=3.10` (`pyproject.toml`) | `>=3.10, <3.15` (`pyproject.toml`) |
| Runtime dependencies | `openai`, `pyyaml`, `numpy`, `openpyxl`, `azure-identity`, `azure-core`, `httpx` (`pyproject.toml`) | none in the core; `litellm` in the `full` extra (`pyproject.toml`) |

Pin SkillOpt to the commit, not to the release. The assessment read the commit `79124b37`. `docs/guide/installation.md` states that `main` holds backends that landed after `0.2.0`. The assessment did not compare `v0.2.0` with the claims below.

Install command for the pin:

```bash
uv venv "${XDG_STATE_HOME:-$HOME/.local/state}/agro/skillopt-ste/venv"
uv pip install --python "${XDG_STATE_HOME:-$HOME/.local/state}/agro/skillopt-ste/venv/bin/python" \
  "skillopt @ git+https://github.com/microsoft/SkillOpt@79124b37e9a6371e13b753f8bcd7adb1e493ade1"
```

The sandbox holds Python 3.13.15 and `uv`. The assessment did not run the install. Status of the install step: **unverified**.

## SkillOpt loop

`docs/guide/training-loop.md` at `SkillOpt@79124b37` names six stages for each step:

1. **Rollout.** The target runs a batch of tasks with the current skill. Each task gives a trajectory and a score.
2. **Reflect.** The optimizer model reads trajectory minibatches and writes edit patches.
3. **Aggregate.** The optimizer merges similar patches.
4. **Select.** The optimizer ranks the edits. `optimizer.learning_rate` caps the edit count for each step.
5. **Update.** The trainer applies the selected edits and makes one candidate skill.
6. **Gate.** The trainer scores the candidate on the selection split. When the gate score is strictly higher than the score of the current skill, the trainer keeps the candidate. Otherwise, the trainer rejects the candidate.

Two epoch-boundary stages add more rollouts: slow update and meta skill (`docs/guide/training-loop.md`). Each stage rolls out the previous skill and the current skill on `optimizer.slow_update_samples` training items (`skillopt/engine/trainer.py`, lines 1803 to 1832 and 2080 to 2101).

What the loop changes:

- The trainable state is one Markdown skill document (`docs/guide/skill-document.md`).
- The default mode `optimizer.skill_update_mode: patch` applies edit operations `append`, `insert_after`, `replace`, and `delete` (`skillopt/prompts/analyst_error.md`). The other modes are `rewrite_from_suggestions` and `full_rewrite_minibatch` (`docs/reference/config.md`).
- The slow update writes a protected region between `<!-- SLOW_UPDATE_START -->` and `<!-- SLOW_UPDATE_END -->`. Skill-aware reflection writes a region between `<!-- APPENDIX_START -->` and `<!-- APPENDIX_END -->` (`docs/guide/skill-document.md`).

What feedback the loop reads:

- Each rollout row holds `id`, `hard`, and `soft`. The trainer requires these three keys. The trainer keeps other keys in `RolloutResult.extras` (`docs/guide/new-benchmark.md`).
- `hard` can hold a float from 0 to 1. `compute_score` takes the mean of `hard` and the mean of `soft` over the rows (`skillopt/utils/scoring.py`).
- Reflection reads `<rollout_dir>/predictions/<id>/conversation.json`. Reflection skips a row that has no conversation file (`docs/guide/new-benchmark.md`, `skillopt/envs/base.py`).
- Reflection adds the row fields `fail_reason`, `reference_text`, `target_system_prompt`, and `target_user_prompt` to the optimizer prompt (`skillopt/gradient/reflect.py`, lines 155 to 180).
- When `hard` is 0, reflection treats the row as a failure. With `gradient.failure_only: false`, reflection also reads the successful rows (`skillopt/gradient/reflect.py`, lines 550 and 551).

How the loop proposes edits:

- A separate optimizer model writes the patches (`README.md`). `model.optimizer_backend` selects the backend. `model.optimizer` selects the model (`skillopt/config.py`, lines 46 and 48).
- The optimizer backends are `openai_chat`, `claude_chat`, `qwen_chat`, `minimax_chat`, `openai_compatible`, `copilot_chat`, `codex_exec`, and `claude_code_exec` (`skillopt/model/backend_config.py`, lines 139 to 157).
- The base default is `azure_openai` with `gpt-5.5` for both roles (`configs/_base_/default.yaml`).

Selection and stop controls:

- The gate metric is `hard`, `soft`, or `mixed`. `evaluation.use_gate: false` keeps each candidate (`docs/guide/training-loop.md`).
- The step count is `train.num_epochs` times `ceil(train_size / (batch_size * accumulation))` (`skillopt/engine/trainer.py`, lines 892 to 894).
- A step with no patch records `skip_no_patches` and makes no candidate (`skillopt/engine/trainer.py`, line 1311).
- The trainer has no cap on rollout count and no cap on model spend. A search of `skillopt/engine/` and `skillopt/config.py` found no such key.
- The trainer writes `runtime_state.json` and resumes from the file (`skillopt/engine/trainer.py`, lines 397 to 412 and 950).
- `evaluation.eval_test: true` starts a final test evaluation (`skillopt/engine/trainer.py`, line 2182).

## Integration contract

| Question | Answer | Source at `SkillOpt@79124b37` |
|---|---|---|
| Can AGRO own execution and scoring? | Yes. `EnvAdapter.rollout(env_manager, skill_content, out_dir)` is abstract. The adapter returns the rows. The ABC has no `evaluate()` method. | `skillopt/envs/base.py`; `docs/guide/new-benchmark.md` |
| Can the adapter shell out to `run-batch.sh`? | Yes. `rollout` is plain Python. The trainer calls `rollout` and waits for the result. | `skillopt/engine/trainer.py`, line 1228 |
| Can the loop edit only one Markdown file? | Yes. The loop edits one skill string. The adapter writes that string to `.agro/skills/ste/SKILL.md` and nowhere else. | `docs/guide/skill-document.md` |
| Can the loop avoid held-out data? | Yes. The trainer reads only the items that the adapter loader gives for `train/`, `val/`, and `test/`. The adapter loads only `split == "train"` records. `run-batch.sh --split train` rejects each held-out id. | `skillopt/datasets/base.py`, lines 375 to 388; `run-batch.sh` |
| Can the loop hold 240 attempts? | Yes, through the adapter. The trainer has no attempt cap. The adapter counts attempts before each shell-out. When fewer than 30 attempts remain, the adapter refuses the candidate. | trainer search above |
| Does the built-in Claude Code target fit? | No. `claude_code_exec` writes the skill to `.agents/skills/skillopt-target/SKILL.md` with its own frontmatter. The prompt then tells the agent to read `.agents/skills/skillopt-target/SKILL.md`. The native `/ste` load does not use that path. | `skillopt/model/codex_harness.py`, lines 48 to 113 and 708 |
| Can a driver register the adapter without a fork? | Yes. `get_adapter` calls `_register_builtins()`, which adds entries and removes none. A driver can add the adapter to `scripts.train._ENV_REGISTRY`. Next, the driver calls `scripts.train.main()`. The wheel ships the `scripts` package. | `scripts/train.py`, lines 43, 104 to 125, and 761 to 796; `pyproject.toml`, line 81 |

Result: SkillOpt treats AGRO as a black-box scorer. SkillOpt keeps only candidate proposal, as the plan requires.

## Fit verdict

Verdict: **`fit`**.

The integration has no blocker. Four conditions apply to the run:

1. **Spend limit.** Each episode calls `claude -p`. The recommended proposer also calls `claude -p`. The run waits until the operator lifts the monthly limit.
2. **Incomplete baseline.** `runs/baseline-train/summary.json` records 10 `infra_failure` attempts. F2-13, F2-14, and F2-15 hold no scored attempt. F2-12 holds 2 scored attempts. Each failure line records `claude exited 1`. Complete these attempts from the retry budget before the optimizer starts, or record why the gate can omit them.
3. **Protected regions.** Disable `optimizer.use_slow_update`, `optimizer.use_meta_skill`, and `optimizer.use_skill_aware_reflection`. The adapter rejects a candidate that holds a SkillOpt region marker.
4. **Frontmatter.** The adapter removes the YAML frontmatter of `SKILL.md` before SkillOpt reads the body. The adapter adds the original frontmatter back, byte for byte, to each candidate. SkillOpt cannot change the skill `name` or the skill trigger text.

## GEPA fallback

The plan needs GEPA only when SkillOpt is `blocked`. SkillOpt is `fit`, so the experiment does not use GEPA. The facts below support a later switch.

- Pin: `https://github.com/gepa-ai/gepa` at `d771eb21b5dd3228bc3f567293d2ccfc423fc900`.
- Interface: the `GEPAAdapter` protocol declares `evaluate` and `make_reflective_dataset`. `EvaluationBatch` holds the scores and the trajectories (`src/gepa/core/adapter.py`, lines 16, 83, 145, and 185).
- Entry point: `gepa.optimize(seed_candidate, trainset, valset, adapter, reflection_lm, max_metric_calls, stop_callbacks, ...)` (`src/gepa/api.py`, lines 47 to 74).
- Budget: `max_metric_calls` caps the evaluator calls (`src/gepa/api.py`, line 72).
- Proposer: a string `reflection_lm` goes to `litellm.completion` (`src/gepa/lm.py`, lines 115 to 123). A string for Anthropic needs a provider API key for `litellm`. That requirement is **unverified**. A callable `reflection_lm` can wrap `claude -p`. That use is **unverified**.
- Fit: **unverified**. The protocol shape matches the same shell-out design.

## Adapter sketch

Put the adapter in the experiment folder. Put the virtual environment and the SkillOpt output outside git.

| Path | Content |
|---|---|
| `optimize/requirements.txt` | One line: `skillopt @ git+https://github.com/microsoft/SkillOpt@79124b37e9a6371e13b753f8bcd7adb1e493ade1` |
| `optimize/skillopt.yaml` | The SkillOpt configuration in the table below |
| `optimize/agro_ste_env.py` | One `SplitDataLoader` subclass and one `EnvAdapter` subclass |
| `optimize/run-optimize.py` | The driver: register `agro_ste`, then call `scripts.train.main()` |
| `runs/optimize/candidates.jsonl` | One line for each candidate |
| `runs/optimize-c<k>/episodes.jsonl` | The episode lines of candidate `<k>`, written by `run-batch.sh` |
| `${XDG_STATE_HOME:-$HOME/.local/state}/agro/skillopt-ste/skillopt-out/` | The SkillOpt `out_root` |

Configuration in `optimize/skillopt.yaml`:

| Key | Value | Reason |
|---|---|---|
| `env.name` | `agro_ste` | The driver registers the adapter under this name |
| `env.split_mode` | `split_dir` | The adapter writes `train/`, `val/`, and `test/` |
| `train.num_epochs` | `8` | One step for each epoch gives at most 8 candidates |
| `train.batch_size` | `30` | One step covers the 30 training documents |
| `evaluation.use_gate` | `true` | The trainer keeps a candidate only on a strict gain |
| `evaluation.eval_test` | `false` | The experiment runs no SkillOpt test phase |
| `optimizer.use_slow_update` | `false` | The stage adds rollouts and a protected region |
| `optimizer.use_meta_skill` | `false` | The stage adds rollouts |
| `optimizer.use_skill_aware_reflection` | `false` | The stage adds a protected region |
| `optimizer.skill_update_mode` | `patch` | The default bounded edit mode |
| `model.optimizer_backend` | `claude_chat` | One provider for the whole experiment |
| `model.optimizer` | `claude-sonnet-5` | The pinned model of `experiment.json` |

Data flow for the loader:

1. Read `corpus/manifest.json`.
2. Keep each document with `split == "train"`.
3. When a kept document has a family outside `splits.train` of `experiment.json`, exit non-zero.
4. Write the 30 training ids to `train/items.json`.
5. Write the same 30 ids to `val/items.json`.
6. Write `[]` to `test/items.json`.

The selection split and the training split hold the same documents. The experiment keeps F3 and F4 for US-007. SkillOpt never sees them.

The `rollout(env_manager, skill_content, out_dir)` shell-out:

1. Add the original frontmatter to `skill_content`. Compute the `sha256` digest of the result.
2. When `runs/` holds episodes for that digest, build the rows from those episodes. Start no attempt. The baseline digest `cfd05180` maps to `runs/baseline-train`.
3. When the candidate holds a SkillOpt region marker, reject the candidate. When 8 candidates exist, or when fewer than 30 optimize attempts remain, reject the candidate.
4. Write the candidate to `.agro/skills/ste/SKILL.md` in a dedicated candidate worktree.
5. Commit the file with a normal `git commit`. The parent chain starts at the baseline revision `494e2d768b34ccef34ff913ee6aa244547948f12`.
6. Run `git diff --name-only 494e2d76 <candidate>`. When the output holds a path other than `.agro/skills/ste/SKILL.md`, reject the candidate.
7. Run `run-batch.sh --run-id optimize-c<k> --split train --arm-rev candidate=<candidate> --repeats 1 --jobs 3`.
8. Read `runs/optimize-c<k>/episodes.jsonl`.
9. Write one row and one `conversation.json` for each `ok` episode.
10. Append one line to `runs/optimize/candidates.jsonl`.

Each row holds these fields:

| Row field | Value |
|---|---|
| `id` | `<document-id>-r<repeat>`, one row for each scored episode |
| `hard` | `1` when `pass` is `true`, else `0` |
| `soft` | The number of `true` values among `p1_literals`, `p2_checker`, `p3_no_invention`, and `p4_length`, divided by 4 |
| `fail_reason` | A short digest of `verifier.details`: each missing literal, the first checker findings, each new number, and each filled gap |
| `reference_text` | The seeded gaps of the document from `manifest.json`, for training documents only |
| `task_type` | The family, `F1` or `F2` |

Each `conversation.json` holds three messages:

- `user`: the episode prompt and the source document text.
- `assistant`: the rewrite output from `runs/<run-id>/outputs/`.
- `system`: the full `verifier` object of the episode.

A training episode gives two kinds of feedback: the rewrite output and the verifier `details`. The rows carry both. An `infra_failure` episode gives no row. The candidate line records the failure count.

Each line of `candidates.jsonl` holds these fields: `candidate`, `commit`, `parent_digest`, `skillopt_step`, `diff`, `train_pass_rate`, `scored`, `infra_failures`, `gate_accepted`, and `proposer_usage`.

Run the driver in the named tmux session `skillopt-ste`. The trainer resumes from `runtime_state.json`. `run-batch.sh` resumes from `episodes.jsonl`.

## Budget mapping

The optimize budget is 240 attempts. `experiment.json` caps the loop at 8 candidates.

| Phase | Documents | Repeats | Attempts |
|---|---|---|---|
| Baseline selection score and baseline training feedback | 30 | from `runs/baseline-train` | 0 |
| Each candidate `<k>` on the selection split | 30 | 1 | 30 |
| Training feedback for an accepted candidate | 30 | from `runs/optimize-c<k>` | 0 |
| 8 candidates in total | 30 | 1 | 240 |

The cache makes each training rollout free. The trainer rolls out the incumbent skill on the training batch. Each incumbent already holds episodes for all 30 documents.

Each call to `run-batch.sh` also runs one canary. The canary line goes to `canaries.jsonl` and does not count against `budget.total_attempts`.

`run-batch.sh` stops when all runs hold 540 lines. `run-batch.sh` has no separate cap for the optimize phase. The adapter holds the 240 cap.

At the baseline mean of 0.3638 USD for each attempt, 240 attempts cost about 87 USD. Proposer calls add to that total. Status of the proposer total: **unverified**.

Proposer calls for each step: one reflection call for each minibatch of 8 rows, plus merge calls, plus one ranking call (`docs/guide/training-loop.md`, `skillopt/optimizer/clip.py`). Status of the call count: **unverified**.

## Open questions

1. **Baseline gaps.** Does the operator complete the 10 `infra_failure` baseline attempts from the 30-attempt retry budget before US-006?
2. **Proposer provider.** Does the operator accept `claude_chat` with `claude-sonnet-5` on the same account? The alternatives are `codex_exec`, `copilot_chat`, `openai_chat`, or a local `openai_compatible` endpoint. Each alternative adds a second provider, and the plan excludes a second provider.
3. **Proposer isolation.** `claude_chat` runs `claude -p` with `--setting-sources user,project` by default (`skillopt/model/claude_backend.py`, lines 19 and 254 to 258). Set `CLAUDE_SETTING_SOURCES=project` for the proposer. Status of the effect in a temporary directory: **unverified**.
4. **Row identity.** The rows use `<document-id>-r<repeat>`, not the item `id`. `attach_reference_context` matches rows to items by `id` (`skillopt/envs/base.py`). The fallback is one row for each document with `hard` equal to the pass fraction. Which form does the advisor accept?
5. **Gate noise.** One repeat on 30 documents gives a noisy gate. Does the advisor accept a strict gain on a single repeat?
6. **Gate metric.** Does the gate use `hard`, `soft`, or `mixed`?
7. **Success feedback.** Does the loop set `gradient.failure_only: true`? That value cuts proposer calls. That value also removes the evidence of each passing rewrite.
8. **Model output format.** SkillOpt defaults the Claude proposer to `claude-sonnet-4-6` (`skillopt/model/claude_backend.py`, line 22). Status of the JSON patch parse with `claude-sonnet-5`: **unverified**.
