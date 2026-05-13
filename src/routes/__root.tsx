import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ClerkProvider, UserButton, useAuth } from "@clerk/tanstack-react-start";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lekkertaal" },
      { name: "description", content: "Dutch, made tasty. Daily 5-minute drills + roleplay boss fights." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
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
            <AuthNav />
          </header>
          {children}
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

function AuthNav() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) {
    return <nav className="flex items-center gap-3" />;
  }
  if (isSignedIn) {
    return (
      <nav className="flex items-center gap-3">
        <a href="/app/path" className="text-sm hover:underline">
          Path
        </a>
        <UserButton />
      </nav>
    );
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
