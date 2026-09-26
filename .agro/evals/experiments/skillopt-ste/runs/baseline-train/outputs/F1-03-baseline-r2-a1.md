# Descriptive `.agro/harness.yml` example

This page shows one possible shape for a human-readable `.agro/harness.yml`
file. A project can use this shape for a local manifest. The shape is
**descriptive, not normative**. AGRO does not require this file. AGRO does not
validate this shape. AGRO does not treat this shape as a registry-backed
schema or a conformance target.

Two files hold the real runtime configuration today. The tracked
[`agro.json`](../agro.json) at the repository root holds every non-secret
setting. The gitignored root `.env` holds only secrets. The tracked
[`.example.env`](../.example.env) documents `.env`.
[`docker-compose.sh`](../.agro/scripts/docker-compose.sh) reads both files. The
field reference for both files is [Configuration](configuration.md). The
example below is a pointer map over the existing `.agro/` control-plane
surfaces. The [`.agro/` directory layout](agro-directory-layout.md) describes
those surfaces.

## Minimal example

```yaml
# .agro/harness.yml — example only; not required or read by AGRO.
name: agro
version: 1

primitives:
  skills: .agro/skills/
  hooks: .agro/hooks/

loops:
  schedules: crons/
  task_artifacts: .agro/tasks/

policies:
  operator_instructions: AGENTS.md
  git_workflow: .agro/skills/git/SKILL.md
  security_hooks: .agro/hooks/                       # secret-exposure guards
  destructive_command_guard: cc-safety-net@1.0.6   # global binary (Dockerfile) + provider config entries
```

## How to read the example

- `name` and `version` are plain labels for a human reader. These labels do
  not imply a manifest version registry.
- `primitives` points at the real provider-portable primitive pack. Skills and
  hooks already live under `.agro/`. The example holds no agent-definitions
  entry. Skills are the reusable-role primitive. A provider-native sub-agent is
  a bounded execution choice that `/delegate` makes, not a repository
  artifact.
- `loops` points at today's scheduled cron prompts and today's task artifact
  directory.
- `policies` points at existing policy surfaces instead of a new
  `.agro/policies/` directory. `policies` points at the root instructions
  file, the git workflow skill, and two hook-enforced guardrail layers. The
  first layer is the secret-exposure hooks under `.agro/hooks/`. The second
  layer is the destructive-command guard, `cc-safety-net@1.0.6`. This guard is
  a global binary from the image plus guard-wrapped entries in the provider
  configs, not an `.agro/` file.
  [security-considerations.md](security-considerations.md) describes both
  layers.

Every path in the example exists today except the illustrative
`.agro/harness.yml` file itself.
[ADR-0001](rfcs/adr-0001-standards-scope.md) defers formal schemas,
registries, lifecycle states, and `OH-Core` / `OH-Dev` conformance profiles.
