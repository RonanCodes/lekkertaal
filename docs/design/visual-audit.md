# Lekkertaal visual-fidelity audit

Live app (mobile 390x844, signed in as `seed_ronan`, `DEV_BYPASS_AUTH`) vs the Claude Design canvas (`docs/design/Lekkertaal.html`). Captured 2026-05-22.

Method: live screens captured full-page on a mobile viewport; design frames captured from the canvas focus overlay (one phone frame at a time). The brand orange+blue palette is intentional and is NOT flagged.

## Summary table

| Screen | Verdict | One-line visual gap | Live shot | Design shot |
|---|---|---|---|---|
| landing | ⚪ NOT CAPTURED | `/` redirects to `/app/path` when signed in; logged-out hero not reachable in this session | (none) | `audit/design-landing.png` |
| path | ⚠️ PARTIAL | Lessons render as wide stacked cards + boss-fight bars, not the design's staggered circular tile-grid; locked lower units show empty grey image placeholders | `audit/live-path.png` | `audit/design-path.png` |
| unit | ⚠️ PARTIAL | Sticky "Start next lesson" bar overlaps the lesson list; lesson rows lack the design's per-lesson XP + accuracy badges | `audit/live-unit.png` | `audit/design-unit.png` |
| lesson-player | ⚠️ PARTIAL | Global top nav + streak bar + bottom tab dock stay visible; design's lesson player is full-screen immersive (just ✕ / progress / hearts). Progress bar starts empty/grey | `audit/live-lesson-player.png` (+ `audit/live-lesson-feedback.png`) | `audit/design-lesson-player.png` |
| lesson-complete | ⚪ NOT CAPTURED | Lesson is very long (7+ match-pairs drills, did not terminate); could not reach the completion screen by hand. Correct-feedback green bar IS implemented (see feedback shot) | (none) | `audit/design-lesson-complete.png` |
| roleplay | ⚠️ PARTIAL | Dark scene header + objective chips + AI bubble all match; but global app chrome sits above the immersive header and the bottom input/mic bar is obscured by the tab dock | `audit/live-roleplay.png` | `audit/design-roleplay.png` |
| scorecard | ⚪ NOT CAPTURABLE | No completed roleplay session, so the route falls back to the roleplay screen (expected, data-gated) | `audit/live-scorecard.png` (shows fallback) | `audit/design-scorecard.png` |
| leaderboard | ⚠️ PARTIAL | Ranked rows + pinned highlighted "you" row match; but no named "wafel-tier league" card header and no Promotion/Demotion zone dividers from the design | `audit/live-leaderboard-alltime.png` (+ `audit/live-leaderboard.png`) | `audit/design-leaderboard.png` |
| peer | ⚠️ PARTIAL | Largely empty-state (seed user has no friends/drills); missing the design's search-learners bar and populated drill/request rows | `audit/live-peer.png` | `audit/design-peer.png` |
| shop | ⚠️ PARTIAL | Balance hero + freeze + power-ups + treat-family cosmetics all present and close; missing the design's "Heart refills" section; section order differs | `audit/live-shop.png` | `audit/design-shop.png` |
| profile | ✅ MATCH | Identity hero + 4-stat strip + heatmap + badge grid all present (heatmap empty due to seed data; 15 badges vs design's 28) | `audit/live-profile.png` | `audit/design-profile.png` |
| settings | ⚠️ PARTIAL | Live exposes a Dark + System theme switch the design explicitly excludes (light-only brand); missing the design's slow-replay toggle and granular notification toggles | `audit/live-settings.png` | `audit/design-settings.png` |
| onboarding | ⚠️ PARTIAL | Live `/onboarding` is a 5-question placement quiz; design's first step is a goal/"why Dutch?" picker. Sub-steps (goal / level-pick / notifications) all redirect back to the quiz for an already-onboarded user, so they were not capturable | `audit/live-onboarding.png` | `audit/design-onboarding.png` (+ `-level`, `-notifs`) |
| styleguide | ✅ MATCH | Full design-system page (shadcn primitives, the mascot cast in 3 moods, palette proposals, animation frames) renders complete | `audit/live-styleguide.png` | `audit/design-canvas-full.png` (mascot sheet section) |

Verdict counts: 2 MATCH, 8 PARTIAL, 3 NOT CAPTURED/CAPTURABLE.

---

## Per-screen detail

### landing — NOT CAPTURED
`http://localhost:3004/` redirects to `/app/path` because the session is authenticated. The logged-out marketing hero (design: "Dutch that actually sticks." + feature triplet + phone preview, `ScreenLanding` in `docs/design/screens-brand.jsx`) cannot be captured without signing out. A human should re-run this screen in a logged-out / incognito context.

### path — PARTIAL
Live (`audit/live-path.png`) has: top bar (logo + Path/Profile text tabs + dev pill), a streak/freeze/XP/coins row with hearts, "Your path" heading, a Daily Quests card, a "Word of the day" card (`rennen`), then unit blocks. Each unit shows its lessons as full-width stacked cards followed by a wide orange "BOSS FIGHT" bar.

Concrete diffs vs `audit/design-path.png`:
- Design lays lessons out as **staggered circular tile nodes** inside a "neighbourhood block" (Hallo / Bestellen / Cijfers / Brood / Tompoes / Koffie with a central star boss node). Live uses **vertical full-width cards**, a different layout metaphor.
- Live's lower/locked units render **empty grey image placeholder boxes** where a unit mascot should be (broken/missing art on locked units).
- Live has an extra "Word of the day" card not in the design.
- Primary nav in the design is a **4-icon bottom dock** (Path / League / Shop / Me); live's bottom dock has only **Path + Peer drills** (2 items) and the top uses text tabs.

### unit — PARTIAL
Live (`audit/live-unit.png`) is close to `audit/design-unit.png`: unit hero card with stroopwafel mascot + CEFR tag + title + progress bar, a Lessons list, a "Grammar concept" card, a "Vocab in this unit" expander, and the dark "Caps the unit" AI roleplay teaser ("Koffie bestellen").

Concrete diffs:
- A **sticky "Next lesson… Start next lesson" bar overlaps the lesson list** mid-page, hiding the top of the Vocab section in the full-page capture.
- Design lesson rows carry a **per-lesson XP chip + accuracy %**; live rows show only title + subtitle + a single "+15 XP" on the one lesson.
- Vocab preview chips look cramped/wrapping awkwardly.

### lesson-player — PARTIAL
Live (`audit/live-lesson-player.png`, match-pairs drill) renders the correct lesson chrome (✕ exit, progress bar, hearts) and a clean drill card.

Concrete diffs vs `audit/design-lesson-player.png`:
- The **global app chrome is NOT hidden**: the `Lekkertaal / Path / Profile` banner, the streak/XP/coins/bell row, AND the bottom mobile tab dock all stay visible above/below the lesson. Design's lesson player is full-screen immersive with only the ✕ / progress / hearts chrome. (Confirmed in the DOM: two `banner` landmarks + a `navigation "Primary (mobile)"` are present inside the lesson route.)
- The **progress bar renders empty/grey** at lesson start; design shows an orange-filled progress track.
- Positive: the docked green feedback bar + "Continue" button IS implemented and matches the design's correct-state intent (`audit/live-lesson-feedback.png`).

### lesson-complete — NOT CAPTURED
Lesson `/app/lesson/1` served 7+ consecutive match-pairs drills without terminating during the audit, so the completion screen ("Lekker gedaan." stat postcard + waffle confetti, `ScreenLessonComplete` in `docs/design/screens-celebration.jsx`) could not be reached by hand. Design frame captured at `audit/design-lesson-complete.png`. A human (or a test that posts a lesson-complete) should verify this screen directly.

### roleplay — PARTIAL
Live (`audit/live-roleplay.png`) matches the design intent well: dark scene header with mascot (Anouk), title "Koffie bestellen", objective chips, 0/8 progress, and the AI greeting bubble with an audio control.

Concrete diffs vs `audit/design-roleplay.png`:
- Global app chrome (logo/nav + streak row) sits **above the immersive dark header**; design is full-screen.
- The **bottom chat input + mic bar is obscured** by the mobile tab dock and the TanStack devtools overlay; a partial orange button is visible peeking behind the dock. The composer should sit cleanly above any chrome.

### scorecard — NOT CAPTURABLE (data-gated)
`/app/scenario/cafe-ordering-coffee/scorecard` falls back to the live roleplay screen because there's no completed session (`audit/live-scorecard.png` shows the fallback). Expected per the brief. Design frame at `audit/design-scorecard.png` (conic-gradient score ring + cardified criteria). Needs a completed roleplay to verify.

### leaderboard — PARTIAL
Live all-time view (`audit/live-leaderboard-alltime.png`) shows ranked rows with medals, mascot avatars, XP, up/down trend arrows, and a highlighted/pinned "you" row (Ronan) — the core of the design.

Concrete diffs vs `audit/design-leaderboard.png`:
- No **named "Stroopwafel league" tier card** header ("Top 3 promote to …").
- No explicit **Promotion zone / Demotion zone** divider rows.
- Live framing is a global "Top 50 by XP" with Today/This week/All time + Global/Friends toggles; the "Today" window is empty (`audit/live-leaderboard.png`), so always-on competitor rows only appear under All time.

### peer — PARTIAL
Live (`audit/live-peer.png`) shows the right scaffold (heading + mascot, "Send a sentence" card, "Inbox (0)" card) but is in **empty state** because the seed user has no friends or pending drills.

Concrete diffs vs `audit/design-peer.png`:
- Missing the design's **search-learners bar** at the top.
- No populated **peer-drill cards** (with Play buttons) or **friend-request rows** (Accept/Decline). Mostly a data-seed gap, but the search bar is a real structural omission.

### shop — PARTIAL
Live (`audit/live-shop.png`) is strong: "Your balance" hero with mascot + coins, a 3-stat strip, a Streak freezes section, a Power-ups section, and a treat-family avatar cosmetics grid (Poffertjes EQUIPPED, Oliebollen Equip, Tompouce, Kaas, Kroket, Drop) with prices.

Concrete diffs vs `audit/design-shop.png`:
- Missing the design's **"Heart refills" section** (Refill hearts / Unlimited 30 min).
- Section order differs (live: freezes → power-ups → avatars; design: freezes → heart refills → avatars → power-ups).

### profile — MATCH
Live (`audit/live-profile.png`) faithfully reproduces `audit/design-profile.png`: identity hero (mascot avatar + Lv badge + name + CEFR chip + gear), 4-stat strip (Streak / Total XP / League / Lessons), "Activity · last 12 weeks" heatmap with Less/More legend, and a badge grid. Minor: heatmap is empty (no seed activity) and the grid shows 15 badges vs the design's 28. A "Danger zone / Reset my learning data" card is an additive extra. No issue proposed.

### settings — PARTIAL
Live (`audit/live-settings.png`) covers Account, Learning (Level + Daily goal cards), Reminders, Appearance, Privacy.

Concrete diffs vs `audit/design-settings.png`:
- Live exposes an **Appearance → Theme: Light / Dark / System** switcher. The design notes explicitly say the product is **light-only** ("the brand is sunlight + paper + treats — that doesn't translate to dark"). Live shipping a Dark + System toggle contradicts the design decision.
- Missing the design's **"Slow-replay by default in listening drills"** toggle (under Learning).
- Missing the design's **granular notification toggles** (Friend & peer-drill pings, Streak alerts, Email digest); live only has a single Daily reminder + reminder hour.

### onboarding — PARTIAL
Live `/onboarding` (`audit/live-onboarding.png`) is a **"Quick placement check"** — a 5-question quiz with an "I know my level, let me pick" escape hatch. The design's onboarding step (a) is a **goal/"why are you learning Dutch?" picker** (Moving to NL / Dating a Dutchie / Study / Brain food), `audit/design-onboarding.png`.

`/onboarding/goal`, `/onboarding/level-pick`, `/onboarding/notifications` all **redirect back to the placement quiz** for an already-onboarded user, so the individual welcome / level-pick / notifications steps (designs at `audit/design-onboarding.png`, `audit/design-onboarding-level.png`, `audit/design-onboarding-notifs.png`) were not capturable in this session. A human should re-run onboarding with a fresh (un-onboarded) user.

### styleguide — MATCH
Live `/styleguide` (`audit/live-styleguide.png`) is a complete internal design-system page: shadcn primitives, the full Lekkertaal mascot cast (Kroket, Bitterballen, Oliebollen, Drop, Poffertjes, Frikandel, Tompouce, Kaas) each in 3 moods, the Stroop reference, palette proposals (Candy / Warm Bakery / Vibrant), and animation frames. It is the live counterpart to the canvas's mascot-sheet + palette sections and renders fully. No issue proposed.

---

## Proposed issues

### 1. Visual fidelity: lesson-player — hide global app chrome for an immersive lesson

**Goal:** The lesson player should be full-screen immersive like the design: only the ✕ exit, progress bar, and hearts, with no surrounding app navigation.

**Visual gaps seen (`audit/live-lesson-player.png` vs `audit/design-lesson-player.png`):**
- The `Lekkertaal / Path / Profile` top banner and the streak/XP/coins/bell row both render above the lesson chrome.
- The bottom `Primary (mobile)` tab dock (Path / Peer drills) renders below the drill.
- The progress bar starts empty/grey instead of orange-filled.

**File to edit:** the lesson route layout (`src/routes/app.lesson.$id.tsx` and/or the shared `app` layout that injects the banners + mobile nav). Reference `docs/design/screens-drills.jsx`.

**Acceptance:** entering a lesson hides the global top banner, streak row, and bottom tab dock; only ✕ / progress / hearts chrome shows; progress track uses the brand fill colour.

### 2. Visual fidelity: path — staggered tile-grid + fix broken locked-unit art

**Goal:** Match the design's neighbourhood-block layout and remove broken images.

**Visual gaps seen (`audit/live-path.png` vs `audit/design-path.png`):**
- Lessons render as full-width stacked cards rather than the design's staggered circular tile nodes with a central star boss node.
- Locked lower units show empty grey image-placeholder boxes (missing/broken mascot art).
- Bottom nav has only 2 items vs the design's 4-icon dock.

**File to edit:** `src/routes/app.path.tsx` and the path/unit-block + lesson-tile components. Reference `docs/design/screens-path.jsx`.

**Acceptance:** lessons display as staggered tiles within a unit block; no empty grey placeholders on locked units; bottom dock matches the intended item set.

### 3. Visual fidelity: roleplay — immersive header + unobstructed composer

**Goal:** Full-screen roleplay with the chat input/mic bar clearly above any chrome.

**Visual gaps seen (`audit/live-roleplay.png` vs `audit/design-roleplay.png`):**
- Global app chrome sits above the dark scene header.
- The bottom composer + mic button is obscured by the mobile tab dock (only a sliver of the orange button is visible).

**File to edit:** `src/routes/app.scenario.$slug.tsx` (and the shared app layout). Reference `docs/design/screens-social.jsx` / the roleplay frame in `docs/design/app.jsx`.

**Acceptance:** the roleplay route hides the global nav/streak chrome and the tab dock; the composer + mic sit flush at the bottom and are fully visible.

### 4. Visual fidelity: settings — honour the light-only design decision + restore missing toggles

**Goal:** Align Settings with the design (light-only) and add the missing learning/notification controls.

**Visual gaps seen (`audit/live-settings.png` vs `audit/design-settings.png`):**
- Live exposes an Appearance → Theme: Light / Dark / System switcher; the design is explicitly light-only.
- Missing the "Slow-replay by default in listening drills" toggle under Learning.
- Missing granular notification toggles (Friend & peer-drill pings, Streak alerts, Email digest).

**File to edit:** `src/routes/app.settings.tsx`. Reference the Settings frame in `docs/design/screens-misc.jsx`.

**Acceptance:** the Dark/System theme switch is removed (or the light-only decision is explicitly re-ratified); slow-replay + the three notification toggles are present.

### 5. Visual fidelity: leaderboard — add the wafel-tier league framing

**Goal:** Reframe the global XP list as the design's named league with promotion/demotion zones.

**Visual gaps seen (`audit/live-leaderboard-alltime.png` vs `audit/design-leaderboard.png`):**
- No named "Stroopwafel league" tier card header.
- No Promotion zone / Demotion zone divider rows.

**File to edit:** `src/routes/app.leaderboard.tsx`. Reference the Leaderboard frame in `docs/design/screens-social.jsx`.

**Acceptance:** a league-tier header card and promotion/demotion zone dividers appear above/within the ranked rows; the pinned "you" row keeps its highlight.

### 6. Visual fidelity: unit — stop the sticky CTA overlapping the lesson list + add per-lesson stats

**Goal:** The "Start next lesson" CTA should not cover content, and lesson rows should show XP + accuracy like the design.

**Visual gaps seen (`audit/live-unit.png` vs `audit/design-unit.png`):**
- The sticky "Next lesson…" bar overlaps the top of the lesson list / Vocab section.
- Lesson rows lack per-lesson XP chip + accuracy %.

**File to edit:** `src/routes/app.unit.$slug.tsx`. Reference the Unit frame in `docs/design/screens-path.jsx`.

**Acceptance:** the sticky CTA does not occlude the lesson list (e.g. bottom padding / safe-area); each lesson row shows its XP + accuracy badge.

### 7. Visual fidelity: shop — add the Heart refills section

**Goal:** Match the design's shop section set.

**Visual gaps seen (`audit/live-shop.png` vs `audit/design-shop.png`):**
- No "Heart refills" section (Refill hearts / Unlimited 30 min).
- Section order differs from the design.

**File to edit:** `src/routes/app.shop.tsx`. Reference the Shop frame in `docs/design/screens-misc.jsx`.

**Acceptance:** a Heart refills section is present with refill + unlimited-window items; section order follows the design (freezes → heart refills → avatars → power-ups).

### 8. Visual fidelity: peer — add the search-learners bar (+ populated states)

**Goal:** Match the design's peer-drills inbox top chrome.

**Visual gaps seen (`audit/live-peer.png` vs `audit/design-peer.png`):**
- Missing the search-learners bar at the top.
- Empty states only (no friend/drill/request rows) — partly seed data, but the search bar is a real omission.

**File to edit:** `src/routes/app.peer.tsx`. Reference the Friends frame in `docs/design/screens-social.jsx`.

**Acceptance:** a search-learners input is present; with seeded friends/drills the page shows peer-drill cards and request rows matching the design.

### 9. Visual fidelity: onboarding — reconcile placement-quiz vs goal-picker flow

**Goal:** Decide and align the onboarding first step. The design opens with a goal/"why Dutch?" picker; the live app opens with a placement quiz.

**Visual gaps seen (`audit/live-onboarding.png` vs `audit/design-onboarding.png` / `-level` / `-notifs`):**
- Live `/onboarding` is a 5-question placement check; design step (a) is the goal picker.
- `/onboarding/goal`, `/onboarding/level-pick`, `/onboarding/notifications` redirect back to the quiz for already-onboarded users (couldn't capture the individual steps).

**File to edit:** `src/routes/onboarding.tsx`, `onboarding.goal.tsx`, `onboarding.level-pick.tsx`, `onboarding.notifications.tsx`. Reference `docs/design/screens-onboarding.jsx`.

**Acceptance:** either the design's goal → level → notifications sequence is restored, or the placement-quiz approach is explicitly ratified as the chosen onboarding and the design canvas is updated to match. Verify each step renders for a fresh (un-onboarded) user.

---

## Screens needing a human re-run (state/auth-gated, not code defects per se)
- **landing**: capture logged-out (incognito).
- **lesson-complete**: reach the completion screen (lesson 1 didn't terminate in a hand-run).
- **scorecard**: complete a roleplay first.
- **onboarding sub-steps**: re-run with an un-onboarded user.
