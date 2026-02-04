import { SignUp } from "@clerk/nextjs";
import { AuthLayout } from "@/components/auth/auth-layout";

export default function SignUpPage() {
  return (
    <AuthLayout>
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
    </AuthLayout>
  );
}
