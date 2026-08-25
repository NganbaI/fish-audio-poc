import { AuthForm } from "@/components/auth/auth-form";
import { signup } from "@/app/auth-actions";

export default function SignupPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <AuthForm mode="signup" action={signup} />
    </div>
  );
}
