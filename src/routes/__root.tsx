import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ClerkProvider, UserButton, useAuth } from "@clerk/tanstack-react-start";

import appCss from "../styles.css?url";
import { IosInstallBanner } from "../components/IosInstallBanner";
import { getEffectiveAuth } from "../lib/server/user";

type EffectiveAuth = Awaited<ReturnType<typeof getEffectiveAuth>>;

export const Route = createRootRoute({
  /**
   * Probe effective server-side auth on every navigation so the header can
   * render the right branch on the first SSR pass. This avoids the hydration
   * mismatch the bypass paths used to cause: SSR sees `tryGetUserClerkId()`
   * as the seed user, but Clerk's client `useAuth()` returns signed-out, so
   * the original `AuthNav` showed "Sign in" with a console warning.
   */
  loader: async () => {
    const auth = await getEffectiveAuth();
    return { auth };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#FF6B1A" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Lekkertaal" },
      { title: "Lekkertaal" },
      { name: "description", content: "Dutch, made tasty. Daily 5-minute drills + roleplay boss fights." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "apple-touch-icon", href: "/logo192.png" },
    ],
    scripts: [
      {
        children:
          "if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(console.error)})}",
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { auth } = Route.useLoaderData();
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <HeadContent />
        </head>
        <body>
          <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
            <a href="/" className="text-xl font-bold">
              Lekkertaal
            </a>
            <AuthNav auth={auth} />
          </header>
          {children}
          <IosInstallBanner />
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
          <Scripts />
        </body>
      </html>
    </ClerkProvider>
  );
}

/**
 * Server-aware auth nav.
 *
 * Render order:
 *  1. If the server loader resolved a signed-in user (real Clerk session OR
 *     a `DEV_BYPASS_AUTH` / e2e-header bypass), show the signed-in branch
 *     on the very first paint. This keeps SSR markup identical to the
 *     client's initial render and kills the hydration mismatch.
 *  2. Otherwise fall back to Clerk's client `useAuth()`. This covers the
 *     "user signs in after the page is already loaded" case (Clerk's
 *     client-side sign-in flow updates `useAuth()` without a full SSR round
 *     trip).
 *  3. In the bypass branch we render a small "dev: <name>" indicator
 *     instead of `<UserButton/>` because there is no Clerk session for
 *     Clerk's component to attach to.
 */
function AuthNav({ auth }: { auth: EffectiveAuth }) {
  const { isSignedIn, isLoaded } = useAuth();

  const serverSignedIn = auth.userId !== null;
  const clientSignedIn = isLoaded && isSignedIn === true;
  const showSignedIn = serverSignedIn || clientSignedIn;

  if (showSignedIn) {
    return (
      <nav className="flex items-center gap-3">
        <a href="/app/path" className="text-sm hover:underline">
          Path
        </a>
        <a href="/app/profile" className="text-sm hover:underline">
          Profile
        </a>
        {auth.isBypass ? (
          <span
            data-testid="dev-bypass-indicator"
            className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-300"
            title="DEV_BYPASS_AUTH is on; Clerk session is not active"
          >
            dev: {auth.displayName ?? "seed_ronan"}
          </span>
        ) : (
          <UserButton />
        )}
      </nav>
    );
  }

  // Client hasn't resolved yet and the server says signed-out → render
  // an empty nav slot of the same shape to avoid layout shift.
  if (!isLoaded) {
    return <nav className="flex items-center gap-3" />;
  }

  return (
    <nav className="flex items-center gap-3">
      <a href="/sign-in" className="text-sm hover:underline">
        Sign in
      </a>
      <a
        href="/sign-up"
        className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
      >
        Sign up
      </a>
    </nav>
  );
}
