/**
 * Minimal Web Push sender for Cloudflare Workers.
 *
 * Implements just enough of RFC 8030 + VAPID (RFC 8292) to deliver
 * notifications to FCM / Mozilla autopush / Apple PWA endpoints.
 *
 * Strategy:
 * - No payload encryption. We send notifications with NO body, relying on
 *   the service worker to compose copy at receive time. This dodges the
 *   AES-128-GCM ECDH dance that's painful from a Worker. The cost: notif
 *   text is the same for every subscription per-user; we encode the
 *   streak count in the URL fragment for the SW to read on click.
 * - VAPID JWT signed in Web Crypto (ES256). The VAPID public key matching
 *   this private key must be served to the client on subscribe (we expose
 *   it via /api/push-vapid).
 *
 * Required env: VAPID_PUBLIC (base64url), VAPID_PRIVATE (base64url),
 * VAPID_SUBJECT ("mailto:..." or https URL).
 *
 * Stale subscriptions (HTTP 404/410) are deleted by the caller via the
 * returned `staleEndpoints` array.
 */
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { pushSubscriptions } from "../../db/schema";
import { eq } from "drizzle-orm";

export type WebPushEnv = {
  VAPID_PUBLIC?: string;
  VAPID_PRIVATE?: string;
  VAPID_SUBJECT?: string;
};

export type PushResult = {
  endpoint: string;
  status: number;
  stale: boolean;
};

/**
 * POST a no-body push to one subscription endpoint with a VAPID Authorization
 * header. Returns { status, stale } so the caller can prune.
 */
export async function sendPushToEndpoint(
  env: WebPushEnv,
  subscription: { endpoint: string },
  options?: { topic?: string; ttlSeconds?: number; urgency?: "very-low" | "low" | "normal" | "high" },
): Promise<PushResult> {
  if (!env.VAPID_PUBLIC || !env.VAPID_PRIVATE || !env.VAPID_SUBJECT) {
    throw new Error("VAPID keys not configured");
  }

  const audience = audienceFromEndpoint(subscription.endpoint);
  const jwt = await buildVapidJwt({
    audience,
    subject: env.VAPID_SUBJECT,
    privateKeyBase64Url: env.VAPID_PRIVATE,
  });

  const headers: Record<string, string> = {
    Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC}`,
    TTL: String(options?.ttlSeconds ?? 86400),
    Urgency: options?.urgency ?? "normal",
  };
  if (options?.topic) headers.Topic = options.topic;
  // No payload → Content-Length is 0; no encryption headers needed.

  const r = await fetch(subscription.endpoint, {
    method: "POST",
    headers,
  });

  return {
    endpoint: subscription.endpoint,
    status: r.status,
    stale: r.status === 404 || r.status === 410,
  };
}

/**
 * Send to every subscription for a user. Returns the per-endpoint result so
 * the cron can prune stale rows.
 */
export async function sendPushToUser(
  drz: DrizzleD1Database,
  env: WebPushEnv,
  userId: number,
  options?: Parameters<typeof sendPushToEndpoint>[2],
): Promise<PushResult[]> {
  const subs = await drz
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  const results: PushResult[] = [];
  for (const s of subs) {
    try {
      const r = await sendPushToEndpoint(env, s, options);
      results.push(r);
      if (r.stale) {
        await drz.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
      }
    } catch (err) {
      console.error("[web-push] send failed for", s.endpoint, err);
      results.push({ endpoint: s.endpoint, status: 0, stale: false });
    }
  }
  return results;
}

function audienceFromEndpoint(endpoint: string): string {
  const u = new URL(endpoint);
  return `${u.protocol}//${u.host}`;
}

async function buildVapidJwt({
  audience,
  subject,
  privateKeyBase64Url,
}: {
  audience: string;
  subject: string;
  privateKeyBase64Url: string;
}): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60; // 12h
  const payload = { aud: audience, exp, sub: subject };

  const enc = (obj: object) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
  const signingInput = `${enc(header)}.${enc(payload)}`;

  const key = await importVapidPrivateKey(privateKeyBase64Url);
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  const sig = base64UrlEncode(new Uint8Array(sigBuf));
  return `${signingInput}.${sig}`;
}

/**
 * Import a VAPID private key. Accepts the raw 32-byte d value in
 * base64url (standard VAPID format).
 */
async function importVapidPrivateKey(base64Url: string): Promise<CryptoKey> {
  const d = base64UrlDecode(base64Url);
  if (d.length !== 32) {
    throw new Error(`VAPID private key must be 32 bytes, got ${d.length}`);
  }
  // PKCS8 wrapper for an EC P-256 private key with `d`. Web Crypto can't
  // import a bare 32-byte d, so we wrap it into JWK and import that.
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: base64Url,
    // x and y are unused for signing but JWK import requires them. Derive
    // from the public part won't help here; pass placeholders and rely on
    // ES256 sign-only usage which doesn't need them on every backend.
    // Cloudflare Web Crypto requires both to be present and valid base64url.
    // We have the public key separately (env.VAPID_PUBLIC = uncompressed 65b
    // 0x04 || x || y); split it into x/y so JWK import succeeds.
    x: "",
    y: "",
    ext: true,
  };
  // The caller passes VAPID_PUBLIC separately via env, but we don't have it
  // here. Workaround: import as PKCS8.
  const pkcs8 = buildEcPkcs8(d);
  return await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  void jwk; // suppress unused
}

/**
 * Build a PKCS8 envelope for an EC P-256 private key from the raw 32-byte d.
 *
 * The structure is rigid for P-256 / secp256r1: we hardcode the OIDs and
 * splice in the 32-byte d at the well-known offset.
 *
 * This is the standard trick used by web-push libraries in environments
 * that lack a raw-key import path.
 */
function buildEcPkcs8(d: Uint8Array): Uint8Array {
  // PKCS8 header for EC P-256 private key, minus the 32-byte d.
  // Cribbed from RFC 5208 + SEC1 + the known OID for prime256v1.
  // The final 32 bytes are the raw d value.
  const header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce,
    0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04,
    0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  // After the 32-byte d we need an Optional public key, but Web Crypto accepts
  // a truncated PKCS8 without it. Including a minimal trailer keeps things safe.
  const trailer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00, 0x04,
  ]);
  // Use a 64-byte zero "public point" placeholder. Workers' Web Crypto accepts
  // this for ECDSA sign-only usage.
  const pubPlaceholder = new Uint8Array(64);
  const out = new Uint8Array(header.length + d.length + trailer.length + pubPlaceholder.length);
  out.set(header, 0);
  out.set(d, header.length);
  out.set(trailer, header.length + d.length);
  out.set(pubPlaceholder, header.length + d.length + trailer.length);
  return out;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
