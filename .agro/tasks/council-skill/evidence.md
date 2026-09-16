# Evidence: Council skill

- PR: https://github.com/mifunedev/agro/pull/1077
- Issue: https://github.com/mifunedev/agro/issues/1076
- Branch: `skill/1076-council-skill`, base `development`.
- Content head: `4bb5766a` (amended scope).
- Audit run: pending. The advisor will record the real verdict before finalization.

## Why this is better

The repository had roadmap councils but no bounded generic deliberation contract.
The new 165-line skill defines independent proposals, evidence acceptance, scope limits, dissent, incomplete outcomes, and explicit weighted selection.
One 114-line reference covers decision scenarios. No runtime or score engine accompanies the skill.
The roadmap skill shrinks from 220 to 107 lines by reusing council deliberation.
The amendment deletes the retired 46-line V2MOM reference.
The initial independent review passed 15 semantic cases. An amended-scope review follows the operator's consolidation request.
Improved decision quality and lower operating cost remain claimed, unmeasured benefits.
The historical sample does not prove that councils outperform a single competent advisor.

## What the plan asked for

Use a council to select the approach for a new council skill.
Mine Claude and Pi traces, apply `/builder` and `/ste`, and distinguish existing skill owners.
Deliver a completed ready-for-review PR without merging.
The operator then requested overlap consolidation with `/weigh` and `/strategic-proposal`, and removed V2MOM from the active stack.

## What was built

`/council <question-or-brief>` returns one advisory Council Brief.
The active advisor verifies evidence and preserves dissent. `/delegate` retains worker mechanics.
The contract blocks missing authority, unavailable independent contexts, fewer than two useful lenses, and total evidence failure.
A conditional critic addresses material conflict, scope expansion, or high safety or reversal risk.
Critique cannot authorize expanded scope, implementation, publication, or merge.

Three independent research members supplied Claude evidence, Pi evidence, and skill-boundary analysis.
A fresh critic supplied eight objections. The advisor accepted the corrections before assigning implementation.
A separate reviewer tested the initial written procedure and supplied a simplicity finding.
The amended implementation removes that duplicate recovery line.
The advisor independently verified 11 original records from four historical sessions.
The two trace searches each examined 30 recent candidates. Their deeper samples covered five Claude sessions and four Pi sessions.
Raw traces and the private provenance map remain outside the PR.
See `council-brief.md`, `critique.md`, and `scenario-review.md` for sanitized findings and limits.

### Knowledge impact

The impact script found no changed declared source for any repository knowledge page.
The expected-entry set is empty. No page needs an update or a new verification pin.
State: NOT-AFFECTED, because no knowledge page declares the changed council or strategy files as a source.
The index probe passed. No knowledge page or generated index changed.

## Where it diverged from the plan, and why

The critic clarified that this build requires critique, while future low-risk councils can omit it.
The advisor added a two-lens minimum and an explicit total-member-failure outcome during acceptance.
Both refinements preserve the requested scope.
The operator explicitly authorized existing-skill consolidation after the initial implementation.
`/strategic-proposal` now owns only roadmap priorities and authorized publication; `/council` owns its deliberation.
`/weigh` remains unchanged. Explicit weighting reuses accepted cohorts and preserves `NO-SELECTION` without treating neutral signals as evidence.
The operator explicitly retired V2MOM from the stack.
Delete `.agro/skills/strategic-proposal/references/open-harness-v2mom-council.md` because the removed V2MOM branch was its only active consumer.
Retain the `strategic-proposal` skill as the roadmap owner. The protected-path deletion removes an unused reference, not roadmap capability.
No public website contract or lifecycle command changed.

## What remains unverified

- The semantic scenarios test prose, not live enforcement in every provider.
- Model and reasoning settings remain requested settings, not verified effective settings.
- The local regression suite retains one pre-existing `skills-vendored` failure.
- That probe's clean-clone test restricts `PATH` and cannot find the installed `cc-safety-net` binary.
- Direct provider-link checks passed. CI also passed its regression job without changing or bypassing the local probe.
- The initial nonblocking duplicate recovery instruction is removed in the amended implementation.
- No controlled comparison establishes the best member count, model mix, or empirical quality improvement.
- Capability scores predate the documented baseline reset. A claimed numerical improvement would lack a valid counterfactual.

## Initial-scope observed output

These eval and CI observations describe the initial content head `6cfe2842`, not the amended deletion.
The amended eval detected the missing committed deletion justification. This evidence commit supplies that required justification.
The advisor must restore the original green baseline and re-run the amended suite before acceptance.

```text
$ node /tmp/council-artifact-check.mjs
PASS: frontmatter, 165 skill lines, 422 description characters, 14 local links

$ bash .agro/scripts/link-providers.sh --check
note: Hermes uses another runtime home; checking only this checkout's other providers
Providers OK: .agents/.claude skills -> .agro/skills (vendored pack present)

$ pnpm run typecheck
> @mifune/agro@0.12.2 typecheck
> tsc --noEmit
exit: 0

$ bash .agro/skills/eval/run.sh
PERSISTENT RED (1) — not gating, no green->red delta:
ran 151 probe(s); wrote /home/sandbox/harness/.worktrees/skill/1076-council-skill/.agro/evals/RESULTS.md
exit: 0

$ bash .agro/evals/probes/wiki-readme-index.sh
PASS: .agro/knowledge/README.md Index matches the tracked source/ and patterns/ frontmatter

$ gh pr checks 1077 --repo mifunedev/agro --watch --interval 15
Boot Path Lint (shellcheck + hadolint) pass 16s
Boot a legacy volume against the fresh image pass 1m34s
Eval Probe Regression Gate pass 35s
Lint, Typecheck, Build & Test pass 45s
Validate sandbox compose and image build pass 2m51s
```

The local eval and typecheck use the existing uv-managed Python directory on `PATH` where required.
No runtime configuration or probe changed.
Initial-scope CI at `6cfe2842`: [Harness](https://github.com/mifunedev/agro/actions/runs/35135520650) and [sandbox](https://github.com/mifunedev/agro/actions/runs/35135520601).
The amended-scope CI and implementation audit remain pending.

## Acceptance mapping

| Criterion | Evidence |
| --- | --- |
| Council exploration and both trace stores | `council-brief.md`; advisor verification of original records. |
| Fresh critique and explicit disposition | `critique.md`, eight findings. |
| Builder and STE | Canonical skills, minimal frontmatter, resolved references, checker passes, and SI-0015 through SI-0017. |
| Skill-owner distinctions | Council Boundaries, Explicit weighting, the roadmap workflow, and `overlap-decision.md`. |
| Failure, dissent, privacy, and authority behavior | `scenario-review.md`, 15 passing tabletop cases. |
| Regression and type safety | Runner exit 0 with no new regression; `tsc --noEmit` exit 0. |
| Knowledge impact | No affected declared sources; index probe PASS. |
| Simplicity | The amended review supersedes the initial one-line finding, which the amendment removes. |
| Ready PR | Final current-head audit and undraft remain the last gates. |
