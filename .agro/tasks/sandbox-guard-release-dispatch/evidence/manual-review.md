# Manual review: sandbox guard, release dispatch, and procedure rules

The advisor ran each command in the task worktree on branch
`feat/1536-sandbox-guard-release-dispatch`, inside the sandbox `agro-sbx-local`.
The advisor ran no `destroy`, `stop`, or `restart` command in the sandbox. A
failed guard would stop the live sandbox, so the unit tests carry the proof.

## 1. Sandbox guard (US-001)

```console
$ pnpm exec vitest run .agro/cli/src/__tests__/lifecycle.test.ts -t "inside the sandbox" --reporter=verbose
 ✓ lifecycle inside the sandbox > refuses to provision the sandbox from inside it
 ✓ lifecycle inside the sandbox > opens a shell locally instead of exec-ing into a container
 ✓ lifecycle inside the sandbox > refuses to destroy a sandbox from inside a sandbox (#1531)
 ✓ lifecycle inside the sandbox > refuses `stop` from inside a sandbox
 ✓ lifecycle inside the sandbox > refuses `restart` from inside a sandbox
 ✓ lifecycle inside the sandbox > refuses `destroy` from inside a sandbox
 ✓ lifecycle inside the sandbox > still runs `ps` from inside a sandbox
 ✓ lifecycle inside the sandbox > still runs `logs` from inside a sandbox
      Tests  8 passed | 114 skipped (122)
```

## 2. Release dispatch (US-002)

```console
$ pnpm exec vitest run .agro/scripts/__tests__/release-dispatch.test.ts .agro/scripts/__tests__/canonical-publish-contract.test.ts --reporter=verbose
 ✓ release workflow agro-web dispatch > ends the finalize job with the agro-web notify step
 ✓ release workflow agro-web dispatch > sends the agro-release dispatch with the release tag as ref
 ✓ release workflow agro-web dispatch > reads the token from AGRO_WEB_DISPATCH_TOKEN and skips with a warning when it is empty
 ✓ release workflow agro-web dispatch > never fails the release run on a failed dispatch
 ✓ canonical publish-cli contract > keeps image publication before CLI publication
 ✓ canonical publish-cli contract > exposes the agro guard and publish run bodies and no legacy npm bodies
 ✓ canonical publish-cli contract > succeeds with a fake registry and never invokes a legacy npm operation
 ✓ canonical publish-cli contract > fails when canonical npm publish fails
 ✓ canonical publish-cli contract > skips publish when the canonical version already exists
      Tests  13 passed (13)
```

The first real dispatch runs at the next AGRO release. The secret
`AGRO_WEB_DISPATCH_TOKEN` exists on `mifunedev/agro`.

## 3. Procedure rules (US-003)

```console
$ git diff 786bb084 -- .agro/skills | grep '^+' | grep -v '^+++'
+| Execution location | `host` or `sandbox`. When `/etc/agro/sandbox` exists, or `/.dockerenv` exists and `SANDBOX_NAME` is not empty, the advisor writes `sandbox` |
+6. The advisor never sends parallel shell calls that change the working directory.
+   Each parallel call uses absolute paths, for example `git -C <path>`.
+- In a sandbox, never run `agro sandbox`, `agro destroy`, `agro stop`,
+  `agro restart`, or raw `docker compose` for the current project.
+- Never approve an `action_required` workflow run on a PR from a fork, for example with
+  `gh api repos/<owner>/<repo>/actions/runs/<id>/approve`. Only the operator approves a
+  fork run. Verify the fork change locally in the sandbox instead.
```
