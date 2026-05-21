/* global React, LK, Phone, TopBar, StatusStrip, TabDock, Button, Card, Chip, Badge, Mascot, Icon, H, Progress, Hearts, TREATS */

// ============================================================
// SCREEN 3 — Learning Path (/app/path)
// Original layout language (NOT a Duolingo skill-tree):
//  - vertical "neighbourhood blocks" stacked: each unit is a
//    little Dutch-canal district with a header card (gable + mascot)
//    and a staggered tile-grid of lessons below.
//  - current lesson pulses; locked lessons are visually muted;
//    boss-fight lesson at the bottom of each unit is a wide bar.
// ============================================================

function ScreenPath({ palette = "live", showQuests = true }) {
  return (
    <Phone palette={palette}>
      <TopBar />
      <StatusStrip streak={12} freezes={2} coins={320} xp={60} level={7} hearts={4} />
      <div className="scrolly with-dock canal-bg">
        {/* Daily quests */}
        {showQuests && <DailyQuests />}

        {/* Unit 3 — current */}
        <UnitBlock
          slug="bakker"
          number="03"
          title="Bij de bakker"
          subtitle="At the bakery · 18 lessons"
          mascot="tompouce"
          accent="orange"
          progress={62}
          lessons={[
            { id: 1, state: "done",    label: "Hallo" },
            { id: 2, state: "done",    label: "Bestellen" },
            { id: 3, state: "done",    label: "Cijfers" },
            { id: 4, state: "done",    label: "Brood" },
            { id: 5, state: "current", label: "Tompouce", title: "Lesson 5" },
            { id: 6, state: "locked",  label: "Koffie" },
            { id: 7, state: "locked",  label: "Afrekenen" },
          ]}
          bossLabel="Roleplay: Bij de bakker"
          bossState="locked"
          peeker={{ kind: "frikandel", side: "right" }}
        />

        {/* Unit 4 — next, locked */}
        <UnitBlock
          slug="markt"
          number="04"
          title="Op de markt"
          subtitle="At the market · 22 lessons"
          mascot="kaas"
          accent="blue"
          progress={0}
          locked
          lessons={[
            { id: 1, state: "locked", label: "Groente" },
            { id: 2, state: "locked", label: "Hoeveel?" },
            { id: 3, state: "locked", label: "Kaas" },
            { id: 4, state: "locked", label: "Vis" },
          ]}
          bossLabel="Roleplay: Op de markt"
          bossState="locked"
        />
      </div>
      <TabDock active="path" />
    </Phone>
  );
}

function DailyQuests() {
  return (
    <div style={{ padding: "12px 16px 0" }}>
      <div className="lk-card" style={{ padding: 14 }}>
        <div className="row gap-2">
          <Mascot kind="oliebollen" size={44} />
          <div className="col grow">
            <div className="text-display fw-7 fz-15">Daily quests</div>
            <div className="fz-11 muted">Reset in 6u 14m</div>
          </div>
          <span className="badge"><Icon name="coin" size={11}/> 25</span>
        </div>
        <div className="col gap-2 mt-3">
          <QuestRow icon="zap" label="Earn 30 XP" cur={22} tot={30} reward={10} />
          <QuestRow icon="star" label="Score 80%+ on 2 lessons" cur={1} tot={2} reward={10} />
          <QuestRow icon="mic" label="Speak in 1 roleplay" cur={0} tot={1} reward={5} />
        </div>
      </div>
    </div>
  );
}

