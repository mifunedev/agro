# Skill spend measurement (issue #1222)

## Scope

- Source: `~/.claude/projects/*/*.jsonl`, nested `subagents/*.jsonl`, and `~/.codex/sessions/**/*.jsonl`.
- Excluded: directories whose names contain `prd-efficiency-repos`, `git-screen-repos`, `prd-screen`, or `skillopt`.
- Time range: 2026-09-20T02:13Z to 2026-09-27T03:48Z (7 days).
- Total: 11,683 assistant turns. Unattributed share (`none` plus `subagent:*`): 19.5%.
- Reproduce: `python3 .agro/evals/experiments/skill-spend/measure.py` prints JSON aggregates.

## Attribution rule

1. The script counts each assistant message once, by `message.id`.
2. The script attributes each assistant turn to the most recent skill in that session. A skill is a Skill tool call (`input.skill`) or a `<command-name>` slash command that names a skill.
3. A turn before any skill invocation is `none`.
4. A subagent transcript inherits the active parent skill at the spawn tool call. If that skill is `none`, the label is `subagent:<agentType>`. If metadata is missing, the label is `subagent:unknown`.
5. Codex sessions have no skill markers. The script attributes them to `none`.

## Price table (assumed)

The table gives assumed list prices in USD per MTok. This measurement did not confirm them against a live price list. Use tokens as the primary measure.

| Model family | Input | Output | Cache write | Cache read |
|---|---|---|---|---|
| Opus (5, 5.5) | 5.00 | 25.00 | 6.25 | 0.50 |
| Sonnet 5 | 3.00 | 15.00 | 3.75 | 0.30 |
| Haiku 4.5 | 1.00 | 5.00 | 1.25 | 0.10 |

The script prices `claude-fable-5-1` (527 turns) and the Codex models (6 turns) at 0.

## Per-model totals

| Model | Turns | Output tok | Cache write tok | Cache read tok | Est. USD |
|---|---|---|---|---|---|
| claude-opus-5-5 | 5,489 | 1.96M | 18.6M | 1,104M | 717.56 |
| claude-opus-5 | 5,026 | 2.49M | 12.8M | 1,139M | 711.47 |
| claude-sonnet-5 | 631 | 0.05M | 1.5M | 48.5M | 21.03 |
| claude-fable-5-1 | 527 | 0.13M | 1.8M | 39.9M | unpriced |
| claude-haiku-4-5 | 4 | <0.01M | 0.04M | 0.08M | 0.06 |
| gpt-5.6-sol, gpt-6-astra | 6 | <0.01M | 0 | 0.07M | unpriced |

Cache reads are about 95% of estimated Opus cost.

## Ranked by total cost

| Skill | Sessions | Invocations | Turns | Output tok | Cache read tok | Est. USD | USD per invocation |
|---|---|---|---|---|---|---|---|
| delegate | 6 | 7 | 3,218 | 1.21M | 724M | 441.57 | 63.08 |
| prd | 5 | 13 | 3,618 | 1.20M | 689M | 428.11 | 32.93 |
| none | 32 | - | 1,633 | 0.95M | 404M | 250.07 | - |
| ci-status | 5 | 5 | 333 | 0.13M | 72M | 46.19 | 9.24 |
| ralph | 1 | 1 | 554 | 0.22M | 78M | 41.91 | 41.91 |
| subagent:general-purpose | 3 | - | 550 | 0.08M | 38M | 32.01 | - |
| retro | 3 | 3 | 192 | 0.12M | 42M | 26.61 | 8.87 |
| cloudflared | 1 | 1 | 168 | 0.07M | 45M | 25.80 | 25.80 |
| wiki | 1 | 2 | 89 | 0.05M | 44M | 23.68 | 11.84 |
| release | 2 | 2 | 244 | 0.07M | 34M | 23.52 | 11.76 |
| spec | 3 | 3 | 253 | 0.11M | 34M | 23.01 | 7.67 |
| architect | 3 | 3 | 154 | 0.12M | 29M | 22.11 | 7.37 |
| herdr | 1 | 1 | 90 | 0.05M | 31M | 16.89 | 16.89 |
| council | 2 | 2 | 153 | 0.10M | 16M | 13.46 | 6.73 |
| other (8 labels) | - | - | 434 | 0.17M | 51M | 35.16 | - |

## Ranked by cost per invocation (3 or more invocations)

| Skill | Invocations | USD per invocation |
|---|---|---|
| delegate | 7 | 63.08 |
| prd | 13 | 32.93 |
| ci-status | 5 | 9.24 |
| retro | 3 | 8.87 |
| spec | 3 | 7.67 |
| architect | 3 | 7.37 |

## Recommended next SkillOpt target: `delegate`

Evidence:

- `delegate` has the highest total cost (441.57 USD, 31% of priced spend).
- `delegate` has the highest cost per invocation among skills with 3 or more invocations (63.08 USD).
- `prd` is second on both measures. The `prd-efficiency` experiment already targets `prd`.

Caveats:

- Sample size: 7 invocations in 6 sessions. Treat the per-invocation value as an order of magnitude.
- Time range: 7 days only.
- Attribution error: the "most recent skill" rule assigns all later session turns to `delegate`. This includes worker integration and unrelated follow-up work. The measured cost is an upper bound on the cost that `delegate` itself causes.
- Before SkillOpt runs, measure the `delegate` overhead in isolated episodes, not in this attribution.

## Too few invocations to optimize

These skills have 2 or fewer invocations: `ralph`, `cloudflared`, `wiki`, `release`, `herdr`, `council`, `vercel:deployments-cicd`, `agent-browser`, `supervisor`, `worktrees`, `audit`, `git`. Do not select them until the sample grows.
