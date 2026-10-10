import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here? <Link href="/signup">Create an account</Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
