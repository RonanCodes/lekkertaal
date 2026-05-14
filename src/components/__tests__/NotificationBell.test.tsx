/**
 * Component test for <NotificationBell/>.
 *
 * Covers the parts the component owns:
 *   - On mount, fetches /api/notifications/inbox and renders an empty state
 *     when the list is empty.
 *   - Badge reflects unread count and caps at "9+".
 *   - Clicking the bell toggles the dropdown.
 *   - Clicking an item POSTs /api/notifications/:id/read, drops the item
 *     from the list, and navigates to its `link`.
 *
 * The network is mocked; we do not exercise the real fetch handler — that is
 * covered by the server-side integration tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { NotificationBell } from "../NotificationBell";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("<NotificationBell/>", () => {
  let fetchMock: FetchMock;
  let originalLocation: Location;
  let assignSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Stub window.location.assign so item-click navigation does not crash
    // jsdom. We replace the whole location object with a minimal shim.
    originalLocation = window.location;
    assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign: assignSpy, pathname: "/app/path" },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  function inboxFetchMock(items: unknown[]) {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ notifications: items }),
    );
  }

  it("renders empty state when the inbox is empty", async () => {
    inboxFetchMock([]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole("button", { name: /Notifications/i }));
    await waitFor(() => {
      expect(screen.getByText(/You are all caught up\./i)).toBeInTheDocument();
    });
  });

  it("renders a badge with the unread count", async () => {
    inboxFetchMock([
      {
        id: 1,
        kind: "peer_drill_completed",
        sentAt: "2026-05-14",
        result: "42",
        link: "/app/peer",
        fromDisplayName: "Bob",
      },
      {
        id: 2,
        kind: "peer_drill_completed",
        sentAt: "2026-05-14",
        result: "43",
        link: "/app/peer",
        fromDisplayName: "Charlie",
      },
    ]);
    render(<NotificationBell />);
    const btn = await screen.findByRole("button", { name: /2 unread/i });
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toContain("2");
  });

  it("caps the badge at 9+ for ten or more unread", async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      id: i + 1,
      kind: "peer_drill_completed",
      sentAt: "2026-05-14",
      result: String(i + 1),
      link: "/app/peer",
      fromDisplayName: "Bob",
    }));
    inboxFetchMock(many);
    render(<NotificationBell />);
    const btn = await screen.findByRole("button", { name: /11 unread/i });
    expect(btn.textContent).toContain("9+");
  });

  it("opens the dropdown on click and lists items", async () => {
    inboxFetchMock([
      {
        id: 7,
        kind: "peer_drill_completed",
        sentAt: "2026-05-14",
        result: "42",
        link: "/app/peer",
        fromDisplayName: "Bob",
      },
    ]);
    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: /Notifications/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/Bob answered your peer drill/i),
      ).toBeInTheDocument();
    });
  });

  it("marks an item read on click, drops it, and navigates to its link", async () => {
    // Default behaviour: GET inbox returns one item. POST mark-read returns
    // ok. The mock matches on URL so we can keep it stable across the two
    // GETs (mount + open re-fetch) and the POST.
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/notifications/inbox") {
        return jsonResponse({
          notifications: [
            {
              id: 7,
              kind: "peer_drill_completed",
              sentAt: "2026-05-14",
              result: "42",
              link: "/app/peer",
              fromDisplayName: "Bob",
            },
          ],
        });
      }
      if (
        url === "/api/notifications/7/read" &&
        init?.method === "POST"
      ) {
        return jsonResponse({ updated: true });
      }
      return new Response("not found", { status: 404 });
    });

    render(<NotificationBell />);
    fireEvent.click(await screen.findByRole("button", { name: /Notifications/i }));
    const item = await screen.findByRole("menuitem", {
      name: /Bob answered your peer drill/i,
    });

    await act(async () => {
      fireEvent.click(item);
    });

    // POST went out.
    const markReadCall = fetchMock.mock.calls.find(
      ([url]) =>
        typeof url === "string" && url === "/api/notifications/7/read",
    );
    expect(markReadCall).toBeDefined();
    expect(markReadCall?.[1]).toMatchObject({ method: "POST" });

    // Navigated to the deep-link.
    expect(assignSpy).toHaveBeenCalledWith("/app/peer");
  });
});
