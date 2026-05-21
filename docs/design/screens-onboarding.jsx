/* global React, LK, Phone, TopBar, StatusStrip, TabDock, Button, Card, Chip, Badge, Mascot, Icon, H, Progress, Hearts, Confetti, TREATS */

// ============================================================
// SCREEN 1 — Landing / marketing (/) — DEFAULT (original)
// Hero with animated Stroop, one primary CTA, feature triplet,
// tilted phone-in-phone preview of the path, social-proof strip.
// Asymmetric, postcard-like.
// ============================================================
function ScreenLanding() {
  return (
    <Phone palette="live">
      <div className="scrolly" style={{ background: "var(--surface-page)" }}>
        {/* top nav */}
        <div className="row" style={{ padding: "10px 18px", justifyContent: "space-between" }}>
          <span className="text-display fw-7 fz-18" style={{ color: "var(--color-brand-orange-dark)" }}>Lekkertaal</span>
          <span className="row gap-2">
            <Button kind="orange" size="sm" ghost>Inloggen</Button>
          </span>
        </div>

        {/* hero */}
        <div style={{ padding: "8px 22px 0", position: "relative" }}>
          <div className="eyebrow" style={{ color: "var(--color-brand-blue-dark)" }}>Leer Nederlands · gezellig</div>
          <h1 style={{ fontSize: 38, lineHeight: 1.02, marginTop: 8, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Dutch that <span style={{ color: "var(--color-brand-orange)" }}>actually</span> sticks.
          </h1>
          <p className="mt-3 fz-15 soft" style={{ lineHeight: 1.45 }}>
            Five minutes a day, real bakkerij conversations,
            and a stroopwafel who genuinely roots for you.
          </p>

          <div className="mt-4 row gap-3">
            <Button kind="orange" size="lg">Start leren →</Button>
            <Button ghost size="lg">Try a lesson</Button>
          </div>

          {/* mascot + tilted phone preview */}
          <div style={{ position: "relative", marginTop: 18, height: 250 }}>
            <Mascot kind="stroop" mood="happy" size={150}
              style={{ position: "absolute", left: -10, bottom: 0, zIndex: 2 }} />
            {/* tilted phone-in-phone */}
            <div style={{
              position: "absolute", right: -16, top: 0, width: 175, height: 240,
              borderRadius: 28, background: "var(--surface-card)",
              border: "8px solid #1a1410",
              boxShadow: "0 20px 40px -10px rgba(0,0,0,.35)",
              transform: "rotate(7deg)", overflow: "hidden",
            }}>
              <div style={{ background: "var(--surface-banner-blue)", height: 40, padding: "8px 10px" }}>
                <div className="row gap-2 fz-11"><Icon name="flame" size={11} color="#D54E00"/><span className="fw-7">12</span><span style={{flex:1}}/><span className="fw-7">320</span></div>
              </div>
              <div style={{ padding: 14 }}>
                <div className="eyebrow fz-11">Unit 3 · Bij de bakker</div>
                <div className="col gap-2 mt-3">
                  {[{s:"done"},{s:"done"},{s:"current"},{s:"locked"},{s:"locked"}].map((n,i) => (
                    <div key={i} className="row gap-2">
                      <span className={"path-tile " + n.s} style={{ width: 36, height: 36, borderRadius: 12, boxShadow: "0 3px 0 0 var(--line-strong)", fontSize: 12 }}>
                        {n.s === "done" ? <Icon name="check" size={14} color="white"/> :
                         n.s === "current" ? <Icon name="star" size={14} color="white"/> :
                         <Icon name="lock" size={12}/>}
                      </span>
                      <span className="fz-12 fw-7" style={{color: n.s==="locked"?"var(--text-muted)":"var(--text-strong)"}}>Les {i+1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* feature triplet — staggered, not symmetric cards */}
          <div className="mt-4">
            <div className="eyebrow mb-3">Why it works</div>
            <div className="col gap-3">
              <FeatureRow
                tag="Daily drills"
                title="Nine drill types, one rhythm."
                body="Pairs, listening, speaking, fill-the-blank. Variety keeps your brain from autopiloting."
                color="orange"
              />
              <FeatureRow
                tag="Boss-fight"
                title="Roleplay a real bakery."
                body="Order broodjes from Kroket. He'll correct you, kindly. Streaming AI; you can speak or type."
                color="blue"
                offset
              />
              <FeatureRow
                tag="Streaks that mean it"
                title="Show up. Bring snacks."
                body="Stroopwafel freezes, weekly leagues, peer-drills from friends. Quietly competitive."
                color="pink"
              />
            </div>
          </div>

          {/* proof strip */}
          <div className="mt-5 lk-card" style={{ background: "var(--surface-banner)" }}>
            <div className="row gap-3">
              <Mascot kind="bitterballen" mood="idle" size={56} />
              <div className="col grow">
                <div className="row gap-2 fz-12 fw-7" style={{color:"var(--text-on-banner)"}}>
                  <span>★ 4.8</span>
                  <span>·</span>
                  <span>12k learners</span>
                  <span>·</span>
                  <span>A1 → B2</span>
                </div>
                <div className="fz-12 soft mt-1">"Eindelijk een app waar ik niet over de skip-knop fantaseer." — Liesbeth, A2</div>
              </div>
            </div>
          </div>

          {/* secondary CTA */}
          <div className="mt-5 center" style={{ flexDirection: "column" }}>
            <Button kind="orange" size="lg" full>Start leren — gratis</Button>
            <div className="fz-12 muted mt-2">No card. Cancel anytime. Doei!</div>
          </div>

          <hr className="dotted mt-5" />
          <div className="row gap-3 fz-11 muted" style={{ paddingBottom: 28 }}>
            <span>Privacy</span><span>·</span><span>Terms</span><span>·</span><span>Contact</span>
            <span className="grow" />
            <span>NL · EN</span>
          </div>
        </div>
      </div>
    </Phone>
  );
}

function FeatureRow({ tag, title, body, color = "orange", offset = false }) {
  const bg = color === "orange" ? "var(--color-brand-orange-soft)"
           : color === "blue"   ? "var(--color-brand-blue-soft)"
           : "var(--color-brand-pink-soft)";
  const fg = color === "orange" ? "var(--color-brand-orange-dark)"
           : color === "blue"   ? "var(--color-brand-blue-dark)"
           : "#B83A6E";
  return (
    <div className="lk-card row gap-3" style={{ marginLeft: offset ? 18 : 0, marginRight: offset ? 0 : 18, padding: 14 }}>
      <span className="text-display fw-7 fz-11" style={{
        background: bg, color: fg, padding: "4px 8px",
        borderRadius: 999, alignSelf: "flex-start",
      }}>{tag}</span>
      <div className="col">
        <div className="text-display fw-7 fz-15">{title}</div>
        <div className="fz-13 soft mt-1">{body}</div>
      </div>
    </div>
  );
}

// ============================================================
// SCREEN 1b — Canal-scene landing (explore variant)
// One bold bilingual headline + canal scene as single hero.
// Use side-by-side with the original to compare directions.
// ============================================================
function ScreenLandingCanal() {
  return (
    <Phone palette="live">
      <div className="scrolly" style={{ background: "var(--surface-page)" }}>
        {/* top nav */}
        <div className="row" style={{ padding: "12px 22px", justifyContent: "space-between" }}>
          <span className="text-display fw-7 fz-18" style={{ color: "var(--color-brand-orange-dark)" }}>
            Lekkertaal
          </span>
          <span className="row gap-2">
            <button style={{
              background: "transparent", border: 0,
              fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 13,
              color: "var(--text-soft)", cursor: "pointer", padding: "6px 4px",
            }}>Inloggen</button>
          </span>
        </div>

        {/* headline */}
        <div style={{ padding: "6px 24px 0" }}>
          <div className="eyebrow" style={{ color: "var(--color-brand-blue-dark)" }}>
            Dutch · A1 → B2
          </div>
          <h1 style={{
            fontSize: 48, lineHeight: 0.98, marginTop: 10, fontWeight: 700,
            letterSpacing: "-0.03em", color: "var(--text-strong)",
          }}>
            Lekker.<br/>
            Gezellig.<br/>
            <span style={{ color: "var(--color-brand-orange)" }}>Eindelijk leuk.</span>
          </h1>
          <p className="mt-3 fz-14 soft" style={{ lineHeight: 1.45, maxWidth: 320 }}>
            Three Dutch words you'll learn this week. The rest? Same vibe —
            five minutes a day, real conversations, mascots who never patronise you.
          </p>
        </div>

        {/* THE canal scene — single hero illustration */}
        <CanalScene />

        {/* CTA + microcopy */}
        <div style={{ padding: "0 22px" }}>
          <Button kind="orange" full size="lg">Start leren — gratis</Button>
          <div className="row gap-2 mt-2 fz-11 muted center" style={{ justifyContent: "center" }}>
            <span>Free forever</span>
            <span>·</span>
            <span>No card</span>
            <span>·</span>
            <span>30 sec to start</span>
          </div>
        </div>

        {/* social proof — single line, not a card */}
        <div className="row gap-2 mt-5" style={{
          padding: "0 22px", justifyContent: "center", flexWrap: "wrap",
        }}>
          <span className="fz-12 fw-7" style={{ color: "var(--color-brand-orange-dark)" }}>★ 4.8</span>
          <span className="fz-12 muted">·</span>
          <span className="fz-12 fw-7" style={{ color: "var(--text-strong)" }}>12k learners</span>
          <span className="fz-12 muted">·</span>
          <span className="fz-12 soft">"Eindelijk een app waar ik niet over de skip-knop fantaseer."</span>
        </div>

        {/* footer */}
        <hr className="dotted" style={{ margin: "32px 22px 12px" }} />
        <div className="row gap-3 fz-11 muted" style={{ padding: "0 22px 28px" }}>
          <span>Privacy</span><span>·</span><span>Terms</span><span>·</span><span>Contact</span>
          <span className="grow" />
          <span>🇳🇱 NL · 🇬🇧 EN</span>
        </div>
      </div>
    </Phone>
  );
}

// ============================================================
// CanalScene — the landing-page hero illustration.
// A Dutch gracht: gable houses across the back, brick bridge
// across the canal, Stroop on the left side waving across to
// Kroket at his bakkerij on the right. A rowboat with Drop
// drifts past on the water. Idle bobs + slow ambient motion.
// ============================================================
function CanalScene() {
  return (
    <div style={{
      position: "relative",
      margin: "20px 14px 22px",
      height: 320,
      borderRadius: 24,
      overflow: "hidden",
      background: "linear-gradient(180deg, #FFE5D2 0%, #FFD9E4 40%, #D6E7F5 55%, #1F6FB2 56%, #0E4F87 100%)",
      border: "1.5px solid var(--line-soft)",
      boxShadow: "0 14px 30px -14px rgba(213, 78, 0, 0.25)",
    }}>
      {/* sun */}
      <div style={{
        position: "absolute", top: 18, right: 36, width: 38, height: 38,
        borderRadius: "50%", background: "var(--color-brand-orange)",
        boxShadow: "0 0 30px 8px rgba(255, 107, 26, 0.35)",
      }}/>

      {/* birds */}
      <svg viewBox="0 0 120 30" style={{ position: "absolute", top: 24, left: 30, width: 120, height: 30, opacity: 0.7 }} fill="none" stroke="var(--color-brand-orange-dark)" strokeWidth="1.8" strokeLinecap="round">
        <path d="M6 16c3-6 6-6 9 0 3-6 6-6 9 0" />
        <path d="M44 8c2-4 4-4 6 0 2-4 4-4 6 0" />
        <path d="M82 18c2-4 4-4 6 0 2-4 4-4 6 0" />
      </svg>

      {/* gable houses silhouette */}
      <GableRow />

      {/* canal water surface (waterline at 56%) */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: "56%", bottom: 0,
        background: "linear-gradient(180deg, #2A86C9 0%, #1F6FB2 30%, #0E4F87 100%)",
      }}/>
      {/* sparkles on water */}
      <svg viewBox="0 0 368 70" preserveAspectRatio="none"
        style={{ position: "absolute", left: 0, right: 0, top: "56%", width: "100%", height: "44%", opacity: 0.5 }}
        fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" strokeLinecap="round">
        <path d="M20 12h6M80 22h8M150 14h6M210 32h8M280 18h6M330 28h8M50 42h6M120 50h8M200 58h6M280 50h8M340 60h6" />
      </svg>
      {/* waterline highlight */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: "56%",
        height: 2, background: "rgba(255,255,255,0.55)",
      }}/>

      {/* the bridge — brick arch left → right */}
      <Bridge />

      {/* the rowboat drifting across */}
      <Boat />

      {/* Stroop on the left platform */}
      <span className="mascot anim-idle-bob" style={{
        position: "absolute", left: 22, bottom: 88,
        width: 96, height: 96, zIndex: 5,
      }}>
        <img src="public/mascot/stroop-512.png" alt="Stroop" draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
      </span>
      {/* Stroop's small left platform/cobbles */}
      <div style={{
        position: "absolute", left: 0, bottom: 78, width: 130, height: 14,
        background: "linear-gradient(180deg, #C9A878, #8A6D45)",
        borderTopRightRadius: 6,
        boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.18)",
      }}/>

      {/* Kroket at his bakkerij awning on the right */}
      <BakkerijAwning />
      <span className="mascot anim-idle-bob" style={{
        position: "absolute", right: 26, bottom: 92,
        width: 86, height: 86, zIndex: 5,
        animationDelay: "0.8s",
      }}>
        <img src="public/mascot/treats/kroket/happy.png" alt="Kroket" draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
      </span>

      {/* speech bubble from Kroket */}
      <div style={{
        position: "absolute", right: 100, bottom: 178,
        background: "white", borderRadius: 16,
        padding: "8px 12px",
        fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13,
        color: "var(--text-strong)",
        boxShadow: "0 6px 16px -6px rgba(0,0,0,0.3)",
        border: "1.5px solid var(--line-soft)",
        zIndex: 6,
      }}>
        Goedemorgen!
        <span style={{
          position: "absolute", right: -8, bottom: 10,
          width: 14, height: 14, background: "white",
          borderRight: "1.5px solid var(--line-soft)",
          borderBottom: "1.5px solid var(--line-soft)",
          transform: "rotate(-45deg)",
        }}/>
      </div>

      {/* tiny scene-label badge */}
      <span style={{
        position: "absolute", top: 12, left: 12,
        padding: "4px 10px", borderRadius: 999,
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(4px)",
        fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 10,
        color: "var(--color-brand-blue-dark)", letterSpacing: "0.08em",
      }}>
        AMSTERDAM · 08:42
      </span>

      {/* boat drift keyframes (scoped) */}
      <style>{`
        @keyframes boat-drift {
          0%   { transform: translateX(-60px) rotate(-1deg); }
          50%  { transform: translateX(180px) rotate(1deg); }
          100% { transform: translateX(420px) rotate(-1deg); }
        }
        @keyframes water-ripple {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(2px); }
        }
      `}</style>
    </div>
  );
}

function GableRow() {
  // 6 stepped/bell gables across the canal-side
  // viewBox 368×120; sits in the band between sky and water (16%–56%)
  return (
    <svg viewBox="0 0 368 120" preserveAspectRatio="none"
      style={{ position: "absolute", left: 0, right: 0, top: "16%", width: "100%", height: "40%" }}>
      {/* the row sits on a thin street strip */}
      <g>
        {/* House 1 — orange step gable */}
        <House x={0} w={56} h={96} color="#D54E00" roof="step" win={2}/>
        {/* House 2 — cream bell gable */}
        <House x={58} w={50} h={88} color="#FAEADB" roof="bell" win={2}/>
        {/* House 3 — blue tall pointed */}
        <House x={111} w={48} h={108} color="#1F6FB2" roof="point" win={3}/>
        {/* House 4 — pink narrow step */}
        <House x={162} w={42} h={94} color="#FF7AA2" roof="step" win={2}/>
        {/* House 5 — dark brick */}
        <House x={207} w={56} h={100} color="#7A3A1A" roof="bell" win={3}/>
        {/* House 6 — cream */}
        <House x={266} w={48} h={86} color="#FFF8EE" roof="step" win={2}/>
        {/* House 7 — orange-dark */}
        <House x={317} w={50} h={94} color="#D54E00" roof="point" win={2}/>
      </g>
      {/* the cobbled embankment top edge */}
      <rect x="0" y="115" width="368" height="6" fill="#8A6D45"/>
      <rect x="0" y="118" width="368" height="3" fill="#6B5232"/>
    </svg>
  );
}

function House({ x, w, h, color, roof, win }) {
  const top = 120 - h;
  // step / bell / point gable top, drawn relative
  const gable = (() => {
    const cx = x + w/2;
    if (roof === "step") {
      // stepped gable: rectangles stepping up
      return (
        <g>
          <rect x={x} y={top + 4} width={w} height={h - 4} fill={color}/>
          <rect x={x + 2} y={top - 2} width={w - 4} height={8} fill={color}/>
          <rect x={x + 6} y={top - 8} width={w - 12} height={8} fill={color}/>
          <rect x={cx - 4} y={top - 14} width={8} height={8} fill={color}/>
        </g>
      );
    }
    if (roof === "bell") {
      return (
        <g>
          <rect x={x} y={top + 6} width={w} height={h - 6} fill={color}/>
          {/* bell curve */}
          <path d={`M ${x},${top + 8} Q ${x + w/2},${top - 12} ${x + w},${top + 8} Z`} fill={color}/>
        </g>
      );
    }
    // pointed
    return (
      <g>
        <rect x={x} y={top + 8} width={w} height={h - 8} fill={color}/>
        <polygon points={`${x},${top + 10} ${cx},${top - 6} ${x + w},${top + 10}`} fill={color}/>
      </g>
    );
  })();

  const isLight = color === "#FAEADB" || color === "#FFF8EE";
  const winColor = isLight ? "rgba(30, 79, 135, 0.85)" : "#FFE5D2";
  const winLit = "#FFD66B";
  const trim = isLight ? "#7A3A1A" : "white";

  // windows: row at top + row at bottom, grid by `win` cols
  const winRows = [
    { y: top + 18 },
    { y: 120 - 38 },
  ];
  const winGap = (w - 4) / win;
  const wW = Math.min(8, winGap - 4);

  return (
    <g>
      {gable}
      {/* trim line at bottom of facade */}
      <rect x={x} y={119 - 4} width={w} height={2} fill="rgba(0,0,0,0.2)"/>
      {/* windows */}
      {winRows.map((r, ri) => (
        <g key={ri}>
          {Array.from({ length: win }).map((_, i) => {
            const wx = x + 2 + i * winGap + (winGap - wW)/2;
            const lit = (ri === 0 && i === 0); // top-left lit window
            return <rect key={i} x={wx} y={r.y} width={wW} height={10}
              fill={lit ? winLit : winColor} stroke={trim} strokeWidth="0.8"/>;
          })}
        </g>
      ))}
      {/* small door on house if tall enough */}
      {h > 95 && (
        <rect x={x + w/2 - 4} y={120 - 14} width={8} height={10} fill="#3F2F22" stroke={trim} strokeWidth="0.8"/>
      )}
    </g>
  );
}

function Bridge() {
  return (
    <svg viewBox="0 0 368 140" preserveAspectRatio="none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 70, width: "100%", height: 80, zIndex: 3 }}>
      {/* deck */}
      <path d="M 120 60 Q 184 28 248 60 L 248 70 L 120 70 Z" fill="#9E4200"/>
      <path d="M 120 60 Q 184 28 248 60" stroke="#7A3010" strokeWidth="2" fill="none"/>
      {/* arch underneath */}
      <path d="M 130 70 Q 184 110 238 70" fill="rgba(14,79,135,0.35)" stroke="#7A3010" strokeWidth="1.5"/>
      {/* railing balusters */}
      {[140, 155, 170, 184, 198, 213, 228].map((cx, i) => {
        // baluster top follows the arch
        const t = (cx - 184) / 64; // -0.69..0.69
        const y = 60 + 16 * t * t - 6;
        return <rect key={i} x={cx - 1} y={y} width={2} height={60 - y + 5} fill="#7A3010"/>;
      })}
      {/* railing top */}
      <path d="M 130 55 Q 184 24 238 55" stroke="#7A3010" strokeWidth="2" fill="none"/>
      {/* keystone */}
      <rect x="180" y="68" width="8" height="6" fill="#7A3010"/>
    </svg>
  );
}

function BakkerijAwning() {
  return (
    <div style={{
      position: "absolute", right: 14, bottom: 96, width: 110, height: 26,
      zIndex: 4,
    }}>
      {/* awning stripes */}
      <div style={{
        width: "100%", height: 18,
        background: "repeating-linear-gradient(90deg, var(--color-brand-orange) 0 12px, white 12px 22px)",
        borderRadius: "6px 6px 14px 14px",
        boxShadow: "0 3px 6px -2px rgba(0,0,0,0.25)",
      }}/>
      {/* shop sign */}
      <div style={{
        position: "absolute", left: 8, top: 22,
        background: "var(--color-brand-orange-dark)",
        color: "white", padding: "1px 8px", borderRadius: 4,
        fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 9,
        letterSpacing: "0.08em",
      }}>BAKKERIJ</div>
    </div>
  );
}

function Boat() {
  return (
    <div style={{
      position: "absolute", left: 0, bottom: 14, width: 96, height: 60,
      zIndex: 4, animation: "boat-drift 16s linear infinite",
    }}>
      <svg viewBox="0 0 96 60" style={{ width: "100%", height: "100%" }}>
        {/* mast */}
        <rect x="46" y="2" width="2" height="28" fill="#3F2F22"/>
        {/* Dutch tricolor flag */}
        <rect x="48" y="2" width="18" height="4" fill="#AE1C28"/>
        <rect x="48" y="6" width="18" height="4" fill="white"/>
        <rect x="48" y="10" width="18" height="4" fill="#21468B"/>
        {/* hull — flat deck on top, curved hull below */}
        <path d="M 4 30 Q 48 58 92 30 Z" fill="#3F2F22"/>
        {/* deck plank trim */}
        <rect x="6" y="28" width="84" height="3" fill="#7A3010"/>
        {/* gunwale highlight along the deck */}
        <rect x="6" y="26" width="84" height="2" fill="#A85510"/>
        {/* small bench/seat */}
        <rect x="22" y="22" width="14" height="6" fill="#7A3010" rx="1"/>
        <rect x="58" y="22" width="14" height="6" fill="#7A3010" rx="1"/>
      </svg>
      {/* Drop passenger — sits on the deck */}
      <span className="mascot" style={{
        position: "absolute", left: 22, top: -8, width: 34, height: 34,
      }}>
        <img src="public/mascot/treats/drop/idle.png" alt="" draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
      </span>
    </div>
  );
}

// ============================================================
// SCREEN 2 — Onboarding
// (a) welcome + goal pick
// (b) level pick A1 / A2 / B1
// (c) notifications opt-in + reminder time
// ============================================================
function ScreenOnbWelcome() {
  return (
    <Phone palette="live">
      <div className="col" style={{ flex: 1, padding: "8px 22px 28px", background: "var(--surface-page)" }}>
        {/* progress */}
        <div className="row gap-2 mt-2 mb-4">
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--color-brand-orange)" }} />
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--line-soft)" }} />
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--line-soft)" }} />
        </div>

        <div className="center" style={{ marginTop: 6 }}>
          <Mascot kind="stroop" mood="happy" size={130} />
        </div>
        <div className="bubble mt-3" style={{ alignSelf: "center", maxWidth: 280 }}>
          <span className="text-display fw-7">Hoi! I'm Stroop.</span>
          <div className="fz-13 mt-1 soft">First — why are you learning Dutch? I'll plan the lessons around it.</div>
        </div>

        <div className="col gap-2 mt-4">
          <OptionRow icon="✈️" label="Moving to NL" sub="Living, working, paperwork" selected />
          <OptionRow icon="❤️" label="Dating a Dutchie" sub="Family, friends, in-laws" />
          <OptionRow icon="🎓" label="Study / school" sub="Inburgering, exam prep" />
          <OptionRow icon="🧠" label="Brain food" sub="Just for fun" />
        </div>

        <div className="grow" />
        <Button kind="orange" full size="lg">Continue →</Button>
      </div>
    </Phone>
  );
}

