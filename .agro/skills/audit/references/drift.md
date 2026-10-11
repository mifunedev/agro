# Audit drift

Read-only harness drift detector. Reports two drift classes and prints a
recommended remediation command for each finding — never executes any
remediation. This skill never mutates local branches, the working tree,
committed history, the remote, or host state. The sole permitted write is
`git fetch` (updates only remote-tracking refs + `FETCH_HEAD`), which is
non-destructive.

## Instructions

Run both sections in order and collect the one-line summary for each.
At the end, emit the aggregate `DRIFT:` line only when at least one class
is non-clean.

---

### (A) Framework drift (origin↔upstream)

**Goal**: detect how far `origin/development` lags behind `upstream/development`.

**Step A-1 — preflight upstream remote:**

```bash
git remote get-url upstream 2>/dev/null
```

If this command exits non-zero, print:

```
DRIFT-CHECK: upstream remote not configured — framework drift cannot be checked
```

and skip the rest of Section (A). Do NOT run `git fetch upstream` if the
remote does not exist.

**Step A-2 — timeout-wrapped fetch:**

```bash
timeout 15s git fetch upstream 2>&1
```

If the fetch times out or exits non-zero (network unavailable, DNS failure,
auth error), print:

```
DRIFT-CHECK: upstream fetch failed (offline/timeout) — framework drift unknown
```

and skip the rest of Section (A).

**Step A-3 — count divergence:**

```bash
git rev-list --left-right --count origin/development...upstream/development
```

Output is `<left>\t<right>` where `left` = commits origin is ahead,
`right` = commits origin is behind upstream. Report:

```
DRIFT-CHECK (A): origin/development is N behind upstream/development (M ahead)
```

If `right` is `0`, print a single `OK` token for class A:

```
(A) Framework drift: OK
```

**Step A-4 — derive changed paths and print remediation (only when N > 0):**

```bash
git diff --name-only origin/development...upstream/development
```

Capture the list of changed paths. Print the recommended remediation with
the real paths substituted — NEVER a bare pathless checkout, NEVER a
placeholder:

```
  Recommended: git checkout upstream/development -- <path1> <path2> ...
```

If the path list is empty despite a non-zero behind count (e.g., pure
rename history), print `  (no changed paths detected — inspect manually)`.

---

### (B) Branch-behind / append-file drift

**Goal**: detect whether HEAD is behind its remote tracking branch, the
working tree is dirty, or the current branch is unexpected. This section
is motivated by the stale-view trap: concurrent sessions push to the same
branch; if HEAD drifts behind `origin/<branch>`, the in-context view of
tracked files lags behind reality.

**Step B-1 — identify current branch:**

```bash
BRANCH=$(git branch --show-current)
echo "Current branch: $BRANCH"
```

**Step B-2 — unexpected-branch check:**

The expected branch is `development`. Any other branch is flagged as
unexpected UNLESS it matches the regex `^(feat|fix|task|audit|skill|agent)/`
(a legitimate work branch). A work-branch warning is informational only,
not an error.

```bash
# Pseudocode — implement as inline shell logic:
if [ "$BRANCH" != "development" ]; then
  if echo "$BRANCH" | grep -qE '^(feat|fix|task|audit|skill|agent)/'; then
    echo "DRIFT-CHECK (B): on work branch '$BRANCH' (expected: development) — informational"
  else
    echo "DRIFT-CHECK (B): UNEXPECTED branch '$BRANCH' (expected: development or a feat/fix/task/audit/skill/agent/ work branch)"
  fi
fi
```

**Step B-3 — timeout-wrapped fetch (offline-safe):**

```bash
timeout 15s git fetch origin 2>&1
```

If the fetch fails or times out, note it and continue with local tracking
data only:

```
DRIFT-CHECK (B): origin fetch failed (offline/timeout) — using cached tracking refs
```

**Step B-4 — behind/ahead count:**

```bash
git rev-list --left-right --count HEAD...origin/$BRANCH
```

Output is `<ahead>\t<behind>`. Report:

```
DRIFT-CHECK (B): HEAD is N behind / M ahead of origin/<branch>
```

If both counts are `0` and the working tree is clean and the branch is
expected, print a single `OK` token for class B:

```
(B) Branch-behind drift: OK
```

**Step B-5 — dirty working tree:**

```bash
git status --porcelain
```

If output is non-empty, print:

```
DRIFT-CHECK (B): working tree is dirty — N uncommitted change(s)
  Recommended: git status to review, then git add / git commit or git restore as appropriate
```

When behind count > 0, print:

```
  Recommended: git pull --ff-only origin/<branch>
```

---

## Output Contract

- Each class prints exactly one summary line when clean: `(A) Framework drift: OK`, `(B) Branch-behind drift: OK`.
- When a class has findings, it prints one or more `DRIFT-CHECK (<letter>): ...` detail lines followed by a `Recommended:` block.
- When at least one class is non-clean, print a final aggregate line:

```
DRIFT: <comma-separated summary of non-clean classes>
```

Example (all clean):

```
(A) Framework drift: OK
(B) Branch-behind drift: OK
```

Example (A non-clean):

```
DRIFT-CHECK (A): origin/development is 3 behind upstream/development (0 ahead)
  Recommended: git checkout upstream/development -- .agro/skills/git/SKILL.md
(B) Branch-behind drift: OK
DRIFT: framework drift (3 behind upstream)
```
