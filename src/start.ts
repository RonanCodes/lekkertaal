/**
 * TanStack Start instance registration.
 *
 * Wires global request middleware. Currently:
 *   - clerkMiddleware() — adds Clerk auth context to every request so that
 *     auth() / useAuth() / <Protect/> work inside route handlers and components.
 *
 * Imported as a side effect from src/entry.server.ts so the start instance
 * is registered before any request handling.
 *
 * Reference: https://clerk.com/docs/quickstarts/tanstack-react-start
 */
import { createStart } from "@tanstack/react-start";
import { clerkMiddleware } from "@clerk/tanstack-react-start/server";

export const startInstance = createStart(() => ({
  requestMiddleware: [clerkMiddleware()],
}));
