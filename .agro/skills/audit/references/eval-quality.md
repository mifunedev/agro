# Eval Lint

Inspect probes and capability tasks against seven evidence questions. Recommend `KEEP`, `GROOM`, or `CUT` with reasons, not flag counts.
This route reads and reports only. Never edit, move, delete, or rewrite an eval artifact during the audit.
Do not add a scoring engine, history collector, or probe for this grooming procedure.

## Contents

1. [Select targets and preserve state](#1-select-targets-and-preserve-state)
2. [Inspect seven questions](#2-inspect-seven-questions)
3. [Triage observed failures](#3-triage-observed-failures)
4. [Recommend and report](#4-recommend-and-report)
5. [Compare before and after](#5-compare-before-and-after)

## 1. Select targets and preserve state

Arguments received: `$ARGUMENTS`

| Argument | Scope under `AUDIT_ROOT` |
|---|---|
| Empty or `all` | All probes and capability tasks |
| `probes` | `.agro/evals/probes/*.sh` |
| `capability` | `.agro/evals/capability/tasks/CB-*.md` |
| `<probe-or-task-id>` | The named probe basename or `CB-NNN` task |

Discover actual files, including uncommitted files. Apply all seven questions to each selected target; question 7 remains a suite-level advisory.
Missing targets or inaccessible evidence make coverage incomplete, not clean.
Use authorized repository evidence and existing authorized CI history only. Do not inspect private session traces.
If permission prevents a required read, record the gap and withhold the dependent judgment.

Before investigation, capture the eval tree with the function in section 5.
Keep the capture outside the repository and include pre-existing dirty files.
Do not run `/eval` here: its scoreboard write belongs to a separate operation, not this read-only audit.

## 2. Inspect seven questions

For each question, record the observation, source location, interpretation, and missing evidence separately.

### 1. Stale

Read each probe's `# source:` header, cited paths, and guarded assertion.
For capability tasks, check `datasets:` references and the most-recent real-instance pointer.
Determine whether the lesson, source, and intended contract still apply. Cite current and prior sources for a drift claim.
Timestamps describe file history; age alone does not prove staleness.
A moved citation can require grooming without invalidating the assertion.

### 2. Duplicate

Use normalized hashes, shared source issues, and overlapping asserted strings only to locate candidates.
Compare their actual assertions, invariants, input domains, environment guards, and intended scope.
A duplicate finding requires the same invariant and scope plus an identified retained replacement.
Shared issue numbers, matching fragments, or normalization collisions alone do not prove redundancy.
Preserve distinct responsibilities when recommending consolidation.

### 3. Always-SKIP-in-CI

Read the target's latest `.agro/evals/RESULTS.md` row with its run context.
One `SKIPPED` row establishes one observed skip, not permanent ineffectiveness. An `exit 2` occurrence proves no execution history.
Analyze source paths, guards, dependencies, and intended environments before claiming the assertion is unreachable across its intended scope.
A permanent-skip claim requires that source-path proof; a runnable intended-environment path refutes the claim.
Existing authorized CI history can support a bounded historical claim. State its time range, environments, and missing runs.
Do not invent a persistence threshold or history collector. Without decisive evidence, withhold removal advice.

### 4. Implementation detail rather than user outcome

Inspect literal and line-number assertions against the intended public contract.
Identify whether a harmless refactor would fail the assertion or a real regression could pass it.
A narrow string can enforce a real interface; its presence alone does not prove a weak instrument.
Recommend grooming only with the brittle assertion and the intended replacement outcome identified.

### 5. No longer held out

Apply `.agro/evals/capability/AGENTS.md` to capability tasks and fixtures.
Trace suspected special-casing from benchmark material into non-eval harness behavior.
Distinguish ordinary documentation, provenance, and scorer references from tuning the implementation to the holdout.
Proven contamination can justify advisory `CUT` or redesign. Cite the contaminated assertion and implementation path.
Never delete a difficult capability task to inflate the suite score.

### 6. Too easy, narrow, or special-cased

Inspect the assertion and reachable pass/fail paths, not just file length or assertion count.
A short decisive probe can be valid; a shared issue can support different assertions.
Check unconditional success, tautologies, and guards that exempt the exact condition the probe claims to test.
A proven tautology can justify advisory `CUT`; a missing but repairable assertion can justify `GROOM`.
Name the failing condition the instrument should detect. Do not create a fixture-only scoring oracle that repeats expected verdicts.

### 7. Machinery growth without capability movement

Compare probe count and capability results over the same revision span and comparable task sets.
Disclose changed coverage, missing results, and differences in environment or rubric.
Growth with a flat ceiling is a suite-level redirect signal, not a per-target removal rule.
Report the comparison in the footer; do not infer benefit or ineffectiveness from probe count alone.

## 3. Triage observed failures

Before recommending a change, resolve both questions:

1. **Defect or intended policy?** Search probes for both the source path and words describing the behavior.
   Read matching assertions and the governing contract. A path-only search can miss a behavior guarded through procedure text.
2. **Local failure or intended-environment failure?** Inspect existing authorized CI evidence for the same target and revision.
   Record environment and dependency differences. Local red with CI green requires diagnosis, not automatic removal or a declaration that the source is sound.

An unavailable tool or CI record is an evidence gap, not a defect in the audited target.
If either answer remains material and unknown, withhold the dependent verdict.

## 4. Recommend and report

| Label | Evidence-backed interpretation |
|---|---|
| `KEEP` | The checked assertion still guards its intended invariant within the inspected scope. State limits; the label does not establish universal validity. |
| `GROOM` | A cited, repairable defect needs a concrete change: repair provenance, broaden a case, differentiate overlap, or assert the intended outcome. |
| `CUT` | Evidence supports retirement or redesign, such as proven duplication, unreachable assertion, tautology, or holdout contamination. Preserve responsibility ownership and name any retained replacement. |

No flag total, fatal-marker shortcut, size threshold, timestamp, or single skip determines these judgments.
`CUT` is advice only. If required evidence is missing, leave the verdict withheld and record incomplete assessment separately from native labels.

Print `Eval Lint — YYYY-MM-DD`, scope, target counts, verdict counts, and incomplete/withheld counts.
Use one row per target with class, seven-question evidence, cited reasons, native verdict or withheld judgment, and completeness.
Order actionable findings first. Include per-target recommendations and the question-7 suite advisory.
Report the section-5 state comparison separately; a mismatch does not itself prove which process changed the files.

Return the structured observation to the outer dispatcher and suppress a child terminal record:

```markdown
## [Eval Lint] — HH:MM UTC
- **Result**: OP
- **Action**: inspected N probes + M capability tasks; U assessments incomplete
- **Keep**: K | **Groom**: G | **Cut**: C
- **Observation**: [top finding, evidence gap, or state-comparison failure]
```

## 5. Compare before and after

Use this capture function before investigation and after reporting.
Require Python 3.11 or newer and Git. Missing tools, unreadable files, unauthorized scope, or capture errors block the read-only claim.
The capture records status, staged content, file hashes, types, symlink targets, and modes, including ignored and untracked eval files.
Do not follow symlinks or print raw file contents. Concurrent writers require an isolated rerun; never restore their changes.

```bash
capture_eval_state() {
  : "${AUDIT_ROOT:?outer audit dispatcher did not export AUDIT_ROOT}"
  python3 - "$AUDIT_ROOT" "$1" <<'PY'
import hashlib
import json
import os
import stat
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
tree = root / ".agro/evals"
if tree.resolve() != tree or not tree.is_dir():
    raise SystemExit("eval tree must be a canonical real directory")
def fail(error):
    raise error
paths = [tree]
for directory, directories, files in os.walk(tree, followlinks=False, onerror=fail):
    paths.extend(Path(directory) / name for name in directories + files)
entries = []
for path in sorted(paths):
    mode = path.lstat().st_mode
    if stat.S_ISLNK(mode):
        value = os.readlink(path)
    elif stat.S_ISREG(mode):
        with path.open("rb") as source:
            value = hashlib.file_digest(source, "sha256").hexdigest()
    elif stat.S_ISDIR(mode):
        value = None
    else:
        raise SystemExit("unsupported eval file type")
    entries.append([str(path.relative_to(root)), mode, value])
def git(*args):
    return subprocess.check_output(["git", "--no-optional-locks", "-C", str(root), *args]).hex()
snapshot = {
    "entries": entries,
    "status": git("status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ".agro/evals/"),
    "index": git("ls-files", "--stage", "-z", "--", ".agro/evals/"),
}
Path(sys.argv[2]).write_text(json.dumps(snapshot, sort_keys=True) + "\n")
PY
}
umask 077
state=$(mktemp -d /tmp/eval-audit-state.XXXXXX) || exit "$?"
capture_eval_state "$state/before.json" || exit "$?"
```

If the first capture fails, stop before investigation. Otherwise retain `$state` and the function in the same shell context.
After the read-only investigation, run:

```bash
capture_eval_state "$state/after.json" || exit "$?"
cmp -- "$state/before.json" "$state/after.json" || exit "$?"
```

Require both captures and `cmp` to exit 0 before claiming unchanged state.
A pre-existing dirty file passes when its content and status stay unchanged.
A mutation to that same file fails even if its porcelain status remains identical.
On mismatch or error, report the gap and retain the captures for diagnosis. Do not blame or overwrite operator changes.
After reporting a successful comparison, remove only this invocation's temporary captures.
