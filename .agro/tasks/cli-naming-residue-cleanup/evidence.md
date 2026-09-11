# Evidence — cli-naming-residue-cleanup (#1046)

## Frozen-file baseline

Recorded before any work, at `de4cbe8b`, and re-checked after every worker commit:

```
0bc2686007e137d090f9a9b543a08fefd92376a9eeccd7752eade97b147f373c  .agro/evals/probes/oh-devcontainer-restructure.sh
664447701d78612ea1ebb4029aa91c8b0919400237cd9e508d6fe2be46e555ec  .agro/evals/probes/oh-home-mount.sh
826fef45e2e665b3ef11c88647f165510142108f355b0b41ec4853af49fbd974  .agro/evals/probes/oh-image-only-deploy.sh
ac25e4b410d1a344defada4719184ce8e988ad232ac883ca208c0c36f668a513  .agro/cli/src/lib/__tests__/registry.test.ts
fc15dcc07bef1badaec51991d453a7f55ac420507ca41ecb6deb7d142602d3e6  .devcontainer/entrypoint.sh
28106a310cfee535ff64a22f27e5970377a2ffcacea106dd8b3256718b6bee0c  .devcontainer/docker-compose.yml
```

## US-005 — the behaviour change is NOT MET, on evidence

US-005 asked `materialize()` to select the build-capable compose base from the
effective image mode rather than from `checkout` presence, so that the #1042 D-3
image pin at `.agro/cli/src/commands/sandbox.ts:286-292` would become
unreachable.

**The premise does not hold.** The two bases differ in two ways, not one:

```
--- .devcontainer/docker-compose.image-only.yml
+++ .devcontainer/docker-compose.yml
+    build:
+      context: ${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}
+      dockerfile: .devcontainer/Dockerfile
     volumes:
       - ${AGRO_HOME_MOUNT:-${OH_HOME_MOUNT:-workspace}}:/home/sandbox
+      - ${AGRO_REPO_DIR:-${OH_REPO_DIR:-..}}:/home/sandbox/harness
```

`docker-compose.yml` is the only source of the checkout bind mount
`${AGRO_REPO_DIR}:/home/sandbox/harness`. Verified: neither
`.devcontainer/docker-compose.ssh.yml` nor
`.devcontainer/docker-compose.docker-sock.yml` supplies it, and `materialize()`
writes no other fragment.

So for a sandbox with `checkout` set and `image.mode: image`, selecting the
image-only base would boot the container from a prebuilt image **without the
operator's checkout mounted**. That is a worse defect than the pin it removes.
FR-7 freezes both compose files, so a third base that carries the bind mount
without the build stanza cannot be introduced under this task.

**Decision: the D-3 pin stays.** The criterion
"`materialize()` selects the build-capable base only when the sandbox will build"
is marked NOT MET. This is the outcome US-005's fourth acceptance criterion and
`prd.md` § Technical Considerations pre-authorized: keep the pin, say so here,
rather than guess. No Docker daemon is available in this environment, so the
alternative could not have been proven at any level above unit.

**What did land:** the characterization test US-005 asked for — asserting which
compose base is written for each combination of (checkout set or unset) x
(`image.mode` build or image). It pins the current coupling so the next author
sees it rather than rediscovering it. It is a new test file;
`.agro/cli/src/lib/__tests__/registry.test.ts` stays byte-identical.

**Follow-up this leaves:** removing the D-3 pin needs a compose base that carries
the checkout bind mount without the build stanza. That is a `.devcontainer/`
change, which needs `.github/workflows/sandbox-boot-guard.yml` green on a real
Linux runner to validate — out of scope here by FR-7.

## A constraint that was set wrongly — `registry.test.ts`

