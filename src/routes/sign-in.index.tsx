import { createFileRoute } from "@tanstack/react-router";
import { SignIn } from "@clerk/tanstack-react-start";

/**
 * Index route for /sign-in. Companion to `sign-in.$.tsx` for Clerk's
 * sub-paths (OAuth callbacks etc.). Without this, a bare `<a href="/sign-in">`
 * link does not match any route.
 */
export const Route = createFileRoute("/sign-in/")({ component: SignInPage });

function SignInPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  );
}