function OptionRow({ icon, label, sub, selected, disabled }) {
  return (
    <div className={"option-card " + (selected ? "selected" : "")} style={{ pointerEvents: disabled ? "none" : "auto" }}>
      <span style={{ width: 36, height: 36, borderRadius: 12, background: "var(--surface-card-alt)", display: "grid", placeItems: "center", fontSize: 20 }}>{icon}</span>
      <div className="col grow" style={{ gap: 2 }}>
        <span className="fz-15 fw-7">{label}</span>
        <span className="fz-12 soft">{sub}</span>
      </div>
      {selected && <Icon name="check" size={18} color="var(--color-brand-blue-dark)" />}
    </div>
  );
}

function ScreenOnbLevel() {
  return (
    <Phone palette="live">
      <div className="col" style={{ flex: 1, padding: "8px 22px 28px", background: "var(--surface-page)" }}>
        <div className="row gap-2 mt-2 mb-4">
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--color-brand-orange)" }} />
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--color-brand-orange)" }} />
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--line-soft)" }} />
        </div>

        <h2 className="fz-28" style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Where are you starting?
        </h2>
        <p className="fz-14 soft mt-2">Pick what fits today. You can adjust anytime.</p>

        <div className="col gap-3 mt-4">
          <LevelCard letter="A1" tone="green" title="Just beginning" body="Hi · my name is · the basics." mascot="poffertjes" selected />
          <LevelCard letter="A2" tone="orange" title="Some Dutch" body="Shops, cafés, getting around." mascot="kroket" />
          <LevelCard letter="B1" tone="blue" title="Holding my own" body="Work talk, news, opinions." mascot="kaas" />
        </div>

        <div className="row gap-2 mt-4 fz-12 muted center">
          <Icon name="hint" size={14} /> Not sure? <span className="strong">Take the 2-min placement</span>
        </div>

        <div className="grow" />
        <div className="row gap-3">
          <Button ghost size="lg" full>← Back</Button>
          <Button kind="orange" size="lg" full>Continue →</Button>
        </div>
      </div>
    </Phone>
  );
}

