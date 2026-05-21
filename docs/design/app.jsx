/* global React, ReactDOM, DesignCanvas, DCSection, DCArtboard, DCPostIt,
          ScreenLanding, ScreenLandingCanal, ScreenOnbWelcome, ScreenOnbLevel, ScreenOnbNotifs,
          ScreenPath, ScreenUnit,
          DrillMultipleChoice, DrillMultipleChoiceCorrect, DrillMultipleChoiceWrong,
          DrillTranslation, DrillFillBlank, DrillWordOrder, DrillMatchPairs,
          DrillListeningMC, DrillListeningSpell, DrillImageWord, DrillSpeak,
          DrillOutOfHearts,
          ScreenLessonComplete, ScreenRoleplay, ScreenScorecard,
          ScreenLeaderboard, ScreenFriends, ScreenNotifications,
          ScreenShop, ScreenProfile, ScreenSettings,
          ScreenMascotSheet */

// Phone artboard footprint
const PHONE_W = 390;
const PHONE_H = 844;
// add gutter for shadow + bezel
const AB_W = 420;
const AB_H = 880;

function PhoneArtboard({ children, label }) {
  return (
    <div style={{ width: AB_W, height: AB_H, background: "#f1e9d6",
      display: "grid", placeItems: "center", padding: 8 }}>
      {children}
    </div>
  );
}

