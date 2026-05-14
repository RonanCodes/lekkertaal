# 0001 — PR-only merges to main, CI-gated, `gh api` squash workaround

**Status:** Accepted
**Date:** 2026-05-14

## Context

Lekkertaal deploys on push to `main`. Without a gate, a broken commit reaches production. We also want every change reviewable, even when authored by an agent (Ralph / planner-worker), because the agent operates against a single PRD that we want to keep traceable.

The local `gh` CLI's config has a JSON parsing bug that surfaces on `gh pr merge --squash` against this repo, with the error:

```
invalid character '{' after object key:value pair
```

The same call against the REST endpoint works fine.

## Decision

1. **`main` is protected.** No direct pushes. Every change goes through a PR.
2. **CI must be green** to merge. Two jobs: `quality` (format + lint + build + test) on every push and PR; `deploy` on push to main only, gated on `quality`.
3. **Squash-merge only.** Linear history. The PR body becomes the commit body.
4. **Merge via REST when `gh pr merge` fails:**

   ```bash
   gh api -X PUT repos/RonanCodes/lekkertaal/pulls/<N>/merge -f merge_method=squash
   ```

5. **`--admin` is forbidden** for merging. If CI is red, fix CI, don't override.

## Consequences

- Agents must open PRs, not push to main. This is enforced in skill prompts (`/ro:ralph`, `/ro:planner-worker`).
- The `gh api` workaround is a known wart; if upstream gh fixes the JSON bug, switch back to `gh pr merge --squash`. Track with `gh --version` checks.
- The `production` GitHub environment holds the Cloudflare secrets so CI can deploy. Direct pushes can't read those secrets even if branch protection were bypassed.

## Related

- `.github/workflows/ci.yml` for the gating definition
- [`/ro:cf-ship`](https://github.com/RonanCodes/ronan-skills/tree/main/skills/cf-ship) for the pre-flight gate that runs before the deploy job
