# skillopt-ste results

Verdict: `no-headroom`. The experiment stopped at the headroom gate in US-005, before any optimization. Issue #1171 counts a valid no-improvement result as a successful experiment.

## Verdict

The frozen rule stops the experiment when the baseline training pass rate is 0.90 or more. The `claude-opus-5-5` baseline passed 82 of 90 training attempts. The pass rate is 0.911. The success threshold asks for a held-out gain of 0.15 or more. A baseline at 0.911 leaves a gain of 0.089 or less, so the threshold is out of reach.

No candidate exists. No held-out run exists. The held-out split stays unseen, so a later experiment can use the held-out split without contamination.

## Baseline runs

| Run | Model | Scored | Pass rate | P1 | P2 | P3 | P4 | Mean turns | Mean elapsed | Cost |
|---|---|---|---|---|---|---|---|---|---|---|
| `runs/baseline-train` | `claude-opus-5-5` | 90 of 90 | 0.911 | 0.933 | 0.978 | 0.989 | 1.000 | 6.9 | 47 s | $31.52 |
| `archive/claude-sonnet-5/runs/baseline-train` | `claude-sonnet-5` | 80 of 90 | 0.838 | 0.900 | 0.963 | 0.938 | 1.000 | 13.3 | 113 s | $32.74 |

The Sonnet run lost 10 attempts to an account spend limit. The operator then selected `claude-opus-5-5` before optimization. Opus cost the same as Sonnet for each attempt, used fewer turns, and finished in less than half the time.

Family pass rates for Opus: F1 `docs/` 0.867, F2 READMEs and instruction files 0.956.

## Opus failures

| Document | Failed repeats | Check | Cause | Class |
|---|---|---|---|---|
| F1-10 | 3 of 3 | P1 | The URL extractor reads `issues/928)'s` past the link target. No rewrite can keep that literal. | Scorer defect G |
| F1-07 | 2 of 3 | P1 | The rewrite splits one two-command fenced block into two numbered steps. | Rule conflict |
| F2-07 | 2 of 3 | P2, P3 | The agent keeps index titles that mirror other pages. One repeat also leaves the seeded gap unmarked. | Rule conflict |
| F1-09 | 1 of 3 | P1 | The rewrite removes a repeated value inside a code span. | Skill failure |

Scorer defect G affects both arms the same way, and a fix can only raise the pass rate. With a fix, the Opus pass rate is 85 of 90, or 0.944. The verdict does not change.

## Findings

1. The Opus baseline already follows `/ste` on this corpus. Only one Opus failure is a clear skill failure.
2. Two `/ste` rules conflict. Rewrite mode splits each step that holds more than one action. The literal rule copies each code block byte for byte. Both models split code blocks. A future `SKILL.md` edit must state which rule wins.
3. The priority order in `/ste` puts technical correctness above a clean checker. F2-07 shows an agent that follows that order and fails P2. A checker gate on documents that mirror other files penalizes correct behavior.
4. The verifier needed seven fixes, A to G, before its failures matched skill behavior. Six fixes landed before the first optimization step. Every fix made the scorer render-equivalent, not more lenient on content.
5. A cheap headroom screen belongs before the freeze. One repeat on 10 documents costs about $3.50. A screen at D1 would have shown the ceiling before the corpus, the runners, and the SkillOpt adapter existed.

## Reusable machinery

These parts work and carry to the next experiment:

- `run-episode.sh` and `run-batch.sh`: native `claude -p` episodes in fresh worktrees, a leak guard, a canary, resume, a budget guard, and a named tmux session.
- `verify.sh` pattern: deterministic checks with per-check diagnostics and fault fixtures.
- `summarize.sh`: rescoring from stored outputs, per-document results, and the headroom gate.
- `check-pins.sh`: pinned digests for each frozen input.
- `optimize/`: a SkillOpt adapter at `microsoft/SkillOpt@79124b37`. The proposer runs with no tools and receives training records only. The adapter was tested with a fake `claude` only.

## Next decision (D7)

The evidence does not justify an optimizer adapter for more skills yet. The evidence also does not justify a model-weight RL spike. The next experiment reuses this machinery on a target with measured headroom.

Recommended next focus: the grounding behavior of `/prd`. This run gives direct evidence of a `/prd` gap. The plan for this experiment passed every `/prd` check and `ste-check.sh`. Three defects still reached execution:

- a file count that held only for whole files;
- two held-out families that could not supply 10 documents;
- a storage path that contradicted the `.gitignore` task rule.

Each defect cost a re-plan, a worker repair, or both. A deterministic verifier can catch this class of defect:

- each path that a plan names exists at the pinned revision, or the plan declares the path new and `.gitignore` does not ignore it;
- each command that a plan names resolves;
- each owned path of a story is trackable;
- `ste-check.sh` exits 0 and the section order matches the template.

Do these steps first:

1. Build that verifier and a corpus of closed issues with later plan corrections.
2. Run a headroom screen: one repeat on 10 issues with `claude-opus-5-5`.
3. Freeze D1 only when the screen pass rate is below 0.75.
4. If `/prd` shows no headroom, screen the PR-body and commit conventions of `/git` next.
