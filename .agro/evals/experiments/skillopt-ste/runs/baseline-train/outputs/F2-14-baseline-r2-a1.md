# .agro/evals/datasets/ — Verifiable harness-trajectory corpus

This directory holds the **example corpus** of the harness. The corpus is a
catalogue of concrete, verifiable *trajectories*. Each trajectory holds three
parts: a real prompt, the real change that the prompt produced, and a
machine-checkable oracle for that change.

HuggingFace's [Repo2RLEnv](https://github.com/huggingface/Repo2RLEnv) inspired
this design. Each example turns a shipped PR or a plan lesson into a
reward-bearing instance. A scorer **scores** a candidate trajectory against the
instance. An agent can also **improve** an existing trajectory from the
instance.

The probe suite asks "did we break it?". The capability benchmark asks "did we
get better?". This corpus supplies the concrete instances for both questions.

## Floor / Ceiling / Corpus — the three legs of the eval system

| Leg | Path | Asks | Shape |
|---|---|---|---|
| **Floor** (regression) | [`../README.md`](../README.md) | "Did we **break** it?" | Deterministic 3-state probes (`PASS`/`REGRESSION`/`SKIPPED`). Every probe must stay green. |
| **Ceiling** (progress) | [`../capability/README.md`](../capability/README.md) | "Did we **get better**?" | Graded end-to-end tasks. The benchmark scores each task on success · cost-time · unattended. |
| **Corpus** (examples) | here (`.agro/evals/datasets/`) | Concrete verifiable example trajectories | One folder per example: prompt + oracle + `verify.sh`. Each example has a reward score from 0 to 1. |

The floor and the ceiling are *instruments*. This corpus is the *material* that
the instruments score with. A capability task can sample these instances. A
probe can assert that a candidate diff still earns the reward of its example.

## Per-example folder layout

Each example lives at `.agro/evals/datasets/<dataset>/<DS-id>-<slug>/`. The path
segments have these meanings:

- `<dataset>` is the trajectory class (`task-prs`).
- `<DS-id>` is the `DS-NNN` id. The corpus never reuses an id.
- `<slug>` is a short kebab-case label.

| Path | Holds |
|---|---|
| `manifest.json` | The metadata record of the example (schema below). This file is the single source of truth for the `id`, the source, and the reward of the example. |
| `prompt.md` | The trajectory **input**: the task or prompt that the harness received. |
| `oracle/` | The verified ground truth. Every example has `summary.md` and `changed-files.txt`. A small-diff example adds `diff.patch`. A lesson example adds `lesson.md`. |
| `verify.sh` | The dual-mode scorer. With no arguments, `verify.sh` runs a **self-check**: the script confirms that the manifest, the oracle, and the hash agree. In **score mode**, `verify.sh <candidate-diff>` rates the candidate against the oracle. Score mode prints exactly one line: `score=<0..1>`. |

`oracle/`:

| File | Required | Holds |
|---|---|---|
| `summary.md` | always | A prose statement of what a correct trajectory does, and why. |
| `changed-files.txt` | always | The sorted list of paths that the trajectory touched. The `content_hash` covers this file. |
| `diff.patch` | small diffs only | The literal patch (see *Size discipline*). |
| `lesson.md` | lesson examples | The lesson from the `## Lessons` section of the task plan. |

## `manifest.json` fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | `DS-NNN`. The value matches the `DS-id` of the folder and the id in the `## Catalogue` row. |
| `slug` | string | yes | A kebab-case label. The value matches the `<slug>` of the folder. |
| `dataset` | string | yes | The trajectory class: `task-prs`. |
| `title` | string | yes | A human-readable one-line title. |
| `created` | date | yes | The UTC date (`YYYY-MM-DD`) of the example capture. |
| `source` | object | yes | Provenance. A PR example uses `{repo, pr, issue, merge_commit, url}`. A lesson example uses `{repo, memory_ref, lesson_date, origin}`. |
| `trajectory` | object | yes | `{kind, outcome}`. Example: `kind: "delegate"`, `outcome: "merged"`. |
| `skills` | array | yes | The skills that the trajectory exercised. Example: `["prd","delegate","eval"]`. |
| `reward_kind` | array | yes | One or more reward modes (table below). |
| `oracle` | object | yes | `{summary, changed_files, changed_file_count, diff?, lesson?}`. The object holds relative paths into `oracle/` and the file count. The `diff` key and the `lesson` key appear only when the example stores that file. |
| `content_hash` | string | yes | `sha256:<hex>` over `oracle/changed-files.txt`. This hash is the drift anchor. |
| `capability_tasks` | array | yes | The `CB-NNN` ids in [`../capability/`](../capability/README.md) that this example feeds. The array can be empty. |
| `notes` | string | no | Free-form caveats. |

## `reward_kind` modes (Repo2RLEnv-style)

`reward_kind` is an **array**. One example can carry more than one mode.
`verify.sh` combines the modes into one `score=<0..1>` value. The combination
rule is `<combination-rule>`.

| Mode | Reward signal |
|---|---|
| `diff_similarity` | For a small diff, the scorer compares the candidate diff against `oracle/diff.patch`. For a large diff, the scorer measures path-set overlap against `oracle/changed-files.txt`. |
| `test_execution` | A named probe or test gates the reward. The candidate must make that probe or test pass. |
| `artifact_presence` | The expected files or PR state exist. Example: the PR merged, and the changed files are present. |

## Size discipline

Keep the corpus small and git-friendly. Choose the oracle storage by diff size:

- **Small diffs (at most `<max-diff-lines>` lines; the current guide value is
  about 200):** store the literal `oracle/diff.patch`. This patch is the
  canonical oracle. `diff_similarity` scores directly against the patch.
- **Large diffs:** do **not** vendor the patch. Store these three items:
  1. `oracle/changed-files.txt`.
  2. The `source.merge_commit` ref. Git history is the canonical oracle.
  3. A prose `oracle/summary.md`.

  For a large diff, `diff_similarity` falls back to path-set overlap over
  `changed-files.txt`. A scorer can use the commit ref to rebuild the full diff
  on demand.

## Catalogue

Every example folder `id` appears in this table. Every row id maps to a real
folder. The `.agro/evals/probes/datasets-schema.sh` drift guard enforces both
directions. Column 1 holds the bare `DS-NNN` id.

| id | dataset | title | source | reward_kind |
|---|---|---|---|---|
| DS-001 | ship-spec-prs † | Add default Pi Monitor support | PR #147 (closes #146) | diff_similarity, artifact_presence |
| DS-002 | ship-spec-prs † | Run pnpm security audits in CI | PR #172 (closes #171) | diff_similarity, artifact_presence, test_execution |

† **Legacy class name.** DS-001 and DS-002 keep the `ship-spec-prs` directory
and manifest from their capture. A dataset is a frozen record of what a run did.
A new class name would make DS-001 and DS-002 claim a skill. That skill did
not exist at capture time. New examples use the class `task-prs`, as the schema above
records.

## Pointers

- [`../README.md`](../README.md) — the probe suite (the regression **floor**).
- [`../capability/README.md`](../capability/README.md) — the capability benchmark (the progress **ceiling**).
- Source inspiration: [huggingface/Repo2RLEnv](https://github.com/huggingface/Repo2RLEnv). This project turns the history of a repository into verifiable RL environments.
