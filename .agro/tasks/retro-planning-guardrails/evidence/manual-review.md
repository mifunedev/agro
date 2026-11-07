# Manual review: retro planning guardrails

The steps below confirm the `/prd`, `/delegate`, and `/council` rules of [#1573](https://github.com/mifunedev/agro/issues/1573). Each output comes from an observed run at commit `840b1e585863e22175a5dfa303164ea1804e7d45` on branch `skill/1573-retro-planning-guardrails`.

**A. Provider links**

Prerequisites: a checkout of the AGRO harness on the task branch. Runs on the host, local.

1. Run the provider link check:

   ```bash
   bash .agro/scripts/link-providers.sh --check
   ```

   Observed output ends with:

   ```text
   Providers OK: .agents/.claude skills -> .agro/skills (vendored pack present)
   ```

   Observed exit status: 0.

2. Failure path. Run the script with an unknown flag:

   ```bash
   bash .agro/scripts/link-providers.sh --nosuchflag
   ```

   Observed output starts with:

   ```text
   usage: bash .agro/scripts/link-providers.sh [--init|--check] [--hermes-only]
   ```

   Observed exit status: 64.

**B. Test suite**

Prerequisites: `pnpm install --frozen-lockfile` is complete. Runs on the host, local.

1. Run the test suite:

   ```bash
   pnpm test
   ```

   Observed output:

   ```text
   Test Files  5 failed | 109 passed (114)
        Tests  14 failed | 2868 passed | 6 skipped (2888)
   ```

   Observed exit status: 1.

2. The 14 failures are the host baseline of this VM. The dispatch record names the same 14 failures. This VM sets umask `0077` and has no `zsh`. The failing files are:

   - `.agro/cli/src/__tests__/self-upgrade.test.ts`: 4 tests.
   - `.agro/cli/src/lib/__tests__/agro-config.test.ts`: 1 test, file mode.
   - `.agro/cli/src/lib/__tests__/host-config.test.ts`: 1 test, file mode.
   - `.agro/scripts/__tests__/herdr-default.test.ts`: 7 tests, no `zsh`.
   - `.agro/scripts/__tests__/install.test.ts`: 1 test, file mode.

   The change edits Markdown files only. No failing test reads `.agro/skills/prd/SKILL.md`, `.agro/skills/delegate/SKILL.md`, or `.agro/skills/council/SKILL.md`. CI on the pull request is the clean run.

**C. STE check of the changed skills**

Prerequisites: a checkout of the AGRO harness on the task branch. Runs on the host, local.

1. Run the checker on the `/prd` skill:

   ```bash
   bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/prd/SKILL.md
   ```

   Observed output:

   ```text
   .agro/skills/prd/SKILL.md:89: LONG split this sentence: 27 words, cap is 25
   .agro/skills/prd/SKILL.md:94: VAGUE start the sentence with a named subject, not a bare pronoun
   .agro/skills/prd/SKILL.md:94: COMPOUND state one action per step; this step holds 2
   .agro/skills/prd/SKILL.md:181: VAGUE start the sentence with a named subject, not a bare pronoun
   .agro/skills/prd/SKILL.md:184: VAGUE name the object of the verb instead of a pronoun
   .agro/skills/prd/SKILL.md:210: VAGUE start the sentence with a named subject, not a bare pronoun
   ste-check: 6 finding(s) in 1 file(s).
   ```

   Observed exit status: 1.

2. Run the checker on the `/delegate` skill:

   ```bash
   bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md
   ```

   Observed output:

   ```text
   .agro/skills/delegate/SKILL.md:75: VAGUE start the sentence with a named subject, not a bare pronoun
   .agro/skills/delegate/SKILL.md:155: PASSIVE rewrite in the active voice with a named actor
   .agro/skills/delegate/SKILL.md:232: VAGUE start the sentence with a named subject, not a bare pronoun
   ste-check: 3 finding(s) in 1 file(s).
   ```

   Observed exit status: 1.

3. Run the checker on the `/council` skill:

   ```bash
   bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md
   ```

   Observed output:

   ```text
   .agro/skills/council/SKILL.md:125: VAGUE start the sentence with a named subject, not a bare pronoun
   ste-check: 1 finding(s) in 1 file(s).
   ```

   Observed exit status: 1.

4. Confirm that each finding is on a line that the change did not edit:

   ```bash
   git diff -U0 origin/development -- .agro/skills/prd/SKILL.md .agro/skills/delegate/SKILL.md .agro/skills/council/SKILL.md
   ```

   Observed changed lines:

   - `.agro/skills/prd/SKILL.md`: lines 90 and 176.
   - `.agro/skills/delegate/SKILL.md`: lines 99 to 139.
   - `.agro/skills/council/SKILL.md`: lines 42 to 45.

   No finding is on a changed line. The checker reports the same counts on `origin/development`: 6 for `/prd`, 3 for `/delegate`, and 1 for `/council`.

No step creates a resource. No cleanup is necessary.
