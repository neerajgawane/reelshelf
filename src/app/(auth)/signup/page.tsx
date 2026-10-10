import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { SignupForm } from "@/components/SignupForm";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="You'll verify your phone number with a WhatsApp code before you can sign in."
      footer={
        <>
          Already have an account? <Link href="/login">Sign in</Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
