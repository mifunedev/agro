# Descriptive `.agro/harness.yml` example

This page shows an example `.agro/harness.yml` file. A project can add this
file as a local manifest. The example is descriptive, not normative. AGRO
does not require this file. AGRO does not validate this shape. AGRO does not
treat this file as a registry-backed schema or conformance target.

AGRO reads two runtime configuration files today. The tracked
[`agro.json`](../agro.json) file at the repository root holds every
non-secret setting. The gitignored root `.env` file holds only secrets; the
tracked [`.example.env`](../.example.env) file documents `.env`.
[`docker-compose.sh`](../.agro/scripts/docker-compose.sh) reads both files.
[Configuration](configuration.md) lists the field reference for `agro.json`.
The example below points at the existing `.agro/` control-plane surfaces.
[The `.agro/` directory layout](agro-directory-layout.md) describes those
surfaces.

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

- `name` and `version` are plain labels for humans. They do not imply a
  manifest version registry.
- `primitives` points at the provider-portable primitive pack. Skills and
  hooks already live under `.agro/`. The example has no agent-definitions
  entry. Skills are the reusable-role primitive. `/delegate` chooses
  provider-native sub-agents as a bounded execution choice, not as a
  repository artifact.
- `loops` points at today's scheduled cron prompts and at the task artifact
  directory.
- `policies` points at existing policy surfaces. The example does not invent
  a `.agro/policies/` directory. The policy surfaces are the root
  instructions file, the git workflow skill, and hook-enforced guardrails.
  The guardrails form two layers. The first layer is the secret-exposure
  hooks under `.agro/hooks/`. The second layer is the destructive-command
  guard, `cc-safety-net@1.0.6`: a global binary from the image plus
  guard-wrapped entries in the provider configs, not an `.agro/` file.
  [security-considerations.md](security-considerations.md) describes both
  layers.

Every path in the example exists today. Only the illustrative
`.agro/harness.yml` file itself does not exist.
[ADR-0001](rfcs/adr-0001-standards-scope.md) defers formal schemas,
registries, lifecycle states, and `OH-Core` / `OH-Dev` conformance profiles.
