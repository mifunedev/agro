# Manual review: the ste concision step and the synced WORD list

Story: US-003 of mifunedev/agro#1552. Base: `origin/development` at
`a4884302939f3f142da9331e82288c1731b03d8e`. Head of the run:
`0b87d61bdd459db2160f92d84e27a3f3788e6e3f`.

## A. The fixture

Prerequisites: a checkout of the task branch. Runs in the sandbox, local.

1. Run the checker against the approved specimens:

   ```bash
   bash .agro/skills/ste/scripts/ste-check.sh --blocks after .agro/skills/ste/references/examples.md
   ```

   Observed output starts with `ste-check: no findings in 1 file(s).`
   Observed exit status: 0. Findings: 0.

2. Failure path. Run the checker against the specimens that break the rules:

   ```bash
   bash .agro/skills/ste/scripts/ste-check.sh --blocks before .agro/skills/ste/references/examples.md
   ```

   Observed output starts with `ste-check: 94 finding(s) in 1 file(s).`
   Observed exit status: 1. Findings: 94. The checker on
   `origin/development` reports 90 findings on the same blocks. The four
   new findings are `WORD` findings. The table in section C lists them.

## B. The harness documents

Prerequisites: the step A checkout. Runs in the sandbox, local.

1. Save the checker of the base branch:

   ```bash
   git show origin/development:.agro/skills/ste/scripts/ste-check.sh > /tmp/ste-check-before.sh
   ```

2. Run each checker on each file, one file at a time:

   ```bash
   for f in .agro/skills/*/SKILL.md docs/*.md; do
     b=$(bash /tmp/ste-check-before.sh "$f" 2>/dev/null | grep -c .)
     a=$(bash .agro/skills/ste/scripts/ste-check.sh "$f" 2>/dev/null | grep -c .)
     [ "$b" = "$a" ] || printf '%s %s %s\n' "$f" "$b" "$a"
   done
   ```

   Observed output: `.agro/skills/langfuse/SKILL.md 9 10`.

3. Delete the saved checker:

   ```bash
   rm /tmp/ste-check-before.sh
   ```

The run scans 37 files: 25 `SKILL.md` files and 12 `docs/*.md` files. One
file has a different count. The other 36 files have the same count before and
after the change.

| File | Before | After |
|---|---|---|
| `.agro/skills/langfuse/SKILL.md` | 9 | 10 |
| Total of 37 files | 102 | 103 |

The diff of the two outputs for `.agro/skills/langfuse/SKILL.md` holds one
new line and no removed line:

```text
.agro/skills/langfuse/SKILL.md:131: WORD replace the non-approved word "note that"
```

## C. The new findings

The run finds one new finding in the harness documents and four new findings
in the fixture. Each new finding has the rule id `WORD`.

| # | Location | Phrase | Verdict | Reason |
|---|---|---|---|---|
| 1 | `.agro/skills/langfuse/SKILL.md:131` | `note that` | True positive | The phrase adds no fact. `Changelog posts can also surface here` keeps the meaning. |
| 2 | `.agro/skills/ste/references/examples.md:54` | `make sure` | True positive | A `before` specimen. The dictionary replaces the phrase with `verify` or `confirm`. |
| 3 | `.agro/skills/ste/references/examples.md:233` | `note that` | True positive | A `before` specimen. The phrase adds no fact before the warning. |
| 4 | `.agro/skills/ste/references/examples.md:233` | `make sure` | True positive | A `before` specimen. `Back up the data first` states the action. |
| 5 | `.agro/skills/ste/references/examples.md:264` | `make sure` | True positive | A `before` specimen. `Install the prerequisites` states the action. |

The source lines:

```text
.agro/skills/langfuse/SKILL.md:131
Search is a great fallback if you cannot find the relevant pages or need more context. Especially useful when debugging issues as all GitHub Issues and Discussions are also indexed. Responses can be large — extract only the relevant portions. Note that changelog posts may also surface here: use them only to confirm a feature exists, never to implement from — their examples may be outdated, so always implement from the docs and API/SDK reference.

.agro/skills/ste/references/examples.md:54
You should probably make sure that Docker socket support is turned on before you go ahead and run the container.

.agro/skills/ste/references/examples.md:233
Run `agro destroy` to reset the sandbox. Note that this will also remove the volumes and the data in them is deleted permanently, so make sure you have a backup of anything important before you go ahead.

.agro/skills/ste/references/examples.md:264
Before you begin, make sure that several prerequisites are installed and that the system is configured properly, since otherwise the installer may fail for reasons that are hard to diagnose.
```

The run finds no false positive. The story changes no file outside
`.agro/skills/ste/` to fix a finding. Line 131 of
`.agro/skills/langfuse/SKILL.md` stays unchanged.

## D. The rewrite step

`.agro/skills/ste/SKILL.md` § Rewrite mode now holds nine steps. Step 7 is the
new step:

```markdown
7. Delete each sentence, clause, or table row that restates a fact stated
   elsewhere in the document, unless the text adds a condition, an actor, a
   value, or a warning. Never merge steps, and never drop a precedence or an
   order, to cut length. Rule 53 in `references/rules.md` governs this step.
```

To verify the step, run these commands in the sandbox:

```bash
sed -n '/^## Rewrite mode/,/^## Authoring mode/p' .agro/skills/ste/SKILL.md
bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/ste/SKILL.md
```

Expected: the first command prints `Run these nine steps` and steps 1 to 9 in
sequence. Step 7 comes after the step that splits a step, and before the
placeholder step. The second command exits 0 with no finding.
