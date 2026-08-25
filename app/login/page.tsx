import { AuthForm } from "@/components/auth/auth-form";
import { login } from "@/app/auth-actions";

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <AuthForm mode="login" action={login} />
    </div>
  );
}
