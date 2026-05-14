# 0005 — Adopt Pocock GH-issue PRD pattern; retire `.ralph/*.json`

**Status:** Accepted
**Date:** 2026-05-14

## Context

Phase 1 of lekkertaal was driven from `.ralph/prd.json` — a local JSON file with ~100 stories that Ralph + planner agents read directly. It worked, but the friction was real:

- JSON drift vs. the markdown discussion it came from.
- Search, dashboards, assignees, mentions all unavailable outside the agent's reading scope.
- Humans (and other agents) coming to the repo had to learn a bespoke schema.
- Closing a story meant editing JSON, not closing an issue. The two states drifted.

Matt Pocock's sandcastle pattern (issues #790-#800) lives entirely on GitHub: one parent issue per PRD, child issues per slice, a single label gating the queue.

## Decision

Adopt the Pocock pattern for all new PRDs on this repo:

1. **PRD = one parent GitHub issue.** Body uses the 7-section template (Problem Statement / Solution / User Stories / Implementation Decisions / Testing Decisions / Out of Scope / Further Notes).
2. **Slices = child issues.** Body starts with `## Parent\n\n#<N>` to link upward. Optional `## Blocked by` for ordering. Same single label.
3. **One gating label: `ready-for-agent`.** No `epic`, `prd`, `phase`, or other taxonomy labels. The body shape (presence of `## Parent`) distinguishes parent from child.
4. **Merge semantics:** PRs use `Closes #<child>` so slices auto-close on merge. Parent stays open until all children close.
5. **Agent queue:** `gh issue list --label ready-for-agent` is the canonical agent pickable list. No `.ralph/*.json` for new work.

## Consequences

- Phase 1 `.ralph/prd.json` stays as historical record but is frozen. Phase 1 is closed.
- Phase 2 + AI SDK gaps are filed as issues #44, #53 with children #45-#52, #54-#63.
- `/ro:write-a-prd`, `/ro:slice-into-issues`, `/ro:ralph`, `/ro:planner-worker` were retrofitted to default to GH-issue mode when a `gh` remote is present (ronan-skills v1.44.0).
- New constraint: the GH issue body is the source of truth. If a slice scope shifts, the issue is edited; no separate JSON to keep in sync.

## Related

- Parent: pattern source page is [skill-lab:agent-native-repo-pocock](obsidian://open?vault=llm-wiki-skill-lab&file=wiki%2Fpatterns%2Fagent-native-repo-pocock)
- Global memory: `feedback-pocock-gh-issue-prd-pattern`
- First PRDs filed under this pattern: #44 (AI SDK gaps), #53 (Phase 2 lekkertaal)