function QuestRow({ icon, label, cur, tot, reward }) {
  const pct = Math.round((cur / tot) * 100);
  const done = cur >= tot;
  return (
    <div className="row gap-2">
      <span style={{
        width: 28, height: 28, borderRadius: 8,
        background: done ? "var(--color-good-soft)" : "var(--surface-card-alt)",
        color: done ? "#235A2C" : "var(--text-soft)",
        display: "grid", placeItems: "center", flex: "none",
      }}>
        {done ? <Icon name="check" size={14}/> : <Icon name={icon} size={14}/>}
      </span>
      <div className="col grow" style={{ gap: 4 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="fz-12 fw-7">{label}</span>
          <span className="fz-11 muted">{cur}/{tot}</span>
        </div>
        <Progress value={pct} color={done ? "green" : "orange"} />
      </div>
      <span className="badge"><Icon name="coin" size={11}/> {reward}</span>
    </div>
  );
}

function UnitBlock({ number, title, subtitle, mascot, accent, progress, lessons, bossLabel, bossState, locked, decorations = [] }) {
  const accentBg = accent === "blue" ? "var(--color-brand-blue-soft)" : "var(--color-brand-orange-soft)";
  const accentFg = accent === "blue" ? "var(--color-brand-blue-dark)" : "var(--color-brand-orange-dark)";
  const accentShadow = accent === "blue" ? "var(--color-brand-blue-dark)" : "var(--color-brand-orange-dark)";
  return (
    <div style={{ padding: "18px 16px 0" }}>
      {/* unit header — "gable" card */}
      <div className="lk-card row gap-3" style={{
        background: accentBg, borderColor: "transparent", padding: 14,
        opacity: locked ? 0.85 : 1
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: "white", color: accentFg,
          display: "grid", placeItems: "center",
          fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700,
          boxShadow: "0 3px 0 0 " + accentShadow,
        }}>{number}</div>
        <div className="col grow">
          <div className="row gap-2">
            <span className="text-display fw-7 fz-18" style={{ color: accentFg }}>{title}</span>
            {locked && <Badge kind="lock"><Icon name="lock" size={10}/> locked</Badge>}
          </div>
          <span className="fz-12" style={{ color: accentFg, opacity: 0.8 }}>{subtitle}</span>
          {!locked && (
            <div className="mt-2"><Progress value={progress} color="orange" /></div>
          )}
        </div>
        <Mascot kind={mascot} mood={locked ? "idle" : "happy"} size={62} />
      </div>

      {/* lesson tile-grid: 3-col staggered, with decorative treats layered on top */}
      <div style={{ position: "relative", padding: "18px 6px 0" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14, justifyItems: "center",
          position: "relative", zIndex: 1,
        }}>
          {lessons.map((l, i) => (
            <LessonTile key={l.id} {...l} offset={i % 2 === 1 ? 14 : 0} />
          ))}
        </div>

        {/* decorative treats — hand-positioned in gaps, never overlap tiles */}
        {decorations.map((d, i) => (
          <PathDeco key={i} {...d} dim={locked} />
        ))}
      </div>

      {/* boss-fight bar */}
      <div className="mt-4" style={{
        position: "relative",
        background: bossState === "locked" ? "var(--surface-card-alt)" :
          "linear-gradient(135deg, var(--color-brand-orange) 0%, var(--color-brand-pink) 100%)",
        color: bossState === "locked" ? "var(--text-muted)" : "white",
        borderRadius: 22, padding: "12px 16px",
        border: bossState === "locked" ? "1.5px dashed var(--line-strong)" : "0",
        boxShadow: bossState === "locked" ? "none" : "0 5px 0 0 var(--color-brand-orange-dark)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{
          width: 40, height: 40, borderRadius: 12,
          background: bossState === "locked" ? "var(--surface-card)" : "rgba(255,255,255,.25)",
          display: "grid", placeItems: "center",
        }}>
          {bossState === "locked"
            ? <Icon name="lock" size={18} />
            : <Icon name="mic" size={18} color="white" />}
        </span>
        <div className="col grow">
          <div className="eyebrow" style={{ color: bossState === "locked" ? "var(--text-muted)" : "rgba(255,255,255,.9)" }}>
            Boss fight
          </div>
          <div className="text-display fw-7 fz-15">{bossLabel}</div>
        </div>
        <Icon name="arrowR" size={18} />
      </div>
    </div>
  );
}

function LessonTile({ id, state, label, offset = 0 }) {
  return (
    <div className="col center" style={{ gap: 4, transform: `translateY(${offset}px)` }}>
      <div className={"path-tile " + state}>
        {state === "done" && <Icon name="check" size={24} color="white" />}
        {state === "current" && <Icon name="star" size={24} color="white" />}
        {state === "locked" && <Icon name="lock" size={20} />}
      </div>
      <div className="fz-11 fw-7" style={{
        color: state === "locked" ? "var(--text-muted)" : "var(--text-strong)",
        textAlign: "center", maxWidth: 80,
      }}>{label}</div>
    </div>
  );
}

// PathDeco — a tiny treat scattered between lesson tiles. Pure visual.
// Positioned absolutely on the grid container. `pos` is one of named slots
// mapped to (left, top) coords tuned to the 3-col staggered grid.
function PathDeco({ kind, pos, size = 38, mood = "idle", rotate = 0, label, dim }) {
  const slots = {
    // these are tuned for a 3-col staggered grid of ~6 tiles
    "r0-right":     { left: "82%", top:  18, transform: `rotate(${rotate}deg)` },
    "r1-left-bench":{ left:  "4%", top:  84, transform: `rotate(${rotate}deg)` },
    "r1-center":    { left: "44%", top:  86, transform: `rotate(${rotate}deg)` },
    "r2-right":     { left: "78%", top: 160, transform: `rotate(${rotate}deg)` },
    "r2-left":      { left:  "6%", top: 172, transform: `rotate(${rotate}deg)` },
    "r3-center":    { left: "46%", top: 246, transform: `rotate(${rotate}deg)` },
    "r3-right-lamp":{ left: "84%", top: 240, transform: `rotate(${rotate}deg)` },
  };
  const s = slots[pos] || { left: "50%", top: 100 };
  return (
    <div style={{
      position: "absolute", ...s,
      width: size, height: size, pointerEvents: "none",
      opacity: dim ? 0.45 : 0.9, zIndex: 0,
    }}>
      <Mascot kind={kind} mood={mood} size={size}
        className="anim-idle-bob"
        style={{ animationDelay: `${(kind.length % 7) * 0.2}s` }}/>
      {label && (
        <span style={{
          position: "absolute", left: "50%", top: size + 2,
          transform: "translateX(-50%)",
          fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 9,
          color: "var(--text-muted)", whiteSpace: "nowrap",
        }}>{label}</span>
      )}
    </div>
  );
}

// ============================================================
// SCREEN 4 — Unit detail
// ============================================================
function ScreenUnit({ palette = "live" }) {
  const lessons = [
    { n: 1, title: "Goedemorgen", desc: "Greetings & polite forms", state: "done", xp: 12, acc: "100%" },
    { n: 2, title: "Bestellen, alstublieft", desc: "Ordering politely", state: "done", xp: 14, acc: "92%" },
    { n: 3, title: "Cijfers 1–20", desc: "Numbers at the counter", state: "done", xp: 10, acc: "88%" },
    { n: 4, title: "Brood & broodjes", desc: "Bread vocabulary", state: "done", xp: 12, acc: "78%" },
    { n: 5, title: "Tompouce, alstublieft", desc: "Pastry case + sweet talk", state: "current", xp: null, acc: null },
    { n: 6, title: "Koffie en thee", desc: "Drinks & sizes", state: "locked" },
    { n: 7, title: "Afrekenen", desc: "Paying, change", state: "locked" },
  ];
  return (
    <Phone palette={palette}>
      <TopBar />
      <div className="scrolly with-dock">
        {/* hero: unit header */}
        <div style={{
          position: "relative",
          background: "linear-gradient(160deg, var(--color-brand-orange-soft), var(--color-brand-pink-soft))",
          padding: "16px 18px 18px",
        }}>
          <div className="row gap-2 fz-12">
            <span className="row gap-2" style={{ color: "var(--color-brand-orange-dark)", cursor: "pointer" }}>
              <Icon name="arrowL" size={14}/> Path
            </span>
          </div>
          <div className="row gap-3 mt-2">
            <Mascot kind="tompouce" mood="happy" size={88} />
            <div className="col grow">
              <div className="eyebrow">Unit 03</div>
              <h2 className="fz-22" style={{ lineHeight: 1.1 }}>Bij de bakker</h2>
              <div className="fz-12 soft">At the bakery — order broodjes, count change, befriend the lady at the counter.</div>
            </div>
          </div>
          <div className="row gap-2 mt-3" style={{ flexWrap: "wrap" }}>
            <Badge>vocab · bread</Badge>
            <Badge>vocab · numbers</Badge>
            <Badge kind="blue">grammar · zou</Badge>
            <Badge kind="blue">grammar · alstublieft</Badge>
          </div>
          <div className="mt-3">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="fz-12 fw-7">4 / 7 lessons</span>
              <span className="fz-11 muted">62% complete</span>
            </div>
            <div className="mt-2"><Progress value={62} color="orange" /></div>
          </div>
        </div>

        {/* lesson list */}
        <div style={{ padding: 16 }}>
          <div className="eyebrow mb-3">Lessons</div>
          <div className="col gap-2">
            {lessons.map(l => <LessonRow key={l.n} {...l} />)}
          </div>

          {/* boss-fight teaser */}
          <div className="mt-4">
            <div className="eyebrow mb-3">Caps the unit</div>
            <div style={{
              background: "linear-gradient(160deg, #2A1810, #4A2810)",
              color: "white", borderRadius: 22, padding: 16,
              position: "relative", overflow: "hidden",
              boxShadow: "0 8px 22px -10px rgba(0,0,0,.5)",
            }}>
              <span className="badge" style={{ background: "rgba(255,255,255,.15)", color: "#FFD9B5", border: "none" }}>
                <Icon name="sparkle" size={11} color="#FFD9B5" /> AI roleplay
              </span>
              <h3 className="fz-22 mt-2" style={{ color: "white" }}>"Mag ik twee tompoezen, alstublieft?"</h3>
              <p className="fz-13 mt-2" style={{ color: "rgba(255,255,255,.85)" }}>
                Step into the bakkerij. Order pastries, count change, handle a small surprise.
                Type or speak. Kroket is on the till today.
              </p>
              <div className="row gap-2 mt-3">
                <Badge kind="green"><Icon name="target" size={10}/> 5 objectives</Badge>
                <Badge>~3 min</Badge>
              </div>
              <div className="mt-3">
                <Button kind="orange">Start scenario →</Button>
              </div>
              <Mascot kind="kroket" size={120} style={{ position: "absolute", right: -10, bottom: -20, opacity: 0.95 }} />
            </div>
          </div>
        </div>
      </div>
      <TabDock active="path" />
    </Phone>
  );
}

function LessonRow({ n, title, desc, state, xp, acc }) {
  const done = state === "done";
  const cur = state === "current";
  const locked = state === "locked";
  return (
    <div className="lk-card row gap-3" style={{
      padding: 12,
      borderColor: cur ? "var(--color-brand-orange)" : "var(--line-soft)",
      boxShadow: cur ? "0 4px 0 0 var(--color-brand-orange)" : "0 2px 0 0 rgba(0,0,0,.03), 0 12px 28px -16px rgba(213,78,0,.12)",
      background: locked ? "var(--surface-card-alt)" : "var(--surface-card)",
      opacity: locked ? 0.8 : 1,
    }}>
      <span style={{
        width: 42, height: 42, borderRadius: 12, flex: "none",
        background: done ? "var(--color-good)" : cur ? "var(--color-brand-orange)" : "var(--surface-card-alt)",
        color: done || cur ? "white" : "var(--text-muted)",
        boxShadow: done ? "0 3px 0 0 #2D6638" : cur ? "0 3px 0 0 var(--color-brand-orange-dark)" : "0 3px 0 0 var(--line-soft)",
        display: "grid", placeItems: "center",
        fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16,
      }}>
        {done ? <Icon name="check" size={20} color="white"/> :
         cur ? n : locked ? <Icon name="lock" size={16}/> : n}
      </span>
      <div className="col grow">
        <div className="text-display fw-7 fz-15">{title}</div>
        <div className="fz-12 soft">{desc}</div>
        {done && (
          <div className="row gap-2 mt-1">
            <span className="badge green"><Icon name="zap" size={10}/> {xp} XP</span>
            <span className="badge">{acc} accuracy</span>
          </div>
        )}
      </div>
      {cur && <Button kind="orange" size="sm">Continue</Button>}
      {!locked && !cur && !done && <Icon name="arrowR" size={18}/>}
      {locked && <Icon name="lock" size={18} color="var(--text-muted)"/>}
    </div>
  );
}

Object.assign(window, { ScreenPath, ScreenUnit, UnitBlock, LessonTile, LessonRow, DailyQuests, PathDeco });
