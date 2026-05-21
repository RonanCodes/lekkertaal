/* global React, LK, Phone, TopBar, TabDock, StatusStrip, Button, Card, Chip, Badge, Mascot, Icon, Progress, TREATS */

// ============================================================
// SCREEN 10 — Shop
// ============================================================
function ScreenShop() {
  return (
    <Phone palette="live">
      <TopBar />
      <StatusStrip streak={12} freezes={2} coins={320} xp={60} level={7} hearts={4}/>
      <div className="scrolly with-dock">
        {/* balance hero */}
        <div style={{ padding: "12px 16px 0" }}>
          <div className="lk-card row gap-3" style={{
            background: "linear-gradient(160deg, #FFE5D2, #FFD9E4)",
            borderColor: "transparent",
          }}>
            <Mascot kind="bitterballen" mood="happy" size={62}/>
            <div className="col grow">
              <div className="eyebrow" style={{ color: "var(--color-brand-orange-dark)" }}>Your balance</div>
              <div className="row gap-2">
                <Icon name="coin" size={28} color="#C28E1A"/>
                <span className="text-display fw-7 fz-28">320</span>
              </div>
              <div className="fz-12 soft">Earn 25 more by finishing today's quests.</div>
            </div>
          </div>
        </div>

        {/* Streak freezes */}
        <div style={{ padding: "18px 16px 0" }}>
          <div className="eyebrow mb-2">Streak freezes</div>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            <ShopCard
              icon={<Icon name="snow" size={26} color="var(--color-brand-blue)"/>}
              title="Streak freeze"
              sub="Skip a day, keep your streak"
              price={120} owned={2} canAfford
            />
            <ShopCard
              icon={<Icon name="snow" size={26} color="var(--color-brand-blue)"/>}
              title="Triple freeze"
              sub="3 saves, bulk price"
              price={300} canAfford
            />
          </div>
        </div>

        {/* Heart refills */}
        <div style={{ padding: "18px 16px 0" }}>
          <div className="eyebrow mb-2">Heart refills</div>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            <ShopCard
              icon={<Icon name="heart" size={26} color="var(--color-bad)"/>}
              title="Refill hearts"
              sub="Fill all 5 instantly"
              price={50} canAfford
            />
            <ShopCard
              icon={<span style={{ position: "relative" }}>
                <Icon name="heart" size={26} color="var(--color-bad)"/>
                <Icon name="sparkle" size={14} color="#C28E1A" className="" />
              </span>}
              title="Unlimited 30 min"
              sub="Practice without limits"
              price={150} canAfford
            />
          </div>
        </div>

        {/* Cosmetics — treat avatars */}
        <div style={{ padding: "18px 16px 0" }}>
          <div className="eyebrow mb-2">Avatars · treat family</div>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            <CosmeticCard mascot="poffertjes" name="Poffertjes" price={200} equipped />
            <CosmeticCard mascot="oliebollen" name="Oliebollen" price={200} owned />
            <CosmeticCard mascot="tompouce"   name="Tompouce"   price={250} canAfford />
            <CosmeticCard mascot="kaas"       name="Kaas"       price={250} canAfford />
            <CosmeticCard mascot="kroket"     name="Kroket"     price={400} cantAfford />
            <CosmeticCard mascot="drop"       name="Drop"       price={400} cantAfford />
          </div>
        </div>

        {/* Power-ups */}
        <div style={{ padding: "18px 16px 0" }}>
          <div className="eyebrow mb-2">Power-ups</div>
          <div className="col gap-2">
            <PowerupRow icon="sparkle" title="XP boost · 15 min" sub="Earn 2× XP on next session" price={80}/>
            <PowerupRow icon="hint" title="3 hint reveals" sub="Use any time" price={40}/>
            <PowerupRow icon="refresh" title="Restart a lesson, no heart cost" sub="One-shot" price={60}/>
          </div>
        </div>

        <div className="row gap-2 mt-4 fz-11 muted center" style={{ padding: "16px 16px 0" }}>
          Need more? <span className="strong" style={{ marginLeft: 4, color: "var(--color-brand-orange-dark)" }}>Earn coins on the path.</span>
        </div>
      </div>
      <TabDock active="shop"/>
    </Phone>
  );
}

