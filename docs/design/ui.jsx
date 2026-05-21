/* global React */
// ──────────────────────────────────────────────────────────
// Lekkertaal UI primitives + phone shell + Stroop mascot.
// All components live on `window.LK.*`.
// ──────────────────────────────────────────────────────────

const LK = {};

// ── Icons ────────────────────────────────────────────────
function Icon({ name, size = 18, className = "", color = "currentColor", strokeWidth = 2 }) {
  const s = size;
  const common = {
    width: s, height: s, viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round",
    className: "icon " + className,
  };
  const paths = {
    flame: <path d="M12 3c2 3 5 5 5 9a5 5 0 1 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 1-8z" />,
    coin: <><circle cx="12" cy="12" r="9" /><text x="12" y="16" textAnchor="middle" fontSize="10" stroke="none" fill={color} fontWeight="700">¢</text></>,
    bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16z" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
    zap: <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7z" />,
    map: <><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" /><path d="M9 3v15M15 6v15" /></>,
    trophy: <><path d="M7 4h10v4a5 5 0 0 1-10 0V4z" /><path d="M3 5h4v3a3 3 0 0 1-3 3M21 5h-4v3a3 3 0 0 0 3 3" /><path d="M10 14h4v3h-4z" /><path d="M8 21h8" /></>,
    shop: <><path d="M3 8l1-4h16l1 4M4 8h16v12H4zM9 12h6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" /></>,
    check: <path d="M5 12l5 5L20 7" />,
    x: <path d="M6 6l12 12M18 6L6 18" />,
    heart: <path d="M12 21s-7-4.35-9.5-9C1 8 3 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 4 0 6 4 4.5 8C19 16.65 12 21 12 21z" />,
    snow: <><path d="M12 3v18M3 12h18M5.5 5.5l13 13M18.5 5.5l-13 13" /><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9L3 12l3 3M18 9l3 3-3 3" /></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 1 1 8 0v3" /></>,
    play: <path d="M6 4l14 8-14 8z" fill={color} stroke="none" />,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    pause: <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill={color} stroke="none" /></>,
    sparkle: <path d="M12 3l1.6 4.6L18 9.2 13.6 11 12 15.6 10.4 11 6 9.2l4.4-1.6L12 3zm6 10l.9 2.6L21.5 16l-2.6.9L18 19.5l-.9-2.6L14.5 16l2.6-.9L18 13z" fill={color} stroke="none" />,
    arrowR: <path d="M5 12h14M13 6l6 6-6 6" />,
    arrowL: <path d="M19 12H5M11 6l-6 6 6 6" />,
    speaker: <><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M17 8a5 5 0 0 1 0 8M19 5a8 8 0 0 1 0 14" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 16.9l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
    swap: <path d="M7 7h12M16 4l3 3-3 3M17 17H5M8 14l-3 3 3 3" />,
    star: <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9L12 3z" />,
    crown: <path d="M3 19h18M4 8l4 4 4-7 4 7 4-4-1 11H5L4 8z" />,
    hint: <><circle cx="12" cy="12" r="9" /><path d="M12 17v.01M10 9a2 2 0 1 1 3 1.7c-.7.4-1 1-1 1.8" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
    arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
    ellipsis: <><circle cx="6" cy="12" r="1.4" fill={color} stroke="none" /><circle cx="12" cy="12" r="1.4" fill={color} stroke="none" /><circle cx="18" cy="12" r="1.4" fill={color} stroke="none" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5" /></>,
    book: <><path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5z" /><path d="M4 17h14" /></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
}

// ── Button ───────────────────────────────────────────────
function Button({ children, kind = "orange", size = "md", full = false, ghost = false, disabled, onClick, style, className = "" }) {
  const cls = [
    "btn3d",
    ghost ? "ghost" : (kind === "blue" || kind === "green" || kind === "red" ? kind : ""),
    size === "lg" ? "lg" : size === "sm" ? "sm" : "",
    full ? "full" : "",
    className,
  ].filter(Boolean).join(" ");
  return <button className={cls} disabled={disabled} onClick={onClick} style={style}>{children}</button>;
}

// ── Card ─────────────────────────────────────────────────
function Card({ children, className = "", style, tinted = false, flat = false }) {
  return <div className={`lk-card ${tinted ? "tinted" : ""} ${flat ? "flat" : ""} ${className}`} style={style}>{children}</div>;
}

// ── Chip ─────────────────────────────────────────────────
function Chip({ children, kind = "orange" }) {
  return <span className={"lk-chip " + (kind !== "orange" ? kind : "")}>{children}</span>;
}

// ── Badge ────────────────────────────────────────────────
function Badge({ children, kind = "orange" }) {
  return <span className={"badge " + (kind !== "orange" ? kind : "")}>{children}</span>;
}

// ── Progress ─────────────────────────────────────────────
function Progress({ value = 0, color = "green" }) {
  return (
    <div className={`lk-progress ${color === "orange" ? "orange" : ""}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

// ── Hearts row ───────────────────────────────────────────
function Hearts({ count = 5, max = 5 }) {
  return (
    <span className="row gap-2" aria-label={`${count} hearts`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={"lk-heart " + (i < count ? "" : "empty")} />
      ))}
    </span>
  );
}

// ── Stroop mascot ────────────────────────────────────────
// kind: 'stroop' (the round waffle) or any of the treats
// mood: 'idle' | 'happy' | 'surprised'
const TREATS = ["kroket","bitterballen","oliebollen","drop","poffertjes","frikandel","tompouce","kaas"];
function Mascot({ kind = "stroop", mood = "idle", size = 96, className = "", style }) {
  let src;
  if (kind === "stroop") src = "public/mascot/stroop-512.png";
  else src = `public/mascot/treats/${kind}/${mood}.png`;
  const animClass = mood === "happy" ? "anim-happy-bounce"
                  : mood === "surprised" ? "anim-surprised-pop"
                  : "anim-idle-bob";
  return (
    <span className={`mascot ${animClass} ${className}`} style={{ width: size, height: size, ...style }}>
      <img src={src} alt={`${kind} ${mood}`} draggable={false} />
    </span>
  );
}

// ── Status strip (the persistent top bar in app) ─────────
function StatusStrip({ streak = 12, freezes = 2, coins = 320, xp = 60, level = 7, hearts = 4 }) {
  return (
    <div className="lk-topstrip">
      <span className="lk-chip">
        <Icon name="flame" size={14} color="#D54E00" /> {streak}
        {freezes > 0 && (
          <span className="badge blue" style={{ marginLeft: 2 }}>
            <Icon name="snow" size={11} /> {freezes}
          </span>
        )}
      </span>
      <span className="lk-chip blue">
        <Icon name="zap" size={14} color="#0E4F87" /> Lv {level}
      </span>
      <span className="lk-chip amber">
        <Icon name="coin" size={14} color="#7A4F00" /> {coins}
      </span>
      <span className="grow" />
      <span className="row gap-2" style={{ marginRight: 4 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={"lk-heart " + (i < hearts ? "" : "empty")} style={{ width: 16, height: 16 }} />
        ))}
      </span>
    </div>
  );
}

// ── Phone shell ──────────────────────────────────────────
// time = clock text. children fill the screen.
function Phone({ children, time = "9:41", dark = false, palette = "live", className = "" }) {
  const cls = `phone palette-${palette} ${dark ? "scheme-dark" : ""} ${className}`;
  return (
    <div className={cls}>
      <div className="phone-notch" />
      <div className="phone-inner">
        <div className="phone-statusbar">
          <span>{time}</span>
          <span className="right">
            {/* signal + wifi + battery glyphs */}
            <svg width="18" height="10" viewBox="0 0 18 10"><g fill="currentColor"><rect x="0" y="6" width="3" height="4" rx="1"/><rect x="5" y="4" width="3" height="6" rx="1"/><rect x="10" y="2" width="3" height="8" rx="1"/><rect x="15" y="0" width="3" height="10" rx="1"/></g></svg>
            <svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 11l2-2a2.8 2.8 0 0 0-4 0l2 2zM4 7l1.5-1.5a5 5 0 0 1 5 0L12 7l-1.5 1.5a5 5 0 0 0-5 0L4 7zM0 3l2-2a8 8 0 0 1 12 0l2 2-2 2a8 8 0 0 0-12 0L0 3z" fill="currentColor"/></svg>
            <svg width="26" height="11" viewBox="0 0 26 11"><rect x="0.5" y="0.5" width="22" height="10" rx="2.5" fill="none" stroke="currentColor"/><rect x="2" y="2" width="16" height="7" rx="1" fill="currentColor"/><rect x="23" y="3.5" width="2" height="4" rx="1" fill="currentColor"/></svg>
          </span>
        </div>
        {children}
        <div className="phone-home" />
      </div>
    </div>
  );
}

// ── Bottom tab dock (Path / Leaderboard / Shop / Profile) ──
function TabDock({ active = "path" }) {
  const tabs = [
    { id: "path", icon: "map", label: "Path" },
    { id: "lb",   icon: "trophy", label: "League" },
    { id: "shop", icon: "shop", label: "Shop" },
    { id: "me",   icon: "user", label: "Me" },
  ];
  return (
    <nav className="lk-tabbar">
      {tabs.map(t => (
        <button key={t.id} className={active === t.id ? "active" : ""}>
          <Icon name={t.icon} size={20} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ── Top app row (the row above StatusStrip with logo & bell) ──
function TopBar({ title = "Lekkertaal", showBell = true, right = null }) {
  return (
    <div className="row" style={{
      padding: "12px 18px 0", justifyContent: "space-between"
    }}>
      <span className="text-display fw-7 fz-18" style={{ color: "var(--color-brand-orange-dark)" }}>
        {title}
      </span>
      <span className="row gap-2">
        {right}
        {showBell && (
          <button aria-label="Notifications" style={{ background: "none", border: 0, color: "var(--text-soft)", position: "relative", padding: 4, cursor: "pointer" }}>
            <Icon name="bell" size={20} />
            <span style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, background: "var(--color-bad)", border: "2px solid var(--surface-app)", borderRadius: "50%" }} />
          </button>
        )}
      </span>
    </div>
  );
}

// ── Sectioned heading ────────────────────────────────────
function H({ children, eyebrow, style }) {
  return (
    <div style={style}>
      {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
      <h2 className="fz-22 fw-7">{children}</h2>
    </div>
  );
}

// ── Confetti (rains little waffles) ──────────────────────
function Confetti({ count = 28 }) {
  const items = React.useMemo(() => Array.from({ length: count }).map((_, i) => {
    const left = Math.random() * 100;
    const delay = -Math.random() * 3;
    const dur = 2.8 + Math.random() * 1.6;
    const size = 12 + Math.random() * 12;
    const colors = ["var(--color-brand-orange)", "var(--color-brand-blue)", "var(--color-brand-pink)", "var(--color-good)"];
    const c = colors[i % colors.length];
    return { left, delay, dur, size, c };
  }), [count]);
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {items.map((p, i) => (
        <span key={i} className="waffle" style={{
          left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
          width: p.size, height: p.size, background: p.c
        }} />
      ))}
    </div>
  );
}

// expose
Object.assign(LK, {
  Icon, Button, Card, Chip, Badge, Progress, Hearts,
  Mascot, StatusStrip, Phone, TabDock, TopBar, H, Confetti, TREATS,
});
Object.assign(window, { LK, ...LK });
