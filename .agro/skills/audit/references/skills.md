# Skill Lint

Inspect skill freshness, use, integrity, format, and dependencies. Report evidence-backed `CURRENT`, `STALE`, `BROKEN`, or advisory `DELETE` judgments.
Separate observations from interpretation. Do not add scores or infer usefulness from age, mentions, or passing mechanical checks.
This route reads and reports only. Never repair, delete, publish, or schedule a skill automatically.

## Contents

1. [Select and discover](#1-select-and-discover)
2. [Inspect five dimensions](#2-inspect-five-dimensions)
3. [Judge from evidence](#3-judge-from-evidence)
4. [Report and return](#4-report-and-return)

## 1. Select and discover

Arguments received: `$ARGUMENTS`

| Argument | Scope |
|---|---|
| Empty, `all`, or `root` | Canonical `$AUDIT_ROOT/.agro/skills/` |
| `<skill-name>` | That skill under the same canonical root |

Enumerate `SKILL.md` files under the canonical root, including uncommitted files. Record each skill's name, scope, directory, and file.
Do not discover through provider mirrors such as `.agents/skills` or `.claude/skills`.
If the selected skill or required evidence is missing, report the gap. Do not treat missing evidence as a completed assessment.
Apply all five questions to single-skill requests too.

## 2. Inspect five dimensions

### A. Freshness

Record file timestamps and relevant revision history as observations.
Compare the procedure with its current referenced dependencies and declared contract.
A verified mismatch supports `STALE`; cite both the instruction and the current source it contradicts.
File age alone proves neither drift nor lack of usefulness. Checkout timestamps do not establish when the procedure last worked.

### B. Use

Inspect in-repository references from crons, workflows, and other skills.
Only with explicit source authorization, inspect bounded invocation evidence, including `crons/.cron.log` when available.
Do not inspect private session traces or invent a usage collector. Keep private content and identifiers out of reports.

Distinguish references, mentions, and observed invocations. Repeated mentions in one file are not independent executions or proof of usefulness.
For actual invocation evidence, cite the event source, time range, and environment. Do not extrapolate beyond that coverage.
Without authorized invocation evidence, report usage as unknown, not never triggered.
Note absent cron coverage as an investigation question, never as a deletion or scheduling instruction.

### C. Integrity

Resolve referenced files, resources, commands, and skill dependencies against the actual repository and invocation context.
Check canonical skill paths, not provider discovery roots.
Treat extracted strings as candidates: distinguish real dependencies from examples, placeholders, optional resources, and standard Unix paths.
Do not flag `/bin`, `/usr`, or `$AUDIT_ROOT` merely because a textual extractor found them.

A missing required dependency is a concrete failure. Cite the reference and the failed resolution.
If a tool or authorization gap prevents checking a dependency, record incomplete verification instead of declaring the dependency absent.

### D. Format

Read the skill's actual frontmatter and artifact contract before checking required fields and structure.
In this canonical pack, check the opening/closing YAML delimiters, valid YAML, and required `name` and `description` fields.
Check additional fields, argument forms, sections, and resource links only when the applicable contract requires them.
A missing required field or malformed frontmatter supports `BROKEN`; cite the requirement and observed defect.
Do not require a memory protocol or a generic guidelines section in every skill.

### E. Dependencies

List required skill invocations and resource dependencies from the inspected procedure.
Verify existence and compatibility with current dependency contracts. Cite both sides of a mismatch.
A missing required dependency supports `BROKEN`; a verified procedure/dependency mismatch supports `STALE` unless it also proves a contract failure.
Do not inherit another skill's verdict, estimate health from its age, or recursively compute dependency scores.
If no dependencies apply, record that fact. If verification is incomplete, name the unchecked dependency.

## 3. Judge from evidence

Use these native labels without a total score or threshold:

| Label | Required evidence and limit |
|---|---|
| `BROKEN` | A verified contract failure, such as missing required frontmatter or a missing required dependency. Name the violated requirement. |
| `STALE` | A verified mismatch with the current source or dependency contract. Cite both locations; age alone is insufficient. |
| `CURRENT` | All applicable mechanical checks passed. This label proves neither usefulness nor behavioral correctness; usage can remain unknown. |
| `DELETE` | Proven redundancy, an identified retained replacement, and a named owner for every responsibility. The label gives advice, never deletion authority. |

Keep concrete failures visible even when another label or replacement recommendation also applies.
Do not use an unavailable required check to infer `CURRENT`, `STALE`, `BROKEN`, or `DELETE`.
Record assessment completeness separately: complete for checked applicable requirements, incomplete for named missing evidence.
Withhold any judgment that depends on missing evidence. An unknown usage history need not invalidate independently completed mechanical checks.

## 4. Report and return

Print `Skill Lint — YYYY-MM-DD` and the selected scope.
Report counts for skills examined, each native label, and incomplete assessments. Do not count withheld judgments as a native verdict.

Use a table with skill, scope, freshness evidence, use evidence, integrity, format, dependencies, verdict, and completeness.
Each finding includes a cited observation, interpretation, evidence limit, and concrete next investigation or repair recommendation.
Put verified failures first, then drift and redundancy recommendations; omit routine `CURRENT` recommendations.
Keep timestamp and mention counts descriptive. Do not rank by an additive score.

Return the structured observation to the outer dispatcher; suppress this child's terminal record and memory/retro append:

```markdown
## [Skill Lint] — HH:MM UTC
- **Result**: OP
- **Action**: inspected N skills; U assessments incomplete
- **Current**: M | **Stale**: S | **Broken**: B | **Delete**: D
- **Observation**: [top verified finding or missing-evidence limit]
```
