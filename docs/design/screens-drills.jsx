/* global React, LK, Phone, Button, Card, Chip, Badge, Mascot, Icon, Progress, Hearts */

// ============================================================
// LESSON PLAYER — wraps every drill with the same chrome:
// top progress + hearts (+ close), the drill body in the middle,
// and a docked Check/Continue at the bottom. Inline feedback bar
// slides in over the dock on grade.
// ============================================================
function LessonChrome({ children, progress = 30, hearts = 4, cta, ctaKind = "blue", ctaDisabled, feedback }) {
  return (
    <Phone palette="live">
      {/* lesson top bar (replaces app top bar) */}
      <div className="row gap-2" style={{ padding: "8px 14px 8px", alignItems: "center" }}>
        <button aria-label="Close" style={{ background: "none", border: 0, color: "var(--text-soft)", cursor: "pointer", padding: 4 }}>
          <Icon name="x" size={22}/>
        </button>
        <div className="grow">
          <Progress value={progress} color="orange" />
        </div>
        <span className="row gap-2 fz-13 fw-7" style={{ color: "var(--color-bad)" }}>
          <Icon name="heart" size={18} color="var(--color-bad)" /> {hearts}
        </span>
      </div>

      {/* drill body */}
      <div className="scrolly" style={{ padding: "8px 18px 120px", flex: 1 }}>
        {children}
      </div>

      {/* feedback bar OR docked Check */}
      {feedback
        ? <FeedbackBar {...feedback} />
        : (
          <div style={{
            position: "absolute", left: 0, right: 0, bottom: 0,
            padding: "14px 18px 28px",
            background: "var(--surface-app)",
            borderTop: "1px solid var(--line-soft)",
            display: "flex", alignItems: "center", gap: 10, zIndex: 3,
          }}>
            <button style={{
              background: "transparent", border: "1.5px solid var(--line-strong)",
              borderRadius: 12, padding: "10px 12px",
              fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--text-soft)",
              cursor: "pointer",
            }}>
              <Icon name="hint" size={18} />
            </button>
            <Button full size="lg" kind={ctaKind} disabled={ctaDisabled}>
              {cta || "Check"}
            </Button>
          </div>
        )
      }
    </Phone>
  );
}

function FeedbackBar({ correct, headline, body, answer }) {
  return (
    <div className={"feedback-bar " + (correct ? "" : "wrong")}>
      <span style={{
        width: 44, height: 44, borderRadius: "50%",
        background: correct ? "var(--color-good)" : "var(--color-bad)",
        color: "white", display: "grid", placeItems: "center", flex: "none",
      }}>
        {correct ? <Icon name="check" size={22} color="white"/> : <Icon name="x" size={22} color="white"/>}
      </span>
      <div className="col grow">
        <h4>{headline || (correct ? "Goed zo!" : "Bijna goed")}</h4>
        {body && <p>{body}</p>}
        {answer && <p style={{ marginTop: 4 }}><span className="strong">Correct:</span> {answer}</p>}
      </div>
      <Button kind={correct ? "green" : "red"}>Continue</Button>
    </div>
  );
}

// ── Question header (shared) ─────────────────────────────
function Prompt({ type, dutch, english, mascot = "stroop", mood = "idle" }) {
  return (
    <div className="row gap-3 mb-4">
      <Mascot kind={mascot} mood={mood} size={56} />
      <div className="bubble tail-bl grow">
        <div className="eyebrow" style={{ color: "var(--color-brand-blue-dark)" }}>{type}</div>
        <div className="text-display fw-7 fz-18 mt-1" style={{ color: "var(--text-strong)", lineHeight: 1.25 }}>{dutch}</div>
        {english && <div className="fz-12 soft mt-1">{english}</div>}
      </div>
    </div>
  );
}

// ============================================================
// DRILL 1 — multiple_choice
// ============================================================
function DrillMultipleChoice() {
  return (
    <LessonChrome progress={32} cta="Check" ctaDisabled={false}>
      <Prompt type="Choose the translation" dutch="Mag ik een tompouce, alstublieft?" english="May I have a tompouce, please?" />
      <div className="col gap-2">
        <div className="option-card"><span className="kbd">1</span> May I borrow a tompouce?</div>
        <div className="option-card selected"><span className="kbd">2</span> May I have a tompouce, please?</div>
        <div className="option-card"><span className="kbd">3</span> Do you sell tompouces?</div>
        <div className="option-card"><span className="kbd">4</span> A tompouce is delicious.</div>
      </div>
    </LessonChrome>
  );
}