function App() {
  return (
    <DesignCanvas>
      {/* ===== Intro post-it ===== */}
      <DCSection id="intro" title="Lekkertaal — design exploration"
        subtitle="Hi-fi prototype · 14 screens · 9 drill types · 3 palettes. Built on the live tokens from src/styles.css (Fredoka / Nunito, chunky 3D buttons, paper background). Original layout language — not a clone of any specific app.">
        <DCPostIt>
          <b>How to read this canvas</b><br/>
          Scroll right within a row; scroll down for the next group. Tap any artboard to focus.<br/><br/>
          <b>Direction</b><br/>
          Bold & playful. Tactile 3D buttons. Mascots present but never dense.
          Original metaphor: lessons are tiles in a "neighbourhood block" — not a tree.
          Boss-fights are wide gradient bars at the unit's foot.<br/><br/>
          <b>Light & dark</b> covered in the Settings group.<br/>
          <b>Mobile-first</b>; desktop sidebar covered in design notes.
        </DCPostIt>
      </DCSection>

      {/* ===== 01 · Marketing landing ===== */}
      <DCSection id="landing" title="01 · Landing page"
        subtitle="Cold visitor from social → signup. Direction 1A is the chosen path; 1B (canal scene) is kept here as a deprecated reference.">
        <DCArtboard id="landing" label="1A · CHOSEN — feature triplet + phone preview" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenLanding /></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="landing-canal" label="1B · DEPRECATED — canal scene hero" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenLandingCanal /></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 02 · Onboarding ===== */}
      <DCSection id="onboarding" title="02 · Onboarding"
        subtitle="From signup → first lesson in under a minute. Three steps, Stroop guides each one.">
        <DCArtboard id="onb-welcome" label="(a) Welcome · Why Dutch?" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenOnbWelcome/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="onb-level" label="(b) Level pick · A1 / A2 / B1" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenOnbLevel/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="onb-notifs" label="(c) Notifications opt-in" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenOnbNotifs/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 03 · Learning Path ===== */}
      <DCSection id="path" title="03 · Learning Path"
        subtitle="Daily return surface. Unit = neighbourhood block; lessons are staggered tile-grids; boss-fight is a wide gradient bar at the foot. Live tokens (orange + canal blue).">
        <DCArtboard id="path-mid" label="Mid-progress (default)" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenPath /></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="path-quests-collapsed" label="Quests collapsed — fewer pixels" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenPath showQuests={false}/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 04 · Unit detail ===== */}
      <DCSection id="unit" title="04 · Unit detail"
        subtitle="Preview a unit before diving in. Lesson list with per-lesson progress. The roleplay boss-fight teaser sits in a dark, premium card at the bottom.">
        <DCArtboard id="unit-bakker" label="Unit 03 — Bij de bakker" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenUnit/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 05 · Lesson player — all 9 drill types ===== */}
      <DCSection id="drills" title="05 · Lesson player — all 9 drill types"
        subtitle="One question per screen. Top progress + hearts. Big chunky Check button docked at the bottom — green when satisfied, becomes Continue after grading.">
        <DCArtboard id="d-mc" label="① multiple_choice — selected" width={AB_W} height={AB_H}>
          <PhoneArtboard><DrillMultipleChoice/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="d-trans" label="② translation_typing — with word bank" width={AB_W} height={AB_H}>
          <PhoneArtboard><DrillTranslation/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="d-blank" label="③ fill_blank — chip filled" width={AB_W} height={AB_H}>
          <PhoneArtboard><DrillFillBlank/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="d-order" label="④ word_ordering — tray in progress" width={AB_W} height={AB_H}>
          <PhoneArtboard><DrillWordOrder/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="d-match" label="⑤ match_pairs — one pair matched" width={AB_W} height={AB_H}>
          <PhoneArtboard><DrillMatchPairs/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="d-lmc" label="⑥ listening_mc — slow replay" width={AB_W} height={AB_H}>
          <PhoneArtboard><DrillListeningMC/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="d-lspell" label="⑦ listening_spell — typo-tolerant" width={AB_W} height={AB_H}>
          <PhoneArtboard><DrillListeningSpell/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="d-img" label="⑧ image_word — image-forward" width={AB_W} height={AB_H}>
          <PhoneArtboard><DrillImageWord/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="d-speak" label="⑨ speak — mic + scored transcript" width={AB_W} height={AB_H}>
          <PhoneArtboard><DrillSpeak/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 05b · Drill states ===== */}
      <DCSection id="drill-states" title="05b · Drill states"
        subtitle="Inline feedback (no separate screen): green flush + happy Stroop on correct; red shake + surprised + correct answer revealed on wrong. Out-of-hearts is a sheet, not a route.">
        <DCArtboard id="state-correct" label="Correct — green feedback bar" width={AB_W} height={AB_H}>
          <PhoneArtboard><DrillMultipleChoiceCorrect/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="state-wrong" label="Wrong — red, answer revealed" width={AB_W} height={AB_H}>
          <PhoneArtboard><DrillMultipleChoiceWrong/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="state-oo-hearts" label="Out of hearts — sheet" width={AB_W} height={AB_H}>
          <PhoneArtboard><DrillOutOfHearts/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 06 · Lesson complete ===== */}
      <DCSection id="complete" title="06 · Lesson complete"
        subtitle="Original celebration: a 'trofee postcard' stat card overlaps the mascot — not a giant mascot reveal. Waffle-square confetti. Milestone variant is full-bleed gradient + bigger mascot.">
        <DCArtboard id="comp-normal" label="Normal" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenLessonComplete variant="normal"/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="comp-perfect" label="Perfect lesson — bonus card" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenLessonComplete variant="perfect"/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="comp-milestone" label="30-day milestone — full-bleed" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenLessonComplete variant="milestone"/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 07 · Roleplay ===== */}
      <DCSection id="roleplay" title="07 · AI boss-fight roleplay"
        subtitle="Scene-themed dark header; Kroket on the till. Objectives chips up top. Streaming text with a live caret. Gentle correction chips inline on the user's bubble — not a separate review screen.">
        <DCArtboard id="rp-mid" label="Mid-conversation · AI streaming" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenRoleplay state="mid"/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 08 · Scorecard ===== */}
      <DCSection id="scorecard" title="08 · Roleplay scorecard"
        subtitle="Feels like a win, not an exam. Headline score in a conic-gradient ring; criteria are individually cardified; tips are positive nudges, not corrections.">
        <DCArtboard id="sc-great" label="Great-pass · 87" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenScorecard/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 09 · Leaderboard ===== */}
      <DCSection id="leaderboard" title="09 · Leaderboard"
        subtitle="Each league is a 'wafel tier'. Promotion and demotion zones are visible. The current user row glows and is pinned (off-screen pinning will be added in motion).">
        <DCArtboard id="lb-league" label="League · you @ rank 5" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenLeaderboard tab="league"/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 12 · Friends ===== */}
      <DCSection id="friends" title="12 · Friends, peer drills, requests"
        subtitle="Peer drills sit at the top — they're the highest-intent inbox. Treat-mascot avatars carry identity. Add-friend / send-drill actions inline on rows.">
        <DCArtboard id="friends" label="Friends + peer-drills inbox" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenFriends/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 13 · Notifications sheet ===== */}
      <DCSection id="notifs" title="13 · Notifications inbox"
        subtitle="Slide-over sheet from the bell. Grouped by recency. Unread dot + bold title. Mascot avatars on social rows.">
        <DCArtboard id="notifs" label="Notifications sheet — unread" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenNotifications/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 10 · Shop ===== */}
      <DCSection id="shop" title="10 · Shop"
        subtitle="Coin balance is the hero. Sections: Streak freezes, Heart refills, Avatar cosmetics (the treat family), Power-ups. Cosmetic cards show owned/equipped state visibly.">
        <DCArtboard id="shop" label="Shop · 320 coins" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenShop/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 11 · Profile ===== */}
      <DCSection id="profile" title="11 · Profile"
        subtitle="Identity hero + 4-stat strip + GitHub-style activity heatmap + 28-badge grid. Friend's profile swaps the gear for an Add-friend button.">
        <DCArtboard id="profile-own" label="Own profile" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenProfile/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="profile-other" label="A friend's profile" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenProfile other/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== 14 · Settings ===== */}
      <DCSection id="settings" title="14 · Settings"
        subtitle="Light only. Token infrastructure for system-dark stays in src/styles.css for users who hard-prefer it, but the brand is sunlight + paper + treats — that doesn't translate to dark.">
        <DCArtboard id="settings-light" label="Settings" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenSettings/></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== Mascot brand sheet ===== */}
      <DCSection id="mascots" title="Mascot brand sheet"
        subtitle="One-page reference for the cast. Each treat anchors a place in the world — a unit, a feature, an emotional beat. Hand-off doc for the vector redraw.">
        <DCArtboard id="mascot-sheet" label="The Lekkertaal cast" width={1080} height={1000}>
          <ScreenMascotSheet/>
        </DCArtboard>
      </DCSection>

      {/* ===== Palette exploration ===== */}
      <DCSection id="palettes" title="Palette exploration · 3 directions on real surfaces"
        subtitle="The brief asks: show the path + lesson-complete in each palette so you can judge on real surfaces. Tokens are the candidate CSS files from src/styles/palettes/. Token names are identical so swapping is just a CSS file replacement.">
        <DCArtboard id="pal-live-path" label="A · Live · Dutch orange + canal blue · Path" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenPath palette="live"/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="pal-live-comp" label="A · Live · Lesson Complete" width={AB_W} height={AB_H}>
          <PhoneArtboard><div className="palette-live" style={{width:PHONE_W,height:PHONE_H}}><ScreenLessonComplete variant="normal"/></div></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="pal-bakery-path" label="B · Warm Bakery · Path" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenPath palette="bakery"/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="pal-bakery-comp" label="B · Warm Bakery · Lesson Complete" width={AB_W} height={AB_H}>
          <PhoneArtboard><div className="palette-bakery" style={{width:PHONE_W,height:PHONE_H}}><ScreenLessonComplete variant="normal"/></div></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="pal-candy-path" label="C · Candy · Path" width={AB_W} height={AB_H}>
          <PhoneArtboard><ScreenPath palette="candy"/></PhoneArtboard>
        </DCArtboard>
        <DCArtboard id="pal-candy-comp" label="C · Candy · Lesson Complete" width={AB_W} height={AB_H}>
          <PhoneArtboard><div className="palette-candy" style={{width:PHONE_W,height:PHONE_H}}><ScreenLessonComplete variant="normal"/></div></PhoneArtboard>
        </DCArtboard>
      </DCSection>

      {/* ===== Closing notes ===== */}
      <DCSection id="notes" title="Design notes & next steps"
        subtitle="">
        <DCPostIt>
          <b>What this proto covers</b><br/>
          • 14 screens (Landing, Onboarding ×3, Path, Unit, Lesson player ×9 drills, drill states, Complete ×3, Roleplay, Scorecard, Leaderboard, Friends, Notifications, Shop, Profile ×2, Settings light + dark).<br/>
          • Palette comparison on real surfaces.<br/><br/>
          <b>Decisions that broke from the cited reference app</b><br/>
          • <b>Path:</b> staggered tile-grid inside neighbourhood blocks (NOT a winding skill-tree). Boss-fight is a wide gradient bar at the foot — not a separate node.<br/>
          • <b>Lesson complete:</b> stat-postcard overlapping the mascot — not a giant mascot hero. Waffle confetti instead of generic squares.<br/>
          • <b>Roleplay:</b> objectives are chips in the dark header — always visible, never modal.<br/>
          • <b>Correction:</b> inline yellow card on your own bubble — no separate "review" route.<br/><br/>
          <b>Tokens introduced beyond the repo</b><br/>
          • <code>--color-good-soft</code>, <code>--color-bad-soft</code>, <code>--color-streak</code> — colour-mix sugar for feedback bars and the streak chip. Otherwise everything is straight from <code>src/styles.css</code>.<br/><br/>
          <b>Recommended palette</b><br/>
          Keep the <b>live</b> palette (orange #FF6B1A + blue #1F6FB2). It scores best on visual contrast at the path & celebration screens, and the warm paper background (#FFF8EE) does heavy lifting against pure-white drill cards. Candy is great for a seasonal skin; Warm Bakery for a premium B1/B2 future tier.<br/><br/>
          <b>Components built (matching repo names)</b><br/>
          Button (3 kinds), Card, Chip, Badge, Progress, Hearts, Toggle, Mascot (Stroop + 8 treats × 3 moods), StatusStrip, TopBar, TabDock, LessonChrome, FeedbackBar, Prompt, Confetti.
        </DCPostIt>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
