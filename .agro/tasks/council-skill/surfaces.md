# Affected surfaces

| Surface | Decision |
| --- | --- |
| Host and sandbox | Applied. Read local traces and develop the control plane inside the sandbox worktree. No host changes. |
| Lifecycle door | Not applicable. No `agro` verbs change. |
| Canonical and provider surfaces | Applied. Add the skill under `.agro/skills/`. Verify existing provider symlinks. |
| Root and scaffold | Applied. The vendored skill pack carries the new skill to initialized projects. No root instruction edits. |
| Interactive and headless processes | Not applicable. Add no persistent process or terminal integration. Use bounded native workers for this build. |
| Local and remote operation | Applied. Keep deliberation independent of attached terminals and local trace availability. |
| Parallel operation | Applied. Research workers only read. Serialize implementation in one isolated worktree. |
| Public documentation | Not applicable to the website. The remote tree has no skill catalog page. No lifecycle or website contract changes. Document invocation in the skill and changelog. |
| Verification | Applied. Review evidence, run scenario checks, apply builder and STE checks, verify provider links, and run regression and PR gates. |