function DrillMultipleChoiceCorrect() {
  return (
    <LessonChrome
      progress={36}
      hearts={4}
      feedback={{ correct: true, headline: "Goed zo!", body: "Politest form of asking. +12 XP" }}
    >
      <Prompt type="Choose the translation" dutch="Mag ik een tompouce, alstublieft?" english="May I have a tompouce, please?" mascot="stroop" mood="happy" />
      <div className="col gap-2">
        <div className="option-card">May I borrow a tompouce?</div>
        <div className="option-card correct"><Icon name="check" size={18} color="#235A2C"/> May I have a tompouce, please?</div>
        <div className="option-card" style={{ opacity: 0.4 }}>Do you sell tompouces?</div>
        <div className="option-card" style={{ opacity: 0.4 }}>A tompouce is delicious.</div>
      </div>
    </LessonChrome>
  );
}

function DrillMultipleChoiceWrong() {
  return (
    <LessonChrome
      progress={36}
      hearts={3}
      feedback={{ correct: false, headline: "Net niet", answer: "May I have a tompouce, please?", body: "“Mag ik … alstublieft” is the polite request form." }}
    >
      <Prompt type="Choose the translation" dutch="Mag ik een tompouce, alstublieft?" english="May I have a tompouce, please?" mascot="stroop" mood="surprised" />
      <div className="col gap-2 shake">
        <div className="option-card wrong"><Icon name="x" size={18} color="#7A2424"/> May I borrow a tompouce?</div>
        <div className="option-card correct">May I have a tompouce, please?</div>
        <div className="option-card" style={{ opacity: 0.4 }}>Do you sell tompouces?</div>
        <div className="option-card" style={{ opacity: 0.4 }}>A tompouce is delicious.</div>
      </div>
    </LessonChrome>
  );
}

// ============================================================
// DRILL 2 — translation_typing
// ============================================================
function DrillTranslation() {
  return (
    <LessonChrome progress={40} cta="Check">
      <Prompt type="Write in Dutch" dutch="I'd like a coffee, please." english="Tap a word for a hint" mascot="kaas" />
      <div className="input3d" style={{ minHeight: 90, color: "var(--text-strong)" }}>
        Ik wil graag een
        <span style={{ display: "inline-block", width: 4, height: 22, background: "var(--color-brand-blue)", verticalAlign: "middle", marginLeft: 2, animation: "idle-bob 1s ease-in-out infinite" }}/>
      </div>

      <div className="eyebrow mt-4 mb-2">Word bank</div>
      <div className="pool">
        {["koffie","alstublieft","graag","wil","ik","een"].map(w => (
          <span key={w} className="chip-word">{w}</span>
        ))}
      </div>
      <div className="row gap-2 mt-3 fz-12 muted">
        <Icon name="hint" size={14}/> Tap a word above or type freely.
      </div>
    </LessonChrome>
  );
}

// ============================================================
// DRILL 3 — fill_blank
// ============================================================
function DrillFillBlank() {
  return (
    <LessonChrome progress={44} cta="Check" ctaKind="blue">
      <Prompt type="Fill the gap" dutch="Mag ik ___ tompoezen, alstublieft?" english="May I have two tompoezen, please?" />
      <div className="lk-card" style={{ background: "var(--surface-card-alt)", padding: 18 }}>
        <div className="text-display fz-22" style={{ lineHeight: 1.35, color: "var(--text-strong)" }}>
          Mag ik <BlankFilled word="twee" /> tompoezen, alstublieft?
        </div>
      </div>
      <div className="eyebrow mt-4 mb-2">Tap to swap</div>
      <div className="pool">
        {["een","twee","drie","veel","wat"].map((w,i) => (
          <span key={w} className={"chip-word " + (i === 1 ? "placed" : "")}>{w}</span>
        ))}
      </div>
    </LessonChrome>
  );
}

function BlankFilled({ word }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 10,
      background: "var(--color-brand-blue-soft)", color: "var(--color-brand-blue-dark)",
      border: "1.5px solid var(--color-brand-blue)",
      boxShadow: "0 2px 0 0 var(--color-brand-blue)",
      fontWeight: 700, margin: "0 4px",
    }}>{word}</span>
  );
}

