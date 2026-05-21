/* global React, LK, Mascot, Icon, TREATS */

// ============================================================
// SCREEN — Mascot brand sheet
// Wide reference artboard. The treat cast in one place: 8 treats
// + Stroop, each with idle/happy/surprised, name, role, key vocab.
// Lives off the app surface — it's a brand reference, not a
// screen the user sees. Useful for the future vector redraw.
// ============================================================
function ScreenMascotSheet() {
  const cast = [
    {
      kind: "stroop", name: "Stroop",
      eponym: "Stroopwafel",
      role: "Mascot-in-chief",
      tagline: "Your guide. Stroop greets you on day one and never patronises.",
      uses: ["Onboarding", "Lesson feedback", "Empty states", "Streak nudges"],
      vocab: ["lekker", "gezellig", "hoi"],
      accent: "#FF6B1A",
      anchor: true,
    },
    {
      kind: "kroket", name: "Kroket",
      eponym: "Kroket — fried snack-bar staple",
      role: "Bakkerij unit lead",
      tagline: "Holds down the counter at Bakkerij De Stoeptegel. Patient correction-giver.",
      uses: ["Boss-fight roleplays", "Unit 3 hero", "Snack bar scenes"],
      vocab: ["bestellen", "alstublieft", "afrekenen"],
      accent: "#C4774A",
    },
    {
      kind: "bitterballen", name: "Bitterballen",
      eponym: "Bitterballen — bar snack",
      role: "Café-scene chorus",
      tagline: "Always shows up in threes. Knows everyone at the bar.",
      uses: ["Social-proof strip", "Friend invites", "Borrel scenes"],
      vocab: ["proost", "een rondje", "gezellig"],
      accent: "#D4600A",
    },
    {
      kind: "oliebollen", name: "Oliebollen",
      eponym: "Oliebollen — New Year's doughnut",
      role: "Streak & celebration",
      tagline: "Comes out for milestones — 7, 30, 100 day streaks.",
      uses: ["Daily quests card", "Streak milestones", "Promotion celebration"],
      vocab: ["gelukkig nieuwjaar", "vuurwerk"],
      accent: "#C28E1A",
    },
    {
      kind: "drop", name: "Drop",
      eponym: "Drop — Dutch licorice",
      role: "The bouncer",
      tagline: "Sits next to locked content. Doesn't smile. Means well.",
      uses: ["Locked tiles", "Out-of-hearts state", "Premium gates"],
      vocab: ["zout", "zoet", "kun je raden"],
      accent: "#1A1410",
    },
    {
      kind: "poffertjes", name: "Poffertjes",
      eponym: "Poffertjes — mini pancakes",
      role: "Beginner cameo",
      tagline: "Soft landing for A1 learners. The mascot you pick if you're new.",
      uses: ["A1 level card", "Profile default", "Tutorial walkthroughs"],
      vocab: ["een beetje", "klein", "lief"],
      accent: "#FF7AA2",
    },
    {
      kind: "frikandel", name: "Frikandel",
      eponym: "Frikandel — snackbar sausage",
      role: "Energetic sidekick",
      tagline: "The friend who challenges you to a peer drill at 11pm.",
      uses: ["Peer drills", "Leaderboard fast-movers", "Quick wins"],
      vocab: ["snel", "lekker", "doe maar"],
      accent: "#7A3010",
    },
    {
      kind: "tompouce", name: "Tompouce",
      eponym: "Tompouce — fondant pastry",
      role: "Polite-conversation lead",
      tagline: "Pink-frosted. Always says 'alstublieft'.",
      uses: ["Bakkerij window", "Polite-form lessons", "Profile cosmetic"],
      vocab: ["alstublieft", "graag", "mag ik"],
      accent: "#FF7AA2",
    },
    {
      kind: "kaas", name: "Kaas",
      eponym: "Kaas — Gouda wedge",
      role: "Market-day veteran",
      tagline: "Lives at the kaaswinkel. Will explain de vs het with patience.",
      uses: ["Op de markt unit", "Grammar drills", "Listening drills"],
      vocab: ["jong", "belegen", "een ons"],
      accent: "#C28E1A",
    },
  ];

  return (
    <div style={{
      width: 1040, minHeight: 920, padding: 36,
      background: "var(--surface-page)",
      fontFamily: "var(--font-sans)", color: "var(--text-body)",
    }} className="palette-live">
      {/* sheet header */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 20, paddingBottom: 14, borderBottom: "2px solid var(--line-soft)" }}>
        <div>
          <div className="eyebrow" style={{ color: "var(--color-brand-orange-dark)" }}>
            Brand reference · v0.4 · 2026-05-21
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 44, lineHeight: 1, marginTop: 6,
            color: "var(--text-strong)", letterSpacing: "-0.02em", fontWeight: 700,
          }}>The Lekkertaal cast</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "var(--text-soft)", maxWidth: 720 }}>
            Nine characters. One stroopwafel and eight Dutch treats. Each treat anchors
            a place in the world — a unit, a feature, an emotional beat — so users meet
            them in context, not in a parade. <b>Note for redraw:</b> current PNGs are AI-rendered
            placeholders; final assets to be drawn vector, consistent line weight, no glossy highlights.
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <Mascot kind="stroop" mood="happy" size={120} />
        </div>
      </div>

      {/* grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 18, marginTop: 24,
      }}>
        {cast.map(c => <CastCard key={c.kind} {...c} />)}
      </div>

      {/* footer notes */}
      <div style={{
        marginTop: 26, padding: 18, borderRadius: 18,
        background: "var(--surface-card-alt)", border: "1px solid var(--line-soft)",
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18,
      }}>
        <FooterNote title="Expressions" body="idle · happy · surprised. Each as a PNG today, redraw to vector. Anim hooks: .anim-idle-bob (default), .anim-happy-bounce (correct/win), .anim-surprised-pop (wrong/reveal)." />
        <FooterNote title="Voice" body="Encouraging, never twee. Stroop nudges; never lectures. Treats stay in character — Kroket is patient, Drop is stoic, Frikandel is fast, Oliebollen celebrates." />
        <FooterNote title="Don'ts" body="No mascot pile-ups (max 2 visible per screen except this sheet & the celebration). No emoji on top of mascots. Never resize below 36px — detail gets lost." />
      </div>
    </div>
  );
}

