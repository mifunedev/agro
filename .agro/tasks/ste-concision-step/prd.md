# PRD: A concision step and a synced wordy-phrase list for /ste

Status: DRAFT

## User Stories

### US-001: Concision step in rewrite mode

**Description:** As a writer, I want rewrite mode to name the concision step. I then cut restated text without a merge of steps or a loss of meaning.

**Acceptance Criteria:**

- [ ] `.agro/skills/ste/SKILL.md` § Rewrite mode has a step after the step that splits a step with more than one action, and before the placeholder step. The step says: delete each sentence, clause, or table row that restates a fact stated elsewhere in the document, unless the text adds a condition, an actor, a value, or a warning.
- [ ] The same step says: never merge steps, and never drop a precedence or an order, to cut length.
- [ ] The step cites rule 53 in `references/rules.md`.
- [ ] The section intro names the new step count, and the steps stay numbered in sequence.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/ste/SKILL.md` reports no finding.

### US-002: Wordy phrases in the WORD detector

**Description:** As a writer, I want the checker to flag each wordy phrase that the dictionary lists. The checker then enforces the dictionary instead of a subset of it.

**Acceptance Criteria:**

- [ ] The `WORD` list in `.agro/skills/ste/scripts/ste-check.sh` holds each phrase of `references/dictionary.md` § Wordy phrases, and the phrases `note that`, `make sure`, `be sure to`, and `keep in mind` of § Marketing and filler.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh --blocks after .agro/skills/ste/references/examples.md` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh --blocks before .agro/skills/ste/references/examples.md` exits 1.
- [ ] A phrase that matches text inside a word of an `after` specimen is left out, and the report names the phrase.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/ste/SKILL.md .agro/skills/ste/references/rules.md` reports no new finding.

### US-003: Manual review evidence

**Description:** As the operator, I want a record of the checker on real text. I can then see the new findings before the change lands.

**Acceptance Criteria:**

- [ ] `.agro/tasks/ste-concision-step/evidence/manual-review.md` records both fixture commands with their exit codes and finding counts.
- [ ] The evidence records the finding count of the new phrases on each `SKILL.md` and each `docs/*.md` file of the harness, before and after the change, and quotes up to 10 new findings.
- [ ] The evidence marks each quoted finding as a true or a false positive.
- [ ] The story changes no document outside `.agro/skills/ste/` to fix a new finding.

## Summary

A council review on 2026-11-01 compared four options for a concision rule in `/ste`: no change, a rewrite-mode step, new detectors, and an opt-in `--concise` flag. Three read-only members agreed that a line-based checker cannot see the main verbosity in a real rewrite (agro-console commit `b1be3820`): restated facts and merged steps. Length budgets and word-count deltas rewarded the wrong cuts. Fixed filler phrases tested clean on the approved `after` specimens.

The dictionary lists 19 phrases in § Wordy phrases and four filler phrases (`note that`, `make sure`, `be sure to`, `keep in mind`) that the `WORD` list in `ste-check.sh` does not hold. The rewrite mode in `SKILL.md` has eight steps and no concision step.

## Key Integration Points

| File | Function(s) / Symbol(s) | Role |
|---|---|---|
| `.agro/skills/ste/SKILL.md` | § Rewrite mode | Holds the new step. |
| `.agro/skills/ste/scripts/ste-check.sh` | `WORD` list (`split("utilize|…")`) | Holds the phrases. |
| `.agro/skills/ste/references/dictionary.md` | § Wordy phrases, § Marketing and filler | The source of the phrases. Unchanged. |
| `.agro/skills/ste/references/rules.md` | rule 53 | The cited rule. Unchanged. |
| `.agro/skills/ste/references/examples.md` | `before` and `after` blocks | The regression fixture. Unchanged. |

## Interface Integration Points

| Surface | Change Type | Description |
|---|---|---|
| `/ste` rewrite mode | New step | Cut restated text; never merge steps. |
| `ste-check.sh` | More `WORD` matches | New findings on text that uses a listed phrase. |

## Storage

N/A. The checker keeps no state.

## Architectural Decisions

- The dictionary stays the source of the phrases. The `WORD` list copies the phrases. The plan adds no parser of `dictionary.md`.
- The checker gets no concision detector, no flag, and no length budget, per the council brief.

## Test Plan (TDD)

| Test File | Case(s) | Validates |
|---|---|---|
| `.agro/skills/ste/references/examples.md` | `--blocks after` exits 0; `--blocks before` exits 1 | US-002 |
| `.agro/tasks/ste-concision-step/evidence/manual-review.md` | fixture runs; new findings on harness docs | US-003 |

## Design Principles

- Enforce what the dictionary already says before a new rule.
- Rank concision below correctness, meaning, terms, and sequencing.

## Out of Scope

- A `--concise` flag, paragraph budgets, word-count deltas, and repeated-text detectors.
- Fixes to harness documents for new findings.
- A parser that reads the phrases from `dictionary.md`.

## Open Questions

None.

## Acceptance Criteria

- [ ] `bash .agro/skills/ste/scripts/ste-check.sh --blocks after .agro/skills/ste/references/examples.md` exits 0.
- [ ] `bash .agro/skills/ste/scripts/ste-check.sh --blocks before .agro/skills/ste/references/examples.md` exits 1.
- [ ] The harness CI checks pass on the PR.

## Lessons