// ============================================================
// DRILL 4 — word_ordering
// ============================================================
function DrillWordOrder() {
  return (
    <LessonChrome progress={48} cta="Check" ctaKind="blue">
      <Prompt type="Build the sentence" dutch="“I would like two coffees, please.”" english="Tap words in order." mascot="poffertjes" />
      {/* tray */}
      <div className="tray">
        {["Ik","wil","graag","twee"].map(w => (
          <span key={w} className="chip-word in-tray">{w}</span>
        ))}
      </div>
      <div className="eyebrow mt-4 mb-2">Tiles</div>
      <div className="pool" style={{ background: "var(--surface-card-alt)", borderRadius: 18, padding: 12 }}>
        {["koffies","alstublieft","ik","wil","graag","twee"].map((w,i) => (
          <span key={w} className={"chip-word " + (i < 4 && (w==="ik"||w==="wil"||w==="graag"||w==="twee") ? "placed" : "")}>
            {w}
          </span>
        ))}
      </div>
    </LessonChrome>
  );
}

// ============================================================
// DRILL 5 — match_pairs
// ============================================================
function DrillMatchPairs() {
  const left = [
    { id: "brood", w: "brood", state: "matched" },
    { id: "melk",  w: "melk",  state: "selected" },
    { id: "kaas",  w: "kaas",  state: "" },
    { id: "ei",    w: "ei",    state: "" },
    { id: "appel", w: "appel", state: "" },
  ];
  const right = [
    { id: "egg",    w: "egg",    state: "" },
    { id: "milk",   w: "milk",   state: "" },
    { id: "bread",  w: "bread",  state: "matched" },
    { id: "cheese", w: "cheese", state: "" },
    { id: "apple",  w: "apple",  state: "" },
  ];
  return (
    <LessonChrome progress={52} cta="Check" ctaDisabled>
      <Prompt type="Match the pairs" dutch="Link Dutch and English." english="" mascot="kaas" />
      <div className="row gap-3" style={{ alignItems: "flex-start" }}>
        <div className="col gap-2 grow">
          {left.map(c => (
            <div key={c.id} className={"option-card " + (c.state === "matched" ? "correct" : c.state === "selected" ? "selected" : "")}
                 style={{ justifyContent: "center", padding: "12px", fontSize: 16, opacity: c.state === "matched" ? 0.4 : 1 }}>
              {c.w}
            </div>
          ))}
        </div>
        <div className="col gap-2 grow">
          {right.map(c => (
            <div key={c.id} className={"option-card " + (c.state === "matched" ? "correct" : "")}
                 style={{ justifyContent: "center", padding: "12px", fontSize: 16, opacity: c.state === "matched" ? 0.4 : 1 }}>
              {c.w}
            </div>
          ))}
        </div>
      </div>
      <div className="fz-12 muted center mt-3">Tap a Dutch word, then its English match.</div>
    </LessonChrome>
  );
}

// ============================================================
// DRILL 6 — listening_mc
// ============================================================
function DrillListeningMC() {
  return (
    <LessonChrome progress={56} cta="Check" ctaKind="blue">
      <div className="eyebrow mb-2">Listen</div>
      <div className="lk-card center" style={{ padding: 24, background: "var(--color-brand-blue-soft)", border: "1px solid color-mix(in srgb, var(--color-brand-blue) 25%, transparent)" }}>
        <button style={{
          width: 84, height: 84, borderRadius: "50%",
          background: "var(--color-brand-blue)", border: 0, cursor: "pointer",
          boxShadow: "0 5px 0 0 var(--color-brand-blue-dark)",
          display: "grid", placeItems: "center",
        }}>
          <Icon name="speaker" size={36} color="white" />
        </button>
        <div className="mt-3 row gap-2">
          {/* waveform */}
          <Waveform bars={18} active />
        </div>
        <button style={{
          marginTop: 12, background: "transparent", border: "1.5px solid var(--color-brand-blue)",
          color: "var(--color-brand-blue-dark)", padding: "6px 12px", borderRadius: 999,
          fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12, cursor: "pointer",
        }}>🐢 Slow replay</button>
      </div>

      <div className="eyebrow mt-4 mb-2">What did you hear?</div>
      <div className="col gap-2">
        <div className="option-card"><span className="kbd">1</span> Het is koud vandaag.</div>
        <div className="option-card selected"><span className="kbd">2</span> Het is mooi weer vandaag.</div>
        <div className="option-card"><span className="kbd">3</span> Ik ben moe vandaag.</div>
      </div>
    </LessonChrome>
  );
}

function Waveform({ bars = 14, active = false }) {
  return (
    <div className="row" style={{ gap: 3, alignItems: "center", height: 32 }}>
      {Array.from({ length: bars }).map((_, i) => {
        const h = 6 + Math.abs(Math.sin(i * 1.4)) * 22;
        return <span key={i} style={{
          width: 4, height: h, borderRadius: 2,
          background: active ? "var(--color-brand-blue)" : "var(--line-strong)",
        }} />;
      })}
    </div>
  );
}

