import { createFileRoute } from "@tanstack/react-router";
import { SignUp } from "@clerk/tanstack-react-start";

/**
 * Index route for /sign-up. The companion file `sign-up.$.tsx` handles
 * Clerk's sub-paths (OAuth callbacks etc.). Without this index route,
 * a bare `<a href="/sign-up">` link does not match any route and bounces
 * back to the landing page.
 */
export const Route = createFileRoute("/sign-up/")({ component: SignUpPage });

function SignUpPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  );
}
