# Repair evidence — `.agro/memories/` preserve/repair (#1116)

Every command below was run by the advisor, not accepted on a worker report.
Synthetic fixtures only; no operator data was used anywhere.

## Method correction, stated before the results

My first re-verification ran historical probe versions from `/tmp`. Each probe
derives `ROOT` from its own `BASH_SOURCE`, so those runs measured `/` and their
exit codes were meaningless. Every historical-probe result below was re-run with
the probe placed **inside the target's** `.agro/evals/probes/`.

## R-004 — real distribution path

`oh update --from /home/sandbox/harness/.worktrees/task/1116-retire-memories-tier`
into two fresh targets. The copied-manifest fixture is retained as additional
coverage and is **not** the proof for R-004.

| Target | Result | Memories payload |
| --- | --- | --- |
| fresh non-git directory | `541 created, 0 overwritten, 399 skipped` | `AGENTS.md` + `templates/{SOUL,USER,MEMORY}.md` |
| fresh `git init` project | `541 created, 0 overwritten, 399 skipped` | same |

No live instance is ever delivered by the payload, in either target.

**Repeat install**, non-git target, after writing synthetic private content:

```
oh update --from <checkout> --force  →  0 created, 541 overwritten, 399 skipped
SOUL.md preserved:  YES      (synthetic private content, byte-for-byte)
USER.md preserved:  YES      (synthetic name + synthetic@example.invalid)
empty MEMORY.md still empty: YES
both probes exit 0 with that private content present
```

## Three deployments, final probes

| Deployment | `memories-tier-defaults` | `agents-md-fallback` |
| --- | --- | --- |
| source checkout | 0 — source-checkout mode (git index + repository sentinel) | 0 |
| **git** installed project | 0 — installed-project mode, git index present (no repository sentinel) | 0 |
| **non-git** installed project | 0 — installed-project mode, no git index | 0 |

Each PASS line now states only the conditions it observed. The git/non-git
distinction is preserved rather than collapsed.

## Coverage gap found by the real install, and closed

Mode detection ANDed `git rev-parse --git-dir` with the `docs/lifecycle-commands.md`
sentinel. A git-initialised installed project therefore printed "no git index"
— false — and **skipped the core live-instance guard**, which is precisely where
an operator seeds live files and runs `git add -A`.

Split into two independent facts. The live-instance guard now runs wherever an
index exists. The tracked-set **equality** assertion stays source-checkout-only,
because an installed payload may legitimately be tracked, untracked, or partly
staged.

Evidenced, not asserted — same injection, same real git install:

```
pre-fix probe (commit 0a0b1dfd)  exit=0   ← the gap
current probe                    exit=1   ← the guard
```

## Correction to my own earlier claim

I wrote that the retirement build's `agents-md-fallback` "exited 128 in an
installed project", implying its installed-mode green claim was simply wrong.
That was too strong. Placed correctly in real installs:

```
retirement-build probe, non-git install:  exit=128
retirement-build probe, git install:      exit=0
```

The defect is real but narrower than I stated, and the retirement build's own
result was plausibly green for the case it tested. The `has_index` fallback
remains load-bearing for non-git installs.

## Git exclusion, with synthetic private content present

```
git status --porcelain -uall -- .agro/memories/   →  no SOUL/USER/MEMORY line
git check-ignore -v .agro/memories/SOUL.md        →  .gitignore:35
git check-ignore -v .agro/memories/USER.md        →  .gitignore:36
git check-ignore -v .agro/memories/MEMORY.md      →  .gitignore:37
```

## Docker build-context exclusion

A real `docker build` over this checkout as context, with synthetic private live
files present on disk, listing what actually arrived. The tracked files are the
positive control that proves the method can see the directory at all:

```
Sending build context to Docker daemon   9.03MB
Step 3/3 : RUN find /ctx/.agro/memories -type f | sort
/ctx/.agro/memories/AGENTS.md
/ctx/.agro/memories/templates/MEMORY.md
/ctx/.agro/memories/templates/SOUL.md
/ctx/.agro/memories/templates/USER.md
```

The synthetic `SOUL.md` and `USER.md` existed on disk during that build and did
not enter the context.

## Worktree isolation

A second worktree added at HEAD, each worktree given its own live `SOUL.md`:

```
worktree A SOUL.md: # SOUL.md — Identity
worktree B SOUL.md: WORKTREE B private content
same inode? NO-ISOLATED
worktree B git status for the tier: empty  (B's own instance is ignored too)
```

No shared mutable instance. The temporary worktree was removed.

## Seeding behaviour

Advisor integration test against the real templates (`scratchpad/seedcheck.sh`):
first run created all three live files from their templates and left `AGENTS.md`
and `templates/` intact; second run preserved an operator-modified `USER.md`
byte-for-byte and left an empty `MEMORY.md` empty.

## Suite

`ran 157 probe(s)`. `PERSISTENT RED (2)`, both `delta=unchanged`, both predating
this branch and unrelated to this tier:

- `next-dev-prod` — a stray `next dev` process is running in this container;
- `skills-vendored` — Hermes uses another runtime home.

Neither was suppressed, fixed, or counted as caused by this work.