// ============================================================
// DRILL 7 — listening_spell
// "close enough" forgiving state — show typo soft-pass
// ============================================================
function DrillListeningSpell() {
  return (
    <LessonChrome progress={60} cta="Check" ctaKind="blue">
      <div className="eyebrow mb-2">Listen and type</div>
      <div className="lk-card row gap-3" style={{ background: "var(--color-brand-blue-soft)" }}>
        <button style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "var(--color-brand-blue)", border: 0, cursor: "pointer",
          boxShadow: "0 4px 0 0 var(--color-brand-blue-dark)",
          display: "grid", placeItems: "center", flex: "none",
        }}>
          <Icon name="speaker" size={24} color="white" />
        </button>
        <div className="col">
          <span className="text-display fw-7 fz-15">Spell what you hear</span>
          <span className="fz-12 soft">Tap 🐢 for slow.</span>
        </div>
        <span className="grow"/>
        <button style={{
          background: "white", border: "1.5px solid var(--color-brand-blue)",
          color: "var(--color-brand-blue-dark)", padding: "6px 10px", borderRadius: 999,
          fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12, cursor: "pointer",
        }}>🐢</button>
      </div>
      <div className="input3d mt-4" style={{ minHeight: 110 }}>
        Goedemorgen<span style={{ display: "inline-block", width: 3, height: 22, background: "var(--color-brand-blue)", verticalAlign: "middle", marginLeft: 2 }}/>
      </div>
      <div className="lk-card mt-3" style={{ background: "#FEF3C7", borderColor: "#F1C66B", padding: 12 }}>
        <div className="row gap-2 fz-12" style={{ color: "#7A4F00" }}>
          <Icon name="hint" size={16} color="#7A4F00"/> <span><span className="fw-7">Close enough</span> — minor typos won't cost you a heart.</span>
        </div>
      </div>
    </LessonChrome>
  );
}

// ============================================================
// DRILL 8 — image_word
// Image-forward layout, AI-generated noun
// ============================================================
function DrillImageWord() {
  return (
    <LessonChrome progress={64} cta="Check" ctaKind="blue">
      <div className="eyebrow mb-2">What is this in Dutch?</div>
      <div style={{
        position: "relative",
        background: "linear-gradient(160deg, #FFE5D2, #FFD6E4)",
        borderRadius: 22, height: 220, overflow: "hidden",
        border: "1px solid var(--line-soft)",
        display: "grid", placeItems: "center",
      }}>
        <Mascot kind="tompouce" mood="idle" size={170} />
        <span className="badge" style={{ position: "absolute", top: 10, left: 10 }}>
          <Icon name="sparkle" size={11}/> AI image
        </span>
      </div>
      <div className="input3d mt-4">
        tompo<span style={{ display: "inline-block", width: 3, height: 22, background: "var(--color-brand-blue)", verticalAlign: "middle", marginLeft: 2 }}/>
      </div>
      <div className="row gap-2 mt-3">
        <button style={{
          background: "var(--color-brand-blue-soft)",
          border: "1.5px solid var(--color-brand-blue)",
          color: "var(--color-brand-blue-dark)",
          padding: "8px 12px", borderRadius: 12, cursor: "pointer",
          fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13,
        }} className="row gap-2"><Icon name="mic" size={14}/> Say it instead</button>
        <span className="grow"/>
        <span className="fz-12 muted center">de · het ?</span>
      </div>
    </LessonChrome>
  );
}

