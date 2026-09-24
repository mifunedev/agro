# Tracker: convert prd.md to prd.json

Convert an approved `.agro/tasks/<slug>/prd.md` to `.agro/tasks/<slug>/prd.json`
in the same folder. The folder name is the slug. Do not derive the slug again.

## Inputs

- The task folder, for example `.agro/tasks/install-prereq-detection/`.
- `--issue <N>`: the GitHub issue number. This argument is required.
- `--prefix <feat|bug|task|audit|skill>`: the branch prefix. The default is `feat`.

If `--issue` is missing, stop and write nothing. Print this message:
"issue number required: open the GitHub issue first per `.agro/skills/git/SKILL.md`, then run again with `--issue <N>`."

## Output schema

```json
{
  "schemaVersion": 1,
  "project": "<project name>",
  "branchName": "<prefix>/<N>-<slug>",
  "description": "<feature description from the prd.md title and summary>",
  "userStories": [
    {
      "id": "US-001",
      "title": "<story title>",
      "description": "As a <role>, I want <capability> so that <benefit>.",
      "acceptanceCriteria": ["<criterion copied from prd.md>"],
      "priority": 1,
      "passes": false,
      "notes": "",
      "dependsOn": [],
      "files": ["<path the story owns>"],
      "commit": "<accepted commit>"
    }
  ]
}
```

Example: folder `.agro/tasks/install-prereq-detection/`, `--issue 175`, and
`--prefix task` give `"branchName": "task/175-install-prereq-detection"`.

The story fields `dependsOn`, `files`, and `commit` are optional:

- `dependsOn`: the IDs of the stories that must pass first. The advisor uses this field to run independent stories in parallel waves.
- `files`: the paths that the story owns. The advisor uses this field to keep parallel writers apart.
- `commit`: the accepted commit. The advisor writes this field after acceptance.

The optional fields need no `schemaVersion` change. Each tool must accept a story without them.
Omit `commit` at conversion time.

## Field ownership

- Only the advisor writes `passes`, `commit`, and `notes`, and only after acceptance.
- `notes` records each acceptance criterion as executed (command and exit status) or reasoned.
- Workers never write `prd.json`.

## Conversion rules

1. Convert each story in `prd.md` to one entry in `userStories`.
2. Give the IDs in sequence, starting at `US-001`.
3. Set `priority` by dependency order first, then by document order.
4. Set `passes: false` and `notes: ""` on each story.
5. Copy each acceptance criterion from `prd.md` verbatim.
6. Add "Typecheck passes" only when the repository has a typecheck command. Do not add it otherwise.
7. Keep "Verify in browser using agent-browser skill" on each story that changes a user interface.

## Story size

One story is one focused implementation session.
A worker starts each story with no memory of other stories.
A worker can fail to complete a large story.

Rule: if you cannot describe the change in 2 or 3 sentences, split the story.

Example: "Add a notification system" is too large. Split it into:

1. `US-001`: Add the notifications table.
2. `US-002`: Add the service that sends notifications.
3. `US-003`: Add the notification bell and dropdown to the header.

## Story order

- An earlier story never depends on a later story.
- Each ID in `dependsOn` must name a story with a lower `priority` number.
- Put storage and schema changes first, then backend logic, then the user interface.

## Rerun

If `prd.json` exists and a story has `passes: true`, ask the operator before
you replace the file. Never reset an accepted story without the operator's consent.

## Checklist before saving

- [ ] The folder name is the slug, and `branchName` is `<prefix>/<N>-<slug>`.
- [ ] `schemaVersion` is `1`.
- [ ] Each story fits one focused session.
- [ ] No story depends on a later story.
- [ ] Each acceptance criterion is binary and verifiable.
- [ ] Each user-interface story has the agent-browser criterion.
- [ ] No accepted story was reset without the operator's consent.

## Verification

Run each command from the task folder. Each command must exit 0.

```bash
jq -e . prd.json
jq -e '.branchName | test("^(feat|bug|task|audit|skill)/[0-9]+-[a-z0-9-]+$")' prd.json
jq -e '[.userStories[].id] as $ids | all(.userStories[]; all((.dependsOn // [])[]; . as $d | $ids | index($d)))' prd.json
```