**Correction.** An earlier revision of this file described the change to
`.agro/cli/src/lib/__tests__/registry.test.ts` as "an authorized exception to the
byte-identity freeze," and the pull request said the operator had authorized it.
That framing was wrong and is retracted. No exception was granted and no waiver
was given. The operator's brief said the file must stay byte-identical, full
stop. What actually happened is that the constraint was impossible to satisfy
together with FR-1, and the operator, when shown the conflict, said to make the
change. That is a constraint being corrected, not a rule being waived — and the
distinction matters, because recording it as a waiver would suggest the freeze
was negotiable when in fact it was mis-specified.

**Why the constraint could not hold.** `registry.test.ts:256-261` pinned a
literal that US-001 necessarily threads:

```js
expect(() => resolveSandboxRoot({ cwd: tmpdir() })).toThrow(
  /no sandbox is registered .* `oh sandbox install docker`/,
);
```

`.agro/cli/src/lib/registry.ts:145` throws that message. Under vitest
`process.argv[1]` is vitest's own `forks.js`, so `invokedName` yields `forks` and
`resolveProduct` correctly returns `AGRO_PRODUCT`; a threaded message therefore
reads `agro sandbox install docker`, which the pinned regex cannot match. The
freeze and FR-1 could not both be satisfied on this one site.

Leaving it unthreaded was the alternative, and it was not acceptable: the
resulting output is

```
agro shell  ->  agro: no sandbox is registered in … — create one with `oh sandbox install docker`
```

which is #1046's exact symptom on the path a new operator hits before they have
any sandbox.

**Alternatives ruled out before raising it.** Moving the install-verb hint out of
`registry.ts` into the command layer, where a bin is already threaded, does not
work: the frozen regex requires the *thrown* message to carry that tail, so
removing it fails the same assertion. No mechanism preserves the file's bytes and
closes the defect.

**What the change is.** One `it()` block, made to assert both spellings using the
same `withInvokedBin` helper the other seven pinned tests in this task use, plus
the one-line import it requires. The `it()` title is unchanged. The assertion is
strictly stronger than before: it previously proved one spelling and now proves
both.

```
ac25e4b410d1a344defada4719184ce8e988ad232ac883ca208c0c36f668a513  (before)
3c1d3ef51929b911399439d4bec5001e68f88bce8744ba429a263be7e33db95b  (after)
```

**Everything else the constraint covered held.** These five files are
byte-identical to the digests recorded before any work began, and were re-checked
after every worker commit across all eleven stories:

```
0bc2686007e137d090f9a9b543a08fefd92376a9eeccd7752eade97b147f373c  .agro/evals/probes/oh-devcontainer-restructure.sh
664447701d78612ea1ebb4029aa91c8b0919400237cd9e508d6fe2be46e555ec  .agro/evals/probes/oh-home-mount.sh
826fef45e2e665b3ef11c88647f165510142108f355b0b41ec4853af49fbd974  .agro/evals/probes/oh-image-only-deploy.sh
fc15dcc07bef1badaec51991d453a7f55ac420507ca41ecb6deb7d142602d3e6  .devcontainer/entrypoint.sh
28106a310cfee535ff64a22f27e5970377a2ffcacea106dd8b3256718b6bee0c  .devcontainer/docker-compose.yml
```

**Why this does not undermine what the freeze protected.** The freeze existed so
that US-005's image-selection change could not be laundered through the test that
proves #1042's behaviour. US-005's behaviour change was dropped on evidence, so
`materialize()` and its assertions are untouched. The edited assertion covers
`resolveSandboxRoot`, a different function.

**The generalisable lesson.** A byte-identity freeze on a *test* file is a
freeze on the assertions it makes, and those assertions can pin the very literal
a task is chartered to remove. Freezing a probe or a fixture is safe; freezing a
test that asserts product strings collides with any rename. The right constraint
here would have been "may not weaken any assertion in `registry.test.ts`", which
this change satisfies. The worker stopped on the site rather than edit the file
or weaken `registry.ts`, which is what surfaced the conflict for a decision
instead of letting it be quietly resolved either way.