// ============================================================
// DRILL 9 — speak (mic / STT)
// Live waveform, transcribes and scores pronunciation
// ============================================================
function DrillSpeak() {
  return (
    <LessonChrome progress={68} cta="Submit" ctaKind="green">
      <Prompt type="Say it aloud" dutch="“Mag ik twee tompoezen, alstublieft?”" english="Tap the mic, then say the sentence." mascot="kroket" />

      <div style={{
        background: "var(--color-good-soft)",
        border: "1.5px solid var(--color-good)",
        borderRadius: 22, padding: 16,
        position: "relative",
      }}>
        <div className="row" style={{ justifyContent: "center" }}>
          <button style={{
            width: 110, height: 110, borderRadius: "50%",
            background: "var(--color-good)", border: 0, cursor: "pointer",
            boxShadow: "0 6px 0 0 #2D6638",
            display: "grid", placeItems: "center",
            position: "relative",
          }}>
            <span style={{ position: "absolute", inset: -8, borderRadius: "50%", border: "3px solid var(--color-good)", opacity: 0.4, animation: "pulse-ring 1.6s infinite" }}/>
            <Icon name="mic" size={48} color="white" />
          </button>
        </div>
        <div className="center mt-3">
          <Waveform bars={32} active />
        </div>
        <div className="center mt-2 fz-13 fw-7" style={{ color: "#235A2C" }}>Listening…</div>

        {/* live transcript with scored words */}
        <div className="lk-card mt-3" style={{ padding: 12 }}>
          <div className="eyebrow mb-2">Live transcript</div>
          <div className="text-display fz-15" style={{ lineHeight: 1.5 }}>
            <ScoredWord word="Mag" score="ok"/>{" "}
            <ScoredWord word="ik" score="ok"/>{" "}
            <ScoredWord word="twee" score="ok"/>{" "}
            <ScoredWord word="tom-poe-zen" score="warn"/>{" "}
            <ScoredWord word="alstublieft" score="ok"/>
          </div>
          <div className="fz-12 muted mt-2">87% match · keep going</div>
        </div>
      </div>

      <div className="row gap-2 mt-3 center">
        <button style={{
          background: "transparent", border: "1.5px solid var(--line-strong)",
          color: "var(--text-soft)", padding: "6px 12px", borderRadius: 999,
          fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12, cursor: "pointer",
        }}>Can't speak right now — skip</button>
      </div>
    </LessonChrome>
  );
}

function ScoredWord({ word, score }) {
  const bg = score === "ok" ? "var(--color-good-soft)"
           : score === "warn" ? "#FEF3C7"
           : "var(--color-bad-soft)";
  const fg = score === "ok" ? "#235A2C"
           : score === "warn" ? "#7A4F00"
           : "#7A2424";
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 8,
      background: bg, color: fg, fontWeight: 700,
    }}>{word}</span>
  );
}

// ============================================================
// Out-of-hearts state
// ============================================================
function DrillOutOfHearts() {
  return (
    <Phone palette="live">
      <div className="row gap-2" style={{ padding: "8px 14px 8px" }}>
        <button aria-label="Close" style={{ background: "none", border: 0, cursor: "pointer" }}>
          <Icon name="x" size={22} color="var(--text-soft)"/>
        </button>
        <div className="grow"><Progress value={42} color="orange" /></div>
        <span className="row gap-2 fz-13 fw-7" style={{ color: "var(--color-bad)" }}>
          <Icon name="heart" size={18} color="var(--color-bad)" /> 0
        </span>
      </div>

      {/* dim the page */}
      <div style={{ flex: 1, padding: 18, position: "relative", overflow: "hidden" }}>
        <div style={{ filter: "blur(2px) opacity(0.4)", pointerEvents: "none" }}>
          <Prompt type="Choose the translation" dutch="Mag ik een tompouce, alstublieft?" mascot="stroop"/>
          <div className="col gap-2">
            <div className="option-card">Option A</div>
            <div className="option-card">Option B</div>
            <div className="option-card">Option C</div>
          </div>
        </div>

        {/* sheet */}
        <div style={{
          position: "absolute", left: 12, right: 12, bottom: 12,
          background: "var(--surface-card)", borderRadius: 24, padding: 18,
          border: "1px solid var(--line-soft)",
          boxShadow: "0 -20px 40px -10px rgba(0,0,0,.2)",
        }}>
          <div className="center" style={{ flexDirection: "column" }}>
            <Mascot kind="stroop" mood="surprised" size={86} />
            <h3 className="fz-22 mt-2 center" style={{ textAlign: "center" }}>Out of hearts!</h3>
            <p className="fz-13 soft mt-1 center" style={{ textAlign: "center" }}>
              Take a breather, refill with coins, or keep going at half-speed.
            </p>
          </div>
          <div className="col gap-2 mt-3">
            <Button kind="orange" full size="lg">
              <Icon name="coin" size={18} color="white"/> Refill — 50 coins
            </Button>
            <Button kind="blue" full ghost>
              <Icon name="snow" size={18}/> Use streak freeze
            </Button>
            <Button ghost full>Wait — next heart in 23 min</Button>
          </div>
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, {
  LessonChrome, FeedbackBar, Prompt,
  DrillMultipleChoice, DrillMultipleChoiceCorrect, DrillMultipleChoiceWrong,
  DrillTranslation, DrillFillBlank, DrillWordOrder, DrillMatchPairs,
  DrillListeningMC, DrillListeningSpell, DrillImageWord, DrillSpeak,
  DrillOutOfHearts, Waveform, ScoredWord, BlankFilled,
});
