# Eval artifact contract

Inspect real state and artifacts. Do not replace the measured condition with a
synthetic fixture. Hook-unit-test probes may use the file-fixture driver pattern:
write the driver to a script file and hold sensitive tokens in shell variables.

- Return `0` for verified PASS, `1` for REGRESSION, and `2` for an inapplicable environment.
- Never return PASS when the probe cannot verify its condition. Explain the result on stderr.
- Declare machine-readable `# tier:`, `# source:`, and `# desc:` headers.
- Resolve repository paths from `${BASH_SOURCE[0]}`, not the caller's directory or a machine-specific absolute path.
- Bound execution time. The eval runner enforces a 30-second timeout per probe.
- Preserve dataset provenance and real trajectory evidence. Keep schemas and catalogues consistent with their artifacts.

### Fault injection

Before landing a new or changed probe, drive its REGRESSION branch against a
deliberately broken input. Confirm the failure names the intended condition.
Use a disposable copy; never restore over shared or uncommitted work.
For history-dependent checks, expose the comparison point through a repeatable override.
Keep `WIKI_LEDGER_BASE` and `WIKI_PERSISTENCE_BASE` reachable in their probes.
Exercise applicable skip guards too. If a probe routinely skips its intended environment,
treat it as unverified, not healthy. Treat a missing required artifact as a regression.

### Pinning contract text

Pin short, unique semantic fragments, not whole wrapped sentences.
If the assertion needs a full sentence, normalize whitespace before matching.
Keep the behavioral assertion when a document moves or its prose changes.

Use the [eval skill](../skills/eval/SKILL.md) for execution.
See the [source reference](https://github.com/mifunedev/agro/blob/main/docs/evals.md)
for metadata examples, runner semantics, and boot-path CI limits.
