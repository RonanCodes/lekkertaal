/**
 * Unit tests for the dev-mode Clerk auth bypass helper.
 *
 * We stub `@clerk/tanstack-react-start/server`'s `auth()` and the
 * `getWorkerContext()` from `entry.server` to drive both code paths
 * without spinning up a real CF Worker request.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const ctxMock = vi.fn();

vi.mock("@clerk/tanstack-react-start/server", () => ({
  auth: () => authMock(),
}));

vi.mock("../../../entry.server", () => ({
  getWorkerContext: () => ctxMock(),
}));

// Redirect throws an object we can catch — match TanStack Router's shape minimally.
vi.mock("@tanstack/react-router", () => ({
  redirect: (opts: { to: string }) => {
    const err = new Error(`redirect:${opts.to}`);
    (err as Error & { to: string }).to = opts.to;
    return err;
  },
}));

// import.meta.env.DEV is statically true under `vitest run` (Vite dev mode),
// so the bypass branch is reachable. Re-import per test to honour mock state.
async function loadHelper() {
  const mod = await import("../auth-helper");
  return mod;
}

describe("requireUserClerkId — bypass path", () => {
  beforeEach(() => {
    authMock.mockReset();
    ctxMock.mockReset();
  });

  it("returns the fixed seed id when DEV_BYPASS_AUTH=true and import.meta.env.DEV is true", async () => {
    ctxMock.mockReturnValue({ env: { DEV_BYPASS_AUTH: "true" }, ctx: {} });
    const { requireUserClerkId, DEV_BYPASS_CLERK_ID } = await loadHelper();
    const id = await requireUserClerkId();
    expect(id).toBe(DEV_BYPASS_CLERK_ID);
    expect(id).toBe("seed_ronan");
    expect(authMock).not.toHaveBeenCalled();
  });

  it("does NOT bypass when DEV_BYPASS_AUTH is unset", async () => {
    ctxMock.mockReturnValue({ env: {}, ctx: {} });
    authMock.mockResolvedValue({ userId: "user_real_123" });
    const { requireUserClerkId } = await loadHelper();
    const id = await requireUserClerkId();
    expect(id).toBe("user_real_123");
    expect(authMock).toHaveBeenCalledOnce();
  });

  it("does NOT bypass when DEV_BYPASS_AUTH is the string 'false'", async () => {
    ctxMock.mockReturnValue({ env: { DEV_BYPASS_AUTH: "false" }, ctx: {} });
    authMock.mockResolvedValue({ userId: "user_real_456" });
    const { requireUserClerkId } = await loadHelper();
    const id = await requireUserClerkId();
    expect(id).toBe("user_real_456");
    expect(authMock).toHaveBeenCalledOnce();
  });

  it("does NOT bypass when worker context is unavailable", async () => {
    ctxMock.mockReturnValue(null);
    authMock.mockResolvedValue({ userId: "user_real_789" });
    const { requireUserClerkId } = await loadHelper();
    const id = await requireUserClerkId();
    expect(id).toBe("user_real_789");
  });
});

describe("requireUserClerkId — production path", () => {
  beforeEach(() => {
    authMock.mockReset();
    ctxMock.mockReset();
    ctxMock.mockReturnValue({ env: {}, ctx: {} });
  });

  it("delegates to auth() and returns the Clerk userId when authenticated", async () => {
    authMock.mockResolvedValue({ userId: "user_clerk_abc" });
    const { requireUserClerkId } = await loadHelper();
    await expect(requireUserClerkId()).resolves.toBe("user_clerk_abc");
  });

  it("throws a redirect to /sign-in when auth() has no userId", async () => {
    authMock.mockResolvedValue({ userId: null });
    const { requireUserClerkId } = await loadHelper();
    await expect(requireUserClerkId()).rejects.toMatchObject({ to: "/sign-in" });
  });
});
