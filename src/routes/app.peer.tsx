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
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireWorkerContext } from "../entry.server";
import { requireUserClerkId } from "../lib/server/auth-helper";
import { getUserIdByClerkId, listFriends } from "../lib/server/friends";
import { listInbox  } from "../lib/server/peer-drills";
import type {InboxEntry} from "../lib/server/peer-drills";
import { AppShell } from "../components/AppShell";

const loadPeer = createServerFn({ method: "GET" }).handler(async () => {
  const clerkId = await requireUserClerkId();
  const { env } = requireWorkerContext();
  const drz = db(env.DB);
  const me = await drz.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  if (!me[0]) throw new Error("User row missing");
  const userId = await getUserIdByClerkId(drz, clerkId);
  if (!userId) throw new Error("User row missing");
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
        <header>
          <h1 className="text-2xl font-bold text-neutral-900">Peer drills</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Send a Dutch sentence to a friend, or answer one they sent you.
          </p>
        </header>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Send a sentence
          </h2>
          {data.friends.length === 0 ? (
            <p className="text-sm text-neutral-600">
              You have no friends yet. Add one from the Users page first.
            </p>
          ) : (
            <form className="space-y-3" onSubmit={onSend}>
              <label className="block text-sm">
                <span className="text-neutral-700">To</span>
                <select
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
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
                <span className="text-neutral-700">Sentence (Dutch)</span>
                <textarea
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                  rows={2}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ik ga morgen naar de markt."
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="text-neutral-700">
                  Hint for them (optional)
                </span>
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                  type="text"
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="future tense"
                />
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={sending || !prompt.trim()}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
                {sendStatus && (
                  <span className="text-sm text-neutral-600">{sendStatus}</span>
                )}
              </div>
            </form>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Inbox ({drills.length})
          </h2>
          {drills.length === 0 ? (
            <p className="text-sm text-neutral-600">No pending drills.</p>
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
    <li className="rounded-xl border border-neutral-200 p-4">
      <div className="mb-2 text-xs text-neutral-500">
        From {drill.fromDisplayName}
      </div>
      <div className="mb-2 text-base text-neutral-900">"{drill.prompt}"</div>
      {drill.expectedAnswerHint && (
        <div className="mb-2 text-xs text-neutral-500">
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
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          type="text"
          placeholder="Your translation"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy || !answer.trim()}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "..." : "Send"}
        </button>
      </form>
      {err && <div className="mt-1 text-xs text-red-600">{err}</div>}
    </li>
  );
}
