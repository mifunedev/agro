---
name: strategic-proposal
description: |
  Prioritize a repository-grounded roadmap through /council and one required
  strategic critic. Report advice by default; publish only on explicit request.
  TRIGGER when: asked to build roadmap, prioritize features, strategic proposal,
  "what should we build next", or rank product priorities.
argument-hint: "<roadmap-question-or-brief>"
disable-model-invocation: true
---

# Strategic Proposal

Own roadmap scope, evidence, phases, and authorized publication. Keep synthesis in the active advisor.
Arguments received: `$ARGUMENTS`

## 1. Resolve scope and evidence

1. Resolve the question, criteria, constraints, exclusions, source bounds, budget, and target repository from the request or supplied brief.
2. Resolve whether the operator explicitly requests publication. Ranking priorities alone authorizes no GitHub mutation.
3. If the question is empty, print `Usage: /strategic-proposal <roadmap-question-or-brief>` and request clarification. Stop without dispatch.
4. If material inputs remain unresolved, report `BLOCKED` and ask for the missing inputs.
5. Read the target's actual current `AGENTS.md`, `README.md`, and relevant docs before forming claims.
6. Read relevant issues and community evidence within authorized sources. Cite sources and distinguish observations from assumptions.
7. Keep missing or inaccessible data explicit. Do not invent product state, counts, routes, or gaps.

Local advice requires no GitHub authentication. Disclose unavailable remote evidence instead of treating missing data as success.
Require cited demand evidence for each `Build Now` item.
Exempt only concrete infrastructure prerequisites tied to a cited dependent outcome; name that dependency and explain why the prerequisite blocks it.
Without demand evidence or that exemption, keep the item outside `Build Now` and name the missing evidence.

## 2. Deliberate through council

1. Use [`/council`](../council/SKILL.md) as the sole independent deliberation and critique procedure.
2. Supply a neutral brief with the resolved inputs, evidence, demand rule, and required roadmap table.
3. Explicitly require one strategic critic to challenge phase assignments, evidence claims, complexity estimates, and dependencies, even for low-risk choices.
4. Follow council's bounded proposal round, verification, critique, and advisor response. Keep dissent and evidence limits visible.
5. If council returns `PARTIAL` or `BLOCKED`, return accepted observations only. Give no final roadmap and do not publish.
6. For `COMPLETE`, report the roadmap below with rationale, dissent, unknowns, and the next authorized step.

Council owns independent deliberation; `/delegate` stays behind council. Do not add dispatch, a fixed panel, synthesis workers, or a separate ledger.
If the operator explicitly requests weighting, follow council's [explicit weighting boundary](../council/SKILL.md#explicit-weighting).
Reuse accepted candidates through `/weigh --cohort`; do not sample another panel.
Weighting does not replace required critique, establish demand evidence, or authorize publication.
If weighting returns `NO-SELECTION`, report that result and withhold any selection-dependent roadmap or publication.

| Phase | Problem/outcome | Evidence | Dependencies | Smallest next step | Measure/risk |
| --- | --- | --- | --- | --- | --- |
| `<Build Now / Next / Later>` | `<user problem and outcome>` | `<citation or explicit gap>` | `<prerequisite or none>` | `<bounded action>` | `<outcome measure and risk>` |

## 3. Publish only on explicit request

Without explicit publication intent, stop with report-only advice. Do not edit, create, label, or pin an issue.
Run publication commands inside the sandbox with bounded timeouts.

1. Verify the operator's repository with `gh repo view "$repo" --json nameWithOwner,url`.
2. Check `gh auth status`. Missing authentication or repository access means `BLOCKED`, not `HEARTBEAT_OK`.
3. Locate `Product Roadmap` issues with label `roadmap`; search all pages and states to avoid duplicates:

   ```bash
   gh api --method GET "repos/$repo/issues" --paginate \
     -f state=all -f labels=roadmap -f per_page=100 \
     --jq '.[] | select(.pull_request == null and .title == "Product Roadmap") | {number,title,state,html_url}'
   ```

4. Verify any operator-specified issue against that repository and purpose. Multiple matches require target clarification; never select the first match.
5. If only a closed match exists, request target clarification. Do not create a replacement automatically.
6. If no match exists, require explicit creation intent and the existing `roadmap` label. Otherwise report `BLOCKED`.
7. Before mutation, record the target's pin state with the query in step 14; derive `$owner` and `$name` from the verified `$repo`.
8. For an existing target, re-read `gh issue view "$number" --repo "$repo" --json number,title,body,labels,url` immediately before editing.
9. For an existing target, save the prior body and title in authorized local scratch. Preserve all content outside the approved scope.
10. Apply [`/ste`](../ste/SKILL.md) to the proposed complete body. Set `$body_file` to the approved body in authorized scratch, not raw shell-interpolated prose.
11. For an existing target whose body differs, edit only that issue. If the body matches, skip the edit:

    ```bash
    gh issue edit "$number" --repo "$repo" --body-file "$body_file"
    ```

12. For explicitly authorized creation, create once and resolve `$number` from the returned URL:

    ```bash
    gh issue create --repo "$repo" --title "Product Roadmap" --label roadmap --body-file "$body_file"
    ```

13. Only with explicit pin intent, run `gh issue pin "$number" --repo "$repo"` if the issue is not already pinned.
14. Verify pin state through the repository's `pinnedIssues` query:

    ```bash
    gh api graphql -f owner="$owner" -f name="$name" \
      -f query='query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { pinnedIssues(first: 10) { nodes { issue { number title } } } } }'
    ```

15. Re-read the issue body and title with step 8. Compare them against the intended body and preserved or approved title.

Preserve the prior pin state unless pinning was explicit.
On a write or verification failure, report `BLOCKED` with the observed state. Do not claim publication success or automatically retry creation.
Reconcile the issue before retrying. Propose restoration from the saved body and title; require authorization before restoring or undoing publication.

## 4. Report and stop

Report `ADVICE` for a complete report-only roadmap, or council's `PARTIAL`/`BLOCKED` with observations and missing requirements.
Report `PUBLISHED` with the verified URL only after the body, title, and pin checks pass.
If the approved body, title, and pin state already match, report `NO-CHANGE` with the verified URL.
Do not update the wiki, implement items, start a build, or merge work.

Examples: `/strategic-proposal Rank onboarding priorities; report only` returns advice after required critique.
`/strategic-proposal` requests input without dispatch. After an auth blocker, resume only the authorized publication against the verified target.