function ShopCard({ icon, title, sub, price, owned, canAfford = false, cantAfford = false }) {
  const dim = cantAfford;
  return (
    <div className="lk-card col" style={{
      width: "calc(50% - 4px)", padding: 12,
      opacity: dim ? 0.55 : 1, gap: 6,
    }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span style={{
          width: 40, height: 40, borderRadius: 12,
          background: "var(--surface-card-alt)",
          display: "grid", placeItems: "center",
        }}>{icon}</span>
        {owned !== undefined && <Badge>×{owned}</Badge>}
      </div>
      <div className="text-display fw-7 fz-14 mt-2">{title}</div>
      <div className="fz-11 soft">{sub}</div>
      <Button
        kind={dim ? "orange" : "orange"}
        size="sm" full
        disabled={cantAfford}
        ghost={cantAfford}
      >
        <Icon name="coin" size={13} color="white"/> {price}
      </Button>
    </div>
  );
}

function CosmeticCard({ mascot, name, price, equipped, owned, canAfford, cantAfford }) {
  return (
    <div className="lk-card col center" style={{
      width: "calc(33.333% - 6px)", padding: 8,
      gap: 4, opacity: cantAfford ? 0.55 : 1,
      borderColor: equipped ? "var(--color-brand-orange)" : "var(--line-soft)",
      boxShadow: equipped ? "0 4px 0 0 var(--color-brand-orange)" : undefined,
    }}>
      <Mascot kind={mascot} size={62}/>
      <span className="fz-11 fw-7 text-display">{name}</span>
      {equipped
        ? <span className="badge green" style={{ fontSize: 9 }}>Equipped</span>
        : owned
        ? <Button ghost size="sm" full style={{ padding: "4px 8px", fontSize: 11 }}>Equip</Button>
        : <span className="row gap-2 fz-11 fw-7" style={{ color: cantAfford ? "var(--text-muted)" : "var(--color-brand-orange-dark)" }}>
            <Icon name="coin" size={11} color={cantAfford ? "var(--text-muted)" : "#C28E1A"}/> {price}
          </span>
      }
    </div>
  );
}

function PowerupRow({ icon, title, sub, price }) {
  return (
    <div className="lk-card row gap-3" style={{ padding: 12 }}>
      <span style={{
        width: 40, height: 40, borderRadius: 12,
        background: "var(--color-brand-orange-soft)",
        color: "var(--color-brand-orange-dark)",
        display: "grid", placeItems: "center",
      }}>
        <Icon name={icon} size={20}/>
      </span>
      <div className="col grow">
        <span className="fz-14 fw-7">{title}</span>
        <span className="fz-12 soft">{sub}</span>
      </div>
      <Button kind="orange" size="sm">
        <Icon name="coin" size={13} color="white"/> {price}
      </Button>
    </div>
  );
}

// ============================================================
// SCREEN 11 — Profile (own)
// ============================================================
function ScreenProfile({ other = false }) {
  return (
    <Phone palette="live">
      <TopBar />
      <div className="scrolly with-dock">
        {/* identity hero */}
        <div style={{
          position: "relative",
          background: "linear-gradient(160deg, var(--color-brand-orange-soft), var(--color-brand-pink-soft))",
          padding: "16px 18px 18px",
        }}>
          <div className="row gap-3">
            <div style={{ position: "relative" }}>
              <Mascot kind="poffertjes" size={86}/>
              <span className="badge" style={{
                position: "absolute", bottom: -2, right: -6, fontSize: 10,
                background: "var(--color-brand-orange)", color: "white",
                borderColor: "var(--color-brand-orange-dark)",
              }}>Lv 7</span>
            </div>
            <div className="col grow">
              <div className="eyebrow">A2 · Learning Dutch</div>
              <h2 className="fz-22" style={{ lineHeight: 1.1 }}>{other ? "Marieke" : "Liesbeth"}</h2>
              <div className="fz-12 soft">Joined 14 March 2026 · 🇳🇱 Amsterdam</div>
            </div>
            {other ? (
              <Button kind="orange" size="sm">Add friend</Button>
            ) : (
              <button style={{
                background: "transparent", border: 0, color: "var(--text-soft)", cursor: "pointer",
              }}>
                <Icon name="settings" size={20}/>
              </button>
            )}
          </div>

          <div className="row gap-3 mt-4" style={{ flexWrap: "wrap" }}>
            <StatBlock icon="flame" label="Streak" value="12" color="streak"/>
            <StatBlock icon="zap" label="Total XP" value="4 280" color="orange"/>
            <StatBlock icon="trophy" label="League" value="Stroop." color="amber"/>
            <StatBlock icon="check" label="Lessons" value="64" color="good"/>
          </div>
        </div>

        {/* Activity heatmap */}
        <div style={{ padding: "18px 16px 0" }}>
          <div className="row" style={{ alignItems: "center" }}>
            <div className="eyebrow grow">Activity · last 12 weeks</div>
            <div className="row gap-2 fz-11 muted">
              <span>Less</span>
              <span style={{ display: "flex", gap: 2 }}>
                {[0,1,2,3,4].map(i => (
                  <span key={i} style={{
                    width: 10, height: 10, borderRadius: 3,
                    background: i === 0 ? "var(--line-soft)"
                              : `color-mix(in srgb, var(--color-brand-orange) ${20 + i*20}%, white)`,
                  }}/>
                ))}
              </span>
              <span>More</span>
            </div>
          </div>
          <Heatmap />
        </div>

        {/* Badges */}
        <div style={{ padding: "18px 16px 0" }}>
          <div className="eyebrow mb-2">Badges · 11 of 28</div>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            <BadgeTile icon="crown" name="Maand-monster" sub="30-day streak" earned />
            <BadgeTile icon="trophy" name="Stroop. league" sub="2nd weekly" earned />
            <BadgeTile icon="mic" name="Smooth talker" sub="3× perfect roleplay" earned />
            <BadgeTile icon="zap" name="Bliksem" sub="Earn 200 XP in a day" />
            <BadgeTile icon="target" name="Peer-shifter" sub="Win 5 peer drills" locked />
            <BadgeTile icon="book" name="Vocabulair" sub="500 words learned" locked />
          </div>
        </div>

        <div className="row gap-2 mt-5 px-4">
          {other && (
            <>
              <Button ghost full><Icon name="target" size={14}/> Send drill</Button>
              <Button kind="orange" full>Add friend</Button>
            </>
          )}
        </div>
      </div>
      <TabDock active="me"/>
    </Phone>
  );
}

function StatBlock({ icon, label, value, color }) {
  const c = color === "streak" ? "var(--color-streak)"
          : color === "orange" ? "var(--color-brand-orange-dark)"
          : color === "amber" ? "#7A4F00"
          : color === "good" ? "var(--color-good)"
          : "var(--text-strong)";
  const bg = color === "streak" ? "var(--color-brand-orange-soft)"
          : color === "orange" ? "var(--color-brand-orange-soft)"
          : color === "amber" ? "#FEF3C7"
          : color === "good" ? "var(--color-good-soft)"
          : "var(--surface-card)";
  return (
    <div style={{
      flex: "1 1 calc(50% - 6px)", minWidth: 130,
      background: bg, borderRadius: 14, padding: 10,
      border: "1px solid color-mix(in srgb, " + c + " 25%, transparent)",
    }}>
      <div className="row gap-2">
        <Icon name={icon} size={14} color={c}/>
        <span className="fz-11" style={{ color: c, fontWeight: 600 }}>{label}</span>
      </div>
      <div className="text-display fw-7 fz-22 mt-1" style={{ color: c }}>{value}</div>
    </div>
  );
}

function Heatmap() {
  const weeks = 12;
  const rng = (x) => Math.abs(Math.sin(x * 17.31)) * 4.999;
  return (
    <div className="lk-card mt-3" style={{ padding: 12, overflow: "hidden" }}>
      <div style={{
        display: "grid", gridTemplateRows: "repeat(7, 12px)",
        gridAutoFlow: "column", gridAutoColumns: "12px",
        gap: 3,
      }}>
        {Array.from({ length: weeks * 7 }).map((_, i) => {
          const lvl = Math.floor(rng(i));
          const recent = i > weeks * 7 - 25 ? Math.min(4, lvl + 1) : lvl;
          return (
            <span key={i} style={{
              width: 12, height: 12, borderRadius: 3,
              background: recent === 0 ? "var(--line-soft)"
                : `color-mix(in srgb, var(--color-brand-orange) ${20 + recent*20}%, white)`,
            }}/>
          );
        })}
      </div>
      <div className="row gap-2 mt-2 fz-11 muted">
        <span>maa</span><span>apr</span><span>mei</span>
      </div>
    </div>
  );
}

function BadgeTile({ icon, name, sub, earned, locked }) {
  return (
    <div className="lk-card col center" style={{
      width: "calc(33.333% - 6px)", padding: 10, gap: 4,
      opacity: locked ? 0.55 : 1,
      borderColor: earned ? "var(--color-brand-orange)" : "var(--line-soft)",
      boxShadow: earned ? "0 3px 0 0 var(--color-brand-orange)" : "0 1px 0 0 rgba(0,0,0,.03)",
    }}>
      <span style={{
        width: 44, height: 44, borderRadius: "50%",
        background: earned
          ? "linear-gradient(180deg, #FFB85C, #FF6B1A)"
          : "var(--surface-card-alt)",
        color: earned ? "white" : "var(--text-muted)",
        display: "grid", placeItems: "center",
        boxShadow: earned ? "0 2px 0 0 var(--color-brand-orange-dark)" : undefined,
      }}>
        {locked ? <Icon name="lock" size={18}/> : <Icon name={icon} size={20} color={earned ? "white" : "currentColor"}/>}
      </span>
      <span className="fz-11 fw-7 text-display center" style={{ textAlign: "center" }}>{name}</span>
      <span className="fz-11 muted center" style={{ textAlign: "center" }}>{sub}</span>
    </div>
  );
}

// ============================================================
// SCREEN 14 — Settings
// ============================================================
function ScreenSettings({ dark = false }) {
  return (
    <Phone palette="live" dark={dark}>
      <div className="row gap-2" style={{ padding: "12px 16px 0" }}>
        <button style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--text-soft)" }}>
          <Icon name="arrowL" size={22}/>
        </button>
        <span className="text-display fw-7 fz-18 grow center">Settings</span>
        <span style={{ width: 22 }}/>
      </div>

      <div className="scrolly" style={{ padding: "8px 16px 28px" }}>
        <Group title="Account">
          <Row label="Display name" value="Liesbeth"/>
          <Row label="Email" value="liesbeth@example.com"/>
          <Row label="Manage subscription" value="Free" />
        </Group>

        <Group title="Learning">
          <Row label="Level" value="A2 · Some Dutch" />
          <Row label="Daily goal">
            <div className="row gap-2 mt-2">
              {["Casual · 10 XP","Regular · 20 XP","Serious · 50 XP","Intense · 100 XP"].map((t, i) => (
                <span key={t} style={{
                  flex: 1, padding: "8px 6px", borderRadius: 12,
                  border: "1.5px solid " + (i === 1 ? "var(--color-brand-orange)" : "var(--line-soft)"),
                  background: i === 1 ? "var(--color-brand-orange-soft)" : "var(--surface-card)",
                  color: i === 1 ? "var(--color-brand-orange-dark)" : "var(--text-soft)",
                  fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11,
                  textAlign: "center",
                  boxShadow: i === 1 ? "0 3px 0 0 var(--color-brand-orange)" : "none",
                }}>{t}</span>
              ))}
            </div>
          </Row>
          <ToggleRow label="Slow-replay by default in listening drills" on={false}/>
        </Group>

        <Group title="Notifications">
          <ToggleRow label="Daily reminder" on />
          <Row label="Reminder time" value="20:30"/>
          <ToggleRow label="Friend & peer-drill pings" on />
          <ToggleRow label="Streak alerts" on />
          <ToggleRow label="Email digest" on={false} />
        </Group>

        <Group title="Sound & haptics">
          <ToggleRow label="Sound effects" on />
          <ToggleRow label="Mascot voice" on />
          <ToggleRow label="Haptic feedback" on />
        </Group>

        <Group title="Appearance">
          <Row label="Theme">
            <div className="row gap-2 mt-2">
              {[{l:"Light", v:"light"},{l:"Dark", v:"dark"},{l:"System", v:"system"}].map((t, i) => (
                <span key={t.v} style={{
                  flex: 1, padding: "10px 8px", borderRadius: 12,
                  border: "1.5px solid " + ((dark && t.v==="dark") || (!dark && t.v==="light") ? "var(--color-brand-orange)" : "var(--line-soft)"),
                  background: (dark && t.v==="dark") || (!dark && t.v==="light")
                    ? "var(--color-brand-orange-soft)" : "var(--surface-card)",
                  color: (dark && t.v==="dark") || (!dark && t.v==="light")
                    ? "var(--color-brand-orange-dark)" : "var(--text-soft)",
                  fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 12,
                  textAlign: "center",
                }}>{t.l}</span>
              ))}
            </div>
          </Row>
        </Group>

        <Group title="Privacy">
          <Row label="Show me on leaderboard" value="Friends only"/>
          <Row label="Allow peer drills from" value="Friends"/>
          <Row label="Data & export" value=">"/>
        </Group>

        <Group title="Danger zone">
          <button style={{
            width: "100%", background: "transparent",
            border: "1.5px solid var(--color-bad)", color: "var(--color-bad)",
            padding: "12px", borderRadius: 14,
            fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14,
            cursor: "pointer",
          }}>Sign out</button>
        </Group>

        <div className="fz-11 muted center mt-4" style={{ textAlign: "center" }}>
          Lekkertaal v0.4.2 · Made with ☕ in NL
        </div>
      </div>

      {/* saved toast */}
      <div style={{
        position: "absolute", left: "50%", bottom: 26, transform: "translateX(-50%)",
        padding: "8px 14px", borderRadius: 999,
        background: "var(--color-good)", color: "white",
        fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13,
        boxShadow: "0 6px 18px -6px rgba(0,0,0,.3)",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <Icon name="check" size={14} color="white"/> Opgeslagen
      </div>
    </Phone>
  );
}

function Group({ title, children }) {
  return (
    <div className="mt-4">
      <div className="eyebrow mb-2">{title}</div>
      <div className="lk-card" style={{ padding: 0, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, children }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line-soft)" }}>
      <div className="row">
        <span className="fz-13 fw-7 grow">{label}</span>
        {value && <span className="fz-13 soft">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, on }) {
  return (
    <div className="row" style={{ padding: "14px 16px", borderBottom: "1px solid var(--line-soft)" }}>
      <span className="fz-13 fw-7 grow">{label}</span>
      <span style={{
        width: 44, height: 26, borderRadius: 999,
        background: on ? "var(--color-good)" : "var(--line-strong)",
        position: "relative", flex: "none",
      }}>
        <span style={{
          position: "absolute", top: 3, left: on ? 21 : 3,
          width: 20, height: 20, borderRadius: "50%", background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,.2)",
        }}/>
      </span>
    </div>
  );
}

Object.assign(window, {
  ScreenShop, ScreenProfile, ScreenSettings,
  ShopCard, CosmeticCard, PowerupRow, StatBlock, Heatmap, BadgeTile,
  Group, Row, ToggleRow,
});
