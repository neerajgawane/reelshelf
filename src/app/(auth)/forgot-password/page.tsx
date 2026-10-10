import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/AuthShell";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll send a code to your phone on WhatsApp."
      footer={<Link href="/login">Back to sign in</Link>}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
