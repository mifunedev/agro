# Manual review

The worker ran each command on `skill/1576-retro-evidence-guardrails` on the VM host, at the repository root.
Each output and exit status comes from that observed run.

**A. Provider links**

Prerequisites: a checkout of the AGRO harness. Runs on the host, local.

1. Run the link check:

   ```bash
   bash .agro/scripts/link-providers.sh --check
   ```

   Output ends with `Providers OK: .agents/.claude skills -> .agro/skills (vendored pack present)`. Exit status: 0.

**B. Test suite**

Prerequisites: a checkout of the AGRO harness with `pnpm install` done. Runs on the host, local.

1. Run the test suite:

   ```bash
   pnpm test
   ```

   Output:

   ```text
    Test Files  5 failed | 109 passed (114)
         Tests  14 failed | 2868 passed | 6 skipped (2888)
   ```

   Exit status: 1.
   The 14 failures are the host baseline in `baseline.md`.
   The failures occur in the same 5 files:
   - `.agro/cli/src/__tests__/self-upgrade.test.ts`
   - `.agro/cli/src/lib/__tests__/agro-config.test.ts`
   - `.agro/cli/src/lib/__tests__/host-config.test.ts`
   - `.agro/scripts/__tests__/herdr-default.test.ts`
   - `.agro/scripts/__tests__/install.test.ts`

**C. STE checks on the changed skills**

Prerequisites: a checkout of the AGRO harness with `origin/development` fetched. Runs on the host, local.

1. Run the checker on the council skill:

   ```bash
   bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/council/SKILL.md
   ```

   Output: `.agro/skills/council/SKILL.md:126: VAGUE` and `ste-check: 1 finding(s) in 1 file(s).` Exit status: 1.

2. Run the checker on the delegate skill:

   ```bash
   bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/delegate/SKILL.md
   ```

   Output: findings at lines 75, 155, and 232, and `ste-check: 3 finding(s) in 1 file(s).` Exit status: 1.

3. Run the checker on the prd skill:

   ```bash
   bash .agro/skills/ste/scripts/ste-check.sh .agro/skills/prd/SKILL.md
   ```

   Output: findings at lines 89, 94, 181, 184, and 219, and `ste-check: 6 finding(s) in 1 file(s).` Exit status: 1.

4. Compare each finding line with the changed lines:

   ```bash
   git diff -U0 origin/development -- .agro/skills/council/SKILL.md .agro/skills/delegate/SKILL.md .agro/skills/prd/SKILL.md | grep '^@@'
   ```

   Output: the changed lines are council 43 to 46, delegate 246 to 251, 272 to 273, and 276, and prd 199 to 207.
   No finding falls on a changed line.
   Each finding is on an unchanged line.
