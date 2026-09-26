# .agro/evals/datasets/ — Verifiable harness-trajectory corpus

This directory holds the harness **example corpus**. The corpus is a catalogue
of concrete, verifiable *trajectories*. Each trajectory holds three parts: a
real prompt, the real change that the prompt produced, and a machine-checkable
oracle for that change.

The corpus design follows HuggingFace
[Repo2RLEnv](https://github.com/huggingface/Repo2RLEnv). Each example turns a
shipped PR or a plan lesson into an instance that carries a reward. A scorer
uses the instance to **score** a candidate trajectory. An agent uses the
instance to **improve** an existing trajectory.

The probe suite asks "did we break it?". The capability benchmark asks "did we
get better?". This corpus supplies the concrete instances that both
instruments use.

## Floor / Ceiling / Corpus — the three legs of the eval system

| Leg | Path | Asks | Shape |
|---|---|---|---|
| **Floor** (regression) | [`../README.md`](../README.md) | "Did we **break** it?" | Deterministic 3-state probes (`PASS`/`REGRESSION`/`SKIPPED`). Each probe must stay green. |
| **Ceiling** (progress) | [`../capability/README.md`](../capability/README.md) | "Did we **get better**?" | Graded end-to-end tasks. Each task gets a score for success, cost-time, and unattended operation. |
| **Corpus** (examples) | here (`.agro/evals/datasets/`) | Concrete verifiable example trajectories | One folder per example: prompt, oracle, and `verify.sh`. Each example earns a reward from 0 to 1. |

The floor and the ceiling are *instruments*. The corpus is the *material* that
the instruments score with. A capability task can sample instances from the
corpus. A probe can assert that a candidate diff still earns the reward of its
example.

## Per-example folder layout

Each example lives at `.agro/evals/datasets/<dataset>/<DS-id>-<slug>/`. The
three path segments carry these values:

- `<dataset>` names the trajectory class (`task-prs`).
- `<DS-id>` names the `DS-NNN` id. The corpus never reuses an id.
- `<slug>` names a short kebab label.

| Path | Holds |
|---|---|
| `manifest.json` | The metadata record of the example (schema below). This file is the single source of truth for the `id`, the source, and the reward. |
| `prompt.md` | The trajectory **input**: the task or prompt that the harness received. |
| `oracle/` | The verified ground truth. The folder always holds `summary.md` and `changed-files.txt`. The folder holds `diff.patch` for small diffs and `lesson.md` for lesson examples. |
| `verify.sh` | The dual-mode scorer. With no arguments, **self-check** mode checks that the manifest, the oracle, and the hash agree. With one argument, **score mode** `verify.sh <candidate-diff>` scores the candidate against the oracle. Score mode prints exactly one line: `score=<0..1>`. |

The `oracle/` folder holds these files:

| File | Required | Holds |
|---|---|---|
| `summary.md` | always | A prose statement of what a correct trajectory does, and why. |
| `changed-files.txt` | always | The sorted list of paths that the trajectory touched. The `content_hash` covers this file. |
| `diff.patch` | small diffs only | The literal patch (see *Size discipline*). |
| `lesson.md` | lesson examples | The lesson from the `## Lessons` section of the task plan. |

## `manifest.json` fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | `DS-NNN`. The value matches the `DS-id` of the folder and the `## Catalogue` row. |
| `slug` | string | yes | A kebab label. The value matches the `<slug>` of the folder. |
| `dataset` | string | yes | The trajectory class: `task-prs`. |
| `title` | string | yes | A human-readable one-line title. |
| `created` | date | yes | The UTC `YYYY-MM-DD` date of the example capture. |
| `source` | object | yes | Provenance. PR examples: `{repo, pr, issue, merge_commit, url}`. Lesson examples: `{repo, memory_ref, lesson_date, origin}`. |
| `trajectory` | object | yes | `{kind, outcome}`. Example: `kind: "delegate"`, `outcome: "merged"`. |
| `skills` | array | yes | The skills that the trajectory used. Example: `["prd","delegate","eval"]`. |
| `reward_kind` | array | yes | One reward mode or more (table below). |
| `oracle` | object | yes | `{summary, changed_files, changed_file_count, diff?, lesson?}`. The object holds relative paths into `oracle/` and the file count. The `diff` and `lesson` keys appear only when the example stores those files. |
| `content_hash` | string | yes | `sha256:<hex>` over `oracle/changed-files.txt`. This hash is the drift anchor. |
| `capability_tasks` | array | yes | The `CB-NNN` ids in [`../capability/`](../capability/README.md) that this example feeds. The array can be empty. |
| `notes` | string | no | Free-form caveats. |

## `reward_kind` modes (Repo2RLEnv-style)

`reward_kind` is an **array**. An example can carry more than one mode.
`verify.sh` combines all modes of the example into one `score=<0..1>` line.

| Mode | Reward signal |
|---|---|
| `diff_similarity` | For a small diff, the scorer compares the candidate diff with `oracle/diff.patch`. For a large diff, the scorer measures path-set overlap with `oracle/changed-files.txt`. |
| `test_execution` | A named probe or test gates the reward. The candidate must make that probe or test pass. |
| `artifact_presence` | The expected files or PR state exist. Example: the PR merged, and the changed files are present. |

## Size discipline

Keep the corpus small and git-friendly:

- **Small diffs (≲ 200 lines):** Store the literal `oracle/diff.patch`. This
  patch is the canonical oracle. `diff_similarity` scores directly against
  this patch.
- **Large diffs:** Do **not** vendor the patch. Store these three items:
  - `oracle/changed-files.txt`
  - the `source.merge_commit` ref, because git history is the canonical oracle
  - a prose `oracle/summary.md`

  For a large diff, `diff_similarity` falls back to path-set overlap over
  `changed-files.txt`. A scorer can use the commit ref to rebuild the full diff
  on demand.

## Catalogue

Each `id` of an example folder appears in this table. Each row id maps to a real
folder. The `.agro/evals/probes/datasets-schema.sh` drift guard enforces both
directions. Column 1 holds the bare `DS-NNN`.

| id | dataset | title | source | reward_kind |
|---|---|---|---|---|
| DS-001 | ship-spec-prs † | Add default Pi Monitor support | PR #147 (closes #146) | diff_similarity, artifact_presence |
| DS-002 | ship-spec-prs † | Run pnpm security audits in CI | PR #172 (closes #171) | diff_similarity, artifact_presence, test_execution |

† **Legacy class name.** DS-001 and DS-002 keep the `ship-spec-prs` directory
and manifest from their capture. A dataset is a frozen record of what a run
did. A new class name on these records would claim a skill that the harness
lacked at capture time. New examples use the `task-prs` class, as the schema above
records.

## Pointers

- [`../README.md`](../README.md) — the probe suite (the regression **floor**).
- [`../capability/README.md`](../capability/README.md) — the capability benchmark (the progress **ceiling**).
- Source inspiration: [huggingface/Repo2RLEnv](https://github.com/huggingface/Repo2RLEnv). The project turns the history of a repository into verifiable RL environments.
