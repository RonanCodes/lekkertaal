/* global React, LK, Phone, TopBar, TabDock, StatusStrip, Button, Card, Chip, Badge, Mascot, Icon, Progress, TREATS */

// ============================================================
// SCREEN 9 — Leaderboard (weekly league)
// Original treatment: each league is a "wafel tier" with promotion
// and demotion bands cleanly marked; user row is pinned + glows.
// ============================================================
function ScreenLeaderboard({ tab = "league" }) {
  const rows = [
    { rank: 1, name: "Marieke",  xp: 1820, move: "up",   you: false, mascot: "oliebollen" },
    { rank: 2, name: "Sander",   xp: 1640, move: "same", you: false, mascot: "frikandel" },
    { rank: 3, name: "Diede",    xp: 1390, move: "up",   you: false, mascot: "tompouce" },
    { rank: 4, name: "Aafke",    xp: 1210, move: "down", you: false, mascot: "drop" },
    { rank: 5, name: "Jij",      xp: 1180, move: "up",   you: true,  mascot: "stroop" },
    { rank: 6, name: "Pieter",   xp: 990,  move: "down", you: false, mascot: "kaas" },
    { rank: 7, name: "Saskia",   xp: 880,  move: "up",   you: false, mascot: "poffertjes" },
  ];
  return (
    <Phone palette="live">
      <TopBar />
      <StatusStrip streak={12} freezes={2} coins={320} xp={60} level={7} hearts={4}/>
      <div className="scrolly with-dock" style={{ background: "var(--surface-page)" }}>
        {/* tabs */}
        <div className="row gap-2" style={{ padding: "12px 16px 0" }}>
          <TabPill active={tab === "league"}>League</TabPill>
          <TabPill active={tab === "friends"}>Friends</TabPill>
          <span className="grow"/>
          <span className="fz-11 muted center">Resets in 2d 14h</span>
        </div>

        {/* league header */}
        <div style={{ padding: "12px 16px 0" }}>
          <div className="lk-card row gap-3" style={{
            background: "linear-gradient(160deg, var(--color-brand-orange-soft), #FFD9E4)",
            borderColor: "transparent",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: "linear-gradient(180deg, #FFB85C, #FF6B1A)",
              display: "grid", placeItems: "center",
              boxShadow: "0 4px 0 0 var(--color-brand-orange-dark)",
            }}>
              <Icon name="crown" size={32} color="white"/>
            </div>
            <div className="col grow">
              <div className="eyebrow" style={{ color: "var(--color-brand-orange-dark)" }}>This week</div>
              <h2 className="fz-22">Stroopwafel league</h2>
              <div className="fz-12 soft">Top 3 promote to <span className="strong">Kaas league</span>.</div>
            </div>
          </div>
        </div>

        {/* board */}
        <div style={{ padding: "16px 16px 0" }}>
          <div className="col gap-1">
            {rows.map((r, i) => {
              const promotion = i < 3;
              const demotion = i >= rows.length - 1; // last row → demotion zone
              return (
                <React.Fragment key={r.rank}>
                  <LbRow {...r} />
                  {i === 2 && <Divider label="Promotion zone" color="good" />}
                  {i === rows.length - 2 && <Divider label="Demotion zone" color="bad" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="fz-11 muted center" style={{ padding: "16px 0 8px" }}>
          XP this week resets Sunday at 23:59
        </div>
      </div>
      <TabDock active="lb"/>
    </Phone>
  );
}

function TabPill({ children, active }) {
  return (
    <span style={{
      padding: "8px 14px", borderRadius: 999,
      background: active ? "var(--color-brand-orange-soft)" : "transparent",
      color: active ? "var(--color-brand-orange-dark)" : "var(--text-muted)",
      fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13,
      border: active ? "1.5px solid color-mix(in srgb, var(--color-brand-orange) 25%, transparent)" : "1.5px solid var(--line-soft)",
      cursor: "pointer",
    }}>{children}</span>
  );
}

function Divider({ label, color }) {
  const c = color === "good" ? "var(--color-good)" : "var(--color-bad)";
  return (
    <div className="row gap-2 mt-2 mb-2" style={{ alignItems: "center" }}>
      <span style={{ flex: 1, height: 1, borderTop: "1.5px dashed " + c, opacity: 0.5 }}/>
      <span className="text-display fw-7 fz-11" style={{ color: c }}>{label}</span>
      <span style={{ flex: 1, height: 1, borderTop: "1.5px dashed " + c, opacity: 0.5 }}/>
    </div>
  );
}

function LbRow({ rank, name, xp, move, you, mascot }) {
  return (
    <div className="row gap-3 lk-card" style={{
      padding: 10,
      background: you ? "linear-gradient(135deg, var(--color-brand-orange-soft), var(--color-brand-pink-soft))" : "var(--surface-card)",
      borderColor: you ? "var(--color-brand-orange)" : "var(--line-soft)",
      boxShadow: you ? "0 4px 0 0 var(--color-brand-orange)" : "0 1px 0 0 rgba(0,0,0,.03)",
    }}>
      <span className="text-display fw-7 fz-15" style={{
        width: 28, textAlign: "center",
        color: rank <= 3 ? "var(--color-brand-orange-dark)" : "var(--text-muted)"
      }}>{rank}</span>
      <Mascot kind={mascot} size={36}/>
      <div className="col grow">
        <span className="fz-14 fw-7">{name}{you && <span className="fz-11 muted" style={{ marginLeft: 4 }}>(you)</span>}</span>
        <div className="row gap-2">
          {rank === 1 && <Badge><Icon name="crown" size={10}/> leader</Badge>}
          <span className="fz-11 muted">{xp} XP</span>
        </div>
      </div>
      <span style={{
        display: "inline-grid", placeItems: "center", width: 22, height: 22, borderRadius: 8,
        background: move === "up" ? "var(--color-good-soft)" : move === "down" ? "var(--color-bad-soft)" : "transparent",
        color: move === "up" ? "var(--color-good)" : move === "down" ? "var(--color-bad)" : "var(--text-muted)",
      }}>
        {move === "up" ? <Icon name="arrowUp" size={14}/>
         : move === "down" ? <Icon name="arrowDown" size={14}/>
         : <span style={{ width: 8, height: 1.5, background: "currentColor" }}/>}
      </span>
    </div>
  );
}

// ============================================================
// SCREEN 12 — Friends & peer-drills
// ============================================================
function ScreenFriends() {
  return (
    <Phone palette="live">
      <TopBar />
      <div className="scrolly with-dock">
        <div style={{ padding: "12px 16px 0" }}>
          <div className="row gap-2">
            <div style={{
              flex: 1, background: "var(--surface-card)",
              border: "1.5px solid var(--line-soft)", borderRadius: 12,
              padding: "10px 12px", display: "flex", alignItems: "center", gap: 8,
            }}>
              <Icon name="search" size={16} color="var(--text-muted)"/>
              <span className="fz-13" style={{ color: "var(--text-muted)" }}>Search learners…</span>
            </div>
            <Button kind="orange" size="sm"><Icon name="plus" size={14} color="white"/></Button>
          </div>
        </div>

        {/* Peer drills inbox */}
        <div style={{ padding: "18px 16px 0" }}>
          <div className="eyebrow mb-2">Peer drills · 2 new</div>
          <div className="col gap-2">
            <PeerDrillCard from="Marieke" mascot="oliebollen" title="20-word vocab dash" desc="She built this from Unit 3 vocab." time="2u" status="new" />
            <PeerDrillCard from="Sander" mascot="frikandel" title="Word-order challenge" desc="6 sentences, no hints." time="1d" status="new" />
            <PeerDrillCard from="Aafke" mascot="drop" title="Listening spell, hard" desc="You played · 8/10" time="3d" status="done" />
          </div>
        </div>

        {/* Incoming requests */}
        <div style={{ padding: "18px 16px 0" }}>
          <div className="eyebrow mb-2">Requests</div>
          <div className="col gap-2">
            <FriendRow name="Diede" sub="Found you via leaderboard" mascot="tompouce" actions="request" />
            <FriendRow name="Pieter" sub="Mutual: Sander" mascot="kaas" actions="request" />
          </div>
        </div>

        {/* Friends */}
        <div style={{ padding: "18px 16px 0" }}>
          <div className="eyebrow mb-2">Friends · 14</div>
          <div className="col gap-2">
            <FriendRow name="Marieke" sub="🔥 23 day streak · A2" mascot="oliebollen" actions="friend" />
            <FriendRow name="Sander" sub="🔥 9 day streak · B1" mascot="frikandel" actions="friend" />
            <FriendRow name="Saskia" sub="🔥 12 day streak · A2" mascot="poffertjes" actions="friend" />
          </div>
        </div>

        <div className="row gap-2 mt-5 px-4 fz-12 muted center">
          <span>Invite a friend & both earn 50 coins.</span>
        </div>
      </div>
      <TabDock />
    </Phone>
  );
}

function PeerDrillCard({ from, mascot, title, desc, time, status }) {
  const isNew = status === "new";
  return (
    <div className="lk-card row gap-3" style={{
      padding: 12,
      background: isNew ? "var(--surface-banner-blue)" : "var(--surface-card)",
      borderColor: isNew ? "color-mix(in srgb, var(--color-brand-blue) 30%, transparent)" : "var(--line-soft)",
    }}>
      <Mascot kind={mascot} size={48} />
      <div className="col grow">
        <div className="row gap-2">
          <span className="fz-13 fw-7">{from} sent you a drill</span>
          {isNew && <Badge kind="blue">new</Badge>}
        </div>
        <div className="text-display fw-7 fz-15 mt-1">{title}</div>
        <div className="fz-12 soft">{desc}</div>
        <div className="fz-11 muted mt-1">{time} ago</div>
      </div>
      {isNew
        ? <Button kind="blue" size="sm">Play</Button>
        : <span className="badge green">Done</span>
      }
    </div>
  );
}

function FriendRow({ name, sub, mascot, actions }) {
  return (
    <div className="lk-card row gap-3" style={{ padding: 10 }}>
      <Mascot kind={mascot} size={42}/>
      <div className="col grow">
        <span className="fz-14 fw-7">{name}</span>
        <span className="fz-12 soft">{sub}</span>
      </div>
      {actions === "request" && (
        <div className="row gap-2">
          <button style={{
            background: "transparent", border: "1.5px solid var(--line-strong)",
            color: "var(--text-soft)", padding: "6px 10px", borderRadius: 999,
            fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12, cursor: "pointer",
          }}>Decline</button>
          <Button kind="orange" size="sm">Accept</Button>
        </div>
      )}
      {actions === "friend" && (
        <Button ghost size="sm"><Icon name="target" size={14}/> Send drill</Button>
      )}
    </div>
  );
}

// ============================================================
// SCREEN 13 — Notifications sheet (slide-over)
// ============================================================
function ScreenNotifications() {
  return (
    <Phone palette="live">
      {/* dim layer */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(26,20,16,0.55)",
        backdropFilter: "blur(2px)",
      }}/>
      {/* peek of the page underneath */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.3, pointerEvents: "none" }}>
        <TopBar />
        <StatusStrip streak={12} freezes={2} coins={320} xp={60} level={7} hearts={4}/>
      </div>

      {/* the sheet */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        background: "var(--surface-page)",
        borderTopLeftRadius: 32, borderTopRightRadius: 32,
        boxShadow: "0 -10px 30px -5px rgba(0,0,0,.25)",
        height: "78%", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <div className="center" style={{ paddingTop: 8 }}>
          <span style={{ width: 38, height: 5, background: "var(--line-strong)", borderRadius: 999 }}/>
        </div>
        <div className="row" style={{ padding: "8px 18px 12px", alignItems: "center" }}>
          <h3 className="fz-18 fw-7">Notifications</h3>
          <span className="grow"/>
          <button className="fz-12 fw-7" style={{ background: "transparent", border: 0, color: "var(--color-brand-orange-dark)", cursor: "pointer" }}>
            Mark all read
          </button>
        </div>
        <div className="scrolly" style={{ padding: "0 18px 24px" }}>
          <div className="eyebrow mt-2 mb-2">Today</div>
          <NotifRow icon="flame"   color="orange" unread title="Don't break your streak" body="Day 12 — Stroop's counting on you." time="3u" />
          <NotifRow icon="target"  color="blue"   unread title="Peer drill from Marieke" body="20-word vocab dash · tap to play" time="6u" mascot="oliebollen" />
          <div className="eyebrow mt-4 mb-2">Yesterday</div>
          <NotifRow icon="crown"   color="amber"  title="Badge unlocked — Maand-monster" body="30 days in a row." time="1d" />
          <NotifRow icon="trophy"  color="blue"   title="Promoted to Stroopwafel league" body="You finished 2nd. Lekker." time="2d" />
          <NotifRow icon="user"    color="orange" title="Diede sent a friend request" body="You met on the leaderboard." time="3d" />
          <NotifRow icon="sparkle" color="pink"   title="New cosmetic in shop" body="Drop & Tompouce avatars are back." time="4d" />
        </div>
      </div>
    </Phone>
  );
}

function NotifRow({ icon, color, unread, title, body, time, mascot }) {
  const bg = color === "orange" ? "var(--color-brand-orange-soft)"
           : color === "blue"   ? "var(--color-brand-blue-soft)"
           : color === "amber"  ? "#FEF3C7"
           : color === "pink"   ? "var(--color-brand-pink-soft)"
           : "var(--surface-card-alt)";
  const fg = color === "orange" ? "var(--color-brand-orange-dark)"
           : color === "blue"   ? "var(--color-brand-blue-dark)"
           : color === "amber"  ? "#7A4F00"
           : color === "pink"   ? "#B83A6E"
           : "var(--text-soft)";
  return (
    <div className="row gap-3 py-3" style={{ alignItems: "flex-start", borderBottom: "1px solid var(--line-soft)" }}>
      {mascot
        ? <Mascot kind={mascot} size={36} style={{ flex: "none" }}/>
        : <span style={{
            width: 36, height: 36, borderRadius: 12, flex: "none",
            background: bg, color: fg, display: "grid", placeItems: "center",
          }}><Icon name={icon} size={18} /></span>
      }
      <div className="col grow">
        <div className="row gap-2">
          <span className={"fz-13 " + (unread ? "fw-7" : "")}>{title}</span>
          {unread && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-brand-orange)" }}/>}
        </div>
        <div className="fz-12 soft mt-1">{body}</div>
      </div>
      <span className="fz-11 muted" style={{ flex: "none" }}>{time}</span>
    </div>
  );
}

Object.assign(window, {
  ScreenLeaderboard, ScreenFriends, ScreenNotifications,
  TabPill, Divider, LbRow, PeerDrillCard, FriendRow, NotifRow,
});