function LevelCard({ letter, tone, title, body, mascot, selected }) {
  const borderColor = selected ? "var(--color-brand-orange)" : "var(--line-soft)";
  const shadow = selected ? "0 4px 0 0 var(--color-brand-orange)" : "0 3px 0 0 var(--line-soft)";
  const bg = tone === "green" ? "var(--color-good-soft)" : tone === "orange" ? "var(--color-brand-orange-soft)" : "var(--color-brand-blue-soft)";
  const fg = tone === "green" ? "#235A2C" : tone === "orange" ? "var(--color-brand-orange-dark)" : "var(--color-brand-blue-dark)";
  return (
    <div style={{
      background: "var(--surface-card)",
      borderRadius: 22, border: "2px solid " + borderColor,
      boxShadow: shadow, padding: 14,
      display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: bg, color: fg,
        display: "grid", placeItems: "center",
        fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700,
      }}>{letter}</div>
      <div className="col grow" style={{ gap: 2 }}>
        <span className="fz-16 fw-7 text-display">{title}</span>
        <span className="fz-12 soft">{body}</span>
      </div>
      <Mascot kind={mascot} size={56} />
    </div>
  );
}

function ScreenOnbNotifs() {
  return (
    <Phone palette="live">
      <div className="col" style={{ flex: 1, padding: "8px 22px 28px", background: "var(--surface-page)" }}>
        <div className="row gap-2 mt-2 mb-4">
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--color-brand-orange)" }} />
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--color-brand-orange)" }} />
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--color-brand-orange)" }} />
        </div>

        <div className="center" style={{ marginTop: 4 }}>
          <Mascot kind="stroop" mood="idle" size={130} />
        </div>
        <h2 className="fz-22 mt-3 center" style={{ textAlign: "center" }}>One nudge a day,<br/> never twee.</h2>
        <p className="fz-14 soft mt-2 center" style={{ textAlign: "center" }}>
          A tiny daily reminder so streaks don't slip. We won't spam — promise.
        </p>

        <Card className="mt-4">
          <div className="eyebrow">Daily reminder time</div>
          <div className="row gap-2 mt-3" style={{ flexWrap: "wrap" }}>
            {["07:30","12:30","18:00","20:30","21:30"].map((t,i) => (
              <span key={t} className={"chip-word " + (i === 3 ? "in-tray" : "")} style={{ padding: "8px 12px", fontSize: 14 }}>
                {t}
              </span>
            ))}
          </div>
          <div className="fz-12 muted mt-3">Stroop will say hi at <span className="strong" style={{color:"var(--color-brand-orange-dark)"}}>20:30</span>.</div>
        </Card>

        <Card className="mt-3" tinted>
          <div className="row gap-3">
            <span style={{ width: 36, height: 36, borderRadius: 12, background: "var(--color-brand-blue-soft)", display:"grid", placeItems:"center", color:"var(--color-brand-blue-dark)" }}>
              <Icon name="bell" />
            </span>
            <div className="col">
              <span className="fw-7">Friend pings & peer drills</span>
              <span className="fz-12 soft">Only when someone challenges you.</span>
            </div>
            <span className="grow" />
            <Toggle on />
          </div>
        </Card>

        <div className="grow" />
        <div className="col gap-2">
          <Button kind="orange" full size="lg">Allow notifications</Button>
          <Button ghost full>Maybe later</Button>
        </div>
      </div>
    </Phone>
  );
}

function Toggle({ on = false }) {
  return (
    <span style={{
      width: 44, height: 26, borderRadius: 999,
      background: on ? "var(--color-good)" : "var(--line-strong)",
      position: "relative", flex: "none",
    }}>
      <span style={{
        position: "absolute", top: 3, left: on ? 21 : 3,
        width: 20, height: 20, borderRadius: "50%", background: "white",
        boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left 120ms",
      }} />
    </span>
  );
}

Object.assign(window, { ScreenLanding, ScreenLandingCanal, ScreenOnbWelcome, ScreenOnbLevel, ScreenOnbNotifs, OptionRow, LevelCard, Toggle, CanalScene, FeatureRow });
