import { createFileRoute } from "@tanstack/react-router";
import { SignUp } from "@clerk/tanstack-react-start";

export const Route = createFileRoute("/sign-up/$")({ component: SignUpPage });

function SignUpPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6">
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  );
}
