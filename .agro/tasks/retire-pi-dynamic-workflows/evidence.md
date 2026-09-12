# Evidence — retire-pi-dynamic-workflows

Task: `.agro/tasks/retire-pi-dynamic-workflows/`
Plan: `/home/sandbox/harness/.agro/plans/retire-pi-dynamic-workflows/plan.md` (operator-approved)
Issue: [mifunedev/agro#1054](https://github.com/mifunedev/agro/issues/1054)
PR: [mifunedev/agro#1055](https://github.com/mifunedev/agro/pull/1055)
Companion PR: [mifunedev/agro-web#56](https://github.com/mifunedev/agro-web/pull/56)
Branch: `task/1054-retire-pi-dynamic-workflows`, base `development`, remote `origin` → `mifunedev/agro`
Worktree: `.worktrees/task/1054-retire-pi-dynamic-workflows`

## 0. Why this is better than not doing it

**Before.** The harness shipped two subagent execution surfaces by default. `/delegate`
drove the provider-native `Agent` tools, and a pinned third-party package registered a
`workflow` tool that ran a JavaScript DSL in a VM sandbox and fanned out to its own
in-memory subagents. Both answered the same question — how does one agent hand bounded
work to several — with different vocabulary, different failure modes, and a second
supply-chain pin to track. The documentation carried a dedicated integration page plus
four more advertisements for the second surface.

**After.** One delegation procedure. A fresh Pi session registers **27 tools instead of
28**, and the one that left is exactly `workflow` (`evidence/runtime-before.json` vs.
`evidence/runtime-after.json`, recomputed independently by the reviewer and again by the
advisor). The effective system prompt drops from **12,275 to 9,283 characters** — 16
lines of dynamic-workflow guidance down to zero, with the single remaining `/workflow/i`
match being an unrelated `## Task-driven workflows` heading from the task package. **90
lines of integration documentation** are deleted and one four-line migration note
replaces them.

**The cost.** One third-party pin and its git supply-chain dependency are gone, which is
part of the benefit rather than a price. The real price is paid by anyone who wrote a
workflow script against that DSL: those scripts lose their default executor, and Pi
subagent tools promise no DSL compatibility. The plan accepted that explicitly, and the
migration note tells such an operator that a global installation or an explicit `pi -e`
argument still registers the tool.

**Measured or claimed.** The tool-count delta, the prompt-length delta, and the deleted
line count are measured. The maintenance saving from carrying one delegation surface
instead of two is *claimed, unmeasured*.

## 1. What the plan asked for

Retire `pi-dynamic-workflows` from the Open Harness default Pi configuration and from
current documentation. Keep `/delegate` as the one bounded delegation procedure and
introduce no replacement workflow engine. Preserve Pi subagents, tasks, goals,
Monitor/Loop, file search, safety guards, and Slack. Preserve GitHub Actions workflows
and generic uses of the word workflow. Preserve the historical changelog entry. Touch no
global settings, cache, session history, or user script.

Retirement means removal from **defaults** — explicitly not a ban on an operator-managed
global installation or an explicit `-e` argument, and explicitly not a claim that a
project settings edit removes every registration source.

## 2. What was built

### D1 — the default list and the negative contract

`.pi/settings.json` lost exactly one array entry. The nine retained packages keep their
order and every other key is byte-identical; the diff is one insertion and two deletions,
all inside `packages` (`evidence/diff.txt`, `evidence/settings.txt`).

`.pi/extensions/__tests__/settings.test.ts` asserts the new nine-entry list and adds a
`packageIdentity()` helper with a negative assertion keyed on **package identity rather
than on the retired commit string** — the point being that reintroduction from any source
must fail, not just the exact literal that was removed.

The first implementation of that guard was **wrong in the way that matters**. Independent
review found two shapes that slipped past it: a git spec spelled with a trailing `.git`
suffix, and any case variant of the name. A negative assertion that does not catch
reintroduction is a false guard, so this was routed back for repair rather than
disclosed. After repair the advisor exercised the helper over 13 reintroduction shapes and
the 9 retained entries:

```
CATCH  npm:pi-dynamic-workflows@1.0.1                                   -> pi-dynamic-workflows
CATCH  pi-dynamic-workflows                                             -> pi-dynamic-workflows
CATCH  git:github.com/SomeoneElse/pi-dynamic-workflows@0000000          -> pi-dynamic-workflows
CATCH  git:github.com/Michaelliv/pi-dynamic-workflows.git@dbc6800       -> pi-dynamic-workflows
CATCH  npm:Pi-Dynamic-Workflows@1.0.1                                   -> pi-dynamic-workflows
CATCH  ssh://git@github.com/Michaelliv/pi-dynamic-workflows.git@abc     -> pi-dynamic-workflows
CATCH  npm:@someone/pi-dynamic-workflows@1.0.0                          -> pi-dynamic-workflows
ok     npm:@tintinweb/pi-subagents@0.12.0                               -> pi-subagents
ok     npm:cc-safety-net@1.0.6                                          -> cc-safety-net
---
ALL SHAPES HANDLED   (exit 0)
```

| Command | Runner | Exit |
|---|---|---|
| `pnpm exec vitest run .pi/extensions/__tests__/settings.test.ts` | T1 | 0 |
| same | T2, independently | 0 |
| same | advisor, after repair | 0 (3 tests) |

### D2 — documentation

`docs/integrations/pi-dynamic-workflows.md` deleted (90 lines). The index link in
`docs/README.md`, the default-package bullet and the `-e` example fragment in
`docs/harnesses/pi.md`, the defaults sentence in `docs/installation.md`, and the
pinned-not-vendored example in `docs/integrations/pi-fff.md` no longer present the package
as a current default. The `## Dynamic workflows` usage section is replaced by
`## Dynamic workflow retirement`, four lines naming `/delegate`, the reload-or-restart
boundary for a running session, and the global-or-explicit-`-e` override boundary. It does
not claim the tool is gone everywhere, because it is not.

Tracked reference sweep, run by T1, re-run by T2, re-run by the advisor: **three matches
remain**, all classified — `CHANGELOG.md:682` (the preserved historical entry) and two in
the negative test, which is the one place that must hold the literal in order to test it.
No tracked file links the deleted page; no `#dynamic-workflows` anchor reference exists;
this repository has no sidebar or site config, so the renamed heading breaks nothing
(`evidence/references.txt`, `evidence/docs-review.md`).

`CHANGELOG.md` gains one `[Unreleased]` → `### Removed` entry, 192 characters, linking
#1054. Line 682 is untouched.

### D3 — observed runtime inventory

Pi 0.85.1. Two disposable checkouts under `/tmp` holding a copy of `.pi/` only, each with
its own empty `PI_CODING_AGENT_DIR` so no global package loads. A temporary inspection
extension at `/tmp/piprobe/probe.ts` — outside tracked source — captured
`pi.getAllTools()` with provenance and `ctx.getSystemPrompt()`.

- BEFORE (ten-entry list): **28 tools**, `workflow` present, exit 0, zero bytes of startup
  output.
- AFTER (nine-entry list): **27 tools**, `workflow` absent, exit 0, zero bytes of startup
  output.
- Diff: removed `["workflow"]`, added `[]`. Recomputed from the raw JSON by the reviewer
  and again by the advisor, not read from the implementer's prose.
- Retained and present: `Agent`, `get_subagent_result`, `steer_subagent`; the seven
  `Task*` tools; `goal_complete`; `LoopCreate/List/Delete` and `MonitorCreate/List/Stop`;
  `ffgrep`/`fffind`; the eight builtins.
- Reload: `runtime-reload.jsonl` holds a `startup` record and a `reload` record, both
  27 tools, both without `workflow`.

### D4 — regressions and boundaries

`pnpm exec vitest run .pi` exits 0 (7 files, 52 tests) for all three runners. The changed
set is exactly the Pi configuration surface, the named docs, `CHANGELOG.md`,
`.agro/evals/RESULTS.md`, and this task folder. Root checkout, agro-web clone, and the
worktree all report an empty `git status --porcelain`. Global Pi settings predate this
work and carry no `packages` key. No service was reloaded or restarted. Full table in
`evidence/boundary-review.md`.

`/eval`: runner exit **0** over 149 probes, **no green→red transition**
(`eval-result.json`).

### D5 — distribution and public documentation

**Distribution** (`evidence/distribution-review.md`): source-traced, not assumed. There is
no `init` verb and nothing templates a Pi settings file; propagation is whole-tree image
seed (`.devcontainer/Dockerfile:111`, `:131`; `.dockerignore:15-16` does not exclude
`.pi/settings.json`; `.devcontainer/entrypoint.sh:119` copies **only when the control dir
is absent**, then writes `.image-seeded`). So this change alters defaults for a **new**
sandbox seeded from a rebuilt image and changes **nothing** for an existing one, where the
operator edits the file themselves.

**Public documentation** (`evidence/public-docs-review.md`): the site advertised the
package in six current locations and linked the deleted page. That is a surviving default
advertisement, so D5 could not pass on the harness patch alone. Resolved through the
second branch the plan's D5 row permits — **an accepted, owned companion change**, defined
as a separate bounded assignment before dispatch: agro-web#55, branch
`docs/55-retire-pi-dynamic-workflows`, commit `f243702`, PR
[agro-web#56](https://github.com/mifunedev/agro-web/pull/56).

### Actual Knowledge Impact

**The planner predicted `NOT-APPLICABLE`. The diff overruled it.** Running
`knowledge-impact.sh` over the 24 actually-changed paths surfaced one page the prediction
missed:

```
NEEDS-REVIEW  fresh-machine-setup  .agro/knowledge/source/fresh-machine-setup.md
              declared sources are in the changed set: docs/installation.md
```

| Page | State |
|---|---|
| `fresh-machine-setup` | **`REVERIFIED`** — `docs/installation.md` is a declared source and it moved, so the gate was right to flag it. The page cites that file for host prerequisites, the `agro` install paths, the `oh` compatibility entry point, the package/PATH rules, and the `oh update` shape. This diff's only edit to that file removed the retired package from the Pi defaults sentence at line 188, which the page does not describe. The page was re-read against its declared sources, every claim still holds, so `verified_at:` was advanced and `updated:` was deliberately left alone |
| every other page under `.agro/knowledge/source/` | `NOT-AFFECTED (no declared source in the changed set)` — reported `FRESH` by the same run |
| every page under `.agro/knowledge/patterns/` | `NOT-AFFECTED (kind: pattern — provenance is immutable, freshness does not apply)` — the script's own classification. The five patterns this build read (`pattern-delegate-builtin-type-carries-own-model`, `pattern-delegate-ledger-stale-at-acceptance`, `pattern-delegate-worker-terminated-before-report`, `pattern-docs-prohibition-by-example`, `pattern-evals-prose-literal-pinning`) informed the orchestration and were confirmed by it; none makes a claim this diff falsifies |

`bash .agro/evals/probes/wiki-readme-index.sh` — exit 0, before and after the frontmatter
edit.

## 3. Where they diverged from the plan, and why

Five deviations, all recorded before or at the moment they were taken.

1. **Worker model: `opus` requested explicitly, where the plan recorded `inherit`.** The
   plan wrote `inherit` because the operator selected no implementation model. `/delegate`
   rule 2 requires the advisor to resolve an unspecified setting per task, rule 1 makes
   the standing non-Sonnet exclusion binding, and
   `pattern-delegate-builtin-type-carries-own-model` shows an omitted `model` does not
   reliably inherit the dispatching session's model — so omitting it could not guarantee
   the exclusion. Both workers self-reported `claude-opus-5[1m]`. Recorded in
   `delegate-log.txt` before the first dispatch.
2. **Worktree path.** The plan's T1 row names
   `.worktrees/retire-pi-dynamic-workflows`. The canonical convention in
   `.worktrees/AGENTS.md` and `.agro/skills/git/SKILL.md` is `.worktrees/<branch>`, so the
   build ran in `.worktrees/task/1054-retire-pi-dynamic-workflows`. The plan's path was
   illustrative and subordinate to the convention.
3. **A fourth bounded assignment (T4) was created.** The plan defines T1, T2, and
   advisor-owned T3. D5's website finding triggered the plan's own escape hatch — "if
   website or lifecycle edits become necessary, the advisor defines a separate bounded
   assignment before dispatch" — so T4 produced the companion patch in an isolated
   worktree of the agro-web repository. T2 was never granted write authority.
4. **One repair round the plan did not anticipate.** T1's first negative assertion had a
   real gap. It was routed back to the same continuing worker rather than accepted with a
   disclosure, because a false guard defeats the purpose of D1's negative contract.
5. **The knowledge prediction was wrong, and the diff won.** `prd.md`'s
   `Expected Knowledge Impact` says `NOT-APPLICABLE`. The actual diff touches
   `docs/installation.md`, a declared source of `fresh-machine-setup`, so the gate flagged
   that page `NEEDS-REVIEW`. The prediction is left in `prd.md` as written — it is the
   planner's record, not the oracle — and the real impact is resolved above as
   `REVERIFIED`. A second repair round carried out the frontmatter bump.

The safety-guard acceptance criterion was **satisfied differently** rather than deviated
from: see below.

## 4. What remains unverified

- **The safety-guard criterion cannot be proven by tool name.** US-003 asks that
  "safety-guard tools remain present". `cc-safety-net@1.0.6` registers **no LLM-callable
  tool**: its installed `package.json` describes it as *"A coding agent CLI hook — block
  destructive git and filesystem commands before execution"*, and `dist/pi/index.d.ts`
  exports an extension composed of `registerBuiltinCommands` + `registerToolCallEvent`,
  with `dist/pi/tool-call.d.ts` typing a `tool_call` handler that returns
  `{ block: true, reason }`. It is hook-shaped by design. The criterion is met
  differently — the pin is untouched and both probe runs loaded it without extension
  error — but **the evidence captures only `pi.getAllTools()`, so it does not positively
  prove the `tool_call` handler registered in either run.** A reviewer who wants that
  proof needs a hook-level inventory this build did not capture.
- **The reload was driven through a scripted pty**, not a human interactive session. The
  result is real; a human session could differ in session or resume state.
- **No image build was run.** The distribution conclusion is traced through
  `.devcontainer` source; it was not confirmed end-to-end by building an image and
  inspecting the seeded workspace.
- **The companion site PR's Docusaurus build did not run locally** — `node_modules` is
  absent in that clone and installing was out of scope. Its CI build is the authoritative
  broken-link check.
- **Four persistent eval reds carried forward**, none caused by this change and none a
  green→red transition: `curl-bash-safe-alternatives` (ERROR — `python3` absent in this
  sandbox), `next-dev-prod` (`SKIPPED`→`REGRESSION`, because an unrelated `next dev`
  process is running in this sandbox; it belongs to another agent's service and was
  deliberately left running), `oh-config-surfaces`, and `skills-vendored`.
- **Neither PR is merged**, so the published documentation site still shows the retired
  package until the operator merges both. Merge and release were out of this build's
  authority throughout.
