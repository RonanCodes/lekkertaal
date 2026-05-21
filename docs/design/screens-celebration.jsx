/* global React, LK, Phone, TopBar, Button, Card, Chip, Badge, Mascot, Icon, Progress, Confetti, TREATS */

// ============================================================
// SCREEN 6 — Lesson Complete
// Variants: normal, perfect-lesson, streak-milestone
// Original treatment: "trofee postcard" instead of huge mascot
// hero — celebratory but layered, with the mascot peeking out
// behind a stat-card.
// ============================================================
function ScreenLessonComplete({ variant = "normal" }) {
  const isPerfect = variant === "perfect";
  const isMilestone = variant === "milestone";
  return (
    <Phone palette="live">
      {/* background gradient + confetti */}
      <div style={{
        position: "absolute", inset: 0,
        background: isMilestone
          ? "linear-gradient(180deg, #FFB85C 0%, #FF6B1A 60%, #1F6FB2 130%)"
          : isPerfect
          ? "linear-gradient(180deg, #FFE5D2 0%, #FFD9E4 100%)"
          : "linear-gradient(180deg, var(--color-brand-orange-soft) 0%, var(--surface-page) 60%)",
      }}/>
      <Confetti count={isMilestone ? 60 : 36} />

      <div className="col" style={{ flex: 1, padding: "60px 22px 24px", position: "relative" }}>
        <div className="eyebrow center" style={{
          textAlign: "center",
          color: isMilestone ? "rgba(255,255,255,.9)" : "var(--color-brand-orange-dark)"
        }}>
          {isMilestone ? "30-day streak!" : isPerfect ? "Perfect lesson" : "Lesson complete"}
        </div>
        <h1 className="center mt-2" style={{
          fontSize: 38, lineHeight: 1.05, textAlign: "center",
          color: isMilestone ? "white" : "var(--text-strong)"
        }}>
          {isMilestone ? "Dertig dagen!"
            : isPerfect ? "Geen foutjes! 🤌"
            : "Lekker gedaan."}
        </h1>

        {/* mascot — half hidden behind a stat postcard */}
        <div style={{ position: "relative", marginTop: 16 }}>
          <Mascot
            kind={isMilestone ? "oliebollen" : "stroop"}
            mood="happy"
            size={isMilestone ? 170 : 140}
            style={{ display: "block", margin: "0 auto", position: "relative", zIndex: 1 }}
          />
          {/* stat postcard */}
          <div className="lk-card" style={{
            marginTop: -36, position: "relative", zIndex: 2,
            background: "var(--surface-card)",
            boxShadow: "0 14px 30px -10px rgba(0,0,0,.25)",
          }}>
            <div className="row" style={{ justifyContent: "space-around", textAlign: "center" }}>
              <StatTile icon="zap"  label="XP" value={isPerfect ? "20" : "14"} accent="orange" />
              <StatTile icon="coin" label="Coins" value={isPerfect ? "15" : "10"} accent="amber" />
              <StatTile icon="flame" label="Streak" value={isMilestone ? "30" : "12"} accent="streak" />
            </div>
            {isPerfect && (
              <div className="lk-card mt-3" style={{
                background: "#FEF3C7", borderColor: "#F1C66B", padding: 12,
              }}>
                <div className="row gap-2">
                  <Icon name="sparkle" size={18} color="#7A4F00"/>
                  <div className="col">
                    <span className="fw-7 fz-13" style={{ color: "#7A4F00" }}>Perfect lesson bonus</span>
                    <span className="fz-11" style={{ color: "#7A4F00" }}>No mistakes — +6 XP, +5 coins</span>
                  </div>
                </div>
              </div>
            )}
            {isMilestone && (
              <div className="lk-card mt-3" style={{
                background: "linear-gradient(135deg, #FFB85C, #FF6B1A)",
                color: "white", borderColor: "transparent", padding: 12,
              }}>
                <div className="row gap-2">
                  <span style={{
                    width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.2)",
                    display: "grid", placeItems: "center",
                  }}>
                    <Icon name="crown" size={20} color="white"/>
                  </span>
                  <div className="col">
                    <span className="fw-7 fz-13">Badge unlocked: Maand-monster</span>
                    <span className="fz-11" style={{ opacity: 0.85 }}>30 days in a row — that's the whole maand.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* accuracy row */}
        <div className="lk-card mt-3" style={{ padding: 14 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="fz-13 fw-7">Accuracy</span>
            <span className="text-display fw-7 fz-15" style={{ color: isPerfect ? "var(--color-good)" : "var(--color-brand-orange-dark)" }}>
              {isPerfect ? "100%" : "87%"}
            </span>
          </div>
          <div className="mt-2"><Progress value={isPerfect ? 100 : 87} color={isPerfect ? "green" : "orange"} /></div>
          <div className="row gap-3 mt-2 fz-12 muted">
            <span><span className="strong" style={{color:"var(--color-good)"}}>{isPerfect ? "10" : "8"}</span> correct</span>
            <span><span className="strong" style={{color:"var(--color-bad)"}}>{isPerfect ? "0" : "2"}</span> mistakes</span>
            <span className="grow"/>
            <span>2 min 14 s</span>
          </div>
        </div>

        <div className="grow"/>
        <div className="col gap-2">
          <Button kind={isMilestone ? "orange" : "green"} full size="lg">
            Continue → Next lesson
          </Button>
          {!isPerfect && (
            <Button ghost full>Review mistakes</Button>
          )}
        </div>
      </div>
    </Phone>
  );
}

function StatTile({ icon, label, value, accent }) {
  const color = accent === "orange" ? "var(--color-brand-orange)"
              : accent === "amber"  ? "#C28E1A"
              : accent === "streak" ? "var(--color-streak)"
              : "var(--color-good)";
  return (
    <div className="col center" style={{ gap: 4 }}>
      <span style={{
        width: 40, height: 40, borderRadius: 12,
        background: "color-mix(in srgb, " + color + " 15%, transparent)",
        color, display: "grid", placeItems: "center",
      }}>
        <Icon name={icon} size={20} color={color} />
      </span>
      <span className="text-display fw-7 fz-22" style={{ color: "var(--text-strong)" }}>{value}</span>
      <span className="fz-11 muted">{label}</span>
    </div>
  );
}

// ============================================================
// SCREEN 7 — AI Boss-Fight Roleplay
// Scenario chat — type or speak, streaming AI, gentle correction
// chips, objectives tracker.
// ============================================================
function ScreenRoleplay({ state = "mid" }) {
  return (
    <Phone palette="live">
      {/* scene header */}
      <div style={{
        background: "linear-gradient(160deg, #2A1810, #4A2810)",
        color: "white", padding: "10px 16px 16px",
        position: "relative",
      }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <button style={{ background: "transparent", border: 0, color: "rgba(255,255,255,.85)", cursor: "pointer" }}>
            <Icon name="x" size={20} color="rgba(255,255,255,.85)"/>
          </button>
          <span className="text-display fw-7 fz-13">Bij de bakker · Roleplay</span>
          <span className="fz-11" style={{ color: "rgba(255,255,255,.6)" }}>2:14</span>
        </div>
        <div className="row gap-3 mt-3">
          <Mascot kind="kroket" mood="idle" size={66}/>
          <div className="col grow">
            <div className="eyebrow" style={{ color: "rgba(255,255,255,.7)" }}>Today's baker</div>
            <div className="text-display fw-7 fz-15">Kroket · bakkerij De Stoeptegel</div>
            <div className="fz-12" style={{ color: "rgba(255,255,255,.75)" }}>Order pastries · be polite · handle a small surprise.</div>
          </div>
        </div>

        {/* objectives */}
        <div className="row gap-2 mt-3" style={{ flexWrap: "wrap" }}>
          <Objective done text="Greet" />
          <Objective done text="Use 'alstublieft'" />
          <Objective text="Order 2+ items" />
          <Objective text="Ask the price" />
          <Objective text="Say goodbye" />
        </div>
      </div>

      {/* chat transcript */}
      <div className="scrolly" style={{ padding: "16px 14px 120px", background: "var(--surface-app)" }}>
        <MsgKroket text="Goedemorgen! Wat mag het zijn?" />
        <MsgMe text="Goedemorgen. Mag ik een tompouce, alstublieft?" correct />
        <MsgKroket text="Natuurlijk! Anders nog iets erbij?" />
        <MsgMe text="Ja, en een koffie." correction={{
          original: "Ja, en een koffie.",
          fixed: "Ja, en een koffie, alstublieft.",
          note: "Polite forms always like a closing 'alstublieft'.",
        }}/>
        <MsgKroket
          text="Dat wordt vijf euro vijftig. Met pin of contant?"
          streaming={state === "mid"}
        />
        {state === "mid" && <Typing />}
      </div>

      {/* dock: input + mic */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        padding: "12px 14px 24px",
        background: "var(--surface-app)",
        borderTop: "1px solid var(--line-soft)",
        display: "flex", alignItems: "center", gap: 8, zIndex: 3,
      }}>
        <div style={{
          flex: 1, padding: "10px 14px", borderRadius: 999,
          background: "var(--surface-card)", border: "1.5px solid var(--line-soft)",
          fontFamily: "var(--font-sans)", color: "var(--text-muted)", fontSize: 14,
        }}>
          Typ je antwoord…
        </div>
        <button style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "var(--color-brand-orange)", border: 0, cursor: "pointer",
          boxShadow: "0 4px 0 0 var(--color-brand-orange-dark)",
          display: "grid", placeItems: "center", flex: "none",
        }}>
          <Icon name="mic" size={22} color="white"/>
        </button>
      </div>
    </Phone>
  );
}

function Objective({ text, done }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      fontFamily: "var(--font-display)",
      background: done ? "rgba(63, 138, 76, 0.3)" : "rgba(255,255,255,.1)",
      color: done ? "#B8F0C5" : "rgba(255,255,255,.8)",
      border: done ? "1px solid rgba(63, 138, 76, .8)" : "1px solid rgba(255,255,255,.18)",
    }}>
      {done ? <Icon name="check" size={11} color="#B8F0C5"/> : <span style={{ width: 11, height: 11, border: "1.5px solid currentColor", borderRadius: "50%", display: "inline-block" }}/>}
      {text}
    </span>
  );
}

