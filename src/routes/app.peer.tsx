/**
 * /app/peer — peer drills inbox + send.
 *
 * Two sections:
 *   1. "Send a sentence" — pick a friend, type a Dutch sentence (and optional
 *      hint), POST to /api/peer-drills/send.
 *   2. "Inbox" — pending drills addressed to me, with an inline answer field
 *      that POSTs to /api/peer-drills/:id/submit.
 *
 * Uses Route loader to fetch initial inbox + friends; client-side state takes
 * over after sends/submits to give an immediate response without a full nav.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { db } from "../db/client";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { ensureUserRow } from "../lib/server/ensure-user-row";
import { listFriends } from "../lib/server/friends";
import { listInbox  } from "../lib/server/peer-drills";
import type {InboxEntry} from "../lib/server/peer-drills";
import { AppShell } from "../components/AppShell";
import { Button } from "@/components/ui/button";

const loadPeer = createServerFn({ method: "GET" }).handler(async () => {
  const clerkId = await requireUserClerkId();
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  // ensureUserRow guarantees a row exists; subsequent lookups can trust it.
  const me = [await ensureUserRow(clerkId, drz, env)];
  const userId = me[0].id;
  const [friends, drills] = await Promise.all([
    listFriends(drz, userId),
    listInbox(drz, userId),
  ]);
  return {
    user: {
      displayName: me[0].displayName,
      xpTotal: me[0].xpTotal,
      coinsBalance: me[0].coinsBalance,
      streakDays: me[0].streakDays,
      streakFreezesBalance: me[0].streakFreezesBalance,
    },
    friends: friends.map((f) => ({ userId: f.userId, displayName: f.displayName })),
    drills,
  };
});

export const Route = createFileRoute("/app/peer")({
  loader: async () => await loadPeer(),
  component: PeerPage,
});

function PeerPage() {
  const data = Route.useLoaderData();
  const [drills, setDrills] = useState<InboxEntry[]>(data.drills);
  const [toUserId, setToUserId] = useState<number | null>(
    data.friends[0]?.userId ?? null,
  );
  const [prompt, setPrompt] = useState("");
  const [hint, setHint] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  async function onAddLearner(e: React.FormEvent) {
    e.preventDefault();
    const name = search.trim();
    if (!name) return;
    setSearchBusy(true);
    setSearchStatus(null);
    try {
      const r = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ addresseeUsername: name }),
      });
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      if (r.ok) {
        setSearchStatus(`Friend request sent to ${name}.`);
        setSearch("");
      } else if (body.error === "user_not_found") {
        setSearchStatus(`No learner named "${name}".`);
      } else if (body.error === "already_friends") {
        setSearchStatus(`You're already friends with ${name}.`);
      } else if (body.error === "self_friend") {
        setSearchStatus("That's you!");
      } else {
        setSearchStatus("Sorry, that didn't work.");
      }
    } finally {
      setSearchBusy(false);
    }
  }

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (toUserId === null || !prompt.trim()) return;
    setSending(true);
    setSendStatus(null);
    try {
      const r = await fetch("/api/peer-drills/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          toUserId,
          prompt: prompt.trim(),
          expectedAnswerHint: hint.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        setSendStatus(`Sorry, ${body.error ?? "send failed"}`);
        return;
      }
      setPrompt("");
      setHint("");
      setSendStatus("Sent.");
    } finally {
      setSending(false);
    }
  }

  async function onSubmit(drillId: number, answer: string) {
    const r = await fetch(`/api/peer-drills/${drillId}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    if (r.ok) {
      setDrills((prev) => prev.filter((d) => d.id !== drillId));
    }
    return r.ok;
  }

  return (
    <AppShell user={data.user}>
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center gap-4">
          <img
            src="/mascot/treats/kaas/idle.png"
            alt=""
            aria-hidden
            className="anim-idle-bob h-16 w-16 shrink-0"
          />
          <div>
            <div
              className="text-display text-xs font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--color-brand-blue-dark)" }}
            >
              <span aria-hidden>✉️</span> Friends
            </div>
            <h1 className="mt-0.5 text-3xl font-extrabold leading-tight">
              Peer drills
            </h1>
            <p className="text-sm" style={{ color: "var(--text-soft)" }}>
              Send a Dutch sentence to a friend, or answer one they sent you.
            </p>
          </div>
        </header>

        <form className="peer-search" onSubmit={onAddLearner}>
          <div className="peer-search-field">
            <span className="peer-search-icon" aria-hidden>
              🔍
            </span>
            <input
              className="peer-search-input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search learners…"
              aria-label="Search learners by name to add a friend"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={searchBusy || !search.trim()}
            aria-label="Send friend request"
          >
            {searchBusy ? "…" : "+"}
          </Button>
        </form>
        {searchStatus && (
          <p
            className="-mt-3 text-sm"
            style={{ color: "var(--text-soft)" }}
            role="status"
          >
            {searchStatus}
          </p>
        )}

        <section className="card">
          <h2
            className="text-display mb-4 text-sm font-bold uppercase tracking-[0.1em]"
            style={{ color: "var(--color-brand-orange-dark)" }}
          >
            Send a sentence
          </h2>
          {data.friends.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-soft)" }}>
              You have no friends yet. Add one from the Users page first.
            </p>
          ) : (
            <form className="space-y-3" onSubmit={onSend}>
              <label className="block text-sm">
                <span
                  className="text-display font-semibold"
                  style={{ color: "var(--text-body)" }}
                >
                  To
                </span>
                <select
                  className="peer-input mt-1"
                  value={toUserId ?? ""}
                  onChange={(e) => setToUserId(Number(e.target.value))}
                >
                  {data.friends.map((f) => (
                    <option key={f.userId} value={f.userId}>
                      {f.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span
                  className="text-display font-semibold"
                  style={{ color: "var(--text-body)" }}
                >
                  Sentence (Dutch)
                </span>
                <textarea
                  className="peer-input mt-1"
                  rows={2}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ik ga morgen naar de markt."
                  required
                />
              </label>
              <label className="block text-sm">
                <span
                  className="text-display font-semibold"
                  style={{ color: "var(--text-body)" }}
                >
                  Hint for them (optional)
                </span>
                <input
                  className="peer-input mt-1"
                  type="text"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="future tense"
                />
              </label>
              <div className="flex items-center gap-3">
                <Button type="submit" size="sm" disabled={sending || !prompt.trim()}>
                  {sending ? "Sending..." : "Send"}
                </Button>
                {sendStatus && (
                  <span className="text-sm" style={{ color: "var(--text-soft)" }}>
                    {sendStatus}
                  </span>
                )}
              </div>
            </form>
          )}
        </section>

        <section className="card">
          <h2
            className="text-display mb-4 text-sm font-bold uppercase tracking-[0.1em]"
            style={{ color: "var(--color-brand-orange-dark)" }}
          >
            Inbox ({drills.length})
          </h2>
          {drills.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <img
                src="/mascot/treats/kaas/happy.png"
                alt=""
                aria-hidden
                className="anim-idle-bob h-16 w-16"
              />
              <p className="text-sm" style={{ color: "var(--text-soft)" }}>
                No pending drills. Lekker bezig!
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {drills.map((d) => (
                <InboxRow key={d.id} drill={d} onSubmit={onSubmit} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function InboxRow({
  drill,
  onSubmit,
}: {
  drill: InboxEntry;
  onSubmit: (id: number, answer: string) => Promise<boolean>;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <li className="peer-inbox-row">
      <div
        className="text-display mb-2 flex items-center gap-1.5 text-xs font-semibold"
        style={{ color: "var(--text-muted)" }}
      >
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
          style={{
            background: "var(--color-brand-blue-soft)",
            color: "var(--color-brand-blue-dark)",
          }}
        >
          {drill.fromDisplayName.slice(0, 2).toUpperCase()}
        </span>
        From {drill.fromDisplayName}
      </div>
      <div className="mb-2 text-lg font-semibold" style={{ color: "var(--text-strong)" }}>
        &ldquo;{drill.prompt}&rdquo;
      </div>
      {drill.expectedAnswerHint && (
        <div className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
          Hint: {drill.expectedAnswerHint}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!answer.trim()) return;
          setBusy(true);
          setErr(null);
          const ok = await onSubmit(drill.id, answer.trim());
          if (!ok) setErr("Submit failed.");
          setBusy(false);
        }}
      >
        <input
          className="peer-input flex-1"
          type="text"
          placeholder="Your translation"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <Button type="submit" variant="green" size="sm" disabled={busy || !answer.trim()}>
          {busy ? "..." : "Send"}
        </Button>
      </form>
      {err && (
        <div className="mt-1 text-xs font-semibold" style={{ color: "var(--color-bad)" }}>
          {err}
        </div>
      )}
    </li>
  );
}
