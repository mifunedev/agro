# Evidence — retire-open-harness-name (#1058)

Branch `task/1058-retire-open-harness-name`. PR #1060.

## Result

| Measure | Before | After |
|---|---|---|
| Hits | 289 | 136 |
| Files | 131 | 67 |

Every remaining hit belongs to a retained class. The full table lives in
`classification.md`.

## D-US-001 — the always-on context file

Worker W1, merged at 75756333.

```
head -1 AGENTS.md                                   -> # AGRO — Orchestrator
bash .agro/evals/probes/agents-identity-contract.sh  -> PASS, exit 0
bash .agro/skills/ste/scripts/ste-check.sh AGENTS.md -> exit 0
ls -l CLAUDE.md                                      -> CLAUDE.md -> AGENTS.md
git grep -n "Open Harness" -- <12 owned paths>       -> no hits
```

The probe pins the product-identity heading, so
`.agro/evals/probes/agents-identity-contract.sh:13` moved from
`## What Open Harness is` to `## What AGRO is` in the same commit. That line is
the only probe edit in this change.

## D-US-002 — root and configuration surfaces

The generated filename `/etc/ssh/sshd_config.d/openharness.conf` stays. The
`.example.env` box rule keeps its column width.

The story's original criterion demanded `ste-check.sh` exit 0 on each changed
Markdown file. Five of those files already carried findings, in Apache-2.0
trademark wording and inbound-license clauses. Clearing them means rewriting
legal prose, which a rename must not do. The owner amended the criterion to
"gains no new finding" and verified the counts:

```
README.md            before=12 after=12
CONTRIBUTING.md      before=8  after=8
SECURITY.md          before=3  after=3
projects/AGENTS.md   before=5  after=5
.worktrees/AGENTS.md before=4  after=4
```

## D-US-003 — the documentation surface

Worker W2, merged at 7648eb1a. 28 files under `docs/`.

```
git status --porcelain | grep -v '^ M docs/'  -> none
git status --porcelain | grep docs/rfcs       -> none
git diff -U0 -- docs/ | grep -E '(openharness|oh\.mifune\.dev|get-oh|@mifune/)'
                                              -> no artifact-name lines touched
grep -rn "running-open-harness-on-microsandbox" docs/ -> no stale anchors remain
```

The MicroSandbox heading changed, so all four inbound anchors moved with it and
each resolves.

Three files keep the retired name on purpose:

- `docs/glossary.md` records it as the former name.
- `docs/agro-compatibility.md` documents the alias it names.
- `docs/repair-sandbox-boot-advisory.md` quotes `systemctl` output verbatim.
  The line carries the live `Description=` of `openharness-bootstrap.service`,
  which is `external` class. A rewrite would show a reader output that never
  appears.

Spot-checked finding counts, base against tip: 45/45, 39/39, 34/34, 25/24,
13/13.

`docs/open-core.md` describes the current boundary, not a former one: present
tense, the `agro` CLI in its Apache-2.0 column, live `LICENSE` links, and a
"Prior releases" section that partitions the past. Both hits renamed. OQ-1
closed.

## D-US-004 — skill and script surfaces

Worker W3, merged at 08b91000 and 0ab50172. 28 files, then 3 more.

```
bash .agro/scripts/link-providers.sh --check  -> exit 0
bash -n <four scripts>                        -> exit 0 each
git diff -U0 | grep -E '(ghcr\.io|@mifune/|openharness-|oh\.mifune\.dev|get-oh)'
                                              -> no artifact-name lines touched
frontmatter parse, 8 touched SKILL.md         -> keys intact on each
grep -c "TRIGGER when:" <6 touched skills>    -> 1 each, byte-identical
npx vitest run .agro/scripts/__tests__/install-prereqs.test.ts -> 8 passed
```

Five skill descriptions named the retired product as the current one. Each keeps
every trigger phrase, because a lost trigger stops a skill from loading with no
error.

## D-US-005 — the classification, and two defects in it

The worker found both. The owner confirmed both.

**A line-based grep never matches a wrapped phrase.** `git grep` matches within
one line, so the first count missed every occurrence split across a newline. A
wrap-aware scan over every tracked file found five. This change swept three and
retained two: this task's own PRD and the RFC index. The first
classification carried no row at all for one of the swept three,
`.agro/skills/t3/references/sandbox-processes.md`.

**A test that asserts prose is not a test fixture.**
`.agro/scripts/__tests__/install-prereqs.test.ts` pins two installer strings
as prose, not as a retained default. The worker declined to edit one side and
turn the suite red, and reported the conflict instead. The owner reclassified
those two lines. One commit then renamed both sides.

```
bash .agro/skills/eval/run.sh -> ran 150 probe(s)
REGRESSIONS: none
```

`next-dev-prod` moved from SKIPPED to REGRESSION. The probe detects a running
`next dev` process, PID 246256, which started outside this task. A prose rename
starts no process. The other three persistent red entries stay unchanged.

## Test suite, and one honest caveat

```
npx vitest run  -> run 1: 2 files failed, 1 test failed
                -> run 2: 80 passed (80), 1436 passed (1436)
                -> runs 3, 4, 5: 80 passed (80)
```

The first run failed and named no failing test in its output. Four later runs
were clean. Worker W3 saw the same shape independently: one failure in 509,
unnamed, then three clean runs.

The suite carries an observed flake. A prose rename cannot produce an
intermittent failure. Every test that touches a changed line passed on every
run. Two local runs of the full suite produced one unnamed failure.
A later CI failure of the same shape can cite this observation.