function MsgKroket({ text, streaming }) {
  return (
    <div className="row gap-2 mb-3" style={{ alignItems: "flex-end" }}>
      <Mascot kind="kroket" size={36} style={{ flex: "none" }} />
      <div className="bubble tail-bl">
        {text}
        {streaming && <span style={{ display: "inline-block", width: 6, height: 14, background: "var(--text-strong)", verticalAlign: "middle", marginLeft: 4, animation: "idle-bob 0.8s infinite" }}/>}
      </div>
    </div>
  );
}

function MsgMe({ text, correct, correction }) {
  return (
    <div className="row gap-2 mb-3" style={{ alignItems: "flex-end", justifyContent: "flex-end" }}>
      <div style={{ maxWidth: 260 }}>
        <div className="bubble tail-br" style={{
          background: correct ? "var(--color-brand-blue)" : correction ? "var(--color-brand-blue)" : "var(--color-brand-blue)",
          color: "white", borderColor: "var(--color-brand-blue)",
        }}>
          {text}
        </div>
        {correct && (
          <div className="row gap-2 fz-11 mt-1" style={{ color: "var(--color-good)", justifyContent: "flex-end" }}>
            <Icon name="check" size={12} color="var(--color-good)"/> Nailed it
          </div>
        )}
        {correction && (
          <div className="lk-card mt-1" style={{
            background: "#FEF3C7", borderColor: "#F1C66B", padding: 10,
          }}>
            <div className="eyebrow" style={{ color: "#7A4F00" }}>Tiny tweak</div>
            <div className="fz-13 mt-1" style={{ color: "#1A1410" }}>
              <s style={{ color: "#A87C2C" }}>{correction.original}</s>
              <div className="text-display fw-7 mt-1">{correction.fixed}</div>
            </div>
            <div className="fz-11 mt-2" style={{ color: "#7A4F00" }}>{correction.note}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div className="row gap-2 mb-3" style={{ alignItems: "flex-end" }}>
      <Mascot kind="kroket" size={28} style={{ flex: "none" }}/>
      <div className="bubble tail-bl" style={{ padding: "10px 14px" }}>
        <span style={{ display: "inline-flex", gap: 4 }}>
          {[0,1,2].map(i => (
            <span key={i} style={{
              width: 6, height: 6, borderRadius: "50%", background: "var(--text-muted)",
              animation: "idle-bob 0.8s ease-in-out infinite", animationDelay: `${i*0.15}s`,
            }}/>
          ))}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// SCREEN 8 — Roleplay Scorecard
// ============================================================
function ScreenScorecard() {
  return (
    <Phone palette="live">
      <div className="row gap-2" style={{ padding: "8px 14px" }}>
        <button style={{ background: "transparent", border: 0, cursor: "pointer" }}>
          <Icon name="x" size={22} color="var(--text-soft)"/>
        </button>
        <span className="grow center text-display fw-7 fz-15">Roleplay scorecard</span>
        <span style={{ width: 30 }}/>
      </div>

      <div className="scrolly" style={{ padding: "8px 18px 28px" }}>
        {/* hero score */}
        <div className="lk-card" style={{
          background: "linear-gradient(160deg, #FFE5D2, #FFD9E4)",
          borderColor: "transparent", padding: 18, position: "relative", overflow: "hidden",
        }}>
          <div className="eyebrow center" style={{ color: "var(--color-brand-orange-dark)" }}>Bij de bakker</div>
          <div className="row center mt-2" style={{ gap: 12 }}>
            <div style={{
              width: 96, height: 96, borderRadius: "50%",
              background: "conic-gradient(var(--color-good) 87%, rgba(255,255,255,.6) 0)",
              display: "grid", placeItems: "center",
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%", background: "white",
                display: "grid", placeItems: "center",
              }}>
                <div className="col center">
                  <span className="text-display fw-7 fz-28" style={{ color: "var(--text-strong)", lineHeight: 1 }}>87</span>
                  <span className="fz-11 muted">score</span>
                </div>
              </div>
            </div>
            <div className="col">
              <span className="text-display fw-7 fz-22">Great pass</span>
              <span className="fz-12 soft">4 of 5 objectives met</span>
              <div className="row gap-2 mt-2">
                <span className="badge green"><Icon name="zap" size={10}/> 28 XP</span>
                <span className="badge"><Icon name="coin" size={10}/> 15</span>
              </div>
            </div>
          </div>
          <Mascot kind="stroop" mood="happy" size={80} style={{ position: "absolute", right: -6, bottom: -8 }}/>
        </div>

        {/* breakdown */}
        <div className="eyebrow mt-4 mb-2">Breakdown</div>
        <div className="col gap-2">
          <CritRow label="Fluency"   score={85} note="Solid pace, only one long pause."/>
          <CritRow label="Vocabulary" score={92} note="Used 4 target words."/>
          <CritRow label="Grammar"   score={78} note="'Alstublieft' placement still tricky."/>
          <CritRow label="Objectives" score={80} note="Missed: ask the price."/>
        </div>

        {/* highlights */}
        <div className="eyebrow mt-4 mb-2">Highlights</div>
        <div className="lk-card" style={{ background: "var(--color-good-soft)", borderColor: "var(--color-good)", padding: 14 }}>
          <div className="row gap-2 fz-12 fw-7" style={{ color: "#235A2C" }}>
            <Icon name="check" size={14} color="#235A2C"/> Best line
          </div>
          <div className="text-display fz-15 mt-1">"Mag ik een tompouce, alstublieft?"</div>
          <div className="fz-11 mt-1" style={{ color: "#235A2C" }}>Polite request — clean.</div>
        </div>

        <div className="eyebrow mt-4 mb-2">Try these next time</div>
        <div className="col gap-2">
          <TipRow tip="Add 'alstublieft' more often — it's a Dutch reflex." />
          <TipRow tip="Ask price with 'Hoeveel kost dat?'." />
          <TipRow tip="Use 'graag' to soften: 'Ik wil graag…'." />
        </div>

        <div className="row gap-2 mt-5">
          <Button ghost full size="lg">Retry</Button>
          <Button kind="orange" full size="lg">Back to path</Button>
        </div>
      </div>
    </Phone>
  );
}

function CritRow({ label, score, note }) {
  const tone = score >= 85 ? "good" : score >= 70 ? "warn" : "bad";
  const color = tone === "good" ? "var(--color-good)" : tone === "warn" ? "var(--color-warn)" : "var(--color-bad)";
  return (
    <div className="lk-card" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="fz-13 fw-7">{label}</span>
        <span className="text-display fw-7 fz-15" style={{ color }}>{score}</span>
      </div>
      <div className="mt-2"><Progress value={score} color={tone === "good" ? "green" : "orange"} /></div>
      <div className="fz-11 muted mt-2">{note}</div>
    </div>
  );
}

function TipRow({ tip }) {
  return (
    <div className="lk-card row gap-2" style={{ padding: 12, alignItems: "flex-start" }}>
      <span style={{
        width: 26, height: 26, borderRadius: 8, flex: "none",
        background: "var(--color-brand-blue-soft)", color: "var(--color-brand-blue-dark)",
        display: "grid", placeItems: "center",
      }}>
        <Icon name="sparkle" size={14}/>
      </span>
      <span className="fz-13">{tip}</span>
    </div>
  );
}

Object.assign(window, {
  ScreenLessonComplete, ScreenRoleplay, ScreenScorecard,
  StatTile, Objective, MsgKroket, MsgMe, Typing, CritRow, TipRow,
});
