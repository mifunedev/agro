# Annotation

Read this reference before you take a screenshot for a task, an acceptance
criterion, or the `## Manual review` section of a pull request. An annotated
screenshot shows the reviewer which value to check. A plain screenshot makes
the reviewer search for the value.

## Contents

- [Rules](#rules)
- [Choose the callouts](#choose-the-callouts)
- [Take the screenshot](#take-the-screenshot)
- [Before and after](#before-and-after)
- [Built-in annotate](#built-in-annotate)
- [Publish the screenshot](#publish-the-screenshot)
- [Failures](#failures)

## Rules

- Annotate each screenshot that is evidence. Use a plain screenshot only for a
  quick look that no reviewer reads.
- Add one callout for each value that an `Expected:` line names. Do not add a
  callout for decoration.
- Take the screenshot after the assertion ran, in the same session and state.
  The screenshot shows the state that the assertion checked.
- Put the `Callouts:` line that the script prints directly under the
  screenshot. Never write the line by hand.
- Keep each screenshot under `.agro/tasks/<task>/evidence/`. Use an absolute
  path.
- A screenshot supports an assertion. A screenshot never replaces an assertion
  or a test.

## Choose the callouts

| Claim | Callout target |
|---|---|
| A value or a status text | The element that shows the text, for example `#status` |
| A control state | The control, for example `#save` or `[aria-expanded=true]` |
| A layout or spacing change | The container whose layout changed |
| A before and after pair | The same selectors and labels in both screenshots |

Write each label as a short noun phrase that names the value, for example
`the saved name` or `the Baseline time`. The script numbers the callouts in
argument order. Give the callouts in the order that the reviewer reads the
steps.

## Take the screenshot

`scripts/annotate-screenshot.sh` draws one numbered red box and badge on each
matched element, takes the screenshot, removes the callouts, and prints the
`Callouts:` line. Give the session through `AGENT_BROWSER_SESSION`:

```bash
SCREENSHOT_PATH="$(git rev-parse --show-toplevel)/.agro/tasks/$TASK/evidence/save-name-desktop.png"
AGENT_BROWSER_SESSION="$SESSION" bash .agro/skills/agent-browser/scripts/annotate-screenshot.sh \
  "$SCREENSHOT_PATH" '#name=the entered name' '#status=the saved name'
```

Output:

```text
Callouts: 1 is the entered name. 2 is the saved name.
```

Each argument after the path is `<selector>=<label>`. The script splits the
pair at the last `=`. A selector can contain `=`, for example
`[data-state=open]=the open menu`. A label cannot contain `=`.

The script uses the viewport of the session. Set the viewport from the
dimension table in `SKILL.md` before `open`. For a desktop and mobile claim,
take one annotated screenshot for each profile with the same callouts.

## Before and after

For a change or a bug fix, prove the difference with a diff, then annotate the
after state.

1. Save the before state, before the action or on the base commit.
   `EVIDENCE` is `$(git rev-parse --show-toplevel)/.agro/tasks/$TASK/evidence`:

   ```bash
   agent-browser --session "$SESSION" screenshot "$EVIDENCE/before.png"
   agent-browser --session "$SESSION" snapshot > "$EVIDENCE/before.snapshot.txt"
   ```

2. Do the action, or load the fixed build.
3. Compare the accessibility tree. Always give `--baseline`. Without it, the
   "before" side is empty.

   ```bash
   agent-browser --session "$SESSION" diff snapshot \
     --baseline "$EVIDENCE/before.snapshot.txt" > "$EVIDENCE/snapshot.diff"
   ```

4. Compare the pixels. The command exits 0 when the images differ. Read
   `match` from the JSON output:

   ```bash
   agent-browser --session "$SESSION" diff screenshot \
     --baseline "$EVIDENCE/before.png" --output "$EVIDENCE/diff.png" --json \
     | jq '.data | {match, mismatchPercentage}'
   ```

   `diff.png` marks the changed pixels. To compare one element and ignore
   unrelated changes such as clocks, take the baseline of that element in
   step 1 with `screenshot '#status' "$EVIDENCE/before-status.png"`, and give
   the same selector with `--selector '#status'`. A full-page baseline against
   an element always reports 100% mismatch.

5. Take the annotated after screenshot with the same callouts as the claim.

Report the snapshot diff lines that prove the claim. A pixel diff shows where
the page changed. It does not show that the change is correct.

## Built-in annotate

`agent-browser screenshot --annotate` labels each element that has a ref,
for example `[2]` for `@e2`, and prints a legend such as
`[2] @e2 textbox "Name"`. Use it to orient a
vision model on an unknown page. Do not use it as evidence: it marks every
control, not the values that the reviewer checks.

## Publish the screenshot

Git ignores `.agro/tasks/*/*`. To link a screenshot in a pull request:

1. Commit the file with `git add -f <path>`.
2. Link the file by `blob/<commit-sha>/<path>?raw=true`. `<commit-sha>` is
   the full head commit of the pull request. Never link by a branch name.
3. Put the image in a `<details><summary>Screenshot</summary>` block under the
   step, and put the `Callouts:` line under the image.

`.agro/skills/git/references/manual-review.md` owns the full `## Manual review`
format.

## Failures

| Exit | Cause | Action |
|---|---|---|
| 1 | A selector matches no element | The script names the selector and writes no file. Fix the selector, or report that the expected element is missing. |
| 1 | `agent-browser` is missing, or the screenshot is empty | Run the preflight in `SKILL.md`. |
| 2 | Bad usage, for example a pair without `=` | Fix the arguments. |

A missing element can be the defect under test. Do not remove the callout to
make the script pass.