function CastCard({ kind, name, eponym, role, tagline, uses, vocab, accent, anchor }) {
  return (
    <div style={{
      background: "var(--surface-card)",
      border: "1.5px solid " + (anchor ? accent : "var(--line-soft)"),
      borderRadius: 22, padding: 18,
      boxShadow: anchor
        ? "0 4px 0 0 " + accent
        : "0 2px 0 0 rgba(0,0,0,.03), 0 12px 28px -16px rgba(0,0,0,.1)",
      position: "relative", overflow: "hidden",
    }}>
      {anchor && (
        <span style={{
          position: "absolute", top: 10, right: 12,
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 10,
          letterSpacing: "0.1em",
          color: accent, background: "color-mix(in srgb, " + accent + " 12%, transparent)",
          padding: "3px 8px", borderRadius: 999,
        }}>ANCHOR</span>
      )}
      {/* name + eponym */}
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, color: "var(--text-strong)" }}>
        {name}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{eponym}</div>

      {/* 3 expressions row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3,1fr)",
        gap: 8, marginTop: 14, alignItems: "end",
      }}>
        {["idle","happy","surprised"].map(mood => (
          <div key={mood} style={{
            background: "var(--surface-card-alt)", borderRadius: 12, padding: 6,
            display: "grid", placeItems: "center", aspectRatio: "1 / 1",
            border: "1px solid var(--line-soft)",
          }}>
            <Mascot kind={kind} mood={mood} size={70}/>
          </div>
        ))}
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3,1fr)",
        gap: 8, marginTop: 4,
        fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 10,
        color: "var(--text-muted)", textAlign: "center",
      }}>
        <span>idle</span><span>happy</span><span>surprised</span>
      </div>

      {/* role + tagline */}
      <div style={{ marginTop: 12 }}>
        <div style={{
          display: "inline-block",
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 10,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: accent,
          background: "color-mix(in srgb, " + accent + " 12%, transparent)",
          padding: "3px 8px", borderRadius: 999,
        }}>{role}</div>
        <div style={{
          marginTop: 6, fontSize: 13, color: "var(--text-body)",
          lineHeight: 1.4,
        }}>{tagline}</div>
      </div>

      {/* uses */}
      <div style={{ marginTop: 12 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Appears in</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {uses.map(u => (
            <span key={u} style={{
              fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 11,
              color: "var(--text-soft)", background: "var(--surface-card-alt)",
              padding: "3px 8px", borderRadius: 8,
              border: "1px solid var(--line-soft)",
            }}>{u}</span>
          ))}
        </div>
      </div>

      {/* vocab */}
      <div style={{ marginTop: 10 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Brings vocab</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {vocab.map(v => (
            <span key={v} style={{
              fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12,
              color: accent,
              background: "color-mix(in srgb, " + accent + " 10%, transparent)",
              padding: "3px 8px", borderRadius: 8,
            }}>{v}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FooterNote({ title, body }) {
  return (
    <div>
      <div style={{
        fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12,
        letterSpacing: "0.08em", textTransform: "uppercase",
        color: "var(--color-brand-orange-dark)",
      }}>{title}</div>
      <div style={{ fontSize: 13, color: "var(--text-soft)", marginTop: 4, lineHeight: 1.45 }}>{body}</div>
    </div>
  );
}

Object.assign(window, { ScreenMascotSheet, CastCard, FooterNote });
