/**
 * Unit tests for the dev-mode Clerk auth bypass helper.
 *
 * We stub `@clerk/tanstack-react-start/server`'s `auth()`, the
 * `getWorkerContext()` from `entry.server`, and `getRequestHeader()` from
 * `@tanstack/react-start/server` to drive every bypass branch without
 * spinning up a real CF Worker request.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const ctxMock = vi.fn();
const getRequestHeaderMock = vi.fn();

vi.mock("@clerk/tanstack-react-start/server", () => ({
  auth: () => authMock(),
}));

vi.mock("../../../entry.server", () => ({
  getWorkerContext: () => ctxMock(),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => getRequestHeaderMock(name),
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

describe("requireUserClerkId / DEV_BYPASS_AUTH path", () => {
  beforeEach(() => {
    authMock.mockReset();
    ctxMock.mockReset();
    getRequestHeaderMock.mockReset();
    getRequestHeaderMock.mockReturnValue(undefined);
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

  it("does NOT bypass when worker context is unavailable and no env token configured", async () => {
    ctxMock.mockReturnValue(null);
    authMock.mockResolvedValue({ userId: "user_real_789" });
    const { requireUserClerkId } = await loadHelper();
    const id = await requireUserClerkId();
    expect(id).toBe("user_real_789");
  });
});

describe("requireUserClerkId / E2E header bypass", () => {
  const SECRET = "test-secret-301419e3d5d1bd7a";

  beforeEach(() => {
    authMock.mockReset();
    ctxMock.mockReset();
    getRequestHeaderMock.mockReset();
    getRequestHeaderMock.mockReturnValue(undefined);
  });

  it("returns the seed id when the bypass header matches E2E_BYPASS_TOKEN", async () => {
    ctxMock.mockReturnValue({ env: { E2E_BYPASS_TOKEN: SECRET }, ctx: {} });
    getRequestHeaderMock.mockImplementation((name: string) =>
      name === "x-lekkertaal-e2e-bypass" ? SECRET : undefined,
    );
    const { requireUserClerkId, DEV_BYPASS_CLERK_ID } = await loadHelper();
    const id = await requireUserClerkId();
    expect(id).toBe(DEV_BYPASS_CLERK_ID);
    expect(authMock).not.toHaveBeenCalled();
  });

  it("does NOT bypass when the header is missing", async () => {
    ctxMock.mockReturnValue({ env: { E2E_BYPASS_TOKEN: SECRET }, ctx: {} });
    getRequestHeaderMock.mockReturnValue(undefined);
    authMock.mockResolvedValue({ userId: "user_real_no_header" });
    const { requireUserClerkId } = await loadHelper();
    const id = await requireUserClerkId();
    expect(id).toBe("user_real_no_header");
  });

  it("does NOT bypass when the header value is wrong", async () => {
    ctxMock.mockReturnValue({ env: { E2E_BYPASS_TOKEN: SECRET }, ctx: {} });
    getRequestHeaderMock.mockImplementation((name: string) =>
      name === "x-lekkertaal-e2e-bypass" ? "wrong-secret" : undefined,
    );
    authMock.mockResolvedValue({ userId: "user_real_wrong_header" });
    const { requireUserClerkId } = await loadHelper();
    const id = await requireUserClerkId();
    expect(id).toBe("user_real_wrong_header");
  });

  it("does NOT bypass when E2E_BYPASS_TOKEN is unset, even if header is present", async () => {
    ctxMock.mockReturnValue({ env: {}, ctx: {} });
    getRequestHeaderMock.mockImplementation((name: string) =>
      name === "x-lekkertaal-e2e-bypass" ? "anything" : undefined,
    );
    authMock.mockResolvedValue({ userId: "user_real_no_secret" });
    const { requireUserClerkId } = await loadHelper();
    const id = await requireUserClerkId();
    expect(id).toBe("user_real_no_secret");
  });

  it("rejects an empty-string header even when token is empty-string", async () => {
    // Guards against a config bug where both sides default to "" and would
    // otherwise compare equal.
    ctxMock.mockReturnValue({ env: { E2E_BYPASS_TOKEN: "" }, ctx: {} });
    getRequestHeaderMock.mockImplementation((name: string) =>
      name === "x-lekkertaal-e2e-bypass" ? "" : undefined,
    );
    authMock.mockResolvedValue({ userId: "user_real_empty" });
    const { requireUserClerkId } = await loadHelper();
    const id = await requireUserClerkId();
    expect(id).toBe("user_real_empty");
  });
});

describe("requireUserClerkId / production path", () => {
  beforeEach(() => {
    authMock.mockReset();
    ctxMock.mockReset();
    getRequestHeaderMock.mockReset();
    getRequestHeaderMock.mockReturnValue(undefined);
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
